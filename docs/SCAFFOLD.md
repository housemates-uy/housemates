# HOUSE MATES — Scaffold inicial

> Plan detallado de cómo armar la base del proyecto antes de picar features.
> Este doc describe el estado objetivo al final del scaffold — no implementa nada aún.

---

## 1. Estructura de carpetas

```
housemates/
├── .github/
│   └── workflows/
│       └── ci.yml                    # lint + typecheck + build en PRs
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── SCAFFOLD.md
│   └── database.excalidraw
│
├── public/
│   ├── favicon.ico
│   ├── logo.svg                      # placeholder inicial
│   └── og-image.jpg                  # placeholder inicial
│
├── src/
│   ├── app/
│   │   │
│   │   ├── (public)/                 # rutas del dominio principal
│   │   │   ├── layout.tsx
│   │   │   ├── access/
│   │   │   │   └── page.tsx          # gate con password universal
│   │   │   ├── page.tsx              # landing (home)
│   │   │   ├── tickets/
│   │   │   │   └── page.tsx
│   │   │   ├── checkout/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── success/page.tsx
│   │   │   │   ├── pending/page.tsx
│   │   │   │   └── failure/page.tsx
│   │   │   └── ticket/
│   │   │       └── [qrToken]/page.tsx
│   │   │
│   │   ├── admin/                    # subdominio admin.housemates.*
│   │   │   ├── layout.tsx            # AuthGuard + layout con sidebar
│   │   │   ├── login/page.tsx
│   │   │   ├── page.tsx              # dashboard global
│   │   │   ├── events/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx      # overview
│   │   │   │       ├── edit/page.tsx
│   │   │   │       ├── invitations/page.tsx
│   │   │   │       ├── tickets/page.tsx
│   │   │   │       ├── stats/page.tsx
│   │   │   │       └── scan/page.tsx
│   │   │   ├── whitelist/page.tsx
│   │   │   ├── admins/page.tsx
│   │   │   ├── config/page.tsx
│   │   │   └── logs/page.tsx
│   │   │
│   │   ├── api/
│   │   │   ├── gate/route.ts
│   │   │   ├── whitelist/
│   │   │   │   └── check/route.ts
│   │   │   ├── checkout/route.ts
│   │   │   ├── mp/
│   │   │   │   └── webhook/route.ts
│   │   │   ├── ticket/
│   │   │   │   └── [qrToken]/route.ts
│   │   │   ├── admin/                # endpoints protegidos
│   │   │   │   ├── events/...
│   │   │   │   ├── tiers/...
│   │   │   │   ├── tickets/...
│   │   │   │   ├── invitations/...
│   │   │   │   ├── whitelist/...
│   │   │   │   ├── scan/validate/route.ts
│   │   │   │   ├── stats/event/[id]/route.ts
│   │   │   │   ├── config/route.ts
│   │   │   │   └── logs/route.ts
│   │   │   └── cron/
│   │   │       └── send-reminders/route.ts
│   │   │
│   │   ├── layout.tsx                # root layout (fonts, metadata)
│   │   ├── globals.css               # tailwind base
│   │   └── not-found.tsx
│   │
│   ├── components/
│   │   ├── ui/                       # primitivos (button, input, dialog, toast)
│   │   ├── public/                   # landing components
│   │   ├── admin/                    # admin-only components
│   │   └── scanner/                  # componente cámara QR
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # browser client
│   │   │   ├── server.ts             # server client (RSC)
│   │   │   └── admin.ts              # service_role client
│   │   ├── mp/
│   │   │   ├── client.ts             # SDK wrapper
│   │   │   └── webhook.ts            # validación firma
│   │   ├── resend/
│   │   │   ├── client.ts
│   │   │   └── templates/
│   │   │       ├── ticket-confirmation.tsx
│   │   │       └── event-reminder.tsx
│   │   ├── auth/
│   │   │   ├── gate.ts               # cookie session helpers
│   │   │   └── admin.ts              # Supabase auth helpers
│   │   ├── qr/
│   │   │   ├── generate.ts           # HMAC + qrcode lib
│   │   │   └── verify.ts
│   │   ├── validation/
│   │   │   ├── email.ts              # normalización gmail
│   │   │   ├── document.ts           # CI uruguaya
│   │   │   └── schemas.ts            # Zod schemas
│   │   ├── rate-limit.ts
│   │   └── logger.ts                 # admin_logs helper
│   │
│   ├── middleware.ts                 # gate + subdominio routing + admin auth
│   │
│   └── types/
│       ├── database.ts               # generado con supabase-cli
│       └── index.ts
│
├── supabase/
│   ├── migrations/
│   │   ├── 0001_init.sql             # crea todas las tablas
│   │   ├── 0002_indexes.sql
│   │   ├── 0003_rls.sql              # Row Level Security
│   │   └── 0004_seed.sql             # password inicial, admin owner
│   └── config.toml
│
├── .env.example                      # template sin secretos
├── .env.local                        # real (gitignored)
├── .eslintrc.json
├── .gitignore
├── .prettierrc
├── next.config.mjs
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json                       # rewrites para subdominio admin
└── README.md
```

