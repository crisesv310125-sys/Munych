import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getEventDocument, getPublishedDocuments } from '../../../lib/data';
import { getDictionary, type Locale } from '../../../lib/i18n';
import { committeeView, delegationCount, eventView, generalRankingView } from '../../../lib/view';
import { SiteHeader } from '../../../components/SiteHeader';
import { ShareActions } from '../../../components/ShareActions';
import { EventCommittees } from '../../../components/EventCommittees';
import { RankingTable } from '../../../components/RankingTable';
import styles from '../../../components/public.module.css';

// Export estático: una página por evento publicado en el momento del build (por cada idioma del layout).
export async function generateStaticParams() {
  const docs = await getPublishedDocuments();
  return docs.map((d) => ({ eventSlug: d.event.slug }));
}

interface PageProps {
  params: Promise<{ locale: Locale; eventSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, eventSlug } = await params;
  const doc = await getEventDocument(eventSlug);
  if (!doc) return {};
  return {
    title: `${doc.event.name} · ${getDictionary(locale).meta.results}`,
    robots: doc.settings.indexable ? undefined : { index: false, follow: false },
  };
}

export default async function EventPage({ params }: PageProps) {
  const { locale, eventSlug } = await params;
  const doc = await getEventDocument(eventSlug);
  if (!doc) notFound();

  const t = getDictionary(locale);
  const event = eventView(doc, locale);
  // Los comités pendientes van al final, conservando el orden del documento.
  const committees = doc.committees
    .map((c) => committeeView(c, locale))
    .sort((a, b) => Number(a.pending) - Number(b.pending));
  const delegations = delegationCount(committees);
  // Decisión de diseño (2026-11-07): ranking general del evento debajo de los comités,
  // con la misma tabla del ranking por comité. Solo si se publica el ranking.
  const generalRanking = generalRankingView(doc, locale);

  return (
    <main className={styles.page}>
      <SiteHeader
        locale={locale}
        className={styles.eventHeader}
        logoUrl={event.logoUrl}
        homeHref={`/${locale}`}
        crumbs={[{ label: t.header.events, href: `/${locale}` }, { label: event.name }]}
        actions={<ShareActions locale={locale} title={`${event.name} · ${t.meta.results}`} pdf />}
      >
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.eventTitle}>{event.name}</h1>
            <div className={styles.eventMeta}>
              {event.venue && <span>{event.venue}</span>}
              <span className={styles.desktopOnly}>{event.dateRange}</span>
              <span className={styles.mobileOnly}>{event.dateRangeShort}</span>
            </div>
          </div>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statValue}>{committees.length}</div>
              <div className={styles.statLabel}>{t.event.committees}</div>
            </div>
            {delegations !== null && (
              <div className={styles.stat}>
                <div className={styles.statValue}>{delegations}</div>
                <div className={styles.statLabel}>{t.event.delegations}</div>
              </div>
            )}
          </div>
        </div>
      </SiteHeader>
      <div className={`${styles.eventBody} ${styles.gutter}`}>
        <EventCommittees
          locale={locale}
          committees={committees}
          eventHref={`/${locale}/${eventSlug}`}
          publishedLabel={event.publishedNumeric}
        />
        {generalRanking && generalRanking.length > 0 && (
          <RankingTable locale={locale} ranking={generalRanking} showScores={event.showScores} general />
        )}
      </div>
    </main>
  );
}
