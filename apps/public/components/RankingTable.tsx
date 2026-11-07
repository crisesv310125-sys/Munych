'use client';

import { useEffect, useState } from 'react';
import { normalizeSearch } from '../lib/format';
import { getDictionary, type Locale } from '../lib/i18n';
import type { RankingRowView } from '../lib/view';
import { PositionMedal } from './PositionMedal';
import styles from './public.module.css';

const PAGE_SIZE = 10;

/**
 * Ranking del comité (2e). Sin `showScores` se oculta la columna de puntaje.
 * Con `general`, es el ranking general del evento: cada fila indica su comité.
 */
export function RankingTable({
  locale,
  ranking,
  showScores,
  general = false,
}: {
  locale: Locale;
  ranking: RankingRowView[];
  showScores: boolean;
  general?: boolean;
}) {
  const dictionary = getDictionary(locale);
  const t = general ? { ...dictionary.ranking, ...dictionary.generalRanking } : dictionary.ranking;
  const titleId = general ? 'general-ranking-title' : 'ranking-title';
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const q = normalizeSearch(query);

  useEffect(() => {
    const expand = () => setShowAll(true);
    window.addEventListener('beforeprint', expand);
    return () => window.removeEventListener('beforeprint', expand);
  }, []);

  const matches = q ? ranking.filter((r) => r.search.includes(q)) : ranking;
  const shown = q || showAll ? matches : matches.slice(0, PAGE_SIZE);
  const hidden = matches.length - shown.length;
  const missingScores = showScores && shown.some((r) => r.score === null);
  const count = ranking.length;

  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <div className={styles.rankingHead}>
        <h2 id={titleId} className={styles.eyebrow} style={{ margin: 0 }}>
          <span className={styles.desktopOnly}>
            {t.title(count)}
          </span>
          <span className={styles.mobileOnly}>{t.titleShort(count)}</span>
        </h2>
        <input
          type="search"
          className={`${styles.search} ${styles.rankingSearch}`}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchLabel}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className={`${styles.table} ${showScores ? '' : styles.tableNoScores}`} role="table" aria-labelledby={titleId}>
        <div className={`${styles.tableRow} ${styles.tableHeadRow}`} role="row">
          <span role="columnheader">{t.position}</span>
          <span role="columnheader">{t.delegation}</span>
          <span role="columnheader">{t.delegates}</span>
          {showScores && (
            <span role="columnheader" className={styles.right}>
              {t.score}
            </span>
          )}
        </div>
        {shown.map((row) => {
          const top = row.position <= 3;
          return (
            <div
              key={`${row.position}-${row.committee ?? ''}-${row.delegation.name}`}
              role="row"
              className={`${styles.tableRow} ${row.position === 1 ? styles.tableRowFirst : ''}`}
            >
              <span role="cell">
                {top ? (
                  <PositionMedal position={row.position} className={styles.posMedal} />
                ) : (
                  <span className={styles.posNumber}>{row.position}</span>
                )}
                <span className={`${styles.posMono} ${top ? styles.posMonoTop : ''} ${row.position === 1 ? styles.posMonoGold : ''}`}>
                  {String(row.position).padStart(2, '0')}
                </span>
              </span>
              <span role="cell" className={styles.delegationCell}>
                {row.delegation.code && <span className={styles.isoBadge}>{row.delegation.code}</span>}
                <span className={`${styles.delegationName} ${top ? styles.delegationNameTop : ''}`}>{row.delegation.name}</span>
              </span>
              <span role="cell" className={styles.delegatesCell}>
                {row.committee ? `${row.committee} — ` : ''}
                {row.delegates.join(' · ') || (row.committee ? '' : '—')}
              </span>
              {showScores && (
                <span
                  role="cell"
                  className={`${styles.scoreCell} ${top ? styles.scoreCellTop : ''} ${row.score === null ? styles.scoreMissing : ''}`}
                >
                  {row.score ?? '—'}
                </span>
              )}
            </div>
          );
        })}
        {matches.length === 0 && <div className={styles.empty}>{t.noMatch(query.trim())}</div>}
        {(missingScores || hidden > 0) && (
          <div className={styles.tableFoot}>
            {missingScores && <span className={styles.tableFootNote}>{t.missingScore}</span>}
            {hidden > 0 && (
              <button type="button" className={styles.moreButton} onClick={() => setShowAll(true)}>
                <span className={styles.desktopOnly}>{t.showAllCount(matches.length)}</span>
                <span className={styles.mobileOnly}>{t.showAll}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
