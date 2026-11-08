import { getDictionary, type Locale } from '../lib/i18n';
import type { SpecialAwardView } from '../lib/view';
import { PositionMedal } from './PositionMedal';
import styles from './public.module.css';

/**
 * Decisión de diseño (hito 15): «Premios especiales» del staff (Prensa, Mesa Directiva…),
 * aparte de los premios de comité. Reutiliza las tarjetas de premios (`CommitteeAwards`):
 * mismas clases, sin estilos nuevos.
 */
export function SpecialAwards({
  locale,
  awards,
  showScores,
}: {
  locale: Locale;
  awards: SpecialAwardView[];
  showScores: boolean;
}) {
  if (awards.length === 0) return null;
  const t = getDictionary(locale).specialAwards;
  return (
    <section className={styles.section} aria-labelledby="special-awards-title">
      <h2 id="special-awards-title" className={styles.eyebrow}>
        {t.title(awards.length)}
      </h2>
      <div className={styles.awardsGrid}>
        {awards.map((award, i) => {
          const delegates = award.delegates.join(' · ');
          const detail = [
            award.committee,
            delegates,
            award.delegation.institution,
            showScores && award.score ? award.score : null,
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <div key={`${award.label}-${i}`} className={styles.awardCard}>
              <PositionMedal position={award.position} className={styles.awardMedal} />
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
      <p className={styles.awardDelegates} style={{ marginTop: 8 }}>
        {t.note}
      </p>
    </section>
  );
}
