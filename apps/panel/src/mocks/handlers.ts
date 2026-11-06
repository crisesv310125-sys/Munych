import { http, HttpResponse } from 'msw';
import type {
  ApiCommittee,
  ApiCriterion,
  ApiDelegation,
  ApiEvent,
  ApiJudgeInvitation,
  ApiRubric,
  Award,
  AwardType,
  AwardsResponse,
  CommitteeDraft,
  CommitteeJudgeAssignment,
  CommitteeJudgeAssignmentOut,
  DelegationDraft,
  DelegationImportResult,
  Ballot,
  EventDraft,
  EventType,
  EventUpdate,
  GeneratedVoterToken,
  GenerateVoterTokensIn,
  IncompleteFlag,
  JudgeCommitteeRole,
  VoterAccess,
  VoterRole,
  JudgeCommitteeDetail,
  JudgeCommitteeSummary,
  JudgeScore,
  ProblemJson,
  PublicationSettings,
  PublicResultsDocument,
  RankingEntry,
  RubricIn,
  ScoreBatchItem,
  ScoreBatchResponse,
} from '../data-access/apiTypes';
import {
  awardsByCommittee,
  buildSessions,
  committeeJudges,
  committees,
  CURRENT_ADMIN,
  CURRENT_JUDGE,
  DEFAULT_AWARD_QUOTAS,
  DEFAULT_PUBLICATION_SETTINGS,
  defaultRubric,
  delegations,
  events,
  judges,
  judgeScores,
  publicationSettingsByEvent,
  publicResultsByEvent,
  rubrics,
  sessionsByCommittee,
} from './fixtures';

/**
 * Emulación en memoria del backend descrito en routes.md: mismas rutas, mismas formas y los
 * mismos códigos de error (problem+json) para las reglas que el panel puede disparar.
 */

// La misma base que apiClient.ts, para que los mocks intercepten aunque VITE_API_URL apunte al backend real.
const BASE = import.meta.env.VITE_API_URL || '/api/v1';
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Invitaciones pendientes (jueces que aún no abren el enlace): no salen en GET /judges.
const judgeInvitations: ApiJudgeInvitation[] = [];

function problem(status: number, code: string, detail: string) {
  const body: ProblemJson = { type: 'about:blank', title: code, status, code, detail };
  return HttpResponse.json(body, { status, headers: { 'Content-Type': 'application/problem+json' } });
}

const notFound = (detail = 'No se encontró el recurso.') => problem(404, 'NOT_FOUND', detail);
const noContent = () => new HttpResponse(null, { status: 204 });
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const avg = (values: number[]) => (values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Page<T> con ?limit= (1–200, 50 por defecto) y ?offset=. */
function page<T>(request: Request, items: T[]) {
  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 50)));
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0));
  return HttpResponse.json({ items: items.slice(offset, offset + limit), total: items.length });
}

// ---- Búsquedas ----

const findEvent = (id: unknown) => events.find((e) => e.id === id);
const findCommittee = (id: unknown) => committees.find((c) => c.id === id);
const eventOfCommittee = (c: ApiCommittee) => findEvent(c.event_id)!;
const isEventClosed = (eventId: string) => findEvent(eventId)?.status === 'closed';
const committeeDelegations = (committeeId: string) => delegations.filter((d) => d.committee_id === committeeId);
const allSessions = () => Object.values(sessionsByCommittee).flat();

// Como app.event_judges: a qué eventos pertenece cada juez (se siembra con las asignaciones).
const judgeEvents = new Map<string, Set<string>>();
function linkJudgeToEvent(judgeId: string, eventId: string) {
  judgeEvents.set(judgeId, (judgeEvents.get(judgeId) ?? new Set()).add(eventId));
}
Object.entries(committeeJudges).forEach(([committeeId, assignments]) => {
  const committee = findCommittee(committeeId);
  if (committee) assignments.forEach((a) => linkJudgeToEvent(a.judge_id, committee.event_id));
});

/** Filtro ?event_id= de GET /judges y GET /judges/invitations. */
function inEventFilter(request: Request) {
  const eventId = new URL(request.url).searchParams.get('event_id');
  return (j: { judge_id: string }) => !eventId || (judgeEvents.get(j.judge_id)?.has(eventId) ?? false);
}

function rubricForCommittee(c: ApiCommittee): ApiRubric | undefined {
  const rubricId = c.rubric_id ?? eventOfCommittee(c).default_rubric_id;
  return rubrics.find((r) => r.id === rubricId);
}

function findDelegate(delegateId: string) {
  for (const delegation of delegations) {
    const delegate = delegation.delegates.find((d) => d.id === delegateId);
    if (delegate) return { delegation, delegate };
  }
  return undefined;
}

function currentMockIdentity() {
  try {
    const raw = localStorage.getItem('munych.mock-session');
    if (!raw) return CURRENT_ADMIN;
    const session = JSON.parse(raw) as { role: 'admin' | 'judge'; email: string };
    return session.role === 'judge' ? { ...CURRENT_JUDGE, email: session.email } : { ...CURRENT_ADMIN, email: session.email };
  } catch {
    return CURRENT_ADMIN;
  }
}

function assignmentsOut(committeeId: string): CommitteeJudgeAssignmentOut[] {
  return (committeeJudges[committeeId] ?? []).flatMap((a) => {
    const judge = judges.find((j) => j.judge_id === a.judge_id);
    return judge ? [{ judge_id: a.judge_id, role: a.role, full_name: judge.full_name, email: judge.email, active: judge.active }] : [];
  });
}

// ---- Tipos de evento y votación de delegados (ADR-005) ----

/** Igual que EVENT_TYPES del backend (shared/kernel/catalog.py). */
const ROLE_WEIGHTS: Record<EventType, Partial<Record<VoterRole, number>>> = {
  judges_only: { judge: 100 },
  mun_regular: { chair: 30, delegate: 50, staff: 20 },
  national_championship: { judge: 50, chair: 15, delegate: 25, staff: 10 },
};

function accountVoterRole(weights: Partial<Record<VoterRole, number>>, role: JudgeCommitteeRole | undefined): VoterRole | null {
  let voter: VoterRole = 'judge';
  if (Object.keys(weights).length > 1) {
    if (role === 'chair' || role === 'moderator') voter = 'chair';
    else if (role === 'staff') voter = 'staff';
  }
  return voter in weights ? voter : null;
}

interface MockVoterToken {
  delegate_id: string;
  event_id: string;
  issued_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
}
/** token en claro → acceso (en el backend solo se guarda el hash). */
const voterTokens = new Map<string, MockVoterToken>();
const delegateVotes: Array<{ voter_delegate_id: string; delegation_id: string; session_id: string; criterion_id: string; value: number }> = [];

// ---- Motor de ranking (routes.md 3.7) ----

