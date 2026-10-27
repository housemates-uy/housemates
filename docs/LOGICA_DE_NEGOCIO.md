# Lógica de negocio — House Mates web

> Cómo funciona la app, explicado para alguien que no escribió el código.
> Si cambiás una regla de negocio, actualizá este documento en el mismo PR.
> Última actualización: 2026-10-17.

---

## 1. Qué es esto

Una sola app (Next.js en Vercel + base Postgres en Supabase) con tres partes:

| Parte | Para quién | Dónde |
|---|---|---|
| **Sitio público** | Cualquiera que llega desde Instagram | `/` |
| **Compra de entradas** | Quien tiene la contraseña del momento | `/entradas` |
| **Admin** | Los socios (owners) y el staff de puerta | `/admin` |

Las entradas son **QR personales**: una por persona, a nombre y cédula, y de un solo uso en puerta.

---

## 2. Mapa de rutas

### Públicas (no piden nada)

| Ruta | Qué hace | Archivo |
|---|---|---|
| `/` | Landing: próxima fecha, tandas, la casa, reglas | `src/app/page.tsx` |
| `/access?next=…` | Pide la contraseña del gate y te manda a `next` | `src/app/access/` |
| `/ticket/<token>` | La entrada de una persona, con el QR | `src/app/ticket/[token]/page.tsx` |
| `/compra/resultado` | Adonde vuelve la persona después de pagar en Mercado Pago | `src/app/compra/resultado/page.tsx` |
| `/auth/confirm` | Link de invitación / recuperar contraseña de un admin | `src/app/auth/confirm/` |
| `/admin/login` | Login del admin | `src/app/admin/login/` |

### Con contraseña del gate

| Ruta | Qué hace | Archivo |
|---|---|---|
| `/entradas` | Muestra el próximo evento y el formulario de compra | `src/app/entradas/page.tsx` |

### Admin (requiere usuario de Supabase **y** fila activa en la tabla `admins`)

| Ruta | Qué hace | Quién |
|---|---|---|
| `/admin` | Resumen | todos |
| `/admin/events` | Lista y alta de eventos | todos |
| `/admin/events/<id>` | Resumen del evento, tandas, activar ventas, archivar | archivar: owner |
| `/admin/events/<id>/tickets` | **Entradas**: cargar manuales/invitaciones, buscar, anular, reembolsar | todos |
| `/admin/scan/<id>` | **Puerta**: scanner de QR, pantalla completa, solo celular | todos; cerrar puerta: owner |
| `/admin/config` | Contraseña del gate | cambiar: owner |
| `/admin/account` | Cambiar mi contraseña | todos |
| `/admin/admins`, `/admin/logs` | Usuarios y auditoría | owner |

### Endpoints de máquina

| Ruta | Quién la llama | Qué hace |
|---|---|---|
| `POST /api/gate` | El form de `/access` | Valida la contraseña y deja una cookie |
| `POST /api/mp/webhook` | Mercado Pago | Avisa cambios de un pago → confirma la entrada |
| `GET /api/cron/keepalive` | Vercel, una vez por día | Consulta mínima para que Supabase (plan gratis) no se pause |

Quién protege qué está en `src/middleware.ts`: solo corre en `/admin*`, `/api/admin*`, `/entradas*` y `/checkout*`.

---

## 3. La contraseña del gate

- Se pide **solo para comprar** (`/entradas`). La landing es pública.
- La cambian los owners desde `/admin/config`. Se le pasa a quien pide comprar por Instagram y se **rota** cada tanto: así alguien que la consiguió no puede volver a entrar ni pasársela a desconocidos indefinidamente.
- Al entrar, se guarda una cookie (`hm_access`, 24 h) con la **huella** de la contraseña. Si la contraseña cambia, la huella ya no coincide y la cookie deja de valer (`hasGateAccess()` en `src/lib/auth/gate.ts`).
- Si en la base no hay contraseña cargada, se usa la variable `GATE_PASSWORD`.

---

## 4. Entradas

### 4.1 Estados

```
                ┌──────────── anular ────────────┐
                │                                ▼
 pending ──pagó──► paid ──escaneo en puerta──► used
    │              │                        (no se puede anular)
    │              └── reembolsar (MP) ──► refunded
    └── abandonó / anular ──► cancelled
```

