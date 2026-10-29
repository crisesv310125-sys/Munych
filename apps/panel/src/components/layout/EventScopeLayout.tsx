import { useEffect } from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useAppState } from '../../state/AppStateContext';
import { useEvent } from '../../data-access/hooks';

export function EventScopeLayout() {
  const { eventId } = useParams<{ eventId: string }>();
  const { setActiveEvent } = useAppState();
  const { data: event, isLoading, isError } = useEvent(eventId);

  useEffect(() => {
    setActiveEvent(eventId ?? null);
    return () => setActiveEvent(null);
  }, [eventId, setActiveEvent]);

  if (!eventId) return <Navigate to="/admin/eventos" replace />;
  if (isLoading) return null;
  if (isError || !event) return <Navigate to="/admin/eventos" replace />;

  return <Outlet key={eventId} />;
}
