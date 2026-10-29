import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AutosaveIndicator, type SaveState } from '@munych/ui/components/AutosaveIndicator';
import { Button } from '@munych/ui/components/Button';
import { ProgressBar } from '@munych/ui/components/ProgressBar';
import { Select } from '@munych/ui/components/FormControls';
import { useIsDesktop } from '../../lib/useMediaQuery';
import { delegateScoreMeta } from '../../lib/judgeScoreMeta';
import { currentSessionFor, sessionStatusLabel } from '../../lib/statusLabels';
import { useJudgeCommittee, useSessionScores } from '../../data-access/hooks';
import { useScoreDrafts, type DraftStatus } from '../../data-access/useScoreDrafts';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { JudgeDelegate, JudgeDelegation } from '../../data-access/apiTypes';
import { ScoringForm } from './ScoringForm';
import styles from './CommitteePage.module.css';

type Filter = 'all' | 'pending' | 'ready';

function normalize(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

interface DelegateRow {
  delegate: JudgeDelegate;
  delegation: JudgeDelegation;
}

function unsavedWarning(count: number, action: string): string {
  const who = count === 1 ? '1 delegado' : `${count} delegados`;
  return `Hay calificaciones de ${who} que todavía no se han guardado. Si ${action} sin guardar, se perderán.`;
}

const INDICATOR_STATE: Record<DraftStatus, SaveState> = { clean: 'saved', dirty: 'saving', saving: 'saving', error: 'error' };

export function CommitteePage() {
  const { committeeId } = useParams<{ committeeId: string }>();
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sessionId, setSessionId] = useState<string | null>(null);

  const { data: committee } = useJudgeCommittee(committeeId);
  const sessions = useMemo(() => [...(committee?.sessions ?? [])].sort((a, b) => a.number - b.number), [committee]);
  const activeSessionId = sessionId ?? currentSessionFor(sessions)?.session_id ?? '';
  const activeSession = sessions.find((s) => s.session_id === activeSessionId);
  // Solo se califica en sesiones abiertas de un evento sin cerrar (si no, el backend rechaza con SESSION_CLOSED / EVENT_CLOSED).
  const readOnly = !activeSession || activeSession.status !== 'open' || !!committee?.event_closed;
  const { data: savedScores } = useSessionScores(activeSessionId || undefined);
  const drafts = useScoreDrafts(activeSessionId, savedScores ?? []);
  const scores = drafts.mergedScores;
  const dirtyCount = drafts.dirtyDelegates.size;

  // Aviso al salir con cambios sin guardar: navegación dentro del panel (pestañas, volver, atrás del
  // navegador) y cerrar/recargar la pestaña. Cambiar de delegado (?delegado=) no sale de la página.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirtyCount > 0 && currentLocation.pathname !== nextLocation.pathname,
  );
  // Cambio de sesión en espera de que el juez decida qué hacer con los cambios sin guardar.
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [leavingBusy, setLeavingBusy] = useState(false);
  useEffect(() => {
    if (dirtyCount === 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirtyCount]);

  const allRows: DelegateRow[] = useMemo(
    () => (committee?.delegations ?? []).flatMap((delegation) => delegation.delegates.map((delegate) => ({ delegate, delegation }))),
    [committee],
  );

  const rubric = committee?.rubric;

  const enriched = useMemo(
    () =>
      rubric
        ? allRows.map((row) => ({ ...row, meta: delegateScoreMeta(row.delegate.delegate_id, scores ?? [], rubric) }))
        : allRows.map((row) => ({ ...row, meta: null })),
    [allRows, scores, rubric],
  );

  const pendingCount = enriched.filter((e) => e.meta?.status === 'none').length;
  const readyCount = enriched.filter((e) => e.meta && e.meta.status !== 'none').length;

  const filtered = enriched.filter((e) => {
    const label = `${e.delegate.full_name} ${e.delegation.character_name ?? e.delegation.country_code ?? ''}`;
    if (query && !normalize(label).includes(normalize(query))) return false;
    if (filter === 'pending') return e.meta?.status === 'none';
    if (filter === 'ready') return e.meta && e.meta.status !== 'none';
    return true;
  });

  const selectedId = searchParams.get('delegado');
  const fallbackId = filtered.find((e) => e.meta?.status !== 'done')?.delegate.delegate_id ?? filtered[0]?.delegate.delegate_id;
  const activeId = isDesktop ? (selectedId ?? fallbackId) : selectedId;

  const activeIndexInAll = allRows.findIndex((r) => r.delegate.delegate_id === activeId);
  const position = activeIndexInAll + 1;
  const activeRow = allRows[activeIndexInAll];
  const prevDelegate = activeIndexInAll > 0 ? allRows[activeIndexInAll - 1].delegate : undefined;
  const nextDelegate = activeIndexInAll >= 0 && activeIndexInAll < allRows.length - 1 ? allRows[activeIndexInAll + 1].delegate : undefined;

  function selectDelegate(id: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('delegado', id);
      return next;
    });
  }

  if (!committee || !rubric) return null;

  const percent = allRows.length === 0 ? 0 : Math.round((readyCount / allRows.length) * 100);

  function changeSession(nextSessionId: string) {
    // Los borradores son de la sesión actual: con cambios pendientes, se pregunta antes.
    if (dirtyCount > 0) setPendingSessionId(nextSessionId);
    else setSessionId(nextSessionId);
  }

  function continueLeaving() {
    if (blocker.state === 'blocked') blocker.proceed();
    if (pendingSessionId) {
      setSessionId(pendingSessionId);
      setPendingSessionId(null);
    }
  }

  function stayHere() {
    if (blocker.state === 'blocked') blocker.reset();
    setPendingSessionId(null);
  }

  async function saveAndLeave() {
    setLeavingBusy(true);
    const ok = await drafts.saveAll();
    setLeavingBusy(false);
    // Si algo no se guardó, el juez se queda para ver el motivo junto al delegado.
    if (ok) continueLeaving();
    else stayHere();
  }

  function discardAndLeave() {
    drafts.discard();
    continueLeaving();
  }

  const leaveDialog =
    blocker.state === 'blocked' || pendingSessionId !== null ? (
      <ConfirmDialog
        title="Tienes cambios sin guardar"
        message={unsavedWarning(dirtyCount, pendingSessionId ? 'cambias de sesión' : 'sales ahora')}
        onClose={stayHere}
        actions={[
          { label: 'Seguir editando', onClick: stayHere, disabled: leavingBusy },
          { label: 'Descartar cambios', onClick: discardAndLeave, variant: 'danger', disabled: leavingBusy },
          {
            label: leavingBusy ? 'Guardando…' : pendingSessionId ? 'Guardar y cambiar' : 'Guardar y salir',
            onClick: () => void saveAndLeave(),
            variant: 'primary',
            disabled: leavingBusy,
          },
        ]}
      />
    ) : null;

  function delegateError(delegateId: string): string | undefined {
    const entry = Object.entries(drafts.rejections).find(([key]) => key.startsWith(`${delegateId}:`));
    return entry?.[1];
  }

  const statusLabel =
    drafts.status === 'saving'
      ? 'Guardando…'
      : drafts.status === 'error'
        ? (drafts.error ?? 'Algunas calificaciones no se guardaron; revisa los delegados marcados.')
        : drafts.status === 'dirty'
          ? `Cambios sin guardar · ${dirtyCount === 1 ? '1 delegado' : `${dirtyCount} delegados`}`
          : 'Todos los cambios están guardados';

  const saveControls = readOnly ? null : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <AutosaveIndicator state={INDICATOR_STATE[drafts.status]} label={statusLabel} />
      <Button fullWidth disabled={dirtyCount === 0 || drafts.status === 'saving'} onClick={() => void drafts.saveAll()}>
        {drafts.status === 'saving' ? 'Guardando…' : 'Guardar cambios'}
      </Button>
    </div>
  );

  function statusText(delegateId: string, label: string | undefined): string {
    if (delegateError(delegateId)) return `${label} · No guardado`;
    return drafts.dirtyDelegates.has(delegateId) ? `${label} · Sin guardar` : (label ?? '');
  }

  const sessionPicker = (
    <Select value={activeSessionId} onChange={(e) => changeSession(e.target.value)}>
      {sessions.map((s) => (
        <option key={s.session_id} value={s.session_id}>
          Sesión {s.number} · {sessionStatusLabel(s)}
        </option>
      ))}
    </Select>
  );

  if (!isDesktop) {
    if (selectedId && activeRow) {
      return (
        <>
        {leaveDialog}
        <ScoringForm
          delegate={activeRow.delegate}
          delegation={activeRow.delegation}
          committeeName={committee.name}
          rubric={rubric}
          scores={scores}
          comment={drafts.commentFor(activeRow.delegate.delegate_id)}
          onScoreChange={(criterionId, value) => drafts.setValue(activeRow.delegate.delegate_id, criterionId, value)}
          onCommentChange={(text) => drafts.setComment(activeRow.delegate.delegate_id, text)}
          error={delegateError(activeRow.delegate.delegate_id)}
          saveControls={saveControls}
          readOnly={readOnly}
          position={position}
          total={allRows.length}
          prevDelegate={prevDelegate}
          nextDelegate={nextDelegate}
          onNavigate={selectDelegate}
          onBack={() =>
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.delete('delegado');
              return next;
            })
          }
          variant="mobile"
        />
        </>
      );
    }

    return (
      <>
        {leaveDialog}
        <div className={styles.mobileHeader}>
          <div className={styles.topRow}>
            <button className={styles.backBtn} onClick={() => navigate('/juez')} aria-label="Volver">
              <ChevronLeft size={20} />
            </button>
            <div className={styles.titleGroup}>
              <span className={styles.committeeName} style={{ fontSize: 20 }}>
                {committee.name}
              </span>
              <span className={styles.subLine}>
                {committee.event.name} · {readyCount} de {allRows.length} calificados
              </span>
            </div>
          </div>
          {sessionPicker}
          <input
            className={styles.searchInput}
            placeholder="Buscar delegado…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className={styles.chips}>
            <button className={`${styles.chip} ${filter === 'all' ? styles.chipActive : ''}`} onClick={() => setFilter('all')}>
              Todos · {allRows.length}
            </button>
            <button className={`${styles.chip} ${filter === 'pending' ? styles.chipActive : ''}`} onClick={() => setFilter('pending')}>
              Pendientes · {pendingCount}
            </button>
            <button className={`${styles.chip} ${filter === 'ready' ? styles.chipActive : ''}`} onClick={() => setFilter('ready')}>
              Listos · {readyCount}
            </button>
          </div>
          {!readOnly && dirtyCount > 0 && (
            <Button variant="gold" fullWidth disabled={drafts.status === 'saving'} onClick={() => void drafts.saveAll()}>
              {drafts.status === 'saving' ? 'Guardando…' : `Guardar cambios · ${dirtyCount === 1 ? '1 delegado' : `${dirtyCount} delegados`}`}
            </Button>
          )}
        </div>
        <div className={styles.listBody}>
          {filtered.map(({ delegate, delegation, meta }) => (
            <div key={delegate.delegate_id} className={styles.countryRow} onClick={() => selectDelegate(delegate.delegate_id)}>
              <div className={styles.stripe} style={{ background: meta?.color }} />
              <div className={styles.countryInfo}>
                <span className={styles.countryName}>{delegate.full_name}</span>
                <span className={styles.countryStatus}>
                  {delegation.character_name ?? delegation.country_code} · {statusText(delegate.delegate_id, meta?.label)}
                </span>
              </div>
              <div className={styles.scoreBlock}>
                <span className={styles.scoreValue} style={{ color: meta?.scoreColor }}>
                  {meta?.hasScore ? meta.scorePercent : '—'}
                </span>
                <span className={styles.scoreOf}>/ 100</span>
              </div>
              <ChevronRight size={16} className={styles.chevron} />
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {leaveDialog}
      <div className={styles.desktopHeader}>
        <div className={styles.desktopTitleRow}>
          <button className={styles.desktopBackBtn} onClick={() => navigate('/juez')} aria-label="Volver">
            <ChevronLeft size={18} />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className={styles.committeeName} style={{ fontSize: 22 }}>
              {committee.name}
            </span>
            <span className={styles.subLine}>
              {committee.event.name} · {readyCount} de {allRows.length} calificados
            </span>
          </div>
          <div style={{ marginLeft: 16, width: 220 }}>{sessionPicker}</div>
        </div>
        <div className={styles.desktopProgress}>
          <div style={{ width: 200 }}>
            <ProgressBar percent={percent} trackColor="rgba(255,255,255,.16)" />
          </div>
          <span style={{ fontSize: 13, color: '#FFFFFF', fontWeight: 600 }}>{percent}%</span>
        </div>
      </div>
      <div className={styles.masterDetail}>
        <div className={styles.listPanel}>
          <div className={styles.listPanelHeader}>
            <input
              className={styles.desktopSearchInput}
              placeholder="Buscar delegado…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className={styles.chips}>
              <button className={`${styles.desktopChip} ${filter === 'all' ? styles.desktopChipActive : ''}`} onClick={() => setFilter('all')}>
                Todos · {allRows.length}
              </button>
              <button className={`${styles.desktopChip} ${filter === 'pending' ? styles.desktopChipActive : ''}`} onClick={() => setFilter('pending')}>
                Pendientes · {pendingCount}
              </button>
              <button className={`${styles.desktopChip} ${filter === 'ready' ? styles.desktopChipActive : ''}`} onClick={() => setFilter('ready')}>
                Listos · {readyCount}
              </button>
            </div>
          </div>
          <div className={styles.desktopListBody}>
            {filtered.map(({ delegate, delegation, meta }) => (
              <div
                key={delegate.delegate_id}
                className={`${styles.desktopCountryRow} ${delegate.delegate_id === activeId ? styles.desktopCountryRowSelected : ''}`}
                onClick={() => selectDelegate(delegate.delegate_id)}
              >
                <div className={styles.stripe} style={{ width: 3, background: meta?.color }} />
                <div className={styles.countryInfo}>
                  <span className={styles.countryName} style={{ fontSize: 15 }}>
                    {delegate.full_name}
                  </span>
                  <span className={styles.countryStatus}>
                    {delegation.character_name ?? delegation.country_code} · {statusText(delegate.delegate_id, meta?.label)}
                  </span>
                </div>
                <span className={styles.scoreValue} style={{ fontSize: 17, color: meta?.scoreColor }}>
                  {meta?.hasScore ? meta.scorePercent : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
        {activeRow ? (
          <ScoringForm
            delegate={activeRow.delegate}
            delegation={activeRow.delegation}
            committeeName={committee.name}
            rubric={rubric}
            scores={scores}
            comment={drafts.commentFor(activeRow.delegate.delegate_id)}
            onScoreChange={(criterionId, value) => drafts.setValue(activeRow.delegate.delegate_id, criterionId, value)}
            onCommentChange={(text) => drafts.setComment(activeRow.delegate.delegate_id, text)}
            error={delegateError(activeRow.delegate.delegate_id)}
            saveControls={saveControls}
            readOnly={readOnly}
            position={position}
            total={allRows.length}
            prevDelegate={prevDelegate}
            nextDelegate={nextDelegate}
            onNavigate={selectDelegate}
            variant="desktop"
          />
        ) : (
          <div className={styles.emptyDetail}>Selecciona un delegado de la lista para calificarlo.</div>
        )}
      </div>
    </div>
  );
}
