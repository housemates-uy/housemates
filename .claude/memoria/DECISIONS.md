# DECISIONS — HOUSE MATES

> ADRs (Architecture Decision Records) livianos. Decisiones técnicas tomadas durante el diseño o implementación que no están obvias en los docs oficiales.
>
> **Reglas:**
> - Append-only: nunca se edita una decisión ya registrada
> - Si una decisión cambia → nueva entrada que la supersede (con link a la anterior)
> - Formato: contexto → decisión → alternativas descartadas → consecuencias
>
> Última entrada: #010

---

## #001 — Stack tecnológico

**Fecha:** 2026-04-14
**Autor:** José + Claude

**Contexto:** Definir el stack antes de arrancar.

**Decisión:** Next.js 14 (App Router) + TypeScript + Tailwind + Supabase + Mercado Pago Checkout Pro + Resend + Vercel.

**Alternativas descartadas:**
- Astro en lugar de Next: más rápido para landing estática pero admin panel interactivo empujó a Next.
- SendGrid / Postmark / SES: Resend ganó por DX y React Email nativo.
- Stripe: no es la opción realista en UY (costos de devisa + menor confianza local); MP es el estándar.
- Checkout Bricks de MP: más integración requerida, PCI indirecto. Checkout Pro (redirección) simplifica MVP.

**Consecuencias:**
- Todo el equipo necesita saber React/Next.
- Supabase resuelve DB + Auth + Storage en una plataforma (simplifica infra).
- Vercel hobby alcanza hasta que escale.

---

## #002 — Whitelist 100% manual

**Fecha:** 2026-04-14
**Autor:** José

**Contexto:** Cómo limitar que solo la comunidad deseada pueda comprar tickets. El password universal se termina filtrando a amigos de amigos, capas de IP/fingerprint no resuelven el problema real (un invitado real comprando para terceros no deseados).

**Decisión:**
- Whitelist de emails gestionada exclusivamente desde el admin
- No auto-populate tras compra
- No CSV bulk import
- No form público de "solicitar acceso"
- Agregado manual con textarea que acepta emails separados por coma
- Normalización: lowercase + strip gmail dots/+tag
- Si email no está en whitelist durante checkout → mensaje "escribinos por IG"

**Alternativas descartadas:**
- Capas de seguridad (IP + device fingerprint + CI único): no resuelve el problema real
- Access requests con form público: overhead innecesario, se canaliza por Instagram igual
- CSV bulk import: innecesario para el volumen (400-500 personas), el input por coma cubre el use case

**Consecuencias:**
- El equipo maneja manualmente la lista. Disciplina requerida.
- Password universal deja de ser barrera real, pasa a ser solo mística.
- DM de Instagram se vuelve canal oficial de solicitud de acceso.

---

## #003 — Cookie gate 1 día

**Fecha:** 2026-04-15
**Autor:** José

**Contexto:** Duración de la sesión tras ingresar password universal.

**Decisión:** Cookie `hm_access` vive **1 día exactamente** (HTTP-only, Secure, SameSite=Lax, firmada con iron-session).

**Alternativas descartadas:**
- 30 días: demasiado permisivo, el password filtrado queda activo mucho tiempo en devices ajenos
- Sesión del browser (cookie sin expires): se pierde contexto al cerrar tab, peor UX

**Consecuencias:**
- Usuarios recurrentes re-ingresan el password cada día. Aceptable por la mística.
- Reduce ventana si la cookie es robada.

---

## #004 — Moneda UYU únicamente

**Fecha:** 2026-04-14
**Autor:** José

**Contexto:** Definir si la ticketera maneja UYU, USD o ambos.

**Decisión:** Solo UYU.

**Consecuencias:**
- Setup de MP más simple (una sola currency).
- Si aparece demanda internacional (Brunch España, etc.), se revisa en v2.

---

## #005 — 1Password Teams como secret manager

**Fecha:** 2026-04-15
**Autor:** José + Claude

**Contexto:** Cómo compartir API keys entre José, Tato y Facu trabajando cada uno desde su Mac con Claude Code, sin mandarlas por WhatsApp/Slack/email.

**Decisión:** 1Password Teams ($24/mes los 3), vault compartido "HOUSE MATES", CLI `op` para inyectar secrets en dev (`op run --env-file=...`).

