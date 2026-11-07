---
título: Registro de cambios — conexión del frontend MUNYCH a datos reales
alcance: apps/panel, apps/public, packages/ui
basado_en: prompt-frontend-munych.md v2.0
---

# Registro de cambios

Documento vivo que se actualiza al cerrar cada hito de `prompt-frontend-munych.md`. Para cada hito: qué se hizo, qué archivos cambiaron, qué decisiones de diseño se tomaron (pantallas nuevas construidas solo con componentes existentes) y qué `TODO(cliente)` quedaron pendientes.

**Nota de alcance**: los hitos 2–7 se construyeron contra **mocks MSW con la forma exacta del contrato**, porque el backend todavía no existía. Desde el hito 8 ambas apps hablan con el backend real por defecto (ver `routes.md`) y los mocks pasan a ser opcionales. Las pruebas automatizadas (sección 9 del prompt) se dejan para una siguiente etapa, a petición del cliente — este documento no las incluye salvo lint/typecheck de sanity check por hito.

---

## Hito 1 — Restructuración a monorepo + inventario

**Commit**: `chore(monorepo): mover panel a apps/panel y extraer @munych/ui`

- `apps/panel/` — el SPA Vite existente, movido tal cual desde la raíz (mismo contenido, cero cambios visuales).
- `packages/ui/` (`@munych/ui`) — extraídos `components/ui/*` y `styles/{tokens,global}.css`. Único ajuste: `CriterionSlider.tsx` dejó de depender de `lib/scoring.ts` del panel (se inlineó la función `contribution()`, una fórmula de una línea) para que el paquete no tenga dependencias cruzadas hacia `apps/panel`.
- `apps/public/` — carpeta reservada, se construye en el hito 6.
- Root `package.json` con `"workspaces": ["apps/*", "packages/*"]`.
- Verificación: capturas de Login y Eventos antes/después idénticas píxel a píxel (navegador), sin errores de consola, `npm run lint -w @munych/panel` sin nuevos warnings.
- Hallazgo pre-existente (no introducido por este cambio): `tsc -b` ya fallaba antes de tocar nada por campos fantasma (`Session.initials`, `Judge.since`, `Judge.role` faltante en un alta) — se corrigen al tocar esas pantallas en hitos posteriores.

---

## Hito 2 — Capa de datos

**Commit**: `feat(data): capa de datos, TanStack Query y mocks MSW`

Toda la infraestructura de datos, sin tocar aún ninguna pantalla (eso empieza en el hito 3).

- `apps/panel/src/data-access/apiTypes.ts` — todas las formas del contrato (sección 6 del prompt) en TypeScript: eventos, comités, delegaciones/delegados, jueces, rúbricas/criterios con niveles, sesiones, ranking, premios, publicación/documento público, lotes de calificación, `ProblemJson`.
  - **Decisión de diseño**: el contrato no aclara si las sesiones tienen un `id` propio además del `number` — lo necesita `/judge/sessions/{session_id}/scores`. Se añadió `ApiSession.id` (UUID) junto a `number` (el que usan `/committees/{id}/sessions/{n}/open|close`). `// TODO(cliente): confirmar si el backend expone id de sesión o solo number`.
- `apps/panel/src/data-access/apiClient.ts` — cliente HTTP a mano (`// TODO: sustituir por Orval` cuando exista `/api/v1/openapi.json`), inyecta `Authorization: Bearer`, reintenta una vez tras 401 refrescando el token y si vuelve a fallar dispara `onAuthExpired` (se conecta al router en el hito 3).
- `apps/panel/src/data-access/errors.ts` — `ApiError` + diccionario de los códigos de la sección 6.3 a español.
- `apps/panel/src/data-access/endpoints/*.ts` — funciones tipadas por dominio (`events`, `committees`, `delegations`, `judges`, `rubrics`, `sessions`, `results`, `publication`, `judgeApi`), una a una siguiendo las rutas de la sección 6.2.
- `apps/panel/src/data-access/queryClient.ts` — `QueryClient` de TanStack Query + `queryKeys` centralizadas (se eligió TanStack Query porque el proyecto no tenía ningún gestor de estado de servidor — ver plan, sección 3).
- `apps/panel/src/data-access/supabaseClient.ts` — cliente Supabase **solo auth** (password, magic link, refresh, logout); nunca lee/escribe tablas.
- `apps/panel/src/data-access/authService.ts` + `apps/panel/src/mocks/authMock.ts` — fachada de auth que en `VITE_USE_MOCKS=true` simula sesión en `localStorage` (sin Supabase real, que no existe en este entorno) y en producción delega en `supabaseClient.ts`. El rol se infiere del correo (contiene "juez"/"judge" → jueza, si no → admin) solo para poder probar ambos roles en local.
- `apps/panel/src/mocks/fixtures.ts` + `handlers.ts` + `browser.ts` — mocks MSW con la forma exacta del contrato (sustituyen a `src/data/mockData.ts`, que se retira en el hito 7 junto con `lib/auth.ts`/`lib/events.ts`). Incluye cálculo de ranking a partir de las calificaciones enviadas, límite de 2 delegados por delegación, validación `WEIGHTS_MUST_SUM_100`, sesión cerrada → `SESSION_CLOSED`.
- `apps/panel/src/main.tsx` — arranca el service worker de MSW antes de montar React cuando `DEV && VITE_USE_MOCKS !== 'false'`, y envuelve `<App>` en `QueryClientProvider`.
- `apps/panel/.env.example` — `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_USE_MOCKS`.
- Dependencias añadidas a `apps/panel`: `@tanstack/react-query`, `@supabase/supabase-js`, `msw` (dev).

**Verificación**: `tsc -b` sin errores nuevos (los 5 pre-existentes de campos fantasma siguen ahí, se resuelven en hitos 3-5), `oxlint` limpio en `src/data-access` y `src/mocks`, servidor arrancando con "[MSW] Mocking enabled" en consola sin errores, Login renderiza igual que antes (todavía no está conectado).

---

## Hito 3 — Autenticación

**Commit**: `feat(auth): conectar login a Supabase/mock, guards por rol y logout`

