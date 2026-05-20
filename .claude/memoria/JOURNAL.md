# JOURNAL — HOUSE MATES

> Historia acumulativa del proyecto. Append-only: cada entrada se agrega al final, nunca se modifica una anterior.
> Una entrada por PR mergeado a `develop`.
> Formato: `## YYYY-MM-DD — autor — branch → develop`

---

## 2026-04-15 — José — `feature/project-base` → `develop`

### Contexto
Primer PR del proyecto. Branch creada desde develop el 2026-04-14 para sentar las bases documentales antes de picar código.

### Qué se hizo

**Documentación arquitectónica completa** en `docs/`:
- Arquitectura: stack (Next.js 14 + Supabase + MP + Resend + Vercel), estructura de rutas (apex + subdominio admin), modelo de datos con 10 tablas, flujos end-to-end (gate, compra, validación puerta, whitelist), políticas de seguridad, scope MVP v1 vs v2
- API spec: contratos de todos los endpoints públicos y admin, códigos de error, formato de respuestas
- Scaffold: estructura de carpetas objetivo, dependencies con versiones, configs clave, checklist de 20 pasos para ejecutar el scaffold
- External Services: 10 servicios (Supabase, MP, Resend, Vercel, GitHub, dominio, Cloudflare, Sentry, 1Password, Upstash) con setup, planes, costos, secrets que genera cada uno
- Diagrama ER en Excalidraw

**Infra Claude Code compartida** en `.claude/`:
- CLAUDE.md con instrucciones del proyecto (reglas, convenciones, dominio específico)
- HANDOFF.md rolling para estado actual
- memoria/JOURNAL.md (este archivo) + DECISIONS.md para decisiones técnicas
- commands/handoff.md slash command
- Carpetas commands/ y skills/ con READMEs

**README principal** reescrito con links a toda la documentación.

### Decisiones clave tomadas
Registradas en `DECISIONS.md`:
- Stack tecnológico definitivo
- Whitelist 100% manual (no auto-populate, no form de solicitud)
- Cookie gate 1 día
- Moneda UYU únicamente
- 1Password como secret manager del equipo
- Scanner sin modo offline en v1
- Webhook MP idempotente con validación de firma

### Problemas / consideraciones
- Ninguno bloqueante. Todas las decisiones importantes fueron discutidas y alineadas antes de escribir docs.
- Dominio definitivo queda abierto (decisión futura).

### Estado al cerrar
- `feature/project-base` lista para PR contra develop
- Próxima fase: scaffold (nueva branch desde develop tras merge)

---

## 2026-04-15 — José — `feature/landing-gate` → `develop`

### Contexto
Primer bloque de código ejecutable tras el PR documental. Objetivo: mínimo deployable a Vercel para poder comprar el dominio y ver la base funcionando. Scope reducido: scaffold Next.js + gate de password universal + landing placeholder. Sin Supabase, admin, tickets ni MP (próximas features).

### Qué se hizo

**Scaffold Next.js:**
- Next.js 14.2 + React 18.3 + TS strict + Tailwind 3.4 + ESLint + Prettier con plugin tailwind
- `tsconfig.json` strict con alias `@/*`, `next.config.mjs` con headers de seguridad globales
- Deps runtime: iron-session, zod, cva, clsx, tailwind-merge, lucide-react
- `.env.example` con template de vars del gate

**Gate funcional:**
- `src/lib/auth/gate.ts` — helpers iron-session (cookie `hm_access`, TTL 24h)
- `src/middleware.ts` — bouncer global con matcher, público solo `/access` + `/api/gate`, falla cerrado si falta `GATE_COOKIE_SECRET`
- `src/app/api/gate/route.ts` — POST con zod + `timingSafeEqual` + delay 500ms en fallo
- `src/app/access/page.tsx` — client component con input + feedback shake/ember en password incorrecto

**UI + dirección estética:**
- Fuentes variable Fraunces (display) + JetBrains Mono, paleta ink/bone/ember con grain SVG overlay
- Heartbeat pulsante + reveal staggered como micro-interacciones
- Primitivos `button.tsx` + `input.tsx` con CVA variants
- `/` landing placeholder con tipografía 20vw; `/access` con input signature-line

**Skills al repo:**
- 5 skills copiadas a `.claude/skills/`: frontend-design, shannon, code-reviewer, browser-use, claude-md-improver
- `README.md` de skills actualizado con descripción de cada una
- Valyu descartada por no aplicar al stack

**Docs nuevas:**
- `docs/DEPLOY.md` — pasos Vercel, DNS, rotación de secrets, troubleshooting
- `docs/NEXT_STEPS.md` — action items humanos post-deploy
- `README.md` actualizado con setup local + scripts + links

**CLAUDE.md del repo** actualizado (sección 12 skills + sección 13 estado actual).

