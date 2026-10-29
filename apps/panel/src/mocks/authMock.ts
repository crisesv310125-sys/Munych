import type { Role } from '../data-access/apiTypes';

/**
 * Sustituto de Supabase Auth para desarrollo sin credenciales reales (VITE_USE_MOCKS=true).
 * Simula sesión en localStorage con la misma interfaz que data-access/authService.ts espera.
 * No usar en producción: no hay verificación real de contraseña.
 */

const STORAGE_KEY = 'munych.mock-session';
const FAKE_TOKEN = 'mock-access-token';

interface MockSession {
  role: Role;
  email: string;
}

type Listener = (userKey: string | null) => void;
const listeners = new Set<Listener>();

function readSession(): MockSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MockSession) : null;
  } catch {
    return null;
  }
}

function writeSession(session: MockSession | null) {
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(STORAGE_KEY);
  listeners.forEach((l) => l(session?.email ?? null));
}

/** Admin si el correo no contiene "juez"/"judge"; útil para probar ambos roles en local. */
function roleForEmail(email: string): Role {
  return /juez|judge/i.test(email) ? 'judge' : 'admin';
}

export async function mockSignInWithPassword(email: string, _password: string): Promise<string> {
  writeSession({ role: roleForEmail(email), email });
  return email;
}

export async function mockSignInWithMagicLink(email: string): Promise<void> {
  // En mocks, el "enlace mágico" inicia sesión de inmediato como juez (no hay email real que enviar).
  writeSession({ role: 'judge', email });
}

export async function mockUpdatePassword(_password: string): Promise<void> {
  if (!readSession()) throw new Error('Tu enlace venció. Pide uno nuevo desde «¿Olvidaste tu contraseña?».');
}

export async function mockSendPasswordReset(_email: string): Promise<void> {
  // En mocks no hay correo real que enviar.
}

export async function mockSignOut(): Promise<void> {
  writeSession(null);
}

export async function mockGetAccessToken(): Promise<string | null> {
  return readSession() ? FAKE_TOKEN : null;
}

export function mockOnAuthStateChange(callback: Listener): () => void {
  listeners.add(callback);
  callback(readSession()?.email ?? null);
  return () => listeners.delete(callback);
}
