import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getEventDocument } from '../../../lib/data';
import { committeeView, delegationCount, eventView } from '../../../lib/view';
import { SiteHeader } from '../../../components/SiteHeader';
import { ShareActions } from '../../../components/ShareActions';
import { EventCommittees } from '../../../components/EventCommittees';
import styles from '../../../components/public.module.css';

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ locale: string; eventSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { eventSlug } = await params;
  const doc = await getEventDocument(eventSlug);
  if (!doc) return {};
  return {
    title: `${doc.event.name} · Resultados`,
    robots: doc.settings.indexable ? undefined : { index: false, follow: false },
  };
}

export default async function EventPage({ params }: PageProps) {
  const { locale, eventSlug } = await params;
  const doc = await getEventDocument(eventSlug);
  if (!doc) notFound();

  const event = eventView(doc);
  // Los comités pendientes van al final, conservando el orden del documento.
  const committees = doc.committees.map(committeeView).sort((a, b) => Number(a.pending) - Number(b.pending));
  const delegations = delegationCount(committees);

  return (
    <main className={styles.page}>
      <SiteHeader
        className={styles.eventHeader}
        logoUrl={event.logoUrl}
        homeHref={`/${locale}`}
        crumbs={[{ label: 'Eventos', href: `/${locale}` }, { label: event.name }]}
        actions={<ShareActions title={`${event.name} · Resultados`} pdf />}
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
              <div className={styles.statLabel}>COMITÉS</div>
            </div>
            {delegations !== null && (
              <div className={styles.stat}>
                <div className={styles.statValue}>{delegations}</div>
                <div className={styles.statLabel}>DELEGACIONES</div>
              </div>
            )}
          </div>
        </div>
      </SiteHeader>
      <div className={`${styles.eventBody} ${styles.gutter}`}>
        <EventCommittees committees={committees} eventHref={`/${locale}/${eventSlug}`} publishedLabel={event.publishedNumeric} />
      </div>
    </main>
  );
}
