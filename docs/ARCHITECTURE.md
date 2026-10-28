# HOUSE MATES — Arquitectura

> Documento vivo. Toda decisión importante se refleja acá.
> Última actualización: 2026-04-14

---

## 1. Overview

Sitio web para la fiesta privada **HOUSE MATES** (Montevideo). Funciones principales:

1. **Gate con password universal** — mística de fiesta privada
2. **Landing interactiva** — historia, ediciones pasadas, identidad de marca
3. **Ticketera con Mercado Pago** — venta filtrada por whitelist de emails
4. **Panel admin** en subdominio — gestión de eventos, tickets, whitelist, invitaciones
5. **Scanner QR** en puerta — validación con ingreso único por QR

**Acceso a compra:** solo emails en whitelist (gestionada manualmente por los owners).
**Acceso a landing:** cualquiera con el password universal.

---

## 2. Stack técnico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| UI | Tailwind CSS + Framer Motion |
| Backend | Next.js API routes + Server Actions |
| Base de datos | Supabase (Postgres) |
| Auth admin | Supabase Auth (email + password) |
| Storage | Supabase Storage (imágenes, galería) |
| Email | Resend |
| Pagos | Mercado Pago Checkout Pro (SDK oficial) |
| QR generación | librería `qrcode` (npm) |
| QR escaneo | `html5-qrcode` |
| Hosting | Vercel (apex + subdominio admin) |
| Monitoreo | Sentry (crítico en webhook MP) |
| Dominio | `housemates.*` (a registrar cuando avance el proyecto) |

---

## 3. Dominios y rutas

### Dominio principal `housemates.*`

| Ruta | Descripción | Protección |
|---|---|---|
| `/access` | Gate con password universal | Pública |
| `/` | Landing interactiva | Cookie gate válida |
| `/tickets` | Listado de tiers del evento activo | Cookie gate + evento activo |
| `/checkout` | Form comprador + validación whitelist | Cookie gate + evento activo |
| `/checkout/success` | Retorno MP OK | Cookie gate |
| `/checkout/pending` | Retorno MP pendiente | Cookie gate |
| `/checkout/failure` | Retorno MP fallido | Cookie gate |
| `/ticket/[qrToken]` | Vista pública del ticket (por si pierden el email) | Token válido |

### Subdominio `admin.housemates.*`

| Ruta | Descripción |
|---|---|
| `/login` | Login admin |
| `/` | Dashboard global (eventos activos, métricas resumen) |
| `/events` | Listado histórico + botón "Crear evento" |
| `/events/new` | Wizard creación |
| `/events/[id]` | Overview del evento — stats destacadas |
| `/events/[id]/edit` | Editar info base |
| `/events/[id]/invitations` | Guest list (bypass whitelist) |
| `/events/[id]/tickets` | Listado compradores + CRUD manual |
| `/events/[id]/stats` | Analytics full |
| `/events/[id]/scan` | Scanner QR con cámara |
| `/events/[id]/close-door` | Modo "cerrar puerta" |
| `/whitelist` | Gestión whitelist (agregar, buscar, tags, eliminar) |
| `/config` | Password universal, textos generales |
| `/admins` | Gestión de usuarios admin (owner/staff) |
| `/logs` | Logs de cambios admin |

---

## 4. Gate — password universal

**Rol:** estético y primer filtro contra público random de internet. **No es la barrera real** de acceso (esa es la whitelist en el checkout).

**Implementación:**
- Tabla `site_config` contiene el password actual
- Página `/access`: UI minimalista, solo input centrado en edge page
- `POST /api/gate { password }`:
  - Rate limit: 5 intentos / 15 min por IP (tabla `gate_attempts`)
  - Verifica contra `site_config.gate_password`
  - Si OK: setea cookie `hm_access` HTTP-only, firmada (iron-session)
    - **Vida útil: 1 día**
    - `SameSite=Lax`, `Secure`
  - Redirige a `/`
- Middleware Next.js: si falta cookie en cualquier ruta que no sea `/access`, redirige a `/access`
- Rotación: desde `/config` en admin se cambia el password en caliente

---

## 5. Whitelist — control real de acceso

**Filosofía:** el password se filtra tarde o temprano. La whitelist no se publica nunca. Es lo que separa "puede ver la web" de "puede comprar".

### Reglas

- **Manual 100%** — los owners agregan/eliminan emails desde admin. No hay auto-populate tras compra ni CSV.
- **Agregar varios a la vez** — input que acepta emails separados por coma, los normaliza y los inserta en lote.
- **Normalización de email:**
  - Lowercase
  - Gmail/Googlemail: strip puntos y `+tag` → `jose.duro+tickets@gmail.com` = `joseduro@gmail.com`
