/**
 * Etiqueta de Google (Google Tag Manager, contenedor GTM-5M3ZXFDD), tal como la entrega Google:
 * va al principio del <head> de cada página. Una sola vez por página: la ponen
 * app/[locale]/layout.tsx (todas las páginas con idioma) y app/not-found.tsx (404.html).
 *
 * Solo en la página pública: el panel no la lleva porque sus URLs de votación y del staff
 * incluyen el token de acceso.
 */
export const GTM_ID = 'GTM-5M3ZXFDD';

export function GoogleTag() {
  return (
    <>
      <script async src={`https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`} />
      <script
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: "window.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());",
        }}
      />
    </>
  );
}
