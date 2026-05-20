# HANDOFF — HOUSE MATES

> Estado actual del proyecto. Este archivo se reescribe en cada PR que mergea a `develop`.
> Última actualización: 2026-05-08 por Tato (branch `feature/admin-events`, PR pendiente)

---

## Dónde estamos

**Fase:** Diseño + docs ✅ → Scaffold + gate ✅ → Admin base ✅ → Admin events ✅ (PR pendiente)

`feature/admin-events` está lista para PR a `develop`. El panel tiene gestión completa de
eventos: CRUD con wizard 2 pasos, tiers con edición inline, toggle activo/agotado manual,
archivar, toggle ventas. Tests e2e verdes.

---

## Branch activa

- `feature/admin-events` — PR pendiente contra `develop`

---

## Qué está hecho

### Feature `admin-events` (esta PR)

**Lista y creación de eventos:**
- `src/app/admin/(panel)/events/page.tsx` — lista real con status badge y links
- `src/app/admin/(panel)/events/new/page.tsx` — wizard 2 pasos: info del evento → tiers iniciales
- `src/app/admin/(panel)/events/new/actions.ts` — `createEventAction`: crea evento + tiers,
  valida unicidad de nombre (case-insensitive), redirige post-creación

**Overview de evento:**
- `src/app/admin/(panel)/events/[id]/page.tsx` — stats (tickets vendidos, fecha, estado),
  tabla de tiers con badges "inactiva"/"agotada", acciones toggle por tier, toggle ventas,
  archivar (solo owner). Tiers ordenados por `sort_order` (estable tras mutaciones).

**Edición de evento y tiers:**
- `src/app/admin/(panel)/events/[id]/edit/page.tsx` — carga evento + tiers por sort_order
- `src/app/admin/(panel)/events/[id]/edit/event-edit-form.tsx` — edición inline de tiers
  existentes (TierEditRow con pencil hover), agregar tiers nuevos, editar campos del evento
- `src/app/admin/(panel)/events/[id]/actions.ts` — `updateEventAction`, `updateTierAction`,
  `toggleTierActiveAction`, `toggleTierSoldOutAction`, `toggleSalesAction`, `archiveEventAction`

**Validaciones y DB:**
- Unicidad de nombre de tier (case-insensitive): app + unique index
  `ticket_tiers_event_name_unique` sobre `(event_id, lower(name))`
- `sold_out_override boolean` en `ticket_tiers` para marcar agotado manualmente (ver #016)

**Schemas y componentes:**
- `src/components/admin/events/status-badge.tsx` — badge draft/published/archived
- `src/lib/validation/schemas.ts` — `eventSchema`, `tierSchema`, `tiersSchema`,
  `tierEditSchema`, `TierEditInput`

**Auth:**
- `src/lib/auth/admin.ts` — `getAdminUser()` usa `getSession()` en vez de `getUser()`
  para evitar doble call a Supabase Auth por request (ver #015)

**Tests e2e:**
- `tests/e2e/admin/events.spec.ts` — 3 tests: lista carga, crear evento con tier,
  validación campos vacíos
- `tests/e2e/admin/config.spec.ts` — actualizados con re-login fallback y selector específico

### Features previas mergeadas

- **admin-base:** auth, layout, sidebar, dashboard KPIs, gate password desde panel, Playwright
- **supabase-setup, landing-gate, fix-landing, project-base** — ver JOURNAL.md

---

## Qué está pendiente (próximas ramas)

| Rama | Contenido |
|------|-----------|
| `feature/admin-whitelist` | Bulk add, búsqueda, ban, edición inline |
| `feature/admin-tickets` | Tabla compradores, ticket manual, resend email |
| `feature/admin-scan` | Invitaciones + Scanner QR + close-door |
| `feature/admin-staff` | CRUD admins + logs de auditoría |

**Infra pendiente (humano):**
- Deploy a Vercel + compra de dominio
- `ALTER TABLE ticket_tiers ADD COLUMN sold_out_override...` en producción al deployar
- Integración Mercado Pago + Resend (después de admin completo)

---

## Bloqueos / Dudas abiertas

- Dominio final sin decidir.
- Deploy a Vercel pendiente.
- MP + Resend quedan para después de admin completo.

---

## Decisiones recientes relevantes

- **#015** — `getSession()` en Server Actions para evitar doble call a Supabase Auth
- **#016** — `sold_out_override` column para marcar tier agotada manualmente
- **#014** — Gate password en `site_config` (sigue vigente)
- **#013** — Skeleton first: stubs en admin-base, CRUD en ramas separadas

Ver `memoria/DECISIONS.md` para historial completo (#001–#016).

---

## Quién hizo qué en la última sesión

- **Tato** (2026-05-08): completó `feature/admin-events` — CRUD eventos, gestión de tiers
  (editar inline, agotar, activar/desactivar), tests e2e, fix `getSession()`, validación
  unicidad de tier.

---

## Próximos pasos concretos

1. Mergear PR `feature/admin-events` → `develop` (review de al menos 1 miembro)
2. Abrir `feature/admin-whitelist` desde `develop`
3. Abrir `feature/admin-tickets` desde `develop` (puede ir paralela a whitelist)
4. Coordinar deploy a Vercel + dominio (tarea humana)
5. Correr `/shannon` antes del PR de cualquier feature que toque gate, whitelist o scan
