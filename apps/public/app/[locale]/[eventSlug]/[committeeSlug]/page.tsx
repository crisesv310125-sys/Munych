import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getEventDocument, getPublishedDocuments } from '../../../../lib/data';
import { getDictionary, type Locale } from '../../../../lib/i18n';
import { committeeView, eventView } from '../../../../lib/view';
import { SiteHeader } from '../../../../components/SiteHeader';
import { ShareActions } from '../../../../components/ShareActions';
import { CommitteeChips, CommitteeSwitcher, type CommitteeLink } from '../../../../components/CommitteeSwitcher';
import { CommitteeAwards } from '../../../../components/CommitteeAwards';
import { RankingTable } from '../../../../components/RankingTable';
import styles from '../../../../components/public.module.css';

// Export estático: una página por comité de cada evento publicado (por cada idioma del layout).
export async function generateStaticParams() {
  const docs = await getPublishedDocuments();
  return docs.flatMap((d) => d.committees.map((c) => ({ eventSlug: d.event.slug, committeeSlug: c.slug })));
}

interface PageProps {
  params: Promise<{ locale: Locale; eventSlug: string; committeeSlug: string }>;
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

  const t = getDictionary(locale);
  const event = eventView(doc, locale);
  const committee = committeeView(raw, locale);
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
        locale={locale}
        className={styles.committeeHeader}
        logoUrl={event.logoUrl}
        homeHref={eventHref}
        crumbs={[{ label: t.header.events, href: `/${locale}` }, { label: event.name, href: eventHref }, { label: committee.name }]}
        actions={<ShareActions locale={locale} title={`${committee.name} · ${event.name}`} />}
      >
        <div className={styles.desktopOnly}>
          <Link href={eventHref} className={styles.backLink}>
            {t.committee.backToEvent(event.name)}
          </Link>
          <div className={styles.committeeTitleRow}>
            <h1 className={styles.eventTitle}>{committee.name}</h1>
            <CommitteeSwitcher locale={locale} committees={links} current={committee.slug} eventHref={eventHref} />
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
        <CommitteeChips locale={locale} committees={links} current={committee.slug} eventHref={eventHref} />
        {links.length < 2 && <div className={styles.mobileOnly} style={{ height: 20 }} />}
      </SiteHeader>
      <div className={`${styles.committeeBody} ${styles.gutter}`}>
        <section className={styles.section} aria-labelledby="awards-title">
          <h2 id="awards-title" className={styles.eyebrow} style={{ margin: 0 }}>
            {t.committee.awards}
          </h2>
          <CommitteeAwards locale={locale} awards={committee.awards} />
        </section>
        {committee.ranking && committee.ranking.length > 0 && (
          <RankingTable locale={locale} ranking={committee.ranking} showScores={event.showScores} />
        )}
      </div>
    </main>
  );
}
