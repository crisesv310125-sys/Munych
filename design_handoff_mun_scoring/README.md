# Handoff: App de calificación MUN — MUNYCH Association

## Overview
Web app para calificar delegaciones (países) en un Modelo de Naciones Unidas. Dos roles:

- **Juez / chair**: califica cada país de sus comités con 7 criterios ponderados (0–100 cada uno), deja un comentario libre y ve su ranking parcial. Debe funcionar **desde el teléfono durante el comité** y también **desde computadora**.
- **Admin**: gestiona comités, países, jueces, criterios y pesos; ve el progreso del evento, el ranking final por comité y exporta resultados.

Sin timers ni cronómetros — el diseño no contempla control de tiempo de palabra.

Stack objetivo declarado por el usuario: **React + Vite**.

## About the Design Files
Los archivos de este bundle son **referencias de diseño creadas en HTML** — prototipos que muestran el aspecto y el comportamiento buscados, **no código de producción para copiar directamente**. El HTML usa un runtime de prototipado propio (`support.js`, tags `<x-dc>`, `<sc-for>`, `{{ }}`) que **no debe portarse**: es solo el andamio del prototipo.

La tarea es **recrear estas pantallas en React + Vite** con los patrones y librerías del proyecto destino (o eligiendo una base razonable si el proyecto aún no existe: Vite + React + TypeScript, React Router, y CSS Modules / Tailwind con los tokens de más abajo). Todo el estilo del prototipo está inline; al reimplementar conviene extraer los tokens a variables CSS o a la config de Tailwind.

## Fidelity
**High-fidelity (hifi)**. Colores, tipografía, espaciado y estados están definidos. Reprodúcelos con precisión usando los componentes y utilidades del codebase destino. Los datos (países, nombres de jueces, puntajes) son de muestra.

---

## Design Tokens

### Color
| Token | Hex | Uso |
| --- | --- | --- |
| `navy` | `#0B2A4A` | Primario: headers, sidebar, botones primarios, títulos de marca |
| `navy-light` | `#123B63` | Hover de botones/superficies navy |
| `un-blue` | `#418FDE` | Acentos interactivos, enlaces, barras de datos |
| `gold` | `#C9A227` | Acentos, medallas 1.º, barras de progreso en curso, énfasis puntual |
| `white` | `#FFFFFF` | Superficies de tarjetas/tablas |
| `bg` | `#F5F7FA` | Fondo de página y paneles laterales |
| `ink` | `#1B2733` | Texto principal |
| `muted` | `#5B6B7C` | Texto secundario, labels |
| `border` | `#E3E8EF` | Bordes de tarjetas y separadores principales |
| `border-soft` | `#EEF1F5` | Separadores de filas de tabla |
| `border-input` | `#CBD5E1` | Bordes de inputs; también medalla 2.º lugar |
| `row-hover` | `#F9FAFC` | Hover de fila de tabla |
| `row-selected` | `#F5F9FF` | Fila / opción seleccionada |
| `chip-neutral-bg` | `#F2F4F8` | Fondo de chips neutros y badges de peso |

### Colores semánticos de estado
| Estado | Punto / barra | Fondo de badge | Texto de badge |
| --- | --- | --- | --- |
| Sin calificar | `#98A6B5` | `#F2F4F8` | `#5B6B7C` |
| En progreso | `#C9A227` | `#FBF4DF` | `#8A6F12` |
| Completo | `#2F8F6E` | `#E7F4EF` | `#1F6B52` |

Medallas: 1.º `#C9A227` con texto `#FFFFFF`; 2.º `#CBD5E1` con texto `#1B2733`; 3.º `#D8A47F` con texto `#FFFFFF`; 4.º y siguientes `#F2F4F8` con texto `#5B6B7C`.

Aviso/atención (callout): fondo `#FBF4DF`, borde `#F0E2B6`, texto `#8A6F12`.

Escala del reparto de pesos (barra apilada de criterios, en orden): `#0B2A4A`, `#123B63`, `#2F6BA8`, `#418FDE`, `#7BB4E9`, `#C9A227`, `#E0C464`.