- `apps/panel/src/types.ts` — `Session` ahora es `{ role, name, email, judgeId }`. `judgeId` se mantiene como compatibilidad temporal para las pantallas de jueces que todavía indexan por él en estado local; se retira en el hito 5 cuando esas pantallas pasen a usar `/judge/*` directamente (el backend ya escopea por el JWT, no necesita judgeId).
- `apps/panel/src/state/AppStateContext.tsx` — se agregó `sessionLoading`, un efecto que se suscribe a `authService.onAuthStateChange` y resuelve la sesión llamando a `GET /me`; `login`/`logout` ahora usan `authService`; nueva acción `loginWithMagicLink`; se conectó `setOnAuthExpired` (definido en el hito 2) para limpiar la sesión si el refresh de token falla.
- `apps/panel/src/pages/LoginPage.tsx` — conectado a `login`/`loginWithMagicLink`; añadido un modo `password | magic` con un toggle (mismos componentes `Button`/inputs existentes). En móvil se reutilizaron los dos botones "Usar código de acceso" que eran un duplicado exacto sin funcionalidad (bug pre-existente): uno se convirtió en el toggle real de enlace mágico y el otro se eliminó por ser un duplicado inerte. En escritorio se añadió un botón de texto bajo el submit, mismo patrón visual que otros enlaces de acción del proyecto (p. ej. "Descargar plantilla CSV" en Países). Redirección por rol ahora ocurre en un efecto que reacciona a `session` (cubre tanto login por contraseña como la llegada asíncrona de la sesión por enlace mágico).
- `apps/panel/src/components/layout/AdminLayout.tsx` y `JudgeLayout.tsx` — devuelven `null` mientras `sessionLoading` para no redirigir a `/login` antes de resolver la sesión (evita parpadeo).
- **Decisión de diseño**: el panel de administración no tenía ningún control de cierre de sesión en ninguna pantalla (`AdminSidebar.tsx` no lo incluía). Se añadió un botón "Cerrar sesión" al final del sidebar reutilizando exactamente la clase `.link` ya usada por los demás ítems de navegación (mismo tamaño, color, hover), con el icono `LogOut` de `lucide-react` (ya es dependencia del proyecto). Sin este control, un admin no podía salir de su sesión desde la interfaz.
- `apps/panel/src/data-access/apiClient.ts` — se corrigió `BASE_URL` para caer a `'/api/v1'` (relativo) cuando `VITE_API_URL` no está definida, en vez de string vacío; sin esto, las peticiones a `/me` etc. no coincidían con el prefijo `/api/v1` de los handlers de MSW y el dev server devolvía el `index.html` de Vite en vez de JSON.

**Verificación** (contra mocks, sin backend real): login con contraseña como admin → redirige a `/admin/eventos`; login con contraseña usando un correo que contiene "juez" → redirige a `/juez` y muestra "Buenos días, Andrea" / "Andrea Torres" (desde el `/me` mockeado); enlace mágico → inicia sesión como jueza; "Cerrar sesión" limpia la sesión y vuelve a `/login`. `tsc -b` y `oxlint` sin regresiones (mismos 5 errores/avisos pre-existentes de campos que se resuelven en hitos 4-5).

---

## Hito 4 — Administración

**Commit**: `feat(admin): conectar todas las pantallas de administración a la API`

Todas las pantallas de `apps/panel/src/pages/admin/*` se reconectaron a `data-access/hooks.ts` (TanStack Query), dejando de leer de `AppStateContext`/`mockData.ts`. `AppStateContext.tsx` se redujo: ya no tiene `events`/`addEvent`/`reloadEvents`/`eventById`/`updateCommittee`/`addCountries`/etc. — solo conserva sesión y, temporalmente, el estado de jueces (hito 5).

- **`data-access/hooks.ts`** (nuevo): un hook de TanStack Query por endpoint (`useEvents`, `useCommittees`, `useDelegations`, `useJudges`, `useEventRubrics`, `useSessions`, `useRanking`, `useAwards`, `usePublicationSettings`, etc.), todos invalidando por `queryKeys` (hito 2) tras cada mutación.
- **`lib/statusLabels.ts`** y **`lib/adminProgress.ts`** (nuevos): el contrato no da un `status` de evento/comité igual al mock viejo ni un `%` de avance ya calculado — se derivan de `EventStatus`/`SessionStatus` y de `CommitteeProgress.sessions[].judges[].{scored,expected}` respectivamente.
- **`EventsPage`**: CRUD real; el modal de creación gana `slug` (autogenerado editable), `brand`, país ISO y timezone (campos que exige el contrato y no existían). Las tarjetas muestran el conteo real de comités (`useCommittees`); países/jueces por evento se dejan en «—» porque el contrato no expone un agregado a ese nivel sin N+1 pesados — `TODO(cliente): valorar un endpoint de agregados por evento`.
- **`AdminDashboardPage`**: KPIs y tabla de progreso por comité recalculados con `useQueries` sobre delegaciones/asignaciones/avance de todos los comités del evento (antes venían de un mock plano). Se añadió **Cerrar evento** (`POST /events/{id}/close`), que no existía en el diseño — botón rojo junto a "Exportar todo", con confirmación fuerte, oculto si el evento ya está cerrado.
- **`CommitteesPage`**: formulario adaptado al contrato (tipo de comité, rúbrica propia opcional, delegación doble, n.º de sesiones en vez de "sala"/"idioma", que no existen en el modelo nuevo). Se añadió gestión de **sesiones** (abrir/cerrar con confirmación) dentro del panel de edición — no existía ninguna pantalla de sesiones.
- **`CountriesPage`** → contenido renombrado a **Delegaciones**: modelo delegación+delegados (país o personaje, 1–2 delegados), importación CSV real contra `POST .../delegations/import` con la plantilla `country_code,character_name,institution,delegate_1,delegate_2` de la sección 6.4 (se retiró el parseo/validación manual en el cliente).
- **`JudgesPage`**: como el contrato asigna jueces **por comité** (`PUT /committees/{id}/judges`) y no por juez, se reconstruyó la asignación centrada en el juez calculando membresías con `useQueries` sobre todos los comités y aplicando solo los `PUT` de los comités cuyo estado cambió al guardar.
- **`CriteriaPage`**: ahora edita **rúbricas** reales con escala configurable y descriptores de texto por nivel (antes no existían). Se retiró el flujo "+ Nuevo set de rúbrica" porque el contrato no tiene endpoint para crear rúbricas adicionales (solo `POST /events` crea la rúbrica por defecto) — `TODO(cliente): confirmar si se podrán crear rúbricas adicionales por evento`.
- **`ResultsPage`**: ranking conectado a `GET /committees/{id}/ranking` con columnas de criterio dinámicas (antes 3 criterios fijos hardcodeados), badge de `tied` y `quota_warnings`. Se añadieron, en la misma pantalla y con los mismos componentes (`Select`, `Toggle`, `Button`, cajas blancas con borde ya usadas en Exportar): gestión de **premios** (`GET/PUT .../awards`) y **publicación** (ajustes, vista previa del documento público, publicar/despublicar) — ninguna de las dos existía. El desglose "por juez" del expandible se quitó porque `RankingEntry` no expone calificación por juez, solo promedios por criterio.
- **`ExportPage`**: "Generar archivo" ahora descarga el `.xlsx` real (`GET /events/{id}/export.xlsx`, fetch+blob). El selector de formato/contenido se conserva visualmente pero solo XLSX está implementado en el backend — `TODO(cliente): confirmar alcance de PDF/CSV`. La vista previa usa `useRanking` del comité seleccionado en vez de datos fijos.

**Verificación** (mocks MSW, sin backend real): flujo completo probado en el navegador — crear/ver eventos, entrar a MUNYCH 2026, Dashboard con KPIs reales, Comités con sesiones, Delegaciones, Jueces con asignación cruzada, Criterios con escala y niveles, Resultados con premios pre-cargados del mock, publicar el evento (pasa de "Borrador" a "Publicado" en el sidebar) y ver la vista previa del documento público. Sin errores de consola. `tsc -b` y `oxlint` sin regresiones sobre las páginas de administración (los 4 errores/avisos restantes son de las pantallas de jueces, hito 5).

---

## Hito 5 — Jueces

**Commit**: `feat(judge): conectar las pantallas de jueces a /judge/* con guardado por lotes`

`apps/panel/src/state/AppStateContext.tsx` perdió el resto del estado de mock (`committees`, `countries`, `judges`, `criteriaSets`, `scores` y sus acciones) — ya solo guarda sesión y evento activo. `src/lib/judgeProgress.ts`, `src/lib/countryMeta.ts` y `src/data/mockData.ts` quedan sin usar (se eliminan en el hito 7).

