import { getDictionary, type Locale } from './i18n';

/**
 * Formatos de la página pública. Las fechas se arman a mano (no con toLocaleDateString) para que
 * servidor y navegador produzcan exactamente el mismo texto; las horas se calculan en la zona
 * horaria del evento, nunca la del navegador (sección 5.6 del prompt).
 */

const MONTHS: Record<Locale, string[]> = {
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const MONTHS_SHORT: Record<Locale, string[]> = {
  es: ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'],
  en: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
};

interface DateParts {
  day: number;
  month: number; // 0–11
  year: number;
}

function parseDate(isoDate: string): DateParts {
  const [year, month, day] = isoDate.split('-').map(Number);
  return { day, month: month - 1, year };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Rango de fechas con el formato de cada idioma; `mon` da el nombre del mes y `sep` el guion
 * entre días del mismo mes.
 * es: "11 – 15 noviembre 2026" · "28 marzo – 2 abril 2026" · "30 diciembre 2025 – 2 enero 2026".
 * en: "November 11 – 15, 2026" · "March 28 – April 2, 2026" · "December 30, 2025 – January 2, 2026".
 */
function dateRange(startsOn: string, endsOn: string, locale: Locale, mon: (m: number) => string, sep: string): string {
  const s = parseDate(startsOn);
  const e = parseDate(endsOn);
  if (locale === 'en') {
    if (startsOn === endsOn) return `${mon(s.month)} ${s.day}, ${s.year}`;
    if (s.year !== e.year) return `${mon(s.month)} ${s.day}, ${s.year} – ${mon(e.month)} ${e.day}, ${e.year}`;
    if (s.month !== e.month) return `${mon(s.month)} ${s.day} – ${mon(e.month)} ${e.day}, ${e.year}`;
    return `${mon(s.month)} ${s.day}${sep}${e.day}, ${s.year}`;
  }
  if (startsOn === endsOn) return `${s.day} ${mon(s.month)} ${s.year}`;
  if (s.year !== e.year) return `${s.day} ${mon(s.month)} ${s.year} – ${e.day} ${mon(e.month)} ${e.year}`;
  if (s.month !== e.month) return `${s.day} ${mon(s.month)} – ${e.day} ${mon(e.month)} ${e.year}`;
  return `${s.day}${sep}${e.day} ${mon(s.month)} ${s.year}`;
}

/** "11 – 15 noviembre 2026" / "November 11 – 15, 2026". */
export function formatEventDateRange(startsOn: string, endsOn: string, locale: Locale): string {
  return dateRange(startsOn, endsOn, locale, (m) => MONTHS[locale][m], ' – ');
}

/** "11–15 nov 2026" / "Nov 11–15, 2026" (versión corta para móvil). */
export function formatEventDateRangeShort(startsOn: string, endsOn: string, locale: Locale): string {
  const mon = (m: number) => {
    const short = MONTHS_SHORT[locale][m].toLowerCase();
    return locale === 'en' ? short[0].toUpperCase() + short.slice(1) : short;
  };
  return dateRange(startsOn, endsOn, locale, mon, '–');
}

/** "02–04 ABR 2026" (lista de eventos, en mono; el mismo orden en ambos idiomas). */
export function formatEventDateRangeCompact(startsOn: string, endsOn: string, locale: Locale): string {
  const s = parseDate(startsOn);
  const e = parseDate(endsOn);
  const months = MONTHS_SHORT[locale];
  if (startsOn === endsOn) return `${pad2(s.day)} ${months[s.month]} ${s.year}`;
  if (s.year !== e.year) return `${pad2(s.day)} ${months[s.month]} ${s.year} – ${pad2(e.day)} ${months[e.month]} ${e.year}`;
  if (s.month !== e.month) return `${pad2(s.day)} ${months[s.month]} – ${pad2(e.day)} ${months[e.month]} ${e.year}`;
  return `${pad2(s.day)}–${pad2(e.day)} ${months[s.month]} ${s.year}`;
}

export function eventYear(startsOn: string): number {
  return parseDate(startsOn).year;
}

function instantParts(isoInstant: string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date(isoInstant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { day: get('day'), month: get('month') - 1, year: get('year'), hour: get('hour'), minute: get('minute') };
}

/** "15 NOV 2026 · 18:40" en la zona del evento. */
export function formatPublishedShort(isoInstant: string, timezone: string, locale: Locale): string {
  const p = instantParts(isoInstant, timezone);
  return `${p.day} ${MONTHS_SHORT[locale][p.month]} ${p.year} · ${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** "28/10/2026 · 10:57" (es) o "2026-10-28 · 10:57" (en, sin la ambigüedad día/mes) en la zona del evento. */
export function formatPublishedNumeric(isoInstant: string, timezone: string, locale: Locale): string {
  const p = instantParts(isoInstant, timezone);
  const time = `${pad2(p.hour)}:${pad2(p.minute)}`;
  if (locale === 'en') return `${p.year}-${pad2(p.month + 1)}-${pad2(p.day)} · ${time}`;
  return `${pad2(p.day)}/${pad2(p.month + 1)}/${p.year} · ${time}`;
}

const AWARD_ORDER = ['best_delegate', 'outstanding_delegate', 'honorable_mention', 'verbal_commendation'];

/** En minúsculas de oración ("Delegado sobresaliente"); las etiquetas en mayúsculas se hacen con CSS. */
export function awardLabel(type: string, locale: Locale): string {
  return getDictionary(locale).awards[type] ?? type;
}

export function sortAwards<T extends { award_type: string; position: number }>(awards: T[]): T[] {
  return [...awards].sort((a, b) => {
    const orderDiff = AWARD_ORDER.indexOf(a.award_type) - AWARD_ORDER.indexOf(b.award_type);
    return orderDiff !== 0 ? orderDiff : a.position - b.position;
  });
}

const regionNames: Record<Locale, Intl.DisplayNames> = {
  es: new Intl.DisplayNames(['es'], { type: 'region' }),
  en: new Intl.DisplayNames(['en'], { type: 'region' }),
};

/** Nombre del país en el idioma de la página a partir del código ISO ("JP" → "Japón" / "Japan"). */
export function countryName(code: string, locale: Locale): string {
  try {
    return regionNames[locale].of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export function delegationLabel(
  delegation: { country_code: string | null; character_name: string | null },
  locale: Locale,
): string {
  if (delegation.character_name) return delegation.character_name;
  if (delegation.country_code) return countryName(delegation.country_code, locale);
  return '—';
}

/** Minúsculas y sin acentos, para buscar "japon" y encontrar "Japón". */
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}
