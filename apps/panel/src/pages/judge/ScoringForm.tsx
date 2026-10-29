import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@munych/ui/components/Button';
import { CriterionSlider } from '@munych/ui/components/CriterionSlider';
import { delegateScoreMeta, levelDescriptor, type ScoringRubric } from '../../lib/judgeScoreMeta';
import type { JudgeDelegate, JudgeDelegation, JudgeScore } from '../../data-access/apiTypes';
import styles from './ScoringForm.module.css';

interface ScoringFormProps {
  delegate: JudgeDelegate;
  delegation: JudgeDelegation;
  committeeName: string;
  rubric: ScoringRubric;
  /** Calificaciones guardadas con los borradores sin guardar encima. */
  scores: JudgeScore[];
  comment: string;
  onScoreChange: (criterionId: string, value: number) => void;
  onCommentChange: (comment: string) => void;
  /** Motivo por el que el backend rechazó alguna nota de este delegado en el último guardado. */
  error?: string;
  /** Estado de guardado + botón "Guardar cambios" (lo gestiona CommitteePage para todos los delegados). */
  saveControls: ReactNode;
  readOnly: boolean;
  position: number;
  total: number;
  prevDelegate?: JudgeDelegate;
  nextDelegate?: JudgeDelegate;
  onNavigate: (delegateId: string) => void;
  onBack?: () => void;
  variant: 'mobile' | 'desktop';
}

function delegationLabel(delegation: JudgeDelegation): string {
  return delegation.character_name ?? delegation.country_code ?? '—';
}

export function ScoringForm({
  delegate,
  delegation,
  committeeName,
  rubric,
  scores,
  comment,
  onScoreChange,
  onCommentChange,
  error,
  saveControls,
  readOnly,
  position,
  total,
  prevDelegate,
  nextDelegate,
  onNavigate,
  onBack,
  variant,
}: ScoringFormProps) {
  const meta = delegateScoreMeta(delegate.delegate_id, scores, rubric);

  const totalPoints = meta.scorePercent.toFixed(1);

  if (variant === 'mobile') {
    return (
      <>
        <div className={styles.mobileHeader}>
          <div className={styles.mobileTopRow}>
            <div className={styles.mobileTitleGroup}>
              {onBack && (
                <button className={styles.backBtn} onClick={onBack} aria-label="Volver">
                  <ChevronLeft size={20} />
                </button>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span className={styles.countryName} style={{ fontSize: 21 }}>
                  {delegate.full_name}
                </span>
                <span className={styles.subLine}>
                  {delegationLabel(delegation)} · {position} de {total}
                </span>
              </div>
            </div>
            <div className={styles.totalBlock}>
              <span className={styles.totalValue} style={{ fontSize: 30 }}>
                {totalPoints}
              </span>
              <span className={styles.totalLabel}>TOTAL PONDERADO</span>
            </div>
          </div>
        </div>
        <div className={styles.mobileBody}>
          {readOnly && (
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Esta sesión está cerrada; las calificaciones son de solo lectura.</span>
          )}
          {rubric.criteria.map((k) => (
            <CriterionSlider
              key={k.id}
              name={k.name}
              weight={k.weight}
              value={meta.valuesByCriterion[k.id]}
              min={rubric.scale_min}
              max={rubric.scale_max}
              descriptor={
                meta.valuesByCriterion[k.id] !== undefined ? levelDescriptor(k, meta.valuesByCriterion[k.id]) : (k.description ?? '')
              }
              onChange={readOnly ? () => undefined : (v) => onScoreChange(k.id, v)}
            />
          ))}
          {error && <span style={{ fontSize: 12, color: '#C0392B' }}>{error}</span>}
          <div className={styles.commentCard}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Comentario del juez</span>
            <textarea
              rows={4}
              disabled={readOnly}
              placeholder="Observaciones sobre la participación de la delegación…"
              value={comment}
              onChange={(e) => onCommentChange(e.target.value)}
              style={{
                border: '1px solid var(--border-input)',
                borderRadius: 8,
                padding: 11,
                fontSize: 13,
                color: 'var(--ink)',
                lineHeight: 1.5,
                resize: 'none',
                outline: 'none',
              }}
            />
            <span style={{ fontSize: 10, color: 'var(--state-none-dot)' }}>Visible solo para el equipo de chairs y admins.</span>
          </div>
        </div>
        <div className={styles.mobileFooter}>
          {saveControls}
          <div className={styles.navRow}>
            <Button variant="secondary" disabled={!prevDelegate} onClick={() => prevDelegate && onNavigate(prevDelegate.delegate_id)}>
              ‹ {prevDelegate ? prevDelegate.full_name : 'Anterior'}
            </Button>
            <Button variant="primary" disabled={!nextDelegate} onClick={() => nextDelegate && onNavigate(nextDelegate.delegate_id)}>
              {nextDelegate ? nextDelegate.full_name : 'Siguiente'} ›
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div className={styles.desktopHeader}>
        <div className={styles.desktopTitleGroup}>
          <span className={styles.desktopCountryName}>{delegate.full_name}</span>
          <span className={styles.desktopSub}>
            {delegationLabel(delegation)} · {committeeName} · {position} de {total}
          </span>
        </div>
        <div className={styles.desktopTotalRow}>
          <div className={styles.desktopTotalBlock}>
            <span className={styles.desktopTotalValue}>{totalPoints}</span>
            <span className={styles.desktopTotalLabel}>TOTAL PONDERADO / 100</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" disabled={!prevDelegate} onClick={() => prevDelegate && onNavigate(prevDelegate.delegate_id)}>
              ‹ {prevDelegate ? prevDelegate.full_name : 'Anterior'}
            </Button>
            <Button variant="primary" disabled={!nextDelegate} onClick={() => nextDelegate && onNavigate(nextDelegate.delegate_id)}>
              {nextDelegate ? nextDelegate.full_name : 'Siguiente'} ›
            </Button>
          </div>
        </div>
      </div>
      <div className={styles.desktopBody}>
        <div className={styles.desktopCriteriaGrid}>
          {readOnly && (
            <span style={{ fontSize: 12, color: 'var(--muted)', gridColumn: '1 / -1' }}>
              Esta sesión está cerrada; las calificaciones son de solo lectura.
            </span>
          )}
          {rubric.criteria.map((k) => (
            <CriterionSlider
              key={k.id}
              name={k.name}
              weight={k.weight}
              value={meta.valuesByCriterion[k.id]}
              min={rubric.scale_min}
              max={rubric.scale_max}
              descriptor={
                meta.valuesByCriterion[k.id] !== undefined ? levelDescriptor(k, meta.valuesByCriterion[k.id]) : (k.description ?? '')
              }
              onChange={readOnly ? () => undefined : (v) => onScoreChange(k.id, v)}
            />
          ))}
        </div>
        <div className={styles.desktopSide}>
          <div className={styles.desktopCommentPanel}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Comentario del juez</span>
            <textarea
              rows={7}
              disabled={readOnly}
              placeholder="Observaciones sobre la participación de la delegación…"
              value={comment}
              onChange={(e) => onCommentChange(e.target.value)}
              style={{
                border: '1px solid var(--border-input)',
                borderRadius: 8,
                padding: 11,
                fontSize: 13,
                lineHeight: 1.55,
                resize: 'none',
                outline: 'none',
                background: 'var(--white)',
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--state-none-dot)' }}>Visible solo para chairs y admins.</span>
          </div>
          {error && <span style={{ fontSize: 12, color: '#C0392B' }}>{error}</span>}
          {saveControls}
        </div>
      </div>
    </div>
  );
}
