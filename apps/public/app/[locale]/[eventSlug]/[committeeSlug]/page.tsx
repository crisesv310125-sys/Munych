import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getEventDocument } from '../../../../lib/data';
import { committeeView, eventView } from '../../../../lib/view';
import { SiteHeader } from '../../../../components/SiteHeader';
import { ShareActions } from '../../../../components/ShareActions';
import { CommitteeChips, CommitteeSwitcher, type CommitteeLink } from '../../../../components/CommitteeSwitcher';
import { CommitteeAwards } from '../../../../components/CommitteeAwards';
import { RankingTable } from '../../../../components/RankingTable';
import styles from '../../../../components/public.module.css';

// Solo se regenera cuando el backend llama a /api/revalidate al publicar o despublicar.
export const revalidate = false;

// Sin rutas en el build: cada página se genera en su primera visita y queda cacheada (ISR).
export function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ locale: string; eventSlug: string; committeeSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { eventSlug, committeeSlug } = await params;
  const doc = await getEventDocument(eventSlug);
  const committee = doc?.committees.find((c) => c.slug === committeeSlug);
  if (!doc || !committee) return {};
  return {
    title: `${committee.name} · ${doc.event.name}`,
    robots: doc.settings.indexable ? undefined : { index: false, follow: false },
  };
}

export default async function CommitteePage({ params }: PageProps) {
  const { locale, eventSlug, committeeSlug } = await params;
  const doc = await getEventDocument(eventSlug);
  if (!doc) notFound();
  const raw = doc.committees.find((c) => c.slug === committeeSlug);
  if (!raw) notFound();

  const event = eventView(doc);
  const committee = committeeView(raw);
  const eventHref = `/${locale}/${eventSlug}`;
  const links: CommitteeLink[] = doc.committees.map((c) => ({
    slug: c.slug,
    name: c.name,
    acronym: c.acronym,
    pending: c.awards.length === 0,
  }));

  return (
    <main className={styles.page}>
      <SiteHeader
        className={styles.committeeHeader}
        logoUrl={event.logoUrl}
        homeHref={eventHref}
        crumbs={[{ label: 'Eventos', href: `/${locale}` }, { label: event.name, href: eventHref }, { label: committee.name }]}
        actions={<ShareActions title={`${committee.name} · ${event.name}`} />}
      >
        <div className={styles.desktopOnly}>
          <Link href={eventHref} className={styles.backLink}>
            ← {event.name} · todos los comités
          </Link>
          <div className={styles.committeeTitleRow}>
            <h1 className={styles.eventTitle}>{committee.name}</h1>
            <CommitteeSwitcher committees={links} current={committee.slug} eventHref={eventHref} />
          </div>
        </div>
        {/* Móvil (2c): título del evento y el comité se elige con las pastillas. */}
        <div className={styles.mobileOnly}>
          <h1 className={styles.eventTitle}>
            <Link href={eventHref}>{event.name}</Link>
          </h1>
          <div className={styles.eventMeta}>
            {[event.venue, event.dateRangeShort].filter(Boolean).join(' · ')}
          </div>
        </div>
        <CommitteeChips committees={links} current={committee.slug} eventHref={eventHref} />
        {links.length < 2 && <div className={styles.mobileOnly} style={{ height: 20 }} />}
      </SiteHeader>
      <div className={`${styles.committeeBody} ${styles.gutter}`}>
        <section className={styles.section} aria-labelledby="awards-title">
          <h2 id="awards-title" className={styles.eyebrow} style={{ margin: 0 }}>
            Premios
          </h2>
          <CommitteeAwards awards={committee.awards} />
        </section>
        {committee.ranking && committee.ranking.length > 0 && (
          <RankingTable ranking={committee.ranking} showScores={event.showScores} />
        )}
      </div>
    </main>
  );
}
