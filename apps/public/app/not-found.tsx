import Link from 'next/link';
import { Button } from '@munych/ui/components/Button';
import { FontLinks } from '../components/FontLinks';
import { GoogleTag } from '../components/GoogleTag';

// Es el 404.html único del export estático, así que no sabe el idioma: muestra ambos.
export default function NotFound() {
  return (
    <html lang="es">
      <head>
        <GoogleTag />
        <title>404 · MUNYCH</title>
        <FontLinks />
      </head>
      <body>
        <main
          style={{
            minHeight: '100svh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            background: 'var(--bg)',
            padding: 24,
            textAlign: 'center',
          }}
        >
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 600, color: 'var(--navy)' }}>
            No encontramos este evento
          </span>
          <span style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 420 }}>
            El evento no existe o todavía no tiene resultados publicados.
          </span>
          <span lang="en" style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 420 }}>
            This event does not exist or has no published results yet.
          </span>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link href="/es">
              <Button>Ver eventos publicados</Button>
            </Link>
            <Link href="/en" lang="en">
              <Button variant="secondary">View published events</Button>
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
