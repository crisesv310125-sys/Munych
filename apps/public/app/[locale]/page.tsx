import { getPublishedDocuments } from '../../lib/data';
import { committeeView, eventView } from '../../lib/view';
import { EventsPortal, type PortalEvent } from '../../components/EventsPortal';
import { PortalTopbar } from '../../components/SiteHeader';
import styles from '../../components/public.module.css';

export const revalidate = 3600;

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const docs = await getPublishedDocuments();

  // Ordenados por fecha de inicio, del más reciente al más antiguo.
  const events: PortalEvent[] = docs
    .map((doc) => {
      const committees = doc.committees.map(committeeView);
      return {
        ...eventView(doc),
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
        <PortalTopbar />
        <div className={`${styles.hero} ${styles.gutter}`}>
          <div className={styles.heroEyebrow}>EVENTOS PUBLICADOS</div>
          <h1 className={styles.heroTitle}>Consulta los reconocimientos de cada comité.</h1>
        </div>
      </header>
      <div className={`${styles.portalBody} ${styles.gutter}`}>
        <EventsPortal events={events} locale={locale} />
      </div>
    </main>
  );
}
