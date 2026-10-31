import { apiFetch, apiFetchAll } from '../apiClient';
import type {
  ApiJudge,
  ApiJudgeInvitation,
  CommitteeJudgeAssignment,
  CommitteeJudgeAssignmentOut,
  JudgeInvite,
  JudgeUpdate,
} from '../apiTypes';

const eventQuery = (eventId?: string) => (eventId ? `?event_id=${encodeURIComponent(eventId)}` : '');

/** Solo jueces que ya aceptaron la invitación. Con `eventId`, solo los de ese evento. */
export function listJudges(eventId?: string): Promise<ApiJudge[]> {
  return apiFetchAll<ApiJudge>(`/judges${eventQuery(eventId)}`);
}

export function listJudgeInvitations(eventId?: string): Promise<ApiJudgeInvitation[]> {
  return apiFetchAll<ApiJudgeInvitation>(`/judges/invitations${eventQuery(eventId)}`);
}

/** Reenvía el correo de invitación (409 CONFLICT si el juez ya la aceptó). */
export function resendJudgeInvitation(judgeId: string): Promise<ApiJudgeInvitation> {
  return apiFetch<ApiJudgeInvitation>(`/judges/${judgeId}/invitation`, { method: 'POST' });
}

export function inviteJudge(invite: JudgeInvite): Promise<ApiJudge> {
  return apiFetch<ApiJudge>('/judges', { method: 'POST', body: invite });
}

export function updateJudge(judgeId: string, patch: JudgeUpdate): Promise<ApiJudge> {
  return apiFetch<ApiJudge>(`/judges/${judgeId}`, { method: 'PATCH', body: patch });
}

export function getCommitteeJudges(committeeId: string): Promise<CommitteeJudgeAssignmentOut[]> {
  return apiFetch<CommitteeJudgeAssignmentOut[]>(`/committees/${committeeId}/judges`);
}

/** Reemplaza todas las asignaciones del comité. Solo se envían `judge_id` y `role`. */
export function setCommitteeJudges(
  committeeId: string,
  assignments: CommitteeJudgeAssignment[],
): Promise<CommitteeJudgeAssignmentOut[]> {
  const body: CommitteeJudgeAssignment[] = assignments.map(({ judge_id, role }) => ({ judge_id, role: role ?? 'judge' }));
  return apiFetch<CommitteeJudgeAssignmentOut[]>(`/committees/${committeeId}/judges`, { method: 'PUT', body });
}
