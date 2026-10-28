# HOUSE MATES — Manejo de credenciales

> Guía obligatoria para todo el equipo. Aplica a José, Tato, Facu y cualquier colaborador futuro.
> Última actualización: 2026-05-04

---

## Regla fundamental

**Nunca compartir credenciales por WhatsApp, Slack, email, GitHub, ni en el chat de Claude.**

Si accidentalmente pegás una key en alguno de esos canales, tratala como comprometida y rotala de inmediato.

---

## 1. Dónde vive cada credencial

### Desarrollo local (tu Mac)

Archivo **`.env.local`** en la raíz del repo.

- Está en `.gitignore` → nunca llega al repositorio
- Lo crea cada dev una sola vez copiando el template:
  ```bash
  cp .env.example .env.local
  ```
- Los valores reales se completan a mano (ver sección 4 — cómo obtenerlos)

### Producción y staging

**Vercel → Settings → Environment Variables** del proyecto.

- Cada variable tiene scope: `Production` / `Preview` / `Development`
- Solo los owners de la cuenta Vercel pueden verlas o modificarlas
- Una vez seteadas, Vercel no las muestra en texto plano

### Compartir entre el equipo

**Plan definitivo:** 1Password Teams, vault `HOUSE MATES` (ver `docs/EXTERNAL_SERVICES.md` §9).

**Hasta que 1Password esté activo:** mensaje directo privado (cara a cara, llamada, o DM directo de confianza). Nunca en grupos, canales compartidos ni herramientas de texto indexadas.

---

## 2. Variables de entorno del proyecto

### Cómo leer esta tabla

| Columna | Significado |
|---|---|
| `NEXT_PUBLIC_*` | Visible en el navegador — nunca secretos reales |
| Server only | Solo se usa en API routes / Server Components |
| Quién la genera | El servicio o el dev que la crea |

### Variables completas

