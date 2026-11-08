# Handoff: Gestión de staff — MUN Scoring · MUNYCH

## Overview
Nueva sección **Staff** del panel admin de MUN Scoring. Va en el sidebar entre Jueces y Criterios. Sirve para administrar a la gente que no es juez pero sí evalúa y premia:

- **Tipos de staff**: Prensa, Escritura, Pajes y protocolo, Crisis, Fotografía… Cada tipo define **a quién evalúa**, su **alcance** (qué comités) y cuántos **evaluadores mínimos** necesita cada candidato.
- **Miembros**: quiénes son de cada staff, con su rol (coordinador o evaluador), los comités que tienen asignados, cuánto llevan evaluado y el estado de su acceso.
- **Rúbrica propia**: los criterios y pesos de cada tipo, que deben sumar 100 %.
- **Premios propios**: cada staff entrega los suyos. Por ejemplo, Prensa entrega *Mejor periodista* y Escritura entrega *Mejor escrito de defensa*. La rúbrica genera un ranking de candidatos que **sugiere** ganadores; el admin confirma cada premio.
- **Nota staff (opcional)**: un tipo de staff puede, además, contar en el peso **Staff** del ranking general (MUN regular: 10 %). Por defecto está apagado: el staff solo decide sus premios.

Solo rol **admin**, en desktop. La vista con la que el miembro del staff evalúa desde su teléfono **no está en este bundle**. Es el siguiente paso, y debería reutilizar la tarjeta de criterio con slider de la vista de juez.

Stack objetivo: **React + Vite**, el mismo de MUN Scoring.

## About the Design Files
`Gestion Staff.dc.html` es un canvas de referencia con 6 pantallas, hecho con el runtime de prototipado (`support.js`, `<x-dc>`). El runtime **no se porta**. El markup usa estilos inline y unas pocas clases en `<helmet>` (`.row`, `.bd`, `.panel`…). Al reimplementar, pasa los valores a los tokens de MUN Scoring que ya existen y reutiliza sus componentes: Button, StatusBadge, ProgressBar, Card, Table en grid y Checkbox/Toggle.

## Fidelity
**High-fidelity.** Usa los mismos tokens, tipografía y patrones del panel admin de MUNYCH Scoring: sidebar navy de 232 px, cabecera blanca, tablas en CSS grid y panel lateral derecho. Los datos son de muestra.

---

## Design Tokens
Son los de MUN Scoring, sin cambios: `navy #0B2A4A`, `navy-light #123B63`, `un-blue #418FDE`, `gold #C9A227`, `ink #1B2733`, `muted #5B6B7C`, `border #E3E8EF`, `border-soft #EEF1F5`, `border-input #CBD5E1`, `bg #F5F7FA`, `row-selected #F5F9FF` y `chip-neutral-bg #F2F4F8`. Los estados (sin calificar, en progreso y completo) y las medallas también son los mismos.

### Tokens nuevos
| Token | Valor | Uso |
| --- | --- | --- |
| Error (punto / fondo / texto) | `#C2413B` / `#FBECEB` / `#A1322D` | Rúbrica que no suma 100 %, candidato con evaluaciones insuficientes. MUN Scoring no tenía estado de error definido. |
| Info (punto / fondo / texto) | `#418FDE` / `#EAF3FC` / `#2F6BA8` (borde `#CFE3F7`) | Callouts informativos: normalización de la escala, premios especiales en el acta |
| Color por tipo de staff | Escala de pesos de MUN Scoring: Prensa `#418FDE`, Escritura `#2F6BA8`, Pajes `#C9A227`, Crisis `#123B63`, sin configurar `#98A6B5` | Fondo del **tag** del tipo (cuadro redondeado con las 2 iniciales) |
| Badge "NUEVO" en el nav | Fondo `gold`, texto `navy`, 8.5 px / 700 | Marca la sección nueva durante el lanzamiento |

