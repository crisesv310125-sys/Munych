import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@munych/ui/components/Avatar';
import { Button } from '@munych/ui/components/Button';
import { Card } from '@munych/ui/components/Card';
import { ProgressBar } from '@munych/ui/components/ProgressBar';
import { StatusBadge } from '@munych/ui/components/StatusBadge';
import { useAppState } from '../../state/AppStateContext';
import { useIsDesktop } from '../../lib/useMediaQuery';
import { initialsFor } from '../../lib/initials';
import { currentSessionFor } from '../../lib/statusLabels';
import { useJudgeCommittee, useJudgeCommittees, useSessionScores } from '../../data-access/hooks';
import type { JudgeCommitteeSummary } from '../../data-access/apiTypes';
import styles from './DashboardPage.module.css';

type CommitteeState = 'sin-iniciar' | 'en-progreso' | 'completo';

const STATE_META = {
  'sin-iniciar': { badgeTone: 'none' as const, badgeLabel: 'Sin iniciar', cta: 'Empezar', variant: 'secondary' as const },
  'en-progreso': { badgeTone: 'progress' as const, badgeLabel: 'En progreso', cta: 'Continuar calificando', variant: 'primary' as const },
  completo: { badgeTone: 'done' as const, badgeLabel: 'Completo', cta: 'Ver resumen', variant: 'secondary' as const },
};

function firstName(fullName: string) {
  return fullName.split(' ')[0];
}

function useCommitteeCardData(committee: JudgeCommitteeSummary) {
  const { data: detail } = useJudgeCommittee(committee.committee_id);
  const session = currentSessionFor(detail?.sessions);
  const { data: scores } = useSessionScores(session?.session_id);
  const totalDelegates = detail?.delegations.reduce((s, d) => s + d.delegates.length, 0) ?? 0;
  const totalCriteria = detail?.rubric?.criteria.length ?? 0;
  const total = totalDelegates * totalCriteria;
  const scored = scores?.length ?? 0;
  const percent = total === 0 ? 0 : Math.round((scored / total) * 100);
  const state: CommitteeState = total === 0 || scored === 0 ? 'sin-iniciar' : scored >= total ? 'completo' : 'en-progreso';
  return { total: totalDelegates, scored: Math.min(scored, total), percent, state };
}

function CommitteeCard({
  committee,
  isDesktop,
  onGo,
  onProgress,
}: {
  committee: JudgeCommitteeSummary;
  isDesktop: boolean;
  onGo: (state: CommitteeState) => void;
  onProgress: (id: string, scored: number, total: number) => void;
}) {
  const p = useCommitteeCardData(committee);
  const meta = STATE_META[p.state];

  useEffect(() => {
    onProgress(committee.committee_id, p.scored, p.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee.committee_id, p.scored, p.total]);

  return (
    <Card interactive style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <div className={styles.cardTop}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className={styles.cardTitle} style={{ fontSize: isDesktop ? 21 : 19 }}>
            {committee.name}
          </span>
          <span className={styles.cardSub}>
            {committee.acronym} · {committee.event.name} · {p.total} delegados
          </span>
        </div>
        <StatusBadge tone={meta.badgeTone} label={meta.badgeLabel.toUpperCase()} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div className={styles.progressRow}>
          <span>
            {p.scored} de {p.total} calificados
          </span>
          <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{p.percent}%</span>
        </div>
        <ProgressBar percent={p.percent} color={p.state === 'completo' ? 'var(--state-done-dot)' : 'var(--gold)'} />
      </div>
      <Button variant={meta.variant} onClick={() => onGo(p.state)}>
        {meta.cta}
      </Button>
    </Card>
  );
}

export function DashboardPage() {
  const { session } = useAppState();
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const { data: committees } = useJudgeCommittees();
  const [progressMap, setProgressMap] = useState<Record<string, { scored: number; total: number }>>({});

  if (!session) return null;
  const list = committees ?? [];

  function goTo(state: CommitteeState, committeeId: string) {
    if (state === 'completo') navigate(`/juez/progreso?comite=${committeeId}`);
    else navigate(`/juez/comites/${committeeId}`);
  }

  function handleProgress(id: string, scored: number, total: number) {
    setProgressMap((prev) => (prev[id]?.scored === scored && prev[id]?.total === total ? prev : { ...prev, [id]: { scored, total } }));
  }

  const totals = Object.values(progressMap).reduce((acc, p) => ({ scored: acc.scored + p.scored, total: acc.total + p.total }), { scored: 0, total: 0 });
  const overallPercent = totals.total === 0 ? 0 : Math.round((totals.scored / totals.total) * 100);

  const cards = list.map((c) => (
    <CommitteeCard key={c.committee_id} committee={c} isDesktop={isDesktop} onGo={(state) => goTo(state, c.committee_id)} onProgress={handleProgress} />
  ));

  if (!isDesktop) {
    return (
      <>
        <div className={styles.mobileHeader}>
          <div className={styles.mobileGreetRow}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span className={styles.greetLabel}>Buenos días,</span>
              <span className={styles.greetName}>{session.name}</span>
            </div>
            <Avatar initials={initialsFor(session.name)} size={38} onNavy />
          </div>
        </div>
        <div className={styles.body}>
          <div className={styles.sectionRow}>
            <span className={styles.sectionTitle}>Mis comités</span>
            <span className={styles.sectionCount}>{list.length} asignados</span>
          </div>
          <div className={styles.grid}>{cards}</div>
        </div>
      </>
    );
  }

  return (
    <div className={styles.desktopWrap}>
      <div className={styles.desktopHeaderRow}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className={styles.desktopTitle}>Buenos días, {firstName(session.name)}</span>
          <span className={styles.desktopSub}>
            Tienes {list.length} comités asignados · {totals.scored} de {totals.total} delegaciones calificadas
          </span>
        </div>
        <div className={styles.totalCard}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>AVANCE TOTAL</span>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', lineHeight: 1 }}>
              {overallPercent}%
            </span>
          </div>
          <div style={{ width: 140 }}>
            <ProgressBar percent={overallPercent} color="var(--gold)" />
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>{cards}</div>
    </div>
  );
}
