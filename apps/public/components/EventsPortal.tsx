'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { normalizeSearch } from '../lib/format';
import { getDictionary, type Dictionary, type Locale } from '../lib/i18n';
import type { EventView } from '../lib/view';
import styles from './public.module.css';

export interface PortalEvent extends EventView {
  /** Mejor delegación (primer premio) de cada comité con premios. */
  highlights: { committee: string; delegation: string }[];
  committeeCount: number;
}

const PAGE_SIZE = 8;
const HIGHLIGHTS = 3;

type Order = 'desc' | 'asc';

function Featured({ event, href, t }: { event: PortalEvent; href: string; t: Dictionary['portal'] }) {
  const shown = event.highlights.slice(0, HIGHLIGHTS);
  const rest = event.committeeCount - shown.length;
  return (
    <>
      <div className={styles.featuredEyebrow}>{t.latest}</div>
      <div className={styles.featured}>
        <div className={styles.featuredMain}>
          <div className={styles.featuredStatus}>
            <span className={styles.pillPublished}>{t.published}</span>
            <span className={styles.monoMeta}>{event.publishedShort}</span>
          </div>
          <h2 className={styles.featuredName} style={{ margin: 0 }}>
            {event.name}
          </h2>
          <div className={styles.featuredMeta}>
            {event.venue && <span>{event.venue}</span>}
            <span>{event.dateRange}</span>
          </div>
          <Link href={href} className={styles.goldButton}>
            {t.viewResults}
          </Link>
        </div>
        <div className={styles.featuredSide}>
          <div className={styles.sideEyebrow}>{t.bestByCommittee}</div>
          {shown.length === 0 && <div className={styles.pendingText}>{t.awardsPending}</div>}
          {shown.map((h) => (
            <div key={h.committee} className={styles.sideRow}>
              <span>{h.committee}</span>
              <b>{h.delegation}</b>
            </div>
          ))}
          {rest > 0 && (
            <Link href={href} className={styles.sideMore}>
              {t.moreCommittees(rest)}
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

export function EventsPortal({ events, locale }: { events: PortalEvent[]; locale: Locale }) {
  const t = getDictionary(locale).portal;
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<Order>('desc');
  const [visible, setVisible] = useState(PAGE_SIZE);

  // `events` llega ordenado del más reciente al más antiguo.
  const featured = events[0];
  const q = normalizeSearch(query);

  const list = useMemo(() => {
    // Sin búsqueda, el destacado no se repite en la lista; buscando, entra como cualquier otro.
    const base = q ? events : events.slice(1);
    const filtered = q
      ? base.filter((e) => normalizeSearch(`${e.name} ${e.venue ?? ''} ${e.year}`).includes(q))
      : base;
    return order === 'desc' ? filtered : [...filtered].reverse();
  }, [events, q, order]);

  const shown = list.slice(0, visible);
  const groups: { year: number; events: PortalEvent[] }[] = [];
  shown.forEach((e) => {
    const last = groups[groups.length - 1];
    if (last && last.year === e.year) last.events.push(e);
    else groups.push({ year: e.year, events: [e] });
  });

  const eventHref = (e: EventView) => `/${locale}/${e.slug}`;

  if (!featured) {
    return <div className={`${styles.listCard} ${styles.empty}`}>{t.noEvents}</div>;
  }

  return (
    <>
      <Featured event={featured} href={eventHref(featured)} t={t} />
      <section aria-labelledby="all-events">
        <div className={styles.listHead}>
          <div className={styles.listTitle}>
            <h2 id="all-events" className={styles.listTitleText} style={{ margin: 0 }}>
              {t.allEvents}
            </h2>
            <span className={styles.monoMeta}>
              {t.publishedCount(events.length)}
            </span>
          </div>
          <div className={styles.listTools}>
            <input
              type="search"
              className={`${styles.search} ${styles.listSearch}`}
              placeholder={t.searchPlaceholder}
              aria-label={t.searchLabel}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisible(PAGE_SIZE);
              }}
            />
            <div className={styles.segmented} role="group" aria-label={t.order}>
              {(['desc', 'asc'] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  aria-pressed={order === o}
                  className={`${styles.segment} ${order === o ? styles.segmentActive : ''}`}
                  onClick={() => setOrder(o)}
                >
                  {o === 'desc' ? t.newest : t.oldest}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.listCard}>
          {groups.map((group) => (
            <div key={group.year}>
              <div className={styles.yearRow}>{group.year}</div>
              {group.events.map((e) => (
                <Link key={e.slug} href={eventHref(e)} className={styles.eventRow}>
                  <span className={styles.eventRowName}>{e.name}</span>
                  <span className={styles.eventRowVenue}>{e.venue ?? '—'}</span>
                  <span className={styles.eventRowDate}>{e.dateRangeCompact}</span>
                  <span className={styles.eventRowGo}>{t.view}</span>
                </Link>
              ))}
            </div>
          ))}
          {list.length === 0 && (
            <div className={styles.empty}>
              {q ? t.noMatch(query.trim()) : t.onlyOne}
            </div>
          )}
          {list.length > visible && (
            <button type="button" className={styles.moreButton} onClick={() => setVisible((v) => v + PAGE_SIZE)}>
              {t.loadMore}
            </button>
          )}
        </div>
      </section>
    </>
  );
}
