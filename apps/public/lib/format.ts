/**
 * Formatos de la página pública. Las fechas se arman a mano (no con toLocaleDateString) para que
 * servidor y navegador produzcan exactamente el mismo texto; las horas se calculan en la zona
 * horaria del evento, nunca la del navegador (sección 5.6 del prompt).
 */

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_SHORT = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

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

/** "11 – 15 noviembre 2026" · "28 marzo – 2 abril 2026" · "30 diciembre 2025 – 2 enero 2026". */
export function formatEventDateRange(startsOn: string, endsOn: string): string {
  const s = parseDate(startsOn);
  const e = parseDate(endsOn);
  if (startsOn === endsOn) return `${s.day} ${MONTHS[s.month]} ${s.year}`;
  if (s.year !== e.year) return `${s.day} ${MONTHS[s.month]} ${s.year} – ${e.day} ${MONTHS[e.month]} ${e.year}`;
  if (s.month !== e.month) return `${s.day} ${MONTHS[s.month]} – ${e.day} ${MONTHS[e.month]} ${e.year}`;
  return `${s.day} – ${e.day} ${MONTHS[s.month]} ${s.year}`;
}

/** "11–15 nov 2026" (versión corta para móvil). */
export function formatEventDateRangeShort(startsOn: string, endsOn: string): string {
  const s = parseDate(startsOn);
  const e = parseDate(endsOn);
  const mon = (m: number) => MONTHS_SHORT[m].toLowerCase();
  if (startsOn === endsOn) return `${s.day} ${mon(s.month)} ${s.year}`;
  if (s.year !== e.year) return `${s.day} ${mon(s.month)} ${s.year} – ${e.day} ${mon(e.month)} ${e.year}`;
  if (s.month !== e.month) return `${s.day} ${mon(s.month)} – ${e.day} ${mon(e.month)} ${e.year}`;
  return `${s.day}–${e.day} ${mon(s.month)} ${s.year}`;
}

/** "02–04 ABR 2026" (lista de eventos, en mono). */
export function formatEventDateRangeCompact(startsOn: string, endsOn: string): string {
  const s = parseDate(startsOn);
  const e = parseDate(endsOn);
  if (startsOn === endsOn) return `${pad2(s.day)} ${MONTHS_SHORT[s.month]} ${s.year}`;
  if (s.year !== e.year) return `${pad2(s.day)} ${MONTHS_SHORT[s.month]} ${s.year} – ${pad2(e.day)} ${MONTHS_SHORT[e.month]} ${e.year}`;
  if (s.month !== e.month) return `${pad2(s.day)} ${MONTHS_SHORT[s.month]} – ${pad2(e.day)} ${MONTHS_SHORT[e.month]} ${e.year}`;
  return `${pad2(s.day)}–${pad2(e.day)} ${MONTHS_SHORT[s.month]} ${s.year}`;
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
export function formatPublishedShort(isoInstant: string, timezone: string): string {
  const p = instantParts(isoInstant, timezone);
  return `${p.day} ${MONTHS_SHORT[p.month]} ${p.year} · ${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** "28/10/2026 · 10:57" en la zona del evento. */
export function formatPublishedNumeric(isoInstant: string, timezone: string): string {
  const p = instantParts(isoInstant, timezone);
  return `${pad2(p.day)}/${pad2(p.month + 1)}/${p.year} · ${pad2(p.hour)}:${pad2(p.minute)}`;
}

const AWARD_LABEL: Record<string, string> = {
  best_delegate: 'Mejor delegado',
  outstanding_delegate: 'Delegado sobresaliente',
  honorable_mention: 'Mención honorífica',
  verbal_commendation: 'Mención verbal',
};

const AWARD_ORDER = ['best_delegate', 'outstanding_delegate', 'honorable_mention', 'verbal_commendation'];

/** En minúsculas de oración ("Delegado sobresaliente"); las etiquetas en mayúsculas se hacen con CSS. */
export function awardLabel(type: string): string {
  return AWARD_LABEL[type] ?? type;
}

export function sortAwards<T extends { award_type: string; position: number }>(awards: T[]): T[] {
  return [...awards].sort((a, b) => {
    const orderDiff = AWARD_ORDER.indexOf(a.award_type) - AWARD_ORDER.indexOf(b.award_type);
    return orderDiff !== 0 ? orderDiff : a.position - b.position;
  });
}

const regionNames = new Intl.DisplayNames(['es'], { type: 'region' });

/** Nombre del país en español a partir del código ISO ("JP" → "Japón"). */
export function countryName(code: string): string {
  try {
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export function delegationLabel(delegation: { country_code: string | null; character_name: string | null }): string {
  if (delegation.character_name) return delegation.character_name;
  if (delegation.country_code) return countryName(delegation.country_code);
  return '—';
}

/** Minúsculas y sin acentos, para buscar "japon" y encontrar "Japón". */
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}
