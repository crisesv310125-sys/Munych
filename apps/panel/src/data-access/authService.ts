import {
  authLinkError,
  authLinkReady,
  authLinkType,
  getAccessToken as supabaseGetAccessToken,
  onAuthStateChange as supabaseOnAuthStateChange,
  refreshAccessToken as supabaseRefreshAccessToken,
  sendPasswordReset as supabaseSendPasswordReset,
  updatePassword as supabaseUpdatePassword,
  signInWithMagicLink as supabaseSignInWithMagicLink,
  signInWithPassword as supabaseSignInWithPassword,
  signOut as supabaseSignOut,
} from './supabaseClient';
import {
  mockGetAccessToken,
  mockOnAuthStateChange,
  mockSendPasswordReset,
  mockSignInWithMagicLink,
  mockUpdatePassword,
  mockSignInWithPassword,
  mockSignOut,
} from '../mocks/authMock';

const useMocks = import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true';

/**
 * Fachada de autenticación: por defecto delega en Supabase Auth (supabaseClient.ts), tal como
 * pide la sección 4.1 del prompt. Solo con VITE_USE_MOCKS=true (en dev) usa una sesión simulada
 * en localStorage, para trabajar sin backend.
 */
export const authService = {
  /** Error del enlace de invitación/acceso con el que se abrió el panel (null si no hubo). */
  linkError: useMocks ? null : authLinkError,
  /** `invite` o `recovery` si se llegó con un enlace que requiere definir contraseña. */
  linkType: useMocks ? null : authLinkType,
  /** Se resuelve cuando la sesión del enlace (si la hay) ya está guardada. */
  linkReady: useMocks ? Promise.resolve() : authLinkReady,
  signInWithPassword: (email: string, password: string) =>
    useMocks ? mockSignInWithPassword(email, password) : supabaseSignInWithPassword(email, password),
  signInWithMagicLink: (email: string) => (useMocks ? mockSignInWithMagicLink(email) : supabaseSignInWithMagicLink(email)),
  signOut: () => (useMocks ? mockSignOut() : supabaseSignOut()),
  updatePassword: (password: string) => (useMocks ? mockUpdatePassword(password) : supabaseUpdatePassword(password)),
  sendPasswordReset: (email: string) => (useMocks ? mockSendPasswordReset(email) : supabaseSendPasswordReset(email)),
  getAccessToken: () => (useMocks ? mockGetAccessToken() : supabaseGetAccessToken()),
  refreshAccessToken: () => (useMocks ? mockGetAccessToken() : supabaseRefreshAccessToken()),
  /** `userKey` identifica al usuario de la sesión (null = sin sesión). */
  onAuthStateChange: (callback: (userKey: string | null) => void) =>
    useMocks ? mockOnAuthStateChange(callback) : supabaseOnAuthStateChange(callback),
};