- **Cambio de unidad de calificación**: el modelo viejo calificaba por "país" (`Country`); el contrato califica **por delegado** (una delegación doble tiene 2 delegados que se califican por separado — sección 10). Se propagó ese cambio a `CommitteePage`, `ScoringForm` y `ProgressPage`: la lista, la búsqueda, la navegación anterior/siguiente y el ranking parcial ahora iteran delegados (`Delegado 1A`, `Delegado 1B`, …), no delegaciones.
- **`data-access/useSubmitScores.ts`** (nuevo): hook único de guardado (sección 4.3) — genera `client_id`/`client_updated_at` por criterio, agrupa en lotes (`debounce` 800 ms), reintenta con espera exponencial (hasta 4 veces) sin perder lo escrito, traduce `rejected` a español y expone `saveState` para `AutosaveIndicator`. Aislado a propósito para que la cola sin conexión de la fase 2 solo toque este archivo.
- **`@munych/ui` · `CriterionSlider`**: ganó `min`/`max`/`descriptor` opcionales (por defecto 0–100, compatible hacia atrás) — **decisión de diseño** del plan: en vez de crear un componente nuevo para la escala 1–4 de la rúbrica, se reparametrizó el mismo slider y se le añadió una línea de texto con el descriptor del nivel actual (ya existía espacio para texto secundario en la tarjeta).
- **`ScoringForm`**: ahora recibe `delegate`+`delegation`+`rubric`+`sessionId`+`scores` en vez de `country`+`criteria`; de solo lectura si la sesión está cerrada (`readOnly`). Se retiró el botón "Marcar como completo": el contrato no tiene un flag de "completado" independiente de tener todos los criterios calificados, así que no hay nada que persista ese estado — `TODO(cliente): confirmar si hace falta un completado manual además del automático`.
- **Comentario del juez**: el contrato adjunta `comment` a nivel de criterio dentro del lote, no hay un campo de comentario a nivel de delegado. Se mantiene la única caja de texto del diseño, pero se envía anclada al último criterio tocado por el juez (o al primero, si ya tiene valor) — **decisión de diseño**, documentada porque el contrato no da más granularidad.
- **`CommitteePage`**: se añadió el selector de sesión (`Select` existente) que no existía; la sesión activa por defecto es la primera `open`, si no la primera `pending`, si no la última.
- **`DashboardPage`**: cada tarjeta de comité calcula su propio avance (`useJudgeCommittee` + `useSessionScores` de la sesión vigente) y lo reporta al padre para el KPI "Avance total", igual que el patrón usado en el Dashboard de administración.
- **`ProgressPage`**: ranking parcial y pendientes recalculados sobre delegados con `lib/judgeScoreMeta.ts` (nuevo: deriva estado/label/puntaje ponderado 0-100 de las `JudgeScore[]` del juez para la sesión vigente, reemplaza a `lib/countryMeta.ts`).
- **`ProfilePage`**: los campos fantasma `judge.role`/`judge.since` (no existían ni en el tipo ni en los datos, típico bug del prototipo) se reemplazaron por el correo real (`session.email`) y el rol **por comité** (`chair`/`moderator`/`judge`, vía `useJudgeCommittees`), ya que el contrato no tiene un rol global de juez.
- **`JudgeTopNav`**, **`DashboardPage`**: se corrigió `session.initials` (no existía en el tipo `Session`, error de compilación pre-existente) usando un helper compartido `lib/initials.ts`.

**Verificación** (mocks MSW, sin backend real): sesión de juez completa probada en el navegador — Mis comités con avance real (0 de 20 delegaciones), entrar a Consejo de Seguridad, mover un slider de Oratoria a nivel 2 (el descriptor cambia a "Se entiende pero con muletillas frecuentes", el total ponderado sube a 8.3, el guardado automático confirma), navegar a Mi progreso y ver el ranking parcial y el promedio persistidos, Corte Internacional de Justicia (comité doble) muestra "Delegado 1A"/"Delegado 1B" como filas independientes, Mi perfil muestra el rol correcto por comité (Presidencia en CS, Juez en CIJ). Sin errores de consola. `tsc -b` **sin ningún error** (los 5 que arrastraba el proyecto desde antes de este trabajo ya no existen) y `oxlint` sin advertencias nuevas.

---

## Hito 6 — Página pública

**Commit**: `feat(public): nueva página pública en Next.js con ISR y webhook de revalidación`

Nueva app `apps/public/` (Next.js App Router), elegida en el plan porque `apps/panel` es un SPA de Vite sin SSR/SSG (sección 4.4, tabla de decisión del prompt). Construida **solo** con `@munych/ui` (Card, Button, Medal, Avatar, StatusBadge, EmptyState, `Table.module.css`, `tokens.css`/`global.css`) — sin ningún estilo ni componente nuevo.

- `apps/public/lib/types.ts` — la forma del documento público (sección 6.5) definida de forma independiente a `apps/panel` (la página pública nunca debe depender de la API interna del panel, solo de `public.public_results`).
- `apps/public/lib/supabasePublic.ts` — cliente Supabase de **solo lectura**, clave `anon`, exclusivamente para `public.public_results`.
- `apps/public/lib/data.ts` — `getPublishedEvents()` / `getEventDocument(slug)` con `select('data').eq('event_slug', slug).eq('published', true)` (RLS impide leer lo no publicado). Sin `NEXT_PUBLIC_SUPABASE_URL` configurada (no hay proyecto de Supabase real en este entorno) usa `lib/mockPublicData.ts`, con la forma exacta del documento.
- Rutas: `app/[locale]/page.tsx` (inicio, lista de eventos publicados), `app/[locale]/[eventSlug]/page.tsx` (evento: cabecera con logo/nombre/sede/fechas en la timezone del evento + premios por comité), `app/[locale]/[eventSlug]/[committeeSlug]/page.tsx` (comité: premios y, solo si `ranking` no es `null`, el ranking). Solo se implementó el locale `es` (valor por defecto de la sección 10); `[locale]` queda como segmento dinámico para no bloquear una futura ampliación.
- **Renderiza tal cual** lo que llega del documento (sección 4.4/6.5): ningún componente formatea nombres ni filtra por privacidad, eso lo garantiza `name_format`/`show_*` ya aplicados por el backend.
- `noindex`: `generateMetadata` en evento y comité devuelve `robots: {index:false}` si `settings.indexable` es `false`.
- 404: `notFound()` de Next si el evento o el comité no existen o no están publicados; `app/not-found.tsx` reutiliza `Button` de `@munych/ui`.
- Generación estática con `revalidate = 3600` (ISR) en cada página + revalidación bajo demanda real vía `app/api/revalidate/route.ts` (sección 6.6): verifica `X-Signature: sha256=<HMAC>` con `timingSafeEqual`, y llama a `revalidatePath` para el evento y la lista — se usó `revalidatePath` en vez de `revalidateTag` (que mencionaba el prompt a modo de ejemplo) porque los datos se leen con `supabase-js` directo, no con el `fetch` de Next, así que no hay nada que etiquetar con `tags`; `revalidatePath` logra el mismo resultado (revalidación bajo demanda sin esperar al pico de tráfico de la ceremonia).
- **Decisión de diseño**: no existe un componente de bandera por `country_code` en `@munych/ui`; se reutiliza `Avatar` (iniciales/código como texto), igual que se decidió en el plan.
- `.env.example` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `REVALIDATE_SECRET` (solo servidor).