- **Sin tags obligatorios** — los tags son opcionales, útiles para organizar ("originales", "crew-tato", "bclub-crossover"), no se fuerzan.

### UX de la whitelist en admin (`/whitelist`)

- Lista paginada con búsqueda (email, nombre, @IG, tag)
- Filtros por tag y status (active/banned)
- **Agregar:** textarea que acepta emails separados por coma → preview de cuáles se insertan y cuáles ya existen → confirm
- **Edit inline:** nombre, tags, notas
- **Remove / ban:** con razón obligatoria
- **Stats por email:** cuántos eventos asistió, última fecha

### UX en el checkout del usuario

1. Primer paso: input de email
2. `POST /api/whitelist/check { email }` → normaliza y consulta
3. **Si está:** continúa al form completo (nombre, CI, teléfono)
4. **Si NO está:** muestra mensaje:

   > No estás en nuestra lista de invitados. Pasanos tu email por mensaje directo de Instagram: [@housemates](https://instagram.com/housemates)

---

## 6. Modelo de datos

### Diagrama visual
Ver `docs/database.excalidraw` — abrir con [excalidraw.com](https://excalidraw.com) (File → Open).

### Tablas

```sql
-- EVENTOS
events (
  id              uuid PK,
  slug            text unique,
  title           text,
  date_start      timestamptz,
  date_end        timestamptz,
  location_name   text,
  location_url    text,
  description_md  text,
  hero_image_url  text,
  gallery_urls    text[],
  lineup          jsonb,
  status          enum(draft/published/archived),
  sales_active    boolean default false,      -- controla botón flotante en landing
  door_closed     boolean default false,      -- modo "cerrar puerta"
  capacity        int,
  created_at, updated_at
)

-- TIERS DE TICKETS POR EVENTO
ticket_tiers (
  id              uuid PK,
  event_id        uuid FK -> events(id),
  name            text,                        -- Early Bird, General, Last Call
  description     text,
  price_uyu       numeric,
  quantity_total  int,
  quantity_sold   int default 0,
  sales_start     timestamptz,
  sales_end       timestamptz,
  sort_order      int,
  active          boolean default true
)

-- TICKETS (compras + invitaciones en la misma tabla, diferenciados por source)
tickets (
  id                uuid PK,
  event_id          uuid FK -> events(id),
  tier_id           uuid FK -> ticket_tiers(id) nullable,  -- null para invitaciones
  source            enum(purchase/invitation/manual),
  buyer_name        text,
  buyer_email       text,
  buyer_phone       text,
  buyer_document    text,                     -- CI uruguaya
  status            enum(pending/paid/used/refunded/cancelled),
  qr_token          text unique,              -- HMAC(secret, ticket_id + event_id)
  mp_preference_id  text,
  mp_payment_id     text,
  amount_paid_uyu   numeric,
  created_at        timestamptz,
  paid_at           timestamptz,
  used_at           timestamptz,
  used_by_admin_id  uuid FK -> admins(id),
  notes             text,
  UNIQUE (event_id, buyer_email),             -- 1 ticket por email por evento
  UNIQUE (event_id, buyer_document)           -- 1 ticket por CI por evento
)

-- WHITELIST (solo controla quién puede comprar)
whitelist (
  id                    uuid PK,
  email                 text unique,          -- normalizado (lowercase + gmail sin puntos)
  name                  text,
  instagram_handle      text,
  tags                  text[],
  status                enum(active/banned),
  notes                 text,
  added_by_admin_id     uuid FK -> admins(id),
  added_at              timestamptz,
  events_attended_count int default 0,
  last_attended_at      timestamptz
)

-- CHECK-INS (auditoría de escaneos)
check_ins (
  id          uuid PK,
  ticket_id   uuid FK -> tickets(id),
  admin_id    uuid FK -> admins(id),
  scanned_at  timestamptz,
  result      enum(admitted/already_used/invalid/wrong_event/not_paid/door_closed),
  device_info text
)

-- ADMINS (owners + staff)
admins (
  id            uuid PK,
  email         text unique,
  name          text,
  password_hash text,
  role          enum(owner/staff),
  active        boolean default true,
  created_at, last_login_at
)

-- LOGS DE CAMBIOS ADMIN (auditoría: quién editó qué)
admin_logs (
  id            uuid PK,
  admin_id      uuid FK -> admins(id),
  action        text,                          -- "event.update", "whitelist.add", etc.
  entity_type   text,
  entity_id     uuid,
  diff          jsonb,                         -- {before, after} de lo que cambió
  created_at    timestamptz
)

-- CONFIG (password universal + textos editables)
site_config (
  key             text PK,                     -- "gate_password", "hero_title", etc.
  value           text,
  updated_at      timestamptz,
  updated_by      uuid FK -> admins(id)
)

-- RATE LIMITING DEL GATE
gate_attempts (
  id            bigserial PK,
  ip            inet,
  success       boolean,
  attempted_at  timestamptz
)

-- LOG DE EMAILS ENVIADOS (idempotencia + debugging)
email_log (
  id            uuid PK,
  ticket_id     uuid FK -> tickets(id),
  type          enum(confirmation/reminder/resent),
  provider_id   text,                          -- ID de Resend
  status        enum(sent/failed/bounced),
  sent_at       timestamptz
)
```

### Relaciones clave

- `ticket_tiers.event_id` → `events.id` (1:N)
- `tickets.event_id` → `events.id` (1:N)
- `tickets.tier_id` → `ticket_tiers.id` (N:1, nullable para invitations)
- `check_ins.ticket_id` → `tickets.id` (N:1)
- `check_ins.admin_id` → `admins.id` (N:1)
- `admin_logs.admin_id` → `admins.id` (N:1)

**Nota:** `whitelist` no tiene FK directa con `tickets` — el link es por email (normalizado). Esto permite que la whitelist sobreviva a cambios en tickets y viceversa.

---

## 7. Flujos principales

### 7.1 Gate + landing

```
Usuario → housemates.com
  ↓ middleware detecta cookie ausente
  ↓ redirige a /access
/access
  ↓ input password → POST /api/gate
  ↓ rate limit + verify
  ↓ cookie hm_access (1 día, HTTP-only, Secure)
/ (landing)
  ↓ server-side query: hay evento con sales_active=true?
  ↓ sí → renderiza botón flotante "Tickets"
  ↓ no → botón oculto, landing sigue visible
```

### 7.2 Compra

```
/tickets
  ↓ lista tiers activos del próximo evento
  ↓ click tier → /checkout
/checkout
  ↓ paso 1: solo email
  ↓ POST /api/whitelist/check
  ↓ no está → mensaje "escribinos por IG" (dead end)
  ↓ está → paso 2: form completo (nombre, CI, teléfono)
  ↓ validación CI uruguaya (dígito verificador)
  ↓ POST /api/checkout
     a) lock optimista del stock del tier
     b) crea ticket status=pending
     c) crea preference en MP con back_urls + notification_url
     d) devuelve init_point
  ↓ redirige a Mercado Pago
MP
  ↓ usuario paga
  ↓ MP llama webhook POST /api/mp/webhook
     a) verifica firma x-signature
     b) marca ticket=paid, guarda mp_payment_id
     c) genera qr_token = HMAC(secret, ticket_id + event_id)
     d) Resend: email con ticket + QR embebido
     e) logea en email_log
  ↓ MP redirige a /checkout/success
```

### 7.3 Validación en puerta

```
Staff/owner → admin.housemates.com/login
  ↓ navega a /events/[id]/scan
  ↓ PWA abre cámara trasera fullscreen
  ↓ html5-qrcode detecta QR
  ↓ POST /api/admin/scan/validate { qr_token, event_id }
     a) verifica HMAC
     b) verifica event_id matching
     c) verifica status=paid y used_at=null
     d) si door_closed=true → rechaza con "puerta cerrada"
     e) UPDATE tickets SET used_at=now(), used_by_admin_id=...
        WHERE qr_token=? AND used_at IS NULL RETURNING *
        (lock a nivel DB evita race condition)
     f) inserta check_in log
     g) devuelve datos del ticket
  ↓ pantalla muestra 2 seg:
     - VERDE: Nombre + CI + tier + "ADMITIR"
     - ROJO: "YA INGRESÓ a las HH:MM por @admin"
     - NARANJA: "NO PAGADO" / "EVENTO EQUIVOCADO"
  ↓ vuelve al feed de cámara
```

### 7.4 Gestión de whitelist (admin)

```
/whitelist
  ↓ "Agregar emails"
  ↓ textarea: "ana@gmail.com, juan.perez@gmail.com, lucas+hm@hotmail.com"
  ↓ normaliza cada uno (lowercase + gmail sanitize)
  ↓ preview: nuevos (3) / ya existían (0)
  ↓ confirm → INSERT bulk
```

---

## 8. QR y Scanner

### Generación

- Formato del token: `HMAC-SHA256(SECRET, ticket_id + event_id + created_at)` truncado a 32 chars, url-safe base64
- El QR encodea: `https://housemates.com/ticket/[qrToken]` (también sirve como fallback humano)
- El backend valida el HMAC antes de consultar DB → filtra QRs falsos sin tocar Postgres

### Scanner

**Tecnología:**
- PWA dentro de admin (`/events/[id]/scan`)
- `html5-qrcode` con cámara trasera
- HTTPS obligatorio (Vercel lo da)
- Wake lock API para que la pantalla no se apague

**UX:**
- Fullscreen cámara
- Feedback inmediato al detectar: flash de color + vibración + sonido corto
- Pantalla resultado 2 seg con estado claro
- Admits manuales con botón grande

**Internet en puerta confiable (confirmado):** sin modo offline en v1.

**Close-door mode:**
- Botón en `/events/[id]/close-door` marca `events.door_closed=true`
- A partir de ese momento el scanner rechaza con "puerta cerrada"
- Registra check_in con `result=door_closed`

---

## 9. Seguridad

| Vector | Mitigación |
|---|---|
| Brute force del password universal | Rate limit 5 intentos / 15 min por IP (tabla gate_attempts) |
| QR falsificado | HMAC server-side con secret en env var |
| Doble uso de QR | Lock a nivel DB en UPDATE con WHERE used_at IS NULL |
| Webhook MP falso | Validar header `x-signature` contra secret de MP |
| Admin comprometido | bcrypt password + session timeout + 2FA opcional para owners |
| Leak del password universal | Whitelist es la barrera real + rotación manual cuando el admin quiera |
| Leak de whitelist | No se exporta ni se expone en API pública; solo visible logueado como admin |
| Bypass del whitelist por normalización | Test exhaustivo: mayúsculas, puntos gmail, `+tag`, trim whitespace |
| Spam en form checkout | Rate limit por IP + cloudflare turnstile (opcional v2) |

**Secrets en env vars (nunca commit):**
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `GATE_COOKIE_SECRET` (iron-session)
- `QR_HMAC_SECRET`
- `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`
- `RESEND_API_KEY`

---

## 10. Features por versión

### MVP v1 (primer evento)

- [x] Gate con password universal (cookie 1 día)
- [x] Landing interactiva con botón flotante condicional
- [x] Whitelist manual con agregado por lote (emails separados por coma)
- [x] Checkout con validación whitelist + CI uruguaya
- [x] Integración Mercado Pago Checkout Pro
- [x] Email automático con QR al confirmar pago
- [x] Scanner QR en admin con cámara
- [x] CRUD eventos, tiers, tickets, invitaciones
- [x] Reenvío de email desde admin
- [x] Refund total con invalidación de QR
- [x] Modo "cerrar puerta"
- [x] Logs de cambios admin
- [x] Stats del evento (hero cards + breakdown por tier + timeline)
- [x] Recordatorio automático 24h antes del evento

### v2 (siguientes ediciones)

- [ ] PWA instalable para staff
- [ ] Scanner con modo offline (si la puerta lo necesitara)
- [ ] Descuentos / cupones
- [ ] Countdown timer en home
- [ ] Spotify embed del lineup
- [ ] Comparativas entre ediciones en stats
- [ ] Lista de espera con email automático al liberarse cupos
- [ ] 2FA para admins owner
- [ ] Cloudflare Turnstile en formularios

---

## 11. Deployment

### Setup

1. Registrar dominio (pendiente)
2. Proyecto Vercel conectado al repo
3. Apex → `housemates.*` ; subdominio `admin.*` ambos en Vercel
4. Supabase project (región sa-east-1 São Paulo por latencia UYU)
5. Resend con dominio verificado (SPF, DKIM, DMARC)
6. Mercado Pago: cuenta empresa + credenciales prod

### Branches y merges

```
main       → producción
develop    → integración
feature/*  → trabajo individual, PR contra develop
```

Cada colaborador (José, Tato, Facu) trabaja en su propia `feature/*` desde `develop`.

### Variables de entorno por entorno

- `.env.local` — desarrollo (no commit)
- Vercel env vars — staging / prod
- Supabase: dos proyectos separados (dev + prod) o un solo proyecto con schemas diferentes

---

## 12. Roadmap inmediato

1. Scaffold Next.js + Tailwind + Supabase client en `feature/project-base`
2. Setup Supabase: crear tablas según este doc
3. Landing base (estática, sin contenido real aún)
4. Gate funcional con password universal hardcoded en site_config
5. Admin auth básica
6. CRUD whitelist en admin (primer bloque funcional)
7. CRUD eventos + tiers
8. Checkout + integración MP (sandbox)
9. Email con QR
10. Scanner
11. Stats
12. Pulido + deploy

---

## 13. Decisiones pendientes

- [ ] Dominio definitivo (`.com`, `.uy`, otro) — se decide cuando el proyecto avance
- [ ] Lineup / tipografía / paleta de marca — puede venir de material existente de HOUSE MATES
- [ ] Fecha objetivo del primer evento con este sistema — define urgencia
