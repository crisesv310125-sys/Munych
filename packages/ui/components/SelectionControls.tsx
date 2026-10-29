import styles from './SelectionControls.module.css';

export function Checkbox({ checked, onClick }: { checked: boolean; onClick?: () => void }) {
  return (
    <span
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      className={[styles.checkbox, checked ? styles.checkboxChecked : ''].filter(Boolean).join(' ')}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick?.()}
    >
      {checked && '✓'}
    </span>
  );
}

export function Toggle({ checked, onClick }: { checked: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={[styles.toggle, checked ? styles.toggleOn : ''].filter(Boolean).join(' ')}
      onClick={onClick}
    >
      <span className={styles.thumb} />
    </button>
  );
}
