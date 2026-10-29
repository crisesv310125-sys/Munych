'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import styles from './public.module.css';

export interface CommitteeLink {
  slug: string;
  name: string;
  acronym: string;
  pending: boolean;
}

/** "Cambiar comité ▾" (escritorio). En móvil se usan las pastillas de CommitteeChips. */
export function CommitteeSwitcher({ committees, current, eventHref }: { committees: CommitteeLink[]; current: string; eventHref: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (committees.length < 2) return null;

  return (
    <div className={styles.switcher} ref={ref}>
      <button type="button" className={styles.switcherButton} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        Cambiar comité <span className={styles.switcherCaret}>▾</span>
      </button>
      {open && (
        <div className={styles.switcherMenu}>
          {committees.map((c) => (
            <Link
              key={c.slug}
              href={`${eventHref}/${c.slug}`}
              className={`${styles.switcherItem} ${c.slug === current ? styles.switcherItemActive : ''}`}
              aria-current={c.slug === current ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              <span>{c.name}</span>
              {c.pending && <span className={styles.pillPending}>PENDIENTE</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Pastillas horizontales de comités (móvil, pantalla 2c). */
export function CommitteeChips({ committees, current, eventHref }: { committees: CommitteeLink[]; current: string; eventHref: string }) {
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, []);

  if (committees.length < 2) return null;

  return (
    <nav aria-label="Comités" className={styles.chips}>
      {committees.map((c) => {
        const active = c.slug === current;
        return (
          <Link
            key={c.slug}
            ref={active ? activeRef : undefined}
            href={`${eventHref}/${c.slug}`}
            className={`${styles.chip} ${active ? styles.chipActive : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {c.name.length > 22 ? c.acronym : c.name}
          </Link>
        );
      })}
    </nav>
  );
}
