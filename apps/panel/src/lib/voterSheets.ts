import type { GeneratedVoterToken } from '../data-access/apiTypes';
import { countryName } from './geo';

/**
 * Descargas de los accesos de delegados recién generados (ADR-005). Los tokens solo llegan
 * una vez desde el backend, así que se descargan en el momento: el CSV (para enviarlos por
 * correo o WhatsApp) se arma aquí; la hoja de QR para imprimir es un PDF que genera el
 * backend (`downloadVoterAccessSheet`), según la muestra de MUNYCH. Cada acceso lleva
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

/** Descarga un archivo generado en el navegador o recibido del backend. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadVoterCsv(slug: string, tokens: GeneratedVoterToken[]) {
  const header = ['Comité', 'Delegación', 'Delegado', 'Enlace de votación', 'Código de respaldo'];
  const rows = tokens.map((t) => [t.committee_acronym, delegationLabel(t), t.full_name, t.url, t.code]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  // BOM para que Excel abra el CSV en UTF-8 (acentos y ñ).
  downloadBlob(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }), `${slug}-accesos-votacion.csv`);
}
