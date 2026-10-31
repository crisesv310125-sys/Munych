'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getDictionary, localizedPath, type Locale } from '../lib/i18n';
import styles from './public.module.css';

/** Enlace a la misma página en el otro idioma: texto en escritorio, código ("EN") en móvil. */
export function LanguageSwitch({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const other: Locale = locale === 'es' ? 'en' : 'es';
  const href = localizedPath(pathname, other);
  const t = getDictionary(locale);

  return (
    <>
      <Link href={href} hrefLang={other} lang={other} className={styles.ghostButton}>
        {t.lang.switchTo}
      </Link>
      <Link href={href} hrefLang={other} lang={other} className={styles.iconButton} aria-label={t.lang.switchTo}>
        {t.lang.short}
      </Link>
    </>
  );
}
