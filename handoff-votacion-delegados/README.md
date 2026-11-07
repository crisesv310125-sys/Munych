# Handoff: Votación de delegados — SD MUN 2026 (Apartado 3)

## Overview
Boleta electrónica para delegados de un comité MUN, dentro del canvas de diseño "MUN Scoring Interface Design". Cubre un solo rol: **delegado autenticado** dentro de un comité (ej. "Kenia · Asamblea General") — no incluye vistas de juez ni de admin, que viven en otros apartados del mismo canvas.

Dos tipos de voto, que comparten la misma UI de confirmación/envío:

- **Voto de resolución en sesión**: A favor / En contra / Abstención, mientras la mesa tiene una resolución abierta.
- **Voto entre pares — "Mejor delegación"**: elegir un país de una lista; pondera **10%** del puntaje final y se habilita solo al cerrar la última sesión del comité.

Sin cronómetro de palabra ni control de tiempo de debate — esta sección es puramente de votación.

Stack objetivo: **no especificado** por el usuario para este apartado — confírmalo antes de construir. Los tokens de abajo son agnósticos de framework (van igual de bien a Tailwind, CSS Modules o styled-components).

## About the Design Files
Este spec se generó a partir de un canvas de diseño (`MUN Scoring Interface Design`, Turn 3 — screen-labels `19`–`27`, option-ids `3a`–`3h`), hecho en HTML con un runtime de prototipado propio (tags `<x-dc>`, `<sc-for>`, `{{ }}`). Ese HTML es **solo referencia visual y de comportamiento**, no código para copiar: el andamio de prototipado no se porta, el estilo inline sí se debe extraer a tokens/variables antes de reimplementar.

## Fidelity
**High-fidelity (hifi).** Color, tipografía, espaciado y estados están definidos con precisión en el mock — repróducelos tal cual con los componentes del codebase destino. Los datos (países, resoluciones, horarios) son de muestra.

---

## Design Tokens

### Color
| Token | Hex | Uso |
| --- | --- | --- |
| `ink` | `#08243F` | Primario: headers/appbar, fila seleccionada (fondo), botón "Enviar voto", texto oscuro fuerte |
| `ink-700` | `#0F2B45` | Texto de nombre de país/opción no seleccionada |
| `link` | `#12466F` | Enlaces de texto ("Leer texto completo →", "Mostrar las 23 ▾", "Volver y cambiar") |
| `muted-600` | `#5B6E80` | Texto secundario, metadatos, subtítulos |
| `muted-400` | `#8898A6` | Texto terciario/placeholder, eyebrows de meta-dato, chevron `›` |
| `gold` | `#C9A227` | CTA primario (fondo), chip de bandera propia, relleno de barra de progreso, anillo de radio seleccionado |
| `gold-text` | `#E2C25A` | Texto sobre fondo oscuro para countdown/estado ("Cierra 18:30", "POR VOTAR") |
| `on-gold` | `#2E2204` | Texto sobre botones dorados (contraste alto) |
| `bg-app` | `#EDEAE3` | Fondo fuera de tarjetas/pantalla |
| `bg-screen` | `#F7F6F2` | Fondo de pantalla |
| `white` | `#FFFFFF` | Tarjetas, inputs, bottom sheet |
| `disabled-bg` | `#EFEDE7` | Fondo de filas/opciones bloqueadas (propia delegación, sesión futura) |
| `disabled-chip` | `#E6E3DC` | Fondo de chip/avatar deshabilitado |
| `border` | `rgba(8,36,63,.12)` | Borde estándar de tarjeta/input |
| `border-strong` | `rgba(8,36,63,.18–.2)` | Borde de input activo / dashed de estado bloqueado |
| `radio-empty` | `#B8C2CC` | Borde de radio no seleccionado |
| `radio-disabled` | `#D3D8DD` | Borde de radio deshabilitado |

### Colores semánticos de estado
| Estado | Punto/ícono | Fondo de badge | Texto de badge |
| --- | --- | --- | --- |
| Abierta / en vivo | `#4CC38A` (verde) · `#E05A5A` (rojo "EN VIVO") | `rgba(29,90,64,.35)` verde · `rgba(214,72,72,.18)` rojo | `#9FD6B8` · `#F2A3A3` |
| Completo / a favor | `#1D5A40` | `#E4F0EA` | `#1D5A40` |
| Pendiente / advertencia | `#8A5A12` | `#FBF3DE` | `#6B500C` / `#8A5A12` |
| Bloqueado / cerrado | `#8898A6` | `#EDEAE3` | `#5B6E80` |

