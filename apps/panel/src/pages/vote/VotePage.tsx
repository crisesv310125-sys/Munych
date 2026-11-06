import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@munych/ui/components/Button';
import { CriterionSlider } from '@munych/ui/components/CriterionSlider';
import { EmptyState } from '@munych/ui/components/EmptyState';
import { Input } from '@munych/ui/components/FormControls';
import { getBallot, submitVotes } from '../../data-access/endpoints';
import { ApiError } from '../../data-access/errors';
import { queryKeys } from '../../data-access/queryClient';
import { levelDescriptor } from '../../lib/judgeScoreMeta';
import type { Ballot, BallotDelegation } from '../../data-access/apiTypes';
import shellStyles from '../../components/layout/JudgeLayout.module.css';
import listStyles from '../judge/CommitteePage.module.css';
import formStyles from '../judge/ScoringForm.module.css';

/**
 * Decisión de diseño (hito 12): boleta del delegado, pública (sin login de Supabase).
 * El delegado entra con el enlace o QR personal `#/votar/<token>`; el token se guarda en
 * este navegador para todo el evento y se quita de la URL. Reutiliza los estilos de la
 * vista móvil del juez (CommitteePage / ScoringForm) y CriterionSlider; sin estilos nuevos.
 */

const TOKEN_KEY = 'munych.voter-token';
const POLL_MS = 20_000;

function readStoredToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

function storeToken(token: string) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // navegación privada: el token vive solo en memoria
  }
}

function label(d: BallotDelegation): string {
  return d.character_name ?? d.country_code ?? '—';
}

function weightedPercent(values: Record<string, number>, ballot: Ballot): number {
  const rubric = ballot.rubric;
  if (!rubric) return 0;
  return rubric.criteria.reduce((sum, c) => sum + ((values[c.id] ?? 0) / (rubric.scale_max || 1)) * c.weight, 0);
}

function votesFor(ballot: Ballot, delegationId: string): Record<string, number> {
  const values: Record<string, number> = {};
  ballot.votes.filter((v) => v.delegation_id === delegationId).forEach((v) => (values[v.criterion_id] = v.value));
  return values;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className={shellStyles.shell}>
      <div className={shellStyles.content} style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
        {children}
      </div>
    </div>
  );
}

function Header({ title, sub, onBack }: { title: string; sub: string; onBack?: () => void }) {
  return (
    <div className={listStyles.mobileHeader}>
      <div className={listStyles.topRow}>
        {onBack && (
          <button className={listStyles.backBtn} onClick={onBack} aria-label="Volver">
            <ChevronLeft size={20} />
          </button>
        )}
        <div className={listStyles.titleGroup}>
          <span className={listStyles.committeeName} style={{ fontSize: 21 }}>
            {title}
          </span>
          <span className={listStyles.subLine}>{sub}</span>
        </div>
      </div>
    </div>
  );
}

/** Pantalla para escribir el código cuando no hay token (o el guardado ya no sirve). */
function CodeEntry({ message, onSubmit }: { message?: string; onSubmit: (token: string) => void }) {
  const [code, setCode] = useState('');
  return (
    <Shell>
      <Header title="Votación de delegados" sub="Entra con tu enlace o QR personal" />
      <div className={listStyles.listBody}>
        {message && <span style={{ fontSize: 13, color: '#C0392B', lineHeight: 1.5 }}>{message}</span>}
        <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
          Escanea el QR de tu gafete o abre el enlace que te dio el staff. Si tienes el código, pégalo aquí.
        </span>
        <Input label="Código de acceso" value={code} onChange={(e) => setCode(e.target.value.trim())} autoComplete="off" />
        <Button fullWidth disabled={code.length < 20} onClick={() => onSubmit(code)}>
          Entrar
        </Button>
      </div>
    </Shell>
  );
}

