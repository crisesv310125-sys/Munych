import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Claves de query centralizadas para invalidar de forma consistente entre pantallas. */
export const queryKeys = {
  events: ['events'] as const,
  event: (eventId: string) => ['events', eventId] as const,
  committees: (eventId: string) => ['committees', eventId] as const,
  committee: (committeeId: string) => ['committee', committeeId] as const,
  committeeProgress: (committeeId: string) => ['committee', committeeId, 'progress'] as const,
  delegations: (committeeId: string) => ['delegations', committeeId] as const,
  judges: ['judges'] as const,
  eventJudges: (eventId: string | undefined) => ['judges', 'event', eventId ?? 'all'] as const,
  // Cuelgan de `judges`: invalidar jueces también refresca las invitaciones pendientes.
  judgeInvitations: (eventId: string | undefined) => ['judges', 'invitations', eventId ?? 'all'] as const,
  committeeJudges: (committeeId: string) => ['committee', committeeId, 'judges'] as const,
  rubrics: (eventId: string) => ['rubrics', eventId] as const,
  rubric: (rubricId: string) => ['rubric', rubricId] as const,
  sessions: (committeeId: string) => ['sessions', committeeId] as const,
  ranking: (committeeId: string) => ['ranking', committeeId] as const,
  awards: (committeeId: string) => ['awards', committeeId] as const,
  publicationSettings: (eventId: string) => ['publication-settings', eventId] as const,
  publicationPreview: (eventId: string) => ['publication-preview', eventId] as const,
  voterTokens: (eventId: string) => ['voter-tokens', eventId] as const,
  ballot: (token: string) => ['ballot', token] as const,
  me: ['me'] as const,
  judgeCommittees: ['judge', 'committees'] as const,
  judgeCommittee: (committeeId: string) => ['judge', 'committee', committeeId] as const,
  sessionScores: (sessionId: string) => ['judge', 'session-scores', sessionId] as const,
} as const;