Countdown "cierra pronto": fondo `rgba(201,162,39,.16)`, texto `#E2C25A`, mono.

### Tipografía
- **Source Serif 4** (serif, Google Fonts, 400/600/700) — titulares de pregunta/estado: "¿Qué delegación tuvo el mejor desempeño?", "Voto registrado", "La votación aún no abre." Tamaños de 19 a 32 px, `line-height: 1.1–1.2`, casi siempre peso 700. Texto largo con `text-wrap: pretty`.
- **IBM Plex Sans** (sans-serif, 400/500/600/700) — toda la interfaz: nombres de país, botones, labels, cuerpo de texto. Escala 12.5–17 px.
- **IBM Plex Mono** (monoespaciada, 500/600) — metadatos, timers, ids de resolución, eyebrows en mayúsculas: "VOTO 1 DE 2", "COMPROBANTE", "SESIÓN 3". Escala 9.5–13 px, `letter-spacing: .04–.14em`, uppercase.
- Jerarquía por tamaño/peso/familia, no por color.

### Espaciado, radios y sombras
- Padding de pantalla: 16–20 px en mobile, 48 px en desktop.
- Separación entre filas de lista/opciones: 8–10 px.
- Radios: 4–6 px (chips de bandera/badges pequeños), 8–10 px (inputs, filas de lista, botones), 12 px (tarjetas de contenido), `999px`/20 px (píldoras de estado), 20 px arriba / hereda abajo (bottom sheet).
- Tap target mínimo: 48–52 px de alto en toda fila seleccionable y botón primario/secundario.
- Scrim de modal: `rgba(8,20,35,.55)`.

---

## Componentes reutilizables

### Button
- **Primario (dorado)**: fondo `gold`, texto `on-gold`, 600 15 px, alto mínimo 50–52 px, radio 10. Usado para la acción principal de cada boleta ("Votar ahora", "Revisar voto"). **El mock no define hover/active/disabled** — especificar antes de construir; razonable: disabled = opacidad reducida + no interactivo hasta que haya una selección.
- **Primario oscuro**: fondo `ink`, texto blanco — reservado para la acción irreversible "Enviar voto" dentro del bottom sheet de confirmación (distingue la acción final de la de "revisar").
- **Secundario (outline)**: sin fondo, borde `rgba(8,36,63,.2)`, texto `ink` — "Volver a sesiones", "Ver resultados públicos".
- **Terciario (texto/link)**: sin fondo ni borde, texto `link`, 600 14 px — "Volver y cambiar".

### Input de búsqueda
Borde `border`, radio 8, min-height 44 px, padding `0 14px`, placeholder "Buscar país…" en `muted-400`, fondo blanco. Filtra la lista en vivo — el mock no especifica si es case-insensitive/acento-insensible ni el estado "sin resultados"; asumir ambos comportamientos estándar y definir un empty-state de búsqueda antes de implementar.

### Fila de país/delegación (radio list)
- `default`: fondo blanco, radio vacío (`radio-empty`, 20 px), chip de 2 letras (código de país) + nombre.
- `selected`: fondo `ink`, radio con anillo dorado de 5–6 px, texto blanco, chip con fondo `gold`.
- `disabled / propia delegación`: fondo `disabled-bg`, borde dashed, radio `radio-disabled`, label "Tu delegación" / "TÚ", no clicable. Aparece en su posición alfabética normal — no se mueve ni se oculta.

### Opción de voto (resolución)
Radio de 28 px. `default`: borde `radio-empty`. `selected`: fondo `#E4F0EA`, borde 2 px `#1D5A40`, ícono de check relleno. Solo 3 opciones fijas y mutuamente excluyentes: A favor / En contra / Abstención.

### StatusBadge (píldora)
`display:inline-flex`, punto de color + texto uppercase mono 10–11 px/600, padding `4–6px 9–10px`, radio `999px`/20. Variantes: `live` (rojo, con punto), `countdown` (dorado), `neutral/cerrado` (gris), `success` (verde). El punto de color debe tener equivalente accesible (ver sección de accesibilidad abajo, si se agrega al proyecto).

