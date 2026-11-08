import type { ReactNode } from 'react';
import { StatusBadge } from '@munych/ui/components/StatusBadge';
import type { BadgeTone } from '../../../lib/statusLabels';
import type { StaffMemberRole, StaffTypeStatus, StaffTypeSummary } from '../../../data-access/staffTypes';
import { formatNumber } from './staffLabels';
import styles from './Staff.module.css';

// Los textos y funciones (EVALUATES, ACCESS, formatNumber…) viven en staffLabels.ts:
// este archivo solo exporta componentes (fast refresh).

const STATUS: Record<Exclude<StaffTypeStatus, 'invalid_rubric'>, { label: string; tone: BadgeTone }> = {
  not_configured: { label: 'SIN CONFIGURAR', tone: 'none' },
  not_started: { label: 'SIN INICIAR', tone: 'none' },
  in_progress: { label: 'EN CURSO', tone: 'progress' },
  complete: { label: 'COMPLETO', tone: 'done' },
};

export function StaffTypeTag({ code, color, large }: { code: string; color: string; large?: boolean }) {
  return (
    <span className={`${styles.tag} ${large ? styles.tagLarge : ''}`} style={{ background: color }}>
      {code}
    </span>
  );
}

export function ErrorBadge({ label }: { label: string }) {
  return <span className={styles.errorBadge}>{label}</span>;
}

export function TypeStatusBadge({ type }: { type: Pick<StaffTypeSummary, 'status' | 'weight_sum'> }) {
  if (type.status === 'invalid_rubric') return <ErrorBadge label={`SUMA ${formatNumber(type.weight_sum)} %`} />;
  const s = STATUS[type.status];
  return <StatusBadge tone={s.tone} label={s.label} />;
}

export function RubricBadge({ valid, sum }: { valid: boolean; sum: number }) {
  if (valid) return <StatusBadge tone="done" label="VÁLIDA" />;
  return <ErrorBadge label={sum === 0 ? 'SIN CRITERIOS' : `SUMA ${formatNumber(sum)} %`} />;
}

export function RoleChip({ role, title }: { role: StaffMemberRole; title?: string | null }) {
  const label = role === 'coordinator' ? 'Coordinación' : 'Evaluación';
  return (
    <span className={`${styles.roleChip} ${role === 'coordinator' ? styles.roleChipCoordinator : ''}`} title={title ?? undefined}>
      {label}
    </span>
  );
}

export function AwardChip({ children, tone }: { children: ReactNode; tone?: 'gold' | 'green' }) {
  const cls = tone === 'gold' ? styles.awardChipGold : tone === 'green' ? styles.awardChipGreen : '';
  return <span className={`${styles.awardChip} ${cls}`}>{children}</span>;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.segmented} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`${styles.segment} ${value === o.value ? styles.segmentActive : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function OptionCard({
  title,
  desc,
  active,
  onClick,
}: {
  title: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      className={`${styles.optionCard} ${active ? styles.optionCardActive : ''}`}
      onClick={onClick}
    >
      <span className={styles.radio} />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span className={styles.optionTitle}>{title}</span>
        <span className={styles.optionDesc}>{desc}</span>
      </span>
    </button>
  );
}

/** Selector del evento de contexto (avance, candidatos y premios) en el admin general. */
export function EventPicker({
  events,
  value,
  onChange,
}: {
  events: { id: string; name: string; status: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  if (events.length === 0) return null;
  return (
    <select
      className={styles.input}
      style={{ width: 'auto', minWidth: 200 }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Evento para avance y premios"
      title="Evento para ver avance, candidatos y premios"
    >
      {events.map((e) => (
        <option key={e.id} value={e.id}>
          {e.name}
          {e.status === 'closed' ? ' (cerrado)' : e.status === 'draft' ? ' (borrador)' : ''}
        </option>
      ))}
    </select>
  );
}

export function Counter({ value, min = 1, max = 20, onChange }: { value: number; min?: number; max?: number; onChange: (v: number) => void }) {
  return (
    <div className={styles.counter}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Menos">
        −
      </button>
      <span>{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label="Más">
        +
      </button>
    </div>
  );
}
