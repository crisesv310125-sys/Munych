import { useEffect, useId, useState } from 'react';
import { X } from 'lucide-react';
import { useCreateEvent } from '../../data-access/hooks';
import { errorMessage } from '../../data-access/errors';
import { EVENT_TYPE_OPTIONS } from '../../lib/statusLabels';
import { COUNTRIES, TIMEZONES, suggestedTimezone, utcOffsetLabel } from '../../lib/geo';
import { slugify } from '../../lib/slugify';
import type { ApiEvent, EventBrand, EventType } from '../../data-access/apiTypes';
import styles from './CreateEventDialog.module.css';

const BRANDS: { value: EventBrand; label: string }[] = [
  { value: 'munych', label: 'MUNYCH' },
  { value: 'grand_international', label: 'GRAND International' },
];

/** Prefijo de la URL pública del evento (apps/public: /[locale]/[slug]). */
const PUBLIC_URL_PREFIX = '/es/';

const EMPTY_DRAFT = {
  name: '',
  slug: '',
  brand: 'munych' as EventBrand,
  eventType: 'judges_only' as EventType,
  startDate: '',
  endDate: '',
  venue: '',
  country: 'MX',
  timezone: 'America/Mexico_City',
};

const DAY_MS = 24 * 60 * 60 * 1000;
const weekday = new Intl.DateTimeFormat('es-MX', { weekday: 'long' });

/** "4 días · miércoles a sábado" / "1 día · miércoles". */
function durationLabel(start: string, end: string): string {
  if (!start || !end) return '';
  const from = new Date(`${start}T00:00:00`);
  const to = new Date(`${end}T00:00:00`);
  if (to < from) return 'La fecha de fin es anterior a la de inicio';
  const days = Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
  if (days === 1) return `1 día · ${weekday.format(from)}`;
  return `${days} días · ${weekday.format(from)} a ${weekday.format(to)}`;
}

interface CreateEventDialogProps {
  onClose: () => void;
  onCreated: (event: ApiEvent) => void;
}