function computeRanking(committeeId: string): RankingEntry[] {
  const committee = findCommittee(committeeId);
  const rubric = committee && rubricForCommittee(committee);
  if (!committee || !rubric) return [];
  const sessions = sessionsByCommittee[committeeId] ?? [];
  const topCriterion = [...rubric.criteria].sort((a, b) => b.weight - a.weight)[0];

  const weights = ROLE_WEIGHTS[eventOfCommittee(committee).event_type];
  const assignedRole = new Map((committeeJudges[committeeId] ?? []).map((a) => [a.judge_id, a.role]));
  const roleOf = (judgeId: string) => accountVoterRole(weights, assignedRole.get(judgeId));
  /** Nota 0-100 de un evaluador sobre una rúbrica completa; null si le falta algún criterio. */
  const weighted = (values: Array<{ criterion_id: string; value: number }>) =>
    values.length < rubric.criteria.length
      ? null
      : rubric.criteria.reduce((sum, c) => sum + ((values.find((s) => s.criterion_id === c.id)?.value ?? 0) / rubric.scale_max) * c.weight, 0);
  /** Media de evaluadores por sesión → media de sesiones (mismo método para cada rol). */
  const roleScore = (votes: Array<{ voter: string; session_id: string; criterion_id: string; value: number }>) => {
    const perSession = sessions.map((session) => {
      const inSession = votes.filter((v) => v.session_id === session.id);
      return avg(
        [...new Set(inSession.map((v) => v.voter))]
          .map((voter) => weighted(inSession.filter((v) => v.voter === voter)))
          .filter((x): x is number => x !== null),
      );
    });
    return avg(perSession.filter((x): x is number => x !== null));
  };
  const combine = (byRole: Partial<Record<VoterRole, number | null>>) => {
    const present = (Object.entries(byRole) as Array<[VoterRole, number | null]>).filter((e): e is [VoterRole, number] => e[1] !== null);
    const total = present.reduce((s, [role]) => s + (weights[role] ?? 0), 0);
    return present.length === 0 || total === 0 ? null : present.reduce((s, [role, v]) => s + (weights[role] ?? 0) * v, 0) / total;
  };

  const entries = committeeDelegations(committeeId).map((delegation) => {
    const flags: IncompleteFlag[] = [];
    const roleScores: Partial<Record<VoterRole, number | null>> = {};
    for (const role of Object.keys(weights) as VoterRole[]) {
      if (role === 'delegate') {
        roleScores[role] = roleScore(
          delegateVotes.filter((v) => v.delegation_id === delegation.id).map((v) => ({ ...v, voter: v.voter_delegate_id })),
        );
      } else {
        const perDelegate = delegation.delegates.map((delegate) =>
          roleScore(
            judgeScores
              .filter((s) => s.delegate_id === delegate.id && roleOf(s.judge_id) === role)
              .map((s) => ({ ...s, voter: s.judge_id })),
          ),
        );
        roleScores[role] = avg(perDelegate.filter((x): x is number => x !== null));
      }
      if (roleScores[role] !== null && roleScores[role] !== undefined) roleScores[role] = round2(roleScores[role]!);
    }
    const delegateScores = delegation.delegates.map((delegate) => {
      const mine = judgeScores.filter((s) => s.delegate_id === delegate.id);
      if (mine.length === 0) flags.push({ kind: 'delegate_without_scores', delegate_id: delegate.id, session_number: null, judge_id: null });
      const sessionScores: number[] = [];
      for (const session of sessions) {
        const inSession = mine.filter((s) => s.session_id === session.id);
        const judgeIds = [...new Set(inSession.map((s) => s.judge_id))];
        const judgeTotals: number[] = [];
        for (const judgeId of judgeIds) {
          const byJudge = inSession.filter((s) => s.judge_id === judgeId);
          if (byJudge.length < rubric.criteria.length) {
            flags.push({ kind: 'incomplete', delegate_id: delegate.id, session_number: session.number, judge_id: judgeId });
            continue;
          }
          // Nota ponderada: Σ (value / scale_max) × weight.
          judgeTotals.push(rubric.criteria.reduce((sum, c) => sum + ((byJudge.find((s) => s.criterion_id === c.id)?.value ?? 0) / rubric.scale_max) * c.weight, 0));
        }
        const sessionScore = avg(judgeTotals);
        if (sessionScore !== null) sessionScores.push(sessionScore);
        else if (session.opened_at && mine.length > 0) {
          flags.push({ kind: 'session_without_scores', delegate_id: delegate.id, session_number: session.number, judge_id: null });
        }
      }
      const final = avg(sessionScores);
      return { delegate, final: final === null ? null : round2(final), scores: mine };
    });

    const finals = delegateScores.map((d) => d.final).filter((f): f is number => f !== null);
    const allScores = delegateScores.flatMap((d) => d.scores);
    const criteriaAverages: Record<string, number | null> = {};
    for (const c of rubric.criteria) {
      const value = avg(allScores.filter((s) => s.criterion_id === c.id).map((s) => s.value));
      criteriaAverages[c.id] = value === null ? null : round2(value);
    }
    // Solo jueces: la media de siempre. Con varios roles: suma ponderada por rol.
    const score = Object.keys(weights).length > 1 ? combine(roleScores) : avg(finals);
    return {
      delegation,
      score: score === null ? null : round2(score),
      tiebreak: topCriterion ? (criteriaAverages[topCriterion.id] ?? -1) : -1,
      criteriaAverages,
      roleScores,
      flags,
      delegates: delegateScores.map((d) => ({ delegate_id: d.delegate.id, full_name: d.delegate.full_name, final_score: d.final })),
    };
  });

  // Sin notas al final; desempate por la media del criterio de mayor peso.
  entries.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.tiebreak - a.tiebreak);

  const result: RankingEntry[] = [];
  entries.forEach((entry, i) => {
    const prev = entries[i - 1];
    const tiedWithPrev = !!prev && prev.score !== null && prev.score === entry.score && prev.tiebreak === entry.tiebreak;
    const position = tiedWithPrev ? result[i - 1].position : i + 1;
    if (tiedWithPrev) result[i - 1].tied = true;
    result.push({
      position,
      tied: tiedWithPrev,
      delegation_id: entry.delegation.id,
      country_code: entry.delegation.country_code,
      character_name: entry.delegation.character_name,
      institution: entry.delegation.institution,
      delegates: entry.delegates,
      score: entry.score,
      criteria_averages: entry.criteriaAverages,
      incomplete_flags: entry.flags,
      role_scores: Object.keys(weights).length > 1 ? entry.roleScores : { judge: entry.score },
    });
  });
  return result;
}

const AWARD_LABEL: Record<AwardType, string> = {
  best_delegate: 'Mejor delegado',
  outstanding_delegate: 'Delegado sobresaliente',
  honorable_mention: 'Mención honorífica',
  verbal_commendation: 'Mención verbal',
};

