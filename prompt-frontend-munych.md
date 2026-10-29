---
proyecto: "[[sistema-calificaciones-munych]]"
tipo: prompt para Claude Code
alcance: frontend existente — conectar datos (sin cambios de diseño) + página pública
version: 2.0
fecha: 2026-09-27
basado_en: "propuesta técnica v0.4 · requerimientos v0.3 · prompt-backend-munych v1.0"
---

# Prompt para Claude Code — Conectar el frontend existente y añadir la página pública (MUNYCH)

> **Cómo usar este archivo**: cópialo al repositorio del frontend (por ejemplo, como `docs/prompts/frontend.md`) y en Claude Code escribe:
> *"Lee `docs/prompts/frontend.md` y ejecuta la tarea. Empieza en modo plan."*

---

## 0. Tu tarea, en una frase

Ya existe un frontend con su diseño terminado. Tu trabajo es **cambiar los datos, no el diseño**:
1. **Conecta** las pantallas existentes a los datos reales (API del backend + Supabase Auth), sustituyendo datos simulados, codificados o de ejemplo, según el contrato de la sección 6.
2. **Añade la página pública de resultados**, construida **exclusivamente con el diseño, los componentes y los estilos que ya existen**.

---

## 1. Regla de oro: el diseño NO se toca

**Prohibido** (salvo aprobación explícita):
- Modificar estilos: CSS, SCSS, módulos CSS, clases de Tailwind existentes, `tailwind.config`, temas, tokens, variables de color, tipografías, iconos, imágenes o animaciones.
- Cambiar la maquetación: estructura visual, espaciados, tamaños, orden de los elementos en pantalla, *breakpoints*.
- Rediseñar, "mejorar" o reorganizar componentes visuales; renombrarlos o moverlos de carpeta.
- Añadir librerías de UI, de componentes o de estilos nuevas.
- Cambiar textos de marca, slogans o logos.

**Permitido**:
- Cambiar **de dónde vienen los datos**: props, hooks, llamadas a la API, estado, adaptadores.
- Cambiar **textos de datos** (etiquetas de campos, columnas, opciones de selectores) para que correspondan con el modelo real, usando los mismos componentes.
- Añadir **campos** a formularios o **columnas** a tablas que el contrato exige, **reutilizando** los componentes de entrada y tabla existentes, con las mismas clases y variantes.
- Añadir estados de carga, vacío y error **solo con componentes que ya existan** en el proyecto. Si no existe ninguno, usa el patrón visual más parecido que haya y pregúntalo en el plan.
- Añadir la lógica que falte (validaciones, llamadas, manejo de errores) sin cambios visuales.

Si para cumplir un requisito **fuera imprescindible** un cambio visual (por ejemplo, falta una pantalla entera), **hazla** e inclúyelo en el plan como "Decisión  pertinente de diseño"

**Verificación**: antes de empezar, toma **capturas de referencia** (Playwright o similar) de las pantallas principales con datos de ejemplo. Al final, repite las capturas y compáralas: las únicas diferencias admitidas son los datos mostrados.

---

## 2. Cómo debes trabajar

1. **Modo plan primero.** No modifiques archivos hasta que el plan esté aprobado.
2. **Inventario del frontend existente** (entrégalo en el plan):
   - Stack real: framework, enrutado, gestión de estado, cliente HTTP, formularios, estilos, pruebas.
   - Mapa de pantallas y rutas existentes.
   - **Origen actual de los datos** de cada pantalla: mocks, JSON, constantes, API antigua, localStorage…
   - Componentes reutilizables disponibles (tablas, formularios, diálogos, tarjetas, estados de carga).
3. **Análisis de brechas**: una tabla que cruce cada funcionalidad de la sección 4 con la pantalla existente que la cubre, marcando:
   - ✅ Existe: solo conectar datos.
   - 🟡 Existe parcialmente: faltan campos o acciones, que se añaden con componentes existentes.
   - ❌ No existe: requiere decisión de diseño.