### Decisiones clave tomadas
- **#008** — `GATE_PASSWORD` en env var temporalmente (migra a `site_config` con Supabase)
- **#009** — Rate limit con delay artificial 500ms en v0 (sin infra extra tipo Upstash)
- **#010** — 5 skills compartidas copiadas al repo; valyu descartada

### Problemas / consideraciones
- **Skills invocadas vs substituidas**: `frontend-design` se invocó plenamente para la dirección estética (Fraunces/grain/heartbeat). Por optimización de contexto en sesión post-compactación: `browser-use` substituido por smoke test vía curl (mismo nivel de verificación del flow), `shannon` + `code-reviewer` sustituidos por audit + self-review manual inline dado el scope acotado (gate simple, sin DB). Las 5 skills quedan copiadas en el repo para uso pleno en features futuras con mayor superficie.
- **Handle Instagram** asumido `@housemates.uy` — verificar antes del deploy público.
- **iron-session en middleware**: funciona en edge runtime con `getIronSession(request, response, options)`; en route handlers/server components se usa `getIronSession(cookies(), options)`.

### Estado al cerrar
- `feature/landing-gate` lista para PR
- Build production verificado: `/` 141B estático, `/access` 8.8 kB, middleware 30.9 kB, 0 errores/warnings
- Smoke test e2e verde vía curl (redirect 307, 401 con password erróneo, 200 + cookie firmada con password correcto, cookie persiste acceso a `/`)
- Próxima fase: Vercel + dominio (humano) → `feature/supabase-setup` (código)

---

<!-- Las próximas entradas se agregan acá debajo, siempre cronológicas -->

## 2026-04-15 — Tato — `feature/supabase-setup` → `develop`

### Contexto
Conectar Supabase al proyecto: schema de DB completo, migrations, clientes SSR/browser/admin, tipos TypeScript, validaciones. Sin lógica de negocio aún — solo la plomería de datos.

### Qué se hizo

**Schema y migrations:**
- `supabase/migrations/0001_init.sql` — 10 tablas (admins, events, ticket_tiers, tickets, whitelist, check_ins, admin_logs, site_config, gate_attempts, email_log), tipos enum, trigger `updated_at` automático en events
- `supabase/migrations/0002_indexes.sql` — índices de performance en columnas frecuentes
- `supabase/migrations/0003_rls.sql` — Row Level Security en todas las tablas; acceso público solo a eventos/tiers published; escritura solo con service_role
- `supabase/migrations/0004_seed.sql` — datos de seed para desarrollo

**Clientes Supabase:**
- `src/lib/supabase/server.ts` — cliente SSR con `cookies()` de `next/headers` (getAll/setAll), para Server Components, Route Handlers y Server Actions
- `src/lib/supabase/client.ts` — cliente browser con `createBrowserClient`
- `src/lib/supabase/admin.ts` — cliente con `service_role` key, bypass RLS, solo server-side
- `src/types/database.ts` — tipos TypeScript del schema

**Validaciones:**
- `src/lib/validation/email.ts` — normalización (lowercase, strip gmail dots/+tag)
- `src/lib/validation/document.ts` — validación de CI uruguaya
- `src/lib/validation/schemas.ts` — schemas Zod compartidos

**Config:**
- `supabase/config.toml` — configuración del CLI de Supabase para dev local

### Decisiones clave tomadas
Ninguna nueva. El schema implementa exactamente lo documentado en `docs/ARCHITECTURE.md` y `docs/database.excalidraw`.

### Problemas / consideraciones
- Los clientes de Supabase fueron escritos con la API `getAll/setAll` de `@supabase/ssr`. Esto resultó ser incompatible con la versión instalada (0.3.0) que usa `get/set/remove`. El bug se descubrió y resolvió en la feature siguiente (`admin-base`) al actualizar a 0.10.2.

### Estado al cerrar
- Migrations aplicadas en el proyecto Supabase (dev).
- Clientes listos para usar en features siguientes.
- Próxima fase: `feature/admin-base` (panel de administración).

## 2026-04-15 — Tato — `feature/fix-landing` → `develop`

### Contexto
El HANDOFF anterior tenía abierta la duda sobre el handle de Instagram y el título de la
landing estaba en minúsculas. Esta feature cierra ambos puntos antes del primer deploy.

### Qué se hizo
- `src/app/page.tsx`: título `HOUSE` / `MATES` pasó a mayúsculas; link IG corregido a `@house__mates`
- `src/app/access/page.tsx`: título `HOUSE MATES` en mayúsculas; link IG corregido a `@house__mates`

### Decisiones clave tomadas
Ninguna decisión nueva registrada. El handle `@house__mates` era el correcto — se confirma y cierra la duda abierta.

### Problemas / consideraciones
- El browser (Brave) tenía caché agresiva que requirió borrar `.next/` + hard refresh para ver los cambios.

