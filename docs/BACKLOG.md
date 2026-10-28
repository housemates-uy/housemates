# Backlog — House Mates web

> Pedidos y pendientes, en orden de prioridad. Al terminar algo, se borra de acá y se
> documenta en `docs/LOGICA_DE_NEGOCIO.md` si cambia una regla.
> Última actualización: 2026-10-27. Ya hechos: cargo por servicio, tandas con precio y sin %, elegir tanda tocándola, guardar la entrada como imagen o PDF, mails de confirmación y anulación.

## Ahora (antes de vender a amigos)

1. **Rediseño del formulario de compra.** Hoy es muy básico. Esperando referencias de otras ticketeras (las manda Tato).
2. **Webhook de MP rechaza la firma.** Revisar que `MP_WEBHOOK_SECRET` en Vercel sea la clave secreta del webhook de **modo prueba** (y después la de producción).

## Para revisar

- **Cuotas en Mercado Pago.** En la cuenta de prueba solo aparece 1 cuota. Revisar en la **cuenta real** de la fiesta (Tu negocio → Costos / Cuotas) qué permite:
  - **Preferido:** cuotas **con interés**, que paga el comprador y la fiesta no paga nada extra. El cargo por servicio actual alcanza.
  - **Si solo se pueden cuotas sin interés** (~2,49 % + IVA extra para el vendedor): mostrar **dos cargos por servicio**, uno si paga en 1 cuota y otro, ~3 % más alto, si elige cuotas. Implica elegir "en cuotas / sin cuotas" antes de ir a Mercado Pago y limitar las cuotas en la preferencia según lo elegido.

## Mails

Hechos: **compra confirmada** (MP, manual, invitación) y **entrada anulada**, más "Reenviar mail" en el admin. Se mandan desde el Gmail de Tato (`ssouber99@gmail.com`).

**Pendiente:** dominio propio de la fiesta y casilla `no-reply@<dominio>` con Resend. Solo cambia `src/lib/mail/send.ts`. Los mails de transferencias se implementan con esa funcionalidad (diseños ya aprobados en Claude Design).

Diseños: Claude Design → "Mails House Mates".

| Mail | A quién | Cuándo |
|---|---|---|
| Compra confirmada (con QR y link) | Comprador | MP aprueba el pago, o un admin carga una entrada manual o invitación |
| Transferencia recibida, en revisión | Comprador | Sube el comprobante |
| Hay una transferencia para validar | Los admins | Alguien sube un comprobante |
| Transferencia aprobada → entrada | Comprador | Un admin la valida (mismo mail que "compra confirmada") |
| Transferencia rechazada | Comprador | Un admin la rechaza ("contactanos por Instagram") |
| Entrada anulada (+ reembolso si fue por MP) | Comprador | Un admin anula por algo raro: email duplicado, colado, etc. |

Si el pago con MP falla no se manda mail: Mercado Pago ya lo avisa y devuelve a la web para reintentar.

## Después

- **Pago por transferencia con comprobante** (imagen, captura o PDF):
  - El comprador sube el archivo y queda la entrada "en revisión": no se le muestra QR, sino "vamos a validar tu transferencia y te llega la entrada por mail".
  - En el admin, cada evento tiene una sección **"Entradas a validar"**, con el comprobante, y botones Aprobar / Rechazar.
  - Mails según la tabla de arriba.
- **Apple Wallet** (cuenta Apple Developer USD 99/año).
- **Dominio propio** + mails desde Resend.
- **Webhook al admin de finanzas** (2027).