**Alternativas descartadas:**
- Bitwarden: más barato pero UX y CLI menos pulida
- Doppler: diseñado para secrets en apps pero free tier limitado y curva de aprendizaje
- Vercel + GitHub secrets: no cubre sharing entre devs ni dev local
- Mandar por Slack/WA: inaceptable por seguridad

**Consecuencias:**
- Costo fijo ~$24/mes incluso antes de lanzar.
- Requiere que los 3 tengan cuenta y manejen el flujo `op`.
- Auditoría y rotación granular habilitada.

---

## #006 — Scanner sin modo offline en v1

**Fecha:** 2026-04-15
**Autor:** José

**Contexto:** ¿Implementar cache offline del scanner por si la puerta pierde conexión?

**Decisión:** No en v1. El scanner requiere internet en puerta, y José confirma que la conectividad es confiable en el venue.

**Alternativas descartadas:**
- Cache IndexedDB + sync queue: ~3-4 días extra de dev, complejidad alta, conflict resolution no trivial

**Consecuencias:**
- Dependencia crítica de wifi/4G en la puerta el día del evento.
- Si alguna vez falla → entrada manual vía `/events/[id]/tickets` desde admin.
- Se reevaluará para v2 si aparece un evento con conectividad dudosa.

---

## #007 — Webhook MP idempotente con validación de firma

**Fecha:** 2026-04-15
**Autor:** José + Claude

**Contexto:** Mercado Pago puede reintentar el webhook múltiples veces y también pueden llegar webhooks falsificados.

**Decisión:**
1. Validar `x-signature` header contra `MP_WEBHOOK_SECRET` antes de procesar
2. GET a `/v1/payments/{id}` para obtener estado real (no confiar en el body)
3. Deduplicar por `mp_payment_id` (si ya existe con ese ID, no duplicar operación)
4. Responder 200 en todos los casos procesados exitosamente (incluso duplicados)

**Alternativas descartadas:**
- Confiar en body del webhook sin GET: vulnerable a manipulación
- No validar firma: exposición a falsificación trivial

**Consecuencias:**
- Toda la lógica de confirmación de pago es resistente a reintentos.
- Monitoreo en Sentry es crítico: si webhook falla silenciosamente, perdemos registros de pagos confirmados.

---

## #008 — `GATE_PASSWORD` en env var (temporal)

**Fecha:** 2026-04-15
**Autor:** José + Claude

**Contexto:** Feature `landing-gate` es el primer código ejecutable. No hay Supabase aún. ¿Dónde vive el password del gate?

**Decisión:** En una env var `GATE_PASSWORD` en v0. Rotable desde Vercel dashboard. Cuando entre Supabase (feature siguiente), migra a la tabla `site_config` con rotación desde `/admin/config` (ya contemplado en `docs/ARCHITECTURE.md`).

**Alternativas descartadas:**
- Pasar directo a `site_config`: requiere Supabase antes de deployar → retrasa el objetivo de tener algo en Vercel para comprar dominio.
- Hardcode en código: inaceptable por seguridad + requiere redeploy para rotar.

**Consecuencias:**
- Rotación manual vía Vercel env vars + redeploy. Aceptable para v0.
- Cuando migre a DB, actualizar el route handler `/api/gate` para leer de `site_config` con caché corto.

---

## #009 — Rate limit del gate con delay artificial

**Fecha:** 2026-04-15
**Autor:** José + Claude

**Contexto:** Evitar brute force del password universal. ¿Cómo sin agregar infra extra?

**Decisión:** Delay artificial de 500ms en todas las respuestas de fallo del endpoint `/api/gate`. Sin Redis, sin Upstash, sin contador. El delay por sí solo hace el brute force inviable: con 500ms por intento, probar 10k combinaciones toma >1h por cliente.

**Alternativas descartadas:**
- Upstash Redis (ya planeado en `docs/EXTERNAL_SERVICES.md`): overhead de setup y costo para v0. Se integra cuando haya endpoints más críticos (webhook MP, whitelist check, checkout).
- Contador en memoria por IP: Next.js en Vercel es serverless, la memoria no persiste entre invocations.
- Bloqueo temporal por IP: requiere storage externo → mismo problema.

**Consecuencias:**
- Ante ataque distribuido (botnet con muchas IPs) el delay solo lo ralentiza, no lo bloquea. Aceptable porque el password NO es la barrera real de acceso (lo es la whitelist de emails).
- En feature `feature/supabase-setup` o posterior se integra Upstash para rate limit por IP en endpoints sensibles.

