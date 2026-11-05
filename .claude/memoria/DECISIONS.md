# DECISIONS — HOUSE MATES

> ADRs (Architecture Decision Records) livianos. Decisiones técnicas tomadas durante el diseño o implementación que no están obvias en los docs oficiales.
>
> **Reglas:**
> - Append-only: nunca se edita una decisión ya registrada
> - Si una decisión cambia → nueva entrada que la supersede (con link a la anterior)
> - Formato: contexto → decisión → alternativas descartadas → consecuencias
>
> Última entrada: #040

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

---

## #017 — Landing pública; la contraseña protege solo la compra (supersede parte de #014)

**Fecha:** 2026-10-02
**Autor:** Tato

**Contexto:** El objetivo de la ticketera es no perder ventas por fricción. Con la landing
detrás de contraseña nadie que llega desde Instagram ve nada, y la whitelist de emails en el
checkout volvía a frenar la compra.

**Decisión:**
- La landing (`/`) es pública. La contraseña se pide solo para `/entradas` y el futuro `/checkout`.
- La whitelist de emails sale del checkout. El control pasa a ser: contraseña rotada por los
  owners desde `/admin/config` + entrada nominativa (nombre + CI + email + Instagram), una por
  CI y una por email por evento, con revisión y anulación desde el admin.
- La sesión del gate guarda la huella (`sha256`, 16 chars) de la contraseña con la que se
  entró. Al rotarla, las cookies anteriores dejan de valer (`hasGateAccess()` en `src/lib/auth/gate.ts`).

**Alternativas descartadas:**
- Códigos personales de un solo uso: más seguros, pero suman trabajo manual por venta.
- Mantener la whitelist: contradice el objetivo de conversión.

**Consecuencias:**
- `.claude/CLAUDE.md` §1 y §7.1 quedan desactualizadas respecto a la whitelist; manda esta decisión.
- El middleware solo corre en `/admin`, `/api/admin`, `/entradas` y `/checkout`.

---

## #018 — Neue Montreal fuera del repo

**Fecha:** 2026-10-02
**Autor:** Tato

**Contexto:** El manual de marca usa Neue Montreal (paga). El repo es público: commitear los
archivos sería redistribuir la fuente.

**Decisión:** Los `.woff2` viven en `public/fonts/` (gitignored) en local y en un hosting aparte
en deploy, apuntado con `NEXT_PUBLIC_FONTS_URL`. `src/lib/fonts.ts` genera los `@font-face`.
Sin la variable, el deploy cae a Helvetica Neue / Arial.

**Alternativas descartadas:**
- Repo privado: Vercel Hobby no despliega repos privados de una organización.
- General Sans (gratis): el equipo tiene licencia de Neue Montreal y prefiere la fuente del manual.

---

## #019 — Validador web dentro del mismo proyecto y QR opaco

**Fecha:** 2026-10-02
**Autor:** Tato

**Decisión:** El scanner de puerta es una página del admin (`/admin/events/[id]/scan`), no una
app nativa. El QR codifica un token aleatorio de 128 bits guardado en `tickets.qr_token` en lugar
del HMAC previsto: si no está en la base, no existe. Un solo uso garantizado con
`UPDATE ... WHERE used_at IS NULL RETURNING`. Ventas por transferencia e invitaciones se cargan
como tickets `manual` / `invitation` y generan el mismo QR, así la puerta usa un solo validador.

**Orden de implementación:** tickets manuales + QR + scanner → checkout Mercado Pago → mails → recordatorios.

---

## #020 — Ticketera v1: lógica en Postgres, reservas de 20 min y Mercado Pago Checkout Pro

**Fecha:** 2026-10-17
**Autor:** Tato

**Decisión:**
- Las reglas críticas viven en funciones de Postgres (`create_ticket`, `confirm_ticket_payment`, `cancel_ticket`, `check_in_ticket`, migración 0006) para que sean atómicas.
- Unicidad email/CI por evento con índices parciales: solo entradas `pending/paid/used`. Antes un UNIQUE total bloqueaba para siempre a quien abandonaba un pago o tenía una entrada anulada.
- Compra web: reserva `pending` de 20 min, sin cron (la disponibilidad ignora reservas vencidas). Pagos que llegan tarde se honran.
- Confirmación por dos caminos (webhook + página de resultado), siempre consultando el pago a la API de MP.
- Invitaciones dentro de la pantalla de Entradas (se eliminó la pestaña aparte).

**Por qué:** POC de venta real a amigos para la fiesta del 11.12.26 sin dominio propio ni mails.

**Consecuencias:** sin mail de confirmación; el comprador ve su entrada al volver de MP y las manuales se mandan por WhatsApp. Documentado en `docs/LOGICA_DE_NEGOCIO.md`.

---

## #021 — Modo local sin claves, con cuatro condiciones