### Tipografía
Playfair Display para títulos, nombres de tipo de staff, nombres de candidatos, notas y cifras. Inter para el resto. Sin cambios de escala.

---

## Componentes reutilizables

### StaffTypeTag
Cuadro de 34 px (42 px en la cabecera del tipo) con radio de 9, el color del tipo de fondo y las 2 iniciales en blanco a 11–12 px / 700. Aparece en la lista, en la cabecera del detalle y en los estados vacíos.

### StatusBadge (variantes nuevas)
Además de las de MUN Scoring:

- `VÁLIDA` / `VÁLIDO` (completo): rúbrica correcta.
- `SUMA 85 %` / `FALTAN 15 %` (error): rúbrica incompleta.
- `ASIGNADO` (completo), `1 DE 2` (progreso): estado de un premio.
- `ACTIVO`, `INVITADO`, `SIN INVITAR`: estado del acceso de un miembro.
- `SIN CONFIGURAR`: tipo de staff sin miembros ni rúbrica.
- `FALTAN EVALUACIONES`, `SIN EVALUAR`: estado de un candidato.

### RoleChip
Coordinador: fondo `navy`, texto blanco. Evaluador: fondo `#F2F4F8`, texto `navy`. Ambos a 11 px / 600, radio de 5. Va pegado al nombre del miembro.

### AwardChip
Píldora con fondo `#F2F4F8` y borde `border`, 11 px / 600 `navy`. Hay dos variantes de premio asignado: dorada para el primer premio y verde para las menciones, ambas con "✓".

### Segmented control
Pista `#F2F4F8` con radio de 8 y padding de 3. La opción activa va en blanco, con texto `navy` / 600 y sombra `0 1px 2px rgba(11,42,74,.12)`. Se usa para Coordinador/Evaluador y para Todos los comités / Elegir comités.

### OptionCard (radio grande)
Tarjeta con radio de 10 y padding de `12px 13px`. Lleva un círculo de radio de 16 px, el título a 13 px / 600 y una descripción a 11.5 px `muted`. Seleccionada: borde 1.5 px `navy`, fondo `#F5F9FF` y el círculo con borde de 5 px `navy`.

### Stepper (asistente)
Círculos de 22 px:

- Completado: verde `#2F8F6E` con ✓.
- Actual: `navy`.
- Pendiente: `#F2F4F8`.

La etiqueta va a 12 px.

---

## Screens / Views (desktop, 1340 px)

#### 01. Tipos de staff
- Cabecera: "Staff" + "MUNYCH 2026 · 5 tipos de staff · 30 miembros". A la derecha, el buscador de 230 px y el botón `+ Nuevo tipo de staff`.
- 4 KPIs:
  - TIPOS DE STAFF 5 ("4 configurados · 1 pendiente").
  - MIEMBROS 30.
  - PREMIOS PROPIOS 7 ("3 asignados · 4 por decidir").
  - AVANCE DE EVALUACIÓN 68 %, en tarjeta invertida navy con la cifra en dorado.
- Tabla con columnas `2.7fr 1.15fr 1.3fr 1fr 1.6fr .95fr 1.35fr 96px`:
  - TIPO DE STAFF: tag + nombre en Playfair 16 + descripción a 11.5 px.
  - EVALÚA.
  - MIEMBROS: hasta 4 avatares de 26 px superpuestos + "6 miembros".
  - RÚBRICA: "5 criterios" + badge.
  - PREMIOS PROPIOS: chips.
  - NOTA STAFF: "Solo premios" en `muted`, o "Cuenta 10 % en nota staff" en verde.
  - AVANCE: barra + % + "34 de 48 evaluaciones".
  - ESTADO: badge + "Abrir ›".
- Al pie, una nota con borde punteado que explica cómo funciona.