function awardsOut(committeeId: string): AwardsResponse {
  const committee = findCommittee(committeeId)!;
  const items = awardsByCommittee[committeeId] ?? [];
  const quota_warnings = (Object.keys(AWARD_LABEL) as AwardType[]).flatMap((type) => {
    const quota = committee.award_quotas[type] ?? 0;
    const count = items.filter((a) => a.award_type === type).length;
    return count > quota ? [`${AWARD_LABEL[type]}: ${count} asignados, cupo ${quota}.`] : [];
  });
  return { items, quota_warnings };
}

// ---- Documento público (routes.md 4, "Publicación") ----

function formatName(fullName: string, format: PublicationSettings['name_format']): string {
  if (format === 'full') return fullName;
  const [first, ...rest] = fullName.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[0][0]}.` : first;
}

function buildPublicDocument(event: ApiEvent): PublicResultsDocument {
  const settings = publicationSettingsByEvent[event.id] ?? DEFAULT_PUBLICATION_SETTINGS;
  const names = (delegation: ApiDelegation | undefined) =>
    settings.name_format === 'hidden' ? [] : (delegation?.delegates ?? []).map((d) => formatName(d.full_name, settings.name_format));
  const publicDelegation = (d: { country_code: string | null; character_name: string | null; institution: string | null } | undefined) => ({
    country_code: d?.country_code ?? null,
    character_name: d?.character_name ?? null,
    institution: settings.show_institution ? (d?.institution ?? null) : null,
  });
  return {
    event: {
      slug: event.slug,
      name: event.name,
      brand: event.brand,
      logo_url: event.logo_url,
      venue: event.venue,
      starts_on: event.starts_on,
      ends_on: event.ends_on,
      timezone: event.timezone,
    },
    settings,
    committees: committees
      .filter((c) => c.event_id === event.id)
      .map((c) => ({
        slug: c.slug,
        name: c.name,
        acronym: c.acronym,
        type: c.type,
        awards: (awardsByCommittee[c.id] ?? []).map((a) => {
          const delegation = delegations.find((d) => d.id === a.delegation_id);
          return { award_type: a.award_type, position: a.position, delegation: publicDelegation(delegation), delegates: names(delegation) };
        }),
        ranking: settings.show_ranking
          ? computeRanking(c.id).map((r) => ({
              position: r.position,
              delegation: publicDelegation(r),
              delegates: names(delegations.find((d) => d.id === r.delegation_id)),
              score: settings.show_scores ? r.score : null,
            }))
          : null,
      })),
    published_at: now(),
    version: (publicResultsByEvent[event.id]?.version ?? 0) + 1,
  };
}

// ---- Validaciones compartidas ----

function validateRubric(body: RubricIn) {
  if (!(body.scale_min < body.scale_max)) return problem(422, 'VALIDATION_ERROR', 'scale_min debe ser menor que scale_max.');
  if (!body.criteria?.length) return problem(422, 'VALIDATION_ERROR', 'La rúbrica necesita al menos un criterio.');
  const total = round2(body.criteria.reduce((s, c) => s + Number(c.weight), 0));
  if (total !== 100) return problem(422, 'WEIGHTS_MUST_SUM_100', `Los pesos suman ${total}, deben sumar 100.`);
  return null;
}

function rubricCriteria(body: RubricIn): ApiCriterion[] {
  return body.criteria.map((c, position) => ({
    id: c.id || uuid(),
    name: c.name,
    description: c.description ?? null,
    weight: Number(c.weight),
    position,
    level_descriptors: c.level_descriptors ?? {},
  }));
}

function maxDelegates(committee: ApiCommittee) {
  return committee.delegation_mode === 'double' ? 2 : 1;
}

function createDelegationIn(committee: ApiCommittee, draft: DelegationDraft): ApiDelegation | Response {
  const country = draft.country_code?.trim().toUpperCase() || null;
  const character = draft.character_name?.trim() || null;
  if (!country === !character) return problem(422, 'VALIDATION_ERROR', 'Indica exactamente uno: país o personaje.');
  if (country && !/^[A-Z]{2}$/.test(country)) return problem(422, 'VALIDATION_ERROR', `Código de país inválido: ${country}.`);
  if (country && committeeDelegations(committee.id).some((d) => d.country_code === country)) {
    return problem(409, 'CONFLICT', `El país ${country} ya existe en el comité.`);
  }
  const delegatesIn = draft.delegates ?? [];
  if (delegatesIn.length > maxDelegates(committee)) {
    return problem(422, 'DELEGATES_LIMIT_EXCEEDED', `Máximo ${maxDelegates(committee)} delegado(s) por delegación en este comité.`);
  }
  const id = uuid();
  const delegation: ApiDelegation = {
    id,
    committee_id: committee.id,
    country_code: country,
    character_name: character,
    institution: draft.institution ?? null,
    delegates: delegatesIn.map((d) => ({ id: uuid(), delegation_id: id, full_name: d.full_name, institution: d.institution ?? null })),
  };
  delegations.push(delegation);
  return delegation;
}

export const handlers = [
  http.get(`${BASE}/health`, () => HttpResponse.json({ status: 'ok' })),
  http.get(`${BASE}/me`, () => HttpResponse.json(currentMockIdentity())),

  // ---- Jueces ----
  http.get(`${BASE}/judges`, ({ request }) => page(request, judges.filter(inEventFilter(request)))),
  http.post(`${BASE}/judges`, async ({ request }) => {
    const { email, full_name, event_id } = (await request.json()) as { email: string; full_name: string; event_id?: string | null };
    if (!email?.includes('@') || !full_name?.trim()) return problem(422, 'VALIDATION_ERROR', 'Correo y nombre son obligatorios.');
    if (event_id && !findEvent(event_id)) return notFound('Evento no encontrado');
    const existing = judges.find((j) => j.email === email);
    if (existing) {
      if (event_id) linkJudgeToEvent(existing.judge_id, event_id);
      return HttpResponse.json(existing, { status: 201 });
    }
    // Como la API: el invitado queda pendiente y no sale en GET /judges hasta aceptar.
    const pending = judgeInvitations.find((i) => i.email === email);
    if (pending) {
      pending.invited_at = new Date().toISOString();
      if (event_id) linkJudgeToEvent(pending.judge_id, event_id);
      return HttpResponse.json({ ...pending, active: true }, { status: 201 });
    }
    const created: ApiJudgeInvitation = { judge_id: uuid(), email, full_name: full_name.trim(), invited_at: new Date().toISOString() };
    judgeInvitations.push(created);
    if (event_id) linkJudgeToEvent(created.judge_id, event_id);
    return HttpResponse.json({ ...created, active: true }, { status: 201 });
  }),
  http.get(`${BASE}/judges/invitations`, ({ request }) => page(request, judgeInvitations.filter(inEventFilter(request)))),
  http.post(`${BASE}/judges/:judgeId/invitation`, ({ params }) => {
    if (judges.some((j) => j.judge_id === params.judgeId)) return problem(409, 'CONFLICT', 'El juez ya aceptó la invitación');
    const invitation = judgeInvitations.find((i) => i.judge_id === params.judgeId);
    if (!invitation) return notFound();
    invitation.invited_at = new Date().toISOString();
    return HttpResponse.json(invitation);
  }),
  http.patch(`${BASE}/judges/:judgeId`, async ({ params, request }) => {
    const judge = judges.find((j) => j.judge_id === params.judgeId);
    if (!judge) return notFound();
    const patch = (await request.json()) as { full_name?: string | null; active?: boolean | null };
    if (patch.full_name) judge.full_name = patch.full_name;
    if (typeof patch.active === 'boolean') judge.active = patch.active;
    return HttpResponse.json(judge);
  }),

  // ---- Eventos ----
  http.get(`${BASE}/events`, ({ request }) => page(request, events)),
  http.post(`${BASE}/events`, async ({ request }) => {
    const draft = (await request.json()) as EventDraft;
    if (!SLUG_RE.test(draft.slug ?? '')) return problem(422, 'VALIDATION_ERROR', 'Slug inválido.');
    if (events.some((e) => e.slug === draft.slug)) return problem(409, 'CONFLICT', `Ya existe un evento con el slug "${draft.slug}".`);
    if (draft.ends_on < draft.starts_on) return problem(422, 'VALIDATION_ERROR', 'La fecha de fin no puede ser anterior a la de inicio.');
    const id = uuid();
    const rubric = defaultRubric(uuid(), id, 'Rúbrica por defecto');
    rubrics.push(rubric);
    const created: ApiEvent = {
      id,
      slug: draft.slug,
      name: draft.name,
      brand: draft.brand,
      event_type: draft.event_type ?? 'judges_only',
      logo_url: null,
      venue: draft.venue ?? null,
      country_code: draft.country_code ?? null,
      timezone: draft.timezone,
      starts_on: draft.starts_on,
      ends_on: draft.ends_on,
      status: 'draft',
      default_rubric_id: rubric.id,
      created_at: now(),
      updated_at: null,
    };
    events.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),
  http.get(`${BASE}/events/:eventId`, ({ params }) => {
    const event = findEvent(params.eventId);
    return event ? HttpResponse.json(event) : notFound();
  }),
  http.patch(`${BASE}/events/:eventId`, async ({ params, request }) => {
    const event = findEvent(params.eventId);
    if (!event) return notFound();
    if (event.status === 'closed') return problem(409, 'EVENT_CLOSED', 'El evento está cerrado.');
    const patch = (await request.json()) as EventUpdate;
    if (patch.status && patch.status !== 'draft' && patch.status !== 'active') {
      return problem(422, 'VALIDATION_ERROR', 'status solo admite draft o active.');
    }
    if (patch.event_type !== undefined && patch.event_type !== event.event_type && event.status !== 'draft') {
      return problem(409, 'CONFLICT', 'El tipo de evento solo se puede cambiar mientras el evento está en borrador');
    }
    Object.assign(event, patch, { updated_at: now() });
    return HttpResponse.json(event);
  }),
  http.delete(`${BASE}/events/:eventId`, ({ params }) => {
    const index = events.findIndex((e) => e.id === params.eventId);
    if (index === -1) return notFound();
    if (events[index].status !== 'draft') return problem(409, 'CONFLICT', 'Solo se puede borrar un evento en borrador.');
    events.splice(index, 1);
    return noContent();
  }),
  http.post(`${BASE}/events/:eventId/logo`, async ({ params, request }) => {
    const event = findEvent(params.eventId);
    if (!event) return notFound();
    const file = (await request.formData()).get('file');
    if (!(file instanceof File)) return problem(422, 'VALIDATION_ERROR', 'Falta el archivo.');
    if (!['image/png', 'image/svg+xml', 'image/webp'].includes(file.type)) return problem(422, 'VALIDATION_ERROR', 'Formato no admitido (PNG, SVG o WebP).');
    if (file.size > 2 * 1024 * 1024) return problem(422, 'VALIDATION_ERROR', 'El logo supera 2 MB.');
    event.logo_url = URL.createObjectURL(file);
    return HttpResponse.json(event);
  }),
  http.post(`${BASE}/events/:eventId/close`, ({ params }) => {
    const event = findEvent(params.eventId);
    if (!event) return notFound();
    const committeeIds = committees.filter((c) => c.event_id === event.id).map((c) => c.id);
    if (committeeIds.some((id) => (sessionsByCommittee[id] ?? []).some((s) => s.status === 'open'))) {
      return problem(409, 'SESSIONS_STILL_OPEN', 'Hay sesiones abiertas; ciérralas antes de cerrar el evento.');
    }
    event.status = 'closed';
    event.updated_at = now();
    return HttpResponse.json({ event_id: event.id, status: 'closed', snapshot_id: uuid(), closed_at: event.updated_at });
  }),

  // ---- Comités ----
  http.get(`${BASE}/events/:eventId/committees`, ({ params, request }) => page(request, committees.filter((c) => c.event_id === params.eventId))),
  http.post(`${BASE}/events/:eventId/committees`, async ({ params, request }) => {
    const event = findEvent(params.eventId);
    if (!event) return notFound();
    if (event.status === 'closed') return problem(409, 'EVENT_CLOSED', 'El evento está cerrado.');
    const draft = (await request.json()) as CommitteeDraft;
    if (!SLUG_RE.test(draft.slug ?? '')) return problem(422, 'VALIDATION_ERROR', 'Slug inválido.');
    if (committees.some((c) => c.event_id === event.id && c.slug === draft.slug)) {
      return problem(409, 'CONFLICT', `Ya existe un comité con el slug "${draft.slug}" en este evento.`);
    }
    if (!(draft.sessions_count >= 1 && draft.sessions_count <= 20)) return problem(422, 'VALIDATION_ERROR', 'Entre 1 y 20 sesiones.');
    const created: ApiCommittee = {
      id: uuid(),
      event_id: event.id,
      name: draft.name,
      acronym: draft.acronym,
      slug: draft.slug,
      type: draft.type,
      delegation_mode: draft.delegation_mode,
      sessions_count: draft.sessions_count,
      rubric_id: draft.rubric_id ?? null,
      award_quotas: draft.award_quotas ?? DEFAULT_AWARD_QUOTAS[draft.type],
      created_at: now(),
    };
    committees.push(created);
    sessionsByCommittee[created.id] = buildSessions(created.id, created.sessions_count, false);
    awardsByCommittee[created.id] = [];
    return HttpResponse.json(created, { status: 201 });
  }),
  http.get(`${BASE}/committees/:committeeId`, ({ params }) => {
    const committee = findCommittee(params.committeeId);
    return committee ? HttpResponse.json(committee) : notFound();
  }),
  http.patch(`${BASE}/committees/:committeeId`, async ({ params, request }) => {
    const committee = findCommittee(params.committeeId);
    if (!committee) return notFound();
    if (isEventClosed(committee.event_id)) return problem(409, 'EVENT_CLOSED', 'El evento está cerrado.');
    const patch = (await request.json()) as Partial<CommitteeDraft>;
    if (patch.slug !== undefined && !SLUG_RE.test(patch.slug)) return problem(422, 'VALIDATION_ERROR', 'Slug inválido.');
    if (patch.slug && committees.some((c) => c.id !== committee.id && c.event_id === committee.event_id && c.slug === patch.slug)) {
      return problem(409, 'CONFLICT', `Ya existe un comité con el slug "${patch.slug}" en este evento.`);
    }
    if (patch.sessions_count !== undefined && !(patch.sessions_count >= 1 && patch.sessions_count <= 20)) {
      return problem(422, 'VALIDATION_ERROR', 'Entre 1 y 20 sesiones.');
    }
    Object.assign(committee, patch);
    const sessions = sessionsByCommittee[committee.id] ?? [];
    for (let n = sessions.length + 1; n <= committee.sessions_count; n++) {
      sessions.push({ id: uuid(), committee_id: committee.id, number: n, status: 'closed', opened_at: null, closed_at: null });
    }
    sessionsByCommittee[committee.id] = sessions;
    return HttpResponse.json(committee);
  }),
  http.delete(`${BASE}/committees/:committeeId`, ({ params }) => {
    const index = committees.findIndex((c) => c.id === params.committeeId);
    if (index === -1) return notFound();
    committees.splice(index, 1);
    return noContent();
  }),

  // ---- Delegaciones y delegados ----
  http.get(`${BASE}/committees/:committeeId/delegations`, ({ params, request }) => page(request, committeeDelegations(String(params.committeeId)))),
  http.post(`${BASE}/committees/:committeeId/delegations`, async ({ params, request }) => {
    const committee = findCommittee(params.committeeId);
    if (!committee) return notFound();
    const result = createDelegationIn(committee, (await request.json()) as DelegationDraft);
    return result instanceof Response ? result : HttpResponse.json(result, { status: 201 });
  }),
  http.post(`${BASE}/committees/:committeeId/delegations/import`, async ({ params, request }) => {
    const committee = findCommittee(params.committeeId);
    if (!committee) return notFound();
    const file = (await request.formData()).get('file');
    if (!(file instanceof File)) return problem(422, 'VALIDATION_ERROR', 'Falta el archivo CSV.');
    const lines = (await file.text()).replace(/^﻿/, '').split(/\r?\n/);
    const result: DelegationImportResult = { created: 0, skipped: 0, errors: [] };
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const [country_code, character_name, institution, delegate_1, delegate_2] = lines[i].split(',').map((v) => v?.trim() ?? '');
      const row = i + 1;
      if (country_code && committeeDelegations(committee.id).some((d) => d.country_code === country_code.toUpperCase())) {
        result.skipped++;
        continue;
      }
      if (delegate_2 && committee.delegation_mode === 'single') {
        result.errors.push({ row, message: 'delegate_2 no se admite en un comité single.' });
        continue;
      }
      const created = createDelegationIn(committee, {
        country_code: country_code || null,
        character_name: character_name || null,
        institution: institution || null,
        delegates: [delegate_1, delegate_2].filter(Boolean).map((full_name) => ({ full_name, institution: institution || null })),
      });
      if (created instanceof Response) {
        result.errors.push({ row, message: ((await created.json()) as ProblemJson).detail });
      } else {
        result.created++;
      }
    }
    return HttpResponse.json(result);
  }),
  http.patch(`${BASE}/delegations/:delegationId`, async ({ params, request }) => {
    const delegation = delegations.find((d) => d.id === params.delegationId);
    if (!delegation) return notFound();
    const next = { ...delegation, ...((await request.json()) as Partial<ApiDelegation>) };
    if (!next.country_code === !next.character_name) return problem(422, 'VALIDATION_ERROR', 'Indica exactamente uno: país o personaje.');
    if (next.country_code && committeeDelegations(delegation.committee_id).some((d) => d.id !== delegation.id && d.country_code === next.country_code)) {
      return problem(409, 'CONFLICT', `El país ${next.country_code} ya existe en el comité.`);
    }
    Object.assign(delegation, { country_code: next.country_code, character_name: next.character_name, institution: next.institution });
    return HttpResponse.json(delegation);
  }),
  http.delete(`${BASE}/delegations/:delegationId`, ({ params }) => {
    const index = delegations.findIndex((d) => d.id === params.delegationId);
    if (index === -1) return notFound();
    delegations.splice(index, 1);
    return noContent();
  }),
  http.post(`${BASE}/delegations/:delegationId/delegates`, async ({ params, request }) => {
    const delegation = delegations.find((d) => d.id === params.delegationId);
    if (!delegation) return notFound();
    const committee = findCommittee(delegation.committee_id)!;
    if (delegation.delegates.length >= maxDelegates(committee)) {
      return problem(422, 'DELEGATES_LIMIT_EXCEEDED', `Máximo ${maxDelegates(committee)} delegado(s) por delegación en este comité.`);
    }
    const body = (await request.json()) as { full_name: string; institution?: string | null };
    const delegate = { id: uuid(), delegation_id: delegation.id, full_name: body.full_name, institution: body.institution ?? null };
    delegation.delegates.push(delegate);
    return HttpResponse.json(delegate, { status: 201 });
  }),
  http.patch(`${BASE}/delegates/:delegateId`, async ({ params, request }) => {
    const found = findDelegate(String(params.delegateId));
    if (!found) return notFound();
    const patch = (await request.json()) as { full_name?: string | null; institution?: string | null };
    if (patch.full_name) found.delegate.full_name = patch.full_name;
    if (patch.institution !== undefined) found.delegate.institution = patch.institution;
    return HttpResponse.json(found.delegate);
  }),
  http.delete(`${BASE}/delegates/:delegateId`, ({ params }) => {
    const found = findDelegate(String(params.delegateId));
    if (!found) return notFound();
    found.delegation.delegates = found.delegation.delegates.filter((d) => d.id !== found.delegate.id);
    return noContent();
  }),

  // ---- Rúbricas ----
  http.get(`${BASE}/events/:eventId/rubrics`, ({ params }) => HttpResponse.json(rubrics.filter((r) => r.event_id === params.eventId))),
  http.post(`${BASE}/events/:eventId/rubrics`, async ({ params, request }) => {
    const event = findEvent(params.eventId);
    if (!event) return notFound();
    const body = (await request.json()) as RubricIn;
    const invalid = validateRubric(body);
    if (invalid) return invalid;
    const created: ApiRubric = { id: uuid(), event_id: event.id, name: body.name, scale_min: body.scale_min, scale_max: body.scale_max, criteria: rubricCriteria(body) };
    rubrics.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),
  http.get(`${BASE}/rubrics/:rubricId`, ({ params }) => {
    const rubric = rubrics.find((r) => r.id === params.rubricId);
    return rubric ? HttpResponse.json(rubric) : notFound();
  }),
  http.put(`${BASE}/rubrics/:rubricId`, async ({ params, request }) => {
    const rubric = rubrics.find((r) => r.id === params.rubricId);
    if (!rubric) return notFound();
    const body = (await request.json()) as RubricIn;
    const invalid = validateRubric(body);
    if (invalid) return invalid;
    Object.assign(rubric, { name: body.name, scale_min: body.scale_min, scale_max: body.scale_max, criteria: rubricCriteria(body) });
    return HttpResponse.json(rubric);
  }),

  // ---- Asignaciones juez–comité ----
  http.get(`${BASE}/committees/:committeeId/judges`, ({ params }) => {
    if (!findCommittee(params.committeeId)) return notFound();
    return HttpResponse.json(assignmentsOut(String(params.committeeId)));
  }),
  http.put(`${BASE}/committees/:committeeId/judges`, async ({ params, request }) => {
    const committeeId = String(params.committeeId);
    const committee = findCommittee(committeeId);
    if (!committee) return notFound();
    const body = (await request.json()) as CommitteeJudgeAssignment[];
    if (!Array.isArray(body)) return problem(422, 'VALIDATION_ERROR', 'El cuerpo debe ser un array.');
    const unknown = body.find((a) => !judges.some((j) => j.judge_id === a.judge_id));
    if (unknown) return problem(404, 'NOT_FOUND', `No existe el juez ${unknown.judge_id}.`);
    committeeJudges[committeeId] = body.map((a) => ({ judge_id: a.judge_id, role: a.role ?? 'judge' }));
    body.forEach((a) => linkJudgeToEvent(a.judge_id, committee.event_id));
    return HttpResponse.json(assignmentsOut(committeeId));
  }),

  // ---- Sesiones y progreso ----
  http.get(`${BASE}/committees/:committeeId/sessions`, ({ params }) => HttpResponse.json(sessionsByCommittee[String(params.committeeId)] ?? [])),
  http.post(`${BASE}/committees/:committeeId/sessions/:number/:action`, ({ params }) => {
    const committee = findCommittee(params.committeeId);
    if (!committee) return notFound();
    if (params.action !== 'open' && params.action !== 'close') return notFound();
    if (isEventClosed(committee.event_id)) return problem(409, 'EVENT_CLOSED', 'El evento está cerrado.');
    const session = (sessionsByCommittee[committee.id] ?? []).find((s) => s.number === Number(params.number));
    if (!session) return notFound(`No existe la sesión ${params.number}.`);
    if (params.action === 'open' && session.status !== 'open') Object.assign(session, { status: 'open', opened_at: now(), closed_at: null });
    if (params.action === 'close' && session.status !== 'closed') Object.assign(session, { status: 'closed', closed_at: now() });
    return HttpResponse.json(session);
  }),
  http.get(`${BASE}/committees/:committeeId/progress`, ({ params }) => {
    const committee = findCommittee(params.committeeId);
    if (!committee) return notFound();
    const criteriaCount = rubricForCommittee(committee)?.criteria.length ?? 0;
    const delegateCount = committeeDelegations(committee.id).reduce((s, d) => s + d.delegates.length, 0);
    return HttpResponse.json({
      sessions: (sessionsByCommittee[committee.id] ?? []).map((s) => ({
        number: s.number,
        status: s.status,
        judges: assignmentsOut(committee.id).map((a) => ({
          judge_id: a.judge_id,
          full_name: a.full_name,
          scored: judgeScores.filter((sc) => sc.session_id === s.id && sc.judge_id === a.judge_id).length,
          expected: delegateCount * criteriaCount,
        })),
      })),
    });
  }),

  // ---- Resultados ----
  http.get(`${BASE}/committees/:committeeId/ranking`, ({ params }) => {
    const committeeId = String(params.committeeId);
    if (!findCommittee(committeeId)) return notFound();
    const eventType = eventOfCommittee(findCommittee(committeeId)!).event_type;
    return HttpResponse.json({
      items: computeRanking(committeeId),
      quota_warnings: awardsOut(committeeId).quota_warnings,
      event_type: eventType,
      role_weights: ROLE_WEIGHTS[eventType],
    });
  }),
  http.get(`${BASE}/committees/:committeeId/awards`, ({ params }) => {
    if (!findCommittee(params.committeeId)) return notFound();
    return HttpResponse.json(awardsOut(String(params.committeeId)));
  }),
  http.put(`${BASE}/committees/:committeeId/awards`, async ({ params, request }) => {
    const committee = findCommittee(params.committeeId);
    if (!committee) return notFound();
    if (isEventClosed(committee.event_id)) return problem(409, 'EVENT_CLOSED', 'El evento está cerrado.');
    const body = (await request.json()) as Array<Partial<Award>>;
    const items: Award[] = body.map((a) => ({ award_type: a.award_type!, delegation_id: a.delegation_id!, position: a.position ?? 1 }));
    const foreign = items.find((a) => !committeeDelegations(committee.id).some((d) => d.id === a.delegation_id));
    if (foreign) return problem(404, 'NOT_FOUND', 'La delegación no pertenece al comité.');
    awardsByCommittee[committee.id] = items;
    return HttpResponse.json(awardsOut(committee.id));
  }),
  http.get(`${BASE}/events/:eventId/export.xlsx`, ({ params }) => {
    if (!findEvent(params.eventId)) return notFound();
    return new HttpResponse(new Blob(['mock-xlsx']), {
      headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    });
  }),

  // ---- Publicación ----
  http.get(`${BASE}/events/:eventId/publication-settings`, ({ params }) => {
    if (!findEvent(params.eventId)) return notFound();
    return HttpResponse.json(publicationSettingsByEvent[String(params.eventId)] ?? DEFAULT_PUBLICATION_SETTINGS);
  }),
  http.put(`${BASE}/events/:eventId/publication-settings`, async ({ params, request }) => {
    if (!findEvent(params.eventId)) return notFound();
    const eventId = String(params.eventId);
    const settings = { ...(publicationSettingsByEvent[eventId] ?? DEFAULT_PUBLICATION_SETTINGS), ...((await request.json()) as Partial<PublicationSettings>) };
    publicationSettingsByEvent[eventId] = settings;
    return HttpResponse.json(settings);
  }),
  http.get(`${BASE}/events/:eventId/publication/preview`, ({ params }) => {
    const event = findEvent(params.eventId);
    return event ? HttpResponse.json(buildPublicDocument(event)) : notFound();
  }),
  http.post(`${BASE}/events/:eventId/publish`, ({ params }) => {
    const event = findEvent(params.eventId);
    if (!event) return notFound();
    if (event.status !== 'closed') return problem(409, 'EVENT_NOT_CLOSED', 'Solo se puede publicar un evento cerrado.');
    const doc = buildPublicDocument(event);
    publicResultsByEvent[event.id] = { published: true, version: doc.version };
    return HttpResponse.json({ version: doc.version, published_at: doc.published_at, revalidated: true });
  }),
  http.post(`${BASE}/events/:eventId/unpublish`, ({ params }) => {
    const event = findEvent(params.eventId);
    if (!event) return notFound();
    const current = publicResultsByEvent[event.id];
    if (current) current.published = false;
    return HttpResponse.json({ revalidated: true });
  }),

  // ---- Panel del juez ----
  http.get(`${BASE}/judge/committees`, () => {
    const judgeId = CURRENT_JUDGE.user_id;
    const items: JudgeCommitteeSummary[] = Object.entries(committeeJudges).flatMap(([committeeId, list]) => {
      const assignment = list.find((a) => a.judge_id === judgeId);
      const committee = findCommittee(committeeId);
      if (!assignment || !committee) return [];
      const event = eventOfCommittee(committee);
      // Igual que el backend: solo eventos activos.
      if (event.status !== 'active') return [];
      return [{
        committee_id: committee.id,
        name: committee.name,
        acronym: committee.acronym,
        event: { name: event.name, logo_url: event.logo_url, timezone: event.timezone },
        role: assignment.role,
      }];
    });
    return HttpResponse.json(items);
  }),
  http.get(`${BASE}/judge/committees/:committeeId`, ({ params }) => {
    const committee = findCommittee(params.committeeId);
    if (!committee) return notFound();
    const assignment = (committeeJudges[committee.id] ?? []).find((a) => a.judge_id === CURRENT_JUDGE.user_id);
    if (!assignment) return problem(403, 'JUDGE_NOT_ASSIGNED', 'No estás asignado a este comité.');
    const event = eventOfCommittee(committee);
    const rubric = rubricForCommittee(committee);
    const detail: JudgeCommitteeDetail = {
      committee_id: committee.id,
      name: committee.name,
      acronym: committee.acronym,
      type: committee.type,
      delegation_mode: committee.delegation_mode,
      role: assignment.role,
      event: { name: event.name, logo_url: event.logo_url, timezone: event.timezone },
      event_closed: event.status === 'closed',
      delegations: committeeDelegations(committee.id).map((d) => ({
        delegation_id: d.id,
        country_code: d.country_code,
        character_name: d.character_name,
        institution: d.institution,
        delegates: d.delegates.map((x) => ({ delegate_id: x.id, full_name: x.full_name })),
      })),
      rubric: rubric ? { id: rubric.id, name: rubric.name, scale_min: rubric.scale_min, scale_max: rubric.scale_max, criteria: rubric.criteria } : null,
      sessions: (sessionsByCommittee[committee.id] ?? []).map((s) => ({
        session_id: s.id,
        number: s.number,
        status: s.status,
        opened_at: s.opened_at,
        closed_at: s.closed_at,
      })),
    };
    return HttpResponse.json(detail);
  }),
  http.get(`${BASE}/judge/sessions/:sessionId/scores`, ({ params }) => {
    const mine: JudgeScore[] = judgeScores
      .filter((s) => s.session_id === params.sessionId && s.judge_id === CURRENT_JUDGE.user_id)
      .map(({ judge_id: _judge, ...score }) => score);
    return HttpResponse.json(mine);
  }),
  http.post(`${BASE}/judge/scores/batch`, async ({ request }) => {
    const { items } = (await request.json()) as { items: ScoreBatchItem[] };
    if (!Array.isArray(items) || items.length < 1 || items.length > 500) return problem(422, 'VALIDATION_ERROR', 'El lote debe tener entre 1 y 500 ítems.');
    const judgeId = CURRENT_JUDGE.user_id;
    const response: ScoreBatchResponse = { accepted: [], rejected: [] };
    const reject = (client_id: string, code: string, detail: string) => response.rejected.push({ client_id, code, detail });

    for (const item of items) {
      const session = allSessions().find((s) => s.id === item.session_id);
      const found = findDelegate(item.delegate_id);
      const committee = session && findCommittee(session.committee_id);
      if (!session || !found || !committee || found.delegation.committee_id !== committee.id) {
        reject(item.client_id, 'NOT_FOUND', 'La sesión o el delegado no existen.');
        continue;
      }
      const assignment = (committeeJudges[committee.id] ?? []).find((a) => a.judge_id === judgeId);
      if (!assignment) {
        reject(item.client_id, 'JUDGE_NOT_ASSIGNED', 'No estás asignado a este comité.');
        continue;
      }
      if (!accountVoterRole(ROLE_WEIGHTS[eventOfCommittee(committee).event_type], assignment.role)) {
        reject(item.client_id, 'FORBIDDEN', `Tu rol en este comité (${assignment.role}) no califica en este tipo de evento`);
        continue;
      }
      if (isEventClosed(committee.event_id)) {
        reject(item.client_id, 'EVENT_CLOSED', 'El evento está cerrado.');
        continue;
      }
      if (session.status !== 'open') {
        reject(item.client_id, 'SESSION_CLOSED', `La sesión ${session.number} está cerrada`);
        continue;
      }
      const rubric = rubricForCommittee(committee);
      if (!rubric?.criteria.some((c) => c.id === item.criterion_id)) {
        reject(item.client_id, 'NOT_FOUND', 'El criterio no pertenece a la rúbrica del comité.');
        continue;
      }
      if (!Number.isInteger(item.value) || item.value < rubric.scale_min || item.value > rubric.scale_max) {
        reject(item.client_id, 'VALUE_OUT_OF_RANGE', `La nota debe estar entre ${rubric.scale_min} y ${rubric.scale_max}.`);
        continue;
      }
      // Upsert por (judge, delegate, session, criterion); gana la última escritura según client_updated_at.
      const existing = judgeScores.find(
        (s) => s.judge_id === judgeId && s.delegate_id === item.delegate_id && s.session_id === item.session_id && s.criterion_id === item.criterion_id,
      );
      if (existing && existing.client_updated_at > item.client_updated_at) {
        response.accepted.push(item.client_id);
        continue;
      }
      const record = {
        client_id: item.client_id,
        judge_id: judgeId,
        delegate_id: item.delegate_id,
        session_id: item.session_id,
        criterion_id: item.criterion_id,
        value: item.value,
        comment: item.comment ?? null,
        client_updated_at: item.client_updated_at,
        updated_at: now(),
      };
      if (existing) Object.assign(existing, record);
      else judgeScores.push(record);
      response.accepted.push(item.client_id);
    }
    return HttpResponse.json(response);
  }),

  // ---- Votación de delegados (ADR-005) ----
  http.get(`${BASE}/events/:eventId/voter-tokens`, ({ params }) => {
    const eventId = String(params.eventId);
    if (!findEvent(eventId)) return notFound();
    const latest = new Map<string, MockVoterToken>();
    voterTokens.forEach((t) => {
      if (t.event_id === eventId && (!latest.get(t.delegate_id) || latest.get(t.delegate_id)!.issued_at <= t.issued_at)) latest.set(t.delegate_id, t);
    });
    const items: VoterAccess[] = committees
      .filter((c) => c.event_id === eventId)
      .flatMap((c) =>
        committeeDelegations(c.id).flatMap((d) =>
          d.delegates.map((p) => {
            const token = latest.get(p.id);
            return {
              delegate_id: p.id,
              full_name: p.full_name,
              delegation_id: d.id,
              country_code: d.country_code,
              character_name: d.character_name,
              committee_id: c.id,
              committee_name: c.name,
              committee_acronym: c.acronym,
              status: !token ? 'none' : token.revoked_at ? 'revoked' : 'active',
              issued_at: token?.issued_at ?? null,
              last_used_at: token?.last_used_at ?? null,
              votes_count: delegateVotes.filter((v) => v.voter_delegate_id === p.id).length,
            } satisfies VoterAccess;
          }),
        ),
      );
    return HttpResponse.json(items);
  }),
  http.post(`${BASE}/events/:eventId/voter-tokens`, async ({ params, request }) => {
    const event = findEvent(params.eventId);
    if (!event) return notFound();
    if (!('delegate' in ROLE_WEIGHTS[event.event_type])) return problem(409, 'CONFLICT', 'En este tipo de evento los delegados no votan');
    if (event.status === 'closed') return problem(409, 'EVENT_CLOSED', 'El evento está cerrado');
    const body = (await request.json()) as GenerateVoterTokensIn;
    const active = (delegateId: string) => [...voterTokens.values()].some((t) => t.delegate_id === delegateId && !t.revoked_at);
    const all = committees
      .filter((c) => c.event_id === event.id)
      .flatMap((c) => committeeDelegations(c.id).flatMap((d) => d.delegates.map((p) => ({ c, d, p }))));
    const targets = body.delegate_ids ? all.filter((x) => body.delegate_ids!.includes(x.p.id)) : all.filter((x) => !active(x.p.id));
    const issued = now();
    const out: GeneratedVoterToken[] = targets.map(({ c, d, p }) => {
      voterTokens.forEach((t) => {
        if (t.delegate_id === p.id && !t.revoked_at) t.revoked_at = issued;
      });
      const token = crypto.randomUUID().replace(/-/g, '');
      voterTokens.set(token, { delegate_id: p.id, event_id: event.id, issued_at: issued, revoked_at: null, last_used_at: null });
      const url = `${body.link_base}${token}`;
      return {
        delegate_id: p.id,
        full_name: p.full_name,
        country_code: d.country_code,
        character_name: d.character_name,
        committee_name: c.name,
        committee_acronym: c.acronym,
        token,
        url,
        // En los mocks no se genera un QR real: un recuadro con el texto basta para la vista previa.
        qr_svg: `<svg xmlns="http://www.w3.org/2000/svg" width="116" height="116"><rect width="116" height="116" fill="#fff" stroke="#000"/><text x="58" y="62" font-size="10" text-anchor="middle">QR (mock)</text></svg>`,
        expires_at: `${event.ends_on}T00:00:00Z`,
      };
    });
    return HttpResponse.json(out, { status: 201 });
  }),
  http.post(`${BASE}/events/:eventId/voter-tokens/revoke`, async ({ params, request }) => {
    if (!findEvent(params.eventId)) return notFound();
    const { delegate_ids } = (await request.json()) as { delegate_ids: string[] };
    let revoked = 0;
    voterTokens.forEach((t) => {
      if (t.event_id === params.eventId && delegate_ids.includes(t.delegate_id) && !t.revoked_at) {
        t.revoked_at = now();
        revoked += 1;
      }
    });
    return HttpResponse.json({ revoked });
  }),
  ...(['get', 'put'] as const).map((method) =>
    http[method](`${BASE}/vote/ballot`, async ({ request }) => {
      const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
      const access = voterTokens.get(token);
      if (!access || access.revoked_at) return problem(401, 'UNAUTHORIZED', 'Tu acceso no es válido o ya venció. Pide uno nuevo al staff del evento');
      access.last_used_at = now();
      const found = findDelegate(access.delegate_id);
      const committee = found && findCommittee(found.delegation.committee_id);
      if (!found || !committee) return problem(401, 'UNAUTHORIZED', 'Tu acceso no es válido o ya venció.');
      const event = eventOfCommittee(committee);
      const rubric = rubricForCommittee(committee);
      const session = event.status === 'active' ? (sessionsByCommittee[committee.id] ?? []).filter((s) => s.status === 'open').sort((a, b) => b.number - a.number)[0] : undefined;

      if (method === 'put') {
        if (!session) return problem(409, 'SESSION_CLOSED', 'No hay una sesión abierta; espera a la siguiente');
        const { items } = (await request.json()) as { items: Array<{ delegation_id: string; criterion_id: string; value: number }> };
        for (const item of items) {
          if (item.delegation_id === found.delegation.id) return problem(403, 'FORBIDDEN', 'No puedes votar por tu propia delegación');
          if (!committeeDelegations(committee.id).some((d) => d.id === item.delegation_id)) return problem(404, 'NOT_FOUND', 'La delegación no pertenece a tu comité');
          if (!rubric?.criteria.some((c) => c.id === item.criterion_id)) return problem(404, 'NOT_FOUND', 'El criterio no pertenece a la rúbrica del comité');
          if (item.value < rubric.scale_min || item.value > rubric.scale_max) return problem(422, 'VALUE_OUT_OF_RANGE', `El valor ${item.value} está fuera de la escala`);
        }
        for (const item of items) {
          const existing = delegateVotes.find(
            (v) => v.voter_delegate_id === access.delegate_id && v.delegation_id === item.delegation_id && v.session_id === session.id && v.criterion_id === item.criterion_id,
          );
          if (existing) existing.value = item.value;
          else delegateVotes.push({ voter_delegate_id: access.delegate_id, session_id: session.id, ...item });
        }
      }

      const ballot: Ballot = {
        voter_name: found.delegate.full_name,
        own_delegation: { delegation_id: found.delegation.id, country_code: found.delegation.country_code, character_name: found.delegation.character_name },
        event_name: event.name,
        event_status: event.status,
        committee_name: committee.name,
        committee_acronym: committee.acronym,
        open_session: session ? { session_id: session.id, number: session.number, opened_at: session.opened_at } : null,
        rubric: rubric ? { scale_min: rubric.scale_min, scale_max: rubric.scale_max, criteria: rubric.criteria } : null,
        delegations: committeeDelegations(committee.id)
          .filter((d) => d.id !== found.delegation.id)
          .map((d) => ({ delegation_id: d.id, country_code: d.country_code, character_name: d.character_name })),
        votes: session
          ? delegateVotes
              .filter((v) => v.voter_delegate_id === access.delegate_id && v.session_id === session.id)
              .map(({ delegation_id, criterion_id, value }) => ({ delegation_id, criterion_id, value }))
          : [],
      };
      return HttpResponse.json(ballot);
    }),
  ),
];