**Fecha:** 2026-10-28
**Autor:** Facu + Claude

**Contexto:** Desarrollar y probar recorridos completos en la compu (compra, admin, puerta, barra) sin cargar la contraseña de compra ni usuarios del admin, en un repo público que publica solo al mergear a `main`.

**Decisión:** `isLocalNoAuth()` (`src/lib/auth/local-mode.ts`) saltea la contraseña de `/entradas` y el login del admin solo si se cumplen las cuatro:
1. `NODE_ENV === 'development'` (`npm run dev`; `next build` lo fija en `production`).
2. `LOCAL_SIN_CLAVES=1` en `.env.local`.
3. No corre en Vercel (`VERCEL` sin definir; Vercel lo define también en los previews).
4. `NEXT_PUBLIC_SUPABASE_URL` es la base de Docker (`http://127.0.0.1` o `localhost`): nunca contra datos reales.

Además, `npm run dev` escucha solo en `127.0.0.1` y el middleware responde 403 si el `Host` no es `127.0.0.1` o `localhost`. En este modo el admin actúa como el primer owner activo (o crea uno de prueba, por las FK de `admin_logs`, `check_ins` y `bar_scans`) y la barra muestra "Simular pago".

**Alternativas descartadas:** no quedaron registradas. Cada condición cubre un error distinto: la variable cargada en Vercel, un build de producción o un `.env.local` apuntando a la base real.

**Consecuencias:**
- En la web publicada nunca aplica. Probado con un build de producción con la variable puesta: el admin pide login, `/entradas` pide contraseña y no aparece "Simular pago".
- No cargar `LOCAL_SIN_CLAVES` (ni `SMTP_HOST`) en Vercel. Para probar desde el celular en la misma red: `npx next dev -H 0.0.0.0` sin `LOCAL_SIN_CLAVES` (README).

---

## #022 — Varias entradas nominativas en una compra

**Fecha:** 2026-10-28
**Autor:** Facu + Claude

**Contexto:** Quien compra quiere sumar a sus amigos y pagar todo junto, sin perder la regla de una entrada por persona (CLAUDE.md §7.3) ni el cotejo de cédula en puerta.

**Decisión:**
- Una compra es un grupo de entradas, cada una con nombre, cédula y email propios. La entrada 1 es la de quien compra. Tope en `site_config.max_tickets_per_order` (1 a 10, arranca en 6).
- `create_order` (`0020`, última versión en `0021`) crea todas en una transacción: si una falla no queda ninguna, y el error dice cuál (`'<motivo>#<n>'`).
- Sin tabla nueva: `tickets.order_id` apunta a la entrada de quien compró (que se apunta a sí misma). Las entradas viejas y las manuales son un grupo de una.
- Un pago de Mercado Pago o un comprobante para todo el grupo: `confirm_order_payment`, `extend_order_hold` y `reverse_order_payment`. `tickets.mp_payment_id` deja de ser único.
- Cada persona recibe su entrada a su mail. Reembolsar una entrada del grupo devuelve solo su parte.

**Alternativas descartadas:**
- Una entrada por compra (como hasta ahora): cada amigo tenía que hacer su propia compra.
- Entradas de los amigos a nombre de quien compra: rompe la entrada nominativa y el cotejo de cédula en puerta.