#### 02. Prensa — Miembros
- Cabecera del tipo (compartida por 02–04):
  - Tag de 42 px.
  - "Prensa" en Playfair 25 + badge de estado.
  - "Evalúa a **delegados de prensa** · solo premios, no cuenta en la nota staff".
  - A la derecha: MIEMBROS 6 · CANDIDATOS 16 · AVANCE 71 % con barra.
  - Debajo, pestañas: Miembros 6 · Rúbrica 5 criterios · Premios 2 · Configuración. La activa lleva subrayado de 2 px `navy`.
- Tabla con columnas `2.6fr 1.2fr 1.1fr 1fr 48px`:
  - MIEMBRO · ROL: avatar + nombre + RoleChip + correo.
  - ASIGNADO A: siglas de comités, o "Sin asignar" en `faint`.
  - EVALUADOS: barra de 70 px + "12/16".
  - ACCESO: badge.
  - "Editar".
- Debajo de la tabla, una tarjeta punteada "+ Añadir otra persona": busca entre jueces y staff del evento, o invita por correo.
- **Panel derecho de 360 px, "Editar miembro"**:
  - Identidad del miembro. Indica si también está en otro staff ("también en Fotografía"): una persona puede estar en varios.
  - Segmented Coordinador/Evaluador.
  - Lista "Asignar a comités" con filas seleccionables: la primera es "Todos los comités" y después cada comité con sus siglas.
  - Callout dorado sobre la cobertura mínima de evaluadores.
  - CTA `Guardar y enviar invitación` y nota: "Recibirá un enlace personal para evaluar solo a los candidatos de Prensa".

#### 03. Prensa — Rúbrica
- Tarjeta de alcance en 4 celdas: EVALÚA A · ALCANCE · EVALUADORES ("Mín. 2 · escala 0–10") · NOTA STAFF. A la derecha, "Editar", que abre la configuración del tipo.
- Tabla con columnas `24px 1.5fr 2.5fr 112px 44px`:
  - Handle "⠿" para reordenar.
  - CRITERIO: cuadro de color de la escala + nombre a 14 / 600.
  - DESCRIPCIÓN PARA EL EVALUADOR: 12 px `muted`.
  - PESO: mini barra + valor en Playfair 17.
  - "Editar".
- Fila de suma (`#F5F9FF`): "Suma total de pesos" + `VÁLIDO` + "100%" en Playfair 26.
- Panel "Editar criterio":
  - Nombre.
  - Descripción (textarea).
  - Escala (0–10 / 0–100) y Paso.
  - Slider de peso de 0 a 50 % (el slider de MUN Scoring).
  - Tarjeta "Reparto actual": barra apilada de 10 px + leyenda + "5 criterios · suma 100% · sin sobrantes".
  - Callout informativo sobre la normalización a 0–100.
  - Botones Cancelar y Guardar.

#### 04. Prensa — Premios
- Dos tarjetas de premio: "PREMIO" + nombre en Playfair 19 + badge de estado. Cada una muestra Ganadores, Ámbito (todo el evento o por comité), Selección y Desempate (un criterio de la rúbrica). Debajo, el enlace "+ Añadir premio".
- "Ranking de candidatos · Delegados de prensa", con columnas `50px 2.2fr 1fr 80px 1.5fr`:
  - POS.: medalla de 30 px.
  - CANDIDATO: nombre en Playfair 16 + "medio · comités cubiertos".
  - EVALUACIONES: "3 de 2 mín.", en rojo si no llega al mínimo.
  - NOTA: Playfair 20, normalizada a 0–100.
  - PREMIO: AwardChip asignado, "Asignar mención ›", o badge de faltante.
  - La fila del 1.º lugar lleva fondo `#FDFBF3`.
- Panel "Premios de Prensa":
  - Una fila por ganador a entregar: con check si ya está asignado, o punteada con "Sugerido: …" + "Asignar" si falta.
  - Callout "la nota solo sugiere".
  - Callout informativo: los premios de staff salen en el acta como **Premios especiales**.
  - CTA `Confirmar premios de Prensa`, deshabilitado hasta asignar todos ("Falta asignar 1 mención").

