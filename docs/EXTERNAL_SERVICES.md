# HOUSE MATES — Servicios Externos

> Todos los servicios de terceros que el proyecto usa, con plan sugerido, setup y manejo de secrets.
> Última actualización: 2026-04-14

---

## Resumen

| Servicio | Propósito | Plan | Criticidad |
|---|---|---|---|
| [Supabase](#1-supabase) | DB + Auth + Storage | Free (upgrade Pro cuando haga falta) | Crítico |
| [Mercado Pago](#2-mercado-pago) | Procesador de pagos | Cuenta empresa UY | Crítico |
| [Resend](#3-resend) | Emails transaccionales (tickets + recordatorios) | Free (3k/mes) | Crítico |
| [Vercel](#4-vercel) | Hosting + cron jobs + CDN | Hobby (upgrade Pro si hace falta) | Crítico |
| [GitHub](#5-github) | Repo + CI/CD | Free | Crítico |
| [Dominio](#6-dominio) | Registrar `housemates.*` | ~$12-20/año | Crítico cuando se lance |
| [Cloudflare](#7-cloudflare) | DNS + DDoS + caché | Free | Recomendado |
| [Sentry](#8-sentry) | Monitoreo de errores | Free (5k eventos/mes) | Recomendado |
| [1Password](#9-secret-manager-1password) | Secret manager del equipo | Team plan | **Crítico para el flujo de trabajo** |
| [Upstash Redis](#10-upstash-redis-opcional) | Rate limiting avanzado | Free | Opcional |

---

## 1. Supabase

**Qué resuelve:** Postgres + Auth + Storage + Row Level Security + API generada + Realtime.

**Por qué:** un solo proveedor para DB, auth del admin y storage de imágenes. Evita infra separada.

**Plan:** Free Tier alcanza para el primer evento (500MB DB, 1GB storage, 50k usuarios auth). Upgrade a Pro ($25/mes) cuando crezca.

**Región:** `sa-east-1 (São Paulo)` — menor latencia para usuarios UY.

**Setup:**
1. Crear cuenta en [supabase.com](https://supabase.com)
2. Crear 2 proyectos: `housemates-dev` y `housemates-prod`
3. Desde cada proyecto, copiar del dashboard → Settings → API:
   - `Project URL`
   - `anon` public key
   - `service_role` secret key
4. Aplicar migrations desde `supabase/migrations/` (ver SCAFFOLD.md)

**Secrets que entrega:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY    # OK exponer al cliente (protegido por RLS)
SUPABASE_SERVICE_ROLE_KEY        # NUNCA al cliente — bypass RLS
```

**Costos esperados:** $0 / mes durante MVP.

### Gestión de usuarios administradores

Los admins (owners y staff) se crean desde el **Dashboard de Supabase**, nunca desde la app en sí (en v1). La app no tiene UI de registro — es un sistema cerrado.

**Crear un nuevo admin/staff:**

1. Supabase Dashboard → **Authentication → Users → Add user → Create new user**
2. Ingresar email y password. Tildar **"Auto Confirm User"** (saltea el email de verificación)
3. Copiar el **UUID** del usuario recién creado (columna `id` en auth.users)
4. Ir a **Table Editor → tabla `admins`** → Insert row:
   - `id` → el UUID del paso 3
   - `email` → el mismo email
   - `name` → nombre del admin
   - `role` → `owner` (acceso total) o `staff` (solo scanner cuando se implemente)
   - `active` → `true`

> **Importante:** el usuario tiene que existir en AMBOS lugares — `auth.users` (maneja la password) y `admins` (controla el acceso al panel). Si falta en `admins`, la sesión se crea pero el panel rechaza el acceso.

**Cambiar password de un admin:**

- Desde el dashboard: Authentication → Users → clic en el usuario → **"Send password recovery"** (manda email) o editar directamente el campo password
- Desde el panel admin (cuando se implemente `/admin/config`): `supabase.auth.updateUser({ password: 'nueva' })` con Server Action autenticado

**Desactivar un admin temporalmente** (ej: staff que ya no trabaja):
- Table Editor → `admins` → cambiar `active` a `false`
- El usuario puede seguir logueándose en Supabase Auth pero el panel lo rechaza
- Para revocar acceso total: también eliminar desde Authentication → Users

**Roles:**
| Rol | Acceso |
|---|---|
| `owner` | Panel completo: eventos, tickets, whitelist, config, invitaciones |
| `staff` | Solo scanner de puerta (control por rol pendiente de implementar) |

---

## 2. Mercado Pago

**Qué resuelve:** cobrar tickets con tarjeta, red de cobranza, MercadoPago wallet.

**Por qué:** estándar absoluto en UY + UX conocida por los compradores + soporta UYU nativo.

**Producto usado:** [Checkout Pro](https://www.mercadopago.com.uy/developers/es/docs/checkout-pro/landing) — redirige al usuario a MP, vuelve con el estado del pago. La alternativa (Checkout Bricks) requiere más integración y PCI compliance indirecto.

**Comisiones (Uruguay, 2026):**
- Crédito: ~5.99% + IVA por transacción
- Débito: ~3.99% + IVA
- Acreditación: inmediata o 14 días según plan

**Setup:**
1. Crear cuenta empresa en [mercadopago.com.uy](https://mercadopago.com.uy) (necesita RUT del emprendimiento)
2. Verificar la cuenta con documentación (suele tardar 1-3 días)
3. Dashboard → Tus integraciones → Crear aplicación "HOUSE MATES"
4. Obtener credenciales:
   - **Test:** para dev
   - **Prod:** para producción (solo se muestran después de verificar cuenta)
5. Configurar webhook URL: `https://housemates.com/api/mp/webhook`
6. Configurar firma de webhook (secret) y guardarla

**Secrets que entrega:**
```
MP_PUBLIC_KEY            # cliente (identifica la app)
MP_ACCESS_TOKEN          # server (autoriza llamadas a la API)
MP_WEBHOOK_SECRET        # valida header x-signature
```

**Costos esperados:** 0 fijos — solo comisión por venta.

**Notas críticas:**
- Webhook debe ser **idempotente** (MP reintenta hasta recibir 200 OK)
- Validar siempre la firma del header `x-signature` antes de procesar
- Guardar `mp_payment_id` en el ticket para deduplicar reintentos
- Probar con tarjetas de test de MP antes de pasar a prod

---

## 3. Resend

**Qué resuelve:** enviar emails transaccionales (ticket con QR + recordatorios).

**Por qué:** DX superior (API simple, templates con React), entrega confiable, buen free tier, soporte nativo de React Email.

**Plan:**
- **Free:** 3.000 emails/mes, 100/día, 1 dominio — suficiente para varias ediciones
- **Pro ($20/mes):** 50k emails/mes — cuando escale

**Setup:**
1. Crear cuenta en [resend.com](https://resend.com)
2. Agregar dominio `housemates.com` (o el que registremos)
3. Configurar DNS records que indica Resend:
   - SPF
   - DKIM (3 CNAME)
   - DMARC
4. Esperar verificación (~10 min)
5. Crear API key con permisos `full access` solo para envío
6. Configurar dirección `From` (ej: `HOUSE MATES <hola@housemates.com>`)

**Secrets que entrega:**
```
RESEND_API_KEY
RESEND_FROM="HOUSE MATES <hola@housemates.com>"
```

**Alternativas evaluadas y descartadas:**
- SendGrid: free tier muy limitado, UX más burocrática
- Postmark: más caro, overkill para este volumen
- AWS SES: más barato pero requiere más setup y warm-up de dominio

---

## 4. Vercel

**Qué resuelve:** hosting Next.js + CDN global + preview deploys por PR + cron jobs + env vars management.

**Plan:**
- **Hobby (Free):** bandwidth 100GB/mes, 1 cron job. Suficiente para MVP.
- **Pro ($20/mes/miembro):** más crons, password protection de previews, analytics

**Setup:**
1. Cuenta en [vercel.com](https://vercel.com), conectar con GitHub
2. Importar repo `ssouberbielle/housemates`
3. Configurar:
   - Framework: Next.js (autodetect)
   - Root directory: `/`
   - Build command: `next build`
4. Agregar env vars desde el dashboard (por environment: Production / Preview / Development)
5. Configurar dominios:
   - Production: `housemates.com` (apex)
   - Production: `admin.housemates.com`
6. Habilitar Vercel Analytics (gratis)
7. Configurar cron en `vercel.json` para recordatorios

**Secrets:** no genera secrets por sí mismo, pero es donde se configuran los de todos los demás servicios.

**Notas:**
- Los preview deploys de cada PR son públicos por defecto — para este proyecto **considerar password protection** (Pro plan) o al menos no deployar preview del admin hasta que tenga auth
- Configurar redirect `www.housemates.com` → `housemates.com`

---

## 5. GitHub

**Qué resuelve:** repo + CI + review de PRs + issues (opcional, puede ir en Notion/Linear).

**Plan:** Free es suficiente.

**Setup:**
1. Repo ya existe: [ssouberbielle/housemates](https://github.com/ssouberbielle/housemates)
2. Branch protection rules en `main` y `develop`:
   - Require PR reviews (mínimo 1)
   - Require status checks (CI) passing
   - No direct pushes a `main`
3. GitHub Actions secrets (para CI):
   - Ninguno crítico en v1 (los tests no necesitan DB real aún)

**Secrets que puede requerir en CI posterior:**
- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (si se quiere deploy custom)
- `SUPABASE_ACCESS_TOKEN` (si CI aplica migrations)

---

## 6. Dominio

**Qué resuelve:** URL pública del sitio.

**Estado:** pendiente de registro.

**Opciones preferidas:**
- `housemates.uy` — fuerte identidad uruguaya (~$40/año, registro vía [Antel/NIC.uy](https://nic.uy))
- `housemates.com` — internacional, más caro si está tomado
- `housemates.fm` — musical/creative (~$35/año)
- `housemates.party` (~$20/año)

**Registradores recomendados:**
- **Cloudflare Registrar** — al costo, sin markup, DNS incluido (nuestra preferencia por defecto)
- **Namecheap** — UI decente, OK si CF no soporta el TLD
- Evitar GoDaddy

**DNS records a configurar:**
```
A       @                  → IP Vercel (76.76.21.21)
CNAME   www                → cname.vercel-dns.com
CNAME   admin              → cname.vercel-dns.com
TXT     @                  → verificación de Vercel
MX      @                  → Resend (si se usa dominio para recibir)
TXT     @                  → SPF de Resend
CNAME   resend._domainkey  → DKIM de Resend
TXT     _dmarc             → DMARC
```

---

## 7. Cloudflare

**Qué resuelve:** DNS management + CDN extra + protección DDoS + reglas de firewall (útil si el password universal se filtra masivamente).

**Plan:** Free es suficiente.

**Por qué:** aunque Vercel ya tiene CDN, CF agrega:
- Analytics de red
- Reglas de firewall (ej: bloquear países específicos si detectamos ataques)
- Rate limiting a nivel de edge
- Cache control más fino
- Proxy opcional (oculta IP de Vercel)

**Setup:**
1. Cuenta en [cloudflare.com](https://cloudflare.com)
2. Agregar dominio (después de registrarlo)
3. Cambiar nameservers al registrador (salvo que se use CF Registrar)
4. Configurar DNS records según sección 6
5. Activar proxy (naranja) solo en `@` y `www` — NO en `admin.*` mientras se debuggea auth

---

## 8. Sentry

**Qué resuelve:** captura automática de errores en producción con stack trace, release tracking y alertas.

**Por qué:** crítico para detectar fallos en el webhook de MP (si falla, perdemos registros de pago confirmado) y errores silenciosos en el scanner el día del evento.

**Plan:** Free (5k eventos/mes, 1 proyecto, 1 usuario) — suficiente.

**Setup:**
1. Cuenta en [sentry.io](https://sentry.io)
2. Crear proyecto Next.js
3. Instalar SDK: `npx @sentry/wizard@latest -i nextjs`
4. Configurar alertas:
   - Alert cuando falla webhook MP (email al equipo)
   - Alert cuando scan/validate devuelve `invalid` > 5 veces en 1 min (posible ataque)

**Secrets que entrega:**
```
NEXT_PUBLIC_SENTRY_DSN
SENTRY_AUTH_TOKEN        # para source maps upload en build
```

---

## 9. Secret manager (1Password)

**Qué resuelve:** compartir todas las API keys y credenciales entre José, Tato y Facu de forma segura, con auditoría y rotación.

**Por qué es crítico:** cada uno de los tres trabaja desde su Mac con Claude Code — necesitan acceso a las mismas keys sin mandarlas por WhatsApp / Slack / email.

### Opción recomendada: **1Password**

- Plan: **Teams** — $7.99/mes/usuario (3 miembros = ~$24/mes)
- Ventajas:
  - UX superior a cualquier alternativa
  - App nativa en Mac con autocomplete
  - Tipo "API Credential" específico para keys
  - Sharing granular por vault
  - Auditoría de accesos
  - Integración con CLI (`op`) para inyectar secrets en dev

**Setup:**
1. Crear cuenta 1Password Teams como propietario (José)
2. Invitar a Tato y Facu con rol "Member"
3. Crear vault **"HOUSE MATES"** con acceso para los tres
4. Dentro, crear items:
   - `Supabase Dev`
   - `Supabase Prod`
   - `Mercado Pago Test`
   - `Mercado Pago Prod`
   - `Resend`
   - `Vercel`
   - `Cloudflare`
   - `Sentry`
   - `GitHub Secrets`
   - `Dominio (registrar)`
5. Cada item incluye: URL, usuario, password, API keys, notas del setup

**Workflow de dev con `op` CLI:**
```bash
# instalar
brew install --cask 1password-cli

# autenticar una vez
op signin

# inyectar secrets al correr el dev server (sin archivos .env expuestos)
op run --env-file=.env.template -- npm run dev
```

Con esto `.env.local` no hace falta (o solo contiene referencias tipo `op://HOUSEMATES/Supabase Dev/api_key`).

### Alternativas consideradas

| Opción | Pros | Contras |
|---|---|---|
| **Bitwarden Teams** | Más barato ($4/mes/user), open source | UX menos pulida, sin CLI integration tan fluida |
| **Doppler** | Diseñado para secrets en apps, sync automático a Vercel | Free tier limitado a 5 users/3 proyectos, curva de aprendizaje |
| **Infisical** | Open source, self-hostable | Menos maduro, menos integraciones |
| **Solo Vercel + GitHub secrets** | Gratis | No cubre dev local ni sharing estructurado |

**Recomendación:** arrancar con **1Password Teams**. Es la mejor inversión si van a trabajar los 3 con secrets compartidos por años.

---

## 10. Upstash Redis (opcional)

**Qué resuelve:** rate limiting con ventana deslizante real (más preciso que tabla Postgres).

**Cuándo agregarlo:** si vemos que la tabla `gate_attempts` genera mucho volumen o que necesitamos rate limit más fino en `/api/checkout` y `/api/whitelist/check`.

**Plan:** Free (10k commands/día).

**Alternativas:** Vercel KV (wrapper sobre Upstash), idéntico.

**Secrets que entrega:**
```
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

**Decisión:** no incluir en MVP v1. Empezamos con rate limit en tabla Postgres, migramos si duele.

---

## 11. Resumen de secrets por servicio

| Secret | Servicio | Alcance |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | Client + Server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | Client + Server |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Server only |
| `GATE_COOKIE_SECRET` | iron-session | Server only |
| `QR_HMAC_SECRET` | QR gen/verify | Server only |
| `MP_PUBLIC_KEY` | Mercado Pago | Client OK |
| `MP_ACCESS_TOKEN` | Mercado Pago | Server only |
| `MP_WEBHOOK_SECRET` | Mercado Pago | Server only |
| `RESEND_API_KEY` | Resend | Server only |
| `RESEND_FROM` | Resend | Server only |
| `CRON_SECRET` | Vercel Cron | Server only |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry | Client + Server |
| `SENTRY_AUTH_TOKEN` | Sentry | Build only |
| `NEXT_PUBLIC_APP_URL` | App | Client + Server |
| `NEXT_PUBLIC_ADMIN_URL` | App | Client + Server |

---

## 12. Checklist de setup — orden recomendado

- [ ] 1. **1Password Teams** creado, vault HOUSE MATES compartido con los 3
- [ ] 2. **Supabase** proyectos dev + prod creados, secrets en 1Password
- [ ] 3. **Resend** cuenta creada (sin dominio aún, usa email sandbox de Resend para dev)
- [ ] 4. **Mercado Pago** cuenta empresa iniciada (proceso de verificación de 1-3 días)
- [ ] 5. **Vercel** proyecto conectado al repo, secrets dev seteados para preview deploys
- [ ] 6. **Sentry** proyecto Next.js creado (opcional en esta etapa, puede ser después del MVP funcional)
- [ ] 7. **Dominio** registrar (cuando se decida nombre final)
- [ ] 8. **Cloudflare** agregar dominio y configurar DNS (después del punto 7)
- [ ] 9. **Resend** verificar dominio con DNS records (después del 8)
- [ ] 10. **Mercado Pago** subir a prod con webhook final apuntando al dominio (después del 9)

Pasos 1-5 se pueden hacer en paralelo mientras esperamos verificación de MP y elección de dominio.

---

## 13. Costos esperados

### Durante MVP (pre-lanzamiento)
| Servicio | Costo |
|---|---|
| Supabase Free | $0 |
| Resend Free | $0 |
| Vercel Hobby | $0 |
| GitHub Free | $0 |
| Sentry Free | $0 |
| Cloudflare Free | $0 |
| 1Password Teams (3 users) | ~$24/mes |
| **Total mensual MVP** | **~$24/mes** |

### Al lanzar primer evento (400-500 asistentes)
| Servicio | Costo adicional |
|---|---|
| Dominio | ~$15-40/año (prorrateado ~$3/mes) |
| Mercado Pago | ~6% sobre ventas brutas (comisión, no fijo) |
| Todo lo demás | $0 en free tiers |
| **Total mensual** | **~$27/mes + 6% ventas** |

### Si escala a volumen sostenido
| Upgrade candidato | Trigger | Costo |
|---|---|---|
| Supabase Pro | >500MB DB o >1GB storage | $25/mes |
| Resend Pro | >3k emails/mes | $20/mes |
| Vercel Pro | >100GB bandwidth o password protection necesario | $20/mes/user |

---

## 14. Políticas de seguridad del equipo

- **Nunca** compartir secrets por WhatsApp, Slack, email o DM
- **Nunca** commitear `.env.local` al repo (está en `.gitignore`)
- **Nunca** pegar secrets en código ni en commits (usar `process.env.*`)
- Secrets siempre viven en 1Password (dev) + Vercel env vars (staging/prod)
- Rotar `QR_HMAC_SECRET` y `GATE_COOKIE_SECRET` si algún dev deja el proyecto
- Rotar `MP_ACCESS_TOKEN` si se sospecha compromiso (MP permite regenerar)
- `service_role` key de Supabase **solo server-side** — nunca en código cliente ni en variables `NEXT_PUBLIC_*`