**Consecuencias:**
- Con la contraseña, quien la tiene puede comprar hasta el tope para amigos que no pasaron por Instagram; con un código de acceso (#023), solo las entradas del código.
- La idempotencia del webhook la dan el bloqueo de la entrada y el control de estado, no la unicidad de `mp_payment_id`. Detalle en `docs/LOGICA_DE_NEGOCIO.md` §5.2e.

---

## #023 — Códigos de acceso para X entradas, además de la contraseña (complementa #017)

**Fecha:** 2026-10-29
**Autor:** Facu + Claude

**Contexto:** La venta es selectiva: quien quiere ir escribe por Instagram y los owners deciden. La contraseña compartida (#017) se pasa de mano en mano y no dice quién entró con ella.

**Decisión:**
- Tabla `access_codes` (`0021`): el owner crea en Admin → evento → **Accesos** un código para X entradas (1 a 1000), con vencimiento opcional. 8 caracteres al azar sin letras ni números que se confundan (`src/lib/access-codes.ts`).
- Se usa con el link `/acceso/<código>` o en `/access` ("Contraseña o código") y queda en la cookie `hm_access` (24 h). Sirve solo para el próximo evento publicado.
- Cada entrada comprada con el código gasta un uso y queda marcada (`tickets.access_code_id`). Cuentan las vivas y las reservas vigentes. `create_order` bloquea la fila del código y usa el de la cookie, nunca uno que mande el formulario. Quien entró solo con código compra siempre con él.
- La contraseña sigue: prendida por defecto (`site_config.gate_enabled`, `0010`) y solo se apaga con un `'0'` explícito.
- Límite de intentos: 20 cada 15 min por IP para códigos (un grupo comparte wifi); la contraseña sigue en 5 cada 15 min.

**Alternativas descartadas:**
- Solo la contraseña (#017): con ella se compra hasta el tope por compra para cualquiera.
- Códigos personales de un solo uso (descartados en #017 por trabajo manual por venta): un código para X entradas cubre a un grupo con un solo mensaje.

**Consecuencias:**
- Los socios eligen cómo combinarlos (contraseña y códigos, solo códigos o sin contraseña).
- CLAUDE.md §7.2 no menciona los códigos ni que la contraseña se puede apagar. Detalle en `docs/LOGICA_DE_NEGOCIO.md` §3 y §3b.

---

## #024 — Interruptor de Mi cuenta, apagada por defecto

**Fecha:** 2026-10-29
**Autor:** Facu + Claude

**Contexto:** Las cuentas de compradores (`0011`: mismo Supabase Auth que los admins + tabla `customers`) quedaron hechas y probadas, pero suman mails (confirmar email, recupero) y hay un punto de seguridad abierto: cuentas creadas con el email de un futuro admin.

**Decisión:** `site_config.accounts_enabled`, que se cambia desde `/admin/config` (solo owners) y queda en el Historial. Apagada es el valor por defecto, también si falta la fila o la base no responde (`isAccountsEnabled` en `src/lib/customers.ts`):
- la web no muestra nada de cuentas (ni "Creá una contraseña" al comprar, ni Ingresar o Mi cuenta);
- en el servidor no se crean cuentas (la contraseña se ignora), `getCustomer` no devuelve sesión y `/cuenta/*` lleva al inicio.

**Alternativas descartadas:**
- Prenderla ya: más mails por el Gmail actual (tope de ~500 por día) y el punto de seguridad sin resolver.
- Sacar el código de cuentas: está hecho y probado; con el interruptor se prende cuando decidan los socios.

**Consecuencias:** antes de prenderla, resolver las cuentas con email de un futuro admin y tener los mails desde una casilla de la fiesta. Una cuenta de comprador no da acceso al admin: sigue haciendo falta la fila activa en `admins`.

---

## #025 — Cédula completa en la entrada (decisión de los owners) — reemplazada por #040

**Fecha:** 2026-10-29
**Autor:** Facu + Claude

**Contexto:** En puerta se coteja la entrada con el documento físico (dos pasos, `docs/LOGICA_DE_NEGOCIO.md` §5.3).

**Decisión:** la cédula va completa y con formato (`4.097.298-0`, `formatDocument`) en `/ticket/<token>`, en la imagen que se guarda y en los mails de la entrada, del comprobante recibido, de anulación y de rechazo.

**Alternativas descartadas:**
- Últimos 4 dígitos (`CI •••• 298-0`, lo de antes): los owners prefirieron la cédula entera, para cotejarla con el documento en puerta.

**Consecuencias:** cualquiera con el link de la entrada ve la cédula completa; lo que la protege es el token opaco de 22 caracteres (#019). `docs/LOGICA_DE_NEGOCIO.md` §8 todavía menciona la "cédula enmascarada".

---

## #026 — Barra: pago con Mercado Pago al instante (`binary_mode`)

**Fecha:** 2026-10-29
**Autor:** Facu + Claude

**Contexto:** Los tragos se compran antes o durante la fiesta y se retiran en la barra. Un pago que se acredita al día siguiente llega con la fiesta terminada.

**Decisión:**
- La preferencia de barra va con `binary_mode: true` (aprobado o rechazado al instante) y excluye los tipos `ticket` y `atm` (sin Abitab ni RedPagos). Vence cuando termina el evento.
- `confirm_bar_order_payment` (`0027`) devuelve `duplicate_payment` (pedido ya pago con otro pago) y `event_ended` (pago con la fiesta terminada): el pedido no cambia y los owners reciben "Pago de barra para revisar". Lo mismo con un monto menor al total.

**Alternativas descartadas:**
- Aceptar efectivo como en las entradas (reserva estirada hasta el vencimiento del cupón): el cupón se pagaría con la fiesta terminada.

**Consecuencias:** la barra se paga solo con tarjeta. Las devoluciones de barra siguen por fuera: una devolución desde el panel de MP no marca el pedido `refunded` (límite conocido, `docs/LOGICA_DE_NEGOCIO.md` §9).

---

## #027 — Fotos de los tragos en bucket público, con la ruta en la base

**Fecha:** 2026-11-01
**Autor:** Facu + Claude

**Contexto:** Mostrar una foto de cada trago en `/barra`, cargada por los owners desde Admin → evento → Barra.

**Decisión:**
- Bucket público `bar` de Supabase Storage (`0028`), sin policies en `storage.objects`: con la anon key nadie sube ni borra.
- El navegador achica la foto (lado más largo 1400 px, WebP o JPG) y el servidor la sube con la service key, después de controlar por los primeros bytes que sea JPG, PNG o WebP de hasta 4 MB.
- La base guarda solo la ruta dentro del bucket (`bar_products.image_path`, con un `CHECK` de formato `<evento>/<8 hex>.<ext>`). La URL se arma con `NEXT_PUBLIC_SUPABASE_URL` (`barImageUrl` en `src/lib/bar.ts`).
- Al duplicar un evento, la carta nueva usa el mismo archivo; se borra del bucket cuando ya no lo usa ningún trago.

**Alternativas descartadas:** no quedaron registradas. A diferencia de las fotos y videos de la landing, no hay subida directa con link firmado: la foto ya llega achicada.

**Consecuencias:** las fotos cargadas en la base local no pasan a producción; hay que subirlas de nuevo en el admin publicado. Sin fotos, la carta se ve como antes.

---

## #028 — Duplicar eventos en una sola transacción

**Fecha:** 2026-10-29
**Autor:** Facu + Claude

**Contexto:** Cada fiesta se arma como la anterior.

**Decisión:** `duplicate_event` (`0023`, última versión en `0028`), desde `/admin/events/<id>/duplicar` (solo owners), con título y fechas nuevas:
- **Copia:** datos del evento (lugar, mapa, capacidad, formato, descripción, imágenes, lineup), tandas con 0 vendidas y sin fechas de salida, transporte y carta de la barra (con foto).
- **No copia:** nada de la gente (entradas, compras, check-ins, códigos de descuento y de acceso, pedidos de barra, comunicaciones, encuestas).
- Queda en borrador, con ventas apagadas, puerta abierta y barra sin pausar. Slug con `-2`, `-3`… si existe. La tanda de preventa recibe otro código (`PRE-XXXXXX`), así el link de la fecha anterior no abre la nueva.

**Alternativas descartadas:** no quedaron registradas. Va en una sola transacción de Postgres, como las demás reglas críticas (#020).

**Consecuencias:** después de duplicar hay que revisar lugar, tandas y precios, transporte y barra (la pantalla lo avisa). Queda en el Historial con el evento de origen.

---

## #029 — Mails sin repetir con `email_log.send_key`

**Fecha:** 2026-10-28
**Autor:** Facu + Claude

**Contexto:** Si dos envíos corrían a la vez (dos owners, un doble clic o el cron mientras un owner mandaba a mano), los dos calculaban los mismos pendientes y les mandaban a todos. Y los avisos de pagos a los owners eran uno por entrada: un segundo problema del mismo pago no avisaba.

**Decisión:**
- `email_log.send_key` con índice único (`0019`). Encuesta: antes de mandar, se reserva cada destinatario con una fila en `sending` (`ON CONFLICT DO NOTHING`) y el mail sale solo si la reserva entró. Al terminar pasa a `sent`, o a `failed` sin `send_key` para poder reintentar. Una reserva colgada más de 10 minutos se vuelve a tomar.
- Claves: `<tipo>:<entrada>` para "Mandar" y el cron; `<tipo>:<entrada>:<desde>` para "Reenviar a todos"; `payment_alert:<entrada>:<problema>:<pago>` y `payment_alert:bar:<pedido>:<problema>:<pago>` para los avisos a owners.
- La preventa usa `presale_sends` (única por tanda y email), con la misma reserva en `sending`.

**Alternativas descartadas:**
- Calcular los pendientes y mandar (lo de antes): dos envíos a la vez duplicaban.
- Un aviso de pago por entrada (lo de antes): se perdía el segundo problema de la misma compra.

**Consecuencias:** el aviso no se repite cuando MP reintenta el webhook. Límite conocido: dos "Reenviar a todos" iniciados a la vez sí pueden duplicar.

---

## #030 — Transferencia con comprobante, validada por los owners

**Fecha:** 2026-10-28
**Autor:** Facu + Claude

**Contexto:** Parte de la venta es por transferencia bancaria. Hasta ahora un admin cargaba cada una a mano como entrada `manual` (#019).

**Decisión:**
- En `/entradas`, "Transferencia bancaria": datos de la cuenta, total exacto y sin cargo por servicio. La persona sube el comprobante (foto, captura o PDF hasta 4 MB) al bucket **privado** `comprobantes`.
- La entrada nace `pending` (reserva de 15 min) y pasa a `review` con `receipt_path` en un solo UPDATE que exige que siga `pending`. En `review` el lugar queda reservado sin vencimiento.
- Un owner la acepta o la declina en **Entradas a confirmar** (`/admin/confirmar`): `approve_transfer` exige comprobante (`no_receipt`) y `reject_transfer` libera tanda y bus. El comprobante se ve con un link firmado de 60 s, solo para owners.

**Alternativas descartadas:**
- Seguir cargándolas a mano como `manual`: un owner tipeaba cada venta.
- Crear la entrada directo en `review`: si la subida se cortaba, quedaba una entrada en revisión sin comprobante bloqueando cédula, email y lugar (`0016`).

**Consecuencias:** hasta que un owner la valida, la persona no tiene QR. Una transferencia aprobada no se reembolsa desde la web: se anula y la plata se devuelve por fuera.

---

## #031 — Sin lectura pública con la anon key (cambia CLAUDE.md §8)

**Fecha:** 2026-10-28
**Autor:** Facu + Claude

**Contexto:** Con la anon key se podían leer todas las columnas de `events` y `ticket_tiers` (incluidos `presale_code` y `quantity_sold`). Con cuentas de compradores, la policy `tickets_lectura_dueno` (`0003`) dejaba leer desde la API, con la sesión, entradas de cualquier email con la cédula completa.

**Decisión:** RLS prendido y sin policies de lectura pública: se borran `tickets_lectura_dueno` (`0011`), `eventos_lectura_publica` y `tiers_lectura_publica` (`0016`), y se revoca `tier_available` a `anon` y `authenticated`. La app lee todo desde el servidor con la service key.

**Alternativas descartadas:**
- Lectura pública limitada (CLAUDE.md §8): una policy filtra filas, no columnas, así que exponía `presale_code`.

**Consecuencias:** no cambia nada visible. CLAUDE.md §8 quedó desactualizado; como es un cambio de RLS, necesita el OK de José y Tato (CLAUDE.md §10).

---

## #032 — `getUser()` en el admin (supersede #015)

**Fecha:** 2026-10-28
**Autor:** Facu + Claude

**Contexto:** #015 pasó `getAdminUser()` a `getSession()`, que lee la cookie sin verificar el token y confía en que el middleware ya lo validó.

**Decisión:** `getAdminUser()` (`src/lib/auth/admin.ts`) usa `supabase.auth.getUser()`, que valida el JWT contra Supabase Auth, envuelto en `cache` de React: una sola llamada por request aunque lo pidan el layout, la página y las pestañas. Si Supabase no responde, tira error ("Sin conexión") en vez de tratarlo como sesión vencida.

**Alternativas descartadas:**
- Mantener `getSession()` (#015): si una ruta queda fuera del middleware, acepta una sesión vencida.

**Consecuencias:** vuelve la segunda llamada a Supabase Auth por request (middleware + admin) que #015 quería evitar. En puerta y barra, una caída de red muestra "Sin conexión" y se reintenta sin echar al portero.

---

## #033 — General Sans como respaldo de Neue Montreal (complementa #018)

**Fecha:** 2026-10-28
**Autor:** Facu + Claude

**Contexto:** #018 deja Neue Montreal fuera del repo; sin `NEXT_PUBLIC_FONTS_URL` la web caía a Helvetica Neue / Arial. El deploy desde GitHub Actions no tiene `public/fonts/`.

**Decisión:** sin `NEXT_PUBLIC_FONTS_URL`, la web usa General Sans desde Fontshare (licencia ITF Free Font, libre para uso comercial), la alternativa gratuita que indica el mismo manual de marca (`src/lib/fonts.ts`). Las imágenes que se guardan (entrada y QR de barra, `src/lib/image-fonts.ts`) usan la misma letra; para Neue Montreal necesitan los `.otf`, porque next/og no lee `.woff2`.

**Alternativas descartadas:**
- Helvetica Neue / Arial (#018): no es la alternativa que da el manual.

**Consecuencias:** Neue Montreal se ve solo cuando se suben sus `.woff2` y `.otf` a un hosting propio con CORS y se carga `NEXT_PUBLIC_FONTS_URL`.

---

## #034 — Códigos de acceso públicos (una entrada por compra) e Instagram obligatorio (complementa #023)

**Fecha:** 2026-11-05
**Autor:** Facu + Claude (reunión de socios)

**Contexto:** los socios quieren poner un código en las historias de Instagram sin que quien lo usa pueda sumar amigos, y poder mirar el perfil de cada persona que compra para anular si es sospechoso. El código de #023 era siempre "para X entradas" y el Instagram era opcional.

**Decisión:**
- `access_codes.kind` (`0029_access_code_kind.sql`): `personal` (como #023, con X entradas obligatorias) o `public`. El público lleva **una entrada por compra**; con la regla de una por email y una por cédula, cada persona saca como mucho una. Su total es opcional: `max_uses` pasa a admitir `NULL` (sin tope) solo para los públicos (check `access_codes_personal_max_uses`); el rango 1–1000 sigue.
- Se controla en el servidor: la acción de compra corta antes de reservar y `create_order` también (`access_single#2`, y sin tope no cuenta usos). Se redefinió desde su última versión (`0021`), con esos dos cambios y nada más.
- Combinación con la contraseña: un código **personal** sigue la regla de #023 (con entradas en la cookie manda en la compra aunque haya contraseña; sin entradas, con la contraseña no limita). Un código **público** con la contraseña no se usa: la contraseña ya deja comprar para amigos. Sin contraseña, siempre con el código.
- Instagram obligatorio en cada entrada de la compra web (quien compra y cada amigo), validado en el formulario y en la acción (`instagramRequiredSchema`, `src/lib/validation/instagram.ts`, sin zod para que lo use el navegador): `@usuario`, `usuario` o el link del perfil; letras, números, puntos y guiones bajos, hasta 30. Se sigue guardando sin @ y en minúsculas en `buyer_instagram` (como ya estaba, así la búsqueda y las vistas no cambian). En las entradas manuales del admin sigue opcional. En "A confirmar" y Entradas, el Instagram de cada persona va con link al perfil.

**Alternativas descartadas:**
- Que con la contraseña el código público limite igual a una entrada: castigaba a quien tiene la contraseña por haber entrado antes con el link de las historias.
- Público con un tope alto en lugar de `NULL`: el admin mostraría "3 de 1000" y el código figuraría Agotado sin que nadie lo decidiera.
- Exigir el Instagram también en `create_order`: la acción es el único borde que la llama; la regla queda en un solo lugar y las entradas manuales no cambian.
- Guardar el Instagram con @: rompía las vistas y la búsqueda que ya agregan el @.

**Consecuencias:**
- Con un código público, quien quiera sumar a un amigo puede hacer otra compra a su nombre: no se puede evitar sin cuentas de compradores.
- Quien entró con un código público y después consigue la contraseña sigue de a una entrada mientras dure la cookie (24 h): `/access` no se muestra a quien ya tiene acceso.
- Las entradas compradas antes, sin Instagram, quedan como están.

---

## #035 — Anular una transferencia exige el comprobante de devolución

**Fecha:** 2026-11-05
**Autor:** Facu + Claude (reunión de socios)

**Contexto:** una entrada cobrada por transferencia se anulaba con un clic y la plata se devolvía por fuera, sin que quedara constancia de que se devolvió (#030).

**Decisión:**
- Una entrada `paid` cobrada por transferencia (compra web con `payment_method = 'transfer'`, o `manual`) y de más de $0 se anula solo subiendo el comprobante de la devolución: JPG, PNG, WebP o PDF, hasta 4 MB, con el tipo sacado de los primeros bytes.
- Se guarda en el bucket privado `comprobantes` (`devoluciones/<entrada>/<8 hex>.<ext>`) y la ruta en `tickets.refund_receipt_path` (`0030_refund_receipts.sql`, con CHECK del formato). El admin la ve con un link firmado de 60 s, solo owners, como el de la transferencia.
- La regla está en la acción y también en `cancel_ticket`: sin ruta devuelve `refund_receipt_required`. La anulación y la ruta van en el mismo UPDATE. El archivo se sube antes; si al final no se anula, se borra.
- Las entradas manuales entran en la regla porque el alta dice "Lo que pagó por transferencia".
- Sin cambios: Mercado Pago, transferencias en revisión, cortesías y entradas de $0.

**Alternativas descartadas:**
- Exigirlo solo en la pantalla: la acción del servidor se puede llamar sin el formulario.
- Marcarla `refunded`: ese estado significa "devuelta por Mercado Pago" y cambiaría el mail ("Te devolvimos por Mercado Pago"), las estadísticas y Mi cuenta.
- Subir el comprobante después de anular: una caída en el medio deja la entrada anulada sin constancia.

**Consecuencias:** `cancel_ticket` tiene un tercer parámetro (se borró la versión de dos). En una compra de varias se sube un comprobante por cada entrada que se anula. El mail de anulación de una transferencia sigue sin hablar de la devolución.

---

## #036 — La barra se abre solo con el QR de la fiesta o el link de las historias

**Fecha:** 2026-11-05
**Autor:** Facu + Claude (reunión de socios)

**Contexto:** `/barra` estaba abierta a cualquiera que escribiera la dirección. Los socios quieren que se llegue solo desde el QR impreso en la fiesta o desde el link de las historias de Instagram.

**Decisión:**
- Cada evento tiene una clave al azar: `events.bar_key`, 16 hex de `new_bar_key()` (`0031_bar_access.sql`, única y con CHECK del formato). `duplicate_event` le pone una nueva a la copia.
- `/barra/k/<clave>` deja la cookie `hm_barra` (httpOnly, `path=/barra`, 24 h) con esa clave y manda a `/barra` con una redirección relativa.
- `/barra` y las acciones que arman el pedido (`startBarCheckoutAction` y la de simular) piden que la cookie coincida con la clave del próximo evento (`hasBarAccess` en `src/lib/bar-access.ts`). Sin eso, el aviso "La barra se abre con el QR de la fiesta o con el link de nuestras historias de Instagram" y no la carta.
- "Cambiar link" (owners) pone otra clave: como la cookie guarda la clave, también dejan de valer las cookies del link viejo. No se saltea en modo local.
- La página del pedido y la de cada QR siguen con su token.

**Alternativas descartadas:**
- Firmar la cookie o guardar una huella: no suma nada, porque quien tiene la cookie ya tiene el link.
- Un "link" por cada historia o una clave que rote sola: más cosas para manejar, para algo que solo evita que se escriba la URL a mano.
- Reusar la contraseña del gate: la barra no pide la contraseña de compra, y el QR impreso tiene que andar sin escribir nada.

**Consecuencias:** quien abre el link en el navegador de Instagram y después pasa a otro navegador no tiene la cookie ahí. El link se puede reenviar (por WhatsApp, por ejemplo): es un filtro, no un control de quién compra. Preguntas frecuentes sigue linkeando a `/barra`, que ahora muestra el aviso. Al pasar a producción, la `0031` genera una clave para cada evento existente: el QR se imprime después de aplicarla.

---

## #037 — Usuario de barra: rol `barra`, solo `/scan`, rechazado en un solo lugar

**Fecha:** 2026-11-05
**Autor:** Facu + Claude (reunión de socios)

**Contexto:** los barmans necesitan el escáner de barra y nada más. Con el staff de siempre veían todo el admin (ventas, entradas, la puerta).

**Decisión:**
- Valor nuevo `barra` en `admin_role` (`0031`; la migración no lo usa, porque un valor nuevo de enum no sirve en la misma transacción en que se agrega).
- El rechazo está centralizado en `src/lib/auth/admin.ts`:
  - `getAdminUser`, y con él `requireAdmin` y `requireOwner`, devuelve solo owners y staff (`PanelAdmin`).
  - A un usuario de barra lo manda a `/scan` con `redirect()`. En las acciones que hacen `.catch(() => null)` queda como "sin sesión".
  - Así cada página, acción y ruta del admin, y la puerta, lo rechazan sin cambios, y una pantalla nueva también.
- Solo `getScanUser` (para `/scan`) y `requireBarScanner` (para las acciones del escáner de barra) lo dejan pasar, y solo con la fiesta de `getScanEvent`: la publicada en curso o terminada hace menos de 6 h o, si no, la próxima.
- `/scan`: sin sesión, el middleware manda a `/admin/login?next=/scan` (el login acepta `next` con `safeNextPath`).
  - Con usuario de barra muestra el escáner de barra de esa fiesta.
  - Con owner o staff muestra links a la puerta y la barra.
- El owner crea el usuario en Admin → Administradores, con email (que no tenga ya un usuario de Auth), nombre y contraseña.
- En modo local, si el navegador tiene la sesión de un admin real, el admin usa esa en vez del owner local. Sirve para probar este rol.

**Alternativas descartadas:**
- Chequear el rol en cada página y acción: es fácil olvidarlo en una pantalla nueva.
- Redirigir en el middleware: necesita leer `admins` con la service key en cada navegación del admin, y no cubre acciones ni rutas.
- Guardar el rol en `app_metadata` del usuario: sería una segunda fuente de verdad que se desincroniza de `admins`.
- Reusar `staff`: el staff tiene que seguir viendo la puerta y el resto del panel.

**Consecuencias:**
- `getAdminUser` ya no es solo de lectura: con un usuario de barra corta la página con una redirección.
- El usuario de barra no puede cambiarse la contraseña: `/admin/account` es del panel, y "Olvidé mi contraseña" lo deja en `/scan` con una al azar. La cambia o lo desactiva un owner, desde Supabase.
- El login del admin en local sigue salteado, así que el flujo `/scan` → login → `/scan` se prueba con la compilación de producción.

---

## #038 — Base de compradores para mailing, de solo lectura sobre las entradas

**Fecha:** 2026-11-05
**Autor:** Facu + Claude (reunión de socios)

**Contexto:** los socios quieren guardar los mails de quienes ya compraron como base para avisar de futuras fiestas. CLAUDE.md §7.1 prohíbe llenar la whitelist sola después de cada compra.

**Decisión:** pantalla `/admin/compradores` y CSV `/admin/compradores/csv`, solo para owners. No es una tabla nueva ni toca la whitelist: se calcula en el momento desde `tickets` (`src/app/admin/(panel)/compradores/buyers.ts`), así que no choca con §7.1. Desde ahí no se manda nada.
- Un email por persona (agrupado por `buyer_email_normalized`), de entradas `paid` o `used` de cualquier evento, cortesías incluidas. Anuladas y reembolsadas no cuentan, igual que en `presale_audience`.
- Nombre y email de la última entrada cargada, última fiesta, cantidad de fiestas y si pidió la baja.
- La baja usa el mismo criterio que la preventa (email normalizado en `whitelist` con status `banned`). Las bajas se ven en la pantalla, pero no salen en el CSV.
- El CSV va como la lista de la puerta (`;`, UTF-8 con BOM, apóstrofo adelante de `=`, `+`, `-` o `@`). Cada descarga queda en `admin_logs` (`download_buyers_csv`).
- Sin migración: se agrupa en el servidor, trayendo las entradas de a 1000.

**Alternativas descartadas:**
- Llenar la whitelist o una tabla de contactos con cada compra: es el auto-populate que prohíbe §7.1, y habría que mantenerla al día con anulaciones y reembolsos.
- Mandar los mails desde el admin: se decidió solo la lista y el CSV. La preventa sigue siendo el único mail masivo.
- Una función SQL (migración `0032`): con unos pocos miles de entradas, agrupar en el servidor alcanza. Si la base crece mucho, se pasa a una función como `presale_audience`.

**Consecuencias:** es una base con datos personales de todos los que compraron: queda solo para owners y cada descarga se registra. Para sacar a alguien del mailing se carga la baja en la whitelist, la misma que ya respeta la preventa.

---

## #039 — Lugar, reglas y preguntas frecuentes detrás de la contraseña, resuelto en el servidor

**Fecha:** 2026-11-05
**Autor:** Facu + Claude (reunión de socios)

**Contexto:** la landing era pública entera: cualquiera que llegaba desde Instagram veía dónde es la fiesta, las reglas y las preguntas frecuentes (que también dicen el lugar). Los socios quieren que eso lo vea solo quien ya consiguió la contraseña o un código. Además, el header tenía Barra, Entradas y el Instagram con el mismo peso.

**Decisión:**
- **Con acceso = `hasGateAccess()`** (contraseña, código con entradas o contraseña apagada), el mismo criterio que `/entradas`.
- **Lugar:** sin acceso, `src/app/page.tsx` le saca al evento `locationName` y `locationUrl` antes de pasárselo a cualquier componente. "Dónde" muestra un texto de relleno desenfocado (no es el lugar) y el link a `/access?next=/#fecha`.
- **Reglas:** sin acceso no se dibujan. Queda el título y el botón Entrar (`/access?next=/#reglas`).
- **Preguntas frecuentes:** sin acceso redirige a `/access?next=/preguntas-frecuentes`. `safeNextPath` ya deja volver ahí, con el `#` incluido.
- **Sin caché:** la landing y Preguntas frecuentes pasan a `force-dynamic` (antes `revalidate` 60 y 300). Si no, una copia generada con acceso podía servirse a cualquiera.
- **Base lenta:** la landing espera el chequeo de acceso hasta 2,5 s, como el resto de sus lecturas. Si falla o no responde, se ve como sin acceso.
- **Header:** solo Entradas, sólido con el brillo azul eléctrico del neón de la portada, más "Mi cuenta" si está prendida. Barra e Instagram salen del header (el Instagram sigue en el pie; la Barra, en Preguntas frecuentes y por link directo).

**Alternativas descartadas:**
- Desenfocar con CSS el texto real: el nombre y el link quedan en el HTML y en el payload de React.
- Pedir el lugar desde el cliente a un endpoint: es más código para lo mismo, y el primer dibujo sale sin el lugar aun con acceso.
- Esconder la sección de reglas entera: sin aviso, no se entiende que hay algo más al entrar.

**Consecuencias:** la landing y Preguntas frecuentes se arman en cada visita, con una consulta más a la base (si la contraseña está prendida). Quien entró con un código y ya usó todas sus entradas deja de tener acceso y ve la versión bloqueada (el lugar lo tiene en su entrada y en el mail). La descripción del evento sigue siendo pública: el lugar no se escribe ahí.

---

## #040 — La entrada vuelve a mostrar la cédula parcial

**Fecha:** 2026-11-05
**Autor:** Facu + Claude (reunión de socios)

**Contexto:** con #025 la entrada (página, imagen guardada y mails) mostraba la cédula completa. Cualquiera con el link de la entrada o con un mail reenviado la ve.

**Decisión:** la entrada, su imagen y los mails muestran la cédula parcial ("CI •••• 298-0", `maskDocument` en `src/lib/tickets.ts`). La completa aparece solo al escanear, en el escáner de la puerta, para cotejarla con el documento, y en las pantallas del admin.

**Alternativas descartadas:**
- Cédula completa en la entrada (#025): expone el documento a cualquiera con el link.

**Consecuencias:** reemplaza a #025. En puerta el portero coteja con lo que muestra el escáner, no con la entrada.
