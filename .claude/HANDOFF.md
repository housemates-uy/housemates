# HANDOFF — HOUSE MATES

> Estado actual del proyecto. Este archivo se reescribe en cada PR que se mergea (este va a `main`).
> Última actualización: 2026-11-02 por Facu (branch `feature/ticketera-completa`)

---

## Dónde estamos

**Fase:** Ticketera v1 publicada → **ticketera completa** (este PR) → configurar producción, cargar la fiesta de diciembre, pruebas finales y abrir la venta.

Este PR suma lo hecho en local entre el 28/10 y el 01/11: transferencia con comprobante, compra para
amigos, códigos de acceso y de descuento, transporte, barra con fotos, Mi cuenta (apagada), landing
editable, duplicar eventos, encuesta y dos auditorías. Se desarrolló y probó en la compu de Facu con
Supabase local en Docker: **nada de esto está publicado todavía**.

Cómo funciona todo hoy: **[docs/LOGICA_DE_NEGOCIO.md](../docs/LOGICA_DE_NEGOCIO.md)** (manda sobre el resto).

**Deploy:** al mergear a `main`, `.github/workflows/deploy.yml` publica solo en Vercel (producción).
Cada PR a `main` arma un preview con las variables de Preview de Vercel. Sin dominio propio todavía.

---

## Branch activa

`feature/ticketera-completa`: 7 commits sobre `main`, 212 archivos, migraciones `0009`–`0028`.
PR directo a **`main`** (no a `develop`) a pedido de un socio. Falta pushear la rama y abrir el PR.

**Antes de mergear (si no, la web publicada se rompe):**
1. OK de José y Tato a las migraciones `0009`–`0028`: cambian el flujo de pago y las reglas RLS (CLAUDE.md §10). Un comentario en el PR alcanza.
2. Backup de la base de producción y aplicar `0009`–`0028` en orden, justo antes de mergear. Vercel publica el código al mergear, pero **la base no se migra sola**. En `main` hay hasta la `0008`: confirmar en Supabase qué está aplicado para no repetir ninguna.
3. Revisar que existan los buckets que crean las migraciones: `comprobantes` (privado), `landing` y `bar` (públicos).
4. El preview del PR usa las variables de Preview: si apuntan a una base sin migrar, también falla.

---

## Qué está hecho

- **Compra (`/entradas`):** contraseña (prendida por defecto) o código de acceso; varias entradas nominativas por compra (tope de 1 a 10 en `/admin/config`); descuentos; tandas con ingreso temprano, "Próximamente" y preventa; bus; Mercado Pago (cargo 7,5 %) o transferencia con comprobante.
- **Entradas a confirmar (`/admin/confirmar`):** los owners aceptan o declinan las transferencias, una tarjeta por compra.
- **Pagos:** pagos tarde, repetidos, monto menor, cupones de Abitab/RedPagos, devoluciones y contracargos; avisos a los owners sin repetir.
- **Barra:** carta por evento con foto, pago con Mercado Pago al instante, un QR por trago, escáner del barman.
- **Puerta:** dos pasos, estado real de cada entrada, "Sin conexión" en vez de "QR inválido", lista CSV e imprimible, cerrar puerta.
- **Admin:** Ventas, Descuentos, Accesos, Barra, Transporte, Landing (textos, fotos y videos), duplicar eventos, eliminar solo lo que nunca se usó, menú de acciones, Historial con antes/después. El staff no ve plata ni comprobantes.
- **Mi cuenta para compradores:** hecha y probada, apagada desde `/admin/config`.
- **Mails:** entrada, comprobante recibido, rechazo, anulación, avisos a owners, pedido de barra, preventa y encuesta del día después (botón y cron diario). Salen por SMTP de Gmail.
- **Seguridad:** sin lectura pública con la anon key, límite de intentos por IP, redirecciones solo internas, cookies de Supabase `httpOnly`, `getUser()` en el admin.

### Modo local sin claves (`src/lib/auth/local-mode.ts`, #021)
Saltea la contraseña de compra y el login del admin **solo si se cumplen las cuatro**: `npm run dev`
(`NODE_ENV=development`), `LOCAL_SIN_CLAVES=1`, fuera de Vercel (sin `VERCEL`) y base de Docker
(`127.0.0.1`/`localhost`). En la web publicada nunca se prende. No cargar `LOCAL_SIN_CLAVES` ni `SMTP_HOST` en Vercel.

