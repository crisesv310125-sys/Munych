import type {
  ApiCommittee,
  ApiCriterion,
  ApiDelegate,
  ApiDelegation,
  ApiEvent,
  ApiJudge,
  ApiRubric,
  ApiSession,
  Award,
  AwardQuotas,
  CommitteeType,
  JudgeCommitteeRole,
  Me,
  PublicationSettings,
} from '../data-access/apiTypes';

/**
 * Datos de desarrollo con la forma exacta del contrato (routes.md, secciones 4 y 5).
 * Se usan como estado inicial en memoria de los handlers de MSW (se reinicia al recargar).
 */

const NOW = '2026-09-01T12:00:00Z';

export const CURRENT_ADMIN: Me = {
  user_id: 'usr-admin-1',
  email: 'a.reyes@munych.org',
  role: 'admin',
  full_name: 'Andrea Reyes',
};

/** La jueza simulada es `jdg-andrea` (en el backend, judge_id = user_id). */
export const CURRENT_JUDGE: Me = {
  user_id: 'jdg-andrea',
  email: 'andrea@juez.munych.org',
  role: 'judge',
  full_name: 'Andrea Torres',
};

export const DEFAULT_PUBLICATION_SETTINGS: PublicationSettings = {
  name_format: 'first_name_initial',
  show_institution: true,
  show_ranking: false,
  show_scores: false,
  indexable: false,
};

/** Cupos por defecto según el tipo de comité (routes.md 3.3). */
export const DEFAULT_AWARD_QUOTAS: Record<CommitteeType, AwardQuotas> = {
  general_assembly: { best_delegate: 1, outstanding_delegate: 2, honorable_mention: 2, verbal_commendation: 3 },
  security_council: { best_delegate: 1, outstanding_delegate: 1, honorable_mention: 2, verbal_commendation: 2 },
  crisis: { best_delegate: 1, outstanding_delegate: 1, honorable_mention: 1, verbal_commendation: 2 },
  specialized: { best_delegate: 1, outstanding_delegate: 1, honorable_mention: 2, verbal_commendation: 3 },
};

export const events: ApiEvent[] = [
  {
    id: 'evt-munych-2026',
    slug: 'munych-2026',
    name: 'MUNYCH 2026',
    brand: 'munych',
    logo_url: '/brand/munych-logo.png',
    venue: 'Campus Central, Ciudad de México',
    country_code: 'MX',
    timezone: 'America/Mexico_City',
    starts_on: '2026-03-12',
    ends_on: '2026-03-14',
    status: 'active',
    default_rubric_id: 'rub-estandar-munych',
    created_at: NOW,
    updated_at: null,
  },
  {
    id: 'evt-sdmun-2026',
    slug: 'sd-mun-2026',
    name: 'SD-MUN 2026',
    brand: 'grand_international',
    logo_url: '/brand/munych-logo.png',
    venue: 'Santo Domingo',
    country_code: 'DO',
    timezone: 'America/Santo_Domingo',
    starts_on: '2026-10-09',
    ends_on: '2026-10-11',
    status: 'draft',
    default_rubric_id: 'rub-estandar-sdmun',
    created_at: NOW,
    updated_at: null,
  },
];

function committee(
  id: string,
  eventId: string,
  name: string,
  acronym: string,
  type: CommitteeType,
  delegationMode: 'single' | 'double',
  sessionsCount: number,
): ApiCommittee {
  return {
    id,
    event_id: eventId,
    name,
    acronym,
    slug: acronym.toLowerCase(),
    type,
    delegation_mode: delegationMode,
    sessions_count: sessionsCount,
    rubric_id: null,
    award_quotas: DEFAULT_AWARD_QUOTAS[type],
    created_at: NOW,
  };
}

export const committees: ApiCommittee[] = [
  committee('cmt-cs', 'evt-munych-2026', 'Consejo de Seguridad', 'CS', 'security_council', 'single', 3),
  committee('cmt-disec', 'evt-munych-2026', 'Primera Comisión', 'DISEC', 'general_assembly', 'single', 3),
  committee('cmt-cij', 'evt-munych-2026', 'Corte Internacional de Justicia', 'CIJ', 'specialized', 'double', 2),
];

const COUNTRY_POOL = ['MX', 'US', 'FR', 'DE', 'BR', 'JP', 'IN', 'ZA', 'CA', 'IT', 'EG', 'AR'];

function buildDelegations(committeeId: string, count: number, double: boolean): ApiDelegation[] {
  return Array.from({ length: count }, (_, i) => {
    const delegationId = `${committeeId}-del-${i + 1}`;
    const institution = `Colegio ${i + 1}`;
    const delegate = (suffix: string, n: number): ApiDelegate => ({
      id: `${delegationId}-d${n}`,
      delegation_id: delegationId,
      full_name: `Delegado ${i + 1}${suffix}`,
      institution,
    });
    return {
      id: delegationId,
      committee_id: committeeId,
      country_code: COUNTRY_POOL[i % COUNTRY_POOL.length],
      character_name: null,
      institution,
      delegates: double ? [delegate('A', 1), delegate('B', 2)] : [delegate('', 1)],
    };
  });
}

export const delegations: ApiDelegation[] = [
  ...buildDelegations('cmt-cs', 8, false),
  ...buildDelegations('cmt-disec', 10, false),
  ...buildDelegations('cmt-cij', 6, true),
];

