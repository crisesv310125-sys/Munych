import { http, HttpResponse } from 'msw';
import type { ProblemJson } from '../data-access/apiTypes';
import type {
  EventStaffMember,
  StaffInviteIn,
  StaffAccess,
  StaffAssignAwardIn,
  StaffAward,
  StaffAwardIn,
  StaffAwardPatch,
  StaffAwardSlot,
  StaffCriterion,
  StaffEvaluationIn,
  StaffMe,
  StaffMemberIn,
  StaffMemberPatch,
  StaffMemberRole,
  StaffOverview,
  StaffPerson,
  StaffRanking,
  StaffRankingRow,
  StaffRubricIn,
  StaffTypeDetail,
  StaffTypeIn,
  StaffTypePatch,
  StaffTypeStatus,
  StaffTypeSummary,
} from '../data-access/staffTypes';
import { committees, delegations, events } from './fixtures';

/**
 * Gestión de staff en memoria (misma lógica que `modules/staff/service.py`, simplificada):
 * tipos, miembros, rúbrica, evaluaciones, ranking sugerido y premios.
 */

const BASE = import.meta.env.VITE_API_URL || '/api/v1';
const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function problem(status: number, code: string, detail: string) {
  const body: ProblemJson = { type: 'about:blank', title: code, status, code, detail };
  return HttpResponse.json(body, { status, headers: { 'Content-Type': 'application/problem+json' } });
}

interface MType extends Omit<StaffTypeIn, 'template' | 'awards'> {
  id: string;
  code: string;
  color: string;
  scale_min: number;
  scale_max: number;
  scale_step: number;
  criteria: StaffCriterion[];
  archived: boolean;
}
interface MPerson {
  id: string;
  full_name: string;
  email: string | null;
  title: string | null;
  token: string | null;
  last_used_at: string | null;
}
interface MMember {
  id: string;
  type_id: string;
  person_id: string;
  role: StaffMemberRole;
  committee_ids: string[];
  removed_at: string | null;
  evaluations_count: boolean;
}
interface MEval {
  member_id: string;
  candidate_id: string;
  values: Record<string, number>;
  comment: string | null;
  updated_at: string;
}
interface MAward extends StaffAwardIn {
  id: string;
  type_id: string;
  archived: boolean;
}
interface MAssign {
  award_id: string;
  event_id: string;
  committee_id: string | null;
  position: number;
  candidate_id: string | null;
  override_reason: string | null;
  assigned_at: string | null;
}

const types: MType[] = [];
const people: MPerson[] = [];
/** Evento de contexto de la petición en curso (el staff es de la organización). */
let ctxEvent = '';
const confirmations = new Map<string, string | null>();
const confirmKey = (typeId: string, eventId: string) => `${typeId}:${eventId}`;
const confirmedAt = (t: MType) => confirmations.get(confirmKey(t.id, ctxEvent)) ?? null;
/** ?event_id= o, si no viene, el evento activo más reciente. */
function resolveCtx(request: Request) {
  const asked = new URL(request.url).searchParams.get('event_id');
  const sorted = [...events].sort((a, b) => b.starts_on.localeCompare(a.starts_on));
  ctxEvent = asked || (sorted.find((e) => e.status === 'active') ?? sorted[0])?.id || '';
}
const members: MMember[] = [];
const evals: MEval[] = [];
const awards: MAward[] = [];
const assigns: MAssign[] = [];

const TEMPLATES: Record<string, [string, string, number][]> = {
  press: [
    ['Calidad periodística', 'Relevancia, veracidad y ángulo de las notas publicadas.', 30],
    ['Investigación y fuentes', 'Uso de datos, citas y contraste de fuentes.', 25],
    ['Redacción y estilo', 'Claridad, ortografía y estilo periodístico.', 20],
    ['Cobertura de comités', 'Variedad de comités y momentos cubiertos.', 15],
    ['Puntualidad de entregas', 'Entrega dentro de los cierres de edición.', 10],
  ],
  position_papers: [
    ['Investigación y fundamentación', 'Datos, fuentes y antecedentes del tema.', 30],
    ['Postura del país', 'Coherencia con la política exterior de la delegación.', 25],
    ['Propuestas de solución', 'Viabilidad y originalidad de las propuestas.', 25],
    ['Redacción y formato', 'Estructura, ortografía y formato oficial.', 20],
  ],
  oratory: [
    ['Claridad y dicción', 'Se entiende el mensaje; volumen y ritmo adecuados.', 30],
    ['Argumentación', 'Ideas sólidas, ordenadas y bien sustentadas.', 30],
    ['Lenguaje diplomático', 'Registro formal y respeto al resto de delegaciones.', 20],
    ['Manejo del tiempo', 'Aprovecha y respeta el tiempo concedido.', 20],
  ],
  protocol: [
    ['Conducta y respeto', 'Trato cordial con delegaciones, mesa y staff.', 40],
    ['Apego al protocolo', 'Sigue el reglamento y las normas de sala.', 30],
    ['Trato al staff', 'Colabora con pajes y logística.', 30],
  ],
  blank: [],
};
const PALETTE = ['#418FDE', '#2F6BA8', '#C9A227', '#123B63'];

