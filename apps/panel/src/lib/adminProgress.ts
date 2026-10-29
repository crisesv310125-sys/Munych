import type { CommitteeProgress } from '../data-access/apiTypes';

export function committeeProgressPercent(progress: CommitteeProgress | undefined): number {
  if (!progress || progress.sessions.length === 0) return 0;
  let scored = 0;
  let expected = 0;
  for (const session of progress.sessions) {
    for (const judge of session.judges) {
      scored += judge.scored;
      expected += judge.expected;
    }
  }
  if (expected === 0) return 0;
  return Math.round((scored / expected) * 100);
}

export function committeeAssignedJudgeCount(progress: CommitteeProgress | undefined): number {
  if (!progress || progress.sessions.length === 0) return 0;
  return progress.sessions[0]?.judges.length ?? 0;
}
