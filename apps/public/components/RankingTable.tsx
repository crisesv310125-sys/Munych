'use client';

import { useEffect, useState } from 'react';
import { normalizeSearch } from '../lib/format';
import type { RankingRowView } from '../lib/view';
import { PositionMedal } from './PositionMedal';
import styles from './public.module.css';

const PAGE_SIZE = 10;

/** Ranking del comité (2e). Sin `showScores` se oculta la columna de puntaje. */
export function RankingTable({ ranking, showScores }: { ranking: RankingRowView[]; showScores: boolean }) {
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
    <section className={styles.section} aria-labelledby="ranking-title">
      <div className={styles.rankingHead}>
        <h2 id="ranking-title" className={styles.eyebrow} style={{ margin: 0 }}>
          <span className={styles.desktopOnly}>
            Ranking · {count} {count === 1 ? 'delegación' : 'delegaciones'}
          </span>
          <span className={styles.mobileOnly}>Clasificación · {count} deleg.</span>
        </h2>
        <input
          type="search"
          className={`${styles.search} ${styles.rankingSearch}`}
          placeholder="Buscar país o delegado…"
          aria-label="Buscar país o delegado"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className={`${styles.table} ${showScores ? '' : styles.tableNoScores}`} role="table" aria-labelledby="ranking-title">
        <div className={`${styles.tableRow} ${styles.tableHeadRow}`} role="row">
          <span role="columnheader">POS.</span>
          <span role="columnheader">DELEGACIÓN</span>
          <span role="columnheader">DELEGADO(S)</span>
          {showScores && (
            <span role="columnheader" className={styles.right}>
              PUNTAJE
            </span>
          )}
        </div>
        {shown.map((row) => {
          const top = row.position <= 3;
          return (
            <div
              key={`${row.position}-${row.delegation.name}`}
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
                {row.delegates.join(' · ') || '—'}
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
        {matches.length === 0 && <div className={styles.empty}>Ninguna delegación coincide con «{query.trim()}».</div>}
        {(missingScores || hidden > 0) && (
          <div className={styles.tableFoot}>
            {missingScores && <span className={styles.tableFootNote}>— Puntaje no disponible (sin calificaciones completas)</span>}
            {hidden > 0 && (
              <button type="button" className={styles.moreButton} onClick={() => setShowAll(true)}>
                <span className={styles.desktopOnly}>Ver las {matches.length} ▾</span>
                <span className={styles.mobileOnly}>Ver todas ▾</span>
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
