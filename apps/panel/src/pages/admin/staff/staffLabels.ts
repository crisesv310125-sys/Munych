import type { BadgeTone } from '../../../lib/statusLabels';
import type { StaffAccess, StaffAward, StaffCountsAs, StaffEvaluates } from '../../../data-access/staffTypes';

export const EVALUATES: Record<StaffEvaluates, { label: string; candidates: string; desc: string }> = {
  delegations: {
    label: 'Delegaciones',
    candidates: 'Delegaciones',
    desc: 'Una nota por país o personaje (p. ej. pajes, protocolo).',
  },
  delegates: {
    label: 'Delegados individuales',
    candidates: 'Delegados',
    desc: 'Una nota por persona; en delegaciones dobles, por separado.',
  },
  position_papers: {
    label: 'Escritos de posición',
    candidates: 'Escritos de posición',
    desc: 'Un documento por delegación; se califica el escrito, no la sesión.',
  },
  press: {
    label: 'Delegados de prensa',
    candidates: 'Delegados de prensa',
    desc: 'Los delegados de los comités de prensa del alcance (p. ej. Cuerpo de Prensa).',
  },
};

export const COUNTS_AS: Record<StaffCountsAs, string> = {
  none: 'Solo premios',
  staff: 'Nota staff',
  chair: 'Nota mesa',
};

export const ACCESS: Record<StaffAccess, { label: string; tone: BadgeTone }> = {
  not_invited: { label: 'SIN INVITAR', tone: 'none' },
  invited: { label: 'INVITADO', tone: 'progress' },
  active: { label: 'ACTIVO', tone: 'done' },
  expired: { label: 'VENCIDO', tone: 'none' },
};

export function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

export function awardScopeLabel(award: Pick<StaffAward, 'scope'>): string {
  return award.scope === 'per_committee' ? 'Por comité' : 'Todo el evento';
}

/** «Mayor nota de la rúbrica» para el primer premio; «Siguientes N notas» para el resto. */
export function selectionLabel(awards: StaffAward[], index: number): string {
  const award = awards[index];
  if (index === 0) return award.winners === 1 ? 'Mayor nota de la rúbrica' : `Las ${award.winners} mayores notas`;
  return award.winners === 1 ? 'Siguiente nota' : `Siguientes ${award.winners} notas`;
}

export function committeesLabel(ids: string[], committees: { id: string; acronym: string }[]): string {
  if (ids.length === 0) return 'Todos los comités';
  const names = committees.filter((c) => ids.includes(c.id)).map((c) => c.acronym);
  return names.length ? names.join(' · ') : 'Todos los comités';
}

/** Prefijo del enlace del staff: esta misma app, en la ruta pública #/staff/evaluar/<token>. */
export function staffLinkBase(): string {
  return `${window.location.origin}${window.location.pathname}#/staff/evaluar/`;
}

/** Peso del tipo en el ranking según el tipo de evento (p. ej. «Cuenta 20 % en nota staff»). */
export function countsLabel(countsAs: StaffCountsAs, staffWeight: number | null, chairWeight: number | null): string {
  if (countsAs === 'staff') return staffWeight ? `Cuenta ${formatNumber(staffWeight)} % en nota staff` : 'Nota staff (no aplica)';
  if (countsAs === 'chair') return chairWeight ? `Cuenta ${formatNumber(chairWeight)} % en nota mesa` : 'Nota mesa (no aplica)';
  return 'Solo premios';
}
