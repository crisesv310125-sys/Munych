# MUNYCH — monorepo

Sistema de calificaciones para conferencias Modelo de Naciones Unidas (MUNYCH Association / GRAND International).

## Estructura

- `apps/panel/` — panel de administración y jueces (Vite + React 19 + react-router-dom, CSS Modules). `npm run dev -w @munych/panel`.
- `apps/public/` — página pública de resultados (Next.js App Router, generación estática + revalidación bajo demanda). Lee `public.public_results` con Supabase (clave `anon`); con `NEXT_PUBLIC_USE_MOCKS=true` usa `apps/public/lib/mockPublicData.ts`. `npm run dev -w @munych/public`.
- `packages/ui/` — componentes visuales y tokens de estilo compartidos (`@munych/ui`). Se importan como `@munych/ui/components/<Nombre>` y `@munych/ui/styles/<archivo>.css`. Lo consumen ambas apps.

## Regla de oro: el diseño no se toca

Este repo se está conectando a datos reales siguiendo `prompt-frontend-munych.md`. **No se modifican** estilos, CSS Modules, maquetación, ni se añaden librerías de UI nuevas, salvo que una pantalla no exista y se documente como "decisión de diseño". Solo cambia de dónde vienen los datos. Antes de tocar una pantalla, revisa ese archivo (sección 1).

## Comandos

Desde la raíz del monorepo:

```
npm install                 # instala todo el workspace
npm run dev -w @munych/panel
npm run lint -w @munych/panel
npm run build -w @munych/panel
npm run dev -w @munych/public
npm run build -w @munych/public
```

## Datos y mocks

Ambas apps hablan con el backend real por defecto. Rutas y modelos: `routes.md` (raíz); en local el backend corre en `http://127.0.0.1:8000/api/v1` (Swagger en `/api/v1/docs`). Configuración en `.env.local` de cada app (ver su `.env.example`).

- `apps/panel`: API real en `VITE_API_URL` y autenticación con Supabase (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Con `VITE_USE_MOCKS=true` (solo en dev), MSW (`src/mocks/`) intercepta `/api/v1/*` y `data-access/authService.ts` simula la sesión (`src/mocks/authMock.ts`).
- `apps/public`: lee `public.public_results` de Supabase con la clave `anon`. Con `NEXT_PUBLIC_USE_MOCKS=true` usa `lib/mockPublicData.ts`. `REVALIDATE_SECRET` debe ser igual al del backend.

La capa de datos del panel (`apps/panel/src/data-access/`) está escrita a mano y verificada contra `/api/v1/openapi.json`; si cambia el contrato, actualizar `apiTypes.ts` o sustituirla por un cliente generado con Orval (`// TODO` en `apiClient.ts`).

Detalle completo de qué se conectó en cada hito, decisiones de diseño y `TODO(cliente)` pendientes: `docs/CAMBIOS-FRONTEND.md`.