---

## #010 — Skills compartidas copiadas al repo

**Fecha:** 2026-04-15
**Autor:** José

**Contexto:** Tato y Facu tienen Claude Code pero no tienen las skills que José usa. ¿Cómo compartirlas sin que cada uno las configure localmente?

**Decisión:** Copiar 5 skills relevantes al proyecto a `.claude/skills/` del repo (mismo patrón que comandos). Se commitean y cualquier miembro al clonar el repo las tiene.

Skills elegidas:
- `frontend-design` — UI distintiva (crítico para landing + admin)
- `shannon` — pentester autónomo (crítico pre-PR en gate, webhook MP, RLS)
- `code-reviewer` — review automático del diff
- `browser-use` — testing e2e + screenshots
- `claude-md-improver` — mantener el CLAUDE.md al día

**Alternativas descartadas:**
- Cada dev instala sus skills localmente: inconsistencia entre miembros, no garantiza que todos usen las mismas.
- Incluir `valyu-best-practices`: no aplica al stack HOUSE MATES (no hay uso de Valyu API).

**Consecuencias:**
- El `.claude/` del repo pesa más, pero sigue siendo razonable.
- Actualizar una skill requiere PR al repo (consistencia garantizada).
- Tato y Facu al clonar tienen el mismo toolkit que José.

---

<!-- Las próximas decisiones se agregan como #015, etc. -->

## #013 — Estrategia skeleton-first para el panel admin

**Fecha:** 2026-05-07
**Autor:** Tato

**Contexto:** El panel admin tiene ~10 secciones. Meterlas todas en una rama generaba PRs de 800+ líneas imposibles de revisar y riesgo de que un bug en el scanner bloqueara el merge de la whitelist.

**Decisión:** `feature/admin-base` cierra con el esqueleto completo: todas las páginas creadas como stubs navegables (UI con datos de solo lectura donde ya están disponibles). El CRUD de cada sección va en ramas separadas (`feature/admin-events`, `feature/admin-whitelist`, etc.) que parten de `develop` tras el merge de `admin-base`.

**Alternativas descartadas:**
- Todo en `admin-base`: PRs inrevisables, dependencias de merge entre features paralelas.
- Sin stubs (agregar páginas en cada feature): el sidebar tendría links rotos hasta que cada feature mergee; la navegación del panel no sería coherente.

**Consecuencias:**
- El sidebar está completo y navegable desde el primer merge.
- Cada feature siguiente solo agrega funcionalidad a una página que ya existe (contrato claro).
- Los PRs de feature son enfocados y pequeños.

---

## #014 — Gate password migrado de env var a `site_config` (supersede #008)

**Fecha:** 2026-05-07
**Autor:** Tato + Claude

