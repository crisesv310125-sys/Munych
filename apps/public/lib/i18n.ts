/**
 * Idiomas de la página pública. Los textos de la interfaz viven aquí; los nombres de eventos y
 * comités llegan del documento publicado tal cual y no se traducen.
 */

export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es';

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const es = {
  meta: {
    title: 'Resultados MUNYCH',
    description: 'Resultados públicos de los eventos MUNYCH Association / GRAND International.',
    results: 'Resultados',
  },
  lang: { switchTo: 'English', short: 'EN' },
  header: {
    officialResults: 'RESULTADOS OFICIALES',
    mobileTag: 'MUNYCH · RESULTADOS',
    allEvents: 'Todos los eventos',
    breadcrumb: 'Ruta',
    events: 'Eventos',
  },
  portal: {
    eyebrow: 'EVENTOS PUBLICADOS',
    title: 'Consulta los reconocimientos de cada comité.',
    latest: 'MÁS RECIENTE',
    published: 'RESULTADOS PUBLICADOS',
    viewResults: 'Ver resultados →',
    bestByCommittee: 'MEJOR DELEGACIÓN POR COMITÉ',
    awardsPending: 'Los premios de este evento aún no se publican.',
    moreCommittees: (n: number) => `+ ${n} ${plural(n, 'comité', 'comités')}`,
    noEvents: 'Todavía no hay eventos con resultados publicados.',
    allEvents: 'Todos los eventos',
    publishedCount: (n: number) => `${n} ${plural(n, 'PUBLICADO', 'PUBLICADOS')}`,
    searchPlaceholder: 'Buscar evento…',
    searchLabel: 'Buscar evento',
    order: 'Orden',
    newest: 'Más recientes',
    oldest: 'Más antiguos',
    view: 'Ver →',
    noMatch: (q: string) => `Ningún evento coincide con «${q}».`,
    onlyOne: 'Por ahora este es el único evento publicado.',
    loadMore: 'Cargar más eventos ▾',
  },
  event: {
    committees: 'COMITÉS',
    delegations: 'DELEGACIONES',
    pending: 'PENDIENTE',
    committeePending: 'Los resultados de este comité aún no se publican.',
    delegationsShort: (n: number) => `${n} DELEG.`,
    fullRanking: 'Ver ranking completo →',
    viewAwards: 'Ver premios →',
    singleAward: 'Este comité solo otorgó un premio.',
    searchPlaceholder: 'Buscar comité, país o delegado…',
    searchLabel: 'Buscar comité, país o delegado',
    publishedAt: (date: string) => `PUBLICADO ${date}`,
    noCommittees: 'Este evento todavía no tiene comités publicados.',
    noMatch: (q: string) => `Ningún comité coincide con «${q}».`,
    showMore: (n: number) => `Ver ${n} ${plural(n, 'comité más', 'comités más')} ▾`,
  },
  committee: {
    backToEvent: (event: string) => `← ${event} · todos los comités`,
    awards: 'Premios',
    switch: 'Cambiar comité',
    chips: 'Comités',
  },
  ranking: {
    title: (n: number) => `Ranking · ${n} ${plural(n, 'delegación', 'delegaciones')}`,
    titleShort: (n: number) => `Clasificación · ${n} deleg.`,
    searchPlaceholder: 'Buscar país o delegado…',
    searchLabel: 'Buscar país o delegado',
    position: 'POS.',
    delegation: 'DELEGACIÓN',
    delegates: 'DELEGADO(S)',
    score: 'PUNTAJE',
    noMatch: (q: string) => `Ninguna delegación coincide con «${q}».`,
    missingScore: '— Puntaje no disponible (sin calificaciones completas)',
    showAllCount: (n: number) => `Ver las ${n} ▾`,
    showAll: 'Ver todas ▾',
  },
  generalRanking: {
    title: (n: number) => `Ranking general · ${n} ${plural(n, 'delegación', 'delegaciones')}`,
    titleShort: (n: number) => `Ranking general · ${n} deleg.`,
    searchPlaceholder: 'Buscar país, comité o delegado…',
    searchLabel: 'Buscar país, comité o delegado',
    delegates: 'COMITÉ — DELEGADO(S)',
  },
  share: {
    share: 'Compartir',
    pdf: 'Descargar PDF',
    copied: 'Enlace copiado',
    copyFailed: 'No se pudo copiar el enlace',
  },
  awards: {
    best_delegate: 'Mejor delegado',
    outstanding_delegate: 'Delegado distinguido',
    honorable_mention: 'Mención honorífica',
    verbal_commendation: 'Mención verbal',
  } as Record<string, string>,
};