export function VotePage() {
  const { token: tokenInUrl } = useParams<{ token?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [token, setToken] = useState(() => tokenInUrl ?? readStoredToken());

  // El token se guarda para todo el evento y se quita de la URL (que no quede a la vista).
  useEffect(() => {
    if (tokenInUrl) {
      storeToken(tokenInUrl);
      navigate('/votar', { replace: true });
    }
  }, [tokenInUrl, navigate]);

  const { data: ballot, error, isLoading } = useQuery({
    queryKey: queryKeys.ballot(token),
    queryFn: () => getBallot(token),
    enabled: !!token,
    // Sin sesión abierta, la página espera la siguiente consultando cada 20 s.
    refetchInterval: POLL_MS,
    retry: (count, err) => !(err instanceof ApiError && err.status === 401) && count < 2,
  });

  const [selection, setSelection] = useState<{ session: string; delegation: string } | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');

  const sessionId = ballot?.open_session?.session_id;
  // Si la sesión cambia, la selección deja de valer y se vuelve a la lista.
  const selectedId = selection && selection.session === sessionId ? selection.delegation : null;
  const setSelectedId = (delegationId: string | null) =>
    setSelection(delegationId && sessionId ? { session: sessionId, delegation: delegationId } : null);

  function enterWith(code: string) {
    storeToken(code);
    setToken(code);
  }

  if (!token) return <CodeEntry onSubmit={enterWith} />;
  if (error instanceof ApiError && error.status === 401) {
    return (
      <CodeEntry
        message={error.detail}
        onSubmit={(code) => {
          qc.removeQueries({ queryKey: queryKeys.ballot(token) });
          enterWith(code);
        }}
      />
    );
  }
  if (isLoading || !ballot) {
    return (
      <Shell>
        <Header title="Votación de delegados" sub={error ? 'No se pudo conectar; reintentando…' : 'Cargando tu boleta…'} />
      </Shell>
    );
  }

  const sub = `${label(ballot.own_delegation)} · ${ballot.committee_acronym} · ${ballot.event_name}`;
  const rubric = ballot.rubric;

  if (!ballot.open_session || !rubric) {
    const reason =
      ballot.event_status === 'closed'
        ? 'El evento terminó. ¡Gracias por participar!'
        : ballot.event_status === 'draft'
          ? 'El evento aún no inicia. Deja esta página abierta: se actualiza sola.'
          : !rubric
            ? 'Tu comité aún no tiene rúbrica. Avisa al staff.'
            : 'Esperando la siguiente sesión. Deja esta página abierta: se actualiza sola.';
    return (
      <Shell>
        <Header title={ballot.voter_name} sub={sub} />
        <div className={listStyles.listBody}>
          <EmptyState message={reason} />
        </div>
      </Shell>
    );
  }

  const votedIds = new Set(ballot.votes.map((v) => v.delegation_id));
  const selected = ballot.delegations.find((d) => d.delegation_id === selectedId);

  function open(d: BallotDelegation) {
    setSaveError('');
    setNotice('');
    setDraft(votesFor(ballot!, d.delegation_id));
    setSelectedId(d.delegation_id);
  }

  if (!selected) {
    return (
      <Shell>
        <Header title={ballot.voter_name} sub={`${sub} · Sesión ${ballot.open_session.number}`} />
        <div className={listStyles.listBody}>
          {notice && <span style={{ fontSize: 12, color: 'var(--state-done-dot)' }}>{notice}</span>}
          <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
            Votaste por {votedIds.size} de {ballot.delegations.length} delegaciones en esta sesión. No puedes votar por tu propia
            delegación. Puedes corregir tus votos mientras la sesión siga abierta.
          </span>
          {ballot.delegations.map((d) => {
            const voted = votedIds.has(d.delegation_id);
            const values = votesFor(ballot, d.delegation_id);
            return (
              <div key={d.delegation_id} className={listStyles.countryRow} onClick={() => open(d)}>
                <span className={listStyles.stripe} style={{ background: voted ? 'var(--state-done-dot)' : 'var(--state-none-dot)' }} />
                <div className={listStyles.countryInfo}>
                  <span className={listStyles.countryName}>{label(d)}</span>
                  <span className={listStyles.countryStatus}>{voted ? 'Votado' : 'Sin votar'}</span>
                </div>
                <div className={listStyles.scoreBlock}>
                  <span className={listStyles.scoreValue} style={{ color: voted ? 'var(--navy)' : 'var(--state-none-dot)' }}>
                    {voted ? weightedPercent(values, ballot).toFixed(1) : '—'}
                  </span>
                  <span className={listStyles.scoreOf}>/ 100</span>
                </div>
                <ChevronRight size={18} className={listStyles.chevron} />
              </div>
            );
          })}
        </div>
      </Shell>
    );
  }

  const complete = rubric.criteria.every((c) => draft[c.id] !== undefined);
  const index = ballot.delegations.indexOf(selected);
  const next = ballot.delegations.slice(index + 1).find((d) => !votedIds.has(d.delegation_id)) ?? null;

  async function save() {
    setSaving(true);
    setSaveError('');
    try {
      const updated = await submitVotes(
        token,
        rubric!.criteria.map((c) => ({ delegation_id: selected!.delegation_id, criterion_id: c.id, value: draft[c.id] })),
      );
      qc.setQueryData(queryKeys.ballot(token), updated);
      setNotice(`Voto guardado: ${label(selected!)}.`);
      if (next) open(next);
      else setSelectedId(null);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.detail : 'No se pudo guardar; revisa tu conexión e inténtalo de nuevo.');
      if (err instanceof ApiError && (err.code === 'SESSION_CLOSED' || err.status === 401)) {
        qc.invalidateQueries({ queryKey: queryKeys.ballot(token) });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell>
      <div className={formStyles.mobileHeader}>
        <div className={formStyles.mobileTopRow}>
          <div className={formStyles.mobileTitleGroup}>
            <button className={formStyles.backBtn} onClick={() => setSelectedId(null)} aria-label="Volver">
              <ChevronLeft size={20} />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span className={formStyles.countryName} style={{ fontSize: 21 }}>
                {label(selected)}
              </span>
              <span className={formStyles.subLine}>
                Sesión {ballot.open_session.number} · {index + 1} de {ballot.delegations.length}
              </span>
            </div>
          </div>
          <div className={formStyles.totalBlock}>
            <span className={formStyles.totalValue} style={{ fontSize: 30 }}>
              {weightedPercent(draft, ballot).toFixed(1)}
            </span>
            <span className={formStyles.totalLabel}>TOTAL PONDERADO</span>
          </div>
        </div>
      </div>
      <div className={formStyles.mobileBody}>
        {!complete && (
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Mueve cada criterio para registrar tu voto (todos son obligatorios).</span>
        )}
        {rubric.criteria.map((c) => (
          <CriterionSlider
            key={c.id}
            name={c.name}
            weight={c.weight}
            value={draft[c.id]}
            min={rubric.scale_min}
            max={rubric.scale_max}
            descriptor={draft[c.id] !== undefined ? levelDescriptor(c, draft[c.id]) : (c.description ?? '')}
            onChange={(v) => setDraft((prev) => ({ ...prev, [c.id]: v }))}
          />
        ))}
        {saveError && <span style={{ fontSize: 12, color: '#C0392B' }}>{saveError}</span>}
      </div>
      <div className={formStyles.mobileFooter}>
        <Button fullWidth onClick={save} disabled={!complete || saving}>
          {saving ? 'Guardando…' : next ? `Guardar y seguir con ${label(next)}` : 'Guardar voto'}
        </Button>
      </div>
    </Shell>
  );
}
