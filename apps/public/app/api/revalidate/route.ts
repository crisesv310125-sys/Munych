import { revalidatePath } from 'next/cache';
import { timingSafeEqual, createHmac } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Webhook de revalidación bajo demanda (sección 6.6 del prompt): el backend FastAPI llama
 * aquí tras publicar/despublicar un evento. Verifica la firma HMAC-SHA256 con comparación de
 * tiempo constante y revalida la ruta del evento y la lista de inicio.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ revalidated: false, error: 'REVALIDATE_SECRET no configurado' }, { status: 500 });
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get('x-signature') ?? '';
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;

  const provided = Buffer.from(signatureHeader);
  const expectedBuf = Buffer.from(expected);
  const valid = provided.length === expectedBuf.length && timingSafeEqual(provided, expectedBuf);
  if (!valid) {
    return NextResponse.json({ revalidated: false, error: 'Firma inválida' }, { status: 401 });
  }

  let eventSlug: string | undefined;
  try {
    eventSlug = JSON.parse(rawBody).event_slug;
  } catch {
    return NextResponse.json({ revalidated: false, error: 'Cuerpo inválido' }, { status: 400 });
  }
  if (!eventSlug) {
    return NextResponse.json({ revalidated: false, error: 'Falta event_slug' }, { status: 400 });
  }

  // Revalida la lista de eventos y la página del evento (locale 'es' por ahora, sección 10).
  revalidatePath('/es');
  revalidatePath(`/es/${eventSlug}`);
  // Los comités se revalidan por el patrón de la ruta: no se puede mezclar un segmento
  // concreto con uno dinámico ('/es/x/[committeeSlug]' no coincide con ninguna página).
  // Esto incluye los comités de otros eventos, que se regeneran en su siguiente visita.
  revalidatePath('/[locale]/[eventSlug]/[committeeSlug]', 'page');

  return NextResponse.json({ revalidated: true });
}