### Tipografía
- **Playfair Display** (serif, Google Fonts, pesos 500/600/700) — títulos de pantalla, nombres de comités y de países, cifras clave (puntajes, contadores). Casi siempre `font-weight: 600`, `line-height: 1.1–1.2`.
- **Inter** (sans-serif, Google Fonts, pesos 400/500/600/700) — toda la interfaz: labels, tablas, formularios, botones, badges.
- Escala Inter: 10 / 11 / 12 / 13 / 14 / 15 / 17 px. Labels de columna y eyebrows: 11 px, `font-weight: 600`, `letter-spacing: .08–.16em`, `text-transform: uppercase`, color `muted`.
- Escala Playfair: 15 / 16 / 17 / 18 / 19 / 21 / 22 / 24 / 26 / 28 / 32 / 38 / 40 px.
- Jerarquía por tamaño, peso y espaciado — **no por color**. Texto largo con `text-wrap: pretty`.

### Espaciado, radios y sombras
- Espaciado (gap/padding): 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 44 px.
- Radios: 5 px (badge de peso, checkbox), 6 px, 7 px (item de nav), 8 px (botones, inputs), 9–10 px (tarjetas pequeñas), 11–12 px (tarjetas y contenedores grandes), 26 px (marco de teléfono), `999px` (píldoras y avatares).
- Sombras: contenedor de pantalla `0 12px 34px rgba(11,42,74,.10)`; marco mobile `0 12px 34px rgba(11,42,74,.14)`; modal `0 18px 40px rgba(11,42,74,.14)`; vista previa de documento `0 8px 22px rgba(11,42,74,.08)`; thumb de slider `0 1px 4px rgba(11,42,74,.35)`.
- Altura de barra de progreso: 4 px (inline en lista), 5 px, 6 px (estándar), 10 px (barra apilada de pesos). Radio = mitad de la altura. Pista `#E3E8EF`.

---

## Componentes reutilizables

### Button
- **Primario**: fondo `navy`, texto `#FFFFFF`, sin borde, radio 8, padding `11–14px 16–18px`, 13–14 px / 600. Hover: fondo `navy-light`.
- **Secundario**: fondo `#FFFFFF`, texto `navy`, borde `1px solid #CBD5E1`, mismo radio y padding. Hover: borde `navy`.
- **Dorado** (solo acción destacada sobre navy, p. ej. "Exportar" en resultados y "Entrar" en el login móvil): fondo `gold`, texto `navy`, peso 700. Hover: `#DDB431`.
- **Sobre navy, secundario**: fondo `rgba(255,255,255,.1)`, borde `rgba(255,255,255,.22)`, texto blanco.
- **Enlace**: texto `un-blue`, 12–13 px / 600, sin fondo. Hover: `navy`.
- En mobile, los botones ocupan el ancho completo y miden ≥ 44 px de alto.

### Input / Select / Textarea
Borde `1px solid #CBD5E1`, radio 8, padding `9–14px 12–13px`, 13–14 px, texto `ink`, fondo `#FFFFFF`, `outline: none`. **Focus**: borde `un-blue` (`#418FDE`). Sobre navy: fondo `rgba(255,255,255,.07–.09)`, borde `rgba(255,255,255,.2–.22)`, texto blanco, focus borde `gold`. Textarea: `resize: none`, `line-height: 1.5`.

### StatusBadge
Píldora: `display:inline-flex`, `gap:6px`, punto de 6 px `border-radius:50%`, 10–11 px / 700, padding `4–5px 9–10px`, radio `999px`. Colores según la tabla de estados. Texto en mayúsculas (SIN CALIFICAR / EN PROGRESO / COMPLETO / EN CURSO / CERRADO / SIN INICIAR).

### ProgressBar
Pista `#E3E8EF` con radio = mitad de altura y `overflow:hidden`; relleno `gold` si está en progreso, `#2F8F6E` si está completo, `#98A6B5` si no ha iniciado, `un-blue` en barras de dato/ranking. Cuando el valor es 0 se dibuja un relleno mínimo de 2–3 % en gris para que la barra no se vea vacía.

### Card
Fondo `#FFFFFF`, borde `1px solid #E3E8EF`, radio 10–12, padding 16–22. Hover de tarjeta interactiva: borde `un-blue`.

