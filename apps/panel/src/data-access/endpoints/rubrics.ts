import { apiFetch } from '../apiClient';
import type { ApiRubric, RubricIn } from '../apiTypes';

/** `weight` es numeric(5,2) en la base: se fuerza a number por si el backend lo serializa como texto. */
export function normalizeRubric<T extends Pick<ApiRubric, 'criteria'>>(rubric: T): T {
  return { ...rubric, criteria: rubric.criteria.map((c) => ({ ...c, weight: Number(c.weight) })) };
}

export async function listEventRubrics(eventId: string): Promise<ApiRubric[]> {
  const rubrics = await apiFetch<ApiRubric[]>(`/events/${eventId}/rubrics`);
  return rubrics.map(normalizeRubric);
}

/** Rúbrica adicional del evento; un comité la usa mediante `rubric_id`. */
export async function createRubric(eventId: string, rubric: RubricIn): Promise<ApiRubric> {
  return normalizeRubric(await apiFetch<ApiRubric>(`/events/${eventId}/rubrics`, { method: 'POST', body: rubric }));
}

export async function getRubric(rubricId: string): Promise<ApiRubric> {
  return normalizeRubric(await apiFetch<ApiRubric>(`/rubrics/${rubricId}`));
}

/** Reemplaza la rúbrica completa: criterio con `id` se conserva, sin `id` se crea. Los pesos deben sumar 100. */
export async function replaceRubric(rubricId: string, rubric: RubricIn): Promise<ApiRubric> {
  return normalizeRubric(await apiFetch<ApiRubric>(`/rubrics/${rubricId}`, { method: 'PUT', body: rubric }));
}
