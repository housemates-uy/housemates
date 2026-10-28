# NEXT STEPS — HOUSE MATES

> Action items humanos post-merge del PR `feature/landing-gate`.
> No todo se resuelve con código: hay pasos que requieren crear cuentas, comprar servicios, tomar decisiones.
> Cada item linkea a la doc relevante. Marcar con `[x]` cuando se complete.

---

## Infra + deploy inicial

- [ ] **Crear cuenta 1Password Teams** y vault `HOUSE MATES`. Dar acceso a José, Tato, Facu.
  - Ver `docs/EXTERNAL_SERVICES.md` §9
- [ ] **Crear cuenta Vercel** y conectar el repo `ssouberbielle/housemates`.
  - Ver `docs/DEPLOY.md` §2.1
- [ ] **Generar secrets**: `GATE_COOKIE_SECRET` único por entorno (dev, preview, prod) + definir `GATE_PASSWORD` inicial.
  - Guardar los 4 valores en 1Password.
  - Ver `docs/DEPLOY.md` §2.3, §2.4
- [ ] **Setear env vars en Vercel** para los 3 entornos.
  - Ver `docs/DEPLOY.md` §2.5
- [ ] **Primer preview deploy** y validar flow end-to-end en la URL de preview.
  - Ver `docs/DEPLOY.md` §2.6

## Dominio

- [ ] **Decidir dominio final** (ej: `housemates.uy`, `housemates.club`, `house-mates.com`).
- [ ] **Registrar dominio** en Cloudflare Registrar o equivalente.
- [ ] **Configurar DNS** (A + CNAME www + CNAME admin).
  - Ver `docs/DEPLOY.md` §3.3
- [ ] **Verificar SSL activo** (automático vía Vercel).
- [ ] **Actualizar `NEXT_PUBLIC_APP_URL`** en env vars de Vercel (production).

## Servicios externos pendientes (features futuras)

- [ ] **Resend** — crear cuenta, conectar dominio (DKIM/SPF), esperar dominio final.
  - Ver `docs/EXTERNAL_SERVICES.md` §3
- [ ] **Mercado Pago** — iniciar verificación de cuenta empresa (tarda 1-3 días hábiles), generar credenciales sandbox + prod.
  - Ver `docs/EXTERNAL_SERVICES.md` §2
- [ ] **Supabase** — crear proyectos `dev` y `prod`, guardar URL + anon key + service_role.
  - Ver `docs/EXTERNAL_SERVICES.md` §1
- [ ] **Sentry** (opcional, antes de prod real) — crear proyecto, integrar `@sentry/nextjs`.
  - Ver `docs/EXTERNAL_SERVICES.md` §8

## Comunicación del equipo

- [ ] Definir canal oficial para **rotación de `GATE_PASSWORD`** (Slack, WhatsApp, Telegram).
- [ ] Definir cómo se maneja el **vault de 1Password** (onboarding, rotación de miembros).
- [ ] Definir canal oficial para **solicitudes de acceso** (Instagram DM @housemates.uy). Ver `.claude/CLAUDE.md` §7.1.

---

## Próximas features (código)

Tras completar deploy + dominio, las siguientes features van en branches separadas:

1. `feature/supabase-setup` — conectar Supabase, crear tablas, RLS, migrations
2. `feature/admin-base` — panel admin con auth Supabase (subdominio `admin.`)
3. `feature/whitelist` — CRUD de whitelist + normalización de emails
4. `feature/events-tiers` — gestión de eventos y tickets tiers
5. `feature/checkout-mp` — integración con Mercado Pago Checkout Pro
6. `feature/webhook-mp` — webhook idempotente
7. `feature/scanner-qr` — PWA scanner para puerta
8. `feature/invitations` — tickets gratuitos bypasseando whitelist
9. `feature/emails` — templates Resend + triggers (purchase, reminder, refund)

Ver `docs/SCAFFOLD.md` para el orden sugerido de implementación.
