import styles from './AutosaveIndicator.module.css';

export type SaveState = 'saved' | 'saving' | 'error';

/** `label` sustituye el texto por defecto (p. ej. para guardado manual en vez de automático). */
export function AutosaveIndicator({ state, label }: { state: SaveState; label?: string }) {
  const defaultLabel =
    state === 'saving'
      ? 'Guardando…'
      : state === 'error'
        ? 'No se pudo guardar · reintentando…'
        : 'Guardado automáticamente · hace un momento';
  return (
    <div className={`${styles.row} ${styles[state]}`}>
      <span className={styles.dot} />
      <span>{label ?? defaultLabel}</span>
    </div>
  );
}