**Verificación** (mocks de `lib/mockPublicData.ts`, sin Supabase real): `npx tsc --noEmit` sin errores. Probado en el navegador con `next dev` — inicio lista "SD-MUN 2026", entrar al evento muestra cabecera con logo/sede/fechas y premios por comité (Medal + Avatar como código de país), "Ver ranking completo" navega al comité y muestra la tabla completa con puntajes ocultos (`show_scores: false` → "—" en vez de número, tal como exige el contrato), un slug de evento inexistente devuelve **404 real** (`Invoke-WebRequest` confirma `StatusCode: NotFound`), el `<meta name="robots" content="noindex, nofollow">` aparece en el HTML servido porque `settings.indexable` es `false` en el mock. El webhook `/api/revalidate` probado con HMAC-SHA256 real calculado en PowerShell: firma válida → `200 {"revalidated":true}`, firma inválida → `401`. Sin errores de consola (una advertencia de hidratación en la primera carga desapareció en cargas posteriores y solo aparecía con la extensión de automatización del navegador activa — el propio mensaje de Next.js señala eso como causa típica; no se reprodujo con `Invoke-WebRequest` ni en navegaciones cliente posteriores).

`next lint` pide configuración interactiva de ESLint (no disponible en este entorno no interactivo) — `TODO: configurar ESLint para apps/public` (no bloqueante; `tsc` ya cubre errores de tipos).

---

## Hito 7 — Limpieza y verificación

**Commit**: `chore(cleanup): eliminar mocks antiguos y simplificar AppStateContext`

- Eliminados (sin consumidores tras el hito 5): `apps/panel/src/data/mockData.ts`, `src/lib/auth.ts`, `src/lib/events.ts` (los dos con fetches rotos a `127.0.0.1:8000`, detectados en el inventario del hito 1), `src/lib/judgeProgress.ts`, `src/lib/countryMeta.ts` (reemplazado por `src/lib/judgeScoreMeta.ts` en el hito 5).
- `AppStateContext.tsx` quedó reducido a lo que de verdad es estado de UI: sesión y evento activo. Todo lo demás (eventos, comités, delegaciones, jueces, rúbricas, calificaciones) vive en `data-access/hooks.ts` (TanStack Query) desde los hitos 4 y 5.
- `CLAUDE.md` actualizado con la estructura final del monorepo, los comandos de ambas apps y cómo funcionan los mocks (sección "Datos y mocks").
- **Verificación**: `tsc -b` sin errores, `oxlint` sin advertencias nuevas (solo el patrón ya existente de exportar componente+hook desde `AppStateContext.tsx`). Regresión visual final en el navegador tras la limpieza: Login (mobile y desktop) y Mis comités del juez renderizan igual que en los hitos anteriores, sin errores de consola.

---

## Hito 8 — Conexión al backend real

Referencia: `routes.md` (raíz). Se contrastó la capa de datos con el `/api/v1/openapi.json` del backend en ejecución:

- **Rutas**: las 48 operaciones del OpenAPI coinciden una a una (método, ruta y parámetros) con `apps/panel/src/data-access/endpoints/*.ts`. `routes.md` dice 49, pero el esquema real tiene 48.
- **Schemas**: todos los campos (nombres, opcionales y enums) coinciden con `apiTypes.ts` y con `apps/public/lib/types.ts`. No hubo que cambiar tipos ni pantallas.
- **CORS**: el backend ya permite `http://localhost:5173` y `http://localhost:3000`.

Cambios:

- `apps/panel/src/main.tsx` y `data-access/authService.ts` — los mocks (MSW + auth simulada) pasan a ser **opcionales**: solo con `VITE_USE_MOCKS=true` en dev. Por defecto, la API es real y la autenticación usa Supabase.
- `apps/public/lib/data.ts` — los mocks se activan solo con `NEXT_PUBLIC_USE_MOCKS=true`. Antes se activaban si faltaba `NEXT_PUBLIC_SUPABASE_URL`. Los errores de Supabase se registran en consola en vez de ignorarse.
- `.env.example` de ambas apps actualizados; `.env.local` de ambas apps con la URL del proyecto de Supabase del backend.

- **Juez con comités en varios eventos**: `/judge/committees` (backend) ahora solo devuelve comités de eventos `active`; el mock MSW hace lo mismo. En el panel del juez se añadió el nombre del evento (`event.name`) al texto secundario que ya existía en Mis comités, Mi perfil, Mi progreso y la pantalla de calificación. Solo cambia el texto, no los estilos ni la maquetación.

- **Calificación con guardado manual** (decisión de diseño, pedida por el cliente): se retiró el autoguardado por cambio.
  - `data-access/useScoreDrafts.ts` sustituye a `useSubmitScores.ts`: los cambios de cualquier delegado de la sesión se acumulan como borradores y el botón **Guardar cambios** los envía juntos (`POST /judge/scores/batch`, en lotes de 500). Lo rechazado se queda como borrador, con su motivo junto al delegado.
  - El comentario viaja con las notas: si solo cambia el comentario, se reenvían las notas ya guardadas del delegado. Sin ninguna nota no se puede guardar, y se avisa.
  - **Aviso al salir con cambios sin guardar**: diálogo propio `components/ConfirmDialog.tsx`, con el mismo diseño que los modales del admin (`AdminShared.module.css`: `overlay` + `modalCard`, sin estilos nuevos) y portal en `<body>`. Tiene **Seguir editando**, **Descartar cambios** y **Guardar y salir** / **Guardar y cambiar**; si no se logra guardar todo, el juez se queda en la página para ver el motivo. Sale al cambiar de pestaña del panel, volver, usar "atrás" del navegador o cambiar de sesión. Al cerrar o recargar la pestaña del navegador sale el aviso nativo (`beforeunload`). Cambiar de delegado no avisa: los borradores se conservan.
  - `App.tsx` pasa de `<HashRouter>` a `createHashRouter` + `RouterProvider`, necesario para `useBlocker`. Las rutas y URLs son las mismas.
  - Controles nuevos, todos con componentes existentes: `Button` "Guardar cambios" bajo el comentario (escritorio) y en el pie (móvil); en la lista móvil, `Button variant="gold"` cuando hay cambios; "· Sin guardar" / "· No guardado" en la lista de delegados. `AutosaveIndicator` (`@munych/ui`) acepta un `label` opcional; solo cambia el texto, no los estilos.
- `mocks/handlers.ts` usa la misma base que `apiClient.ts` (`VITE_API_URL || '/api/v1'`), para que `VITE_USE_MOCKS=true` funcione aunque `.env.local` apunte al backend real.

- **Jueces por evento**: el backend añade `app.event_judges`. `GET /judges` y `GET /judges/invitations` aceptan `?event_id=`, y `POST /judges` acepta `event_id`. La pantalla Jueces y las Invitaciones pendientes filtran por el evento abierto; invitar un correo ya existente lo suma al evento. Los mocks MSW emulan la vinculación.

