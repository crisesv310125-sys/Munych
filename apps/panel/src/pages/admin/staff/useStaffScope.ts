import { useParams, useSearchParams } from 'react-router-dom';

/**
 * El staff es de la organización. Se abre desde dos lugares:
 * - el admin general (`/admin/staff`), con un selector de evento (`?evento=`) para ver
 *   avance, candidatos y premios;
 * - dentro de un evento (`/admin/eventos/:eventId/staff`), con ese evento fijo.
 * `eventId` vacío = el backend elige (el evento activo más reciente).
 */
export function useStaffScope() {
  const { eventId: routeEvent } = useParams<{ eventId?: string }>();
  const [params, setParams] = useSearchParams();
  const fixed = !!routeEvent;
  const eventId = routeEvent ?? params.get('evento') ?? '';
  const base = routeEvent ? `/admin/eventos/${routeEvent}/staff` : '/admin/staff';

  function setEvent(id: string) {
    const next = new URLSearchParams(params);
    if (id) next.set('evento', id);
    else next.delete('evento');
    setParams(next, { replace: true });
  }

  /** Enlace a otra pantalla del staff conservando el evento elegido. */
  function link(path: string, extra?: Record<string, string>): string {
    const q = new URLSearchParams(extra);
    if (!fixed && eventId) q.set('evento', eventId);
    const s = q.toString();
    return `${base}${path}${s ? `?${s}` : ''}`;
  }

  return { eventId, fixed, base, setEvent, link };
}