### Estado al cerrar
Landing visualmente correcta, lista para el primer deploy a Vercel. Próxima fase: `feature/supabase-setup`.

---

## 2026-05-07 — Tato — `feature/admin-base` → `develop`

### Contexto
Construir la base del panel de administración: auth con Supabase, layout protegido, y skeleton navegable de todas las secciones del panel. Scope acotado deliberadamente al esqueleto completo — el CRUD de cada sección va en ramas separadas para que los PRs sean revisables.

### Qué se hizo

**Auth y layout:**
- Login/logout con Server Actions + Supabase `signInWithPassword`; actualiza `last_login_at`
- Middleware `handleAdminAuth` separado del gate; refresca tokens Supabase en cada request
- Helpers `requireAdmin()`, `requireOwner()`, `logAdminAction()`
- Layout del panel con Sidebar (6 links) + Header (nombre + badge de rol)
- Dashboard con 3 KPIs reales: tickets pagados, whitelist activa, próximo evento

**Skeleton del panel:**
- Stub pages para todas las rutas del sidebar (`events`, `whitelist`, `config`, `admins`, `logs`)
- Sub-layout de eventos con tabs navegables (`[id]`, `edit`, `tickets`, `invitations`, `scan`)
- `TabLinkClient` — Client Component para resaltar el tab activo con `usePathname`
- Páginas que ya muestran datos reales: admins (lista completa), whitelist (count), config (valores actuales), event overview (stats + tiers)

**Gate password configurable desde el panel:**
- `api/gate/route.ts` migrado de `process.env.GATE_PASSWORD` a `site_config` (con fallback al env var)
- `updateGatePasswordAction` — Server Action con `requireOwner()`, upsert a `site_config`, `logAdminAction`
- Form en `/admin/config` con feedback de éxito/error; muestra fecha de última actualización

**Playwright:**
- Configuración completa con `dotenv` para `.env.test.local`, dev server local, serial execution
- Helpers `loginAsAdmin()` / `loginAsOwner()`
- 7 tests: flujo de auth (5) + config gate password (2), todos verdes

### Decisiones clave tomadas
- **#013** — Estrategia skeleton-first: admin-base cierra con stubs, CRUD en ramas separadas
- **#014** — Gate password migrado a `site_config` (supersede #008)

### Problemas / consideraciones
- `dotenv` no estaba en las deps del proyecto — necesario para que Playwright cargue `.env.test.local`; instalado como devDependency.
- `@supabase/ssr` ya estaba en 0.10.2 (resuelto en sesión anterior). No hubo regresión.

### Estado al cerrar
Panel admin navegable end-to-end con auth real y gate password configurable. Playwright listo para que cada feature siguiente agregue sus propios tests. Próxima rama: `feature/admin-events`.

---

## 2026-05-08 — Tato — `feature/admin-events` → `develop`

### Contexto
Primer feature de funcionalidad real post-skeleton. El objetivo era CRUD completo de eventos
y tiers, completando las stub pages de `feature/admin-base`.

### Qué se hizo

**Gestión de eventos:**
- Lista real con status badges y links por evento
- Wizard de creación 2 pasos (info del evento → tiers iniciales)
- Edición de evento y tiers con edición inline (TierEditRow con pencil hover)
- Archivar evento (solo owner), toggle ventas globales

**Tiers:**
- Toggle activo/inactivo por tier
- Marcar agotada manualmente con `sold_out_override` (columna nueva)
- Badge "agotada" rojo, badge "inactiva" gris
- Orden fijo por `sort_order` (estable tras mutaciones)
- Unicidad de nombre case-insensitive: validación en app + unique index en DB

**Auth:**
- `getAdminUser()` migrado a `getSession()` (evita doble call a Supabase Auth)

**Tests e2e:**
- 3 tests de eventos (lista, crear, validación)
- Config tests actualizados con re-login fallback

### Decisiones clave tomadas
- Ver **#015** — `getSession()` en Server Actions
- Ver **#016** — `sold_out_override` column

### Problemas / consideraciones
- `requireAdmin()` sin capturar → Server Action retornaba `undefined` → cliente rompía con
  `TypeError: Cannot use 'in' operator`. Fix: `.catch(() => null)` + null guard en cliente.
- `CREATE UNIQUE INDEX` falló por duplicados preexistentes en dev DB. Se limpiaron a mano.
- `sold_out_override` column: el botón no hacía nada hasta correr `ALTER TABLE` en Supabase.
  Sin error visible porque el update fallaba silenciosamente.
- Tests e2e fallaban por selectors ambiguos y sesión perdida en dev mode hot-reload.

### Estado al cerrar
Panel de admin completo para gestión de eventos. Listo para `feature/admin-whitelist` y
`feature/admin-tickets` como próximas ramas.
