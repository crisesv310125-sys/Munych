import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { Button } from '@munych/ui/components/Button';
import { Select } from '@munych/ui/components/FormControls';
import { ProgressBar } from '@munych/ui/components/ProgressBar';
import { StatusBadge } from '@munych/ui/components/StatusBadge';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useCommittees, useEvent } from '../../data-access/hooks';
import { closeSession, getCommitteeProgress, listSessions, openSession } from '../../data-access/endpoints';
import { errorMessage } from '../../data-access/errors';
import { queryKeys } from '../../data-access/queryClient';
import {
  committeeStatusFromSessions,
  committeeStatusLabel,
  committeeStatusTone,
  sessionStatusLabel,
  sessionStatusTone,
} from '../../lib/statusLabels';
import type { ApiCommittee, ApiSession, CommitteeProgress } from '../../data-access/apiTypes';
import styles from './AdminShared.module.css';
import tableStyles from '@munych/ui/components/Table.module.css';

const PROGRESS_POLL_MS = 15_000;
const COLS = '1fr 1fr 2fr 1.4fr 96px';

type Action = 'open' | 'close';

interface SessionTarget {
  committeeId: string;
  number: number;
}

interface PendingClose {
  title: string;
  message: string;
  targets: SessionTarget[];
}

/** Calificaciones hechas / esperadas en una sesión, sumando a todos los jueces del comité. */
function sessionProgress(progress: CommitteeProgress | undefined, number: number) {
  const session = progress?.sessions.find((s) => s.number === number);
  let scored = 0;
  let expected = 0;
  session?.judges.forEach((j) => {
    scored += j.scored;
    expected += j.expected;
  });
  return { scored, expected, percent: expected === 0 ? 0 : Math.round((scored / expected) * 100) };
}

