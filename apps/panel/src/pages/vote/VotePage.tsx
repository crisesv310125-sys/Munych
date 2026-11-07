import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBallot, submitPeerVote } from '../../data-access/endpoints';
import { ApiError } from '../../data-access/errors';
import { queryKeys } from '../../data-access/queryClient';
import { countryName } from '../../lib/geo';
import type { Ballot, BallotAward, BallotDelegation, PeerAwardType } from '../../data-access/apiTypes';
import s from './VotePage.module.css';

/**
 * Decisión de diseño (2026-11-06): boleta del delegado, pública (sin login de Supabase),
 * según `handoff-votacion-delegados` (pantallas 3a, 3c–3g). Los delegados ya no usan la
 * rúbrica: una sola vez por comité eligen Mejor delegado, Delegado distinguido y Mención
 * de honor (3 / 2 / 1 puntos). El delegado entra con el enlace o QR personal
 * `#/votar/<token>`; el token se guarda en este navegador y se quita de la URL.
 */

const TOKEN_KEY = 'munych.voter-token';
const POLL_MS = 20_000;
const WIDE_QUERY = '(min-width: 960px)';
/** En escritorio, cuántas delegaciones se ven antes de «Mostrar las N». */
const DESK_VISIBLE = 12;

const QUESTIONS: Record<PeerAwardType, string> = {
  best_delegate: '¿Qué delegación tuvo el mejor desempeño?',
  outstanding_delegate: '¿Qué delegación merece el premio a Delegado distinguido?',
  honorable_mention: '¿Qué delegación merece una Mención de honor?',
};

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

// ---- Formato ----

function delegationName(d: BallotDelegation): string {
  if (d.character_name) return d.character_name;
  if (d.country_code) return countryName(d.country_code);
  return '—';
}

/** Chip tipográfico de 2 letras (código de país o iniciales del personaje). */
function delegationChip(d: BallotDelegation): string {
  if (d.country_code) return d.country_code.toUpperCase();
  const words = (d.character_name ?? '').split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? '—').slice(0, 2);
  return letters.toUpperCase();
}

/** Búsqueda sin mayúsculas ni acentos. */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const timeFmt = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', hour12: false });
const dayFmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

function hhmm(iso: string): string {
  return timeFmt.format(new Date(iso));
}

/** «14 NOV · 17:52» */
function stamp(iso: string): string {
  const date = new Date(iso);
  return `${dayFmt.format(date).replace('.', '').toUpperCase()} · ${timeFmt.format(date)}`;
}

function sameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

const pad = (n: number) => String(n).padStart(2, '0');

function formatWeight(weight: number): string {
  return Number.isInteger(weight) ? String(weight) : weight.toFixed(1);
}

// ---- Hooks ----

/** Reloj que avanza cada segundo mientras `active`. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

function useWide(): boolean {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(WIDE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(WIDE_QUERY);
    const onChange = () => setWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return wide;
}

// ---- Piezas comunes ----

function Page({ dark, children }: { dark?: boolean; children: ReactNode }) {
  return <div className={`${s.page} ${dark ? s.dark : s.light}`}>{children}</div>;
}

function StateTop({ ballot, dark }: { ballot: Ballot; dark?: boolean }) {
  return (
    <div className={s.stateTop}>
      <span className={dark ? s.chipOwn : s.chipInk}>{delegationChip(ballot.own_delegation)}</span>
      <span className={s.identityLine}>
        {delegationName(ballot.own_delegation)} · {ballot.committee_name}
      </span>
    </div>
  );
}

function Identity({ ballot }: { ballot: Ballot }) {
  return (
    <div className={s.identity}>
      <span className={s.chipOwn}>{delegationChip(ballot.own_delegation)}</span>
      <div className={s.identityText}>
        <span className={s.identityName}>{delegationName(ballot.own_delegation)}</span>
        <span className={s.identitySub}>{ballot.committee_name}</span>
      </div>
    </div>
  );
}

function SessionsBar({ total, closed }: { total: number; closed: number }) {
  if (total <= 0) return null;
  return (
    <div className={s.segments} aria-label={`${closed} de ${total} sesiones cerradas`}>
      <div className={s.segmentRow} style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={i < closed ? s.segmentDone : s.segment} />
        ))}
      </div>
      <span className={s.segmentLabel}>
        {closed} DE {total} {total === 1 ? 'CERRADA' : 'CERRADAS'}
      </span>
    </div>
  );
}

// ---- Pantallas ----

/** Entrada con código cuando no hay token (o el guardado ya no sirve). */
function CodeEntry({ message, onSubmit }: { message?: string; onSubmit: (token: string) => void }) {
  const [code, setCode] = useState('');
  return (
    <Page dark>
      <div className={s.column}>
        <form
          className={s.stateMain}
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length >= 20) onSubmit(code);
          }}
        >
          <span className={s.eyebrowGold}>Voto entre pares</span>
          <h1 className={s.stateTitle}>Entra a tu boleta.</h1>
          <p className={s.body}>
            Escanea el QR de tu gafete o abre el enlace que te dio el staff. Si tienes el código, pégalo aquí.
          </p>
          {message && (
            <p className={s.errorDark} role="alert">
              {message}
            </p>
          )}
          <label className={s.fieldLabel} htmlFor="voter-code" style={{ marginTop: 10 }}>
            Código de acceso
          </label>
          <input
            id="voter-code"
            className={s.codeInput}
            style={{ marginTop: 0 }}
            value={code}
            onChange={(e) => setCode(e.target.value.trim())}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Pega tu código"
          />
          <button type="submit" className={s.btnGold} disabled={code.length < 20}>
            Entrar
          </button>
        </form>
      </div>
    </Page>
  );
}

