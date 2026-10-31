import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache';

/**
 * Despliegue en Cloudflare Workers con OpenNext, sin R2 ni D1.
 * Las páginas ISR se pregeneran en el build y se sirven desde los assets (solo lectura).
 * Para actualizar resultados hay que volver a desplegar.
 */
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});