import { createClient, type Session as SupabaseSession } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    'Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copia .env.example a .env.local y complétalas. ' +
      'Mientras tanto, la autenticación no funcionará.',
  );
}

/**
 * Los enlaces de invitación y de acceso de Supabase vuelven con la sesión en el fragmento
 * (`#access_token=…&refresh_token=…` o `#error=…`). El panel usa HashRouter, que tomaría ese fragmento
 * como una ruta desconocida y redirigiría a /login antes de que Supabase lo leyera. Por eso se lee
 * aquí (este módulo se evalúa antes de crear el router) y se reemplaza por la ruta que toca:
 * invitación o recuperación (`type=invite|recovery`) → `#/crear-contrasena`; el resto → `#/login`.
 */
let linkType: 'invite' | 'recovery' | null = null;

function takeAuthResultFromUrl(): { tokens: { access_token: string; refresh_token: string } | null; error: string | null } {
  const params = new URLSearchParams(window.location.hash.replace(/^#\/?/, ''));
  if (!params.has('access_token') && !params.has('error')) return { tokens: null, error: null };

  const type = params.get('type');
  const needsPassword = params.has('access_token') && (type === 'invite' || type === 'recovery');
  if (needsPassword) linkType = type as 'invite' | 'recovery';
  const route = needsPassword ? '/crear-contrasena' : '/login';
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${route}`);

  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) return { tokens: { access_token, refresh_token }, error: null };

  const expired = params.get('error_code') === 'otp_expired';
  return {
    tokens: null,
    // Los enlaces son de un solo uso: abrir el mismo correo por segunda vez siempre cae aquí.
    error: expired
      ? 'Este enlace ya se usó o venció (cada enlace sirve una sola vez). Si ya creaste tu contraseña, inicia sesión; si no, usa «¿Olvidaste tu contraseña?» para recibir uno nuevo.'
      : 'No se pudo iniciar sesión con el enlace. Usa «¿Olvidaste tu contraseña?» para recibir uno nuevo.',
  };
}

const authResultFromUrl = takeAuthResultFromUrl();

/** Mensaje para la pantalla de login si el usuario llegó con un enlace inválido o vencido. */
export const authLinkError = authResultFromUrl.error;

/** Con qué enlace se abrió el panel: invitación (crear contraseña) o recuperación (restablecerla). */
export const authLinkType = linkType;

/**
 * Cliente de Supabase usado SOLO para autenticación (iniciar/cerrar sesión, refrescar token).
 * El panel nunca lee ni escribe tablas con este cliente: todo pasa por la API (ver apiClient.ts).
 */
export const supabase = createClient(url || 'http://localhost', anonKey || 'anon', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

/**
 * Se resuelve cuando la sesión del enlace ya quedó guardada (o de inmediato si no se llegó con uno).
 * setSession dispara SIGNED_IN → onAuthStateChange → GET /me → la app redirige según el rol.
 */
export const authLinkReady: Promise<void> = authResultFromUrl.tokens
  ? supabase.auth.setSession(authResultFromUrl.tokens).then(
      () => undefined,
      () => undefined,
    )
  : Promise.resolve();

/** Devuelve el id del usuario autenticado (clave para no repetir GET /me). */
export async function signInWithPassword(email: string, password: string): Promise<string | null> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session?.user.id ?? null;
}

export async function signInWithMagicLink(email: string) {
  // Sin emailRedirectTo, Supabase manda al "Site URL" del proyecto (el sitio público), no al panel.
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin, shouldCreateUser: false },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

/** Define la contraseña del usuario de la sesión actual (tras una invitación o una recuperación). */
export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(passwordErrorMessage(error.code, error.message));
}

/** Envía el correo de "restablecer contraseña"; el enlace vuelve al panel con `type=recovery`. */
export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  if (error) throw new Error(passwordErrorMessage(error.code, error.message));
}

function passwordErrorMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case 'weak_password':
      return 'La contraseña es demasiado débil. Usa al menos 8 caracteres combinando letras y números.';
    case 'same_password':
      return 'La nueva contraseña debe ser distinta de la anterior.';
    case 'over_email_send_rate_limit':
      return 'Se enviaron demasiados correos. Espera unos minutos e inténtalo de nuevo.';
    case 'session_not_found':
    case 'session_expired':
      return 'Tu enlace venció. Pide uno nuevo desde «¿Olvidaste tu contraseña?».';
    default:
      return fallback || 'No se pudo completar la operación.';
  }
}

let refreshInFlight: Promise<string | null> | null = null;

// Varias peticiones en paralelo comparten un solo refresh
export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = supabase.auth
      .refreshSession()
      .then(({ data, error }) => (error ? null : data.session?.access_token ?? null))
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return null;

  // Si vence en menos de 10 s, renueva antes de mandar la petición
  const expiresInMs = (session.expires_at ?? 0) * 1000 - Date.now();
  if (expiresInMs < 10_000) return refreshAccessToken();

  return session.access_token;
}

/**
 * Notifica el id del usuario de la sesión (null si no hay). Supabase espera a los callbacks antes de
 * resolver signInWithPassword, y llamar a supabase.auth.* dentro de ellos puede bloquearse; por eso se
 * difiere con setTimeout y el callback vuelve de inmediato.
 */
export function onAuthStateChange(callback: (userId: string | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session: SupabaseSession | null) => {
    const userId = session?.user.id ?? null;
    setTimeout(() => callback(userId), 0);
  });
  return () => data.subscription.unsubscribe();
}