### Slider (criterio)
`input[type=range]`, appearance none, pista 4 px `#E3E8EF` radio 2; thumb 26 px circular, fondo `navy`, borde `3px solid #FFFFFF`, sombra `0 1px 4px rgba(11,42,74,.35)`, cursor pointer (thumb de 22 px en Firefox). Rango 0–100, paso 1.

Card de criterio: nombre (13–14 px / 600 `ink`) + badge de peso (`20%`, 10 px / 700, fondo `#F2F4F8`, radio 5) a la izquierda; valor actual a la derecha en Playfair 18–19 px / 600 `navy`. Debajo del slider, una fila de 10 px `#98A6B5` con `0` · `aporta X.X pts` · `100`.

### Table
Encabezado: fila de labels 11 px / 600 uppercase `muted`, `letter-spacing:.08em`, padding `11px 26px`, borde inferior `#EEF1F5`. Filas: padding `13–16px 26px`, borde inferior `#EEF1F5`, `align-items:center`, hover `#F9FAFC`, fila seleccionada `#F5F9FF`. Implementadas como **CSS grid** con `grid-template-columns` explícito y `gap:14–16px` (no `<table>`), con la misma plantilla de columnas en encabezado y filas. Números y acciones alineados a la derecha (`justify-self:end`).

### Checkbox / Toggle
Checkbox sin marcar: 16–18 px, radio 5, borde `1px solid #CBD5E1`. Marcado: fondo `navy`, glifo `✓` blanco de 11 px. Toggle activo: pista 40×22 `#2F8F6E`, radio 999, thumb blanco de 18 px alineado a la derecha con 2 px de padding.

### Avatar
Círculo de 30–40 px con iniciales, 11–14 px / 600. Fondos rotando entre `navy`, `navy-light`, `un-blue`, `muted`; texto blanco. Variante sobre navy: fondo `rgba(255,255,255,.12)` con borde `rgba(255,255,255,.2)`.

### Autosave indicator
Fila centrada: punto de 6 px `gold` con `animation: munPulse 1.6s ease-in-out infinite` (`@keyframes munPulse { 0%,100%{opacity:.35} 50%{opacity:1} }`) + texto 11–12 px / 600 `#2F8F6E`. Texto: `Guardando…` mientras hay cambios sin persistir, `Guardado automáticamente · hace un momento` cuando ya se guardó.

---

## Screens / Views

### Vista de juez — mobile (390 × 844, marco de referencia 390 × 780)
Patrón general: header `navy` con status bar simulada (no reproducir en la app real), contenido sobre `bg`, y en el dashboard una tab bar inferior blanca con borde superior `#E3E8EF` (3 items: Comités / Progreso / Perfil; activo `navy`, inactivo `#98A6B5`, iconos de 18 px, labels 10 px / 600).

#### 1. Login (mobile)
- Propósito: autenticar al chair.
- Fondo completo `navy`, padding lateral 28, contenido centrado vertical.
- Marca: círculo de 60 px con borde `rgba(201,162,39,.55)` y "M" en Playfair 26/700 `gold`; debajo "MUNYCH" en Playfair 26/600 blanco y "PANEL DE JUECES" 11 px uppercase `rgba(255,255,255,.6)`.
- Campos: Usuario (texto) y Contraseña (password), variante sobre navy, padding 14, 15 px.
- CTA `Entrar` en dorado, padding 16, 15 px / 700. Separador "o" con líneas `rgba(255,255,255,.16)`. Botón alterno `Usar código de acceso` (borde blanco translúcido).
- Pie: "MUNYCH Association · Edición 2026", 11 px `rgba(255,255,255,.42)`.

#### 2. Dashboard del juez (mobile)
- Header navy: saludo "Buenos días," (11 px translúcido) + nombre en Playfair 22/600 blanco + avatar 38 px.
- Fila "Mis comités" (13 px / 600) con contador "3 asignados" a la derecha.
- Una card por comité (gap 14): nombre en Playfair 19/600 `navy`, subtítulo "Sala A‑201 · 15 países" 12 px `muted`, StatusBadge arriba a la derecha; fila "9 de 15 calificados" + porcentaje en 700 `ink`; ProgressBar; CTA de ancho completo (`Continuar calificando` primario / `Empezar` secundario / `Ver resumen` secundario según estado).
- Datos de muestra: Consejo de Seguridad 9/15 (60 %, en progreso), ECOSOC 0/22 (sin iniciar), DISEC 18/18 (completo).

