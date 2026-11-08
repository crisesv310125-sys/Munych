import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@munych/ui/components/Button';
import { Card } from '@munych/ui/components/Card';
import { StatusBadge } from '@munych/ui/components/StatusBadge';
import { useCommittees, useEvents } from '../../data-access/hooks';
import { errorMessage } from '../../data-access/errors';
import { eventStatusLabel, eventStatusTone } from '../../lib/statusLabels';
import type { ApiEvent } from '../../data-access/apiTypes';
import { CreateEventDialog } from './CreateEventDialog';
import styles from './EventsPage.module.css';
import shared from './AdminShared.module.css';

const COVER_COLORS = ['var(--navy)', 'var(--un-blue)', 'var(--gold)', 'var(--navy-light)'];

function formatDateRange(startDate: string, endDate: string): string {
  if (!startDate || !endDate) return 'Fechas por definir';
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const startLabel = start.toLocaleDateString('es-MX', opts);
  const endLabel = end.toLocaleDateString('es-MX', opts);
  return startDate === endDate ? startLabel : `${startLabel} – ${endLabel}`;
}

function EventCard({ event, index, onClick }: { event: ApiEvent; index: number; onClick: () => void }) {
  const { data: committees } = useCommittees(event.id);
  return (
    <Card
      interactive
      className={styles.card}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' ? onClick() : undefined)}
    >
      <div className={styles.cover} style={{ background: COVER_COLORS[index % COVER_COLORS.length] }}>
        <span className={styles.acronym}>{event.slug.toUpperCase()}</span>
        <StatusBadge tone={eventStatusTone(event.status)} label={eventStatusLabel(event.status).toUpperCase()} />
      </div>
      <div className={styles.body}>
        <span className={styles.name}>{event.name}</span>
        <span className={styles.metaRow}>{formatDateRange(event.starts_on, event.ends_on)}</span>
        <span className={styles.metaRow}>{event.venue || 'Sede por definir'}</span>
        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{committees?.length ?? '—'}</span>
            <span className={styles.statLabel}>COMITÉS</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>—</span>
            <span className={styles.statLabel}>PAÍSES</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>—</span>
            <span className={styles.statLabel}>JUECES</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function EventsPage() {
  const { data: events, isLoading, isError, error, refetch } = useEvents();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const eventList: ApiEvent[] = events ?? [];
  const filtered = eventList.filter((e) => e.name.toLowerCase().includes(query.toLowerCase()));

  const openCreate = () => setCreating(true);
  const closeCreate = useCallback(() => setCreating(false), []);

  return (
    <div className={shared.page}>
      <div className={shared.topbar}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className={shared.topbarTitle}>Eventos</span>
          <span className={shared.topbarSub}>
            {isLoading ? 'Cargando eventos…' : `${eventList.length} eventos registrados`}
          </span>
        </div>
        <div className={shared.topbarActions}>
          <input
            className={shared.searchInput}
            placeholder="Buscar evento…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {/* Decisión de diseño (hito 15): el staff es de la organización y sirve para todos los eventos. */}
          <Button variant="secondary" onClick={() => navigate('/admin/staff')}>
            Staff de la organización
          </Button>
          <Button onClick={openCreate}>+ Nuevo evento</Button>
        </div>
      </div>

      <div className={shared.content}>
        {isError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, color: '#C0392B', fontSize: 13 }}>
            <span>{errorMessage(error)}</span>
            <Button variant="secondary" onClick={() => refetch()}>
              Reintentar
            </Button>
          </div>
        )}
        {isLoading && eventList.length === 0 ? (
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Cargando eventos…</span>
        ) : (
        <div className={styles.grid}>
          {filtered.map((event, i) => (
            <EventCard key={event.id} event={event} index={i} onClick={() => navigate(`/admin/eventos/${event.id}`)} />
          ))}
          <Card dashed className={styles.newCard} onClick={openCreate} role="button" tabIndex={0}>
            <span className={styles.newIcon}>
              <Plus size={16} />
            </span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Crear evento</span>
          </Card>
        </div>
        )}
      </div>

      {creating && (
        <CreateEventDialog
          onClose={closeCreate}
          onCreated={(created) => {
            setCreating(false);
            navigate(`/admin/eventos/${created.id}`);
          }}
        />
      )}
    </div>
  );
}
