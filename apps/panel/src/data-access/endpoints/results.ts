import { apiFetch } from '../apiClient';
import type { Award, AwardsResponse, RankingResponse } from '../apiTypes';

export function getRanking(committeeId: string): Promise<RankingResponse> {
  return apiFetch<RankingResponse>(`/committees/${committeeId}/ranking`);
}

export function getAwards(committeeId: string): Promise<AwardsResponse> {
  return apiFetch<AwardsResponse>(`/committees/${committeeId}/awards`);
}

/** Reemplaza todos los premios del comité; superar un cupo solo añade avisos a `quota_warnings`. */
export function setAwards(committeeId: string, awards: Award[]): Promise<AwardsResponse> {
  return apiFetch<AwardsResponse>(`/committees/${committeeId}/awards`, { method: 'PUT', body: awards });
}
