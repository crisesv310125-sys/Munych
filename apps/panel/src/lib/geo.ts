/**
 * Países (ISO-3166 alfa-2) y zonas horarias para el alta de eventos.
 * Los nombres los da el navegador (Intl.DisplayNames), así que no hay que mantener traducciones.
 */

const ISO_CODES =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO ' +
  'JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR ' +
  'MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO ' +
  'RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV ' +
  'TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW';

const regionNames = new Intl.DisplayNames(['es'], { type: 'region' });

export function countryName(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export const COUNTRIES: { code: string; name: string }[] = ISO_CODES.split(' ')
  .map((code) => ({ code, name: countryName(code) }))
  .sort((a, b) => a.name.localeCompare(b.name, 'es'));

/** Zona horaria sugerida al elegir país (la del lugar más habitual de los eventos). */
const COUNTRY_TIMEZONE: Record<string, string> = {
  AR: 'America/Argentina/Buenos_Aires',
  BO: 'America/La_Paz',
  BR: 'America/Sao_Paulo',
  CA: 'America/Toronto',
  CL: 'America/Santiago',
  CO: 'America/Bogota',
  CR: 'America/Costa_Rica',
  CU: 'America/Havana',
  DO: 'America/Santo_Domingo',
  EC: 'America/Guayaquil',
  ES: 'Europe/Madrid',
  GT: 'America/Guatemala',
  HN: 'America/Tegucigalpa',
  MX: 'America/Mexico_City',
  NI: 'America/Managua',
  PA: 'America/Panama',
  PE: 'America/Lima',
  PR: 'America/Puerto_Rico',
  PY: 'America/Asuncion',
  SV: 'America/El_Salvador',
  US: 'America/New_York',
  UY: 'America/Montevideo',
  VE: 'America/Caracas',
};

export function suggestedTimezone(countryCode: string): string | undefined {
  if (COUNTRY_TIMEZONE[countryCode]) return COUNTRY_TIMEZONE[countryCode];
  // Países con una sola zona: el navegador la conoce.
  try {
    const locale = new Intl.Locale(`und-${countryCode}`) as Intl.Locale & {
      getTimeZones?: () => string[];
      timeZones?: string[];
    };
    const zones = locale.getTimeZones?.() ?? locale.timeZones;
    return zones?.length === 1 ? zones[0] : undefined;
  } catch {
    return undefined;
  }
}

export const TIMEZONES: string[] = (() => {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return Object.values(COUNTRY_TIMEZONE);
  }
})();

/** "UTC−6", "UTC+5:30", "UTC" — desfase actual de la zona. */
export function utcOffsetLabel(timeZone: string): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value;
    if (!part) return '';
    return part.replace('GMT', 'UTC').replace('-', '−');
  } catch {
    return '';
  }
}
