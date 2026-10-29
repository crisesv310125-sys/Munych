'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { normalizeSearch } from '../lib/format';
import type { CommitteeView } from '../lib/view';
import { PositionMedal } from './PositionMedal';
import styles from './public.module.css';

const PAGE_SIZE = 6;

const joinDelegates = (delegates: string[]) => delegates.join(' · ');

function CommitteeCard({ committee, href }: { committee: CommitteeView; href: string }) {
  if (committee.pending) {
    return (
      <article className={`${styles.committeeCard} ${styles.committeeCardPending}`}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardName} style={{ margin: 0 }}>
            {committee.name}
          </h2>
          <span className={styles.pillPending}>PENDIENTE</span>
        </div>
        <div className={styles.pendingText}>Los resultados de este comité aún no se publican.</div>
      </article>
    );
  }

  const [top, ...rest] = committee.awards;
  return (
    <article className={styles.committeeCard}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <h2 className={styles.cardName} style={{ margin: 0 }}>
            {committee.name}
          </h2>
          {committee.ranking && <span className={styles.monoMeta}>{committee.ranking.length} DELEG.</span>}
        </div>
        <Link href={href} className={styles.cardLink}>
          {committee.ranking ? 'Ver ranking completo →' : 'Ver premios →'}
        </Link>
      </div>
      <div className={styles.topAward}>
        <PositionMedal position={1} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={styles.topAwardLabel}>{top.label}</div>
          <div className={styles.topAwardName}>{top.delegation.name}</div>
        </div>
        {top.delegates.length > 0 && <div className={styles.topAwardDelegates}>{joinDelegates(top.delegates)}</div>}
      </div>
      {rest.map((award, i) => (
        <div key={`${award.label}-${i}`} className={styles.minorAward}>
          <PositionMedal position={i + 2} size={22} />
          <span className={styles.minorAwardText}>
            <b>{award.delegation.name}</b> · {award.label}
          </span>
          <span className={styles.minorAwardDelegates}>{joinDelegates(award.delegates)}</span>
        </div>
      ))}
      {rest.length === 0 && <div className={styles.singleAwardNote}>Este comité solo otorgó un premio.</div>}
    </article>
  );
}

export function EventCommittees({
  committees,
  eventHref,
  publishedLabel,
}: {
  committees: CommitteeView[];
  eventHref: string;
  publishedLabel: string;
}) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const q = normalizeSearch(query);

  // "Descargar PDF" imprime la página: que salgan todos los comités.
  useEffect(() => {
    const expand = () => setShowAll(true);
    window.addEventListener('beforeprint', expand);
    return () => window.removeEventListener('beforeprint', expand);
  }, []);

  const matches = q ? committees.filter((c) => c.search.includes(q)) : committees;
  const shown = q || showAll ? matches : matches.slice(0, PAGE_SIZE);
  const hidden = matches.length - shown.length;

  return (
    <>
      <div className={styles.toolbar}>
        <input
          type="search"
          className={`${styles.search} ${styles.eventSearch}`}
          placeholder="Buscar comité, país o delegado…"
          aria-label="Buscar comité, país o delegado"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className={styles.monoMeta}>PUBLICADO {publishedLabel}</span>
      </div>
      {committees.length === 0 ? (
        <div className={`${styles.listCard} ${styles.empty}`}>Este evento todavía no tiene comités publicados.</div>
      ) : matches.length === 0 ? (
        <div className={`${styles.listCard} ${styles.empty}`}>Ningún comité coincide con «{query.trim()}».</div>
      ) : (
        <div className={styles.committeeGrid}>
          {shown.map((c) => (
            <CommitteeCard key={c.slug} committee={c} href={`${eventHref}/${c.slug}`} />
          ))}
        </div>
      )}
      {hidden > 0 && (
        <button type="button" className={styles.moreButton} onClick={() => setShowAll(true)}>
          Ver {hidden} {hidden === 1 ? 'comité más' : 'comités más'} ▾
        </button>
      )}
    </>
  );
}