---

## 2. Dependencies

### Runtime
```json
{
  "next": "^14.2.0",
  "react": "^18.3.0",
  "react-dom": "^18.3.0",
  "typescript": "^5.4.0",

  "@supabase/supabase-js": "^2.43.0",
  "@supabase/ssr": "^0.3.0",

  "mercadopago": "^2.0.0",
  "resend": "^3.2.0",
  "@react-email/components": "^0.0.17",

  "iron-session": "^8.0.0",
  "qrcode": "^1.5.3",
  "html5-qrcode": "^2.3.8",

  "tailwindcss": "^3.4.0",
  "framer-motion": "^11.0.0",
  "class-variance-authority": "^0.7.0",
  "clsx": "^2.1.0",
  "tailwind-merge": "^2.2.0",
  "lucide-react": "^0.378.0",

  "zod": "^3.23.0",
  "date-fns": "^3.6.0",
  "date-fns-tz": "^3.1.0"
}
```

### Dev
```json
{
  "@types/node": "^20.12.0",
  "@types/react": "^18.3.0",
  "@types/qrcode": "^1.5.5",
  "eslint": "^8.57.0",
  "eslint-config-next": "^14.2.0",
  "prettier": "^3.2.0",
  "prettier-plugin-tailwindcss": "^0.5.14",
  "supabase": "^1.167.0"
}
```

---

## 3. Variables de entorno (`.env.example`)

```bash
# --- Supabase ---
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=            # solo server, para admin ops

# --- Gate cookie ---
GATE_COOKIE_SECRET=                   # 32+ chars random

# --- QR ---
QR_HMAC_SECRET=                       # 32+ chars random

# --- Mercado Pago ---
MP_ACCESS_TOKEN=                      # Prod/Test token
MP_WEBHOOK_SECRET=                    # firma para validar x-signature
MP_PUBLIC_KEY=

# --- Resend ---
RESEND_API_KEY=
RESEND_FROM=HOUSE MATES <hola@housemates.com>

# --- Cron ---
CRON_SECRET=                          # header para proteger /api/cron/*

# --- App ---
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ADMIN_URL=http://admin.localhost:3000
NODE_ENV=development
```

---

## 4. Configs clave

### `next.config.mjs`
- Image domains: Supabase Storage
- Headers de seguridad (CSP, X-Frame-Options, etc.)

### `middleware.ts`
Responsabilidades:
1. Detectar subdominio (`admin.*` vs apex)
2. Si apex: aplicar gate check (cookie `hm_access`)
3. Si admin: aplicar auth check (Supabase session)
4. Rewrites para rutear admin.* → `/admin/*` interno

### `vercel.json`
Rewrites del subdominio admin → rutas `/admin/*`.

### `tailwind.config.ts`
- Content: `./src/**/*.{ts,tsx}`
- Tema personalizado con paleta HOUSE MATES (a definir)
- Fuentes custom

### `tsconfig.json`
- `strict: true`
- Path alias: `@/*` → `./src/*`

---

## 5. Archivos base que se crean en el scaffold

| Archivo | Propósito |
|---|---|
| `src/app/layout.tsx` | Root layout: metadata, fonts, providers |
| `src/app/globals.css` | Tailwind base + custom CSS vars |
| `src/app/(public)/access/page.tsx` | Gate: input password + submit |
| `src/app/(public)/page.tsx` | Landing placeholder |
| `src/app/api/gate/route.ts` | Handler del gate con rate limit |
| `src/middleware.ts` | Routing + auth |
| `src/lib/supabase/server.ts` | Helper server client |
| `src/lib/validation/email.ts` | Normalización gmail |
| `src/lib/validation/document.ts` | Validador CI UY |
| `supabase/migrations/0001_init.sql` | Schema inicial completo |

