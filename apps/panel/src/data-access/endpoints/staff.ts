import { apiFetch, buildQuery } from '../apiClient';
import { ApiError } from '../errors';
import type { ProblemJson } from '../apiTypes';
import type {
  EventStaffMember,
  StaffInviteIn,
  StaffInviteOut,
  StaffAccessLink,
  StaffAssignAwardIn,
  StaffAwardIn,
  StaffAwardPatch,
  StaffEvaluation,
  StaffEvaluationIn,
  StaffMe,
  StaffMemberIn,
  StaffMemberPatch,
  StaffOverview,
  StaffPerson,
  StaffPersonIn,
  StaffRanking,
  StaffRubricIn,
  StaffTypeDetail,
  StaffTypeIn,
  StaffTypePatch,
} from '../staffTypes';

/**
 * El staff es de la organización. `eventId` es el evento de contexto para candidatos,
 * avance y premios; sin él, el backend usa el evento activo más reciente.
 */
const ctx = (eventId?: string | null) => buildQuery({ event_id: eventId || undefined });

// ---- Tipos de staff (admin) ----

export function getStaffOverview(eventId?: string | null): Promise<StaffOverview> {
  return apiFetch<StaffOverview>(`/staff${ctx(eventId)}`);
}

export function createStaffType(body: StaffTypeIn, eventId?: string | null): Promise<StaffTypeDetail> {
  return apiFetch<StaffTypeDetail>(`/staff-types${ctx(eventId)}`, { method: 'POST', body });
}

export function getStaffType(typeId: string, eventId?: string | null): Promise<StaffTypeDetail> {
  return apiFetch<StaffTypeDetail>(`/staff-types/${typeId}${ctx(eventId)}`);
}

export function updateStaffType(typeId: string, body: StaffTypePatch, eventId?: string | null): Promise<StaffTypeDetail> {
  return apiFetch<StaffTypeDetail>(`/staff-types/${typeId}${ctx(eventId)}`, { method: 'PATCH', body });
}

/** Reemplaza la rúbrica: pesos de 0 a 50 % que sumen 100 (422 si no). */
export function putStaffRubric(typeId: string, body: StaffRubricIn, eventId?: string | null): Promise<StaffTypeDetail> {
  return apiFetch<StaffTypeDetail>(`/staff-types/${typeId}/rubric${ctx(eventId)}`, { method: 'PUT', body });
}

// ---- Miembros (admin) ----

export function listStaffPeople(): Promise<StaffPerson[]> {
  return apiFetch<StaffPerson[]>('/staff-people');
}

export function addStaffMember(typeId: string, body: StaffMemberIn, eventId?: string | null): Promise<StaffTypeDetail> {
  return apiFetch<StaffTypeDetail>(`/staff-types/${typeId}/members${ctx(eventId)}`, { method: 'POST', body });
}

export function updateStaffMember(memberId: string, body: StaffMemberPatch, eventId?: string | null): Promise<StaffTypeDetail> {
  return apiFetch<StaffTypeDetail>(`/staff-members/${memberId}${ctx(eventId)}`, { method: 'PATCH', body });
}

/** Quita al miembro del tipo; sus evaluaciones no se borran. */
export function removeStaffMember(memberId: string, eventId?: string | null): Promise<StaffTypeDetail> {
  return apiFetch<StaffTypeDetail>(`/staff-members/${memberId}/remove${ctx(eventId)}`, { method: 'POST' });
}

export function updateStaffPerson(personId: string, body: Partial<StaffPersonIn>): Promise<StaffPerson> {
  return apiFetch<StaffPerson>(`/staff-people/${personId}`, { method: 'PATCH', body });
}

/** Enlace personal de evaluación. El token solo llega aquí; el anterior deja de servir. */
export function issueStaffLink(personId: string, linkBase: string): Promise<StaffAccessLink> {
  return apiFetch<StaffAccessLink>(`/staff-people/${personId}/link`, { method: 'POST', body: { link_base: linkBase } });
}

// ---- Personas del evento (pantalla de jueces) ----

export function listEventStaff(eventId: string): Promise<EventStaffMember[]> {
  return apiFetch<EventStaffMember[]>(`/events/${eventId}/staff-members`);
}

/** Invita con su rol: juez o tipo de staff (con contraseña o con QR por correo). */
export function inviteToEvent(eventId: string, body: StaffInviteIn): Promise<StaffInviteOut> {
  return apiFetch<StaffInviteOut>(`/events/${eventId}/invitations`, { method: 'POST', body });
}

/** QR nuevo por correo (el anterior deja de servir). */
export function resendStaffAccess(memberId: string): Promise<StaffInviteOut> {
  return apiFetch<StaffInviteOut>(`/staff-members/${memberId}/access`, { method: 'POST' });
}

// ---- Ranking y premios (admin, por evento) ----

export function getStaffRanking(typeId: string, eventId?: string | null, committeeId?: string): Promise<StaffRanking> {
  return apiFetch<StaffRanking>(
    `/staff-types/${typeId}/ranking${buildQuery({ event_id: eventId || undefined, committee_id: committeeId || undefined })}`,
  );
}

export function addStaffAward(typeId: string, body: StaffAwardIn, eventId?: string | null): Promise<StaffTypeDetail> {
  return apiFetch<StaffTypeDetail>(`/staff-types/${typeId}/awards${ctx(eventId)}`, { method: 'POST', body });
}

export function updateStaffAward(awardId: string, body: StaffAwardPatch, eventId?: string | null): Promise<StaffTypeDetail> {
  return apiFetch<StaffTypeDetail>(`/staff-awards/${awardId}${ctx(eventId)}`, { method: 'PATCH', body });
}

export function assignStaffAward(awardId: string, body: StaffAssignAwardIn): Promise<StaffRanking> {
  return apiFetch<StaffRanking>(`/staff-awards/${awardId}/assignment`, { method: 'PUT', body });
}

export function confirmStaffAwards(typeId: string, eventId: string, confirmed: boolean): Promise<StaffTypeDetail> {
  return apiFetch<StaffTypeDetail>(`/staff-types/${typeId}/awards/confirm`, {
    method: 'POST',
    body: { event_id: eventId, confirmed },
  });
}

// ---- Miembro del staff con su enlace ----
// No usa apiFetch: la persona del staff no tiene sesión de Supabase; se autentica con su token.

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

async function staffFetch<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    let data: Partial<ProblemJson> = {};
    try {
      data = await response.json();
    } catch {
      // cuerpo vacío o no JSON
    }
    throw new ApiError({
      type: data.type ?? 'about:blank',
      title: data.title ?? response.statusText,
      status: response.status,
      code: data.code ?? 'UNKNOWN',
      detail: data.detail ?? 'No se pudo completar la solicitud.',
    });
  }
  return (await response.json()) as T;
}

export function getStaffMe(token: string): Promise<StaffMe> {
  return staffFetch<StaffMe>(token, '/staff/me');
}

export function saveStaffEvaluation(token: string, body: StaffEvaluationIn): Promise<StaffEvaluation> {
  return staffFetch<StaffEvaluation>(token, '/staff/evaluations', { method: 'PUT', body: JSON.stringify(body) });
}
