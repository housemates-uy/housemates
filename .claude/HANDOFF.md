# HANDOFF — HOUSE MATES

> Estado actual del proyecto. Este archivo se reescribe en cada PR que mergea a `develop`.
> Última actualización: 2026-10-02 por Tato (branch `feature/rebrand`)

---

## Dónde estamos

**Fase:** Admin events ✅ → Rebrand + landing pública ✅ → Deploy Vercel ✅ (parcial) → Ticketera

**Deploy:** https://housemates-rho.vercel.app (proyecto Vercel `ssouberbielles-projects/housemates`,
desplegado con la CLI desde `feature/rebrand`). Sin env vars cargadas todavía: anda la landing;
`/entradas` y `/admin` necesitan las variables de Supabase y del gate.

Todo el frontend está sobre el Manual de Marca v1. La landing es pública; la contraseña
protege solo `/entradas`. La venta para el 11.12.26 sigue siendo híbrida (transferencia).

---

## Bloqueo principal

**El proyecto Supabase de dev (`yitrsdrfygpccdterhwq`) no resuelve DNS.** Está pausado o
borrado. Hay que restaurarlo o crear uno nuevo, correr las migraciones `0001`–`0005`, crear
los admins (ADR #012) y actualizar `.env.local` y las env vars de Vercel. Hasta entonces:
- el admin no anda (no hay login),
- la landing usa fallbacks (fecha 11.12.26, sin tandas, IG `@house__mates`),
- el gate usa `GATE_PASSWORD` del entorno.

---

## Qué está hecho en `feature/rebrand`

- **Sistema de diseño:** `tailwind.config.ts` (tokens del manual), `src/lib/fonts.ts`
  (Neue Montreal vía `NEXT_PUBLIC_FONTS_URL`, ver #018), primitivas en `src/components/ui/`
  (`logo`, `button`, `input`, `field`, `card`, `badge`, `tanda-status`, `doodle-backdrop`,
  `logo-intro`, `reveal`).
- **Sitio público:** `src/app/page.tsx` + `src/components/landing/*`. Datos del próximo evento
  en `src/lib/next-event.ts`, IG desde `site_config` en `src/lib/site.ts`.
- **Gate:** `/access?next=…` → `/entradas`. La cookie guarda la huella de la contraseña:
  rotarla desde `/admin/config` invalida las sesiones (ver #017).
- **Admin:** responsive, `EventFields`/`TierFields` compartidos, helpers en `src/lib/events.ts`.
- **Infra:** migración `0005_tier_overrides.sql`, `vercel.json` limpio, `camera=(self)`.

---

## Pendiente

| Qué | Notas |
|---|---|
| Restaurar Supabase | Bloqueo principal (arriba) |
| Env vars en Vercel | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GATE_COOKIE_SECRET`, `GATE_PASSWORD` (production y preview) |
| Git en Vercel | Conectar `housemates-uy/housemates` (la CLI no pudo: falta dar acceso a la org en la GitHub app de Vercel) y poner `develop` como rama de producción |
| Fuentes en deploy | Los deploys por CLI suben `public/fonts/` local; los deploys desde git no los tienen: hace falta `NEXT_PUBLIC_FONTS_URL` |
| Fotos | Hay 4 y de baja resolución en `public/photos/`. Faltan más y mejores |
| `feature/tickets-manual` | Carga manual + QR opaco + página `/ticket/[token]` (ver #019) |
| `feature/scanner` | `/admin/events/[id]/scan` con cámara, un solo uso atómico |
| `feature/checkout-mp` | Mercado Pago Checkout Pro + webhook idempotente |
| `feature/emails` | Resend con QR |

---

## Decisiones recientes relevantes

- **#017** — Landing pública, contraseña solo para comprar, rotación invalida sesiones, sin whitelist en checkout
- **#018** — Neue Montreal fuera del repo (repo público)
- **#019** — Validador web en el admin y QR opaco de un solo uso
- **#016** — `sold_out_override` (ahora en migración `0005`)

Ver `memoria/DECISIONS.md` para historial completo (#001–#019).