function Loading({ failed }: { failed: boolean }) {
  return (
    <Page dark>
      <div className={s.column}>
        <div className={s.stateMain} aria-live="polite">
          <span className={s.eyebrowGold}>Voto entre pares</span>
          <p className={s.body}>{failed ? 'No se pudo conectar; reintentando…' : 'Cargando tu boleta…'}</p>
        </div>
      </div>
    </Page>
  );
}

/** 3e · La votación aún no abre (con cuenta regresiva si ya hay hora de apertura). */
function NotOpen({ ballot, onElapsed }: { ballot: Ballot; onElapsed: () => void }) {
  const { opens_at, closes_at, status } = ballot.peer_vote;
  const counting = status === 'scheduled' && !!opens_at;
  const now = useNow(counting);
  const remaining = counting ? Math.max(0, new Date(opens_at!).getTime() - now) : 0;
  const elapsed = counting && remaining === 0;

  // Al llegar a cero, se consulta la boleta en vez de esperar al siguiente sondeo.
  useEffect(() => {
    if (elapsed) onElapsed();
  }, [elapsed, onElapsed]);

  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let message: string;
  if (ballot.event_status === 'draft') message = 'El evento aún no inicia. Esta pantalla se actualiza sola.';
  else if (elapsed) message = 'Abriendo la votación… Si tarda, espera a que tu mesa lo indique.';
  else if (counting) message = 'Abre a la hora indicada o al iniciar la sesión. Esta pantalla se actualiza sola.';
  else message = 'Abre cuando tu mesa inicie la sesión. Esta pantalla se actualiza sola.';

  return (
    <Page dark>
      <div className={s.column}>
        <StateTop ballot={ballot} dark />
        <div className={s.stateMain}>
          <span className={s.eyebrowGold}>Voto entre pares</span>
          <h1 className={s.stateTitle}>La votación aún no abre.</h1>
          <p className={s.body} aria-live="polite">
            {message}
          </p>
          {counting && !elapsed && (
            <div className={s.countdown} role="timer" aria-label={`Faltan ${hours} h ${minutes} min`}>
              <div className={s.countBox}>
                <div className={s.countValue}>{pad(hours)}</div>
                <div className={s.countUnit}>HORAS</div>
              </div>
              <div className={s.countBox}>
                <div className={s.countValue}>{pad(minutes)}</div>
                <div className={s.countUnit}>MIN</div>
              </div>
              <div className={s.countBox}>
                <div className={s.countValue}>{pad(seconds)}</div>
                <div className={s.countUnit}>SEG</div>
              </div>
            </div>
          )}
          {opens_at && (
            <span className={s.range}>
              Abre {stamp(opens_at)}
              {closes_at && ` — Cierra ${sameDay(opens_at, closes_at) ? hhmm(closes_at) : stamp(closes_at)}`}
            </span>
          )}
          <SessionsBar total={ballot.sessions_total} closed={ballot.sessions_closed} />
        </div>
      </div>
    </Page>
  );
}