| Estado | Significa | ¿Pasa en puerta? |
|---|---|---|
| `pending` | Compra web iniciada, todavía no pagó. Reserva el lugar 20 min. | No |
| `paid` | Válida | **Sí** |
| `used` | Ya entró | No ("Ya usada a las HH:MM") |
| `cancelled` | Anulada por un admin, o compra abandonada | No |
| `refunded` | Anulada con devolución por Mercado Pago | No |

### 4.2 Origen (`source`)

| Origen | Cómo se crea | Monto | ¿Descuenta stock de la tanda? |
|---|---|---|---|
| `purchase` | Compra web con Mercado Pago | Precio de la tanda + cargo por servicio | Sí (reserva al empezar, confirma al pagar) |
| `manual` | Un admin la carga: se cobró por transferencia | Lo que se cobró | Sí |
| `invitation` | Un admin la carga: gratis | 0 | No (no tiene tanda) |

Las tres generan el **mismo tipo de QR** y pasan por el **mismo scanner**.

### 4.3 Reglas

1. **Una entrada por email y una por cédula, por evento.** Solo cuentan las entradas vivas (`pending`, `paid`, `used`): si una se anuló, la persona puede volver a tener otra.
   - El email se compara normalizado: en Gmail, `Juan.Perez+fiesta@gmail.com` = `juanperez@gmail.com` (`normalizeEmail`).
   - La cédula se guarda solo con dígitos y 8 cifras: `1.234.567-2` = `12345672` (`normalizeDocument`). Se valida el dígito verificador uruguayo.
2. **Datos obligatorios:** nombre, cédula, email e Instagram. Celular opcional.
3. **Stock por tanda.** Disponibles = total − vendidas − reservas web en curso (`tier_available`).
4. **"Agotado manual"** (`sold_out_override` en la tanda): corta la venta web aunque quede stock. Las entradas manuales lo ignoran, porque ya se cobraron.
5. **Una invitación no tiene tanda** ni descuenta stock.

Todo esto lo hace la función `create_ticket` en Postgres (`supabase/migrations/0006_ticketing.sql`). Bloquea la tanda mientras crea la entrada, así dos compras por el último lugar nunca salen las dos.

### 4.4 El QR

- La persona puede **guardar la entrada** desde su página:
  - **"Guardar imagen"** descarga un PNG formato historia (`/ticket/<token>/imagen`, solo si está válida).
  - **"Guardar PDF"** abre la impresión del navegador; la versión impresa sale en blanco y negro.

- Cada entrada tiene un `qr_token`: 22 caracteres aleatorios. No contiene datos ni firma; solo vale si existe en la base. Adivinarlo es imposible en la práctica.
- El QR codifica la URL `https://<sitio>/ticket/<token>`. Si alguien lo escanea con la cámara del celular, abre su entrada. El scanner de puerta extrae el token de esa URL.
- La página `/ticket/<token>` muestra la cédula **parcial**, porque cualquiera con el link la ve. La completa la ve solo el portero.
- Mientras la entrada está válida (o pendiente de pago), la página se refresca sola cada 5 segundos. Cuando el portero confirma el ingreso, el celular de la persona pasa a "Usada" sin recargar.

---

## 5. Flujos

### 5.1 Entrada manual (venta por transferencia) o invitación

1. Admin → evento → **Entradas** → "Nueva entrada".
2. Completa los datos; elige la tanda y el monto cobrado, o "Invitación".
3. Se crea la entrada ya válida (`paid`).
4. Aparece el link con el botón **Mandar por WhatsApp**: abre WhatsApp con el mensaje armado al celular cargado.

Código: `src/app/admin/(panel)/events/[id]/tickets/` (`actions.ts` → `createTicket` en `src/lib/tickets.ts`).

### 5.2 Compra web (Mercado Pago)

```
/entradas (con contraseña)
   │ completa el form
   ▼
startCheckoutAction ── crea entrada `pending` (reserva 20 min)
   │                └─ crea "preferencia" en Mercado Pago (vence con la reserva)
   ▼
página de pago de Mercado Pago (tarjeta, débito, saldo, Abitab/RedPagos)
   │
   ├──► MP llama a POST /api/mp/webhook ──┐
   └──► la persona vuelve a /compra/resultado ─┤
                                              ▼
                     syncPayment: consulta el pago a la API de MP
                     si está "approved" → confirm_ticket_payment → `paid`
                                              ▼
                     /compra/resultado muestra "Ver mi entrada" → /ticket/<token>
```

Puntos importantes:

