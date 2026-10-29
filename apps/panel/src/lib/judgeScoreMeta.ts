import type { ApiCriterion, JudgeScore } from '../data-access/apiTypes';

export type DelegateScoreStatus = 'none' | 'progress' | 'done';

export interface DelegateScoreMeta {
  status: DelegateScoreStatus;
  label: string;
  color: string;
  scorePercent: number;
  scoreColor: string;
  hasScore: boolean;
  valuesByCriterion: Record<string, number>;
}

/** Lo mínimo de una rúbrica que hace falta para puntuar (RubricOut o la rúbrica de JudgeCommitteeDetailOut). */
export interface ScoringRubric {
  scale_min: number;
  scale_max: number;
  criteria: ApiCriterion[];
}

const COLORS = {
  none: 'var(--state-none-dot)',
  progress: 'var(--state-progress-dot)',
  done: 'var(--state-done-dot)',
};

/** Nota ponderada igual que el motor del backend (routes.md 3.7): Σ (value / scale_max) × weight, de 0 a 100. */
export function delegateScoreMeta(delegateId: string, scores: JudgeScore[], rubric: ScoringRubric): DelegateScoreMeta {
  const mine = scores.filter((s) => s.delegate_id === delegateId);
  const valuesByCriterion: Record<string, number> = {};
  mine.forEach((s) => {
    valuesByCriterion[s.criterion_id] = s.value;
  });
  const scoredCount = rubric.criteria.filter((c) => valuesByCriterion[c.id] !== undefined).length;
  const status: DelegateScoreStatus = scoredCount === 0 ? 'none' : scoredCount === rubric.criteria.length ? 'done' : 'progress';
  const label =
    status === 'done'
      ? `Completo · ${rubric.criteria.length} criterios`
      : status === 'progress'
        ? `En progreso · ${scoredCount} de ${rubric.criteria.length}`
        : 'Sin calificar';
  const scaleMax = rubric.scale_max || 1;
  const scorePercent = rubric.criteria.reduce((sum, c) => {
    const value = valuesByCriterion[c.id];
    if (value === undefined) return sum;
    return sum + (value / scaleMax) * c.weight;
  }, 0);
  return {
    status,
    label,
    color: COLORS[status],
    scorePercent: Math.round(scorePercent * 10) / 10,
    scoreColor: status === 'none' ? 'var(--state-none-dot)' : 'var(--navy)',
    hasScore: status !== 'none',
    valuesByCriterion,
  };
}

export function levelDescriptor(criterion: ApiCriterion, value: number): string {
  return criterion.level_descriptors[String(value)] ?? '';
}
