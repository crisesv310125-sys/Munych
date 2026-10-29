import type { Criterion, ScoreEntry, ScoreStatus } from '../types';

export function weightedTotal(
  values: Record<string, number>,
  criteria: Criterion[],
): number {
  return criteria.reduce((sum, c) => sum + ((values[c.id] ?? 0) * c.weight) / 100, 0);
}

export function contribution(value: number, weight: number): number {
  return (value * weight) / 100;
}

export function scoreStatus(values: Record<string, number>, criteria: Criterion[]): ScoreStatus {
  const scored = criteria.filter((c) => values[c.id] !== undefined).length;
  if (scored === 0) return 'none';
  if (scored === criteria.length) return 'done';
  return 'progress';
}

export function statusLabel(status: ScoreStatus, scoredCount: number, total: number): string {
  if (status === 'done') return `Completo · ${total} criterios`;
  if (status === 'progress') return `En progreso · ${scoredCount} de ${total}`;
  return 'Sin calificar';
}

export function emptyEntry(): ScoreEntry {
  return { values: {}, comment: '', status: 'none', completedByJudge: false, updatedAt: Date.now() };
}

/** Redondeada a 2 decimales (los pesos son numeric(5,2)) para que 33.33+33.33+33.34 dé exactamente 100. */
export function sumWeights(criteria: Array<Pick<Criterion, 'weight'>>): number {
  return Math.round(criteria.reduce((sum, c) => sum + c.weight, 0) * 100) / 100;
}

const WEIGHT_SCALE = [
  'var(--weight-1)',
  'var(--weight-2)',
  'var(--weight-3)',
  'var(--weight-4)',
  'var(--weight-5)',
  'var(--weight-6)',
  'var(--weight-7)',
];

export function weightColor(index: number): string {
  return WEIGHT_SCALE[index % WEIGHT_SCALE.length];
}
