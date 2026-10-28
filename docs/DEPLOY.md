# DEPLOY — HOUSE MATES

> Pasos para desplegar la app en Vercel, conectar dominio, configurar DNS y rotar secrets.
> Este doc persiste en el repo — no depende de archivos efímeros.

---

## 1. Requisitos previos

- Cuenta GitHub con acceso al repo `ssouberbielle/housemates`
- Cuenta Vercel (plan Hobby alcanza para v1)
- 1Password Teams con vault **HOUSE MATES** creado
- Dominio disponible (o aún por registrar)

---

## 2. Deploy inicial a Vercel (primera vez)

### 2.1 Conectar el repo
1. Ingresar a [vercel.com/new](https://vercel.com/new)
2. Importar `ssouberbielle/housemates`
3. Configurar:
   - **Framework preset:** Next.js (autodetect)
   - **Root directory:** `/`
   - **Build command:** `next build` (default)
   - **Output directory:** `.next` (default)
   - **Install command:** `npm install` (default)
   - **Node.js version:** 20.x

### 2.2 Configurar branches
En Vercel → Project → Settings → Git:
- **Production branch:** `main`
- **Preview deployments:** habilitado para `develop` y todas las `feature/*`

### 2.3 Generar secrets únicos por entorno
```bash
# Un valor por cada entorno (dev local, preview, production).
openssl rand -base64 32
```

Guardar los 3 valores generados en **1Password → vault HOUSE MATES**:
- `GATE_COOKIE_SECRET (local)` — ya está en `.env.local` de cada dev
- `GATE_COOKIE_SECRET (preview)`
- `GATE_COOKIE_SECRET (production)`

### 2.4 Definir `GATE_PASSWORD` inicial
Definir con el equipo el password para la edición actual. Debe ser corto, memorable, no obvio. Ejemplo: `mvd2026` (cambiar por algo propio).
Guardar en 1Password como `GATE_PASSWORD (production)`.

### 2.5 Setear env vars en Vercel
Vercel → Project → Settings → Environment Variables. Crear por cada entorno:

| Variable | Development | Preview | Production |
|---|---|---|---|
| `GATE_PASSWORD` | cada dev en su `.env.local` | valor preview | valor prod |
| `GATE_COOKIE_SECRET` | cada dev en su `.env.local` | valor preview | valor prod |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `https://housemates-develop.vercel.app` | `https://<dominio-final>` |

**Tip:** en Vercel CLI podés setear con:
```bash
vercel env add GATE_PASSWORD production
```

### 2.6 Primer deploy
Al mergear el primer PR a `develop`, Vercel hace preview deploy automático. Abrir la URL del preview y validar:
- `/` redirige a `/access`
- `/access` renderiza el gate
- Password correcto → `/` muestra landing
- Password incorrecto → error + delay

---

## 3. Compra y conexión del dominio

### 3.1 Registrar dominio
Recomendado: **Cloudflare Registrar** (precio al costo, privacy incluida).
Alternativa: Namecheap, Porkbun.

### 3.2 Agregar dominio en Vercel
Vercel → Project → Settings → Domains → Add.
Vercel muestra los DNS records necesarios.

### 3.3 Configurar DNS
En el panel del registrar (Cloudflare/Namecheap):

```
Type    Name    Value                       TTL
A       @       76.76.21.21                 Auto
CNAME   www     cname.vercel-dns.com        Auto
CNAME   admin   cname.vercel-dns.com        Auto    (para subdominio admin futuro)
```

**Si usás Cloudflare:** poner el registro en modo **"DNS only"** (nube gris), no proxy naranja. Vercel maneja el SSL.

### 3.4 Verificar SSL
Vercel emite certificado automáticamente vía Let's Encrypt. Esperar ~5 min tras configurar DNS.

### 3.5 Actualizar `NEXT_PUBLIC_APP_URL`
Vercel → Env vars → editar `NEXT_PUBLIC_APP_URL` en production con el dominio real. Redeploy para que tome efecto.

### 3.6 Redirect www → apex
Vercel → Domains → marcar el apex como dominio principal. Vercel redirige `www` automáticamente.

---

## 4. Flujo de releases

```
feature/* → PR → develop (preview deploy automático)
develop → PR → main (production deploy automático)
```

Regla: nunca push directo a `main` ni `develop`. Branch protection ya configurada en GitHub.

---

## 5. Rotar `GATE_PASSWORD`

Cuándo rotar:
- Tras cada edición de fiesta (si el password se filtró)
- Si se sospecha que un password llegó a gente no deseada

Proceso:
1. Generar nuevo password con el equipo (corto, memorable, no obvio)
2. Vercel → Env vars → editar `GATE_PASSWORD` en production
3. Redeploy (Deployments → Redeploy último)
4. Actualizar `GATE_PASSWORD (production)` en 1Password
5. Comunicar el nuevo password a la comunidad por el canal definido (IG stories/DM, etc.)

Nota: el password vive en env var en v1. En features futuras migrará a la tabla `site_config` en Supabase (ver `docs/ARCHITECTURE.md`).

---

## 6. Troubleshooting

### Cookie no se setea
- En production requiere HTTPS (Secure flag activo). Si el preview no tiene HTTPS (nunca pasa con Vercel), la cookie no se setea.
- Verificar que `GATE_COOKIE_SECRET` tenga ≥32 caracteres.

### "Server misconfigured" al enviar password
- Falta `GATE_PASSWORD` en el entorno. Setear en Vercel y redeployar.

### Build falla con "Cannot find module"
- Correr `npm install` localmente para regenerar `package-lock.json`.
- Verificar que el `package-lock.json` está commiteado.

### Cambié env var y no aplica
- Vercel requiere redeploy para que env vars nuevas tomen efecto. Ir a Deployments → Redeploy.

### Preview deploy con password de producción
- Vercel scopes env vars por environment. Verificar que `GATE_PASSWORD` para Preview es distinto del de Production.

---

## 7. Monitoreo post-deploy

- **Uptime:** Vercel expone métricas básicas en Analytics.
- **Logs:** Vercel → Deployments → Logs. Buscar errores del webhook o del gate.
- **Sentry** (opcional, siguiente feature): integrar `@sentry/nextjs` cuando la app crezca.

---

## 8. Checklist rápido

- [ ] Cuenta Vercel creada y conectada a repo
- [ ] Secrets generados y guardados en 1Password
- [ ] Env vars seteadas en Vercel (dev/preview/prod)
- [ ] Primer preview deploy verificado
- [ ] Dominio registrado
- [ ] DNS configurado y SSL activo
- [ ] `NEXT_PUBLIC_APP_URL` actualizado en production
- [ ] Redirect www → apex
- [ ] Todo el equipo tiene acceso al vault 1Password