export const judges: ApiJudge[] = [
  { judge_id: 'jdg-andrea', email: 'andrea@juez.munych.org', full_name: 'Andrea Torres', active: true },
  { judge_id: 'jdg-luis', email: 'luis@juez.munych.org', full_name: 'Luis Gómez', active: true },
  { judge_id: 'jdg-mariana', email: 'mariana@juez.munych.org', full_name: 'Mariana Ruiz', active: false },
];

/** Asignaciones tal como las guarda app.committee_judges: solo judge_id + role. */
export const committeeJudges: Record<string, Array<{ judge_id: string; role: JudgeCommitteeRole }>> = {
  'cmt-cs': [
    { judge_id: 'jdg-andrea', role: 'chair' },
    { judge_id: 'jdg-luis', role: 'judge' },
  ],
  'cmt-disec': [{ judge_id: 'jdg-mariana', role: 'moderator' }],
  'cmt-cij': [{ judge_id: 'jdg-andrea', role: 'judge' }],
};

function levels(descriptors: [string, string, string, string]): Record<string, string> {
  return Object.fromEntries(descriptors.map((text, i) => [String(i + 1), text]));
}

function standardCriteria(prefix: string): ApiCriterion[] {
  return [
    {
      id: `${prefix}-conocimiento`,
      name: 'Conocimiento del tema',
      description: 'Dominio del tema y de la postura del país.',
      weight: 30,
      position: 0,
      level_descriptors: levels([
        'No demuestra conocimiento del tema.',
        'Conocimiento básico, con imprecisiones.',
        'Buen conocimiento, argumenta con datos.',
        'Dominio experto, referencias precisas y actualizadas.',
      ]),
    },
    {
      id: `${prefix}-oratoria`,
      name: 'Oratoria',
      description: 'Claridad, fluidez y persuasión al hablar.',
      weight: 25,
      position: 1,
      level_descriptors: levels([
        'Discurso confuso o inaudible.',
        'Se entiende pero con muletillas frecuentes.',
        'Discurso claro y persuasivo.',
        'Oratoria excepcional, cautiva a la sala.',
      ]),
    },
    {
      id: `${prefix}-diplomacia`,
      name: 'Diplomacia',
      description: 'Negociación, alianzas y respeto al protocolo.',
      weight: 25,
      position: 2,
      level_descriptors: levels([
        'No negocia ni respeta el protocolo.',
        'Negocia de forma limitada.',
        'Negocia activamente y respeta el protocolo.',
        'Lidera bloques y negociaciones clave.',
      ]),
    },
    {
      id: `${prefix}-propuestas`,
      name: 'Propuestas',
      description: 'Calidad y viabilidad de las propuestas presentadas.',
      weight: 20,
      position: 3,
      level_descriptors: levels([
        'No presenta propuestas.',
        'Propuestas poco viables.',
        'Propuestas viables y relevantes.',
        'Propuestas innovadoras y de alto impacto.',
      ]),
    },
  ];
}

export function defaultRubric(id: string, eventId: string, name: string): ApiRubric {
  return { id, event_id: eventId, name, scale_min: 1, scale_max: 4, criteria: standardCriteria(id) };
}

export const rubrics: ApiRubric[] = [
  defaultRubric('rub-estandar-munych', 'evt-munych-2026', 'Rúbrica estándar MUNYCH'),
  defaultRubric('rub-estandar-sdmun', 'evt-sdmun-2026', 'Rúbrica estándar'),
];

/** Las sesiones se crean cerradas; aquí la 1 ya se abrió y cerró, y la 2 está abierta. */
export function buildSessions(committeeId: string, count: number, played = true): ApiSession[] {
  return Array.from({ length: count }, (_, i) => {
    const number = i + 1;
    const base: ApiSession = { id: `${committeeId}-ses-${number}`, committee_id: committeeId, number, status: 'closed', opened_at: null, closed_at: null };
    if (!played) return base;
    if (number === 1) return { ...base, opened_at: NOW, closed_at: NOW };
    if (number === 2) return { ...base, status: 'open', opened_at: NOW };
    return base;
  });
}

export const sessionsByCommittee: Record<string, ApiSession[]> = {
  'cmt-cs': buildSessions('cmt-cs', 3),
  'cmt-disec': buildSessions('cmt-disec', 3),
  'cmt-cij': buildSessions('cmt-cij', 2),
};

export const awardsByCommittee: Record<string, Award[]> = {
  'cmt-cs': [
    { award_type: 'best_delegate', delegation_id: 'cmt-cs-del-1', position: 1 },
    { award_type: 'outstanding_delegate', delegation_id: 'cmt-cs-del-2', position: 1 },
    { award_type: 'honorable_mention', delegation_id: 'cmt-cs-del-3', position: 1 },
  ],
  'cmt-disec': [],
  'cmt-cij': [],
};

export const publicationSettingsByEvent: Record<string, PublicationSettings> = {
  'evt-munych-2026': { ...DEFAULT_PUBLICATION_SETTINGS },
  'evt-sdmun-2026': { ...DEFAULT_PUBLICATION_SETTINGS, show_ranking: true },
};

/** Estado de public.public_results por evento. */
export const publicResultsByEvent: Record<string, { published: boolean; version: number }> = {};

/** app.scores en memoria. */
export const judgeScores: Array<{
  client_id: string;
  judge_id: string;
  delegate_id: string;
  session_id: string;
  criterion_id: string;
  value: number;
  comment: string | null;
  client_updated_at: string;
  updated_at: string;
}> = [];