4. **Mantén el stack existente.** Solo añade las dependencias **de datos** imprescindibles: `@supabase/supabase-js` y, si encaja con el proyecto, Orval para generar el cliente. Si el proyecto ya tiene un patrón de cliente HTTP o de gestión de datos (TanStack Query, SWR, Redux Toolkit Query, servicios propios…), **úsalo** en lugar de introducir otro.
5. Implementa por hitos (sección 11). Al terminar cada uno: lint, comprobación de tipos, pruebas y commit con *conventional commits* (`feat(data): conectar comités a la API`).
6. **No inventes requisitos.** Ante dudas, usa los valores por defecto de la sección 10 y deja `// TODO(cliente): <pregunta>`.
7. Actualiza (o crea) el `CLAUDE.md` del repo con los comandos y con la regla "no modificar el diseño" de la sección 1.

---

## 3. Contexto del producto

- **Cliente**: **MUNYCH Association**, organización mexicana que organiza Modelos de Naciones Unidas (MUN) bajo la marca **GRAND International** (eventos en México, Santo Domingo, Nueva York…).
- **Sistema de calificaciones con tres superficies**:
  - **Administración**: configura eventos, comités, delegaciones, rúbricas, jueces y sesiones; ve rankings, asigna premios, exporta y publica.
  - **Jueces**: califican a los delegados de sus comités por criterio y por sesión, desde tablet o móvil.
  - **Página pública**: muestra los premios publicados de cada evento. Es **nueva**.
- **Participan menores de edad**: la página pública muestra **solo** lo que el backend publica, que ya viene anonimizado.

**Glosario**:

| Término | Significado |
|---|---|
| Evento | Conferencia de 1–3 días con varios comités |
| Comité | Órgano simulado: Asamblea General, Consejo de Seguridad, crisis, especializado |
| Delegación | País (o personaje, en crisis) dentro de un comité |
| Delegado | Estudiante de una delegación. Una delegación doble tiene 2 delegados |
| Sesión | Bloque de trabajo del comité; se califica por sesión |
| Rúbrica | Criterios con peso (suman 100) y escala (1–4 por defecto) con descriptores por nivel |

---

## 4. Funcionalidades que deben quedar conectadas

### 4.1 Autenticación (Supabase Auth)
- Administradores: correo + contraseña. Jueces: **enlace mágico**.
- Usa `supabase-js` con la clave `anon` **solo para autenticación** (iniciar sesión, cerrar sesión, refrescar token). **Nunca** leas ni escribas tablas con supabase-js desde el panel: todo pasa por la API.
- El rol viene en el claim `app_role` del JWT o en `GET /me`. Redirige a administración o a jueces según el rol.
- Todas las llamadas a la API llevan `Authorization: Bearer <access_token>`. Ante un 401: refrescar una vez y, si falla, ir al inicio de sesión.
- Conecta la pantalla de inicio de sesión **existente** a estos flujos. Si solo tiene contraseña, el enlace mágico para jueces es un 🟡: añádelo con los componentes existentes (un campo de correo y un botón).

### 4.2 Administración

