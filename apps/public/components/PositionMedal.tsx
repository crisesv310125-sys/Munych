import styles from './public.module.css';

const TIER = [styles.medal1, styles.medal2, styles.medal3];

/** Círculo oro / plata / bronce (resto: neutro). El tamaño lo da `className`. */
export function PositionMedal({ position, className, size }: { position: number; className?: string; size?: number }) {
  const sizeStyle = size ? { width: size, height: size, fontSize: Math.round(size * 0.42) } : undefined;
  return (
    <span className={`${styles.medal} ${TIER[position - 1] ?? ''} ${className ?? ''}`} style={sizeStyle} aria-hidden="true">
      {position}
    </span>
  );
}
