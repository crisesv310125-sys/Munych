import { getPublishedDocuments } from '../../lib/data';
import { getDictionary, type Locale } from '../../lib/i18n';
import { committeeView, eventView } from '../../lib/view';
import { EventsPortal, type PortalEvent } from '../../components/EventsPortal';
import { PortalTopbar } from '../../components/SiteHeader';
import styles from '../../components/public.module.css';

// Los idiomas los genera app/[locale]/layout.tsx (generateStaticParams).

export default async function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = getDictionary(locale).portal;
  const docs = await getPublishedDocuments();

  // Ordenados por fecha de inicio, del más reciente al más antiguo.
  const events: PortalEvent[] = docs
    .map((doc) => {
      const committees = doc.committees.map((c) => committeeView(c, locale));
      return {
        ...eventView(doc, locale),
        committeeCount: committees.length,
        highlights: committees
          .filter((c) => !c.pending)
          .map((c) => ({ committee: c.name, delegation: c.awards[0].delegation.name })),
      };
    })
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn));

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <PortalTopbar locale={locale} />
        <div className={`${styles.hero} ${styles.gutter}`}>
          <div className={styles.heroEyebrow}>{t.eyebrow}</div>
          <h1 className={styles.heroTitle}>{t.title}</h1>
        </div>
      </header>
      <div className={`${styles.portalBody} ${styles.gutter}`}>
        <EventsPortal events={events} locale={locale} />
      </div>
    </main>
  );
}
