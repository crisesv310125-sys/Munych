import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';
import d1NextTagCache from '@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache';

/**
 * Despliegue en Cloudflare Workers con OpenNext.
 *
 * - Caché incremental (páginas ISR) en R2: binding NEXT_INC_CACHE_R2_BUCKET.
 * - Tag cache en D1 para que revalidatePath() del webhook /api/revalidate invalide
 *   las páginas: binding NEXT_TAG_CACHE_D1.
 * - Sin cola de revalidación: las páginas usan `revalidate = false` y solo se regeneran
 *   bajo demanda, así que no hace falta revalidación por tiempo.
 */
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  tagCache: d1NextTagCache,
});