#### 3. Lista de países (mobile)
- Header navy con flecha "‹", título del comité en Playfair 20/600, subtítulo "9 de 15 calificados · promedio 86.4", buscador (variante sobre navy) y 3 chips de filtro: `Todos · 15` (activo: fondo blanco, texto navy), `Pendientes · 6`, `Listos · 9` (inactivos: `rgba(255,255,255,.09)`).
- Filas-card (min-height 64 px, gap 9): barra vertical de 4 px con el color de estado, nombre del país en Playfair 17/600, línea de estado 11 px `muted` ("Completo · 7 criterios" / "En progreso · 4 de 7" / "Sin calificar"), puntaje a la derecha en Playfair 20/600 (`navy`, o `—` en `#98A6B5` si no hay puntaje) con "/ 100" debajo en 10 px, y chevron "›".
- El buscador filtra la lista por nombre en vivo (case-insensitive, substring).

#### 4. Formulario de calificación (mobile)
- Header navy: flecha, nombre del país en Playfair 21/600, subtítulo "Consejo de Seguridad · país 10 de 15"; a la derecha el **total ponderado en vivo** en Playfair 30/600 `gold` con label "TOTAL PONDERADO" de 10 px.
- Cuerpo desplazable con una card de criterio por cada uno de los 7 criterios (ver componente Slider).
- Card de comentario: título 13 px / 600, textarea de 4 filas con placeholder "Observaciones sobre la participación de la delegación…", nota "Visible solo para el equipo de chairs y admins." en 10 px `#98A6B5`.
- Barra inferior fija: indicador de autoguardado centrado y dos botones — `‹ Estonia` (secundario, flex 1) y `Gabón ›` (primario, flex 1.4) — que navegan al país anterior/siguiente.

#### 5. Resumen de progreso (mobile)
- Header navy: "Mi progreso" en Playfair 22/600, subtítulo "Consejo de Seguridad · ranking parcial" y tres tiles `rgba(255,255,255,.08)` radio 10: CALIFICADOS 9 (blanco), PENDIENTES 6 (`gold`), PROMEDIO 86.4 (blanco), cifras en Playfair 24/600.
- Label "RANKING PARCIAL" 12 px / 600 `muted`.
- Filas de ranking: medalla circular de 26 px, nombre en Playfair 16/600 `navy` con ProgressBar de 4 px (`un-blue`, ancho = puntaje %) debajo, y puntaje a la derecha en Playfair 19/600.
- Al final, card con borde punteado `#CBD5E1`: "Te faltan 6 países por calificar" + enlace "Continuar ›".

### Vista de juez — desktop (ancho de referencia 1340)
Top nav `navy` (padding `16px 28px`): marca a la izquierda (círculo 28 px + "MUNYCH" en Playfair 15/600), items `Mis comités` (activo: `rgba(255,255,255,.12)`, radio 7) y `Mi progreso`; a la derecha nombre del juez 13 px + avatar 32 px.

#### 1w. Login (web)
Dos columnas. Izquierda 520 px `navy`, padding 44, `justify-content: space-between`: marca arriba, en medio "Panel de jueces" en Playfair 38/600 blanco + párrafo 14 px `rgba(255,255,255,.65)` (máx. 340 px), pie "MUNYCH 2026 · Sesión de marzo". Derecha: formulario de 380 px centrado — "Iniciar sesión" Playfair 26/600, subtítulo 13 px, campos Usuario y Contraseña (variante clara), fila con checkbox "Mantener sesión" y enlace "¿Olvidaste tu contraseña?", CTA primario de ancho completo, separador "o", botón `Usar código de acceso`.

#### 2w. Dashboard del juez (web)
- Encabezado de página: "Buenos días, Andrea" en Playfair 26/600 + línea "Tienes 3 comités asignados · 27 de 55 delegaciones calificadas"; a la derecha card "AVANCE TOTAL" con 49 % en Playfair 22/600 y barra de 140 px.
- Grid de 3 columnas (gap 18) con la misma card de comité de mobile, escalada (título Playfair 21/600, padding 20).

