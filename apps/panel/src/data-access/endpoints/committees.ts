import { apiFetch, apiFetchAll } from '../apiClient';
import type { ApiCommittee, CommitteeDraft, CommitteeProgress, CommitteeUpdate } from '../apiTypes';

export function listCommittees(eventId: string): Promise<ApiCommittee[]> {
  return apiFetchAll<ApiCommittee>(`/events/${eventId}/committees`);
}

/** Crea también las sesiones 1..sessions_count (cerradas). */
export function createCommittee(eventId: string, draft: CommitteeDraft): Promise<ApiCommittee> {
  return apiFetch<ApiCommittee>(`/events/${eventId}/committees`, { method: 'POST', body: draft });
}

export function getCommittee(committeeId: string): Promise<ApiCommittee> {
  return apiFetch<ApiCommittee>(`/committees/${committeeId}`);
}

export function updateCommittee(committeeId: string, patch: CommitteeUpdate): Promise<ApiCommittee> {
  return apiFetch<ApiCommittee>(`/committees/${committeeId}`, { method: 'PATCH', body: patch });
}

export function deleteCommittee(committeeId: string): Promise<void> {
  return apiFetch<void>(`/committees/${committeeId}`, { method: 'DELETE' });
}

export function getCommitteeProgress(committeeId: string): Promise<CommitteeProgress> {
  return apiFetch<CommitteeProgress>(`/committees/${committeeId}/progress`);
}
