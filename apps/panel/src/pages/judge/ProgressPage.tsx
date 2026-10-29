import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Medal } from '@munych/ui/components/Medal';
import { ProgressBar } from '@munych/ui/components/ProgressBar';
import { EmptyState } from '@munych/ui/components/EmptyState';
import { Button } from '@munych/ui/components/Button';
import { useIsDesktop } from '../../lib/useMediaQuery';
import { delegateScoreMeta } from '../../lib/judgeScoreMeta';
import { currentSessionFor } from '../../lib/statusLabels';
import { useJudgeCommittee, useJudgeCommittees, useSessionScores } from '../../data-access/hooks';
import type { JudgeDelegate } from '../../data-access/apiTypes';
import styles from './ProgressPage.module.css';

export function ProgressPage() {
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { data: myCommittees } = useJudgeCommittees();
  const requested = searchParams.get('comite');
  const committeeId = requested ?? myCommittees?.[0]?.committee_id;
  const { data: committee } = useJudgeCommittee(committeeId);
  const session = committee ? currentSessionFor(committee.sessions) : undefined;
  const { data: scores } = useSessionScores(session?.session_id);

  const rows = useMemo(
    () => (committee?.delegations ?? []).flatMap((d) => d.delegates.map((delegate) => ({ delegate, delegation: d }))),
    [committee],
  );

  const enriched = useMemo(() => {
    const rubric = committee?.rubric;
    if (!rubric) return [];
    return rows.map((r) => ({ ...r, meta: delegateScoreMeta(r.delegate.delegate_id, scores ?? [], rubric) }));
  }, [rows, scores, committee]);

  if (!myCommittees || myCommittees.length === 0) {
    return (
      <div style={{ padding: 28 }}>
        <EmptyState message="Todavía no tienes comités asignados." />
      </div>
    );
  }
  if (!committee) return null;

  const scored = enriched.filter((e) => e.meta.hasScore);
  const pending = enriched.filter((e) => !e.meta.hasScore).map((e) => e.delegate);
  const average = scored.length === 0 ? 0 : scored.reduce((s, e) => s + e.meta.scorePercent, 0) / scored.length;
  const ranking = [...scored].sort((a, b) => b.meta.scorePercent - a.meta.scorePercent);

  function goToDelegate(delegate: JudgeDelegate) {
    navigate(`/juez/comites/${committee!.committee_id}?delegado=${delegate.delegate_id}`);
  }

  const rankingList = ranking.map((r, i) => (
    <div key={r.delegate.delegate_id} className={styles.rankRow}>
      <Medal position={i + 1} size={isDesktop ? 30 : 26} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
        <span className={styles.rankName}>{r.delegate.full_name}</span>
        {!isDesktop && <ProgressBar percent={r.meta.scorePercent} height={4} color="var(--un-blue)" />}
      </div>
      {isDesktop && (
        <div style={{ flex: 2 }}>
          <ProgressBar percent={r.meta.scorePercent} color="var(--un-blue)" />
        </div>
      )}
      <span className={styles.rankScore} style={isDesktop ? { fontSize: 20 } : undefined}>
        {r.meta.scorePercent.toFixed(1)}
      </span>
    </div>
  ));

  if (!isDesktop) {
    return (
      <>
        <div className={styles.mobileHeader}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span className={styles.title}>Mi progreso</span>
            <span className={styles.subLine}>
              {committee.name} · {committee.event.name} · ranking parcial
            </span>
          </div>
          <div className={styles.tiles}>
            <div className={styles.tile}>
              <span className={styles.tileValue} style={{ color: '#FFFFFF' }}>
                {scored.length}
              </span>
              <span className={styles.tileLabel}>CALIFICADOS</span>
            </div>
            <div className={styles.tile}>
              <span className={styles.tileValue} style={{ color: 'var(--gold)' }}>
                {pending.length}
              </span>
              <span className={styles.tileLabel}>PENDIENTES</span>
            </div>
            <div className={styles.tile}>
              <span className={styles.tileValue} style={{ color: '#FFFFFF' }}>
                {average.toFixed(1)}
              </span>
              <span className={styles.tileLabel}>PROMEDIO</span>
            </div>
          </div>
        </div>
        <div className={styles.body}>
          <span className={styles.sectionLabel}>RANKING PARCIAL</span>
          {rankingList}
          {pending.length > 0 && (
            <EmptyState
              message={`Te faltan ${pending.length} delegado${pending.length === 1 ? '' : 's'} por calificar`}
              action={{ label: 'Continuar', onClick: () => goToDelegate(pending[0]) }}
            />
          )}
        </div>
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className={styles.desktopHeader}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span className={styles.desktopTitle}>Mi progreso · {committee.name}</span>
          <span className={styles.desktopSub}>{committee.event.name} · Ranking parcial según tus calificaciones. No es el resultado oficial del comité.</span>
        </div>
        <div className={styles.desktopTiles}>
          <div className={styles.desktopTile}>
            <span className={styles.desktopTileLabel}>CALIFICADOS</span>
            <span className={styles.desktopTileValue}>{scored.length}</span>
          </div>
          <div className={styles.desktopTile}>
            <span className={styles.desktopTileLabel}>PENDIENTES</span>
            <span className={styles.desktopTileValue}>{pending.length}</span>
          </div>
          <div className={styles.desktopTile}>
            <span className={styles.desktopTileLabel}>PROMEDIO</span>
            <span className={styles.desktopTileValue}>{average.toFixed(1)}</span>
          </div>
        </div>
      </div>
      <div className={styles.desktopLayout}>
        <div className={styles.desktopMain}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '70px 2fr 3fr 100px',
              gap: 16,
              padding: '11px 28px',
              borderBottom: '1px solid var(--border-soft)',
              fontSize: 11,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              fontWeight: 600,
            }}
          >
            <span>Pos.</span>
            <span>Delegado</span>
            <span>Puntaje</span>
            <span style={{ textAlign: 'right' }}>Total</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {ranking.map((r, i) => (
              <div
                key={r.delegate.delegate_id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '70px 2fr 3fr 100px',
                  gap: 16,
                  padding: '14px 28px',
                  borderBottom: '1px solid var(--border-soft)',
                  alignItems: 'center',
                }}
              >
                <Medal position={i + 1} size={30} />
                <span className={styles.rankName} style={{ fontSize: 18 }}>
                  {r.delegate.full_name}
                </span>
                <ProgressBar percent={r.meta.scorePercent} color="var(--un-blue)" />
                <span className={styles.rankScore} style={{ fontSize: 20, justifySelf: 'end' }}>
                  {r.meta.scorePercent.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.desktopSidePanel}>
          <span className={styles.sectionLabel}>PENDIENTES</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pending.map((d) => (
              <div key={d.delegate_id} className={styles.pendingRow}>
                <span className={styles.rankName} style={{ fontSize: 15 }}>
                  {d.full_name}
                </span>
                <button
                  onClick={() => goToDelegate(d)}
                  style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 600, color: 'var(--un-blue)', cursor: 'pointer' }}
                >
                  Calificar ›
                </button>
              </div>
            ))}
            {pending.length === 0 && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Ya calificaste a todas las delegaciones.</span>}
          </div>
          {pending.length > 0 && (
            <Button style={{ marginTop: 'auto' }} onClick={() => goToDelegate(pending[0])}>
              Continuar con {pending[0].full_name}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