#### 3w + 4w. Países y calificación (maestro-detalle, una sola pantalla)
- Header navy del comité: flecha, título Playfair 22/600, subtítulo "9 de 15 calificados · promedio del juez 86.4"; a la derecha barra de 200 px + "60 %".
- **Columna izquierda 360 px** (`bg`, borde derecho `#E3E8EF`): buscador y chips de filtro (activo: fondo `navy`, texto blanco; inactivos blancos con borde); lista de países compacta (Playfair 15/600, barra de estado de 3 px, puntaje Playfair 17/600), hover borde `un-blue`.
- **Detalle**: cabecera con nombre del país en Playfair 28/600, "Delegada: M. Ocampo · país 10 de 15"; a la derecha el total ponderado en Playfair 40/600 `navy` con label "TOTAL PONDERADO / 100" y los botones anterior/siguiente.
- Cuerpo: **grid de 2 columnas** con las 7 cards de criterio (gap 14) y, a la derecha (flex 1, `position: sticky; top: 20px`), panel `bg` con el comentario (textarea de 7 filas), el indicador de autoguardado y el botón `Marcar como completo`.

#### 5w. Resumen de progreso (web)
- Cabecera: "Mi progreso · Consejo de Seguridad" Playfair 24/600 + aclaración "Ranking parcial según tus calificaciones. No es el resultado oficial del comité."; a la derecha tres tiles `bg` con CALIFICADOS / PENDIENTES / PROMEDIO.
- Tabla de ranking, columnas `70px 2fr 3fr 100px`: POS. (medalla 30 px), PAÍS (Playfair 18/600), PUNTAJE (barra `un-blue`), TOTAL (Playfair 20/600, derecha).
- Panel derecho de 360 px: "PENDIENTES" con 6 filas país + enlace "Calificar ›" y CTA `Continuar con Estonia` al fondo.

### Vista de admin — desktop (1340)
Sidebar de 232 px `navy`, padding `22px 16px`: marca (círculo 30 px + "MUNYCH" Playfair 15/600 y "ADMIN" 9 px `letter-spacing:.14em`), nav vertical (Dashboard / Comités / Países / Jueces / Criterios / Resultados / Exportar; activo `rgba(255,255,255,.12)` radio 7, inactivo `rgba(255,255,255,.68)`, hover `rgba(255,255,255,.06)`), y al fondo una card "Evento activo / MUNYCH 2026".

Patrón de pantalla de gestión: cabecera blanca (título Playfair 21/600 + subtítulo 12 px `muted`, acciones a la derecha) + tabla en grid + **panel lateral derecho de 400–420 px** (`bg`, borde izquierdo) que hace de modal/inspector contextual.

#### 6. Dashboard general
- Topbar blanco: "Panel general" Playfair 22/600 + "Sábado 14 de marzo · sesión 2 en curso"; botón `Exportar todo` y avatar "SG".
- 4 KPI cards (grid de 4, gap 16): COMITÉS 8 ("6 en sesión · 2 cerrados"), DELEGACIONES 146, JUECES ACTIVOS 17 ("14 calificando ahora") — cifras en Playfair 32/600 `navy` — y una cuarta card **invertida** (fondo `navy`) con PROGRESO GLOBAL 62 % en `gold` y barra `rgba(255,255,255,.16)`.
- Card "Progreso por comité" con enlace "Ver detalle" y tabla `1.6fr 1fr 1fr 2fr 90px`: COMITÉ (Playfair 16/600) · JUECES · PAÍSES · AVANCE (barra + %) · ESTADO (badge a la derecha). Filas: Consejo de Seguridad 60 %, ECOSOC 18 %, DISEC 100 % (cerrado), CIJ 0 % (sin iniciar).

#### 7. Gestión de comités (tabla + modal)
- Cabecera: "Comités" + "8 comités · 146 delegaciones"; buscador de 230 px y `+ Nuevo comité`.
- Tabla `2fr 1.1fr .8fr .8fr 1fr 70px`: NOMBRE (Playfair 16/600) · SALA · PAÍSES · JUECES · ESTADO · acción "Editar". La fila en edición queda con fondo `#F5F9FF`.
- Panel/modal "Editar comité": card blanca con sombra de modal — header con título Playfair 18/600 y "✕"; campos Nombre, Sigla + Sala (2 columnas), selects "Idioma de trabajo" (Español/Inglés) y "Set de criterios" (Estándar MUNYCH 7 criterios / Corte de Justicia 5 criterios); fila `bg` con toggle "Comité visible para jueces"; footer con `Cancelar` + `Guardar cambios` alineados a la derecha.

