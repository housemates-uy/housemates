# HANDOFF — HOUSE MATES

> Estado actual del proyecto. Este archivo se reescribe en cada PR que se mergea (este va a `main`).
> Última actualización: 2026-11-05 por Facu (branch `feature/ticketera-completa`, PR #14)

---

## Dónde estamos

**Fase:** Ticketera v1 publicada → **ticketera completa** (PR #14) → configurar producción, cargar la fiesta de diciembre, pruebas finales y abrir la venta.

El PR suma lo hecho en local entre el 28/10 y el 01/11 (transferencia con comprobante, compra para
amigos, códigos de acceso y de descuento, transporte, barra con fotos, Mi cuenta apagada, landing
editable, duplicar eventos, encuesta y dos auditorías) y **las correcciones de la reunión de socios
del 05/11** (abajo). Se desarrolló y probó en la compu de Facu con Supabase local en Docker:
**nada de esto está publicado todavía**.

Cómo funciona todo hoy: **[docs/LOGICA_DE_NEGOCIO.md](../docs/LOGICA_DE_NEGOCIO.md)** (manda sobre el resto).

**Deploy:** al mergear a `main`, `.github/workflows/deploy.yml` publica solo en Vercel (producción).
Cada PR a `main` arma un preview con las variables de Preview de Vercel. Sin dominio propio todavía.

---

## Branch activa

`feature/ticketera-completa` → PR #14 a **`main`** (no a `develop`, a pedido de un socio). Migraciones `0009`–`0031`.

**Antes de mergear (si no, la web publicada se rompe):**
1. OK de José y Tato a las migraciones `0009`–`0031`: cambian el flujo de pago, el de QR, roles del admin y las reglas RLS (CLAUDE.md §10). Un comentario en el PR alcanza.
2. Backup de la base de producción y aplicar `0009`–`0031` en orden, justo antes de mergear. Vercel publica el código al mergear, pero **la base no se migra sola**. En `main` hay hasta la `0008`: confirmar en Supabase qué está aplicado para no repetir ninguna.
3. Revisar que existan los buckets que crean las migraciones: `comprobantes` (privado), `landing` y `bar` (públicos).
4. El preview del PR usa las variables de Preview: si apuntan a una base sin migrar, también falla.
5. Después de la `0031`: imprimir el QR de la barra y cargar su link en las historias (Admin → evento → Barra); la clave se genera con la migración.

---

## Qué está hecho

- **Compra (`/entradas`):** contraseña o código de acceso (personal con N entradas, o público de historias: 1 entrada por compra); varias entradas nominativas por compra (tope 1–10 en `/admin/config`); **Instagram obligatorio en cada entrada**; descuentos; tandas con ingreso temprano, "Próximamente" y preventa; bus; Mercado Pago (cargo 7,5 %) o transferencia con comprobante.
- **Portada:** arriba solo el botón Entradas. **El lugar, las reglas y las preguntas frecuentes se ven recién con la contraseña o un código**; sin acceso, el servidor ni manda el lugar.
- **Entrada:** QR, cédula **parcial** ("CI •••• 298-0"); la completa la ve solo el escáner de la puerta.
- **Entradas a confirmar (`/admin/confirmar`):** los owners aceptan o declinan las transferencias, con el Instagram de cada persona a la vista.
- **Anular una transferencia ya cobrada exige el comprobante de devolución** (bucket privado, se ve desde el admin).
- **Pagos:** pagos tarde, repetidos, monto menor, cupones, devoluciones y contracargos; avisos a los owners sin repetir.
- **Barra:** carta con foto, mismo precio que la barra presencial (sin cargo), pago al instante, un QR por trago. **Se abre solo con el QR impreso o el link de las historias** (`/barra/k/<clave>`, se cambia desde el admin).
- **Usuario de barra:** rol `barra`, entra por **`/scan`** y solo ve el escáner de barra; todo lo demás del admin lo rechaza `getAdminUser()`.
- **Compradores (`/admin/compradores`):** base de quienes compraron (sin repetir, con bajas) y CSV para mailing. Solo owners; es de solo lectura sobre las entradas, no llena la whitelist.
- **Puerta:** dos pasos, estado real de cada entrada, lista CSV e imprimible, cerrar puerta.
- **Admin:** Ventas, Descuentos, Accesos, Barra, Transporte, Landing, duplicar eventos, menú de acciones, Historial con antes/después. El staff no ve plata ni comprobantes.
- **Mi cuenta para compradores:** hecha y probada, apagada desde `/admin/config`.
- **Mails:** entrada, comprobante recibido, rechazo, anulación, avisos a owners, pedido de barra, preventa y encuesta del día después. Salen por SMTP de Gmail.

### Modo local sin claves (`src/lib/auth/local-mode.ts`, #021)
Saltea la contraseña de compra y el login del admin **solo si se cumplen las cuatro**: `npm run dev`,
`LOCAL_SIN_CLAVES=1`, fuera de Vercel y base de Docker. En la web publicada nunca se prende (probado
con la compilación de producción). No cargar `LOCAL_SIN_CLAVES` ni `SMTP_HOST` en Vercel.

### Datos locales que no pasan a producción
Lo cargado en la base local (eventos, textos y fotos de la landing, carta de la barra, configuración)
no viaja con el PR: hay que cargarlo de nuevo en el admin publicado. Las fotos de los tragos están
listas en `.local/fotos-tragos` (fuera de git, solo en la compu de Facu).

---

## Qué está pendiente

**Publicar**
- Supabase de producción: migraciones (arriba), usuarios del admin (3 owners, staff de puerta y usuarios de barra), URL Configuration y plantillas de mail apuntando a `/auth/confirm`, registro público apagado.
- Vercel: variables de Production y Preview (incluido el SMTP de Gmail), `CRON_SECRET` para los dos crons, y en GitHub los secrets del deploy.
- Dominio propio y `NEXT_PUBLIC_APP_URL`. Mercado Pago: cuenta de la fiesta, modo prueba con su webhook, después producción.
- Cargar la fiesta de diciembre en el admin publicado y activar ventas al final.

**Pruebas finales (con la web publicada):** compra por transferencia con mails reales, Mercado Pago de punta a punta, celulares reales, simulacro de puerta y barra, "Guardar imagen".

**Lo que quedó de la auditoría:** Next.js 14 → 15 (OK de los tres); cambiar la contraseña del admin no pide la actual; CSP.

---

## Bloqueos / Dudas abiertas

- **Migraciones `0009`–`0031` sin OK de José y Tato:** bloquean el merge.
- **Para confirmar:** las entradas cargadas a mano con monto también piden comprobante de devolución al anularlas (el formulario dice "Lo que pagó por transferencia").
- **La descripción del evento** se ve sin contraseña: no escribir ahí el lugar.
- **Usuario de barra:** su contraseña se cambia o se desactiva desde Supabase (no hay pantalla).
- **`develop` queda atrás de `main`** después de este PR: ponerla al día (rama protegida, coordinarlo).
- **Docs viejos:** CLAUDE.md §7.1 (whitelist: ver #038), §7.2 (contraseña apagable, códigos) y §8 (RLS).

---

## Decisiones recientes relevantes

- **#034** — Códigos públicos (1 entrada por compra) e Instagram obligatorio
- **#035** — Anular una transferencia exige el comprobante de devolución
- **#036 / #037** — Barra solo con QR o link; rol `barra` solo en `/scan`
- **#038** — Base de compradores para mailing, de solo lectura (no choca con §7.1)
- **#039 / #040** — Lugar, reglas y FAQ tras la contraseña; cédula parcial en la entrada

Ver `memoria/DECISIONS.md` para el historial completo (#001–#040).

---

## Quién hizo qué en la última sesión

- **Facu**, con Claude Code en su compu y Supabase local en Docker: el PR #14 y las correcciones de la reunión de socios del 05/11.

---

## Próximos pasos concretos

1. Review del PR #14 por José o Tato, con su OK a `0009`–`0031`.
2. Backup y migraciones en producción justo antes de mergear; mergear con squash.
3. Poner `develop` al día con `main`; recorrida rápida en la web publicada.
4. Configurar Supabase, Vercel, SMTP y Mercado Pago (modo prueba); cargar la fiesta de diciembre, las fotos de los tragos y el QR de la barra.
5. Pruebas finales y recién ahí activar ventas.