| Funcionalidad | Endpoints | Datos y comportamiento |
|---|---|---|
| Panel general / avance | `GET /events`, `GET /committees/{id}/progress` | *Polling* cada 15 s mientras la pestaña esté visible |
| Eventos | `/events` (CRUD), `POST /events/{id}/logo` | Campos: nombre, slug, marca (`munych` \| `grand_international`), logo, sede, país (ISO), zona horaria (IANA), fechas, estado |
| Comités | `/events/{id}/committees`, `/committees/{id}` | Tipo, simple o doble, n.º de sesiones, rúbrica propia opcional |
| Delegaciones y delegados | `/committees/{id}/delegations`, `/delegations/{id}`, `/delegates/{id}` | País **o** personaje, institución, 1–2 delegados |
| Importación CSV | `POST /committees/{id}/delegations/import` | Mostrar `{ created, skipped, errors[] }` con fila y mensaje; ofrecer la plantilla CSV (6.4) |
| Jueces | `/judges`, `PATCH /judges/{id}` | Invitar (`email`, `full_name`), activar o desactivar |
| Asignaciones | `GET/PUT /committees/{id}/judges` | `[{ judge_id, role: chair \| moderator \| judge }]` |
| Rúbricas | `/events/{id}/rubrics`, `GET/PUT /rubrics/{id}` | La suma de pesos debe ser 100: validar en el cliente y mostrar `WEIGHTS_MUST_SUM_100` |
| Sesiones | `/committees/{id}/sessions`, `.../{n}/open`, `.../{n}/close` | Confirmación antes de cerrar |
| Ranking y premios | `GET /committees/{id}/ranking`, `GET/PUT /committees/{id}/awards` | Resaltar `tied` y mostrar `quota_warnings` con los componentes de aviso existentes |
| Exportación | `GET /events/{id}/export.xlsx` | Descarga con el token (fetch + blob) |
| Cierre del evento | `POST /events/{id}/close` | Confirmación fuerte; errores `SESSIONS_STILL_OPEN` |
| Publicación | `GET/PUT /events/{id}/publication-settings`, `GET .../publication/preview`, `POST .../publish`, `POST .../unpublish` | Vista previa con los **mismos componentes** que la página pública; mostrar `revalidated: false` si ocurre |

### 4.3 Jueces

| Funcionalidad | Endpoints | Comportamiento |
|---|---|---|
| Mis comités | `GET /judge/committees` | Solo comités asignados |
| Delegaciones del comité | `GET /judge/committees/{id}`, `GET /judge/sessions/{id}/scores` | Estado por delegado en la sesión elegida: pendiente o completo (todos los criterios calificados) |
| Calificar | `POST /judge/scores/batch` | Un valor por criterio en la escala de la rúbrica, con el descriptor del nivel y un comentario opcional; "guardar y siguiente pendiente" si la pantalla lo permite |
| Mi resumen | `GET /judge/sessions/{id}/scores` | Solo sus notas |

**Reglas de guardado** (lógica, sin cambios visuales):
- Genera en el cliente un `client_id` (UUID v4) y un `client_updated_at` por criterio calificado.
- Envía **lotes** a `POST /judge/scores/batch` con actualización optimista.
- Muestra los `rejected` por criterio con mensaje en español.
- Ante fallos de red, reintenta con espera exponencial **sin perder lo escrito**.
- Encapsula el envío en un único hook o servicio (`useSubmitScores` o equivalente), porque en la fase 2 se le añadirá una cola sin conexión.
- Si la sesión está cerrada, el formulario queda en solo lectura (con el estado deshabilitado que ya tengan los componentes).
- El juez nunca ve notas de otros jueces ni rankings.

### 4.4 Página pública de resultados (NUEVA)

**Requisitos funcionales**:
1. **Inicio**: lista de eventos publicados.
2. **Evento** (`/<locale>/<eventSlug>`): cabecera con el logo del evento (`event.logo_url`), nombre, sede y fechas en la zona horaria del evento; premios por comité, en orden (Mejor Delegado → Sobresaliente → Mención Honorífica → Mención Verbal), con país o personaje (bandera por `country_code`), delegados e institución.
3. **Comité** (`/<locale>/<eventSlug>/<committeeSlug>`): premios y, **solo si `ranking` no es `null`**, el ranking. La puntuación solo aparece si `score` no es `null`.
4. Evento no publicado o inexistente → 404.
5. `<meta name="robots" content="noindex">` si `settings.indexable = false`.
6. **Renderiza tal cual lo que llega**: no formatees nombres ni filtres datos; la privacidad la garantiza el backend.

**Requisitos no funcionales**:
- Debe servirse como **HTML generado de forma estática** con **revalidación bajo demanda**: el pico de visitas de la ceremonia de clausura no debe llegar al backend.
- Debe funcionar bien en móvil.
- Datos: lee **solo** `public.public_results` con supabase-js (clave `anon`): `select('data').eq('event_slug', slug).eq('published', true)`. RLS ya impide leer lo no publicado.
- Revalidación: webhook firmado desde el backend (6.6).