### Barra de progreso de sesiones (segmentada)
Fila de N segmentos (uno por sesión del comité — **no hardcodear 5**, el mock muestra 5 porque el comité de ejemplo tiene 5 sesiones), 5 px de alto, radio 3: relleno `gold` (cerrada/votada), `rgba(201,162,39,.45)` (actual, parcial), `rgba(255,255,255,.18)` (futura).

### Bottom sheet de confirmación
Overlay con scrim + sheet anclado abajo (radio 20 px arriba), drag-handle de 40×4 px centrado. Contiene: eyebrow mono, titular serif dinámico ("Vas a votar por **{selección}**…"), tabla resumen 2 columnas (label gris / valor oscuro), banner de advertencia ("Una vez enviado no se puede cambiar."), botón primario oscuro + botón de texto. **Es un componente compartido**: se invoca tanto desde la boleta de resolución como desde la de pares, con los datos de cada una — el copy de "Peso: 10% del puntaje final" solo aplica al voto entre pares; para resolución ese campo debe omitirse o cambiar de copy (el mock solo ilustra el caso de pares).

### Tarjeta de comprobante (receipt)
Grid de 2 columnas (label `muted-400` / valor mono-bold `ink`, alineado a la derecha), fondo blanco, borde `border`, radio 12, padding 16–18. Usada en la pantalla de confirmación de envío con ID tipo `AG-7K2Q-91` (prefijo de comité + código) y fecha/hora.

### Autosave / live indicator
No aplica envío automático en esta sección (las boletas se envían con acción explícita), pero el patrón de punto pulsante existe en el design system del canvas (`@keyframes mun-pulse { 0%,100%{opacity:.35} 50%{opacity:1} }`, 1.8 s infinito) para estados "en vivo" — el badge "EN VIVO" de la boleta de resolución (3b) no trae la animación aplicada en el markup fuente; se recomienda aplicarla para consistencia con el resto del sistema, a confirmar con diseño.

---

## Screens / Views

### Vista de delegado — mobile (390 × 800)
Patrón general: header oscuro (`ink`) con status bar simulada (chrome de maqueta — no reproducir, usar la del dispositivo/navegador real), contenido sobre `bg-screen`, CTA y resumen de selección casi siempre fijos al fondo de la pantalla.

#### 1. Sesiones — home / punto de entrada (ref. 3h · pantalla 27)
- Header: identidad del delegado (avatar+comité) + botón "Salir", título "Sesiones" en serif, barra de progreso segmentada + eyebrow "N DE 5 CERRADAS" (recalcular según sesiones reales).
- Tarjeta destacada de la sesión abierta actual (fondo `ink`): eyebrow "SESIÓN N" + badge "ABIERTA", título de sesión serif, fecha/hora, fila de resolución activa con estado ("POR VOTAR"), CTA dorado "Votar ahora →".
- Lista debajo: sesiones cerradas pasadas (estado completa = check verde, o incompleta = `!` ámbar, ambas con chevron y tap-ables) y sesiones futuras bloqueadas (ícono numerado gris, fondo `disabled-bg`, borde dashed, sin chevron, no interactivas).
- Callout fijo al final: aviso de que el voto entre pares se habilita al cerrar la última sesión.
- 0 sesiones cerradas → no se muestra lista de "cerradas" debajo de la destacada. Ninguna sesión abierta (ventana entre sesiones) → usar el patrón de la pantalla 6 (cuenta regresiva) dentro de la posición de la tarjeta destacada, no como pantalla completa — no hay mock explícito de este caso.

#### 2. Boleta de resolución (ref. 3b · pantalla 20)
- Header con badge "EN VIVO · mm:ss" (countdown en vivo de la sesión).
- Tarjeta de resolución: eyebrow "PROYECTO DE RESOLUCIÓN · {id}", título serif (puede partirse a 2 líneas, permitir wrap), metadatos (patrocinadores, tipo de mayoría), enlace "Leer texto completo →" (pantalla de destino no diseñada en este apartado).
- 3 opciones de voto exclusivas, CTA "Revisar voto" al fondo.
- Si el timer llega a 0 con una opción seleccionada sin confirmar, el comportamiento no está definido en el mock (¿auto-envía? ¿descarta y manda a la pantalla 7 "cerrada"?) — **debe confirmarse con producto antes de implementar**.