#### 8. Países por comité (tabla + carga masiva)
- Cabecera: "Países · Consejo de Seguridad" + "15 delegaciones registradas"; select de comité y `+ Añadir país`.
- Tabla `36px 2fr 1.6fr 1.2fr 80px`: checkbox de selección · PAÍS (Playfair 16/600) · DELEGADO · ESTADO (badge "3 / 3 JUECES" en verde, "2 / 3" y "1 / 3" en dorado, "0 / 3" en gris) · "Editar".
- Panel derecho "Carga masiva": instrucción con columnas `pais, delegado, correo` en monospace 11 px; dropzone punteada (icono 38 px, "Arrastra el archivo aquí", "o selecciona un archivo" con el enlace en `un-blue`); card de archivo subido con nombre, barra verde al 100 % y "15 filas válidas · 0 errores"; enlace "Descargar plantilla CSV"; CTA `Importar 15 países`.

#### 9. Jueces y asignación
- Tabla `2fr 1.8fr 1.6fr 1fr 80px`: JUEZ (avatar 30 px + nombre 14/600) · CORREO · COMITÉS (siglas separadas por "·", "Sin asignar" en `#98A6B5`) · AVANCE (% o "—") · "Asignar". Fila activa `#F5F9FF`. Cabecera con `+ Invitar juez`.
- Panel derecho: identidad del juez (avatar 40 px, nombre Playfair 18/600, "Chair senior · desde 2023"); label "ASIGNAR A COMITÉS" y lista de comités como filas seleccionables (seleccionado: borde `navy` + checkbox marcado; no seleccionado: borde `#E3E8EF`, texto `muted`, hover borde `un-blue`); callout dorado "Un juez asignado a más de 3 comités difícilmente completa sus calificaciones a tiempo."; CTA `Guardar asignación`.

#### 10. Criterios y pesos
- Tabla `32px 2.2fr 2.6fr 130px 70px`: handle de arrastre "⠿" `#CBD5E1` (orden reordenable) · CRITERIO (14/600) · DESCRIPCIÓN (12 px `muted`) · PESO (mini-barra de 52 px `un-blue` + valor en Playfair 17/600, alineado a la derecha) · "Editar".
- **Fila de suma** (fondo `#F5F9FF`): "Suma total de pesos" + badge `VÁLIDO` verde + "100%" en Playfair 26/600. Si la suma ≠ 100 el badge debe pasar a estado de error/atención y bloquear el guardado.
- Panel derecho "Editar criterio": Nombre, "Descripción para el juez" (textarea 3 filas), Peso (label + valor en Playfair 20/600 + slider 0–50), card "Reparto actual" con la barra apilada de 10 px de los 7 criterios y la leyenda "7 criterios · suma 100% · sin sobrantes"; `Cancelar` + `Guardar`.

#### 11. Resultados / ranking final
- Header `navy` (padding `24px 26px`): eyebrow "RESULTADOS FINALES", nombre del comité en Playfair 28/600, "15 países · 3 jueces · promedio ponderado del comité 84.7"; botones `Publicar resultados` (secundario sobre navy) y `Exportar` (dorado).
- Tabla `70px 2.2fr 1fr 1fr 1fr 1fr 110px`: POS. (medalla 32 px) · PAÍS (Playfair 18–19/600) · CONOCIM. · ORATORIA · DIPLOM. · OTROS (promedio del resto, en `muted`) · TOTAL (Playfair 22–24/600, derecha). La fila del 1.º lleva fondo `#FDFBF3`.
- **Fila expandible**: al expandir un país se inserta un bloque `#F9FAFC` con sangría izquierda de 96 px y dos columnas — izquierda "DESGLOSE POR CRITERIO · <PAÍS>" con una fila por criterio (`1.6fr 46px 1.6fr 52px`: nombre · peso · barra `un-blue` · valor) y derecha "POR JUEZ" con una card por juez (nombre + puntaje en Playfair 16/600) más una card "COMENTARIO DESTACADO" con la cita en 12 px / `line-height:1.55`.
- Datos de muestra: 1 Estados Unidos 94.2 · 2 Francia 91.8 · 3 Reino Unido 89.5 · 4 Brasil 87.1 · 5 Emiratos Árabes Unidos 84.6.