- **Rediseño de la página pública** (decisión de diseño, pedida por el cliente; referencia: `handoff/Resultados Publicos.dc.html`). Se implementan las pantallas 2a (portal), 2d (evento), 2e (comité) y 2c (móvil, con media queries sobre 2d/2e). La 2b era opcional y no se hizo.
  - Paleta y tipografías del handoff (Source Serif 4, IBM Plex Sans y Mono, por Google Fonts en `app/layout.tsx`) en `components/public.module.css`, limitadas a `apps/public`. Los tokens de `@munych/ui` y el panel no cambian.
  - Componentes nuevos: `SiteHeader`, `ShareActions` (Compartir con hoja nativa o copiando el enlace; Descargar PDF imprime la página y despliega todo antes de imprimir), `EventsPortal`, `EventCommittees`, `CommitteeAwards`, `RankingTable`, `CommitteeSwitcher` (menú en escritorio y pastillas en móvil), `PositionMedal`. Se retiraron `AwardsList` y `EventHeader`.
  - `lib/view.ts` resuelve en el servidor los textos (nombre del país por código ISO, fechas en la zona del evento) para que el HTML del servidor y del navegador coincidan. `lib/format.ts` arma las fechas a mano por la misma razón.
  - `lib/data.ts`: `getPublishedDocuments()` sustituye a `getPublishedEvents()`, porque el portal muestra la mejor delegación por comité del evento más reciente.
  - Reglas: un comité sin premios sale como **Pendiente**; sin `show_scores` se oculta la columna Puntaje; sin `show_ranking` no hay ranking ni contador de delegaciones.
  - `lib/mockPublicData.ts` ampliado con cuatro eventos y todos los estados del handoff.

Pendiente de configuración (no es código):

- **Clave `anon`/publishable de Supabase**: falta en `apps/panel/.env.local` (`VITE_SUPABASE_ANON_KEY`) y en `apps/public/.env.local` (`NEXT_PUBLIC_SUPABASE_ANON_KEY`). El `.env` del backend solo tiene la `service_role`, que **nunca** va en el frontend.
- **`REVALIDATE_SECRET`**: está vacío en el backend. Hay que definir el mismo valor en `Munych_Backend/.env` y en `apps/public/.env.local`; si no, la revalidación tras publicar responde 500/401 y `PublishOut.revalidated` vale `false`.

TODO(cliente) resueltos con el backend: **1** (las sesiones tienen `id`: `SessionOut.id`, `JudgeSessionOut.session_id`), **3** (existe `POST /events/{id}/rubrics`; `createRubric` ya está en `endpoints/rubrics.ts`, pero no se ha añadido UI para no tocar el diseño) y **4** (solo existe `export.xlsx`).

---

## Hito 9 — Despliegue en Cloudflare con CDN

Objetivo: que las más de 1000 visitas de la clausura de SD-MUN-2026 se sirvan desde la caché del CDN, sin consultar Supabase en cada visita. El panel se sirve como estático.

**Página pública (`apps/public`)**, desplegada en Workers con OpenNext (`@opennextjs/cloudflare`):

- **Bug: las páginas eran dinámicas.** El build las marcaba como `ƒ (Dynamic)` porque las rutas `[locale]`, `[eventSlug]` y `[committeeSlug]` no tenían `generateStaticParams`. El `revalidate = 3600` no cacheaba nada: cada visita consultaba Supabase. Ahora cada página tiene `generateStaticParams()` que devuelve `[]`, así que salen como `● (SSG)`: se generan en la primera visita y quedan cacheadas.
- `revalidate = false`: las páginas solo se regeneran cuando el backend llama a `/api/revalidate` al publicar o despublicar.
- **Bug: los comités no se revalidaban.** `revalidatePath('/es/<slug>/[committeeSlug]', 'page')` mezclaba un segmento concreto con uno dinámico y no coincidía con ninguna página. Ahora se usa el patrón de la ruta, `'/[locale]/[eventSlug]/[committeeSlug]'`.
- **Bug: un error de Supabase dejaba un 404 en caché.** `lib/data.ts` ahora lanza el error en vez de devolver `null` o `[]`. Si la regeneración falla, el CDN sigue sirviendo la última versión buena.
- `next` subió a `^15.5.28`, la versión mínima que pide OpenNext 1.20.
- Archivos nuevos: `open-next.config.ts` (caché incremental en R2 y tag cache en D1, sin cola porque no hay revalidación por tiempo), `wrangler.jsonc`, `public/_headers` (caché permanente para `/_next/static/*`) y `.dev.vars.example`.
- Scripts: `npm run preview -w @munych/public` (build con OpenNext y servidor local en `:8787`, sin cuenta) y `npm run deploy -w @munych/public`.
- Verificado en local con mocks: primera visita `MISS`, siguientes `HIT`; webhook firmado → `200` y la siguiente visita es `MISS`, después `HIT` (evento, portal y comité); firma mala → `401`.

**Panel (`apps/panel`)**, como static assets de Workers, sin código de servidor: `wrangler.jsonc`, `public/_headers` (caché permanente para `/assets/*`, `noindex` y cabeceras de seguridad) y los scripts `cf:preview` y `deploy`.

**Para el primer deploy** (lo hace quien tenga la cuenta de Cloudflare de Munych):

1. `npx wrangler login`.
2. `npx wrangler r2 bucket create munych-public-cache`.
3. `npx wrangler d1 create munych-public-tags` y copiar el `database_id` en `apps/public/wrangler.jsonc`.
4. `npx wrangler secret put REVALIDATE_SECRET` (en `apps/public`), con el mismo valor que en el backend.
5. Hacer el build con las variables `NEXT_PUBLIC_*` de producción. Se incrustan al compilar, así que hay que volver a desplegar si cambian.
6. Backend: `PUBLIC_SITE_URL` con la URL del worker público y `CORS_ORIGINS` con la URL del panel.

⚠️ **OpenNext incrusta los `.env*` en el worker** (`.open-next/cloudflare/next-env.mjs`, solo del lado del servidor; se comprobó que no llegan a los assets públicos). Para producción, haz el build sin `REVALIDATE_SECRET` en `.env.local`, por ejemplo en CI, y deja que lo ponga `wrangler secret`. OpenNext recomienda compilar en Linux o WSL, porque en Windows avisa que puede fallar.

> **Sustituido por el hito 10** en lo que toca a la página pública: ya no usa OpenNext, ISR ni el webhook.

---

## Hito 10 — Página pública estática en Cloudflare Pages, en español e inglés

**Export estático** (sustituye a OpenNext/ISR del hito 9):

- `next.config.ts` con `output: 'export'` e `images.unoptimized`. El build deja el sitio en `apps/public/out` (ignorado en git).
- Eliminados `app/api/revalidate/`, `open-next.config.ts`, `wrangler.jsonc`, `.dev.vars.example`, `REVALIDATE_SECRET` de `.env.example`, los scripts `cf:build`/`deploy` y la dependencia `@opennextjs/cloudflare`. `npm run preview -w @munych/public` ahora hace el build y lo sirve con `wrangler pages dev out`.
- `generateStaticParams()` genera todas las rutas en el build: los idiomas en `app/[locale]/layout.tsx`, un evento por documento publicado y un comité por cada comité.
- `public/_redirects`: `/` → `/es/` (302). `app/page.tsx` sigue redirigiendo para `next dev`.
- `lib/data.ts` sigue lanzando el error de Supabase: el build falla y Pages mantiene el último despliegue bueno.
- **Actualización tras publicar**: cada cambio necesita un build nuevo. El backend (migración `site_rebuild`, ver su README) agrupa los cambios y llama al deploy hook de Pages 45 s después de la última publicación (máx. 5 min), así que la clausura no lanza un build por comité. Al publicar o despublicar, `ResultsPage` avisa que la página se actualizará en unos 2–3 minutos, o en rojo que falta configurar el hook si `revalidated` es `false`. Solo cambia el texto (mismo `span` que el error, en `var(--muted)`).

