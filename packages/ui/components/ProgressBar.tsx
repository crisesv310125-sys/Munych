import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  percent: number;
  height?: number;
  color?: string;
  trackColor?: string;
  className?: string;
}

export function ProgressBar({ percent, height = 6, color = 'var(--gold)', trackColor, className }: ProgressBarProps) {
  const width = percent <= 0 ? 2.5 : Math.min(100, percent);
  const fillColor = percent <= 0 ? 'var(--state-none-dot)' : color;
  return (
    <div
      className={[styles.track, className].filter(Boolean).join(' ')}
      style={{ height, background: trackColor }}
    >
      <div className={styles.fill} style={{ width: `${width}%`, background: fillColor }} />
    </div>
  );
}
