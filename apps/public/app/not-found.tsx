import Link from 'next/link';
import { Button } from '@munych/ui/components/Button';

export default function NotFound() {
  return (
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
      <Link href="/es">
        <Button>Ver eventos publicados</Button>
      </Link>
    </main>
  );
}
