import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@munych/ui/components/Button';
import styles from '../pages/admin/AdminShared.module.css';

export interface ConfirmDialogAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

interface ConfirmDialogProps {
  title: string;
  message: string;
  /** De izquierda a derecha; la última es la principal y recibe el foco. */
  actions: ConfirmDialogAction[];
  /** Cerrar con la X, con Escape o haciendo clic fuera. */
  onClose: () => void;
}

/**
 * Diálogo de confirmación con el mismo diseño que los modales del panel de admin
 * (AdminShared.module.css: overlay + modalCard). Se pinta en <body> para quedar siempre encima.
 */
export function ConfirmDialog({ title, message, actions, onClose }: ConfirmDialogProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    cardRef.current?.querySelector<HTMLButtonElement>('[data-primary]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return createPortal(
    <div className={styles.overlay} style={{ zIndex: 1000 }} onClick={onClose}>
      <div
        ref={cardRef}
        className={`${styles.dialog} ${styles.modalCard}`}
        style={{ maxWidth: 460 }}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <span
            id="confirm-dialog-title"
            style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)' }}
          >
            {title}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--state-none-dot)', fontSize: 16, cursor: 'pointer' }}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className={styles.modalBody}>
          <span id="confirm-dialog-message" style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--ink)' }}>
            {message}
          </span>
        </div>
        <div className={styles.modalFooter} style={{ flexWrap: 'wrap' }}>
          {actions.map((action, i) => (
            <Button
              key={action.label}
              data-primary={i === actions.length - 1 ? '' : undefined}
              variant={action.variant ?? 'secondary'}
              disabled={action.disabled}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