#### 12. Exportación de resultados
- Columna principal con 3 pasos numerados (labels "1 · COMITÉS", "2 · FORMATO", "3 · CONTENIDO"):
  1. Grid de 3 columnas de comités seleccionables (seleccionado: fondo `#F5F9FF`, borde `navy`, checkbox marcado) + una celda punteada "Seleccionar todos".
  2. Tres cards de formato: **PDF** ("Acta oficial con ranking y medallas, membretada."), **XLSX** ("Una hoja por comité, desglose por criterio y juez."), **CSV** ("Datos planos para procesar externamente."). La activa lleva fondo `#F5F9FF` y borde `navy`.
  3. Cuatro checkboxes: Puntaje total ponderado ✓, Desglose por criterio ✓, Comentarios de los jueces, Nombre del juez junto a cada calificación.
- Panel derecho 420 px "VISTA PREVIA": mini documento blanco con escudo, nombre del comité, "RESULTADOS OFICIALES · MUNYCH 2026" y las 5 primeras posiciones con medallas de 18 px; card resumen "Se exportarán / 2 comités · 33 países · PDF"; CTA `Generar archivo` y nota "El archivo queda registrado en el historial del evento."

---

## Interactions & Behavior

### Cálculo del puntaje (regla central)
Criterios y pesos por defecto (set "Estándar MUNYCH"), suman 100:

| Criterio | Peso |
| --- | --- |
| Conocimiento del tema | 20 % |
| Oratoria | 20 % |
| Procedimiento parlamentario | 15 % |
| Diplomacia | 15 % |
| Redacción | 15 % |
| Liderazgo | 10 % |
| Actitud | 5 % |

- Cada criterio se puntúa 0–100 con paso 1.
- Aporte de un criterio = `valor * peso / 100`; se muestra con 1 decimal en "aporta X.X pts".
- Total ponderado = suma de aportes, mostrado con 1 decimal (0–100). Se recalcula **en cada cambio del slider**, sin botón de calcular.
- El promedio de un comité es el promedio de los totales ponderados de los países calificados.
- Los pesos son configurables por el admin y deben sumar exactamente 100 % para poder guardarse.

Descripciones de criterio mostradas al juez y en la gestión de criterios:
- Conocimiento del tema — "Dominio del tema, datos y política exterior del país."
- Oratoria — "Claridad, dicción, estructura del discurso y manejo del tiempo."
- Procedimiento parlamentario — "Uso correcto de mociones, puntos y reglas del comité."
- Diplomacia — "Negociación, respeto y construcción de consensos."
- Redacción — "Calidad del papel de trabajo y de la resolución."
- Liderazgo — "Capacidad de articular bloques y dirigir el debate."
- Actitud — "Puntualidad, protocolo y disposición durante la sesión."

### Autoguardado
Al mover un slider o editar el comentario: estado `dirty` inmediato → indicador "Guardando…". Tras ~900 ms sin nuevos cambios (debounce) se persiste y el indicador pasa a "Guardado automáticamente · hace un momento". En producción, el debounce debe disparar el PATCH al backend y manejar fallo de red con reintento y un estado visible de error (usar el mismo indicador con color de atención). Nunca se pierde trabajo al navegar entre países.

### Estado de calificación
- **Sin calificar**: ningún criterio tocado.
- **En progreso**: al menos uno y no todos ("En progreso · 4 de 7").
- **Completo**: los 7 criterios con valor ("Completo · 7 criterios"); el juez puede además marcar explícitamente `Marcar como completo`.

### Navegación
- Juez: Login → Dashboard → Lista de países del comité → Formulario del país; "Mi progreso" accesible desde el nav/tab bar. Los botones anterior/siguiente recorren la lista **filtrada** actual y guardan antes de cambiar.
- Admin: sidebar persistente; los paneles laterales/modales se abren desde la acción de fila ("Editar", "Asignar") y no cambian de ruta.