**Diseño**: la página pública se construye **solo con los componentes, estilos y layouts del frontend existente** (tarjetas, tablas, cabeceras, tipografías, colores). No crees un estilo nuevo. Si falta algún elemento (por ejemplo, un componente de bandera), usa el equivalente visual más cercano que ya exista y señálalo en el plan.

**Dónde construirla** (decídelo en el plan según el inventario):

| Si el frontend existente es… | Entonces |
|---|---|
| **Next.js** | Añade las rutas públicas en la misma app (segmento `(public)`), con generación estática, `revalidateTag('event:<slug>')` y la ruta del webhook |
| **Otro framework con SSG/SSR** (Nuxt, SvelteKit, Astro, Remix…) | Añádela en la misma app con el mecanismo de generación estática y revalidación equivalente |
| **SPA sin renderizado en servidor** (Vite, CRA…) | Crea una app Next.js aparte (`apps/public` o carpeta hermana) que **reutilice** los componentes y estilos existentes (paquete compartido o importación desde la carpeta del proyecto), sin duplicar ni reescribir estilos. Propón en el plan cómo compartirlos |

---

## 5. Capa de datos: cómo sustituir los datos actuales

1. Localiza todas las fuentes de datos simulados o codificados (mocks, JSON, constantes, `faker`, API antigua) y lístalas en el plan.
2. Crea una **capa de acceso a datos** única (o adapta la existente):
   - Si el backend expone `/api/v1/openapi.json`, genera el cliente con **Orval**, adaptado al patrón de datos del proyecto (fetch + TanStack Query, SWR, axios…).
   - Si no, escribe un cliente tipado **a mano** siguiendo exactamente la sección 6, con un `// TODO: sustituir por Orval`.
3. **Adaptadores**: si los componentes esperan una forma de datos distinta de la del contrato, **no cambies los componentes**. Escribe funciones `toViewModel()` que transformen la respuesta de la API a lo que el componente ya espera. Solo si el componente no puede mostrar un dato obligatorio, añade la prop mínima necesaria.
4. **Mocks para desarrollo**: sustituye los datos de ejemplo actuales por **MSW** (o el mecanismo equivalente del proyecto) que devuelva respuestas con la forma del contrato. Así se puede trabajar sin backend y las pruebas usan datos realistas.
5. **Errores**: traduce los problem+json a un `ApiError { code, detail, status }` y los códigos de 6.3 a mensajes en español, mostrados con los componentes de error o aviso existentes.
6. **Fechas**: muéstralas en la zona horaria del evento (`event.timezone`), no en la del navegador.
7. Elimina el código de datos simulados que ya no se use (mocks antiguos, constantes), sin tocar los componentes visuales.

---

## 6. Contrato de la API

Este contrato (rutas, formas y códigos) es **el mismo** que en el prompt del backend; solo cambian las notas de implementación de cada lado.

### 6.1 Convenciones

- Prefijo `/api/v1`. JSON en `snake_case`. IDs `uuid`. Fechas ISO 8601 en UTC.
- Autenticación: `Authorization: Bearer <access_token de Supabase>`. Rol en el claim `app_role`.
- OpenAPI en `/api/v1/openapi.json`, con `operation_id` estables (`list_events`, `submit_scores_batch`…) porque el frontend genera su cliente con Orval.
- Paginación de listas: `?limit=&offset=` → `{ "items": [...], "total": n }`.
- Errores en `application/problem+json`: `{ "type", "title", "status", "code", "detail", "errors"? }`.

### 6.2 Endpoints