**Idiomas (`es`, `en`)**:

- `lib/i18n.ts`: `LOCALES`, `getDictionary(locale)` con todos los textos de la interfaz, y `localizedPath()`. Los componentes reciben `locale` y toman sus textos del diccionario.
- `lib/format.ts` y `lib/view.ts` reciben el idioma: meses y orden de las fechas ("November 11 – 15, 2026"), fecha de publicación (`2026-10-28 · 10:57` en inglés, para evitar la ambigüedad día/mes), nombres de país (`Intl.DisplayNames`) y nombres de premios.
- Los nombres de eventos, comités, sedes y delegaciones de personaje vienen del documento publicado y **no** se traducen.
- `<html lang>` correcto por idioma: el `<html>` pasa de `app/layout.tsx` (que ahora solo devuelve los hijos) a `app/[locale]/layout.tsx`. Título y descripción del sitio por idioma con `generateMetadata`.
- **Decisión de diseño**: selector de idioma (`components/LanguageSwitch.tsx`) en la barra superior del portal y en las cabeceras de evento y comité. Lleva a la misma página en el otro idioma. Reutiliza `ghostButton` (texto "English"/"Español", escritorio) e `iconButton` ("EN"/"ES", móvil), igual que "Compartir"; no hay estilos nuevos.
- **Decisión de diseño**: el 404 es un único `404.html` para todo el sitio y no sabe el idioma, así que muestra el texto en ambos idiomas y un botón a cada portal (`Button` de `@munych/ui`).

**Verificación** (mocks): `next build` genera 30 páginas (2 idiomas × portal, 4 eventos y 8 comités). Con `wrangler pages dev out`: `/` redirige a `/es`, el selector cambia de `/es/sd-mun-2026/cs` a `/en/sd-mun-2026/cs` y la página en inglés muestra textos, países ("United Kingdom"), premios ("Best delegate") y fechas en inglés con `<html lang="en">`. La vista móvil no se comprobó en el navegador.

---

## Hito 11 — Tipos de evento (2026-11-03)

Primer paso del spec «Tipos de evento y votación de delegados»: solo el **tipo** del evento. Votación de delegados/staff, accesos por token y cálculo combinado quedan para después.

- Backend (migración `20261103000100_event_types`): `app.events.event_type` = `judges_only` (por defecto; los eventos existentes no cambian) | `voting`. Qué roles votan y su peso está en `EVENT_TYPES` (`catalog.py`), no programado por tipo. El tipo solo se puede cambiar con el evento en borrador (409 `CONFLICT`).
- Panel: `EventType` en `apiTypes.ts` (`EventDraft.event_type?`, `ApiEvent.event_type`), etiquetas en `lib/statusLabels.ts` (`EVENT_TYPE_LABELS`), mocks (SD-MUN 2026 es `voting`) y la misma regla de borrador en el `PATCH` de MSW.
- **Decisión de diseño**: select "Tipo de evento" en el modal "Nuevo evento" (`EventsPage`), con el `Select` de `@munych/ui` ya usado para "Marca"; sin estilos nuevos.

---

## Hito 12 — Votación por roles y accesos de delegados (2026-11-05)

Resto del spec «Tipos de evento y votación de delegados». Backend: migración `20261105000100_voting`, módulo `voting`, `scoring_engine/roles.py` (ver ADR 0001 del backend, «Tipos de evento y votación», y ADR-005 de la bóveda).

- **Tipos de evento**: `EventType` pasa a `judges_only | mun_regular | national_championship` (el provisional `voting` se migra a `mun_regular`). `EVENT_TYPE_OPTIONS` muestra los pesos de cada tipo en el modal "Nuevo evento" (la tercera opción cae en una segunda fila de la misma rejilla). Mocks: SD-MUN 2026 es `mun_regular`.
- **Roles**: `JudgeCommitteeRole` admite `staff`; `chair`/`moderator` = Mesa. Nuevo `VoterRole` y etiquetas en `lib/statusLabels.ts` (`VOTER_ROLE_LABELS`, `committeeRoleOptions`, `delegatesVote`).
- **Ranking**: `RankingEntry.role_scores` y `RankingResponse.event_type`/`role_weights`. El mock de MSW calcula igual que el backend (por rol, suma ponderada, un rol sin votos reparte su peso).
- **Capa de datos**: `endpoints/voting.ts` (`listVoterTokens`, `generateVoterTokens`, `revokeVoterTokens`, `getBallot`, `submitVotes`; la boleta usa su propio `fetch` con el token del delegado, no la sesión de Supabase), hooks `useVoterTokens`/`useGenerateVoterTokens`/`useRevokeVoterTokens` y claves `voterTokens`/`ballot`.
- **Decisión de diseño**: pantalla nueva **Votación** (`VotingAccessPage`, `#/admin/eventos/:id/votacion`), solo en eventos con votación: lista de delegados con estado del acceso, último uso y votos; generar los faltantes, regenerar o revocar uno; descargar los recién generados como **CSV** y como **hoja HTML con QR** para imprimir (`lib/voterSheets.ts`; los tokens solo llegan una vez). Componentes existentes: `AdminShared`, `Table`, `StatusBadge`, `Button`, `Select`, `ConfirmDialog`.
- **Decisión de diseño**: enlace **Votación** (icono `QrCode` de lucide, ya instalado) en `AdminSidebar` para eventos con votación, y "Jueces" se rotula **Evaluadores** en esos eventos.
- **Decisión de diseño**: en **Jueces**, select "Rol en sus comités" (Juez / Mesa Directiva / Staff según el tipo de evento) con el `Select` existente; la columna "Comités" muestra el rol. En `judges_only` no aparece y las asignaciones no se reescriben.
- **Decisión de diseño**: en **Resultados**, al expandir una delegación, bloque "Desglose por rol" (peso, barra y nota de cada rol) con la misma rejilla y `ProgressBar` del desglose por criterio. Solo aparece con más de un rol.
- **Decisión de diseño**: **boleta del delegado** (`pages/vote/VotePage.tsx`, rutas públicas `#/votar/:token` y `#/votar`). El token se guarda en `localStorage` para todo el evento y se quita de la URL; sin token, pide el código. Lista de delegaciones (todas menos la propia) → sliders por criterio (`CriterionSlider`) → "Guardar y seguir". Sin sesión abierta muestra "Esperando la siguiente sesión" y consulta cada 20 s. Reutiliza los estilos móviles del juez (`CommitteePage.module.css`, `ScoringForm.module.css`, `JudgeLayout.module.css`); sin CSS nuevo.

`TODO(cliente)` de este hito (valores por defecto en uso): SD-MUN-2026 es MUN regular; voto por delegado (QR personal), no por delegación; los delegados usan la rúbrica del comité y votan por sesión; un rol sin votos reparte su peso; sin mitigación de sesgo entre pares. _(La rúbrica y el voto por sesión de los delegados se reemplazan en el hito 13.)_

---

## Hito 13 — Voto de delegados por premios (2026-11-06)

