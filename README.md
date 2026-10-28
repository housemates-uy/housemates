# HOUSE MATES

Web oficial de la fiesta privada **HOUSE MATES** (Montevideo).
Landing + ticketera con Mercado Pago + panel admin.

---

## Estado

En producción en https://housemates-rho.vercel.app: landing pública, compra de entradas con
contraseña y Mercado Pago, entradas manuales/invitaciones con QR y scanner de puerta.
Estado detallado en [.claude/HANDOFF.md](.claude/HANDOFF.md).

---

## Documentación

- **[docs/LOGICA_DE_NEGOCIO.md](docs/LOGICA_DE_NEGOCIO.md)** — **cómo funciona la app**: rutas, entradas, compra, puerta (empezar por acá)
- **[.claude/CLAUDE.md](.claude/CLAUDE.md)** — instrucciones del proyecto para Claude Code
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — arquitectura completa: stack, rutas, modelo de datos, flujos, seguridad, roadmap
- **[docs/API.md](docs/API.md)** — especificación de endpoints (públicos + admin + cron)
- **[docs/SCAFFOLD.md](docs/SCAFFOLD.md)** — plan de la base del proyecto: estructura, deps, configs, checklist
- **[docs/EXTERNAL_SERVICES.md](docs/EXTERNAL_SERVICES.md)** — servicios de terceros (Supabase, MP, Resend, Vercel, 1Password, etc.), setup, costos, manejo de secrets
- **[docs/DEPLOY.md](docs/DEPLOY.md)** — deploy a Vercel, configuración de dominio y DNS, rotación de secrets, troubleshooting
- **[docs/NEXT_STEPS.md](docs/NEXT_STEPS.md)** — action items humanos post-deploy (crear cuentas, comprar dominio, etc.)
- **[docs/database.excalidraw](docs/database.excalidraw)** — diagrama de base de datos (abrir con [excalidraw.com](https://excalidraw.com))

---

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + Framer Motion
- Supabase (Postgres + Auth + Storage)
- Mercado Pago Checkout Pro
- Resend (emails)
- Vercel (hosting)

---

## Branches

```
main       → producción
develop    → integración
feature/*  → trabajo individual, PR contra develop
```

Cada colaborador trabaja en su propia `feature/*` desde `develop`.

---

## Setup local

```bash
cp .env.example .env.local
# Editar .env.local:
#   GATE_PASSWORD=lo-que-quieras
#   GATE_COOKIE_SECRET=$(openssl rand -base64 32)
npm install
npm run dev
```

Abrir `http://localhost:3000` → redirige a `/access` → ingresar el password → ve la landing.

### Scripts

```bash
npm run dev        # dev server (puerto 3000)
npm run build      # build de producción
npm run start      # server de producción
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run format     # prettier --write
```

---

## Team

- **José Duró** (@joseeduro) — director creativo, dev
- **Sebastián "Tato" Souverbielle** (@ssouberbielle) — owner, dev
- **Facu** — owner