**Comunes**

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/me` | cualquiera | `{ user_id, email, role, full_name }` |

**Administración** (rol `admin`)

| Método | Ruta | Descripción |
|---|---|---|
| GET, POST | `/events` | Listar / crear (crea la rúbrica por defecto) |
| GET, PATCH, DELETE | `/events/{event_id}` | Detalle / editar / borrar (solo `draft`) |
| POST | `/events/{event_id}/logo` | Subir logo (multipart) → Storage `event-logos` |
| POST | `/events/{event_id}/close` | Cerrar evento + instantánea |
| GET, POST | `/events/{event_id}/committees` | Listar / crear |
| GET, PATCH, DELETE | `/committees/{committee_id}` | Detalle / editar / borrar |
| GET, POST | `/committees/{committee_id}/delegations` | Listar (con delegados) / crear |
| POST | `/committees/{committee_id}/delegations/import` | CSV (sección 6.4) → `{ created, skipped, errors: [{ row, message }] }` |
| PATCH, DELETE | `/delegations/{delegation_id}` | Editar / borrar |
| POST | `/delegations/{delegation_id}/delegates` | Añadir delegado |
| PATCH, DELETE | `/delegates/{delegate_id}` | Editar / borrar |
| GET, POST | `/judges` | Listar / invitar (`{ email, full_name }` → invitación de Supabase) |
| PATCH | `/judges/{judge_id}` | Editar nombre / `active` |
| GET, PUT | `/committees/{committee_id}/judges` | Ver / reemplazar asignaciones `[{ judge_id, role }]` |
| GET | `/events/{event_id}/rubrics` | Listar rúbricas del evento |
| GET, PUT | `/rubrics/{rubric_id}` | Ver / reemplazar (nombre, escala, criterios) |
| GET | `/committees/{committee_id}/sessions` | Sesiones con estado |
| POST | `/committees/{committee_id}/sessions/{number}/open` | Abrir |
| POST | `/committees/{committee_id}/sessions/{number}/close` | Cerrar |
| GET | `/committees/{committee_id}/progress` | `{ sessions: [{ number, status, judges: [{ judge_id, full_name, scored, expected }] }] }` |
| GET | `/committees/{committee_id}/ranking` | Ver 6.5 (`RankingEntry`) + `quota_warnings` |
| GET, PUT | `/committees/{committee_id}/awards` | Ver / reemplazar `[{ award_type, delegation_id, position }]` |
| GET | `/events/{event_id}/export.xlsx` | Excel: hoja por comité (ranking + premios) + hoja de detalle por criterio |
| GET, PUT | `/events/{event_id}/publication-settings` | Ver / editar |
| GET | `/events/{event_id}/publication/preview` | Documento público (6.5) sin guardar |
| POST | `/events/{event_id}/publish` | `{ version, published_at, revalidated }` |
| POST | `/events/{event_id}/unpublish` | `{ revalidated }` |

**Jueces** (rol `judge`, siempre limitado a sus asignaciones)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/judge/committees` | Comités asignados `[{ committee_id, name, acronym, event: { name, logo_url, timezone }, role }]` |
| GET | `/judge/committees/{committee_id}` | Delegaciones + delegados + rúbrica (con descriptores) + sesiones con estado |
| GET | `/judge/sessions/{session_id}/scores` | **Sus** calificaciones de esa sesión |
| POST | `/judge/scores/batch` | Lote (6.3) |

### 6.3 Lote de calificaciones

```json
// POST /api/v1/judge/scores/batch
{ "items": [ { "client_id": "uuid", "delegate_id": "uuid", "session_id": "uuid",
               "criterion_id": "uuid", "value": 3, "comment": "opcional",
               "client_updated_at": "2026-10-10T15:04:05Z" } ] }
// 200
{ "accepted": ["client_id", "..."],
  "rejected": [ { "client_id": "uuid", "code": "SESSION_CLOSED", "detail": "La sesión 2 está cerrada" } ] }
```