#### 05. Nuevo tipo de staff (asistente en modal)
- Modal de 720 px sobre la lista, con scrim `rgba(11,42,74,.42)` y sombra de modal.
- Cabecera: eyebrow + nombre del tipo (ejemplo: "Oratoria") + stepper de 4 pasos: Datos ✓ · **Evaluación y premios** · Rúbrica · Miembros.
- Paso 2:
  - **"¿Qué evalúa este staff?"**: 4 OptionCards. Delegaciones (una nota por país o personaje) · Delegados individuales (por persona; en dobles, por separado) · Escritos de posición (un documento por delegación) · Delegados de prensa (solo participantes inscritos como prensa).
  - **Alcance**: segmented Todos los comités / Elegir comités.
  - **Evaluadores mínimos por candidato**: stepper − 2 +.
  - **Premios que otorga**: filas editables con nombre, ganadores y ámbito (Por comité / Todo el evento) + "✕". Debajo, "+ Añadir premio" y la nota "Por comité entrega 1 ganador en cada comité del alcance (8 premios en MUNYCH 2026)".
  - **Cuenta para la nota staff del ranking**: toggle, apagado por defecto, con su explicación.
  - **Empezar la rúbrica desde**: select de plantillas (Prensa, Escritos de posición, Oratoria, Protocolo, En blanco).
- Pie: "‹ Datos", Cancelar y `Siguiente: rúbrica ›`.

#### 06. Estados
- **A · Staff sin miembros** (Fotografía): tarjeta punteada "Este staff todavía no tiene miembros" + `+ Añadir miembro`. En la lista aparece como SIN CONFIGURAR y no cuenta para el avance global.
- **B · Rúbrica que no suma 100 %** (Crisis, 85 %): la fila de suma pasa a error ("FALTAN 15 %", cifra en rojo). Guardar queda deshabilitado y la evaluación no se abre a los miembros.
- **C · Candidato con evaluaciones insuficientes**: la nota se ve en gris con "1 de 2 evaluaciones mínimas" en rojo. No recibe sugerencia de premio. Acciones: "Recordar a evaluadores" y "Asignar evaluador".

---

## Interactions & Behavior

### Cálculo
- Cada evaluador califica cada criterio en la escala del tipo (0–10 con paso 0.5 en la muestra).
- Nota del candidato para ese staff = Σ (valor normalizado a 0–100 × peso / 100), promediada entre sus evaluadores.
- Solo entran al **ranking sugerido** los candidatos con evaluaciones ≥ mínimo.
- Desempate: el criterio que se elige en cada premio. Si sigue el empate, decide el admin.

### Premios propios
- **El ranking solo sugiere.** El admin asigna cada premio y puede elegir a otro candidato. Si elige a uno que no es el sugerido, conviene pedir confirmación y guardar quién lo asignó.
- Ámbito **Por comité**: genera un premio por comité del alcance, cada uno con su propio ranking (filtro por comité dentro de la pestaña Premios).
- `Confirmar premios` congela los premios del staff. Después aparecen en el acta y en la página pública.

### Nota staff
Si un tipo tiene "Cuenta para la nota staff" encendido, el promedio de sus evaluaciones entra en el rol **Staff** del tipo de evento. Si hay varios tipos encendidos, se promedian entre sí, o se reparte el peso: hay que decidir cuál, ver Preguntas abiertas.

### Miembros y acceso
- Una persona puede pertenecer a varios tipos de staff, y también ser juez. Su enlace de evaluación le muestra solo las rúbricas y candidatos de sus asignaciones.
- Estados de acceso: Sin invitar → Invitado (correo enviado) → Activo (primer ingreso).
- Quitar a un miembro **no borra** sus evaluaciones. Se marcan como de un exmiembro, y el admin decide si cuentan.

