import { useQueries } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Avatar } from '@munych/ui/components/Avatar';
import { Button } from '@munych/ui/components/Button';
import { ProgressBar } from '@munych/ui/components/ProgressBar';
import { StatusBadge } from '@munych/ui/components/StatusBadge';
import { useAppState } from '../../state/AppStateContext';
import { useState } from 'react';
import { useCloseEvent, useCommittees, useCommitteeProgress, useDelegations, useEvent, useSessions, useUpdateEvent } from '../../data-access/hooks';
import { errorMessage } from '../../data-access/errors';
import { getCommitteeJudges, getCommitteeProgress, listDelegations, listSessions } from '../../data-access/endpoints';
import { queryKeys } from '../../data-access/queryClient';
import { committeeAssignedJudgeCount, committeeProgressPercent } from '../../lib/adminProgress';
import { committeeStatusFromSessions, committeeStatusLabel, committeeStatusTone } from '../../lib/statusLabels';
import type { ApiCommittee } from '../../data-access/apiTypes';
import styles from './AdminShared.module.css';
import tableStyles from '@munych/ui/components/Table.module.css';

const PROGRESS_POLL_MS = 15_000;

function CommitteeProgressRow({ committee }: { committee: ApiCommittee }) {
  const { data: progress } = useCommitteeProgress(committee.id, { pollMs: PROGRESS_POLL_MS });
  const { data: delegations } = useDelegations(committee.id);
  const { data: sessions } = useSessions(committee.id);
  const pct = committeeProgressPercent(progress);
  const status = committeeStatusFromSessions(sessions ?? []);
  return (
    <div className={tableStyles.row} style={{ gridTemplateColumns: '1.6fr 1fr 1fr 2fr 90px' }}>
      <span className={tableStyles.nameCell}>{committee.name}</span>
      <span className={tableStyles.mutedCell}>{committeeAssignedJudgeCount(progress)}</span>
      <span className={tableStyles.mutedCell}>{delegations?.length ?? '—'}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ProgressBar percent={pct} color={pct === 100 ? 'var(--state-done-dot)' : 'var(--gold)'} />
        <span style={{ fontSize: 12, fontWeight: 600 }}>{pct}%</span>
      </div>
      <span className={tableStyles.right}>
        <StatusBadge tone={committeeStatusTone(status)} label={committeeStatusLabel(status).toUpperCase()} />
      </span>
    </div>
  );
}

/** Agrega delegaciones, jueces y avance de todos los comités del evento para los KPI. */
function useEventKpis(committees: ApiCommittee[]) {
  const delegationQueries = useQueries({
    queries: committees.map((c) => ({ queryKey: queryKeys.delegations(c.id), queryFn: () => listDelegations(c.id) })),
  });
  const judgeQueries = useQueries({
    queries: committees.map((c) => ({ queryKey: queryKeys.committeeJudges(c.id), queryFn: () => getCommitteeJudges(c.id) })),
  });
  const progressQueries = useQueries({
    queries: committees.map((c) => ({
      queryKey: queryKeys.committeeProgress(c.id),
      queryFn: () => getCommitteeProgress(c.id),
      refetchInterval: PROGRESS_POLL_MS,
    })),
  });
  const sessionQueries = useQueries({
    queries: committees.map((c) => ({ queryKey: queryKeys.sessions(c.id), queryFn: () => listSessions(c.id) })),
  });

  const totalCountries = delegationQueries.reduce((s, q) => s + (q.data?.length ?? 0), 0);
  const activeJudgeIds = new Set(judgeQueries.flatMap((q) => q.data?.filter((a) => a.active).map((a) => a.judge_id) ?? []));
  const committeesWithSessions = progressQueries.filter((q) => (q.data?.sessions.length ?? 0) > 0).length;
  const statuses = sessionQueries.map((q) => committeeStatusFromSessions(q.data ?? []));
  const enSesion = statuses.filter((s) => s === 'en-curso').length;
  const cerrados = statuses.filter((s) => s === 'cerrado').length;
  const globalProgress = committeesWithSessions === 0
    ? 0
    : Math.round(progressQueries.reduce((s, q) => s + committeeProgressPercent(q.data), 0) / committees.length);

  return { totalCountries, activeJudges: activeJudgeIds.size, enSesion, cerrados, globalProgress };
}