Los delegados **ya no usan la rúbrica**. Votan **una sola vez por comité, al final**, eligiendo Mejor delegado (3 puntos), Delegado distinguido (2) y Mención de honor (1): tres delegaciones distintas, ninguna la propia (si hay menos de 3 candidatas, solo los primeros N premios). Nota del rol delegados = puntos recibidos ÷ (3 × votantes que enviaron) × 100; sigue pesando 50 % (MUN regular) / 25 % (Campeonato), y sin votantes es `null` (su peso se reparte). El admin abre y cierra la votación por comité. Backend: migración `20261106000100_peer_award_votes` (columnas `peer_vote_opens_at`/`peer_vote_closes_at` en `app.committees`, tabla `app.peer_votes`; **borra** `app.delegate_votes`), `scoring_engine/peer_awards.py` y el módulo `voting` reescrito. Contrato en `routes.md` (3.7 bis y modelos).

- **Capa de datos**: `apiTypes.ts` (`PeerAwardType`, `PeerVoteStatus`, `PeerVoteWindow`, `PeerVoteWindowIn`, `CommitteePeerVote`, `BallotAward`, `BallotPick` y el `Ballot` nuevo; se quitó `BallotVote`). `endpoints/voting.ts`: `submitPeerVote` (`POST /vote/ballot`, sustituye a `submitVotes`), `listPeerVoteWindows`, `openPeerVote`, `closePeerVote`; hooks `usePeerVoteWindows`, `useOpenPeerVote`, `useClosePeerVote` y clave `peerVoteWindows`.
- **Mocks (MSW)**: `peerVotes` sustituye a `delegateVotes`; ventana por comité en memoria; `GET/POST /vote/ballot`, `GET /events/:id/peer-vote`, `PUT /committees/:id/peer-vote`, `POST /committees/:id/peer-vote/close` con los mismos códigos de error del backend; `computeRanking` calcula el rol `delegate` con 3/2/1.
- **Decisión de diseño**: en **Votación** (`VotingAccessPage`), sección «Voto entre pares por comité» (abrir/reabrir/cerrar, «X de Y ya votaron») y columna «Votó» Sí/No, con los componentes existentes.
- **Decisión de diseño**: la **boleta del delegado** (`pages/vote/VotePage.tsx` + `VotePage.module.css`, nuevo) se rehízo según el handoff `handoff-votacion-delegados/` (Apartado 3) y **deja de reutilizar** los estilos del juez. Los tokens de color y tipografía del handoff están definidos como variables locales del CSS Module; `@munych/ui` no se tocó. Se añadieron Source Serif 4 (400/600/700) e IBM Plex Mono 600 al enlace de Google Fonts de `apps/panel/index.html`. Pantallas:
  - Sin token o token inválido (401) → entrada del código, en el estilo oscuro de 3e.
  - `not_scheduled`/`scheduled` → **3e** «La votación aún no abre»: cuenta regresiva HH/MIN/SEG si hay `opens_at` (al llegar a cero vuelve a consultar en vez de mostrar tiempo negativo), rango de apertura/cierre y barra segmentada con `sessions_closed` de `sessions_total`.
  - `open` → **3a** boleta por pasos «VOTO n DE N · premio», un paso por premio: buscador (sin mayúsculas ni acentos, con estado «sin resultados»), lista alfabética con la propia delegación deshabilitada en su posición («Tu delegación») y las ya elegidas en otro premio deshabilitadas con el nombre de ese premio; footer fijo «Seleccionado: X» + «Siguiente» / «Revisar voto» (deshabilitado sin selección); «‹ Anterior» para volver un paso; badge «Cierra HH:MM» si hay `closes_at`.
  - **3c** bottom sheet: resumen de los premios + Comité/Vota/Peso, aviso «Una vez enviado no se puede cambiar», «Enviar voto» (ink, con «Enviando…» y error con «Reintentar»), «Volver y cambiar»; tocar el fondo o Esc = volver.
  - Con `picks` → **3d** «Voto registrado» con comprobante (`receipt`, `submitted_at`) y lo que votó. Tiene prioridad sobre «cerrada» (nunca se muestra 3f a quien votó).
  - `closed` (o evento cerrado) sin voto → **3f** «La votación ya cerró».
  - Escritorio (≥ 960 px) → **3g**: barra superior, rejilla de 3 columnas («Mostrar las N ▾» a partir de 12) y panel «TUS VOTOS» con los pasos (se puede volver a uno ya hecho) y el CTA.
  - Se mantiene la lógica del token (`localStorage` `munych.voter-token`, se quita de la URL) y el sondeo cada 20 s.
- Diferencias con el handoff: no se portan la home de sesiones (3h) ni la boleta de resoluciones (3b): el voto de resoluciones no aplica. El peso que se muestra es el del rol delegados completo, así que el texto dice «El voto de los delegados suma X % al puntaje final» en vez de «Tu voto suma X %». Sin el CTA «Ver resultados públicos» de 3f porque el panel no conoce la URL de la página pública. Los chips de país son el código ISO de 2 letras (iniciales para personajes), sin banderas.

- **Abrir una sesión abre el voto entre pares** (petición del cliente, 2026-11-06): lo hace el backend al abrir la sesión (`VotingService.open_with_session`), así que funciona desde Comités y desde Sesiones. El panel refresca la ventana (`['peer-vote']`) tras abrir sesiones; MSW hace lo mismo. Textos de la boleta (3e) y de Votación ajustados.
- **Sesiones** (petición del cliente, 2026-11-06): el select de arriba filtra por **comité** («Todos los comités» o uno) en vez de elegir el número de sesión; se quitaron «Abrir en todos» / «Cerrar en todos», y cada sesión conserva su Abrir/Cerrar. El subtítulo cuenta las sesiones abiertas de lo que se ve.

`TODO(cliente)` de este hito (13): confirmar que no hay votos por rúbrica reales en `app.delegate_votes` antes de aplicar la migración (se borran). _(La URL de la página pública y el «Salir» se resolvieron en el hito 14.)_

---

## Hito 14 — Lo que faltaba de la bóveda (2026-11-07)

Comparación con la bóveda de Obsidian (`Documents\Proyectos`): todo lo programable menos los PDF de exportación (esperan el diseño de Héctor). La rúbrica por rol se descartó: basta con una rúbrica por comité, que ya existía. Backend: migraciones `20261107000100_voter_short_codes` y `20261107000200_manual_tiebreak`.

