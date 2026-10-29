'use client';

import { useEffect, useState } from 'react';
import styles from './public.module.css';

/** "Compartir" (hoja nativa del móvil o copiar enlace) y "Descargar PDF" (impresión del navegador). */
export function ShareActions({ title, pdf = false }: { title: string; pdf?: boolean }) {
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setToast('Enlace copiado');
    } catch {
      setToast('No se pudo copiar el enlace');
    }
  }

  return (
    <div className={styles.actions}>
      <button type="button" className={styles.ghostButton} onClick={share}>
        Compartir
      </button>
      {pdf && (
        <button type="button" className={styles.ghostButton} onClick={() => window.print()}>
          Descargar PDF
        </button>
      )}
      <button type="button" className={styles.iconButton} onClick={share} aria-label="Compartir">
        ↗
      </button>
      {toast && (
        <div role="status" className={styles.toast}>
          {toast}
        </div>
      )}
    </div>
  );
}