### Datos locales que no pasan a producción
Lo cargado en la base local (eventos, textos y fotos de la landing, carta de la barra, configuración)
no viaja con el PR: hay que cargarlo de nuevo en el admin publicado. Las fotos de los tragos están
listas en `.local/fotos-tragos` (fuera de git, solo en la compu de Facu).

---

## Qué está pendiente

**Publicar**
- Supabase de producción: migraciones (arriba), usuarios del admin (3 owners + staff de puerta y barra), URL Configuration y plantillas de mail apuntando a `/auth/confirm`, registro público apagado.
- Vercel: variables de Production y Preview (`docs/LOGICA_DE_NEGOCIO.md` §7 y §8), `CRON_SECRET` para los dos crons de `vercel.json`, y en GitHub los secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID` y `VERCEL_PROJECT_ID`.
- Dominio propio y `NEXT_PUBLIC_APP_URL`. Mails desde una casilla de la fiesta (Resend o Google Workspace).
- Mercado Pago: cuenta de la fiesta, modo prueba con su webhook y clave, después producción.
- Neue Montreal: subir `.woff2` y `.otf` con CORS y cargar `NEXT_PUBLIC_FONTS_URL` (sin eso se ve General Sans).
- Cargar la fiesta de diciembre en el admin publicado (evento, tandas, bus, carta, landing, configuración) y activar ventas al final.

**Pruebas finales (con la web publicada)**
- Mercado Pago de punta a punta, celulares reales (iPhone y Android), mails en Gmail, simulacro de puerta y barra.
- "Guardar imagen" de la entrada y del QR de barra: falla en Windows, en Vercel debería andar y nadie lo vio todavía.

**Lo que quedó de la auditoría**
- Next.js 14 → 15 (la 14 ya no recibe arreglos de seguridad; es dependencia: OK de los tres).
- Cambiar la contraseña del admin no pide la actual. CSP. Antes de prender Mi cuenta: cuentas creadas con el email de un futuro admin.
- Pedido de barra en celulares muy chicos (360 × 560). El límite de compras es por conexión (60 entradas cada 10 min).

**Docs:** CLAUDE.md §8 (RLS) y §7.2 (contraseña apagable, códigos) quedaron viejos; `docs/LOGICA_DE_NEGOCIO.md` §8 todavía habla de "cédula enmascarada".

---

## Bloqueos / Dudas abiertas

- **Migraciones `0009`–`0028` sin OK de José y Tato:** bloquean el merge.
- **Para decidir entre los tres:** contraseña y/o códigos de acceso, preventa para quienes ya vinieron, cuotas en Mercado Pago, cuándo prender Mi cuenta, medios de pago y máximo por compra, gastos (dominio, mails, Supabase Pro, Vercel Pro: el plan Hobby no es para uso comercial).
- **Detalles chicos:** texto de la encuesta, desarchivar deja en borrador, "Eliminar" del bus solo en el menú, ajuste visual del formulario de compra, "Whitelist" en el menú sin uso.
- **Barra:** una devolución hecha desde el panel de Mercado Pago no invalida los QR (límite conocido).
- **`develop` queda atrás de `main`** después de este PR: conviene ponerla al día (es rama protegida, coordinarlo). Lo único propio de `develop` es el cambio de CI #13 (previews solo en PRs a `main`).

---

## Decisiones recientes relevantes

- **#021** — Modo local sin claves con cuatro condiciones
- **#022** — Varias entradas nominativas en una compra (`create_order`, todo o nada)
- **#023** — Códigos de acceso para X entradas, además de la contraseña
- **#031** — Sin lectura pública con la anon key (RLS)
- **#032** — `getUser()` en el admin (supersede #015)

Ver `memoria/DECISIONS.md` para el historial completo (#001–#033).

---

## Quién hizo qué en la última sesión

- **Facu**, con Claude Code en su compu y Supabase local en Docker: los 7 commits del PR (28/10 al 01/11), la lista de pendientes para los socios y este handoff.

---

## Próximos pasos concretos

1. Pushear la rama, abrir el PR a `main` con la revisión automática en verde y pedir review a José o Tato.
2. OK escrito de José y Tato a `0009`–`0028`; backup y migraciones en producción justo antes de mergear.
3. Mergear con squash, recorrida rápida en la web publicada y poner `develop` al día con `main`.
4. Configurar Supabase, Vercel, mails y Mercado Pago (modo prueba); cargar la fiesta de diciembre y las fotos de los tragos en el admin publicado.
5. Pruebas finales y recién ahí activar ventas.
