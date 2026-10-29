import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { judgeApi } from './endpoints';
import type { JudgeScore, ScoreBatchItem } from './apiTypes';
import { queryKeys } from './queryClient';
import { errorMessage, translateErrorCode } from './errors';

/** Máximo de ítems por POST /judge/scores/batch (routes.md 3.6). */
const MAX_BATCH = 500;

export type DraftStatus = 'clean' | 'dirty' | 'saving' | 'error';

interface DraftState {
  /** Los borradores pertenecen a una sesión; si cambia la sesión se descartan. */
  sessionId: string;
  /** Clave `delegateId:criterionId` → valor editado que aún no se ha guardado. */
  values: Record<string, number>;
  /** delegateId → comentario editado que aún no se ha guardado. */
  comments: Record<string, string>;
  /** Clave `delegateId:criterionId` → motivo del rechazo del último guardado. */
  rejections: Record<string, string>;
  error: string | null;
}

const emptyState = (sessionId: string): DraftState => ({ sessionId, values: {}, comments: {}, rejections: {}, error: null });

export const scoreKey = (delegateId: string, criterionId: string) => `${delegateId}:${criterionId}`;

/** El backend guarda el comentario en cada calificación; el del delegado es el primero no vacío. */
function savedCommentFor(scores: JudgeScore[], delegateId: string): string {
  return scores.find((s) => s.delegate_id === delegateId && s.comment)?.comment ?? '';
}

function upsertScores(old: JudgeScore[], items: ScoreBatchItem[]): JudgeScore[] {
  const byKey = new Map(old.map((s) => [scoreKey(s.delegate_id, s.criterion_id), s]));
  for (const item of items) {
    byKey.set(scoreKey(item.delegate_id, item.criterion_id), {
      client_id: item.client_id,
      delegate_id: item.delegate_id,
      session_id: item.session_id,
      criterion_id: item.criterion_id,
      value: item.value,
      comment: item.comment ?? null,
      client_updated_at: item.client_updated_at,
      updated_at: item.client_updated_at,
    });
  }
  return [...byKey.values()];
}

/**
 * Calificaciones del juez con guardado manual: los cambios se acumulan como borradores (de
 * cualquier delegado de la sesión) y `saveAll` los envía juntos en lotes idempotentes.
 * Lo aceptado sale de los borradores; lo rechazado se queda, con su motivo en `rejections`.
 */
