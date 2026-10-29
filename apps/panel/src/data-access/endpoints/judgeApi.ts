import { apiFetch } from '../apiClient';
import type { JudgeCommitteeDetail, JudgeCommitteeSummary, JudgeScore, ScoreBatchItem, ScoreBatchResponse } from '../apiTypes';
import { normalizeRubric } from './rubrics';

export function getJudgeCommittees(): Promise<JudgeCommitteeSummary[]> {
  return apiFetch<JudgeCommitteeSummary[]>('/judge/committees');
}

export async function getJudgeCommittee(committeeId: string): Promise<JudgeCommitteeDetail> {
  const detail = await apiFetch<JudgeCommitteeDetail>(`/judge/committees/${committeeId}`);
  return { ...detail, rubric: detail.rubric ? normalizeRubric(detail.rubric) : null };
}

/** Solo las calificaciones del juez autenticado, nunca las de otros jueces. */
export function getSessionScores(sessionId: string): Promise<JudgeScore[]> {
  return apiFetch<JudgeScore[]>(`/judge/sessions/${sessionId}/scores`);
}

/** Lote idempotente de 1 a 500 ítems; cada ítem se valida por separado. */
export function submitScoresBatch(items: ScoreBatchItem[]): Promise<ScoreBatchResponse> {
  return apiFetch<ScoreBatchResponse>('/judge/scores/batch', { method: 'POST', body: { items } });
}