El resto queda como stubs o se crea en features posteriores.

---

## 6. Row Level Security (RLS) — política inicial

- **events, ticket_tiers:** lectura pública solo si `status=published AND sales_active=true`; escritura solo admins
- **tickets:** lectura solo por el dueño (match email) o admins; escritura solo server con service_role
- **whitelist, admin_logs, admins:** cero acceso público, solo service_role
- **site_config:** lectura pública de keys marcadas `public=true` (ej: textos landing); resto solo admin

RLS se habilita en todas las tablas desde `0003_rls.sql`.

---

## 7. Setup local (workflow primera vez)

```bash
# 1. Clonar
git clone git@github.com:ssouberbielle/housemates.git
cd housemates
git checkout feature/project-base

# 2. Instalar deps
npm install

# 3. Copiar env
cp .env.example .env.local
# → pedir a José/Tato los valores reales del Supabase dev + MP sandbox

# 4. Arrancar Supabase local (opcional si se usa el proyecto cloud)
npx supabase start
npx supabase db reset                 # aplica todas las migrations

# 5. Dev server
npm run dev

# 6. Agregar host local para admin subdomain (una vez)
sudo sh -c 'echo "127.0.0.1 admin.localhost" >> /etc/hosts'
# → admin disponible en http://admin.localhost:3000
```

---

## 8. Scripts en `package.json`

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "db:types": "supabase gen types typescript --local > src/types/database.ts",
    "db:migrate": "supabase db push",
    "db:reset": "supabase db reset"
  }
}
```

---

## 9. CI inicial (`.github/workflows/ci.yml`)

Corre en cada PR contra `develop` y `main`:
1. Install deps (con cache)
2. `npm run lint`
3. `npm run typecheck`
4. `npm run build`

---

## 10. Checklist del scaffold (orden de implementación)

- [ ] 1. `npx create-next-app@latest` con App Router + TS + Tailwind + ESLint
- [ ] 2. Ajustar estructura de carpetas según sección 1
- [ ] 3. Instalar dependencies del stack (sección 2)
- [ ] 4. Crear `.env.example` y `.env.local` (sección 3)
- [ ] 5. Configurar Prettier + alias `@/*`
- [ ] 6. Crear proyecto Supabase (cloud, región São Paulo)
- [ ] 7. Escribir migrations `0001_init.sql` con todas las tablas del ARCHITECTURE.md
- [ ] 8. Escribir migration `0002_indexes.sql` (índices en emails, event_id, qr_token, etc.)
- [ ] 9. Escribir migration `0003_rls.sql` con políticas iniciales
- [ ] 10. Escribir migration `0004_seed.sql` con admin owner + password universal inicial
- [ ] 11. Aplicar migrations y generar `src/types/database.ts`
- [ ] 12. Crear helpers `src/lib/supabase/{client,server,admin}.ts`
- [ ] 13. Crear `src/lib/validation/{email,document,schemas}.ts`
- [ ] 14. Crear `src/middleware.ts` con detección de subdominio + gate check (sin auth admin aún)
- [ ] 15. Crear stub de `/access` y `/` públicos funcionando
- [ ] 16. Crear `POST /api/gate` funcional con rate limit y cookie iron-session
- [ ] 17. Configurar `vercel.json` con rewrites para admin subdomain
- [ ] 18. Configurar CI GitHub Actions
- [ ] 19. Deploy inicial a Vercel (preview para `feature/project-base`)
- [ ] 20. Merge a `develop` cuando todo lo anterior pasa CI

Con esto queda la base lista. Features concretas (checkout MP, admin, scanner, etc.) se implementan cada una en su propia `feature/*` desde `develop`.

---

## 11. Qué NO incluye el scaffold

No son parte de este paso inicial (se hacen en features posteriores):

- Diseño visual final de landing
- Integración con Mercado Pago
- Templates de email
- Panel admin funcional
- Scanner
- Stats

Solo queda el esqueleto + gate + Supabase conectado + CI.