| Variable | Alcance | Quién la genera | Descripción |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase dashboard | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Supabase dashboard | Clave pública (protegida por RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Supabase dashboard | Bypass RLS — NUNCA al cliente |
| `GATE_COOKIE_SECRET` | **Server only** | Dev (random) | Firma la cookie `hm_access` — mínimo 32 chars |
| `GATE_PASSWORD` | **Server only** | Equipo | Password universal del gate (temporal, migra a DB) |
| `QR_HMAC_SECRET` | **Server only** | Dev (random) | Firma los tokens QR — mínimo 32 chars |
| `MP_PUBLIC_KEY` | Client + Server | Mercado Pago | Identifica la app en MP (no es secreta) |
| `MP_ACCESS_TOKEN` | **Server only** | Mercado Pago | Autoriza llamadas a la API de MP |
| `MP_WEBHOOK_SECRET` | **Server only** | Mercado Pago | Valida el header `x-signature` |
| `RESEND_API_KEY` | **Server only** | Resend dashboard | Envía emails |
| `RESEND_FROM` | **Server only** | Dev | Ej: `HOUSE MATES <hola@housemates.com>` |
| `CRON_SECRET` | **Server only** | Dev (random) | Protege `/api/cron/*` de llamadas externas |
| `NEXT_PUBLIC_SENTRY_DSN` | Client + Server | Sentry dashboard | Reporta errores (no es secreta) |
| `SENTRY_AUTH_TOKEN` | Build only | Sentry dashboard | Sube source maps en el build |
| `NEXT_PUBLIC_APP_URL` | Client + Server | Dev | `http://localhost:3000` en dev |
| `NEXT_PUBLIC_ADMIN_URL` | Client + Server | Dev | `http://admin.localhost:3000` en dev |

### Cómo generar los secrets random

Para `GATE_COOKIE_SECRET`, `QR_HMAC_SECRET`, `CRON_SECRET`:

```bash
# opción 1 — openssl (viene en Mac)
openssl rand -base64 32

# opción 2 — node
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Generar uno diferente por entorno (dev, staging, prod). Nunca reusar el mismo valor.

---

## 3. Qué NO hacer nunca

- `NEXT_PUBLIC_SUPABASE_URL` es pública, `SUPABASE_SERVICE_ROLE_KEY` **no lo es** — nunca mezclarlas
- Nunca pegar una key en un comentario de código
- Nunca loggear variables de entorno (`console.log(process.env)`)
- Nunca hardcodear un valor en el código fuente aunque sea "temporal"
- Nunca commitear `.env.local`, `.env`, `.env.production` (están en `.gitignore`)
- Nunca subir keys a GitHub aunque sea en un branch privado
- Nunca compartir la `service_role` key de Supabase con nadie fuera del equipo técnico

---

## 4. Cómo obtener cada credencial

### Supabase
1. [supabase.com](https://supabase.com) → tu proyecto → Settings → API
2. Copiás: `Project URL`, `anon` public key, `service_role` secret key
3. Guardás en 1Password (o compartís por canal seguro hasta que 1Password esté activo)

### Mercado Pago
1. [mercadopago.com.uy/developers](https://www.mercadopago.com.uy/developers) → Tu aplicación → Credenciales
2. Test (sandbox) para dev, Producción para prod
3. El webhook secret lo generás/configurás en la sección de webhooks

### Resend
1. [resend.com](https://resend.com) → API Keys → Create API Key
2. Scope: `Full access` para envío

### Iron-session (GATE_COOKIE_SECRET)
Generado por el equipo con el comando de la sección anterior. Un valor para dev, otro para prod.

---

## 5. Rotación de credenciales

### Cuándo rotar

| Situación | Qué rotar |
|---|---|
| Un dev deja el proyecto | `GATE_COOKIE_SECRET`, `QR_HMAC_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` |
| Se sospecha compromiso de cualquier key | Esa key específica + las que dependen de ella |
| Cambio del password del gate (`GATE_PASSWORD`) | Solo esa var (o desde `/admin/config` cuando esté implementado) |
| Rotación preventiva anual | Todas las keys de server |

### Cómo rotar

1. Generar nueva key
2. Actualizar en Vercel (production + preview)
3. Actualizar en `.env.local` de cada dev (avisar al equipo)
4. Actualizar en 1Password (o el canal seguro del momento)
5. Si hay un redeploy pendiente: deployar para que tome efecto

**Nota sobre `GATE_COOKIE_SECRET`:** rotar esta key invalida todas las cookies activas. Todos los usuarios tendrán que re-ingresar el password del gate. Es el comportamiento esperado.

---

## 6. Si accidentalmente commitiaste una credencial

1. **Inmediatamente:** rotar la key en el servicio correspondiente (la vieja queda inválida)
2. Eliminarla del historial de git:
   ```bash
   git filter-repo --path <archivo> --invert-paths
   # o si es una línea específica en un archivo:
   git filter-repo --replace-text <(echo 'VALOR_COMPROMETIDO==>REDACTED')
   ```
3. Force push al remote (coordinar con el equipo)
4. Si era la `service_role` de Supabase o el `MP_ACCESS_TOKEN`: avisar al equipo de inmediato y revisar logs del servicio por uso no autorizado
5. Generar una nueva key y actualizar en todos los entornos

---

## 7. Estructura del `.env.local`

El archivo `.env.example` en el repo tiene todos los nombres de variables sin valores. Así se ve un `.env.local` completo:

```bash
# --- Supabase ---
NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# --- Gate ---
GATE_COOKIE_SECRET=[32+ chars random]
GATE_PASSWORD=[password del evento]

# --- QR ---
QR_HMAC_SECRET=[32+ chars random]

# --- Mercado Pago ---
MP_PUBLIC_KEY=TEST-...
MP_ACCESS_TOKEN=TEST-...
MP_WEBHOOK_SECRET=[secret de webhook]

# --- Resend ---
RESEND_API_KEY=re_...
RESEND_FROM=HOUSE MATES <hola@housemates.com>

# --- Cron ---
CRON_SECRET=[32+ chars random]

# --- App ---
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ADMIN_URL=http://admin.localhost:3000
NODE_ENV=development
```

---

## 8. Notas para Claude Code

Claude no accede a `.env.local` ni a las variables de entorno en tiempo de ejecución. Si necesitás que Claude trabaje con un endpoint que requiere credenciales, corré el dev server vos y testealo desde el browser o con `curl`. Nunca pegues una API key en el chat para que Claude la use.