function formatMoment(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Cuándo se abrió o cerró por última vez (lo más reciente que aplique a su estado). */
function sessionMoment(session: ApiSession): string {
  if (session.status === 'open') return `Abierta · ${formatMoment(session.opened_at)}`;
  if (session.closed_at) return `Cerrada · ${formatMoment(session.closed_at)}`;
  return 'Sin abrir';
}

function CommitteeSessionsCard({
  committee,
  sessions,
  progress,
  eventClosed,
  busy,
  onToggle,
}: {
  committee: ApiCommittee;
  sessions: ApiSession[];
  progress: CommitteeProgress | undefined;
  eventClosed: boolean;
  busy: boolean;
  onToggle: (committee: ApiCommittee, session: ApiSession) => void;
}) {
  const sorted = [...sessions].sort((a, b) => a.number - b.number);
  const status = committeeStatusFromSessions(sessions);
  return (
    <div className={styles.panelCard}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>{committee.name}</span>
        <StatusBadge tone={committeeStatusTone(status)} label={committeeStatusLabel(status).toUpperCase()} />
      </div>
      <div className={tableStyles.head} style={{ gridTemplateColumns: COLS }}>
        <span>Sesión</span>
        <span>Estado</span>
        <span>Avance</span>
        <span>Último cambio</span>
        <span style={{ textAlign: 'right' }}>Acción</span>
      </div>
      {sorted.length === 0 && (
        <div className={tableStyles.row} style={{ gridTemplateColumns: '1fr' }}>
          <span className={tableStyles.mutedCell}>Este comité no tiene sesiones.</span>
        </div>
      )}
      {sorted.map((s) => {
        const p = sessionProgress(progress, s.number);
        return (
          <div key={s.number} className={tableStyles.row} style={{ gridTemplateColumns: COLS }}>
            <span className={tableStyles.nameCell}>Sesión {s.number}</span>
            <span style={{ justifySelf: 'start' }}>
              <StatusBadge tone={sessionStatusTone(s)} label={sessionStatusLabel(s).toUpperCase()} />
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <ProgressBar percent={p.percent} color={p.percent === 100 ? 'var(--state-done-dot)' : 'var(--gold)'} />
              <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {p.expected === 0 ? '—' : `${p.scored}/${p.expected}`}
              </span>
            </div>
            <span className={tableStyles.mutedCell}>{sessionMoment(s)}</span>
            <span className={tableStyles.right}>
              {!eventClosed && (
                <Button variant={s.status === 'open' ? 'secondary' : 'primary'} onClick={() => onToggle(committee, s)} disabled={busy}>
                  {s.status === 'open' ? 'Cerrar' : 'Abrir'}
                </Button>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function SessionsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const qc = useQueryClient();
  const { data: event } = useEvent(eventId);
  const { data: committees } = useCommittees(eventId);
  const list = committees ?? [];

  const sessionQueries = useQueries({
    queries: list.map((c) => ({ queryKey: queryKeys.sessions(c.id), queryFn: () => listSessions(c.id) })),
  });
  const progressQueries = useQueries({
    queries: list.map((c) => ({
      queryKey: queryKeys.committeeProgress(c.id),
      queryFn: () => getCommitteeProgress(c.id),
      refetchInterval: PROGRESS_POLL_MS,
    })),
  });

  /** Comité a mostrar; vacío = todos. */
  const [committeeFilter, setCommitteeFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingClose, setPendingClose] = useState<PendingClose | null>(null);

  const eventClosed = event?.status === 'closed';
  const sessionsOf = (i: number) => sessionQueries[i]?.data ?? [];
  // Si el comité elegido ya no existe (p. ej. se borró), se vuelve a mostrar todos.
  const filterId = list.some((c) => c.id === committeeFilter) ? committeeFilter : '';
  const visible = list.map((c, i) => ({ c, i })).filter(({ c }) => !filterId || c.id === filterId);
  const openCount = visible.flatMap(({ i }) => sessionsOf(i)).filter((s) => s.status === 'open').length;

  /** Aplica la acción a varias sesiones; las que fallen se informan juntas sin frenar al resto. */
  async function run(action: Action, targets: SessionTarget[]) {
    if (targets.length === 0) return;
    setError('');
    setBusy(true);
    const results = await Promise.allSettled(
      targets.map((t) => (action === 'open' ? openSession(t.committeeId, t.number) : closeSession(t.committeeId, t.number))),
    );
    new Set(targets.map((t) => t.committeeId)).forEach((committeeId) => {
      qc.invalidateQueries({ queryKey: queryKeys.sessions(committeeId) });
      qc.invalidateQueries({ queryKey: queryKeys.committeeProgress(committeeId) });
    });
    // Abrir una sesión también abre el voto entre pares del comité.
    if (action === 'open') qc.invalidateQueries({ queryKey: ['peer-vote'] });
    const failed = results.flatMap((r, i) => (r.status === 'rejected' ? [{ target: targets[i], reason: r.reason }] : []));
    if (failed.length > 0) {
      const names = failed.map(({ target }) => `${list.find((c) => c.id === target.committeeId)?.acronym ?? 'Comité'} · sesión ${target.number}`);
      setError(`No se pudo ${action === 'open' ? 'abrir' : 'cerrar'}: ${names.join(', ')}. ${errorMessage(failed[0].reason)}`);
    }
    setBusy(false);
  }

  function handleToggle(committee: ApiCommittee, session: ApiSession) {
    const target = { committeeId: committee.id, number: session.number };
    if (session.status === 'open') {
      setPendingClose({
        title: `Cerrar sesión ${session.number}`,
        message: `${committee.name}: los jueces ya no podrán calificar esta sesión. Puedes volver a abrirla después.`,
        targets: [target],
      });
    } else {
      void run('open', [target]);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span className={styles.topbarTitle}>Sesiones</span>
          <span className={styles.topbarSub}>
            {filterId ? visible[0]?.c.name : `${list.length} comités`} ·{' '}
            {openCount === 1 ? '1 sesión abierta' : `${openCount} sesiones abiertas`}
          </span>
        </div>
        {list.length > 1 && (
          <div className={styles.topbarActions}>
            <Select aria-label="Comité" value={filterId} onChange={(e) => setCommitteeFilter(e.target.value)}>
              <option value="">Todos los comités</option>
              {list.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className={styles.content}>
        {eventClosed && (
          <span className={styles.topbarSub}>El evento está cerrado: las sesiones ya no se pueden abrir ni cerrar.</span>
        )}
        {error && (
          <div role="alert" style={{ color: '#C0392B', fontSize: 13 }}>
            {error}
          </div>
        )}
        {list.length === 0 && <span className={styles.topbarSub}>Este evento todavía no tiene comités.</span>}
        {visible.map(({ c, i }) => (
          <CommitteeSessionsCard
            key={c.id}
            committee={c}
            sessions={sessionsOf(i)}
            progress={progressQueries[i]?.data}
            eventClosed={eventClosed}
            busy={busy}
            onToggle={handleToggle}
          />
        ))}
      </div>

      {pendingClose && (
        <ConfirmDialog
          title={pendingClose.title}
          message={pendingClose.message}
          onClose={() => setPendingClose(null)}
          actions={[
            { label: 'Cancelar', onClick: () => setPendingClose(null), variant: 'secondary' },
            {
              label: 'Cerrar sesión',
              variant: 'danger',
              onClick: () => {
                const { targets } = pendingClose;
                setPendingClose(null);
                void run('close', targets);
              },
            },
          ]}
        />
      )}
    </div>
  );
}