- **Nunca se confía** en lo que viene en la URL de vuelta ni en el cuerpo del webhook: siempre se le pregunta el estado del pago a Mercado Pago con nuestra clave.
- **Webhook y página de resultado hacen lo mismo** a propósito. Si el webhook se atrasa o falla, la entrada se confirma igual cuando la persona vuelve. Confirmar dos veces no hace nada.
- **Reserva de 20 minutos.** Si no paga, el lugar se libera solo: no hace falta ningún proceso. Si la persona vuelve a intentar, su reserva anterior se anula y se crea otra.
- **Pago que llega tarde.** Si MP aprueba un pago después de vencida la reserva, se honra igual: la persona pagó. En un caso límite puede sobrevender por 1.
- **Pago en efectivo (Abitab/RedPagos)** queda "en proceso" hasta que se acredita. Cuando MP avisa por webhook, la entrada pasa a válida. Hoy no hay mail: hay que mandarle el link por Instagram. Sale de la lista de entradas del admin.
- Se vende solo si: el evento está publicado, tiene **ventas activas**, no terminó, Mercado Pago está configurado y queda alguna tanda comprable.
- **Cargo por servicio** (`src/lib/pricing.ts`). Se suma al precio de la entrada para cubrir la comisión de Mercado Pago con cobro al instante: 5,99 % + IVA ≈ 7,31 %. Se redondea hacia arriba a $10; por ejemplo, $1.600 → cargo $130 → total $1.730.
  - Al comprador se le muestra en pesos, nunca el porcentaje: "Entrada + Cargo por servicio = Total".
  - Mercado Pago cobra el total, con las dos líneas separadas.
  - `amount_paid_uyu` guarda el total.
  - Las cuotas con interés las paga el comprador.
- **Cómo se muestran las tandas al público:** solo "Disponible" o "Sold out", siempre con el precio (también las agotadas). El "% vendida" no se muestra en la web a propósito.
  - En la landing, cada tanda disponible lleva a `/entradas?tanda=<id>` con esa tanda ya elegida. El `?tanda=` sobrevive al paso por la contraseña.

Código: `src/app/entradas/actions.ts`, `src/lib/mercadopago.ts`, `src/app/api/mp/webhook/route.ts`, `src/app/compra/resultado/page.tsx`.

### 5.3 Puerta

Pantalla aparte (`/admin/scan/<id>`, botón "Puerta" del evento):
- Ocupa todo el celular, sin el menú del admin.
- En la compu solo muestra "Usalo desde el celular".

**Cada persona pasa en dos pasos.** El QR prueba que la entrada existe; la cédula prueba que es de esa persona.

1. **Escanear** el QR, o escribir la cédula en "Sin QR". El escaneo **solo consulta: no cambia nada**.
   - **Azul "Entrada válida"** con nombre, cédula y tanda (o "Invitación"). Queda fijo hasta que el portero decide.
   - **Rojo** con el motivo y botón **Cerrar**: ya usada (y a qué hora entró), QR inválido, de otro evento, no válida (anulada o sin pagar), puerta cerrada. También queda fijo.
2. **Cotejar** la cédula física con la pantalla:
   - **"Coincide, confirmar ingreso"** → recién ahí la entrada pasa a `used` y suma al contador "X / Y".
   - **"Cancelar"** → la entrada **no cambia** (sigue válida). Se registra el intento como `id_mismatch`.

Detalles:

- El uso único lo garantiza `check_in_ticket` en Postgres, un solo `UPDATE … WHERE status = 'paid'`. Si dos porteros confirman la misma entrada a la vez, al segundo le aparece "Ya usada".
- El scanner ignora el mismo QR durante 3 segundos después de cerrar un resultado, porque suele seguir delante de la cámara.
- **Cerrar puerta** (solo owner): desde ahí todo escaneo se rechaza.
- Todo queda en `check_ins`:
  - los rechazos, al escanear (`inspect_ticket`);
  - los ingresos, al confirmar (`check_in_ticket`);
  - las cancelaciones del portero (`reject_check_in`).

Código: `src/app/admin/scan/[id]/` · SQL: migraciones `0006` y `0007`.

### 5.4 Anular y reembolsar

- En **Entradas**, cada entrada válida tiene "Anular" (manual/invitación) o "Reembolsar" (compra web).
- **Reembolsar** devuelve el total por Mercado Pago y recién después anula (`refunded`). Si MP rechaza la devolución, no se anula nada.
- **Anular** una manual no devuelve plata: la transferencia se devuelve por fuera.
- Anular devuelve el lugar al stock de la tanda. Una entrada ya usada no se puede anular.