### Búsqueda y filtros
Buscador de países: filtrado en cliente, sin acentos sensibles idealmente, substring case-insensitive, en vivo. Chips: Todos / Pendientes / Listos, con el conteo en la etiqueta.

### Estados y validación
- Suma de pesos ≠ 100 % → badge de error y guardado bloqueado.
- Carga masiva CSV → validar por fila; mostrar "N filas válidas · M errores"; con errores, listar las filas problemáticas antes de importar.
- Listas vacías → mensaje en card de borde punteado (mismo patrón que "Te faltan 6 países por calificar").
- Hover/focus como se describe en cada componente; el foco de teclado debe ser visible (borde `un-blue`).

### Animaciones
Solo micro-interacciones: hovers instantáneos (`transition` de 120–150 ms en `background`/`border-color`), transición de ancho de las barras de progreso (~200 ms `ease-out`), y el pulso del punto de autoguardado (`munPulse`, 1.6 s, infinito). Sin animaciones decorativas.

### Responsive
Mobile-first para el rol juez (el diseño móvil es la referencia por debajo de ~768 px; el diseño web por encima). El admin es desktop-first: por debajo de ~1100 px, el panel lateral derecho debe pasar a modal a pantalla completa y las tablas a scroll horizontal o a lista de cards.

---

## State Management

Estado de UI sugerido (el prototipo lo resuelve con estado local; en producción conviene React Query/SWR para datos de servidor + estado local para el formulario):

- `session`: usuario, rol (`judge` | `admin`), token.
- `committees[]`: id, nombre, sigla, sala, idioma, criteriaSetId, visible, countryCount, judgeCount, progress, status.
- `countries[]`: id, committeeId, nombre, delegado, correo.
- `judges[]`: id, nombre, correo, committeeIds[], progress.
- `criteria[]`: id, nombre, descripción, peso, orden.
- `scores`: por (judgeId, countryId) → `{ values: Record<criterionId, number>, comment: string, status, updatedAt }`.
- Formulario de calificación: `values`, `comment`, `saveState: 'saved' | 'saving' | 'error'`, timer de debounce, índice del país actual dentro de la lista filtrada.
- Lista de países: `query`, `filter: 'all' | 'pending' | 'done'`.
- Resultados: derivados del servidor (promedio entre jueces por criterio y total, ranking, desglose por juez).

Datos: el prototipo no hace red. Al implementar, endpoints esperados por pantalla — `GET /me/committees`, `GET /committees/:id/countries` (con estado y puntaje del juez), `GET/PATCH /scores/:countryId` (autosave), `GET /committees/:id/results`, y CRUD de comités/países/jueces/criterios + `POST /committees/:id/countries/bulk` y `POST /exports`.

## Assets
No hay imágenes ni librería de iconos: el logotipo es la letra "M" en Playfair Display sobre un círculo, los iconos de la tab bar y del dropzone son cuadrados/círculos de placeholder, y los glifos usados son caracteres de texto (`‹`, `›`, `✕`, `✓`, `⠿`). Al implementar, sustituir por el logotipo real de MUNYCH y por un set de iconos consistente de línea (p. ej. Lucide), manteniendo el trazo fino y el color `muted`/`navy`.

Fuentes: Google Fonts — Playfair Display (500/600/700) e Inter (400/500/600/700).

## Files
- `MUNYCH Scoring.dc.html` — prototipo completo: sistema de diseño, 5 pantallas de juez mobile, 4 de juez web y 7 del panel admin. **Referencia principal.**
- `MUNYCH Scoring-print.dc.html` — copia paginada del mismo diseño para exportar a PDF (14 hojas horizontales). Solo documentación.
- `support.js`, `doc-page.js` — runtime del entorno de prototipado. **No portar.**

Para leer el prototipo: el markup está entre `<x-dc>` y `</x-dc>` con estilos inline; `<sc-for list="{{ x }}" as="y">` es un `.map()`, `{{ }}` son valores calculados en la clase `Component` al final del archivo (ahí están los pesos, los datos de muestra y la lógica de total ponderado y autoguardado).
