import { supabasePublic } from './supabasePublic';
import { MOCK_PUBLIC_DOCUMENTS } from './mockPublicData';
import type { PublicResultsDocument } from './types';

/** Por defecto lee public.public_results en Supabase; con NEXT_PUBLIC_USE_MOCKS=true usa mockPublicData.ts. */
const useMocks = process.env.NEXT_PUBLIC_USE_MOCKS === 'true';

/** Documentos de todos los eventos publicados (el portal muestra premios del más reciente). */
export async function getPublishedDocuments(): Promise<PublicResultsDocument[]> {
  if (useMocks) {
    return Object.values(MOCK_PUBLIC_DOCUMENTS);
  }
  const { data, error } = await supabasePublic.from('public_results').select('data').eq('published', true);
  if (error) {
    // eslint-disable-next-line no-console
    console.error('No se pudieron leer los eventos publicados:', error.message);
    return [];
  }
  if (!data) return [];
  return (data as { data: PublicResultsDocument }[]).map((row) => row.data);
}

export async function getEventDocument(eventSlug: string): Promise<PublicResultsDocument | null> {
  if (useMocks) {
    return MOCK_PUBLIC_DOCUMENTS[eventSlug] ?? null;
  }
  const { data, error } = await supabasePublic
    .from('public_results')
    .select('data')
    .eq('event_slug', eventSlug)
    .eq('published', true)
    .maybeSingle();
  if (error) {
    // eslint-disable-next-line no-console
    console.error(`No se pudo leer el evento "${eventSlug}":`, error.message);
    return null;
  }
  if (!data) return null;
  return (data as { data: PublicResultsDocument }).data;
}
