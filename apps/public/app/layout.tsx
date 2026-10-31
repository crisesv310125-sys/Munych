import '@munych/ui/styles/tokens.css';
import '@munych/ui/styles/global.css';

/*
 * El <html lang> depende del idioma, así que lo pone app/[locale]/layout.tsx. Este layout solo
 * pasa los hijos; app/page.tsx (redirección) y app/not-found.tsx dibujan su propio <html>.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
