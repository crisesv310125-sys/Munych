/**
 * Etiqueta de Google (Google Tag Manager, contenedor GTM-5M3ZXFDD), tal como la entrega Google:
 * va al principio del <head> de cada página. Una sola vez por página: la ponen
 * app/[locale]/layout.tsx (todas las páginas con idioma) y app/not-found.tsx (404.html).
 *
 * Modo de consentimiento de Google: todo empieza **denegado** (no se usan cookies de medición
 * ni de anuncios) y solo se concede si la persona acepta en el aviso de cookies
 * (components/CookieConsent.tsx). Si ya eligió antes, su elección se aplica aquí, antes de
 * cargar Tag Manager. Hay menores entre los participantes: por eso el valor por defecto es «no».
 *
 * Solo en la página pública: el panel no la lleva porque sus URLs de votación y del staff
 * incluyen el token de acceso.
 */
export const GTM_ID = 'GTM-5M3ZXFDD';
export const CONSENT_KEY = 'munych.cookie-consent';

const CONSENT_DEFAULTS = `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  wait_for_update: 500
});
try {
  if (localStorage.getItem('${CONSENT_KEY}') === 'granted') {
    gtag('consent', 'update', { analytics_storage: 'granted' });
  }
} catch (e) {}
gtag('js', new Date());`;

export function GoogleTag() {
  return (
    <>
      {/* Primero el consentimiento (denegado por defecto), después Tag Manager. */}
      <script
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: CONSENT_DEFAULTS }}
      />
      <script async src={`https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`} />
    </>
  );
}