Códigos de error: `SESSION_CLOSED`, `EVENT_CLOSED`, `JUDGE_NOT_ASSIGNED`, `VALUE_OUT_OF_RANGE`, `NOT_FOUND`, `WEIGHTS_MUST_SUM_100`, `DELEGATES_LIMIT_EXCEEDED`, `EVENT_NOT_CLOSED`, `SESSIONS_STILL_OPEN`, `VALIDATION_ERROR`. **Tradúcelos todos a mensajes en español.**

### 6.4 CSV de importación

Codificación UTF-8, separador `,`, con cabecera:

```csv
country_code,character_name,institution,delegate_1,delegate_2
MX,,Colegio Ejemplo,Ana Pérez López,
US,,Instituto Norte,John Smith,Mary Jones
,Ministro de Defensa,Colegio Sur,Luis Gómez,
```

### 6.5 Formas compartidas

```jsonc
// RankingEntry (GET /committees/{id}/ranking → { items: RankingEntry[], quota_warnings: string[] })
{ "position": 1, "tied": false, "delegation_id": "uuid", "country_code": "MX", "character_name": null,
  "institution": "Colegio Ejemplo", "delegates": [{ "delegate_id": "uuid", "full_name": "Ana Pérez López", "final_score": 87.5 }],
  "score": 87.5, "criteria_averages": { "<criterion_id>": 3.5 }, "incomplete_flags": [] }

// Documento público (public.public_results.data y /publication/preview)
{ "event": { "slug": "sd-mun-2026", "name": "SD-MUN 2026", "brand": "grand_international",
             "logo_url": "https://...", "venue": "Santo Domingo", "starts_on": "2026-10-09",
             "ends_on": "2026-10-11", "timezone": "America/Santo_Domingo" },
  "settings": { "name_format": "first_name_initial", "show_institution": true,
                "show_ranking": false, "show_scores": false, "indexable": false },
  "committees": [ { "slug": "disec", "name": "Primera Comisión", "acronym": "DISEC", "type": "general_assembly",
      "awards": [ { "award_type": "best_delegate", "position": 1,
                    "delegation": { "country_code": "MX", "character_name": null, "institution": "Colegio Ejemplo" },
                    "delegates": ["Ana P."] } ],
      "ranking": null } ],
  "published_at": "2026-10-11T23:00:00Z", "version": 1 }
```

- `ranking` es `null` si `show_ranking = false`. Si no, es una lista con `{ position, delegation, delegates, score }`, donde `score` es `null` salvo que `show_scores = true`.
- `institution` es `null` si `show_institution = false`.
- Con `name_format = hidden`, `delegates` es `[]`.
- **El frontend renderiza tal cual lo que llega**: no formatea nombres ni filtra datos por privacidad; eso lo garantiza el backend.
- En la página pública, lee `data` de `public.public_results` con `select('data').eq('event_slug', slug).eq('published', true)`.

### 6.6 Webhook de revalidación (FastAPI → página pública)

- Petición: `POST {PUBLIC_SITE_URL}/api/revalidate` con cuerpo `{ "event_slug": "sd-mun-2026" }`.
- Cabecera `X-Signature: sha256=<hex HMAC-SHA256 del cuerpo con REVALIDATE_SECRET>`.
- *Timeout* de 5 s y 2 reintentos.
- En la ruta del webhook:
  1. Lee el cuerpo **crudo**.
  2. Compara el HMAC con una comparación de tiempo constante (`timingSafeEqual`); si no coincide, responde 401.
  3. Revalida la caché del evento (`event:<slug>`) y la lista de eventos.
  4. Responde `{ revalidated: true }`.

---

## 7. Configuración

Variables de entorno, con los nombres adaptados al prefijo del framework (`VITE_`, `NEXT_PUBLIC_`…):

| Variable | Dónde | Uso |
|---|---|---|
| `API_URL` | Panel | Base de la API (`.../api/v1`) |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Panel y página pública | Autenticación (panel) y lectura de `public_results` (página pública) |
| `REVALIDATE_SECRET` | **Solo servidor** de la página pública | Verificar el webhook. Nunca con prefijo público |