**Contexto:** En `feature/landing-gate` se documentó (#008) que `GATE_PASSWORD` vivía en una env var temporalmente y migraría a `site_config` cuando llegara Supabase. Ese momento llegó.

**Decisión:** `api/gate/route.ts` ahora lee el password de la tabla `site_config` (key = `gate_password`) usando `createAdminClient()`. Si la fila no existe, hace fallback a `process.env.GATE_PASSWORD`. El admin panel en `/admin/config` permite cambiarlo con `updateGatePasswordAction` (solo owners). Se registra en `admin_logs` cada cambio.

**Alternativas descartadas:**
- Seguir con env var: requiere redeploy en Vercel para cada rotación de password. Inaceptable para operación normal del evento.
- Env var sin fallback: rompe entornos que no tienen la fila en DB aún.

**Consecuencias:**
- El gate password es rotable en tiempo real desde el panel sin redeploy.
- El fallback garantiza que staging/CI que usan env var siguen funcionando.
- Cada cambio queda auditado en `admin_logs`.

## #011 — Actualización de `@supabase/ssr` a 0.10.2

**Fecha:** 2026-05-04
**Autor:** Tato + Claude

**Contexto:** El código de los clientes Supabase (`server.ts`, middleware) fue escrito con la API `getAll/setAll` de `@supabase/ssr`. La versión instalada era 0.3.0, que usa la API vieja (`get/set/remove`). La librería ignoraba silenciosamente los callbacks de cookies — resultado: ninguna sesión se persistía después del login, el usuario nunca podía acceder al panel.

**Decisión:** Actualizar `@supabase/ssr` de `^0.3.0` a `0.10.2` (latest). El código ya estaba escrito con la API nueva — solo faltaba el paquete correcto.

**Alternativas descartadas:**
- Reescribir el código con la API vieja (`get/set/remove`): hubiera funcionado pero es la API deprecada. Mantener el código moderno y actualizar la dependencia es la decisión correcta.

**Consecuencias:**
- Sesiones de auth funcionan correctamente.
- Para futuras dependencias de Supabase: verificar siempre la versión instalada vs la API que se usa. La diferencia entre minor versions puede ser breaking.

---

## #012 — Creación de admins desde el dashboard de Supabase (v1)

**Fecha:** 2026-05-04
**Autor:** Tato

**Contexto:** El sistema necesita admins (owners + staff validadores). ¿Cómo se crean los usuarios? ¿Hay UI de registro en el panel, signup por email, o gestión manual?

**Decisión:** En v1, los admins se crean **manualmente desde el dashboard de Supabase**:
1. Crear usuario en Authentication → Users (Supabase maneja la password con bcrypt)
2. Insertar registro en la tabla `admins` con el UUID generado

No hay UI de self-registro ni de invitación. El set de admins es pequeño y fijo (owners + pocos staff). Ver instrucciones detalladas en `docs/EXTERNAL_SERVICES.md` §1.

Para **cambiar passwords**: desde el dashboard de Supabase o mediante `supabase.auth.updateUser()` desde el panel cuando `/admin/config` esté implementado.

**Alternativas descartadas:**
- UI de creación de admins en el panel: overhead innecesario para v1 con 2-3 admins totales
- Invitación por email con link de signup: más complejo, requiere flujo de onboarding extra
- Custom auth (passwords en DB propios): Supabase Auth ya resuelve esto de forma segura (bcrypt, JWT, reset por email)

**Consecuencias:**
- Cualquier miembro del equipo con acceso al dashboard de Supabase puede crear admins. Controlar quién tiene acceso al proyecto de Supabase.
- En v2, si el número de staff crece, considerar una UI de invitación desde el panel (`/admin/team`).
- El campo `active` en la tabla `admins` permite desactivar un admin sin borrarlo de Supabase Auth.

---

## #015 — `getSession()` en Server Actions en lugar de `getUser()`

**Fecha:** 2026-05-08
**Autor:** Tato

**Contexto:** `requireAdmin()` usaba `supabase.auth.getUser()`, que hace una call de red a
Supabase Auth. El middleware ya ejecuta `getUser()` en cada request para refrescar el token.
Dos calls de red por request causaban fallos bajo la carga de los tests e2e.

**Decisión:** Cambiar `getAdminUser()` a `supabase.auth.getSession()`. Lee de la cookie sin
red. Es seguro porque el middleware ya verificó el token antes de que el Server Action ejecute.

**Alternativas descartadas:**
- Mantener `getUser()`: correcta pero redundante, latencia adicional y fallos bajo carga.
- Pasar el user como prop al Server Action: no es posible con `.bind()` en Next.js 14.

**Consecuencias:**
- Un único call a Supabase Auth por request (middleware). Server Actions confían en la cookie.
- Si el middleware se bypasea, Server Actions podrían aceptar sesiones expiradas. Aceptable
  porque el middleware está en la cadena de cada request admin sin excepción.

---

## #016 — `sold_out_override` para marcar tiers agotadas manualmente

**Fecha:** 2026-05-08
**Autor:** Tato

**Contexto:** Los admins necesitan marcar una tanda como "agotada" antes de que se venda
el stock real. Sirve para mostrar escasez y empujar compras de la tanda actual.

**Decisión:** Columna `sold_out_override boolean NOT NULL DEFAULT false` en `ticket_tiers`.
Lógica de agotada: `sold_out_override || quantity_sold >= quantity_total`.

**Alternativas descartadas:**
- Reutilizar `active = false`: pierde la distinción "inactiva" (no lista) vs "agotada" (sin stock).
- `quantity_total = quantity_sold`: restaurar requiere recordar la cantidad original — destructivo.

**Consecuencias:**
- Requiere `ALTER TABLE ticket_tiers ADD COLUMN sold_out_override boolean NOT NULL DEFAULT false`
  en cada entorno. Dev ya corrida; producción pendiente al deployar.
- El checkout público deberá respetar este campo al validar disponibilidad de un tier.