/** 3f · La votación ya cerró y el delegado no votó. */
function Closed({ ballot }: { ballot: Ballot }) {
  const closesAt = ballot.peer_vote.closes_at;
  const noCandidates = ballot.awards.length === 0;
  return (
    <Page>
      <div className={s.column}>
        <StateTop ballot={ballot} />
        <div className={s.stateMain}>
          <span className={s.badgeNeutral}>{closesAt ? `CERRADA · ${hhmm(closesAt)}` : 'CERRADA'}</span>
          <h1 className={s.stateTitle}>La votación ya cerró.</h1>
          <p className={s.body}>
            {noCandidates
              ? 'Tu comité no tenía otras delegaciones por las que votar.'
              : 'No registraste tu voto. Los resultados se publican en la ceremonia de clausura.'}
          </p>
          <div className={s.callout}>¿Un problema técnico? Avisa a la mesa de tu comité.</div>
        </div>
      </div>
    </Page>
  );
}

/** Votación abierta pero sin delegaciones por las que votar. */
function NoCandidates({ ballot }: { ballot: Ballot }) {
  return (
    <Page>
      <div className={s.column}>
        <StateTop ballot={ballot} />
        <div className={s.stateMain}>
          <span className={s.eyebrow}>Voto entre pares</span>
          <h1 className={s.stateTitle}>No hay delegaciones por las que votar.</h1>
          <p className={s.body}>Tu comité no tiene otras delegaciones. Avisa a la mesa si crees que es un error.</p>
        </div>
      </div>
    </Page>
  );
}

