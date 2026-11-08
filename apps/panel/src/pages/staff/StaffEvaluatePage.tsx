import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { AutosaveIndicator, type SaveState } from '@munych/ui/components/AutosaveIndicator';
import { Button } from '@munych/ui/components/Button';
import { CriterionSlider } from '@munych/ui/components/CriterionSlider';
import { getStaffMe, saveStaffEvaluation } from '../../data-access/endpoints';
import { ApiError, errorMessage } from '../../data-access/errors';
import type { StaffAssignment, StaffCandidate, StaffMe } from '../../data-access/staffTypes';
import formStyles from '../judge/ScoringForm.module.css';
import styles from './StaffEvaluatePage.module.css';

/**
 * Decisión de diseño (hito 15): vista con la que el miembro del staff evalúa desde su teléfono
 * (el handoff la deja como «siguiente paso»). Entra con su enlace personal
 * `#/staff/evaluar/<token>`; el token se guarda en este navegador y se quita de la URL.
 * Reutiliza la tarjeta de criterio con slider y el autoguardado del formulario del juez.
 */

const TOKEN_KEY = 'munych.staff-token';
const SAVE_DELAY_MS = 700;
const meKey = (token: string) => ['staff-me', token] as const;

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

const assignmentKey = (a: Pick<StaffAssignment, 'member_id' | 'event_id'>) => `${a.member_id}:${a.event_id}`;

function tokenFrom(value: string): string {
  const token = value.trim().split('/evaluar/').pop() ?? '';
  return /^[A-Za-z0-9_-]{20,64}$/.test(token) ? token : '';
}

export function StaffEvaluatePage() {
  const { token: tokenInUrl } = useParams<{ token?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [token, setToken] = useState(() => tokenInUrl ?? readStoredToken());
  if (tokenInUrl && tokenInUrl !== token) setToken(tokenInUrl);
  // Una asignación es (miembro, evento): el staff es de la organización y evalúa en cada evento abierto.
  const [open, setOpen] = useState<{ key: string; candidateId: string } | null>(null);

  useEffect(() => {
    if (tokenInUrl) {
      storeToken(tokenInUrl);
      navigate('/staff/evaluar', { replace: true });
    }
  }, [tokenInUrl, navigate]);

  const { data: me, error, isLoading } = useQuery({
    queryKey: meKey(token),
    queryFn: () => getStaffMe(token),
    enabled: !!token,
    retry: (count, err) => !(err instanceof ApiError && err.status === 401) && count < 2,
  });

  function enter(value: string) {
    storeToken(value);
    setToken(value);
  }

  if (!token) return <LinkEntry onSubmit={enter} />;
  if (error instanceof ApiError && error.status === 401) {
    return (
      <LinkEntry
        message={error.detail}
        onSubmit={(t) => {
          qc.removeQueries({ queryKey: meKey(token) });
          enter(t);
        }}
      />
    );
  }
  if (isLoading || !me) {
    return (
      <div className={styles.screen}>
        <div className={styles.center}>
          <span className={styles.sub}>{error ? errorMessage(error) : 'Cargando…'}</span>
        </div>
      </div>
    );
  }

  const assignment = open && me.assignments.find((a) => assignmentKey(a) === open.key);
  if (assignment && open) {
    return (
      <EvaluationScreen
        key={`${open.key}:${open.candidateId}`}
        token={token}
        assignment={assignment}
        candidateId={open.candidateId}
        onNavigate={(candidateId) => setOpen({ key: open.key, candidateId })}
        onBack={() => setOpen(null)}
      />
    );
  }

  return (
    <CandidateList
      me={me}
      onOpen={(key, candidateId) => setOpen({ key, candidateId })}
      onExit={() => {
        qc.removeQueries({ queryKey: meKey(token) });
        storeToken('');
        setToken('');
      }}
    />
  );
}

function LinkEntry({ message, onSubmit }: { message?: string; onSubmit: (token: string) => void }) {
  const [value, setValue] = useState('');
  const token = tokenFrom(value);
  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>MUNYCH · STAFF</span>
        <span className={styles.title}>Evaluación del staff</span>
      </div>
      <div className={styles.center}>
        {message && <div className={styles.notice}>{message}</div>}
        <span className={styles.sub} style={{ fontSize: 13 }}>
          Abre el enlace personal que te envió la coordinación del evento, o pégalo aquí.
        </span>
        <input className={styles.input} placeholder="https://…/staff/evaluar/…" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Enlace personal" />
        <Button fullWidth disabled={!token} onClick={() => onSubmit(token)}>
          Entrar
        </Button>
      </div>
    </div>
  );
}

