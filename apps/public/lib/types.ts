/**
 * Forma del documento público (routes.md, sección 4 "Publicación" → PublicDocument), tal como
 * vive en public.public_results.data. Se define aquí (no se importa de apps/panel) porque la
 * página pública solo debe depender de este documento, nunca de la API interna del panel.
 */

export type EventBrand = 'munych' | 'grand_international';
export type AwardType = 'best_delegate' | 'outstanding_delegate' | 'honorable_mention' | 'verbal_commendation';
export type PublicNameFormat = 'full' | 'first_name_initial' | 'hidden';

export interface PublicEventInfo {
  slug: string;
  name: string;
  brand: EventBrand | (string & {});
  logo_url: string | null;
  venue: string | null;
  starts_on: string;
  ends_on: string;
  timezone: string;
}

export interface PublicationSettings {
  name_format: PublicNameFormat;
  show_institution: boolean;
  show_ranking: boolean;
  show_scores: boolean;
  indexable: boolean;
}

export interface PublicDelegation {
  country_code: string | null;
  character_name: string | null;
  institution: string | null;
}

export interface PublicAward {
  award_type: AwardType;
  position: number;
  delegation: PublicDelegation;
  delegates: string[];
}

export interface PublicRankingItem {
  position: number;
  delegation: PublicDelegation;
  delegates: string[];
  score: number | null;
}

export interface PublicCommittee {
  slug: string;
  name: string;
  acronym: string;
  type: string;
  awards: PublicAward[];
  ranking: PublicRankingItem[] | null;
}

export interface PublicResultsDocument {
  event: PublicEventInfo;
  settings: PublicationSettings;
  committees: PublicCommittee[];
  published_at: string;
  version: number;
}
