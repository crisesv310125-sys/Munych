import type { PublicAward, PublicCommittee, PublicRankingItem, PublicResultsDocument, PublicationSettings } from './types';

/**
 * Datos de desarrollo con la forma exacta de public.public_results.data, para poder ver y
 * probar la página pública sin Supabase. Se usan solo con NEXT_PUBLIC_USE_MOCKS=true.
 * Cubren los estados del handoff: varios años, comité con un solo premio, comité pendiente y
 * puntaje no disponible.
 */

const SETTINGS: PublicationSettings = {
  name_format: 'first_name_initial',
  show_institution: false,
  show_ranking: true,
  show_scores: true,
  indexable: false,
};

type Row = [country: string, delegates: string[], score: number | null];

function ranking(rows: Row[]): PublicRankingItem[] {
  return rows.map(([country_code, delegates, score], i) => ({
    position: i + 1,
    delegation: { country_code, character_name: null, institution: null },
    delegates,
    score,
  }));
}

const AWARD_TYPES = ['best_delegate', 'outstanding_delegate', 'honorable_mention'] as const;

/** Premios para las primeras `count` posiciones del ranking. */
function awardsFrom(items: PublicRankingItem[], count: number): PublicAward[] {
  return items.slice(0, count).map((item, i) => ({
    award_type: AWARD_TYPES[i],
    position: 1,
    delegation: item.delegation,
    delegates: item.delegates,
  }));
}

function committee(slug: string, name: string, acronym: string, rows: Row[], awardCount = 3): PublicCommittee {
  const items = ranking(rows);
  return { slug, name, acronym, type: 'general_assembly', awards: awardsFrom(items, awardCount), ranking: items };
}

function pending(slug: string, name: string, acronym: string): PublicCommittee {
  return { slug, name, acronym, type: 'crisis', awards: [], ranking: [] };
}

function event(
  slug: string,
  name: string,
  venue: string,
  starts_on: string,
  ends_on: string,
  published_at: string,
  committees: PublicCommittee[],
): PublicResultsDocument {
  return {
    event: { slug, name, brand: 'munych', logo_url: '/brand/munych-logo.png', venue, starts_on, ends_on, timezone: 'America/Santo_Domingo' },
    settings: SETTINGS,
    committees,
    published_at,
    version: 1,
  };
}

const SD_2026 = event('sd-mun-2026', 'SD MUN 2026', 'Hotel Barceló', '2026-11-11', '2026-11-15', '2026-11-15T22:40:00Z', [
  committee('unicef', 'UNICEF', 'UNICEF', [
    ['JP', ['Juan H.'], 88.3],
    ['CA', ['Sofía R.'], 85.0],
    ['NG', ['Diego M.'], 82.7],
    ['DE', ['Lucía F.', 'Martín O.'], 79.4],
    ['MX', ['Valeria S.'], 77.1],
    ['IN', ['Rahul P.'], null],
    ['AR', ['Tomás L.'], 75.2],
    ['CL', ['Isabel V.'], 74.8],
    ['PE', ['Camilo T.'], 73.0],
    ['CO', ['Mariana G.'], 71.9],
    ['EG', ['Omar K.'], 70.4],
    ['ZA', ['Thandi M.'], 68.6],
  ]),
  committee('ag', 'Asamblea General', 'AG', [
    ['KE', ['Catalina V.'], 87.4],
    ['FR', ['Andrés N.'], 84.1],
    ['BR', ['Rocío P.'], 80.6],
    ['AE', ['Hugo D.'], 77.2],
    ['JP', ['Paula C.'], 74.5],
    ['MX', ['Iván R.'], 73.9],
  ]),
  committee(
    'cs',
    'Consejo de Seguridad',
    'CS',
    [
      ['GB', ['Tomás A.', 'Elisa G.'], 86.0],
      ['US', ['Nicolás B.'], 83.2],
      ['CN', ['Lin W.'], 81.5],
      ['RU', ['Sergio K.'], 78.0],
    ],
    1,
  ),
  committee('ecosoc', 'ECOSOC', 'ECOSOC', [
    ['IN', ['Ana P.'], 85.5],
    ['DE', ['Luis G.'], 82.0],
    ['KR', ['Min J.'], 79.1],
  ]),
  pending('crisis', 'Gabinete de Crisis', 'CRISIS'),
]);

const PRIMAVERA_2026 = event('munych-primavera-2026', 'MUNYCH Primavera 2026', 'Campus Central', '2026-04-02', '2026-04-04', '2026-04-04T23:10:00Z', [
  committee('ag', 'Asamblea General', 'AG', [
    ['ES', ['Lucía M.'], 84.0],
    ['IT', ['Marco B.'], 81.3],
    ['PT', ['Inês S.'], 79.8],
  ]),
]);

const SD_2025 = event('sd-mun-2025', 'SD MUN 2025', 'Hotel Barceló', '2025-11-13', '2025-11-17', '2025-11-17T21:00:00Z', [
  committee('ag', 'Asamblea General', 'AG', [
    ['CA', ['Elena R.'], 86.1],
    ['AU', ['Jack T.'], 83.4],
    ['NZ', ['Aroha W.'], 80.2],
  ]),
]);

const PRIMAVERA_2025 = event('munych-primavera-2025', 'MUNYCH Primavera 2025', 'Campus Central', '2025-04-04', '2025-04-06', '2025-04-06T22:30:00Z', [
  committee('oms', 'OMS', 'OMS', [
    ['SE', ['Astrid L.'], 82.9],
    ['NO', ['Erik H.'], 80.0],
    ['FI', ['Aino K.'], 78.5],
  ]),
]);

export const MOCK_PUBLIC_DOCUMENTS: Record<string, PublicResultsDocument> = Object.fromEntries(
  [SD_2026, PRIMAVERA_2026, SD_2025, PRIMAVERA_2025].map((doc) => [doc.event.slug, doc]),
);
