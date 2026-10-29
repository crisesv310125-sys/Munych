import type { ApiErrorCode, ProblemJson } from './apiTypes';

export class ApiError extends Error {
  code: ApiErrorCode;
  status: number;
  detail: string;

  constructor(problem: ProblemJson) {
    super(problem.detail || problem.title);
    this.name = 'ApiError';
    this.code = problem.code;
    this.status = problem.status;
    this.detail = problem.detail;
  }
}

/** Traducción de códigos de negocio del contrato (sección 6.3) a español. */
const ERROR_MESSAGES: Record<string, string> = {
  SESSION_CLOSED: 'La sesión está cerrada.',
  EVENT_CLOSED: 'El evento está cerrado.',
  JUDGE_NOT_ASSIGNED: 'No estás asignado a este comité.',
  VALUE_OUT_OF_RANGE: 'El valor está fuera de la escala de la rúbrica.',
  NOT_FOUND: 'No se encontró el recurso.',
  WEIGHTS_MUST_SUM_100: 'La suma de los pesos de los criterios debe ser 100.',
  DELEGATES_LIMIT_EXCEEDED: 'Se superó el número máximo de delegados por delegación.',
  EVENT_NOT_CLOSED: 'El evento todavía no está cerrado.',
  SESSIONS_STILL_OPEN: 'Hay sesiones abiertas; ciérralas antes de continuar.',
  VALIDATION_ERROR: 'Revisa los datos del formulario.',
  UNAUTHORIZED: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  FORBIDDEN: 'No tienes permiso para realizar esta acción.',
  CONFLICT: 'El dato ya existe o fue modificado al mismo tiempo. Recarga e inténtalo de nuevo.',
  RATE_LIMITED: 'Demasiadas solicitudes seguidas. Espera un momento e inténtalo de nuevo.',
  INTERNAL_ERROR: 'Error inesperado del servidor.',
};

/** Códigos genéricos cuyo `detail` del backend (ya en español) dice más que el mensaje fijo. */
const DETAIL_FIRST = new Set(['VALIDATION_ERROR', 'CONFLICT']);

export function translateErrorCode(code: string, fallback?: string): string {
  if (DETAIL_FIRST.has(code) && fallback) return fallback;
  return ERROR_MESSAGES[code] ?? fallback ?? 'Ocurrió un error inesperado.';
}

/** Mensaje listo para mostrar en UI a partir de cualquier error capturado. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return translateErrorCode(err.code, err.detail);
  if (err instanceof Error) return err.message;
  return 'Ocurrió un error inesperado.';
}
