import styles from './CriterionSlider.module.css';

function contribution(value: number, weight: number, min: number, max: number): number {
  const span = max - min || 1;
  return ((value - min) / span) * weight;
}

interface CriterionSliderProps {
  name: string;
  weight: number;
  value: number | undefined;
  onChange: (value: number) => void;
  /** Escala de la rúbrica; por defecto 0-100 (compatibilidad hacia atrás). */
  min?: number;
  max?: number;
  /** Descriptor del nivel actualmente seleccionado (p. ej. de una rúbrica 1-4). */
  descriptor?: string;
}

export function CriterionSlider({ name, weight, value, onChange, min = 0, max = 100, descriptor }: CriterionSliderProps) {
  const current = value ?? min;
  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <div className={styles.nameRow}>
          <span className={styles.name}>{name}</span>
          <span className={styles.weight}>{weight}%</span>
        </div>
        <span className={styles.value}>{current}</span>
      </div>
      <input
        type="range"
        className="sl"
        min={min}
        max={max}
        step={1}
        value={current}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className={styles.scaleRow}>
        <span>{min}</span>
        <span>aporta {contribution(current, weight, min, max).toFixed(1)} pts</span>
        <span>{max}</span>
      </div>
      {descriptor && (
        <span style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{descriptor}</span>
      )}
    </div>
  );
}
