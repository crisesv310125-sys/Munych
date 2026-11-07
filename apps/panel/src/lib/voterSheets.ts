import type { GeneratedVoterToken } from '../data-access/apiTypes';
import { countryName } from './geo';

/**
 * Descargas de los accesos de delegados recién generados (ADR-005). Los tokens solo llegan
 * una vez desde el backend, así que se descargan en el momento: CSV para enviarlos por
 * correo o WhatsApp y una hoja HTML con los QR para imprimir y recortar. Cada acceso lleva
 * además un código corto de respaldo para escribirlo a mano si la cámara no lee el QR.
 */

function delegationLabel(t: GeneratedVoterToken): string {
  if (t.character_name) return t.character_name;
  return t.country_code ? countryName(t.country_code) : '';
}

/** Evita la inyección de fórmulas al abrir el CSV en Excel (igual que el export del backend). */
function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Dónde se escribe el código: la página de votación sin el token del enlace. */
function codeEntryUrl(t: GeneratedVoterToken): string {
  return t.url.slice(0, t.url.length - t.token.length).replace(/\/$/, '');
}

export function downloadVoterCsv(slug: string, tokens: GeneratedVoterToken[]) {
  const header = ['Comité', 'Delegación', 'Delegado', 'Enlace de votación', 'Código de respaldo'];
  const rows = tokens.map((t) => [t.committee_acronym, delegationLabel(t), t.full_name, t.url, t.code]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  // BOM para que Excel abra el CSV en UTF-8 (acentos y ñ).
  download(`${slug}-accesos-votacion.csv`, `﻿${csv}`, 'text/csv;charset=utf-8');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function downloadVoterQrSheet(eventName: string, slug: string, tokens: GeneratedVoterToken[]) {
  // El SVG del QR lo genera nuestro backend (segno); el resto del texto se escapa.
  const cards = tokens
    .map(
      (t) => `<div class="card">
  ${t.qr_svg}
  <div class="name">${escapeHtml(t.full_name)}</div>
  <div class="meta">${escapeHtml(delegationLabel(t))} · ${escapeHtml(t.committee_acronym)}</div>
  <div class="hint">Escanea para votar · personal e intransferible</div>
  <div class="code-label">¿No lee el QR? Entra a ${escapeHtml(codeEntryUrl(t).replace(/^https?:\/\//, ''))} y escribe:</div>
  <div class="code">${escapeHtml(t.code)}</div>
</div>`,
    )
    .join('\n');
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(eventName)} · accesos de votación</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 16px; color: #0b2a4a; }
  h1 { font-size: 16px; margin: 0 0 12px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .card { border: 1px dashed #98a6b5; border-radius: 8px; padding: 10px; text-align: center; break-inside: avoid; }
  .card svg { width: 140px; height: 140px; }
  .name { font-weight: 600; font-size: 13px; margin-top: 6px; }
  .meta { font-size: 12px; }
  .hint { font-size: 10px; color: #5b6b7d; margin-top: 4px; }
  .code-label { font-size: 9px; color: #5b6b7d; margin-top: 8px; word-break: break-all; }
  .code { font: 700 15px/1.2 ui-monospace, 'IBM Plex Mono', monospace; letter-spacing: .08em; margin-top: 2px; }
  @media print { h1 { display: none; } body { margin: 0; } }
</style></head>
<body><h1>${escapeHtml(eventName)} · ${tokens.length} accesos de votación (imprime y recorta)</h1>
<div class="grid">
${cards}
</div></body></html>`;
  download(`${slug}-qr-votacion.html`, html, 'text/html;charset=utf-8');
}
