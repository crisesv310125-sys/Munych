# Resultados públicos MUNYCH — handoff

Diseño estático de referencia (abrir "Resultados Publicos.dc.html" en navegador).

Pantallas:
- 2a Portal de eventos: evento más reciente destacado + lista agrupada por año, orden Más recientes / Más antiguos, búsqueda, "cargar más".
- 2b Alternativa: evento con pestañas por comité (opcional).
- 2c Móvil del detalle de comité.
- 2d Evento: tarjetas por comité con premios (1º destacado, 2º/3º), estados "solo un premio" y "Pendiente".
- 2e Detalle de comité: premios + tabla ranking (Pos., Delegación con código ISO, Delegado(s), Puntaje; "—" si no hay puntaje).

Flujo: 2a → 2d → 2e.

Sistema visual:
- Colores: navy #08243F, azul #12466F, dorado #C9A227, plata #C2C6C9, bronce #C08457, fondo #F7F6F2, texto secundario #5B6E80, muted #8898A6.
- Tipos: Source Serif 4 (títulos, países, puntajes), IBM Plex Sans (UI), IBM Plex Mono (etiquetas, fechas, posiciones).
- Radios 7–12px, bordes rgba(8,36,63,.12), hit targets ≥44px en móvil.

Reglas de datos:
- Público NO muestra desviación, jueces ni comentarios (solo admin).
- Eventos ordenados por fecha de inicio; agrupar por año.
- Comités sin publicar → estado "Pendiente".
