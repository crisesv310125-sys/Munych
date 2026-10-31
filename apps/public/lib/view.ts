import {
  awardLabel,
  delegationLabel,
  eventYear,
  formatEventDateRange,
  formatEventDateRangeCompact,
  formatEventDateRangeShort,
  formatPublishedNumeric,
  formatPublishedShort,
  normalizeSearch,
  sortAwards,
} from './format';
import type { Locale } from './i18n';
import type { PublicCommittee, PublicDelegation, PublicResultsDocument } from './types';

/**
 * Textos ya resueltos en el servidor (nombres de país, fechas en la zona del evento) que se pasan
 * a los componentes de cliente. Así el HTML del servidor y el del navegador coinciden siempre.
 */

export interface DelegationView {
  name: string;
  /** Código ISO del país; null para delegaciones de personaje. */
  code: string | null;
  institution: string | null;
}

export interface AwardView {
  label: string;
  delegation: DelegationView;
  delegates: string[];
}

export interface RankingRowView {
  position: number;
  delegation: DelegationView;
  delegates: string[];
  score: string | null;
  /** Texto normalizado para el buscador. */
  search: string;
}

export interface CommitteeView {
  slug: string;
  name: string;
  acronym: string;
  /** Sin premios publicados todavía → "Pendiente". */
  pending: boolean;
  awards: AwardView[];
  ranking: RankingRowView[] | null;
  search: string;
}

export interface EventView {
  slug: string;
  name: string;
  venue: string | null;
  logoUrl: string | null;
  startsOn: string;
  year: number;
  dateRange: string;
  dateRangeShort: string;
  dateRangeCompact: string;
  publishedShort: string;
  publishedNumeric: string;
  showScores: boolean;
}

function delegationView(d: PublicDelegation, locale: Locale): DelegationView {
  return { name: delegationLabel(d, locale), code: d.character_name ? null : d.country_code, institution: d.institution };
}

export function eventView(doc: PublicResultsDocument, locale: Locale): EventView {
  const { event } = doc;
  return {
    slug: event.slug,
    name: event.name,
    venue: event.venue,
    logoUrl: event.logo_url,
    startsOn: event.starts_on,
    year: eventYear(event.starts_on),
    dateRange: formatEventDateRange(event.starts_on, event.ends_on, locale),
    dateRangeShort: formatEventDateRangeShort(event.starts_on, event.ends_on, locale),
    dateRangeCompact: formatEventDateRangeCompact(event.starts_on, event.ends_on, locale),
    publishedShort: formatPublishedShort(doc.published_at, event.timezone, locale),
    publishedNumeric: formatPublishedNumeric(doc.published_at, event.timezone, locale),
    showScores: doc.settings.show_scores,
  };
}

export function committeeView(committee: PublicCommittee, locale: Locale): CommitteeView {
  const awards = sortAwards(committee.awards).map((a) => ({
    label: awardLabel(a.award_type, locale),
    delegation: delegationView(a.delegation, locale),
    delegates: a.delegates,
  }));
  const ranking =
    committee.ranking?.map((r) => {
      const delegation = delegationView(r.delegation, locale);
      return {
        position: r.position,
        delegation,
        delegates: r.delegates,
        score: r.score !== null ? r.score.toFixed(1) : null,
        search: normalizeSearch([delegation.name, delegation.code ?? '', ...r.delegates].join(' ')),
      };
    }) ?? null;
  const searchParts = [
    committee.name,
    committee.acronym,
    ...awards.flatMap((a) => [a.delegation.name, ...a.delegates]),
    ...(ranking ?? []).map((r) => r.search),
  ];
  return {
    slug: committee.slug,
    name: committee.name,
    acronym: committee.acronym,
    pending: awards.length === 0,
    awards,
    ranking,
    search: normalizeSearch(searchParts.join(' ')),
  };
}

/** Delegaciones del evento; null si el evento no publica el ranking (no se puede contar). */
export function delegationCount(committees: CommitteeView[]): number | null {
  if (!committees.some((c) => c.ranking)) return null;
  return committees.reduce((sum, c) => sum + (c.ranking?.length ?? 0), 0);
}
