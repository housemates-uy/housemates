# Backlog — House Mates web

> Pedidos y pendientes, en orden de prioridad. Al terminar algo, se borra de acá y se
> documenta en `docs/LOGICA_DE_NEGOCIO.md` si cambia una regla.
> Última actualización: 2026-10-28. Ya hechos: cargo por servicio, tandas con precio y sin %, elegir tanda tocándola, guardar la entrada como imagen o PDF, mails de confirmación y anulación, pago por transferencia con comprobante, códigos de descuento, contraseña de compra opcional, portada y fotos nuevas.

## Ahora (antes de vender a amigos)

1. **Pulir el diseño del formulario de compra.** El flujo nuevo ya está (tanda → datos → código → Mercado Pago o transferencia). Falta el ajuste visual con las referencias de otras ticketeras (las manda Tato).
2. **Webhook de MP rechaza la firma.** Revisar que `MP_WEBHOOK_SECRET` en Vercel sea la clave secreta del webhook de **modo prueba** (y después la de producción).

## Para revisar

- **Cuotas en Mercado Pago.** En la cuenta de prueba solo aparece 1 cuota. Revisar en la **cuenta real** de la fiesta (Tu negocio → Costos / Cuotas) qué permite:
  - **Preferido:** cuotas **con interés**, que paga el comprador y la fiesta no paga nada extra. El cargo por servicio actual alcanza.
  - **Si solo se pueden cuotas sin interés** (~2,49 % + IVA extra para el vendedor): mostrar **dos cargos por servicio**, uno si paga en 1 cuota y otro, ~3 % más alto, si elige cuotas. Implica elegir "en cuotas / sin cuotas" antes de ir a Mercado Pago y limitar las cuotas en la preferencia según lo elegido.
- **Textos legales: revisión de un abogado.** `/terminos` y `/privacidad` son un borrador razonable (Ley 17.250 y Ley 18.331), no un texto validado. Antes de vender en serio, que un abogado los revise, y completar los datos marcados `A CONFIRMAR` en el código (también en `/preguntas-frecuentes`): razón social, RUT y domicilio, edad mínima, cierre de puerta, plazos de devolución, plan por lluvia, transporte, conservación de datos, transferencia internacional e inscripción de la base ante la URCDP. Buscar `A CONFIRMAR` en `src/app/`.

- **Links por mail con token para entrar a comprar** (cuando haya base de mails): campañas tipo "se viene la House Mates, tocá acá" con un link personal que da acceso a `/entradas` sin código. Hoy se entra solo con códigos (ADR #041).

## Mails

Hechos: **compra confirmada** (MP, manual, invitación, transferencia aprobada), **entrada anulada**, **transferencia recibida**, **aviso a los owners** y **transferencia rechazada**, más "Reenviar mail" en el admin. Se mandan desde el Gmail de Tato (`ssouber99@gmail.com`).

**Pendiente:** dominio propio de la fiesta y casilla `no-reply@<dominio>` con Resend. Solo cambia `src/lib/mail/send.ts`.

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

- **Apple Wallet** (cuenta Apple Developer USD 99/año).
- **Dominio propio** + mails desde Resend.
- **Webhook al admin de finanzas** (2027).