### 5.5 Acceso de admins

- Un admin necesita: un usuario en Supabase (Authentication → Users) **y** una fila activa en la tabla `admins` con `role` `owner` o `staff`.
- Para darle acceso (o resetear su contraseña) sin depender del mail: se genera un link de un solo uso (`auth.admin.generateLink`) hacia `/auth/confirm`. La persona toca **Continuar** y elige su contraseña en `/admin/account`. El botón existe para que la vista previa de WhatsApp no gaste el link.
- Si tiene usuario pero no fila en `admins`, el login le avisa "no está habilitado como admin".

---

## 6. Dónde vive cada regla

| Regla | Dónde |
|---|---|
| Stock, una por persona, reservas | `create_ticket` — `supabase/migrations/0006_ticketing.sql` |
| Confirmar pago (idempotente) | `confirm_ticket_payment` — misma migración |
| Anular / devolver stock | `cancel_ticket` — misma migración |
| Puerta: consultar sin cambiar / confirmar / cancelar | `inspect_ticket`, `reject_check_in` (`0007_door_two_step.sql`) y `check_in_ticket` (`0006`) |
| Normalizar email/CI/IG, token, URL del QR | `src/lib/tickets.ts` |
| Mercado Pago (preferencia, consulta, reembolso, firma) | `src/lib/mercadopago.ts` |
| Contraseña del gate y rotación | `src/lib/auth/gate.ts`, `src/app/api/gate/route.ts` |
| Qué rutas se protegen | `src/middleware.ts` |
| Próximo evento y qué tandas se pueden comprar | `src/lib/next-event.ts` |

---

## 7. Configuración

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Base de datos |
| `GATE_COOKIE_SECRET`, `GATE_PASSWORD` | Gate (la contraseña real se cambia en `/admin/config`) |
| `CRON_SECRET` | Que solo Vercel pueda llamar al ping diario |
| `MP_ACCESS_TOKEN` | Mercado Pago. Sin esto, `/entradas` muestra "llega pronto" |
| `MP_WEBHOOK_SECRET` | Firma de los webhooks (panel de MP → Webhooks). Opcional pero recomendado |
| `NEXT_PUBLIC_APP_URL` | Opcional: URL pública para los links. Si falta, se usa el dominio de producción de Vercel |
| `NEXT_PUBLIC_FONTS_URL` | Dónde están las fuentes Neue Montreal |

### Mercado Pago, paso a paso

1. En [Mercado Pago Developers](https://www.mercadopago.com.uy/developers/panel) crear una aplicación ("Checkout Pro").
2. **Probar sin plata real:** en la aplicación, "Cuentas de prueba" → crear un vendedor y un comprador de prueba. Usar el **Access Token del vendedor de prueba** como `MP_ACCESS_TOKEN` y pagar logueado con el comprador de prueba.
3. **Webhooks:** en la aplicación → Webhooks → URL `https://<sitio>/api/mp/webhook`, evento "Pagos". Copiar la clave secreta a `MP_WEBHOOK_SECRET`.
4. **Plata real:** cambiar `MP_ACCESS_TOKEN` por el de producción de la cuenta de la fiesta y redeployar.
5. En el admin, poner el evento **publicado** y **activar ventas**.

---

## 8. Caché

Las consultas a Supabase se hacen con `cache: 'no-store'` (`src/lib/supabase/admin.ts` y `server.ts`). Next 14 cachea por defecto los `fetch` del servidor, y la app mostraba datos viejos: una entrada usada seguía figurando como válida. Los datos de esta app cambian en tiempo real, así que **no se cachea nada de la base**.

## 9. Límites conocidos (decisiones conscientes)

- **No hay mails.** La entrada se muestra al terminar de pagar, y las manuales se mandan por WhatsApp. Mandar mails a cualquiera exige un dominio propio (Resend).
- **Una entrada por compra.** No hay selector de cantidad: cada persona compra la suya, con su cédula.
- **La contraseña es compartida.** Alguien puede pasársela a un amigo, que compraría con su propia cédula. Se mitiga rotándola y revisando la lista por Instagram.
- **Sin modo offline en puerta.** El scanner necesita internet.
- **Invitaciones sin control de capacidad total.** No descuentan de ninguna tanda.
