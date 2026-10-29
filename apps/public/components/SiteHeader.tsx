import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './public.module.css';

const MUNYCH_LOGO = '/brand/munych-logo.png';

export interface Crumb {
  label: string;
  href?: string;
}

function Logo({ src }: { src: string | null }) {
  return (
    <span className={styles.logo}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src ?? MUNYCH_LOGO} alt="" />
    </span>
  );
}

/** Barra superior del portal: marca MUNYCH + enlace al sitio. */
export function PortalTopbar() {
  return (
    <div className={`${styles.topbar} ${styles.gutter}`}>
      <div className={styles.brand}>
        <Logo src={MUNYCH_LOGO} />
        <div>
          <div className={styles.brandName}>MUNYCH</div>
          <div className={styles.brandTag}>RESULTADOS OFICIALES</div>
          <span className={`${styles.brandMobileTag} ${styles.mobileOnly}`}>MUNYCH · RESULTADOS</span>
        </div>
      </div>
      <a className={styles.siteLink} href="https://munych.org" target="_blank" rel="noreferrer">
        munych.org
      </a>
    </div>
  );
}

/** Cabecera navy de evento y comité: logo + migas (en móvil, solo "MUNYCH") + acciones. */
export function SiteHeader({
  logoUrl,
  homeHref,
  crumbs,
  actions,
  className,
  children,
}: {
  logoUrl: string | null;
  homeHref: string;
  crumbs: Crumb[];
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <header className={`${styles.header} ${styles.gutter} ${className ?? ''}`}>
      <div className={`${styles.topbar} ${styles.topbarRule}`}>
        <div className={styles.brand}>
          <Link href={homeHref} className={styles.logoLink} aria-label="Todos los eventos">
            <Logo src={logoUrl} />
          </Link>
          <span className={`${styles.brandMobileTag} ${styles.mobileOnly}`}>MUNYCH</span>
          <nav aria-label="Ruta" className={`${styles.crumbs} ${styles.desktopOnly}`}>
            {crumbs.map((crumb, i) => (
              <span key={crumb.label + i}>
                {i > 0 && <span className={styles.crumbSep}>/</span>}
                {i === crumbs.length - 1 ? (
                  <b className={styles.crumbCurrent} aria-current="page">
                    {crumb.label}
                  </b>
                ) : crumb.href ? (
                  <Link href={crumb.href}>{crumb.label}</Link>
                ) : (
                  crumb.label
                )}
              </span>
            ))}
          </nav>
        </div>
        {actions}
      </div>
      {children}
    </header>
  );
}
