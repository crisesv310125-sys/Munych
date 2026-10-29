import type { AwardView } from '../lib/view';
import { PositionMedal } from './PositionMedal';
import styles from './public.module.css';

/** Tarjetas de premios: la primera destacada (navy en escritorio, borde dorado en móvil). */
export function CommitteeAwards({ awards }: { awards: AwardView[] }) {
  if (awards.length === 0) {
    return (
      <div className={`${styles.committeeCard} ${styles.committeeCardPending}`}>
        <div className={styles.cardHead}>
          <span className={styles.pendingText}>Los resultados de este comité aún no se publican.</span>
          <span className={styles.pillPending}>PENDIENTE</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.awardsGrid}>
      {awards.map((award, i) => {
        const delegates = award.delegates.join(' · ');
        const detail = [delegates, award.delegation.institution].filter(Boolean).join(' · ');
        return (
          <div key={`${award.label}-${i}`} className={`${styles.awardCard} ${i === 0 ? styles.awardCardFeatured : ''}`}>
            <PositionMedal position={i + 1} className={styles.awardMedal} />
            <div style={{ minWidth: 0 }}>
              <div className={styles.awardLabel}>{award.label}</div>
              <div className={styles.awardName}>
                {award.delegation.name}
                {delegates && <span className={styles.awardInlineDelegates}> · {delegates}</span>}
              </div>
              {detail && <div className={styles.awardDelegates}>{detail}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
