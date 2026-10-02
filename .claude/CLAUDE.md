# HOUSE MATES — Project Instructions for Claude

> Este archivo lo lee Claude Code automáticamente al abrir el repo.
> Contiene las reglas, el contexto y las convenciones del proyecto.
> Si sos Claude trabajando en este repo: leé esto primero, antes de cualquier otra cosa.

---

## 1. Contexto del proyecto

**HOUSE MATES** es una fiesta privada premium en Montevideo, Uruguay. Este repo es la web oficial:

- Landing pública; la compra de entradas pide una contraseña que los owners rotan (ver ADR #017)
- Ticketera integrada a Mercado Pago
- Panel admin para los owners (gestión de eventos, tickets, whitelist, invitaciones)
- Scanner QR en puerta el día del evento

**Acceso a la compra:** contraseña rotada desde `/admin/config` + entrada nominativa (una por CI y una por email por evento). La whitelist de emails ya no se usa en el checkout (ADR #017).

---

## 2. Equipo

| Persona | Rol | GitHub |
|---|---|---|
| José Duró | Director creativo + dev | [@joseeduro](https://github.com/joseeduro) |
| Sebastián "Tato" Souberbielle | Owner + dev | [@ssouberbielle](https://github.com/ssouberbielle) |
| Facu | Owner | — |

Los tres trabajan con Claude Code desde sus Macs. Este repo es el punto de verdad compartido.

---

## 3. Docs obligatorias a leer antes de codear

En orden:

1. **[docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)** — visión general, rutas, modelo de datos, flujos
2. **[docs/API.md](../docs/API.md)** — endpoints y contratos
3. **[docs/EXTERNAL_SERVICES.md](../docs/EXTERNAL_SERVICES.md)** — servicios externos y secrets
4. **[docs/CREDENTIALS.md](../docs/CREDENTIALS.md)** — manejo seguro de credenciales y variables de entorno
5. **[docs/SCAFFOLD.md](../docs/SCAFFOLD.md)** — estructura del proyecto y orden de implementación
6. **[docs/database.excalidraw](../docs/database.excalidraw)** — diagrama de DB (abrir con excalidraw.com)

**Regla:** antes de proponer una implementación, verificá que coincida con la arquitectura documentada. Si hay un conflicto, pausá y preguntá — no improvises.

---

## 4. Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** + **Framer Motion** — tokens del Manual de Marca v1 en `tailwind.config.ts`; Neue Montreal fuera del repo (ADR #018)
- **Supabase** (Postgres + Auth + Storage)
- **Mercado Pago Checkout Pro**
- **Resend** (emails con React Email)
- **Vercel** (hosting + cron)
- **1Password Teams** (secret manager del equipo)

---

## 5. Branches y workflow

```
main       → producción (protegida — merge solo desde develop vía PR aprobado)
develop    → integración (protegida — PRs requieren review y aprobación)
feature/*  → trabajo individual de cada dev
```

**Reglas:**
- Nunca hacer push directo a `main` ni a `develop`
- Cada feature va en su propia `feature/descripcion-corta` salida de `develop`
- PR contra `develop`, review obligatorio de **al menos 1 otro miembro del equipo**, CI verde
- Merge con squash para mantener historia limpia
- Borrar rama feature tras merge

**Si dos personas editan lo mismo:** coordinar por DM/Slack antes de avanzar para evitar conflictos grandes.

### Workflow de memoria (HANDOFF + JOURNAL + DECISIONS)

El proyecto mantiene tres archivos de contexto compartidos en `.claude/`:

- **`HANDOFF.md`** — snapshot del estado actual del proyecto (rolling, se reescribe)
- **`memoria/JOURNAL.md`** — historia append-only, una entrada por PR mergeado a develop
- **`memoria/DECISIONS.md`** — ADRs livianos, decisiones técnicas relevantes que no están obvias en docs/

**Reglas de actualización:**

1. **Durante feature branch:** nadie toca HANDOFF/JOURNAL/DECISIONS. Las notas personales van en el PR description o locales.
2. **Al terminar feature, antes de abrir PR:** el dev corre `/handoff` para que Claude proponga:
   - Nueva versión completa de `HANDOFF.md` reflejando el estado post-merge
   - Entrada nueva en `JOURNAL.md` (append con fecha + autor + branch)
   - Entrada en `DECISIONS.md` solo si hubo decisión técnica relevante
3. **El PR incluye:** código de la feature + actualización de estos archivos en el mismo commit/scope.
4. **El reviewer valida:** que HANDOFF/JOURNAL estén actualizados antes de aprobar. Si falta → request changes.
5. **Merge conflicts entre PRs paralelos:**
   - HANDOFF: el segundo en mergear rebasea y reescribe con el estado consolidado
   - JOURNAL: append-only con fecha — conflictos mínimos, merge 3-way resuelve automático
   - DECISIONS: append-only, mismo criterio que JOURNAL

**Al iniciar cualquier sesión (nuevo chat de Claude):**
1. Leer `.claude/CLAUDE.md` (automático)
2. Leer `.claude/HANDOFF.md` para saber el estado actual
3. Leer últimas 2-3 entradas de `memoria/JOURNAL.md` si falta contexto histórico
4. Consultar `memoria/DECISIONS.md` si surge una decisión que parece ya tomada

---

## 6. Reglas de trabajo con Claude Code

### 6.1 Nunca commitear sin aprobación explícita
Claude **no crea commits automáticamente**. Siempre propone el diff primero y espera confirmación.

### 6.2 Nunca tocar secrets
- `.env.local` está en `.gitignore` y **nunca** se commitea
- Secrets viven en **1Password Teams → vault HOUSE MATES** + Vercel env vars
- Nunca hardcodear una key, nunca pegarla en un diff, nunca loggearla
- Si se detecta un secret en un archivo, detenerse y avisar

### 6.3 Código en español, código en inglés
- Comentarios, commits, docs, PRs → **español**
- Código (nombres de variables, funciones, clases) → **inglés** por convención técnica
- UI visible al usuario → **español** (es audiencia uruguaya)
- Mensajes de error al usuario final → **español**

### 6.4 Commits
Formato conventional commits, en español:
```
feat: agrega endpoint de whitelist check
fix: corrige validación de CI con guion
refactor: extrae helper de normalización de email
docs: actualiza ARCHITECTURE con flujo de refund
chore: actualiza dependencies
```

### 6.5 No crear archivos innecesarios
- **Preferir editar** archivos existentes sobre crear nuevos
- **No crear** docs/markdown sin que lo pidan explícitamente
- No agregar features ni refactors no solicitados en la tarea actual

### 6.6 No introducir abstracciones prematuras
Tres líneas similares es mejor que una abstracción mal diseñada. Esperar hasta que haya 3+ casos reales antes de abstraer.

### 6.7 No agregar manejo de errores defensivo innecesario
Validar en bordes (input de usuario, APIs externas, webhooks). Confiar en código interno y garantías del framework.

### 6.8 Comentarios
Default: **no escribir comentarios**. Los buenos nombres explican qué hace el código. Solo comentar cuando el WHY no es obvio: invariante oculto, workaround de un bug, decisión contraintuitiva.

### 6.9 Confirmación antes de acciones destructivas
- `git reset --hard`, `git push --force`, borrar ramas remotas → pedir confirmación
- Borrar archivos o migrations → pedir confirmación
- Cambios en DB de producción → pedir confirmación, mostrar SQL antes de ejecutar

---

## 7. Reglas específicas del dominio

### 7.1 Whitelist — solo manual (fuera del checkout desde ADR #017)
- **NUNCA** implementar auto-populate de whitelist tras compra (decisión del equipo)
- **NUNCA** implementar form público de "solicitar acceso" (se canaliza por Instagram DM)
- Agregar emails solo vía input manual en admin (uno o varios separados por coma)
- Normalización SIEMPRE: lowercase + strip gmail dots/+tag antes de insertar o consultar

### 7.2 Password universal
- Cookie `hm_access` vive **1 día exactamente** (no más) y guarda la huella de la contraseña: si se rota, deja de valer
- Protege solo `/entradas` y `/checkout`; la landing es pública
- El password se cambia desde `/admin/config`, nunca se hardcodea en código
- Rate limit del gate: 5 intentos / 15 min por IP

### 7.3 Tickets
- `UNIQUE (event_id, buyer_email)` y `UNIQUE (event_id, buyer_document)` a nivel DB
- 1 ticket por persona por evento (intransferible salvo que admin lo edite manualmente)
- QR firmado con HMAC — nunca confiar en el token sin verificar la firma
- Una vez usado (`used_at != null`) el QR deja de admitir

### 7.4 Invitaciones
- Son tickets con `source='invitation'`, `tier_id=null`, `status='paid'`, `amount_paid=0`
- **Bypassan la whitelist** — el admin puede invitar a cualquier email
- Mismo flujo de email + QR + scan

### 7.5 Webhook de Mercado Pago
- **Debe ser idempotente** (MP reintenta hasta recibir 200)
- Siempre validar `x-signature` header antes de procesar
- Siempre hacer GET a `/v1/payments/{id}` para obtener el estado real, no confiar en el body
- Deduplicar por `mp_payment_id` antes de insertar/actualizar

### 7.6 Scanner en puerta
- Internet confiable en puerta (confirmado) — no implementar modo offline en v1
- UPDATE con `WHERE used_at IS NULL RETURNING` para evitar race condition
- Registrar cada escaneo en `check_ins` (admitido, ya usado, inválido, etc.)
- Modo "cerrar puerta": cuando `events.door_closed=true`, rechazar todo

---

## 8. Row Level Security (RLS)

**Política general:** Supabase RLS activado en TODAS las tablas.

- `events`, `ticket_tiers`: lectura pública limitada (solo published + sales_active), escritura solo admin
- `tickets`: lectura del dueño (match email) o admin, escritura solo server con service_role
- `whitelist`, `admins`, `admin_logs`, `site_config`, `gate_attempts`, `email_log`: cero acceso público, solo service_role

**Nunca** exponer la `SUPABASE_SERVICE_ROLE_KEY` al cliente. Solo se usa en API routes del server.

---

## 9. Testing

### v1 (MVP)
- Testing manual exhaustivo del webhook MP con sandbox
- Testing manual del flujo completo end-to-end en staging
- Linting y typecheck obligatorios en CI

### v2
- Tests unitarios con Vitest para helpers críticos (validación, normalización, HMAC)
- Tests e2e con Playwright para flujo de compra

---

## 10. Cuándo pedir confirmación a José/Tato antes de seguir

- Cambios a la arquitectura documentada en `docs/`
- Cambios al modelo de datos (migrations nuevas)
- Agregar dependencias nuevas al `package.json`
- Cambios en la política RLS de Supabase
- Modificar el flujo de pago o de validación de QR
- Borrar ramas, archivos o datos
- Todo lo que cueste dinero (upgrade de plan de algún servicio)

---

## 11. Comunicación con el equipo

- Idioma: **español**
- Tono: directo, profesional, sin relleno
- Si José o Tato piden algo ambiguo → preguntar una sola vez, de forma concisa
- Si piden algo claro → ejecutar sin pedir permisos innecesarios
- Respuestas cortas salvo que la tarea requiera detalle

---

## 12. Slash commands y skills compartidos

- [.claude/commands/handoff.md](./commands/handoff.md) — `/handoff` genera HANDOFF.md + entrada en JOURNAL.md + DECISIONS.md pre-PR
- [.claude/commands/](./commands/) — slash commands custom del proyecto
- [.claude/skills/](./skills/) — skills compartidos del equipo. Ver [skills/README.md](./skills/README.md):
  - `frontend-design` — UI distintiva, anti AI-slop (antes de codear UI)
  - `shannon` — pentester autónomo (pre-PR en cambios sensibles: gate, webhook MP, RLS)
  - `code-reviewer` — review del diff (pre-push)
  - `browser-use` — testing e2e y screenshots
  - `claude-md-improver` — auditar y mejorar este archivo (pre-handoff)

A medida que vayamos creando flujos útiles, los guardamos acá para que todos los usemos igual.

---

## 13. Estado actual del proyecto

Ver [HANDOFF.md](./HANDOFF.md).