const sum = (c: StaffCriterion[]) => c.reduce((n, x) => n + x.weight, 0);
const validRubric = (t: MType) => t.criteria.length > 0 && Math.abs(sum(t.criteria) - 100) < 1e-9 && t.criteria.every((c) => c.weight >= 0 && c.weight <= 50);
const evalScore = (t: MType, values: Record<string, number>) => {
  if (!t.criteria.length || t.criteria.some((c) => !(c.id in values))) return null;
  const span = t.scale_max - t.scale_min;
  return t.criteria.reduce((n, c) => n + ((values[c.id] - t.scale_min) / span) * 100 * (c.weight / 100), 0);
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

interface Cand {
  candidate_id: string;
  label: string;
  sublabel: string | null;
  committee_id: string;
  committee_acronym: string;
}
function candidates(t: MType): Cand[] {
  if (!t.evaluates) return [];
  const scope = (t.all_committees ? committees.filter((c) => c.event_id === ctxEvent) : committees.filter((c) => c.event_id === ctxEvent && t.committee_ids.includes(c.id))).map((c) => c.id);
  const acr = (id: string) => committees.find((c) => c.id === id)?.acronym ?? '';
  const ds = delegations.filter((d) => scope.includes(d.committee_id));
  const label = (d: (typeof delegations)[number]) => d.character_name ?? d.country_code ?? '—';
  if (t.evaluates === 'delegates' || t.evaluates === 'press') {
    return ds.flatMap((d) =>
      d.delegates.map((p) => ({ candidate_id: p.id, label: p.full_name, sublabel: label(d), committee_id: d.committee_id, committee_acronym: acr(d.committee_id) })),
    );
  }
  return ds.map((d) => ({ candidate_id: d.id, label: label(d), sublabel: d.institution, committee_id: d.committee_id, committee_acronym: acr(d.committee_id) }));
}
const memberCands = (m: MMember, cs: Cand[]) => (m.committee_ids.length ? cs.filter((c) => m.committee_ids.includes(c.committee_id)) : cs);
const access = (p: MPerson): StaffAccess => (!p.token ? 'not_invited' : p.last_used_at ? 'active' : 'invited');
const committeeRefs = (eventId: string) => committees.filter((c) => c.event_id === eventId).map((c) => ({ id: c.id, name: c.name, acronym: c.acronym }));

function results(t: MType, committeeId: string | null, tiebreak: string | null = null) {
  const counted = new Set(members.filter((m) => m.type_id === t.id && (!m.removed_at || m.evaluations_count)).map((m) => m.id));
  const cs = candidates(t).filter((c) => !committeeId || c.committee_id === committeeId);
  const span = t.scale_max - t.scale_min;
  const rows = cs.map((c) => {
    const mine = evals.filter((e) => counted.has(e.member_id) && e.candidate_id === c.candidate_id);
    const scores = mine.map((e) => evalScore(t, e.values)).filter((s): s is number => s !== null);
    const complete = mine.filter((e) => evalScore(t, e.values) !== null);
    const tb = tiebreak ? mean(complete.map((e) => ((e.values[tiebreak] - t.scale_min) / span) * 100)) : null;
    return { c, score: mean(scores), n: scores.length, tb: tb ?? 0, eligible: scores.length >= t.min_evaluators };
  });
  const key = (r: (typeof rows)[number]) => [r.score === null ? 1 : 0, -(r.score ?? 0), -r.tb] as const;
  const cmp = (a: (typeof rows)[number], b: (typeof rows)[number]) => {
    const [ka, kb] = [key(a), key(b)];
    for (let i = 0; i < 3; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
    return a.c.candidate_id.localeCompare(b.c.candidate_id);
  };
  const eligible = rows.filter((r) => r.eligible).sort(cmp);
  const rest = rows.filter((r) => !r.eligible).sort(cmp);
  let lastPos = 0;
  return [
    ...eligible.map((r, i) => {
      const same = (o?: (typeof rows)[number]) => !!o && key(o).every((v, k) => v === key(r)[k]);
      const pos = i > 0 && same(eligible[i - 1]) ? lastPos : i + 1;
      lastPos = pos;
      return { ...r, position: pos as number | null, tied: same(eligible[i - 1]) || same(eligible[i + 1]) };
    }),
    ...rest.map((r) => ({ ...r, position: null as number | null, tied: false })),
  ];
}

function slotsOf(t: MType, a: MAward): [string | null, number][] {
  const ps = Array.from({ length: a.winners }, (_, i) => i + 1);
  if (a.scope === 'per_committee') {
    const scope = t.all_committees ? committees.filter((c) => c.event_id === ctxEvent).map((c) => c.id) : t.committee_ids.filter((id) => committees.some((c) => c.id === id && c.event_id === ctxEvent));
    return scope.flatMap((cid) => ps.map((p) => [cid, p] as [string, number]));
  }
  return ps.map((p) => [null, p]);
}

function awardOuts(t: MType, withSlots: boolean): StaffAward[] {
  const typeAwards = awards.filter((a) => a.type_id === t.id && !a.archived);
  const ids = new Set(typeAwards.map((a) => a.id));
  const typeAssigns = assigns.filter((a) => ids.has(a.award_id) && a.event_id === ctxEvent);
  const used = new Set(typeAssigns.map((a) => a.candidate_id).filter(Boolean));
  const suggested = new Set<string>();
  const cs = new Map(candidates(t).map((c) => [c.candidate_id, c]));
  const scores = new Map(results(t, null).map((r) => [r.c.candidate_id, r.score]));
  return typeAwards.map((a) => {
    let done = 0;
    const slots: StaffAwardSlot[] = slotsOf(t, a).map(([cid, pos]) => {
      const row = typeAssigns.find((x) => x.award_id === a.id && x.committee_id === cid && x.position === pos);
      const cand = row?.candidate_id ?? null;
      if (cand) done++;
      const sug = results(t, cid, a.tiebreak_criterion_id ?? null).find((r) => r.eligible && !used.has(r.c.candidate_id) && !suggested.has(r.c.candidate_id))?.c.candidate_id ?? null;
      if (!cand && sug) suggested.add(sug);
      return {
        committee_id: cid,
        committee_acronym: cid ? (committees.find((c) => c.id === cid)?.acronym ?? null) : null,
        position: pos,
        candidate_id: cand,
        candidate_label: cand ? (cs.get(cand)?.label ?? null) : null,
        candidate_score: cand ? (scores.get(cand) ?? null) : null,
        suggested_candidate_id: cand ? null : sug,
        suggested_label: !cand && sug ? (cs.get(sug)?.label ?? null) : null,
        suggested_score: !cand && sug ? (scores.get(sug) ?? null) : null,
        override_reason: row?.override_reason ?? null,
        assigned_at: row?.assigned_at ?? null,
      };
    });
    return {
      id: a.id,
      name: a.name,
      winners: a.winners,
      scope: a.scope,
      tiebreak_criterion_id: a.tiebreak_criterion_id ?? null,
      slots_total: slots.length,
      slots_assigned: done,
      slots: withSlots ? slots : [],
    };
  });
}

function summary(t: MType): StaffTypeSummary {
  const cs = candidates(t);
  const ms = members.filter((m) => m.type_id === t.id);
  const active = ms.filter((m) => !m.removed_at);
  let done = 0;
  let expected = 0;
  for (const m of active) {
    const mine = memberCands(m, cs);
    expected += mine.length;
    done += mine.filter((c) => evals.some((e) => e.member_id === m.id && e.candidate_id === c.candidate_id && evalScore(t, e.values) !== null)).length;
  }
  const status: StaffTypeStatus =
    !t.evaluates || active.length === 0 ? 'not_configured' : !validRubric(t) ? 'invalid_rubric' : done === 0 ? 'not_started' : expected && done >= expected ? 'complete' : 'in_progress';
  return {
    id: t.id,
    name: t.name,
    code: t.code,
    color: t.color,
    description: t.description ?? null,
    evaluates: t.evaluates ?? null,
    all_committees: t.all_committees,
    committee_ids: t.committee_ids,
    min_evaluators: t.min_evaluators,
    counts_as: t.counts_as,
    access: t.access ?? 'link',
    criteria_count: t.criteria.length,
    weight_sum: sum(t.criteria),
    rubric_valid: validRubric(t),
    awards: awardOuts(t, false),
    members_count: active.length,
    members_preview: active.slice(0, 4).map((m) => people.find((p) => p.id === m.person_id)!.full_name),
    candidates: cs.length,
    evaluations_done: done,
    evaluations_expected: expected,
    progress: expected ? Math.round((done * 1000) / expected) / 10 : null,
    status,
    awards_confirmed_at: confirmedAt(t),
  };
}

function detail(t: MType): StaffTypeDetail {
  const cs = candidates(t);
  const ms = members.filter((m) => m.type_id === t.id);
  return {
    ...summary(t),
    event_id: ctxEvent || null,
    awards: awardOuts(t, true),
    rubric: { scale_min: t.scale_min, scale_max: t.scale_max, scale_step: t.scale_step, criteria: t.criteria, weight_sum: sum(t.criteria), valid: validRubric(t) },
    members: ms.map((m) => {
      const p = people.find((x) => x.id === m.person_id)!;
      const mine = memberCands(m, cs);
      return {
        id: m.id,
        person_id: p.id,
        full_name: p.full_name,
        email: p.email,
        title: p.title,
        role: m.role,
        committee_ids: m.committee_ids,
        access: access(p),
        evaluated: mine.filter((c) => evals.some((e) => e.member_id === m.id && e.candidate_id === c.candidate_id && evalScore(t, e.values) !== null)).length,
        assigned: mine.length,
        removed_at: m.removed_at,
        evaluations_count: m.evaluations_count,
        other_types: members
          .filter((o) => o.person_id === p.id && o.type_id !== t.id && !o.removed_at)
          .map((o) => types.find((x) => x.id === o.type_id && !x.archived)?.name)
          .filter((n): n is string => !!n),
      };
    }),
    committees: committeeRefs(ctxEvent),
    evaluations_exist: evals.some((e) => ms.some((m) => m.id === e.member_id)),
  };
}

function ranking(t: MType, committeeId: string | null): StaffRanking {
  const outs = awardOuts(t, true);
  const won = new Map<string, string[]>();
  for (const a of outs) for (const s of a.slots) if (s.candidate_id) won.set(s.candidate_id, [...(won.get(s.candidate_id) ?? []), a.name]);
  const rows: StaffRankingRow[] = results(t, committeeId).map((r) => ({
    ...r.c,
    score: r.score === null ? null : Math.round(r.score * 100) / 100,
    evaluations: r.n,
    eligible: r.eligible,
    position: r.position,
    tied: r.tied,
    awards: won.get(r.c.candidate_id) ?? [],
  }));
  return { staff_type_id: t.id, event_id: ctxEvent || null, committee_id: committeeId, min_evaluators: t.min_evaluators, rows, awards: outs, awards_confirmed_at: confirmedAt(t) };
}

function addPerson(full_name: string, email: string | null, title: string | null): MPerson {
  const existing = email ? people.find((p) => p.email === email.toLowerCase()) : undefined;
  if (existing) return existing;
  const p: MPerson = { id: uuid(), full_name, email: email?.toLowerCase() ?? null, title, token: null, last_used_at: null };
  people.push(p);
  return p;
}

function upsertMember(typeId: string, personId: string, role: StaffMemberRole, committee_ids: string[]) {
  const m = members.find((x) => x.type_id === typeId && x.person_id === personId);
  if (m) Object.assign(m, { role, committee_ids, removed_at: null, evaluations_count: true });
  else members.push({ id: uuid(), type_id: typeId, person_id: personId, role, committee_ids, removed_at: null, evaluations_count: true });
}

function createType(body: StaffTypeIn): MType {
  const words = body.name.normalize('NFKD').replace(/[^\w\s]/g, '').split(/\s+/).filter((w) => w && !['y', 'de', 'del', 'la', 'el'].includes(w.toLowerCase()));
  const t: MType = {
    id: uuid(),
    name: body.name,
    code: (body.code || (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? 'ST').slice(0, 2))).toUpperCase(),
    color: body.color || PALETTE[types.length % PALETTE.length],
    description: body.description ?? null,
    evaluates: body.evaluates ?? null,
    all_committees: body.all_committees,
    committee_ids: body.all_committees ? [] : body.committee_ids,
    min_evaluators: body.min_evaluators,
    counts_as: body.counts_as,
    access: body.access ?? 'link',
    scale_min: 0,
    scale_max: 10,
    scale_step: 0.5,
    criteria: (TEMPLATES[body.template] ?? []).map(([name, description, weight], i) => ({ id: `c${i + 1}`, name, description, weight })),
    archived: false,
  };
  types.push(t);
  for (const a of body.awards) awards.push({ ...a, id: uuid(), type_id: t.id, archived: false });
  return t;
}

// ---- Datos de muestra: Prensa con miembros y algunas evaluaciones en el primer evento ----
(function seed() {
  const event = events[0];
  if (!event) return;
  ctxEvent = event.id;
  const press = createType({
    name: 'Prensa',
    description: 'Evalúa artículos y coberturas de los delegados de prensa.',
    evaluates: 'delegates',
    all_committees: true,
    committee_ids: [],
    min_evaluators: 2,
    counts_as: 'none',
    template: 'press',
    awards: [
      { name: 'Mejor periodista', winners: 1, scope: 'event' },
      { name: 'Mención de prensa', winners: 2, scope: 'event' },
    ],
  });
  createType({
    name: 'Mesa Directiva',
    description: 'Presidencias y vicepresidencias de los comités.',
    evaluates: null,
    all_committees: true,
    committee_ids: [],
    min_evaluators: 1,
    counts_as: 'chair',
    access: 'account',
    template: 'blank',
    awards: [],
  });
  const crisis = createType({
    name: 'Crisis',
    description: 'Backroom del gabinete: evalúa directivas y respuesta a eventos.',
    evaluates: 'delegates',
    all_committees: true,
    committee_ids: [],
    min_evaluators: 2,
    counts_as: 'none',
    template: 'blank',
    awards: [{ name: 'Mejor directiva de crisis', winners: 1, scope: 'event' }],
  });
  crisis.criteria = [
    { id: 'c1', name: 'Calidad de la directiva', description: null, weight: 35 },
    { id: 'c2', name: 'Realismo y consecuencias', description: null, weight: 25 },
    { id: 'c3', name: 'Coordinación con el backroom', description: null, weight: 15 },
    { id: 'c4', name: 'Creatividad', description: null, weight: 10 },
  ];
  createType({
    name: 'Fotografía',
    description: 'Cobertura visual del evento.',
    evaluates: null,
    all_committees: true,
    committee_ids: [],
    min_evaluators: 1,
    counts_as: 'none',
    template: 'blank',
    awards: [],
  });
  const roster: [string, string | null, StaffMemberRole][] = [
    ['Valeria Gómez', 'valeria.gomez@munych.org', 'coordinator'],
    ['Rodrigo Salas', 'rodrigo.salas@munych.org', 'evaluator'],
    ['Camila Ortega', 'camila.o@example.com', 'evaluator'],
    ['Mateo Ibarra', null, 'evaluator'],
  ];
  roster.forEach(([name, email, role], i) => {
    const p = addPerson(name, email, i === 0 ? 'Coordinadora de prensa' : null);
    if (i < 2) {
      p.token = `mock-staff-token-${i}-0123456789abcdef`;
      p.last_used_at = i === 0 ? now() : null;
    }
    upsertMember(press.id, p.id, role, []);
  });
  const cs = candidates(press).slice(0, 5);
  const [m1, m2] = members.filter((m) => m.type_id === press.id);
  cs.forEach((c, i) => {
    const v = (base: number) => Object.fromEntries(press.criteria.map((k, j) => [k.id, Math.max(0, Math.min(10, base - ((i + j) % 3) * 0.5))]));
    evals.push({ member_id: m1.id, candidate_id: c.candidate_id, values: v(9.5 - i * 0.5), comment: null, updated_at: now() });
    if (i < 3) evals.push({ member_id: m2.id, candidate_id: c.candidate_id, values: v(9 - i * 0.5), comment: null, updated_at: now() });
  });
})();

// ---- Rutas ----

const typeOr404 = (id: unknown) => types.find((t) => t.id === id && !t.archived);
const awardOr404 = (id: unknown) => awards.find((a) => a.id === id && !a.archived);
const personByToken = (request: Request) => {
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  return people.find((p) => p.token && p.token === token);
};

export const staffHandlers = [
  // ---- Personas del evento: invitar con rol y staff con QR ----
  http.get(`${BASE}/events/:eventId/staff-members`, () => {
    const list: EventStaffMember[] = members
      .filter((m) => !m.removed_at)
      .map((m) => ({ m, t: types.find((x) => x.id === m.type_id && !x.archived), p: people.find((x) => x.id === m.person_id)! }))
      .filter((x): x is { m: MMember; t: MType; p: MPerson } => !!x.t)
      .map(({ m, t, p }) => ({
        member_id: m.id,
        person_id: p.id,
        full_name: p.full_name,
        email: p.email,
        title: p.title,
        staff_type_id: t.id,
        staff_type: t.name,
        code: t.code,
        color: t.color,
        access_mode: t.access ?? 'link',
        role: m.role,
        committee_ids: m.committee_ids,
        access: access(p),
      }));
    return HttpResponse.json(list);
  }),

  http.post(`${BASE}/events/:eventId/invitations`, async ({ request }) => {
    const body = (await request.json()) as StaffInviteIn;
    const base = { email: body.email.toLowerCase(), full_name: body.full_name, emailed: true, url: null };
    if (body.role === 'judge') return HttpResponse.json({ ...base, kind: 'judge', staff_type: null }, { status: 201 });
    const t = typeOr404(body.staff_type_id);
    if (!t) return problem(404, 'NOT_FOUND', 'Tipo de staff no encontrado');
    if (t.access === 'account' && body.committee_ids.length === 0) return problem(422, 'VALIDATION_ERROR', `Elige el comité de ${t.name}`);
    const p = addPerson(body.full_name, body.email, body.title ?? null);
    upsertMember(t.id, p.id, body.member_role ?? 'evaluator', body.committee_ids);
    if (t.access === 'account') return HttpResponse.json({ ...base, kind: 'account', staff_type: t.name }, { status: 201 });
    p.token = uuid().replace(/-/g, '');
    p.last_used_at = null;
    return HttpResponse.json(
      { ...base, kind: 'link', staff_type: t.name, url: `${location.origin}/#/staff/evaluar/${p.token}` },
      { status: 201 },
    );
  }),

  http.post(`${BASE}/staff-members/:memberId/access`, ({ params }) => {
    const m = members.find((x) => x.id === params.memberId);
    const p = m && people.find((x) => x.id === m.person_id);
    const t = m && types.find((x) => x.id === m.type_id);
    if (!m || !p || !t) return problem(404, 'NOT_FOUND', 'Miembro no encontrado');
    if (!p.email) return problem(409, 'CONFLICT', 'Esta persona no tiene correo registrado');
    p.token = uuid().replace(/-/g, '');
    p.last_used_at = null;
    return HttpResponse.json({
      kind: 'link',
      email: p.email,
      full_name: p.full_name,
      staff_type: t.name,
      emailed: true,
      url: `${location.origin}/#/staff/evaluar/${p.token}`,
    });
  }),

  http.get(`${BASE}/staff`, ({ request }) => {
    resolveCtx(request);
    const event = events.find((e) => e.id === ctxEvent);
    const list = types.filter((t) => !t.archived).map(summary);
    const configured = list.filter((s) => s.status !== 'not_configured');
    const done = configured.reduce((n, s) => n + s.evaluations_done, 0);
    const expected = configured.reduce((n, s) => n + s.evaluations_expected, 0);
    const activePeople = new Set(members.filter((m) => !m.removed_at && list.some((t) => t.id === m.type_id)).map((m) => m.person_id));
    const weights: Record<string, [number | null, number | null]> = { judges_only: [null, null], mun_regular: [20, 30], national_championship: [10, 15] };
    const [staff_weight, chair_weight] = (event && weights[event.event_type]) ?? [null, null];
    const out: StaffOverview = {
      organization_name: 'MUNYCH Association',
      events: [...events]
        .sort((a, b) => b.starts_on.localeCompare(a.starts_on))
        .map((e) => ({ id: e.id, name: e.name, status: e.status, event_type: e.event_type, starts_on: e.starts_on })),
      event_id: event?.id ?? null,
      event_name: event?.name ?? null,
      event_type: event?.event_type ?? null,
      staff_weight,
      chair_weight,
      types: list,
      people: activePeople.size,
      people_active: [...activePeople].filter((id) => access(people.find((p) => p.id === id)!) === 'active').length,
      awards_total: list.reduce((n, s) => n + s.awards.reduce((k, a) => k + a.slots_total, 0), 0),
      awards_assigned: list.reduce((n, s) => n + s.awards.reduce((k, a) => k + a.slots_assigned, 0), 0),
      progress: expected ? Math.round((done * 1000) / expected) / 10 : null,
    };
    return HttpResponse.json(out);
  }),

  http.post(`${BASE}/staff-types`, async ({ request }) => {
    resolveCtx(request);
    const body = (await request.json()) as StaffTypeIn;
    if (types.some((t) => !t.archived && t.name.toLowerCase() === body.name.trim().toLowerCase())) {
      return problem(409, 'CONFLICT', `Ya existe un tipo de staff llamado «${body.name.trim()}»`);
    }
    return HttpResponse.json(detail(createType({ ...body, name: body.name.trim() })), { status: 201 });
  }),

  http.get(`${BASE}/staff-types/:typeId`, ({ params, request }) => {
    resolveCtx(request);
    const t = typeOr404(params.typeId);
    return t ? HttpResponse.json(detail(t)) : problem(404, 'NOT_FOUND', 'Tipo de staff no encontrado');
  }),

  http.patch(`${BASE}/staff-types/:typeId`, async ({ params, request }) => {
    resolveCtx(request);
    const t = typeOr404(params.typeId);
    if (!t) return problem(404, 'NOT_FOUND', 'Tipo de staff no encontrado');
    const body = (await request.json()) as StaffTypePatch;
    if (body.archived) {
      t.archived = true;
      return HttpResponse.json(detail(t));
    }
    Object.assign(t, Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined)));
    if (t.all_committees) t.committee_ids = [];
    return HttpResponse.json(detail(t));
  }),

  http.put(`${BASE}/staff-types/:typeId/rubric`, async ({ params, request }) => {
    resolveCtx(request);
    const t = typeOr404(params.typeId);
    if (!t) return problem(404, 'NOT_FOUND', 'Tipo de staff no encontrado');
    const body = (await request.json()) as StaffRubricIn;
    const total = body.criteria.reduce((n, c) => n + c.weight, 0);
    if (Math.abs(total - 100) > 1e-9) return problem(422, 'WEIGHTS_MUST_SUM_100', `Los pesos suman ${total} %; deben sumar 100 %`);
    const hasEvals = evals.some((e) => members.some((m) => m.id === e.member_id && m.type_id === t.id));
    if (hasEvals && (body.scale_min !== t.scale_min || body.scale_max !== t.scale_max || body.scale_step !== t.scale_step)) {
      return problem(409, 'CONFLICT', 'No se puede cambiar la escala: ya hay evaluaciones con la escala actual');
    }
    const known = new Set(t.criteria.map((c) => c.id));
    Object.assign(t, {
      scale_min: body.scale_min,
      scale_max: body.scale_max,
      scale_step: body.scale_step,
      criteria: body.criteria.map((c) => ({ id: c.id && known.has(c.id) ? c.id : `c${uuid().slice(0, 8)}`, name: c.name, description: c.description ?? null, weight: c.weight })),
    });
    return HttpResponse.json(detail(t));
  }),

  http.get(`${BASE}/staff-people`, () => {
    const list: StaffPerson[] = people.map((p) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      title: p.title,
      access: access(p),
      types: members.filter((m) => m.person_id === p.id && !m.removed_at).map((m) => types.find((t) => t.id === m.type_id && !t.archived)?.name).filter((n): n is string => !!n),
      source: 'staff' as const,
    }));
    return HttpResponse.json(list);
  }),

  http.post(`${BASE}/staff-types/:typeId/members`, async ({ params, request }) => {
    resolveCtx(request);
    const t = typeOr404(params.typeId);
    if (!t) return problem(404, 'NOT_FOUND', 'Tipo de staff no encontrado');
    const body = (await request.json()) as StaffMemberIn;
    let personId = body.person_id ?? null;
    if (!personId && body.person) personId = addPerson(body.person.full_name, body.person.email ?? null, body.person.title ?? null).id;
    if (!personId || !people.some((p) => p.id === personId)) return problem(404, 'NOT_FOUND', 'Persona no encontrada en la organización');
    upsertMember(t.id, personId, body.role, body.committee_ids);
    return HttpResponse.json(detail(t), { status: 201 });
  }),

  http.patch(`${BASE}/staff-members/:memberId`, async ({ params, request }) => {
    resolveCtx(request);
    const m = members.find((x) => x.id === params.memberId);
    if (!m) return problem(404, 'NOT_FOUND', 'Miembro no encontrado');
    const body = (await request.json()) as StaffMemberPatch;
    if (body.role) m.role = body.role;
    if (body.committee_ids) m.committee_ids = body.committee_ids;
    if (body.evaluations_count !== undefined) m.evaluations_count = body.evaluations_count;
    if (body.restore) Object.assign(m, { removed_at: null, evaluations_count: true });
    return HttpResponse.json(detail(types.find((t) => t.id === m.type_id)!));
  }),

  http.post(`${BASE}/staff-members/:memberId/remove`, ({ params, request }) => {
    resolveCtx(request);
    const m = members.find((x) => x.id === params.memberId);
    if (!m) return problem(404, 'NOT_FOUND', 'Miembro no encontrado');
    m.removed_at ??= now();
    return HttpResponse.json(detail(types.find((t) => t.id === m.type_id)!));
  }),

  http.patch(`${BASE}/staff-people/:personId`, async ({ params, request }) => {
    const p = people.find((x) => x.id === params.personId);
    if (!p) return problem(404, 'NOT_FOUND', 'Persona no encontrada');
    const body = (await request.json()) as Partial<MPerson>;
    if (body.full_name) p.full_name = body.full_name;
    if ('email' in body) p.email = body.email ? body.email.toLowerCase() : null;
    if ('title' in body) p.title = body.title ?? null;
    return HttpResponse.json({ id: p.id, full_name: p.full_name, email: p.email, title: p.title, access: access(p), types: [], source: 'staff' });
  }),

  http.post(`${BASE}/staff-people/:personId/link`, async ({ params, request }) => {
    const p = people.find((x) => x.id === params.personId);
    if (!p) return problem(404, 'NOT_FOUND', 'Persona no encontrada');
    const { link_base } = (await request.json()) as { link_base: string };
    p.token = uuid().replace(/-/g, '');
    p.last_used_at = null;
    return HttpResponse.json({ person_id: p.id, full_name: p.full_name, email: p.email, token: p.token, url: `${link_base}${p.token}`, expires_at: now() });
  }),

  http.get(`${BASE}/staff-types/:typeId/ranking`, ({ params, request }) => {
    resolveCtx(request);
    const t = typeOr404(params.typeId);
    if (!t) return problem(404, 'NOT_FOUND', 'Tipo de staff no encontrado');
    return HttpResponse.json(ranking(t, new URL(request.url).searchParams.get('committee_id')));
  }),

  http.post(`${BASE}/staff-types/:typeId/awards`, async ({ params, request }) => {
    resolveCtx(request);
    const t = typeOr404(params.typeId);
    if (!t) return problem(404, 'NOT_FOUND', 'Tipo de staff no encontrado');
    awards.push({ ...((await request.json()) as StaffAwardIn), id: uuid(), type_id: t.id, archived: false });
    return HttpResponse.json(detail(t), { status: 201 });
  }),

  http.patch(`${BASE}/staff-awards/:awardId`, async ({ params, request }) => {
    resolveCtx(request);
    const a = awardOr404(params.awardId);
    if (!a) return problem(404, 'NOT_FOUND', 'Premio no encontrado');
    const t = types.find((x) => x.id === a.type_id)!;
    const body = (await request.json()) as StaffAwardPatch;
    if (body.archived) a.archived = true;
    Object.assign(a, Object.fromEntries(Object.entries(body).filter(([k, v]) => k !== 'archived' && v !== undefined)));
    return HttpResponse.json(detail(t));
  }),

  http.put(`${BASE}/staff-awards/:awardId/assignment`, async ({ params, request }) => {
    const a = awardOr404(params.awardId);
    if (!a) return problem(404, 'NOT_FOUND', 'Premio no encontrado');
    const t = types.find((x) => x.id === a.type_id)!;
    const body = (await request.json()) as StaffAssignAwardIn;
    ctxEvent = body.event_id;
    if (confirmedAt(t)) return problem(409, 'CONFLICT', 'Los premios de este staff ya se confirmaron en este evento. Reábrelos para cambiarlos');
    const row = assigns.find(
      (x) => x.award_id === a.id && x.event_id === body.event_id && x.committee_id === body.committee_id && x.position === body.position,
    );
    const values = { candidate_id: body.candidate_id, override_reason: body.override_reason ?? null, assigned_at: body.candidate_id ? now() : null };
    if (row) Object.assign(row, values);
    else assigns.push({ award_id: a.id, event_id: body.event_id, committee_id: body.committee_id, position: body.position, ...values });
    return HttpResponse.json(ranking(t, a.scope === 'per_committee' ? body.committee_id : null));
  }),

  http.post(`${BASE}/staff-types/:typeId/awards/confirm`, async ({ params, request }) => {
    const t = typeOr404(params.typeId);
    if (!t) return problem(404, 'NOT_FOUND', 'Tipo de staff no encontrado');
    const { confirmed, event_id } = (await request.json()) as { confirmed: boolean; event_id: string };
    ctxEvent = event_id;
    if (confirmed) {
      const missing = awardOuts(t, false).reduce((n, a) => n + a.slots_total - a.slots_assigned, 0);
      if (missing) return problem(409, 'CONFLICT', `Falta asignar ${missing} premio${missing === 1 ? '' : 's'}`);
    }
    confirmations.set(confirmKey(t.id, event_id), confirmed ? now() : null);
    return HttpResponse.json(detail(t));
  }),

  http.get(`${BASE}/staff/me`, ({ request }) => {
    const p = personByToken(request);
    if (!p) return problem(401, 'UNAUTHORIZED', 'Tu enlace no es válido o ya venció. Pide uno nuevo a la coordinación del evento');
    p.last_used_at = now();
    const mine = members
      .filter((m) => m.person_id === p.id && !m.removed_at)
      .map((m) => ({ m, t: types.find((x) => x.id === m.type_id && !x.archived) }))
      .filter((x): x is { m: MMember; t: MType } => !!x.t);
    const assignments: StaffMe['assignments'] = [];
    for (const event of events.filter((e) => e.status !== 'closed')) {
      ctxEvent = event.id;
      for (const { m, t } of mine) {
        const cands = memberCands(m, candidates(t));
        if (t.evaluates && cands.length === 0) continue;
        const reason = !t.evaluates
          ? 'Este staff todavía no está configurado.'
          : !validRubric(t)
            ? 'La rúbrica de este staff todavía no está lista.'
            : confirmedAt(t)
              ? 'Los premios de este staff ya se confirmaron en este evento.'
              : null;
        assignments.push({
          member_id: m.id,
          event_id: event.id,
          event_name: event.name,
          staff_type_id: t.id,
          name: t.name,
          code: t.code,
          color: t.color,
          role: m.role,
          evaluates: t.evaluates ?? null,
          open: reason === null,
          closed_reason: reason,
          scale_min: t.scale_min,
          scale_max: t.scale_max,
          scale_step: t.scale_step,
          criteria: t.criteria,
          candidates: cands.map((c) => {
            const e = evals.find((x) => x.member_id === m.id && x.candidate_id === c.candidate_id);
            return { ...c, values: e?.values ?? {}, comment: e?.comment ?? null, complete: !!e && evalScore(t, e.values) !== null, updated_at: e?.updated_at ?? null };
          }),
        });
      }
    }
    const me: StaffMe = { full_name: p.full_name, title: p.title, organization_name: 'MUNYCH Association', assignments };
    return HttpResponse.json(me);
  }),

  http.put(`${BASE}/staff/evaluations`, async ({ request }) => {
    const p = personByToken(request);
    if (!p) return problem(401, 'UNAUTHORIZED', 'Tu enlace no es válido o ya venció.');
    const body = (await request.json()) as StaffEvaluationIn;
    const m = members.find((x) => x.id === body.member_id && x.person_id === p.id && !x.removed_at);
    const t = m && types.find((x) => x.id === m.type_id);
    if (!m || !t) return problem(403, 'FORBIDDEN', 'No perteneces a este staff');
    for (const v of Object.values(body.values)) {
      if (v < t.scale_min || v > t.scale_max) return problem(422, 'VALUE_OUT_OF_RANGE', `El valor debe estar entre ${t.scale_min} y ${t.scale_max}`);
    }
    let e = evals.find((x) => x.member_id === m.id && x.candidate_id === body.candidate_id);
    if (!e) {
      e = { member_id: m.id, candidate_id: body.candidate_id, values: {}, comment: null, updated_at: now() };
      evals.push(e);
    }
    Object.assign(e, { values: body.values, comment: body.comment ?? null, updated_at: now() });
    return HttpResponse.json({ candidate_id: e.candidate_id, values: e.values, comment: e.comment, complete: evalScore(t, e.values) !== null, updated_at: e.updated_at });
  }),
];
