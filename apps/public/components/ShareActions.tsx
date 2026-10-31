'use client';

import { useEffect, useState } from 'react';
import { getDictionary, type Locale } from '../lib/i18n';
import styles from './public.module.css';

/** "Compartir" (hoja nativa del móvil o copiar enlace) y "Descargar PDF" (impresión del navegador). */
export function ShareActions({ locale, title, pdf = false }: { locale: Locale; title: string; pdf?: boolean }) {
  const t = getDictionary(locale).share;
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
      setToast(t.copied);
    } catch {
      setToast(t.copyFailed);
    }
  }

  return (
    <div className={styles.actions}>
      <button type="button" className={styles.ghostButton} onClick={share}>
        {t.share}
      </button>
      {pdf && (
        <button type="button" className={styles.ghostButton} onClick={() => window.print()}>
          {t.pdf}
        </button>
      )}
      <button type="button" className={styles.iconButton} onClick={share} aria-label={t.share}>
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