function CandidateList({ me, onOpen, onExit }: { me: StaffMe; onOpen: (key: string, candidateId: string) => void; onExit: () => void }) {
  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>{me.organization_name.toUpperCase()}</span>
        <span className={styles.title}>{me.full_name}</span>
        {me.title && <span style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>{me.title}</span>}
      </div>
      <div className={styles.body}>
        {me.assignments.length === 0 && (
          <div className={styles.notice}>Todavía no tienes asignaciones de staff en este evento. Pide a la coordinación que te asigne.</div>
        )}
        {me.assignments.map((a) => {
          const done = a.candidates.filter((c) => c.complete).length;
          return (
            <div key={assignmentKey(a)} className={styles.group}>
              <div className={styles.groupHead}>
                <span className={styles.tag} style={{ background: a.color }}>
                  {a.code}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                  <span className={styles.name}>{a.name}</span>
                  <span className={styles.sub}>
                    {a.event_name} · {done} de {a.candidates.length} evaluados · {a.role === 'coordinator' ? 'Coordinación' : 'Evaluación'}
                  </span>
                </div>
              </div>
              {!a.open && (
                <div className={styles.notice} style={{ margin: 12 }}>
                  {a.closed_reason}
                </div>
              )}
              {a.candidates.length === 0 && a.open && (
                <div className={styles.sub} style={{ padding: 14 }}>
                  No hay candidatos asignados a ti.
                </div>
              )}
              {a.candidates.map((c) => (
                <button key={c.candidate_id} className={styles.candidate} onClick={() => onOpen(assignmentKey(a), c.candidate_id)}>
                  <CheckDot candidate={c} total={a.criteria.length} />
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <span className={styles.name}>{c.label}</span>
                    <span className={styles.sub}>{[c.sublabel, c.committee_acronym].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className={styles.sub}>›</span>
                </button>
              ))}
            </div>
          );
        })}
        <button className={styles.sub} style={{ background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', alignSelf: 'center' }} onClick={onExit}>
          Salir en este dispositivo
        </button>
      </div>
    </div>
  );
}

function CheckDot({ candidate, total }: { candidate: StaffCandidate; total: number }) {
  const filled = Object.keys(candidate.values).length;
  if (candidate.complete) return <span className={`${styles.check} ${styles.checkDone}`}>✓</span>;
  if (filled > 0) return <span className={`${styles.check} ${styles.checkPartial}`}>{Math.min(filled, total)}</span>;
  return <span className={`${styles.check} ${styles.checkNone}`}>·</span>;
}

function scoreOf(assignment: StaffAssignment, values: Record<string, number>): number {
  const span = assignment.scale_max - assignment.scale_min || 1;
  return assignment.criteria.reduce((n, c) => (c.id in values ? n + ((values[c.id] - assignment.scale_min) / span) * c.weight : n), 0);
}

function EvaluationScreen({
  token,
  assignment,
  candidateId,
  onNavigate,
  onBack,
}: {
  token: string;
  assignment: StaffAssignment;
  candidateId: string;
  onNavigate: (candidateId: string) => void;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const index = assignment.candidates.findIndex((c) => c.candidate_id === candidateId);
  const candidate = assignment.candidates[index];
  const [values, setValues] = useState<Record<string, number>>(candidate?.values ?? {});
  const [comment, setComment] = useState(candidate?.comment ?? '');
  const [state, setState] = useState<SaveState>('saved');
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ values: Record<string, number>; comment: string } | null>(null);
  const readOnly = !assignment.open;

  async function flush() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const body = pending.current;
    if (!body) return;
    pending.current = null;
    setState('saving');
    try {
      const saved = await saveStaffEvaluation(token, {
        member_id: assignment.member_id,
        event_id: assignment.event_id,
        candidate_id: candidateId,
        values: body.values,
        comment: body.comment || null,
        client_updated_at: new Date().toISOString(),
      });
      setError('');
      setState(pending.current ? 'saving' : 'saved');
      qc.setQueryData<StaffMe>(meKey(token), (old) =>
        old && {
          ...old,
          assignments: old.assignments.map((a) =>
            assignmentKey(a) !== assignmentKey(assignment)
              ? a
              : {
                  ...a,
                  candidates: a.candidates.map((c) =>
                    c.candidate_id === candidateId ? { ...c, values: saved.values, comment: saved.comment, complete: saved.complete, updated_at: saved.updated_at } : c,
                  ),
                },
          ),
        },
      );
    } catch (err) {
      setState('error');
      setError(errorMessage(err));
      // Reintenta más tarde con lo último que haya.
      pending.current = pending.current ?? body;
      timer.current = setTimeout(() => void flush(), 4000);
    }
  }

  function schedule(nextValues: Record<string, number>, nextComment: string) {
    pending.current = { values: nextValues, comment: nextComment };
    setState('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
  }

  // Al salir o cambiar de candidato, se guarda lo pendiente.
  useEffect(
    () => () => {
      void flush();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (!candidate) {
    return (
      <div className={styles.screen}>
        <div className={styles.center}>
          <span className={styles.sub}>Este candidato ya no está en tu lista.</span>
          <Button onClick={onBack}>Volver</Button>
        </div>
      </div>
    );
  }

  const prev = assignment.candidates[index - 1];
  const next = assignment.candidates[index + 1];
  const filled = assignment.criteria.filter((c) => c.id in values).length;

  return (
    <div className={styles.screen}>
      <div className={formStyles.mobileHeader}>
        <div className={formStyles.mobileTopRow}>
          <div className={formStyles.mobileTitleGroup}>
            <button className={formStyles.backBtn} onClick={onBack} aria-label="Volver">
              <ChevronLeft size={20} />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span className={formStyles.countryName} style={{ fontSize: 21 }}>
                {candidate.label}
              </span>
              <span className={formStyles.subLine}>
                {[candidate.sublabel, candidate.committee_acronym].filter(Boolean).join(' · ')} · {index + 1} de {assignment.candidates.length}
              </span>
            </div>
          </div>
          <div className={formStyles.totalBlock}>
            <span className={formStyles.totalValue} style={{ fontSize: 30 }}>
              {scoreOf(assignment, values).toFixed(1)}
            </span>
            <span className={formStyles.totalLabel}>{assignment.code} · /100</span>
          </div>
        </div>
      </div>
      <div className={formStyles.mobileBody}>
        {readOnly && <div className={styles.notice}>{assignment.closed_reason} Tus evaluaciones quedan como están.</div>}
        {!readOnly && filled < assignment.criteria.length && (
          <span className={styles.sub}>
            Califica los {assignment.criteria.length} criterios para que la evaluación cuente ({filled} de {assignment.criteria.length}).
          </span>
        )}
        {assignment.criteria.map((k) => (
          <CriterionSlider
            key={k.id}
            name={k.name}
            weight={k.weight}
            value={values[k.id]}
            min={assignment.scale_min}
            max={assignment.scale_max}
            step={assignment.scale_step}
            descriptor={k.description ?? ''}
            onChange={
              readOnly
                ? () => undefined
                : (v) => {
                    const nextValues = { ...values, [k.id]: v };
                    setValues(nextValues);
                    schedule(nextValues, comment);
                  }
            }
          />
        ))}
        <div className={formStyles.commentCard}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Comentario (opcional)</span>
          <textarea
            rows={3}
            disabled={readOnly}
            placeholder="Observaciones para la coordinación…"
            value={comment}
            maxLength={2000}
            onChange={(e) => {
              setComment(e.target.value);
              schedule(values, e.target.value);
            }}
            style={{ border: '1px solid var(--border-input)', borderRadius: 8, padding: 11, fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, resize: 'none', outline: 'none' }}
          />
          <span style={{ fontSize: 10, color: 'var(--state-none-dot)' }}>Visible solo para la coordinación y los admins.</span>
        </div>
        {error && <span style={{ fontSize: 12, color: '#C0392B' }}>{error}</span>}
      </div>
      <div className={formStyles.mobileFooter}>
        {!readOnly && <AutosaveIndicator state={state} label={state === 'saved' ? 'Guardado automáticamente' : undefined} />}
        <div className={formStyles.navRow}>
          <Button variant="secondary" disabled={!prev} onClick={() => prev && (void flush(), onNavigate(prev.candidate_id))}>
            ‹ {prev ? prev.label : 'Anterior'}
          </Button>
          <Button variant="primary" disabled={!next} onClick={() => next && (void flush(), onNavigate(next.candidate_id))}>
            {next ? next.label : 'Siguiente'} ›
          </Button>
        </div>
      </div>
    </div>
  );
}