export type Dictionary = typeof es;

const en: Dictionary = {
  meta: {
    title: 'MUNYCH Results',
    description: 'Public results of MUNYCH Association / GRAND International events.',
    results: 'Results',
  },
  lang: { switchTo: 'Español', short: 'ES' },
  header: {
    officialResults: 'OFFICIAL RESULTS',
    mobileTag: 'MUNYCH · RESULTS',
    allEvents: 'All events',
    breadcrumb: 'Breadcrumb',
    events: 'Events',
  },
  portal: {
    eyebrow: 'PUBLISHED EVENTS',
    title: 'Browse the awards of every committee.',
    latest: 'LATEST',
    published: 'RESULTS PUBLISHED',
    viewResults: 'View results →',
    bestByCommittee: 'BEST DELEGATION BY COMMITTEE',
    awardsPending: 'Awards for this event have not been published yet.',
    moreCommittees: (n: number) => `+ ${n} ${plural(n, 'committee', 'committees')}`,
    noEvents: 'There are no events with published results yet.',
    allEvents: 'All events',
    publishedCount: (n: number) => `${n} PUBLISHED`,
    searchPlaceholder: 'Search events…',
    searchLabel: 'Search events',
    order: 'Order',
    newest: 'Newest',
    oldest: 'Oldest',
    view: 'View →',
    noMatch: (q: string) => `No events match “${q}”.`,
    onlyOne: 'This is the only published event for now.',
    loadMore: 'Load more events ▾',
  },
  event: {
    committees: 'COMMITTEES',
    delegations: 'DELEGATIONS',
    pending: 'PENDING',
    committeePending: 'Results for this committee have not been published yet.',
    delegationsShort: (n: number) => `${n} DELEG.`,
    fullRanking: 'View full ranking →',
    viewAwards: 'View awards →',
    singleAward: 'This committee gave a single award.',
    searchPlaceholder: 'Search committee, country or delegate…',
    searchLabel: 'Search committee, country or delegate',
    publishedAt: (date: string) => `PUBLISHED ${date}`,
    noCommittees: 'This event has no published committees yet.',
    noMatch: (q: string) => `No committees match “${q}”.`,
    showMore: (n: number) => `Show ${n} more ${plural(n, 'committee', 'committees')} ▾`,
  },
  committee: {
    backToEvent: (event: string) => `← ${event} · all committees`,
    awards: 'Awards',
    switch: 'Switch committee',
    chips: 'Committees',
  },
  ranking: {
    title: (n: number) => `Ranking · ${n} ${plural(n, 'delegation', 'delegations')}`,
    titleShort: (n: number) => `Ranking · ${n} deleg.`,
    searchPlaceholder: 'Search country or delegate…',
    searchLabel: 'Search country or delegate',
    position: 'POS.',
    delegation: 'DELEGATION',
    delegates: 'DELEGATE(S)',
    score: 'SCORE',
    noMatch: (q: string) => `No delegations match “${q}”.`,
    missingScore: '— Score unavailable (incomplete grading)',
    showAllCount: (n: number) => `Show all ${n} ▾`,
    showAll: 'Show all ▾',
  },
  generalRanking: {
    title: (n: number) => `Overall ranking · ${n} ${plural(n, 'delegation', 'delegations')}`,
    titleShort: (n: number) => `Overall ranking · ${n} deleg.`,
    searchPlaceholder: 'Search country, committee or delegate…',
    searchLabel: 'Search country, committee or delegate',
    delegates: 'COMMITTEE — DELEGATE(S)',
  },
  share: {
    share: 'Share',
    pdf: 'Download PDF',
    copied: 'Link copied',
    copyFailed: 'Could not copy the link',
  },
  awards: {
    best_delegate: 'Best delegate',
    outstanding_delegate: 'Outstanding delegate',
    honorable_mention: 'Honorable mention',
    verbal_commendation: 'Verbal commendation',
  },
};

const DICTIONARIES: Record<Locale, Dictionary> = { es, en };

export function getDictionary(locale: string): Dictionary {
  return DICTIONARIES[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

/** "/es/sd-mun-2026" → "/en/sd-mun-2026". */
export function localizedPath(pathname: string, locale: Locale): string {
  return pathname.replace(/^\/[^/]+/, `/${locale}`) || `/${locale}`;
}