export function AdminDashboardPage() {
  const { session } = useAppState();
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { data: event } = useEvent(eventId);
  const { data: committees } = useCommittees(eventId);
  const kpis = useEventKpis(committees ?? []);
  const closeEvent = useCloseEvent(eventId ?? '');
  const updateEvent = useUpdateEvent(eventId ?? '');
  const [closeError, setCloseError] = useState('');

  const totalCommittees = committees?.length ?? 0;
  const adminInitials = session?.name ? session.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() : 'AD';

  async function handleCloseEvent() {
    if (!eventId) return;
    if (!window.confirm('¿Cerrar este evento? Se tomará una instantánea final y ya no se podrán modificar calificaciones. Esta acción no se puede deshacer.')) return;
    setCloseError('');
    try {
      await closeEvent.mutateAsync();
    } catch (err) {
      setCloseError(errorMessage(err));
    }
  }

  async function handleActivateEvent() {
    setCloseError('');
    try {
      await updateEvent.mutateAsync({ status: 'active' });
    } catch (err) {
      setCloseError(errorMessage(err));
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className={styles.topbarTitle}>Panel general</span>
          <span className={styles.topbarSub}>{event?.name ?? 'Evento'}</span>
        </div>
        <div className={styles.topbarActions}>
          {event?.status === 'draft' && (
            <Button onClick={handleActivateEvent} disabled={updateEvent.isPending}>
              {updateEvent.isPending ? 'Activando…' : 'Activar evento'}
            </Button>
          )}
          {event && event.status !== 'closed' && (
            <Button variant="danger" onClick={handleCloseEvent} disabled={closeEvent.isPending}>
              {closeEvent.isPending ? 'Cerrando…' : 'Cerrar evento'}
            </Button>
          )}
          <Button variant="secondary" onClick={() => navigate(`/admin/eventos/${eventId}/exportar`)}>
            Exportar todo
          </Button>
          <Avatar initials={adminInitials} size={34} color="var(--chip-neutral-bg)" />
        </div>
      </div>
      {closeError && (
        <div style={{ padding: '10px 28px', color: '#C0392B', fontSize: 13, background: '#FDECEC' }}>{closeError}</div>
      )}
      <div className={styles.content}>
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>COMITÉS</span>
            <span className={styles.kpiValue}>{totalCommittees}</span>
            <span className={styles.kpiSub}>
              {kpis.enSesion} en sesión · {kpis.cerrados} cerrados
            </span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>DELEGACIONES</span>
            <span className={styles.kpiValue}>{kpis.totalCountries}</span>
            <span className={styles.kpiSub}>en {totalCommittees} comités</span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>JUECES ACTIVOS</span>
            <span className={styles.kpiValue}>{kpis.activeJudges}</span>
            <span className={styles.kpiSub}>asignados en este evento</span>
          </div>
          <div className={`${styles.kpiCard} ${styles.kpiInverted}`}>
            <span className={styles.kpiLabel}>PROGRESO GLOBAL</span>
            <span className={styles.kpiValue}>{kpis.globalProgress}%</span>
            <ProgressBar percent={kpis.globalProgress} height={5} trackColor="rgba(255,255,255,.16)" />
          </div>
        </div>

        <div className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Progreso por comité</span>
            <button
              onClick={() => navigate(`/admin/eventos/${eventId}/comites`)}
              style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--un-blue)', fontWeight: 600, cursor: 'pointer' }}
            >
              Ver detalle
            </button>
          </div>
          <div className={tableStyles.head} style={{ gridTemplateColumns: '1.6fr 1fr 1fr 2fr 90px' }}>
            <span>Comité</span>
            <span>Jueces</span>
            <span>Países</span>
            <span>Avance</span>
            <span style={{ textAlign: 'right' }}>Estado</span>
          </div>
          {(committees ?? []).map((c) => (
            <CommitteeProgressRow key={c.id} committee={c} />
          ))}
        </div>
      </div>
    </div>
  );
}
