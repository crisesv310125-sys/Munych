'use client';

import { useEffect, useState } from 'react';
import { Button } from '@munych/ui/components/Button';
import { getDictionary, type Locale } from '../lib/i18n';
import { CONSENT_KEY } from './GoogleTag';
import styles from './CookieConsent.module.css';

type Choice = 'granted' | 'denied';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

function readChoice(): Choice | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null; // navegación privada o almacenamiento bloqueado: se vuelve a preguntar
  }
}

function applyChoice(choice: Choice) {
  try {
    localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    // sin almacenamiento: la elección vale solo para esta visita
  }
  // Modo de consentimiento de Google (los valores por defecto los pone GoogleTag: denegado).
  window.gtag?.('consent', 'update', { analytics_storage: choice });
}

/**
 * Decisión de diseño (2026-11-10): aviso de cookies de la página pública. Barra fija abajo con
 * «Aceptar» / «Rechazar» (mismos `Button` y tokens del sitio); mientras no se acepte, Google
 * no usa cookies (modo de consentimiento, ver GoogleTag.tsx). Tras elegir, queda un enlace
 * discreto «Preferencias de cookies» para cambiar de opinión.
 */
export function CookieConsent({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).cookies;
  // null = aún no se sabe (servidor / primera pintura): no se muestra nada hasta montar.
  const [choice, setChoice] = useState<Choice | null | 'unknown'>('unknown');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const stored = readChoice();
    setChoice(stored);
    setOpen(stored === null);
  }, []);

  if (choice === 'unknown') return null;

  function decide(next: Choice) {
    applyChoice(next);
    setChoice(next);
    setOpen(false);
  }

  if (!open) {
    return (
      <button type="button" className={styles.manage} onClick={() => setOpen(true)}>
        {t.manage}
      </button>
    );
  }

  return (
    <div className={styles.banner} role="region" aria-label={t.label}>
      <p className={styles.text}>{t.text}</p>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => decide('denied')}>
          {t.reject}
        </Button>
        <Button onClick={() => decide('granted')}>{t.accept}</Button>
      </div>
    </div>
  );
}