/** 3d · Voto registrado, con comprobante y lo que votó. */
function Submitted({ ballot }: { ballot: Ballot }) {
  const byId = new Map(ballot.delegations.map((d) => [d.delegation_id, d]));
  const labels = new Map(ballot.awards.map((a) => [a.award_type, a.label]));
  return (
    <Page>
      <div className={s.column}>
        <div className={s.done}>
          <span className={s.doneCheck} aria-hidden="true">
            ✓
          </span>
          <h1 className={s.doneTitle}>Voto registrado</h1>
          <p className={s.doneBody}>Tu voto entre pares de {ballot.committee_name} se guardó de forma anónima.</p>
          {(ballot.receipt || ballot.submitted_at) && (
            <div className={s.receipt}>
              {ballot.receipt && (
                <>
                  <span className={s.receiptLabel}>Comprobante</span>
                  <span className={s.receiptCode}>{ballot.receipt}</span>
                </>
              )}
              {ballot.submitted_at && (
                <>
                  <span className={s.receiptLabel}>Hora</span>
                  <span className={s.receiptTime}>{stamp(ballot.submitted_at)}</span>
                </>
              )}
            </div>
          )}
          <span className={s.sectionLabel}>Tu voto</span>
          <div className={s.picksCard}>
            {ballot.picks.map((pick) => {
              const d = byId.get(pick.delegation_id);
              return (
                <div key={pick.award_type} className={s.pickRow}>
                  {d && <span className={s.chip}>{delegationChip(d)}</span>}
                  <div className={s.pickAward}>
                    <span className={s.pickAwardLabel}>{labels.get(pick.award_type) ?? pick.award_type}</span>
                    <span className={s.pickName}>{d ? delegationName(d) : 'Delegación'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Page>
  );
}

// ---- Boleta (3a móvil · 3g escritorio · 3c confirmar) ----

type Picks = Partial<Record<PeerAwardType, string>>;

interface Option {
  delegation: BallotDelegation;
  name: string;
  own: boolean;
  /** Premio al que ya se asignó en otro paso. */
  takenBy: BallotAward | null;
}

function OptionRow({ option, selected, onSelect }: { option: Option; selected: boolean; onSelect: () => void }) {
  const disabled = option.own || !!option.takenBy;
  const className = [s.option, selected && s.optionSelected, disabled && s.optionDisabled].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      className={className}
      onClick={onSelect}
    >
      <span className={s.radio} aria-hidden="true" />
      <span className={s.chip}>{delegationChip(option.delegation)}</span>
      <span className={s.optionName}>{option.name}</span>
      {option.own && <span className={s.optionTag}>Tu delegación</span>}
      {option.takenBy && <span className={s.optionTag}>{option.takenBy.label}</span>}
    </button>
  );
}

function EmptySearch({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className={s.empty}>
      <p className={s.emptyText}>Ninguna delegación coincide con «{query}».</p>
      <button type="button" className={s.linkBtn} onClick={onClear}>
        Borrar búsqueda
      </button>
    </div>
  );
}

function ConfirmSheet({
  ballot,
  picks,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  ballot: Ballot;
  picks: Picks;
  submitting: boolean;
  error: string;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, submitting]);

  const byId = new Map(ballot.delegations.map((d) => [d.delegation_id, d]));
  const nameOf = (award: BallotAward) => {
    const d = byId.get(picks[award.award_type] ?? '');
    return d ? delegationName(d) : '—';
  };
  const single = ballot.awards.length === 1 ? ballot.awards[0] : null;

  return (
    <div className={s.scrim} onClick={() => !submitting && onCancel()}>
      <div
        className={s.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <span className={s.handle} aria-hidden="true" />
        <span className={s.eyebrow}>Confirma tu voto</span>
        <h2 id="confirm-title" className={s.sheetTitle}>
          {single ? `Vas a votar por ${nameOf(single)} como ${single.label.toLowerCase()}.` : 'Revisa tu voto antes de enviarlo.'}
        </h2>
        <div className={s.summary}>
          {!single &&
            ballot.awards.map((award) => (
              <FragmentRow key={award.award_type} label={award.label} value={nameOf(award)} strong />
            ))}
          {!single && <span className={s.summaryDivider} />}
          <FragmentRow label="Comité" value={ballot.committee_name} />
          <FragmentRow label="Vota" value={delegationName(ballot.own_delegation)} />
          {ballot.weight > 0 && (
            <FragmentRow label="Peso" value={`${formatWeight(ballot.weight)}% del puntaje final (entre todos los delegados)`} />
          )}
        </div>
        {error ? (
          <div className={s.errorBox} role="alert">
            <b>!</b>
            <span>{error}</span>
          </div>
        ) : (
          <div className={s.warning}>
            <b>!</b>
            <span>Una vez enviado no se puede cambiar.</span>
          </div>
        )}
        <div className={s.sheetActions}>
          <button type="button" className={s.btnInk} onClick={onSubmit} disabled={submitting} autoFocus>
            {submitting && <span className={s.spinner} aria-hidden="true" />}
            {submitting ? 'Enviando…' : error ? 'Reintentar' : 'Enviar voto'}
          </button>
          <button type="button" className={s.linkBtn} onClick={onCancel} disabled={submitting}>
            Volver y cambiar
          </button>
        </div>
      </div>
    </div>
  );
}

function FragmentRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <>
      <span className={s.summaryLabel}>{label}</span>
      <span className={strong ? s.summaryStrong : s.summaryValue}>{value}</span>
    </>
  );
}

function BallotForm({ ballot, token }: { ballot: Ballot; token: string }) {
  const qc = useQueryClient();
  const wide = useWide();
  const [picks, setPicks] = useState<Picks>({});
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const awards = ballot.awards;
  const current = awards[Math.min(step, awards.length - 1)];
  const isLast = step >= awards.length - 1;
  const selectedId = picks[current.award_type] ?? null;
  const closesAt = ballot.peer_vote.closes_at;
  const now = useNow(!!closesAt && wide);

  // Propia delegación en su posición alfabética (no se oculta ni se mueve).
  const options = useMemo<Option[]>(() => {
    const takenBy = new Map<string, BallotAward>();
    awards.forEach((a) => {
      const id = picks[a.award_type];
      if (id && a.award_type !== current.award_type) takenBy.set(id, a);
    });
    return [ballot.own_delegation, ...ballot.delegations]
      .map((d) => ({
        delegation: d,
        name: delegationName(d),
        own: d.delegation_id === ballot.own_delegation.delegation_id,
        takenBy: takenBy.get(d.delegation_id) ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [ballot, awards, picks, current.award_type]);

  const q = normalize(query);
  const filtered = q ? options.filter((o) => normalize(o.name).includes(q) || normalize(o.delegation.country_code ?? '') === q) : options;
  const selected = options.find((o) => o.delegation.delegation_id === selectedId) ?? null;

  // Escritorio: lista colapsada salvo que se busque, se expanda o la selección quede oculta.
  const selectedIndex = filtered.findIndex((o) => o.delegation.delegation_id === selectedId);
  const collapsible = wide && !q && filtered.length > DESK_VISIBLE;
  const showAll = !collapsible || expanded || selectedIndex >= DESK_VISIBLE;
  const visible = showAll ? filtered : filtered.slice(0, DESK_VISIBLE);

  function choose(id: string) {
    setPicks((prev) => ({ ...prev, [current.award_type]: id }));
  }

  function goTo(index: number) {
    setStep(index);
    setQuery('');
    setExpanded(false);
    window.scrollTo({ top: 0 });
  }

  function next() {
    if (!selectedId) return;
    if (isLast) {
      setSubmitError('');
      setConfirming(true);
    } else goTo(step + 1);
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const updated = await submitPeerVote(
        token,
        awards.map((a) => ({ award_type: a.award_type, delegation_id: picks[a.award_type]! })),
      );
      qc.setQueryData(queryKeys.ballot(token), updated);
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.detail);
        // Votación cerrada, voto ya enviado o acceso inválido: la boleta cambia de pantalla.
        if (['SESSION_CLOSED', 'EVENT_CLOSED', 'CONFLICT'].includes(err.code) || err.status === 401) {
          qc.invalidateQueries({ queryKey: queryKeys.ballot(token) });
        }
      } else {
        setSubmitError('No se pudo enviar; revisa tu conexión e inténtalo de nuevo. Tu voto aún no se ha guardado.');
      }
      setSubmitting(false);
    }
  }

  const weightNote = ballot.weight > 0 && (
    <>
      El voto de los delegados suma <b>{formatWeight(ballot.weight)}%</b> al puntaje final.
    </>
  );
  const ctaLabel = isLast ? 'Revisar voto' : 'Siguiente';
  const minutesLeft = closesAt ? Math.max(0, Math.ceil((new Date(closesAt).getTime() - now) / 60_000)) : null;

  const list = (
    <>
      {filtered.length === 0 ? (
        <EmptySearch query={query} onClear={() => setQuery('')} />
      ) : (
        <div className={wide ? s.grid : s.optionList} role="radiogroup" aria-label={current.label}>
          {visible.map((o) => (
            <OptionRow
              key={o.delegation.delegation_id}
              option={o}
              selected={o.delegation.delegation_id === selectedId}
              onSelect={() => choose(o.delegation.delegation_id)}
            />
          ))}
        </div>
      )}
    </>
  );

  const sheet = confirming && (
    <ConfirmSheet
      ballot={ballot}
      picks={picks}
      submitting={submitting}
      error={submitError}
      onSubmit={submit}
      onCancel={() => setConfirming(false)}
    />
  );

  if (wide) {
    return (
      <Page>
        <header className={s.topbar}>
          <div className={s.crumbs}>
            <span className={s.logo} aria-hidden="true" />
            <span>
              {ballot.event_name} <span className={s.crumbSep}>/</span> <b>Votación</b>
            </span>
          </div>
          <div className={s.topRight}>
            {closesAt && (
              <span className={s.badgeCountdown}>
                Cierra {hhmm(closesAt)}
                {minutesLeft !== null && minutesLeft <= 120 && ` · ${minutesLeft} min`}
              </span>
            )}
            <span className={s.topIdentity}>
              <span className={s.chipOwn}>{delegationChip(ballot.own_delegation)}</span>
              {delegationName(ballot.own_delegation)}
            </span>
          </div>
        </header>
        <div className={s.desk}>
          <main className={s.deskMain}>
            <div>
              <span className={s.eyebrow}>
                Voto {step + 1} de {awards.length} · {current.label} · {ballot.committee_name}
              </span>
              <h1 className={s.deskTitle}>{QUESTIONS[current.award_type]}</h1>
            </div>
            <div className={s.deskToolbar}>
              <input
                type="search"
                className={s.deskSearch}
                placeholder="Buscar delegación…"
                aria-label="Buscar delegación"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <span className={s.count}>{ballot.delegations.length} OPCIONES</span>
            </div>
            {list}
            {collapsible && selectedIndex < DESK_VISIBLE && (
              <button type="button" className={s.expand} onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
                {expanded ? 'Mostrar menos ▴' : `Mostrar las ${ballot.delegations.length} ▾`}
              </button>
            )}
          </main>
          <aside className={s.aside}>
            <span className={s.eyebrow}>Tus votos</span>
            <div className={s.steps}>
              {awards.map((award, i) => {
                const pick = options.find((o) => o.delegation.delegation_id === picks[award.award_type]);
                const reachable = i <= step || awards.slice(0, i).every((a) => !!picks[a.award_type]);
                const className = [s.step, i === step && s.stepActive, pick && i !== step && s.stepDone].filter(Boolean).join(' ');
                return (
                  <button
                    key={award.award_type}
                    type="button"
                    className={className}
                    disabled={!reachable || i === step}
                    aria-current={i === step ? 'step' : undefined}
                    onClick={() => goTo(i)}
                  >
                    <span className={s.stepNum}>{pick && i !== step ? '✓' : i + 1}</span>
                    <span className={s.stepText}>
                      <span className={s.stepTitle}>{award.label}</span>
                      <span className={s.stepSub}>
                        {pick ? `${pick.name} seleccionada` : i === step ? 'Elige una delegación' : 'Pendiente'}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className={s.asideNote}>
              Tu voto es anónimo{weightNote ? ' y ' : ''}
              {weightNote && (
                <>
                  el de los delegados suma <b>{formatWeight(ballot.weight)}%</b> al puntaje final
                </>
              )}
              . Cada premio va a una delegación distinta y no puedes votar por la tuya.
            </p>
            <div className={s.asideActions}>
              <button type="button" className={s.btnGold} disabled={!selectedId} onClick={next}>
                  {ctaLabel}
              </button>
            </div>
          </aside>
        </div>
        {sheet}
      </Page>
    );
  }

  return (
    <Page>
      <header className={s.ballotHeader}>
        <div className={s.headerRow}>
          <Identity ballot={ballot} />
          {closesAt && <span className={s.badgeCountdown}>Cierra {hhmm(closesAt)}</span>}
        </div>
        <div className={s.questionBlock}>
          <div className={s.stepRow}>
            <span className={s.eyebrowGold}>
              Voto {step + 1} de {awards.length} · {current.label}
            </span>
            {step > 0 && (
              <button type="button" className={s.backLink} onClick={() => goTo(step - 1)}>
                ‹ Anterior
              </button>
            )}
          </div>
          <h1 className={s.headline}>{QUESTIONS[current.award_type]}</h1>
          <p className={s.weightNote}>
            {weightNote} Es anónimo y no puedes votar por tu propia delegación.
          </p>
        </div>
      </header>
      <div className={s.searchWrap}>
        <input
          type="search"
          className={s.search}
          placeholder="Buscar delegación…"
          aria-label="Buscar delegación"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className={s.options}>{list}</div>
      <div className={s.footer}>
        <span className={s.selectedLine} aria-live="polite">
          {selected ? (
            <>
              Seleccionado: <b>{selected.name}</b>
            </>
          ) : (
            'Elige una delegación'
          )}
        </span>
        <button type="button" className={s.btnGold} disabled={!selectedId} onClick={next}>
          {ctaLabel}
        </button>
      </div>
      {sheet}
    </Page>
  );
}

// ---- Página ----

export function VotePage() {
  const { token: tokenInUrl } = useParams<{ token?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [token, setToken] = useState(() => tokenInUrl ?? readStoredToken());
  // Un enlace nuevo con la página ya abierta (p. ej. en la pantalla del código) también vale.
  if (tokenInUrl && tokenInUrl !== token) setToken(tokenInUrl);

  // El token se guarda para todo el evento y se quita de la URL (que no quede a la vista).
  useEffect(() => {
    if (tokenInUrl) {
      storeToken(tokenInUrl);
      navigate('/votar', { replace: true });
    }
  }, [tokenInUrl, navigate]);

  const { data: ballot, error, isLoading, refetch } = useQuery({
    queryKey: queryKeys.ballot(token),
    queryFn: () => getBallot(token),
    enabled: !!token,
    // La página espera la apertura (o el cierre) consultando cada 20 s.
    refetchInterval: POLL_MS,
    retry: (count, err) => !(err instanceof ApiError && err.status === 401) && count < 2,
  });

  function enterWith(code: string) {
    storeToken(code);
    setToken(code);
  }

  const onElapsed = useMemo(() => () => void refetch(), [refetch]);

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
  if (isLoading || !ballot) return <Loading failed={!!error} />;

  // Con voto registrado siempre se muestra el comprobante, nunca «ya cerró».
  if (ballot.picks.length > 0) return <Submitted ballot={ballot} />;
  const status = ballot.event_status === 'closed' ? 'closed' : ballot.peer_vote.status;
  if (status === 'closed') return <Closed ballot={ballot} />;
  if (status !== 'open') return <NotOpen ballot={ballot} onElapsed={onElapsed} />;
  if (ballot.awards.length === 0) return <NoCandidates ballot={ballot} />;
  // La key reinicia la boleta en curso si cambian los premios (p. ej. otra delegación).
  return <BallotForm key={ballot.awards.map((a) => a.award_type).join()} ballot={ballot} token={token} />;
}
