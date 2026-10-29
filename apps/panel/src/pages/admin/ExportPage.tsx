import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@munych/ui/components/Button';
import { Checkbox } from '@munych/ui/components/SelectionControls';
import { useCommittees, useEvent, useRanking } from '../../data-access/hooks';
import { exportEventFile } from '../../data-access/endpoints';
import { errorMessage } from '../../data-access/errors';
import styles from './AdminShared.module.css';

type Format = 'PDF' | 'XLSX' | 'CSV';

const FORMATS: Array<{ id: Format; title: string; desc: string }> = [
  { id: 'PDF', title: 'PDF', desc: 'Acta oficial con ranking y medallas, membretada.' },
  { id: 'XLSX', title: 'XLSX', desc: 'Una hoja por comité, desglose por criterio y juez.' },
  { id: 'CSV', title: 'CSV', desc: 'Datos planos para procesar externamente.' },
];

export function ExportPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data: event } = useEvent(eventId);
  const { data: committees } = useCommittees(eventId);
  const list = committees ?? [];
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<Format>('XLSX');
  const [content, setContent] = useState({ total: true, breakdown: true, comments: false, judgeNames: false });
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [exportError, setExportError] = useState('');

  const selectedIds = selected.size > 0 ? selected : new Set(list.slice(0, 1).map((c) => c.id));
  const previewCommitteeId = [...selectedIds][0];
  const { data: ranking } = useRanking(previewCommitteeId);
  const previewCommittee = list.find((c) => c.id === previewCommitteeId);

  function toggleCommittee(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(list.map((c) => c.id)));
  }

  const selectedCommittees = list.filter((c) => selectedIds.has(c.id));

  async function handleGenerate() {
    if (!eventId) return;
    setExportError('');
    setGenerating(true);
    try {
      const { blob, filename } = await exportEventFile(eventId, event?.slug);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setGenerated(true);
      window.setTimeout(() => setGenerated(false), 2500);
    } catch (err) {
      setExportError(errorMessage(err));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className={styles.page}>
      <div style={{ display: 'flex', flex: 1, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 560px', padding: 26, display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span className={styles.topbarTitle}>Exportar resultados</span>
            <span className={styles.topbarSub}>Genera el archivo oficial de premiación o el respaldo completo de calificaciones.</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.06em' }}>1 · COMITÉS</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
              {list.map((c) => {
                const checked = selectedIds.has(c.id);
                return (
                  <div
                    key={c.id}
                    onClick={() => toggleCommittee(c.id)}
                    style={{
                      background: checked ? 'var(--row-selected)' : 'var(--white)',
                      border: `1px solid ${checked ? 'var(--navy)' : 'var(--border)'}`,
                      borderRadius: 9,
                      padding: '13px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: checked ? 600 : 400, color: checked ? 'var(--ink)' : 'var(--muted)' }}>{c.name}</span>
                    <Checkbox checked={checked} />
                  </div>
                );
              })}
              <div
                onClick={selectAll}
                style={{
                  background: 'var(--white)',
                  border: '1px dashed var(--border-input)',
                  borderRadius: 9,
                  padding: '13px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--un-blue)', fontWeight: 600 }}>Seleccionar todos</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.06em' }}>2 · FORMATO</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              {FORMATS.map((f) => {
                const active = format === f.id;
                return (
                  <div
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    style={{
                      background: active ? 'var(--row-selected)' : 'var(--white)',
                      border: `1px solid ${active ? 'var(--navy)' : 'var(--border)'}`,
                      borderRadius: 10,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700, color: active ? 'var(--navy)' : 'var(--ink)' }}>{f.title}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{f.desc}</span>
                  </div>
                );
              })}
            </div>
            {format !== 'XLSX' && (
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                Por ahora el backend solo genera XLSX; se descargará ese formato. // TODO(cliente): confirmar si PDF/CSV están en el alcance.
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.06em' }}>3 · CONTENIDO</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(
                [
                  ['total', 'Puntaje total ponderado'],
                  ['breakdown', 'Desglose por criterio'],
                  ['comments', 'Comentarios de los jueces'],
                  ['judgeNames', 'Nombre del juez junto a cada calificación'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setContent((c) => ({ ...c, [key]: !c[key] }))}>
                  <Checkbox checked={content[key]} />
                  <span style={{ fontSize: 13, color: content[key] ? 'var(--ink)' : 'var(--muted)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ width: 420, flex: 'none', borderLeft: '1px solid var(--border)', background: 'var(--bg)', padding: 26, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.06em' }}>VISTA PREVIA</span>
          <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 10, padding: 22, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: 'var(--shadow-doc-preview)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)', fontFamily: 'var(--font-serif)', fontSize: 12, fontWeight: 700 }}>
                M
              </div>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 600, color: 'var(--navy)' }}>{previewCommittee?.name ?? 'Sin comité'}</span>
              <span style={{ fontSize: 10, letterSpacing: '.12em', color: 'var(--muted)' }}>
                RESULTADOS OFICIALES · {(event?.name ?? 'MUNYCH').toUpperCase()}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {(ranking?.items ?? []).slice(0, 6).map((r, i) => (
                <div key={r.delegation_id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: i === 0 ? 'var(--medal-1-bg)' : i === 1 ? 'var(--medal-2-bg)' : i === 2 ? 'var(--medal-3-bg)' : 'var(--medal-rest-bg)',
                      color: i === 1 ? 'var(--medal-2-fg)' : i > 2 ? 'var(--medal-rest-fg)' : '#FFFFFF',
                      fontSize: 10,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {r.position}
                  </span>
                  <span style={{ flex: 1, fontSize: 12, color: i <= 2 ? 'var(--ink)' : 'var(--muted)' }}>
                    {r.character_name ?? r.country_code}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: i <= 2 ? 'var(--navy)' : 'var(--muted)' }}>{r.score === null ? '—' : r.score.toFixed(1)}</span>
                </div>
              ))}
              {(!ranking || ranking.items.length === 0) && (
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Sin calificaciones todavía.</span>
              )}
            </div>
          </div>
          <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 9, padding: 14, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Se exportarán</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              {selectedCommittees.length} comités · {format}
            </span>
          </div>
          {exportError && <span style={{ color: '#C0392B', fontSize: 12 }}>{exportError}</span>}
          <Button style={{ marginTop: 'auto' }} onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generando…' : generated ? 'Archivo generado ✓' : 'Generar archivo'}
          </Button>
          <span style={{ fontSize: 11, color: 'var(--state-none-dot)', textAlign: 'center' }}>El archivo queda registrado en el historial del evento.</span>
        </div>
      </div>
    </div>
  );
}
