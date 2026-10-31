import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { getDictionary, isLocale, LOCALES } from '../../lib/i18n';
import { FontLinks } from '../../components/FontLinks';

// Export estático: se genera una copia del sitio por idioma.
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = getDictionary(locale);
  return { title: t.meta.title, description: t.meta.description };
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html lang={locale}>
      <head>
        <FontLinks />
      </head>
      <body>{children}</body>
    </html>
  );
}
