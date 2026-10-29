import styles from './StatusBadge.module.css';

export type BadgeTone = 'none' | 'progress' | 'done';

export function StatusBadge({ tone, label }: { tone: BadgeTone; label: string }) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`}>
      <span className={styles.dot} />
      {label}
    </span>
  );
}

export function committeeStatusTone(status: 'sin-iniciar' | 'en-curso' | 'cerrado'): BadgeTone {
  if (status === 'cerrado') return 'done';
  if (status === 'en-curso') return 'progress';
  return 'none';
}

export function committeeStatusLabel(status: 'sin-iniciar' | 'en-curso' | 'cerrado'): string {
  if (status === 'cerrado') return 'Cerrado';
  if (status === 'en-curso') return 'En curso';
  return 'Sin iniciar';
}

export function eventStatusTone(status: 'planificacion' | 'en-curso' | 'finalizado'): BadgeTone {
  if (status === 'finalizado') return 'done';
  if (status === 'en-curso') return 'progress';
  return 'none';
}

export function eventStatusLabel(status: 'planificacion' | 'en-curso' | 'finalizado'): string {
  if (status === 'finalizado') return 'Finalizado';
  if (status === 'en-curso') return 'En curso';
  return 'Planificación';
}