#### 3. Confirmar voto (ref. 3c · pantalla 21) — bottom sheet compartido
Ver componente "Bottom sheet de confirmación" arriba. Se invoca desde la boleta de resolución (2) y desde la de pares (5). Tap fuera del sheet / swipe-down debería comportarse igual que "Volver y cambiar" (estándar de bottom sheet, no explícito en el mock). Sin estado de loading/error al enviar — debe diseñarse/especificarse (spinner en botón + reintento en caso de fallo de red).

#### 4. Voto enviado (ref. 3d · pantalla 22)
- Check circular de 72 px, titular serif "Voto registrado", subtítulo de 1–2 líneas, tarjeta de comprobante (ver componente arriba).
- Sección "PENDIENTE" con la siguiente votación esperada y badge "EN ESPERA" — si no hay ninguna pendiente, este bloque se oculta (no hay mock de ese caso).
- CTA secundario "Volver a sesiones".

#### 5. Boleta — Mejor delegación / voto entre pares (ref. 3a · pantalla 19)
- Header: eyebrow "VOTO 1 DE 2", titular, disclaimer de peso/anonimato, badge countdown "Cierra HH:MM".
- Buscador + lista de países (ver componente "Fila de país"), orden alfabético, propia delegación bloqueada en su posición natural.
- Footer fijo: "Seleccionado: **{país}**" (se actualiza en vivo) + CTA "Revisar voto" (deshabilitado hasta seleccionar — estado a confirmar).
- Lista larga (20+ países) con scroll implícito — confirmar si requiere virtualización. Búsqueda sin resultados no tiene estado diseñado.

#### 6. Votación aún no abre — cuenta regresiva (ref. 3e · pantalla 23)
- Pantalla completa oscura (no modal). Mensaje central + 3 bloques de countdown (HH/MIN/SEG) + rango de apertura/cierre.
- "Esta pantalla se actualiza sola" → requiere timer en vivo que transicione automáticamente al llegar a 0, sin refresh manual. Si la sesión que faltaba cerrar se extiende, el countdown no puede mostrar tiempo negativo — falta definir mensaje de fallback (no está en el mock).

#### 7. Votación cerrada — sin voto registrado (ref. 3f · pantalla 24)
- Badge "CERRADA · HH:MM", mensaje central, callout dashed de soporte técnico, CTA outline "Ver resultados públicos".
- Aparece únicamente cuando el delegado **no** votó antes del cierre. Debe ser inalcanzable si existe un voto registrado para esa boleta (guardia de cliente: con voto existente, ir a un resumen — no mockeado — nunca a este estado).

### Vista de delegado — desktop (ancho de referencia 1180)
Top bar `ink` con logo + breadcrumb ("SD MUN 2026 / Votación"), badge de countdown e identidad a la derecha.

#### 1w. Boleta entre pares — escritorio (ref. 3g · pantalla 25)
- Grid de 2 columnas: contenido principal `1fr` (buscador + grid de países a 3 columnas) + panel lateral fijo de `340px` ("Tus votos"), gap 32, padding de pantalla 48.
- Grid de países más compacto que en mobile (radio 18 px). Con 23 opciones se muestra un subconjunto y un enlace "Mostrar las 23 ▾" (expandir/colapsar, no paginación).
- Panel "Tus votos": pasos numerados (activo = círculo oscuro con borde; pendiente = círculo gris claro), disclaimer de anonimato/peso/autovoto, CTA "Revisar voto" dentro del panel (no fijo a la ventana, a diferencia de mobile).
- **Único screen de este apartado con variante desktop.** El resto (home, boleta de resolución, confirmar, enviado, countdown, cerrada) solo tiene mock mobile — si el producto necesita votar desde escritorio en esos flujos, falta diseño.

---

## Interactions & Behavior

### Flujo de navegación
Todo parte de la pantalla "Sesiones" (1): sesión con resolución abierta → Boleta de resolución (2) → Confirmar (3) → Enviado (4) → regresa a Sesiones. Sesión futura, aún cerrada → Cuenta regresiva (6). Sesión cerrada ya pasada → resumen de los votos del delegado, solo lectura (**sin mock en este apartado**). Al cerrar la última sesión del comité se habilita la Boleta entre pares (5), que reusa el mismo Confirmar/Enviado (3/4); si no se vota a tiempo → Votación cerrada (7). El peso del 10% del voto entre pares se configura en la pantalla de Criterios (apartado 1 del canvas) — este flujo solo lo muestra, no lo edita. Acceso por QR + código: **pendiente de diseñar**, señalado explícitamente por el autor del mock.