### Rúbrica
- Validaciones: suma = 100 %, al menos 1 criterio y pesos de 0 a 50 % por criterio. Si no se cumplen, no se puede guardar y la evaluación queda cerrada para los miembros.
- Cambiar pesos con evaluaciones ya hechas **recalcula** las notas sin borrar lo capturado. Cambiar la escala con evaluaciones existentes debería bloquearse o pedir confirmación.
- El orden de los criterios se cambia arrastrando el handle "⠿". Es el orden en que los ve el evaluador.

### Integración con lo que ya existe
- **Acta de resultados (PDF)**: agregar la sección **Premios especiales** después del resumen de premiación. Va una fila por premio de staff, con las columnas Staff · Premio · Pos. · Delegación/Candidato · Delegados · Institución · Nota. El contrato `awards_summary` necesita `source: "staff"` y `staff_type`.
- **Página pública de resultados**: los premios de staff se muestran aparte de los premios de comité.
- **Nombres de premios**: igual que en el acta, se manejan por clave. Cada tipo de staff define los suyos.

### Animaciones
Las mismas micro-interacciones de MUN Scoring: hover de 120–150 ms y transición de ancho de barras de ~200 ms. El modal entra con fade + 8 px de desplazamiento en 160 ms.

### Responsive
Desktop-first, igual que el resto del admin. Por debajo de ~1100 px, el panel lateral pasa a modal de pantalla completa y las tablas a lista de tarjetas.

### Preguntas abiertas
1. Si varios tipos cuentan para la nota staff, ¿se promedian entre sí o cada uno tiene su propio peso?
2. ¿Un miembro del staff puede evaluar a un candidato de su misma institución? (posible conflicto de interés)
3. ¿Los participantes de prensa se registran como delegaciones especiales o como un tipo de participante aparte?

---

## State Management

- `staffTypes[]`: `id`, `name`, `code`, `color`, `description`, `evaluates` (`delegations` | `delegates` | `position_papers` | `press`), `scope` (`all` | `committeeIds[]`), `minEvaluators`, `countsTowardStaffScore` (bool), `status` (derivado).
- `staffMembers[]`: `id`, `personId`, `staffTypeId`, `role` (`coordinator` | `evaluator`), `committeeIds[]` (vacío = todos), `access` (`not_invited` | `invited` | `active`).
- `staffRubrics[staffTypeId]`: `scale` `{ min, max, step }`, `criteria[]` `{ id, name, description, weight, order }`.
- `staffEvaluations`: por (memberId, candidateId) → `{ values: Record<criterionId, number>, updatedAt }`. Usa el mismo autoguardado con debounce del formulario de juez.
- `staffAwards[]`: `id`, `staffTypeId`, `name`, `winners`, `scope` (`event` | `per_committee`), `tieBreakerCriterionId`, `assignments[]` `{ candidateId, committeeId?, position, assignedBy, overrideReason? }`, `confirmedAt`.
- Derivados (servidor): ranking por tipo y por comité, avance por miembro y por tipo, sugerencias de premio.

Endpoints sugeridos: `GET/POST/PATCH /staff-types`, `GET/POST/PATCH/DELETE /staff-types/:id/members`, `POST /staff-types/:id/members/:mid/invite`, `GET/PUT /staff-types/:id/rubric`, `GET /staff-types/:id/ranking?committee=`, `GET/POST/PATCH /staff-types/:id/awards`, `POST /staff-types/:id/awards/confirm`.

## Assets
No hay imágenes. El logotipo es la "M" de MUNYCH y los glifos son texto (`✓`, `✕`, `⠿`, `›`, `▾`). Al implementar, usar Lucide para los iconos, igual que en el resto de MUN Scoring. Fuentes: Playfair Display + Inter.

## Files
- `Gestion Staff.dc.html`: canvas con las 6 pantallas (01–06). **Referencia principal.**
- `Gestion Staff-print.dc.html`: copia paginada para exportar a PDF (6 hojas horizontales). Solo documentación.
- `muestras/gestion-staff.pdf`: el PDF de esa copia.
- `support.js`, `doc-page.js`: runtime del prototipo. **No portar.**