export function useScoreDrafts(sessionId: string, savedScores: JudgeScore[]) {
  const qc = useQueryClient();
  const [rawState, setState] = useState<DraftState>(() => emptyState(sessionId));
  const [saving, setSaving] = useState(false);
  const state = rawState.sessionId === sessionId ? rawState : emptyState(sessionId);

  function update(fn: (s: DraftState) => DraftState) {
    setState((prev) => fn(prev.sessionId === sessionId ? prev : emptyState(sessionId)));
  }

  const savedByKey = useMemo(
    () => new Map(savedScores.map((s) => [scoreKey(s.delegate_id, s.criterion_id), s.value])),
    [savedScores],
  );

  /** Lo guardado con los borradores encima: es lo que se muestra en pantalla. */
  const mergedScores = useMemo(() => {
    const entries = Object.entries(state.values);
    if (entries.length === 0) return savedScores;
    const byKey = new Map(savedScores.map((s) => [scoreKey(s.delegate_id, s.criterion_id), s]));
    for (const [key, value] of entries) {
      const [delegateId, criterionId] = key.split(':');
      const saved = byKey.get(key);
      byKey.set(
        key,
        saved
          ? { ...saved, value }
          : {
              client_id: '',
              delegate_id: delegateId,
              session_id: sessionId,
              criterion_id: criterionId,
              value,
              comment: null,
              client_updated_at: '',
              updated_at: null,
            },
      );
    }
    return [...byKey.values()];
  }, [savedScores, state.values, sessionId]);

  const dirtyDelegates = useMemo(() => {
    const set = new Set(Object.keys(state.comments));
    for (const key of Object.keys(state.values)) set.add(key.split(':')[0]);
    return set;
  }, [state.values, state.comments]);

  function setValue(delegateId: string, criterionId: string, value: number) {
    const key = scoreKey(delegateId, criterionId);
    update((s) => {
      const values = { ...s.values };
      if (savedByKey.get(key) === value) delete values[key];
      else values[key] = value;
      const rejections = { ...s.rejections };
      delete rejections[key];
      return { ...s, values, rejections, error: null };
    });
  }

  function setComment(delegateId: string, text: string) {
    update((s) => {
      const comments = { ...s.comments };
      if (text === savedCommentFor(savedScores, delegateId)) delete comments[delegateId];
      else comments[delegateId] = text;
      return { ...s, comments, error: null };
    });
  }

  function commentFor(delegateId: string): string {
    return state.comments[delegateId] ?? savedCommentFor(savedScores, delegateId);
  }

  function discard() {
    setState(emptyState(sessionId));
  }

  /** Devuelve `true` si todo quedó guardado (sin rechazos, errores ni comentarios pendientes). */
  async function saveAll(): Promise<boolean> {
    if (saving) return false;
    if (dirtyDelegates.size === 0) return true;
    const snapshot = state;
    const now = new Date().toISOString();
    const commentOf = (delegateId: string) => (snapshot.comments[delegateId] ?? savedCommentFor(savedScores, delegateId)) || null;
    const makeItem = (delegateId: string, criterionId: string, value: number): ScoreBatchItem => ({
      client_id: crypto.randomUUID(),
      delegate_id: delegateId,
      session_id: sessionId,
      criterion_id: criterionId,
      value,
      comment: commentOf(delegateId),
      client_updated_at: now,
    });

    const items: ScoreBatchItem[] = Object.entries(snapshot.values).map(([key, value]) => {
      const [delegateId, criterionId] = key.split(':');
      return makeItem(delegateId, criterionId, value);
    });
    // El comentario viaja con las calificaciones: si solo cambió el comentario, se reenvían las
    // notas ya guardadas del delegado con el comentario nuevo. Sin ninguna nota no hay dónde guardarlo.
    const commentsWithoutScores: string[] = [];
    for (const delegateId of Object.keys(snapshot.comments)) {
      const pending = new Set(items.filter((i) => i.delegate_id === delegateId).map((i) => i.criterion_id));
      const saved = savedScores.filter((s) => s.delegate_id === delegateId && !pending.has(s.criterion_id));
      saved.forEach((s) => items.push(makeItem(delegateId, s.criterion_id, s.value)));
      if (pending.size === 0 && saved.length === 0) commentsWithoutScores.push(delegateId);
    }

    setSaving(true);
    const accepted = new Set<string>();
    const rejections: Record<string, string> = {};
    let failure: string | null = null;
    for (let i = 0; i < items.length; i += MAX_BATCH) {
      const chunk = items.slice(i, i + MAX_BATCH);
      try {
        const res = await judgeApi.submitScoresBatch(chunk);
        res.accepted.forEach((id) => accepted.add(id));
        for (const r of res.rejected) {
          const item = chunk.find((c) => c.client_id === r.client_id);
          if (item) rejections[scoreKey(item.delegate_id, item.criterion_id)] = translateErrorCode(r.code, r.detail);
        }
      } catch (err) {
        failure = errorMessage(err);
        break;
      }
    }

    const savedItems = items.filter((i) => accepted.has(i.client_id));
    if (savedItems.length > 0) {
      qc.setQueryData<JudgeScore[]>(queryKeys.sessionScores(sessionId), (old) => upsertScores(old ?? [], savedItems));
      void qc.invalidateQueries({ queryKey: queryKeys.sessionScores(sessionId) });
    }

    update((s) => {
      // Solo se quita el borrador si no se editó otra vez mientras se guardaba.
      const values = { ...s.values };
      for (const item of savedItems) {
        const key = scoreKey(item.delegate_id, item.criterion_id);
        if (values[key] === item.value) delete values[key];
      }
      const comments = { ...s.comments };
      for (const [delegateId, text] of Object.entries(snapshot.comments)) {
        const mine = items.filter((i) => i.delegate_id === delegateId);
        if (mine.length > 0 && mine.every((i) => accepted.has(i.client_id)) && comments[delegateId] === text) {
          delete comments[delegateId];
        }
      }
      const error =
        failure ??
        (commentsWithoutScores.length > 0 ? 'Para guardar un comentario, califica al menos un criterio de ese delegado.' : null);
      return { ...s, values, comments, rejections, error };
    });
    setSaving(false);
    return failure === null && Object.keys(rejections).length === 0 && commentsWithoutScores.length === 0;
  }

  const hasRejections = Object.keys(state.rejections).length > 0;
  const status: DraftStatus = saving
    ? 'saving'
    : state.error || hasRejections
      ? 'error'
      : dirtyDelegates.size > 0
        ? 'dirty'
        : 'clean';

  return {
    mergedScores,
    commentFor,
    setValue,
    setComment,
    saveAll,
    discard,
    status,
    dirtyDelegates,
    rejections: state.rejections,
    error: state.error,
  };
}