- **Nombres de premios unificados** (los de la bóveda): Mejor delegado · Delegado distinguido · Mención honorífica · Mención verbal. Antes convivían «destacado», «sobresaliente», «distinguido» y «Mención de honor». Backend (`AWARD_LABELS`, y la boleta usa los mismos), panel, mocks y página pública (es; en sin cambios).
- **Código corto de respaldo** para entrar a votar si la cámara no lee el QR: `GeneratedVoterToken.code` (p. ej. `K7M2Q-9XH4T`). Va impreso debajo de cada QR (con la dirección donde escribirlo) y en el CSV de accesos; la pantalla «Entra a tu boleta» lo acepta (o el enlace completo pegado). La hoja de QR y el CSV muestran el nombre del país en vez del código ISO. Los accesos generados antes no tienen código: hay que regenerarlos.
- **Boleta**: botón **Salir** (patrón de 3h) en todas las pantallas con boleta cargada: olvida el acceso en ese teléfono (el QR o el código siguen sirviendo). **«Ver resultados públicos»** en 3f, si se configura `VITE_PUBLIC_RESULTS_URL` (enlaza a `<url>/es/<evento>`; `BallotOut.event_slug` nuevo). Sin la variable el botón no aparece.
- **Exportar**: las opciones de la pantalla ya llegan al backend (comités elegidos; nota; desglose = hoja Detalle; comentarios; nombres de jueces o «Juez 1, 2…»). **CSV real** (`export.csv`): ranking plano de los comités elegidos, con nota por rol si el evento la tiene. PDF sigue descargando el XLSX, con aviso.
- **Decisión de diseño — desempate manual** en Resultados: los empates que quedan tras el criterio de mayor peso los decide el admin (reunión del 2026-10-28). Al expandir una fila empatada, bloque «Desempate» con «Gana el desempate»; las ya desempatadas llevan la etiqueta «DESEMPATE MANUAL» y botones «Subir», «Bajar» y «Deshacer desempate». Solo con `Button` y `StatusBadge` existentes. Hay que desempatar **antes de cerrar** el evento (luego el ranking queda fijo).
- **Decisión de diseño — ranking general** en la página del evento (`apps/public`), debajo de los comités: todas las delegaciones del evento por nota, con su comité, reutilizando `RankingTable` (columna «Comité — delegado(s)», buscador también por comité). Solo si la publicación tiene «Mostrar ranking»; puntajes solo con «Mostrar puntajes». Textos en es/en en `lib/i18n.ts`. Las notas de comités con rúbricas distintas se comparan tal cual (todas son 0–100).
- **Sesiones**: el select de arriba filtra por comité (ver hito 13).

`TODO(cliente)` de este hito: URL definitiva de la página pública para `VITE_PUBLIC_RESULTS_URL` (en `.env.production`); ¿el ranking general debe mezclar comités con rúbricas distintas o solo mostrarse por tipo de comité?

---

## Entrega final

### Pantallas conectadas

**Administración** (`apps/panel/src/pages/admin/`): Eventos (CRUD), Panel general (KPIs + progreso por comité + cierre de evento), Comités (CRUD + sesiones), Delegaciones (CRUD; se retiró la carga masiva por CSV del panel), Jueces (invitar + asignar por comité), Criterios (rúbrica: escala, pesos, descriptores por nivel), Resultados (ranking + premios + publicación + vista previa pública), Exportar (descarga real del XLSX).

**Jueces** (`apps/panel/src/pages/judge/`): Mis comités, Comité (lista de delegados + calificación por sesión con guardado por lotes), Mi progreso (ranking parcial), Mi perfil.

**Autenticación**: Login (contraseña admin + enlace mágico jueces), guards por rol, logout (admin y jueces).

**Página pública** (`apps/public/`): Inicio (eventos publicados), Evento (premios por comité), Comité (premios + ranking si está habilitado), 404, `noindex`, en español e inglés (export estático, hito 10).

### Decisiones de diseño (pantallas o controles nuevos, siempre con componentes ya existentes)

- Toggle de enlace mágico en Login (reutilizando/limpiando un botón duplicado que ya existía sin función).
- Botón "Cerrar sesión" en `AdminSidebar` (no existía ningún control de logout en el panel de admin).
- Gestión de **sesiones** (abrir/cerrar) dentro de `CommitteesPage` — no existía ninguna pantalla de sesiones.
- Página **Sesiones** (`SessionsPage`, `#/admin/eventos/:id/sesiones`): todas las sesiones del evento por comité, con estado, avance (calificaciones hechas/esperadas, se refresca cada 15 s), último cambio y abrir/cerrar, con un filtro por comité (hasta el hito 13 había, en su lugar, abrir o cerrar la sesión N en todos los comités a la vez). Solo usa componentes y estilos existentes (`AdminShared`, `Table`, `StatusBadge`, `ProgressBar`, `ConfirmDialog`).
- Se retiró el panel de **Carga masiva** (CSV) de Delegaciones a petición del cliente; el endpoint `POST .../delegations/import` y el hook `useImportDelegations` siguen disponibles.
- Gestión de **premios** y **publicación** (ajustes, vista previa, publicar/despublicar) dentro de `ResultsPage` — ninguna de las dos existía.
- Botón **Cerrar evento** en el Panel general — no existía.
- Select **Tipo de evento** en el modal "Nuevo evento" (hito 11), con el mismo `Select` que "Marca".
- Pantalla **Votación** (accesos de delegados con QR/CSV), **boleta pública del delegado** (`#/votar`), select de **rol** en Jueces y **desglose por rol** en Resultados (hito 12).
- **Boleta del delegado por premios** con estilos propios del handoff de votación (`VotePage.module.css`) y control de apertura/cierre del voto entre pares en Votación (hito 13).
- `CriterionSlider` (`@munych/ui`) reparametrizado a la escala de la rúbrica con descriptor de nivel, en vez de crear un componente nuevo.
- Se retiró "+ Nuevo set de rúbrica" en Criterios (el contrato no tiene endpoint para crear rúbricas adicionales) y "Marcar como completo" en la calificación del juez (el contrato no tiene un flag de completado independiente de tener todos los criterios calificados).

### `TODO(cliente)` pendientes

1. **Sesiones**: ¿el backend expone un `id` de sesión (UUID) además del `number`, o hay que resolver `/judge/sessions/{session_id}/scores` de otra forma? (hito 2, `apiTypes.ts`)
2. **Eventos**: ¿vale la pena un endpoint de agregados (delegaciones/jueces por evento) para no hacer N+1 en `EventsPage`? (hito 4)
3. **Rúbricas**: ¿se podrán crear rúbricas adicionales por evento, o solo existe la que se genera por defecto al crear el evento? (hito 4, `CriteriaPage`)
4. **Exportación**: ¿PDF y CSV están en el alcance, o el backend solo va a generar XLSX? (hito 4, `ExportPage`)
5. **Calificación**: ¿hace falta un "completado" manual del juez además del automático (todos los criterios calificados)? (hito 5, `ScoringForm`)
6. **Perfil del juez**: `ProfilePage` mostraba `role`/`since` que nunca existieron en el modelo (bug del prototipo); ahora muestra el rol por comité. Confirmar si falta algún dato de perfil real.

### Cómo ejecutar el proyecto

**Con backend y Supabase reales** (por defecto): backend en `http://127.0.0.1:8000`, y `.env.local` de cada app a partir de su `.env.example` (`VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
```
npm install
npm run dev -w @munych/panel   # http://localhost:5173
npm run dev -w @munych/public  # http://localhost:3000
```

**Sin backend**: `VITE_USE_MOCKS=true` (panel: MSW + auth simulada) y `NEXT_PUBLIC_USE_MOCKS=true` (pública: `lib/mockPublicData.ts`).

### Comparación de capturas

Regresión visual verificada manualmente en el navegador en cada hito (no con Playwright, que no estaba instalado en el proyecto): Login, Eventos, Comités, Delegaciones, Jueces, Criterios, Resultados, Exportar, y las 4 pantallas de jueces se compararon antes/después de conectar los datos. Único cambio visual en todos los casos: los datos mostrados (de mock local a mock MSW/Supabase) y las adiciones documentadas arriba como "decisión de diseño". Sin errores de consola en ninguna pantalla verificada.

---

## `TODO(cliente)` acumulados

_(se va llenando conforme aparecen preguntas sin resolver en el contrato — ver sección 10 del prompt para los valores por defecto usados mientras tanto)_
