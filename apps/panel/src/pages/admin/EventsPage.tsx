import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@munych/ui/components/Button';
import { Input, Select } from '@munych/ui/components/FormControls';
import { Card } from '@munych/ui/components/Card';
import { StatusBadge } from '@munych/ui/components/StatusBadge';
import { useCommittees, useCreateEvent, useEvents } from '../../data-access/hooks';
import { errorMessage } from '../../data-access/errors';
import { eventStatusLabel, eventStatusTone } from '../../lib/statusLabels';
import { slugify } from '../../lib/slugify';
import type { ApiEvent, EventBrand } from '../../data-access/apiTypes';
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

const EMPTY_DRAFT = {
  name: '',
  slug: '',
  brand: 'munych' as EventBrand,
  venue: '',
  country: 'MX',
  timezone: 'America/Mexico_City',
  startDate: '',
  endDate: '',
};

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
  const createEvent = useCreateEvent();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [slugTouched, setSlugTouched] = useState(false);
  const [createError, setCreateError] = useState('');

  const eventList: ApiEvent[] = events ?? [];
  const filtered = eventList.filter((e) => e.name.toLowerCase().includes(query.toLowerCase()));

  function openCreate() {
    setDraft(EMPTY_DRAFT);
    setSlugTouched(false);
    setCreateError('');
    setCreating(true);
  }

  async function handleCreate() {
    if (!draft.name.trim() || !draft.startDate || !draft.endDate) return;
    setCreateError('');
    try {
      const created = await createEvent.mutateAsync({
        name: draft.name.trim(),
        slug: draft.slug.trim() || slugify(draft.name),
        brand: draft.brand,
        venue: draft.venue.trim() || null,
        country_code: draft.country.trim() || null,
        timezone: draft.timezone,
        starts_on: draft.startDate,
        ends_on: draft.endDate,
      });
      setCreating(false);
      navigate(`/admin/eventos/${created.id}`);
    } catch (err) {
      setCreateError(errorMessage(err));
    }
  }

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
        <div className={styles.overlay} onClick={() => setCreating(false)}>
          <div className={`${shared.modalCard} ${styles.dialog}`} onClick={(e) => e.stopPropagation()}>
            <div className={shared.modalHeader}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)' }}>
                Nuevo evento
              </span>
              <button
                onClick={() => setCreating(false)}
                style={{ background: 'none', border: 'none', color: 'var(--state-none-dot)', fontSize: 16, cursor: 'pointer' }}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <div className={shared.modalBody}>
              <Input
                label="Nombre del evento"
                placeholder="p. ej. MUNYCH 2027"
                value={draft.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setDraft((d) => ({ ...d, name, slug: slugTouched ? d.slug : slugify(name) }));
                }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Input
                  label="Slug"
                  placeholder="munych-2027"
                  value={draft.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setDraft({ ...draft, slug: slugify(e.target.value) });
                  }}
                />
                <Select
                  label="Marca"
                  value={draft.brand}
                  onChange={(e) => setDraft({ ...draft, brand: e.target.value as EventBrand })}
                >
                  <option value="munych">MUNYCH</option>
                  <option value="grand_international">GRAND International</option>
                </Select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Input
                  label="Fecha de inicio"
                  type="date"
                  value={draft.startDate}
                  onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
                />
                <Input
                  label="Fecha de fin"
                  type="date"
                  value={draft.endDate}
                  onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
                />
              </div>
              <Input
                label="Sede"
                placeholder="Campus Central, Ciudad de México"
                value={draft.venue}
                onChange={(e) => setDraft({ ...draft, venue: e.target.value })}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Input
                  label="País (ISO)"
                  placeholder="MX"
                  maxLength={2}
                  value={draft.country}
                  onChange={(e) => setDraft({ ...draft, country: e.target.value.toUpperCase() })}
                />
                <Input
                  label="Zona horaria (IANA)"
                  placeholder="America/Mexico_City"
                  value={draft.timezone}
                  onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
                />
              </div>
              {createError && <span style={{ color: '#C0392B', fontSize: 13 }}>{createError}</span>}
            </div>
            <div className={shared.modalFooter}>
              <Button variant="secondary" onClick={() => setCreating(false)} disabled={createEvent.isPending}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createEvent.isPending || !draft.name.trim() || !draft.startDate || !draft.endDate}
              >
                {createEvent.isPending ? 'Creando…' : 'Crear evento'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