**Nunca** uses ni referencies la clave `service_role` en el frontend. Añade las variables a `.env.example` sin valores reales.

---

## 8. Seguridad y privacidad

- Los guards de rol del frontend son de experiencia de usuario; la autorización real la hace el backend. No muestres datos que la API no devuelva.
- No guardes datos personales de delegados en `localStorage` ni `sessionStorage`.
- La página pública no recibe ni muestra nada que no esté en `public_results`.
- Elimina los datos de ejemplo con nombres de personas reales si los hubiera.

---

## 9. Pruebas

- **Regresión visual**: capturas antes y después de las pantallas principales (sección 1). Adjunta el resultado en el resumen final.
- **Unitarias**: adaptadores `toViewModel`, traducción de errores, hook de envío de calificaciones (`client_id`, `rejected`, reintentos) y validación de pesos de la rúbrica.
- **Integración con MSW**: flujo de administración (evento → comité → CSV → asignar juez → abrir sesión) y del juez (calificar un comité completo).
- **Página pública**: los 3 `name_format`, `ranking` nulo o presente, `noindex` según la configuración, 404 para no publicados y webhook con firma válida e inválida.
- Mantén en verde las pruebas que ya existan. Si alguna falla solo porque cambiaron los datos de ejemplo, actualiza los datos de la prueba, no el componente.

---

## 10. Valores por defecto para preguntas abiertas del cliente

| Pregunta abierta | Valor por defecto |
|---|---|
| ¿Se califica por sesión? | Sí (selector de sesión, si la pantalla del juez lo tiene; si no, es un 🟡) |
| ¿Delegación doble? | Se califica a cada delegado por separado |
| ¿Los jueces ven notas de otros? | No |
| ¿Premios automáticos? | Manuales, con avisos de cupos |
| ¿Qué se publica? | Lo decide el backend según `publication_settings` (por defecto: "Nombre I.", institución, sin ranking ni puntajes, `noindex`) |
| ¿Idioma? | Español; si el frontend ya tiene i18n, añade las claves nuevas en español |

Marca cada uno con `// TODO(cliente): confirmar <tema>`.

---

## 11. Hitos y criterios de aceptación

| # | Hito | Hecho cuando… |
|---|---|---|
| 1 | Inventario y plan | Stack, mapa de pantallas, origen de los datos, análisis de brechas (✅/🟡/❌), dónde irá la página pública y capturas de referencia. **Aprobado antes de seguir** |
| 2 | Capa de datos | Cliente de la API (Orval o manual), `ApiError`, mocks MSW con la forma del contrato, variables de entorno |
| 3 | Autenticación | Inicio de sesión existente conectado a Supabase (contraseña + enlace mágico), token en las llamadas, redirección por rol |
| 4 | Administración | Todas las pantallas de 4.2 conectadas (con adaptadores); 🟡 resueltos con componentes existentes |
| 5 | Jueces | Pantallas de 4.3 conectadas, guardado por lotes con `client_id`, errores por criterio, solo lectura en sesión cerrada |
| 6 | Página pública | Rutas de 4.4 con generación estática, lectura de `public_results`, webhook HMAC, `noindex`, 404, construida solo con el diseño existente |
| 7 | Limpieza y verificación | Mocks antiguos eliminados, pruebas en verde, **capturas sin diferencias de diseño**, `CLAUDE.md` actualizado |

Al terminar, entrega un resumen con:
- Qué pantallas se conectaron.
- Qué quedó como "Requiere decisión de diseño".
- Qué `TODO(cliente)` hay.
- La comparación de capturas.
- Cómo ejecutar el proyecto con y sin backend real.

---

## 🔗 Relacionado

*(Metadatos de la bóveda de Obsidian: ignóralos al implementar.)*

- [[sistema-calificaciones-munych]]
- [[propuesta-tecnica-sistema-calificaciones-munych]]
- [[requerimientos-sistema-calificaciones-munych]]
- [[prompt-backend-munych]]

#tema/mun #tema/prompt #tema/frontend