export function CreateEventDialog({ onClose, onCreated }: CreateEventDialogProps) {
  const createEvent = useCreateEvent();
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState('');
  const ids = useId();
  const id = (name: string) => `${ids}-${name}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = <K extends keyof typeof EMPTY_DRAFT>(key: K, value: (typeof EMPTY_DRAFT)[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const datesInvalid = Boolean(draft.startDate && draft.endDate && draft.endDate < draft.startDate);
  const canSubmit = Boolean(draft.name.trim() && draft.startDate && draft.endDate && !datesInvalid);
  const duration = durationLabel(draft.startDate, draft.endDate);
  const timezones = TIMEZONES.includes(draft.timezone) ? TIMEZONES : [draft.timezone, ...TIMEZONES];

  async function handleSubmit() {
    if (!canSubmit || createEvent.isPending) return;
    setError('');
    try {
      const created = await createEvent.mutateAsync({
        name: draft.name.trim(),
        slug: draft.slug.trim() || slugify(draft.name),
        brand: draft.brand,
        event_type: draft.eventType,
        venue: draft.venue.trim() || null,
        country_code: draft.country || null,
        timezone: draft.timezone,
        starts_on: draft.startDate,
        ends_on: draft.endDate,
      });
      onCreated(created);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id('title')}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <h2 id={id('title')} className={styles.title}>
              Nuevo evento
            </h2>
            <p className={styles.subtitle}>Los comités, jueces y criterios se agregan después de crearlo.</p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
            <X size={16} strokeWidth={2} />
          </button>
        </header>

        <div className={styles.body}>
          <section className={styles.column}>
            <span className={styles.section}>01 · Información general</span>

            <div className={styles.field}>
              <label className={styles.label} htmlFor={id('name')}>
                Nombre del evento
              </label>
              <input
                id={id('name')}
                className={`${styles.control} ${styles.mono}`}
                placeholder="MUNYCH 2027"
                autoFocus
                value={draft.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setDraft((d) => ({ ...d, name, slug: slugTouched ? d.slug : slugify(name) }));
                }}
              />
            </div>

            <div className={styles.rowUrl}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={id('slug')}>
                  URL pública
                </label>
                <div className={styles.addonGroup}>
                  <span className={styles.addon}>{PUBLIC_URL_PREFIX}</span>
                  <input
                    id={id('slug')}
                    className={`${styles.control} ${styles.mono} ${styles.addonControl}`}
                    placeholder="munych-2027"
                    value={draft.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      set('slug', slugify(e.target.value));
                    }}
                  />
                </div>
                <span className={styles.helper}>Se genera del nombre; puedes editarla.</span>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={id('brand')}>
                  Marca
                </label>
                <div className={styles.selectWrap}>
                  <select
                    id={id('brand')}
                    className={`${styles.control} ${styles.mono} ${styles.select}`}
                    value={draft.brand}
                    onChange={(e) => set('brand', e.target.value as EventBrand)}
                  >
                    {BRANDS.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                  <span className={styles.caret} aria-hidden="true" />
                </div>
              </div>
            </div>

            <fieldset className={styles.fieldset}>
              <legend className={styles.label}>Tipo de evento</legend>
              <div className={styles.typeGrid}>
                {EVENT_TYPE_OPTIONS.map((option) => {
                  const checked = draft.eventType === option.value;
                  return (
                    <label key={option.value} className={`${styles.typeCard} ${checked ? styles.typeCardActive : ''}`}>
                      <input
                        type="radio"
                        name={id('type')}
                        value={option.value}
                        checked={checked}
                        onChange={() => set('eventType', option.value)}
                        className={styles.radioInput}
                      />
                      <span className={styles.radio} aria-hidden="true" />
                      <span className={styles.typeText}>
                        <span className={styles.typeTitle}>{option.label}</span>
                        <span className={styles.typeDesc}>{option.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </section>

          <section className={styles.column}>
            <span className={styles.section}>02 · Fechas y sede</span>

            <div>
              <div className={styles.row2}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={id('start')}>
                    Inicio
                  </label>
                  <input
                    id={id('start')}
                    type="date"
                    className={`${styles.control} ${styles.mono} ${styles.date}`}
                    value={draft.startDate}
                    onChange={(e) => {
                      const startDate = e.target.value;
                      setDraft((d) => ({ ...d, startDate, endDate: d.endDate || startDate }));
                    }}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={id('end')}>
                    Fin
                  </label>
                  <input
                    id={id('end')}
                    type="date"
                    min={draft.startDate || undefined}
                    className={`${styles.control} ${styles.mono} ${styles.date}`}
                    aria-invalid={datesInvalid}
                    value={draft.endDate}
                    onChange={(e) => set('endDate', e.target.value)}
                  />
                </div>
              </div>
              <span className={`${styles.helper} ${styles.helperBelow} ${datesInvalid ? styles.helperError : ''}`}>
                {duration || ' '}
              </span>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor={id('venue')}>
                Sede
              </label>
              <input
                id={id('venue')}
                className={styles.control}
                placeholder="Campus Central, Ciudad de México"
                value={draft.venue}
                onChange={(e) => set('venue', e.target.value)}
              />
            </div>

            <div>
              <div className={styles.rowPlace}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={id('country')}>
                    País
                  </label>
                  <div className={styles.selectWrap}>
                    <span className={styles.countryChip} aria-hidden="true">
                      {draft.country}
                    </span>
                    <select
                      id={id('country')}
                      className={`${styles.control} ${styles.select} ${styles.countrySelect}`}
                      value={draft.country}
                      onChange={(e) => {
                        const country = e.target.value;
                        const tz = suggestedTimezone(country);
                        setDraft((d) => ({ ...d, country, timezone: tz ?? d.timezone }));
                      }}
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <span className={styles.caret} aria-hidden="true" />
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={id('tz')}>
                    Zona horaria
                  </label>
                  <div className={styles.selectWrap}>
                    <select
                      id={id('tz')}
                      className={`${styles.control} ${styles.mono} ${styles.select} ${styles.tzSelect}`}
                      value={draft.timezone}
                      onChange={(e) => set('timezone', e.target.value)}
                    >
                      {timezones.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                    <span className={styles.tzOffset} aria-hidden="true">
                      {utcOffsetLabel(draft.timezone)}
                    </span>
                    <span className={styles.caret} aria-hidden="true" />
                  </div>
                </div>
              </div>
              <span className={`${styles.helper} ${styles.helperBelow}`}>
                Se sugiere según el país. Define horarios de votación y cierre.
              </span>
            </div>
          </section>
        </div>

        <footer className={styles.footer}>
          <span className={error ? styles.footerError : styles.footerNote}>
            {error || (
              <>
                Se crea como <strong>borrador</strong>; no es público hasta que lo publiques.
              </>
            )}
          </span>
          <div className={styles.actions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={createEvent.isPending}>
              Cancelar
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleSubmit}
              disabled={!canSubmit || createEvent.isPending}
            >
              {createEvent.isPending ? 'Creando…' : 'Crear evento'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