### Búsqueda
Buscador de países en las boletas con lista (mobile y desktop): filtrado en cliente, en vivo. Recomendado substring case-insensitive (no especificado explícitamente en el mock) — definir estado de "sin resultados" antes de construir.

### Estados y validación
- CTA principal debería quedar deshabilitado hasta que haya una selección (resolución o país) — el mock no muestra el estado disabled, inferencia razonable a confirmar con diseño.
- Envío de voto (Confirmar → Enviado): sin estado de loading/error en el mock. En producción debe manejar conexión lenta/fallo de red con estado visible (spinner en el botón, reintento, mensaje de error) — nunca debe parecer "enviado" si la escritura al backend falló.
- Guardia de estado: un delegado con voto ya registrado para una boleta nunca debe poder llegar a la pantalla "Votación cerrada sin voto" (7) para esa misma boleta.

### Animaciones
Solo micro-interacciones: el punto pulsante de estados "en vivo" (`mun-pulse`, 1.8 s infinito, ver componente arriba) y transiciones estándar de hover/press en botones (no especificadas en el mock — usar 120–150 ms en `background`/`border-color`, consistente con el resto del design system del canvas). Sin animaciones decorativas.

### Responsive
Mobile-first para este apartado: el diseño móvil (390 px) es la referencia principal; solo la boleta entre pares tiene variante de escritorio (1180 px, layout de 2 columnas con panel lateral). Para el resto de las pantallas en breakpoints de escritorio o tablet (768–1024 px, sin mock), una opción razonable es centrar el contenido mobile en una columna de ancho fijo (~420–480 px) en vez de estirarlo — a confirmar con diseño antes de generalizar.

---

## State Management

Estado de UI sugerido (el prototipo no hace red; en producción, datos de servidor vía React Query/SWR o similar + estado local para la boleta en curso):

- `delegate`: id, país/delegación, comité, token de sesión.
- `sessions[]`: id, nombre, horario, estado (`abierta` | `cerrada-completa` | `cerrada-incompleta` | `futura`), resoluciones asociadas.
- `activeBallot`: tipo (`resolution` | `peer`), opciones disponibles, selección actual, deadline.
- `countries[]` (solo para boleta entre pares): id, nombre, código, flag de "es mi propia delegación".
- `voteSubmission`: `idle | selecting | confirming | submitting | submitted | error`, id de comprobante, timestamp.
- Búsqueda: `query` sobre la lista de países.
- Countdown: timestamp de apertura/cierre, derivado a HH:MM:SS en el cliente con recálculo en vivo (no solo al montar).

## Assets
Sin librería de iconos ni imágenes: los glifos son caracteres de texto (`✓`, `!`, `›`, `→`, `▾`). Chips de país: bloque de color con el código de 2 letras en mono — al implementar, sustituir por banderas reales o mantener el patrón de chip tipográfico si no hay set de banderas disponible. Fuentes: Google Fonts — Source Serif 4 (400/600/700) e IBM Plex Sans (400/500/600/700) + IBM Plex Mono (500/600).

## Files
- `Votacion Delegados.dc.html` — prototipo del Apartado 3 completo: las 8 pantallas (3h, 3a–3g) con la nota de flujo al final. **Referencia principal.** Ábrelo en navegador.
- `Votacion Delegados-print.dc.html` — copia paginada del mismo diseño para exportar a PDF (3 hojas horizontales: flujo de resolución, voto entre pares + estados, escritorio). Solo documentación.
- `support.js`, `doc-page.js` — runtime del entorno de prototipado. **No portar.**

Para leer el prototipo: el markup está entre `<x-dc>` y `</x-dc>` con estilos inline; cada pantalla es un `<div class="dv-card">` con su `data-screen-label` (19–27). Las clases `dv-turn`, `dv-opt`, `dv-olabel`, `dv-oid` son solo la presentación del canvas (etiquetas 3a, 3b…), no forman parte de la UI a construir.

Alcance: este bundle cubre solo el **Apartado 3** del canvas `MUN Scoring Interface Design`. Fuera de alcance: Apartado 1 (sistema de diseño, juez, admin — incluye Criterios, donde se configura el 10% de pares), Apartado 2 (portal público de resultados, con su propio handoff) y Apartado 4 (modal admin "Nuevo evento").
