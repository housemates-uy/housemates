# Lógica de negocio — House Mates web

> Cómo funciona la app, explicado para alguien que no escribió el código.
> Si cambiás una regla de negocio, actualizá este documento en el mismo PR.
> Última actualización: 2026-10-28.

---

## 1. Qué es esto

Una sola app (Next.js en Vercel + base Postgres en Supabase) con tres partes:

| Parte | Para quién | Dónde |
|---|---|---|
| **Sitio público** | Cualquiera que llega desde Instagram | `/` |
| **Compra de entradas** | Cualquiera con el link (o quien tiene la contraseña, si está prendida) | `/entradas` |
| **Barra** | Cualquiera compra antes o durante la fiesta: un QR por trago, que se retira solo durante la fiesta (§5.7) | `/barra` |
| **Admin** | Los socios (owners) y el staff de puerta | `/admin` |

Las entradas son **QR personales**: una por persona, a nombre y cédula, y de un solo uso en puerta.

---

## 2. Mapa de rutas

### Públicas (no piden nada)

| Ruta | Qué hace | Archivo |
|---|---|---|
| `/` | Landing: próxima fecha, la casa, reglas y botón Entradas (sin tandas ni precios). Sin evento publicado, o si la base no responde en 2,5 s, dice "Próxima fecha a confirmar": nunca una fecha ni un lugar inventados (`getNextEvent` devuelve `id: null`) | `src/app/page.tsx` |
| `/access?next=…` | Pide la contraseña del gate y te manda a `next` | `src/app/access/` |
| `/ticket/<token>` | La entrada de una persona, con el QR | `src/app/ticket/[token]/page.tsx` |
| `/compra/resultado` | Adonde vuelve la persona después de pagar en Mercado Pago o de mandar el comprobante. El link a la entrada (y su nombre) se muestra solo a quien la compró: cookie `hm_compra` de este navegador, el `preference_id` de esa compra o la cuenta que la compró. A cualquier otro le dice que la entrada le llega por mail | `src/app/compra/resultado/page.tsx` |
| `/barra` | **Barra**: carta del próximo evento, elegir tragos, email y pagar con Mercado Pago (§5.7) | `src/app/barra/page.tsx` |
| `/barra/pedido/<token>` | Un pedido de barra: un QR por trago con su estado; se actualiza sola. Adonde vuelve la persona desde Mercado Pago | `src/app/barra/pedido/[token]/` |
| `/barra/qr/<token>` | Un trago suelto: lo que abre la cámara al escanear un QR de barra (sin datos del comprador). `/imagen` lo baja en PNG | `src/app/barra/qr/[token]/` |
| `/preguntas-frecuentes`, `/terminos`, `/privacidad` | Ayuda y legales (FAQ en acordeón, términos con devoluciones según Ley 17.250, privacidad según Ley 18.331). Linkeadas desde el pie de la landing | `src/app/preguntas-frecuentes/`, `src/app/terminos/`, `src/app/privacidad/` · `src/components/legal/` |
| `/auth/confirm` | Links por mail: invitación / recuperar contraseña de un admin, y confirmar email / recuperar contraseña de un comprador (estos traen `&next=/cuenta…`) | `src/app/auth/confirm/` |
| `/admin/login` | Login del admin | `src/app/admin/login/` |

### Compra (contraseña opcional)

| Ruta | Qué hace | Archivo |
|---|---|---|
| `/entradas` | Muestra el próximo evento y el formulario de compra | `src/app/entradas/page.tsx` |

### Cuenta del comprador (ver §5.6)

| Ruta | Qué hace | Archivo |
|---|---|---|
| `/cuenta` | **Mis entradas** (próximas y pasadas, con "Ver entrada"), **Pedidos de barra** pagos con la cuenta (con "Ver pedido"), editar nombre y celular, salir. Sin sesión → `/cuenta/ingresar` | `src/app/cuenta/page.tsx` |
| `/cuenta/ingresar?next=…` | Email + contraseña; vuelve a `next` | `src/app/cuenta/ingresar/` |
| `/cuenta/recuperar` | Pide el link por mail para elegir otra contraseña | `src/app/cuenta/recuperar/` |
| `/cuenta/nueva-clave` | Elegir la contraseña (solo con la sesión del link del mail: confirmar email o recupero) | `src/app/cuenta/nueva-clave/` |

### Admin (requiere usuario de Supabase **y** fila activa en la tabla `admins`)

| Ruta | Qué hace | Quién |
|---|---|---|
| `/admin` | Inicio: el próximo evento publicado (vale hasta que termina: durante la fiesta dice "Evento en curso") y sus entradas válidas | todos |
| `/admin/events` | Lista y alta de eventos | todos |
| `/admin/confirmar` | **Entradas a confirmar**: las transferencias con comprobante de todos los eventos, para aceptar o declinar (§5.2b). En el menú, con un contador de pendientes | owner (el staff no la ve) |
| `/admin/events/<id>` | Resumen del evento, tandas, activar ventas, archivar, preventa (link y mail a quienes vinieron antes) | archivar y mandar la preventa: owner |
| `/admin/events/<id>/ventas` | **Ventas**: entradas válidas contra capacidad, vendidas por tanda, códigos de descuento, ventas por día y, el día del evento, la puerta en vivo (se refresca sola cada 10 s). "Recaudado" incluye transporte y cargo por servicio, con el desglose "Entradas y cargo" / "Transporte". El Resumen del evento usa las mismas "Entradas válidas" (pagas + usadas, con invitaciones) | todos; la plata (recaudado, medios de pago, montos): owner |
| `/admin/events/<id>/lista` | Descarga la **lista de la puerta** en CSV para Excel (`;`, UTF-8 con BOM) | todos |
| `/admin/events/<id>/lista/imprimir` | La misma lista para imprimir en blanco y negro, con casilla para tildar a mano | todos |
| `/admin/events/<id>/tickets` | **Entradas**: transferencias a validar del evento (lo mismo que Entradas a confirmar), cargar manuales/invitaciones, buscar (en la base, por nombre, email o cédula), anular, reembolsar. Lista de a 100 con "Más nuevas / Más viejas"; los totales se cuentan en la base, sin el tope de 1000 filas | todos; validar transferencias, ver comprobantes y la plata (recaudado, montos): owner |
| `/admin/events/<id>/descuentos` | **Descuentos**: códigos del evento y sus usos | crear y pausar: owner |
| `/admin/events/<id>/barra` | **Barra**: venta abierta/pausada, resumen (pedidos pagos, total vendido, tragos vendidos y entregados por trago), carta y pedidos | todos; carta y pausar venta: owner |
| `/admin/events/<id>/transporte` | **Transporte**: opciones de bus del evento y pasajeros por opción, con CSV (`/pasajeros`) e imprimible (`/imprimir`) para el chofer (§5.8) | todos; cambiar opciones: owner |
| `/admin/scan/<id>` | **Puerta**: scanner de QR, pantalla completa, solo celular | todos; cerrar puerta: owner |
| `/admin/barra/<id>` | **Escáner de barra**: un QR = un trago, pantalla completa; sin QR, por email | todos |
| `/admin/config` | Venta (pedir contraseña sí/no, medios de pago, datos para transferir) y contraseña del gate | cambiar: owner |
| `/admin/account` | Cambiar mi contraseña | todos |
| `/admin/admins` | Usuarios | owner |
| `/admin/logs` | **Historial**: las últimas 200 acciones, con fecha (hora de Montevideo), quién, qué y el detalle "Campo: antes → después" al editar evento, tanda y configuración de venta (incluidos los datos para transferir; nunca la contraseña) | owner |

**Edición de eventos y tandas:**
- Archivar y desarchivar (también desde Editar y en el alta) es solo de owners; archivar apaga las ventas.
- El nombre de la tanda es único por evento sin importar mayúsculas. El cupo no puede quedar por debajo de lo vendido (el servidor lo controla).
- Si las tandas activas suman más que la capacidad del evento, se avisa: se vende hasta la capacidad, invitaciones incluidas (§4.3).
- El alta es atómica: si fallan las tandas, no queda el evento creado.

### Endpoints de máquina

| Ruta | Quién la llama | Qué hace |
|---|---|---|
| `POST /api/gate` | El form de `/access` | Valida la contraseña y deja una cookie |
| `POST /api/mp/webhook` | Mercado Pago | Avisa cambios de un pago → confirma la entrada, o el pedido de barra si el `external_reference` es `bar:<id>` |
| `GET /api/cron/keepalive` | Vercel, una vez por día | Consulta mínima para que Supabase (plan gratis) no se pause |

`src/middleware.ts` protege solo `/admin*` y `/api/admin*`, y en `/cuenta*`, `/entradas` y `/compra/resultado` solo refresca la sesión de Supabase (las páginas de `/cuenta` piden la sesión ellas mismas). La contraseña de compra la chequea `/entradas` con `hasGateAccess()` (el middleware no puede saber si está prendida sin consultar la base).

---

## 3. La contraseña del gate

- **Se prende y apaga** desde `/admin/config` → "Pedir contraseña para comprar" (`site_config.gate_enabled`). Arranca **prendida** (migración `0010`) y solo se apaga con un `'0'` explícito: si falta el valor o la base no responde, se pide igual. Apagada, cualquiera con el link compra.
- Si está prendida, se pide **solo para comprar** (`/entradas`). La landing es pública.
- La cambian los owners desde `/admin/config`. Se le pasa a quien pide comprar por Instagram y se **rota** cada tanto: así alguien que la consiguió no puede volver a entrar ni pasársela a desconocidos indefinidamente.
- Se guarda y se compara sin espacios en los bordes (el autocompletar del celular a veces agrega uno). Una guardada antes con espacios también anda.
- Al entrar, se guarda una cookie (`hm_access`, 24 h) con la **huella** de la contraseña. Si la contraseña cambia, la huella ya no coincide y la cookie deja de valer (`hasGateAccess()` en `src/lib/auth/gate.ts`).
- Si en la base no hay contraseña cargada, se usa la variable `GATE_PASSWORD`.
- **5 intentos cada 15 minutos por IP** (§8c). El sexto, aunque sea la contraseña correcta, recibe 429 con "Hiciste muchos intentos seguidos...".
- **Modo local sin claves** (`src/lib/auth/local-mode.ts`): saltea esta contraseña y el login del admin **solo en la máquina de quien desarrolla**. Exige `npm run dev` (en producción `NODE_ENV` es `production`), `LOCAL_SIN_CLAVES=1`, que no sea Vercel (`VERCEL`) y que la base sea la de Docker (`127.0.0.1`/`localhost`). `npm run dev` escucha solo en `127.0.0.1`, así nadie de la misma red entra al admin. En la web publicada nunca aplica.

---

## 4. Entradas

### 4.1 Estados

```
                ┌──────────── anular ────────────┐
                │                                ▼
 pending ──pagó──► paid ──escaneo en puerta──► used
    │              ▲  │                     (no se puede anular)
    │              │  └── reembolsar (MP) ──► refunded
    │      aprobar │
    │    review ───┘   (transferencia con comprobante)
    │      └── rechazar ──┐
    └── abandonó (vence sola) ──► cancelled
```

Una reserva `pending` no se anula desde el admin: vence sola a los 20 minutos. Si se anulara y la persona pagara después, revive (`confirmed_late`, §5.2).

| Estado | Significa | ¿Pasa en puerta? |
|---|---|---|
| `pending` | Compra con Mercado Pago iniciada, todavía no pagó. Reserva el lugar 20 min. | No |
| `review` | Compra por transferencia: subió el comprobante y falta que un owner lo valide. Reserva el lugar hasta que se valide o se rechace. | No |
| `paid` | Válida | **Sí** |
| `used` | Ya entró | No ("Ya usada a las HH:MM") |
| `cancelled` | Anulada por un admin, o compra abandonada | No |
| `refunded` | Anulada con devolución por Mercado Pago | No |

### 4.2 Origen (`source`)

| Origen | Cómo se crea | Monto | ¿Descuenta stock de la tanda? |
|---|---|---|---|
| `purchase` | Compra web, con Mercado Pago o transferencia (`payment_method`) | Precio de la tanda − descuento; + cargo por servicio solo con Mercado Pago | Sí (reserva al empezar, confirma al pagar o al validar) |
| `manual` | Un admin la carga: se cobró por transferencia | Lo que se cobró | Sí |
| `invitation` | Un admin la carga: gratis | 0 | No (no tiene tanda) |

Las tres generan el **mismo tipo de QR** y pasan por el **mismo scanner**.

### 4.3 Reglas

1. **Una entrada por email y una por cédula, por evento.** Solo cuentan las entradas vivas (`pending`, `review`, `paid`, `used`): si una se anuló, la persona puede volver a tener otra.
   - El email se compara normalizado: en Gmail, `Juan.Perez+fiesta@gmail.com` = `juanperez@gmail.com` (`normalizeEmail`).
   - La cédula se guarda solo con dígitos y 8 cifras: `1.234.567-2` = `12345672` (`normalizeDocument`). Se valida el dígito verificador uruguayo.
2. **Datos obligatorios:** nombre, cédula y email. Celular opcional. La compra web no pide Instagram; en las entradas manuales el admin puede anotarlo (opcional).
3. **Stock por tanda.** Disponibles = total − vendidas − reservas web en curso (`tier_available`).
   - **Capacidad del evento** (`events.capacity`, migración `0018`): además del cupo de cada tanda, no se vende por encima de la capacidad. Libres = capacidad − entradas vivas, invitaciones incluidas (`event_available`). `create_ticket` lo controla bloqueando la fila del evento; la landing y `/entradas` muestran cada tanda como agotada si el evento está lleno. Las invitaciones no se frenan, pero cuentan.
4. **"Agotado manual"** (`sold_out_override` en la tanda): corta la venta web aunque quede stock. Las entradas manuales lo ignoran, porque ya se cobraron.
5. **Una invitación no tiene tanda** ni descuenta stock.

Todo esto lo hace la función `create_ticket` en Postgres (`supabase/migrations/0006_ticketing.sql`; la última versión, con preventa, tandas próximas y capacidad del evento, está en `0018_event_capacity.sql`). Bloquea la tanda mientras crea la entrada, así dos compras por el último lugar nunca salen las dos.

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

### 5.2 Compra web

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
- **Pago pendiente (efectivo o tarjeta en revisión).** El cupón de Abitab/RedPagos vence a las 24 h (`date_of_expiration` de la preferencia). Cuando MP avisa que el pago quedó pendiente, la reserva se estira hasta que vence el cupón (tarjeta en revisión: hasta 48 h; nunca más de 72 h) con `extend_ticket_hold` (`0017`). Así el lugar no se vende dos veces. Solo se estira una reserva que sigue viva.
- **Pago que llega tarde** (`confirm_ticket_payment`, última versión en `0017`). Se honra siempre que se pueda: la persona pagó.
  - Si la reserva se había anulado porque la persona volvió a intentar y la otra entrada está sin pagar, se anula esa y vale la pagada. Si revive una entrada anulada devuelve `confirmed_late`: la entrada vale, sale el mail y se avisa a los owners (puede pasarse del cupo).
  - Si la persona ya tiene otra entrada paga o en revisión para esa fecha, devuelve `duplicate_live_ticket`: la entrada no se confirma, el pago queda anotado en ella y se avisa a los owners para devolverlo desde Mercado Pago.
  - Un segundo pago sobre una entrada ya paga devuelve `duplicate_payment` y también se avisa para devolverlo.
- **Monto.** Solo se confirma si lo que informa MP cubre el total de la entrada (`amount_paid_uyu`). Si es menor devuelve `amount_mismatch`: la entrada no se confirma, no sale mail y se avisa a los owners. Si es mayor (cuotas con interés) se confirma y se guarda lo cobrado.
- **Aviso a los owners** ("Pago para revisar", `src/lib/mercadopago.ts`): un mail a todos los owners activos, una vez por entrada (queda en `email_log` como `payment_alert`), con qué pasó, comprador, pago y entrada.
- **Devolución o contracargo hechos desde Mercado Pago:** cuando MP avisa `refunded` o `charged_back`, se anula la entrada pagada con ese pago (`reverse_ticket_payment`, `0017`), se le manda "Tu entrada fue anulada" y se avisa a los owners. Si ya se usó en puerta no se toca y solo se avisa. La devolución de un pago repetido no toca la entrada válida.
- **Si la base falla al confirmar**, `syncPayment` tira error y el webhook responde 500: MP vuelve a avisar más tarde. Nunca se pierde un pago aprobado.
- **Página de resultado:** "El pago no se completó · No se te cobró nada" sale solo si el pago fue rechazado, se canceló o no hubo pago. Si MP aprobó y la entrada no quedó confirmada dice "Recibimos tu pago… No vuelvas a pagar"; si no pudo consultar a MP, "No pudimos consultar tu pago… No vuelvas a pagar". Consulta a MP como máximo 60 veces cada 10 min por IP (§8c).
- **Pago en efectivo (Abitab/RedPagos)** queda "en proceso" hasta que se acredita. Cuando MP avisa por webhook, la entrada pasa a válida y sale el mail con la entrada.
- Se vende solo si: el evento está publicado, tiene **ventas activas**, no terminó, hay al menos un medio de pago activo (Mercado Pago o transferencia) y queda alguna tanda comprable. Si todas las tandas están agotadas, `/entradas` dice "Entradas agotadas".
- **Precio que cambia mientras se completa el formulario:** el formulario manda el total que vio la persona (`expected_total`) y, si el servidor calcula otro (cambió el precio de la tanda o del bus), no se crea nada y pide recargar.
- **Webhook sin clave en producción:** si falta `MP_WEBHOOK_SECRET`, responde 500 y no procesa nada (MP reintenta cuando se cargue). En local se puede omitir.
- **Cargo por servicio** (`src/lib/pricing.ts`): solo con Mercado Pago, **7,5 %** sobre todo lo que se paga por Mercado Pago: la entrada (ya con el descuento, si hay) más el bus si lo eligió (§5.8), redondeado al peso. Por ejemplo, $1.600 → cargo $120 → total $1.720. Con transferencia no hay cargo.
- **Mercado Pago sin conectar:** si está prendido en `/admin/config` pero falta `MP_ACCESS_TOKEN`, la opción se muestra igual y, al elegirla, avisa que se habilita pronto. No se crea ninguna entrada ni se cobra nada.
  - Al comprador se le muestra el porcentaje en la opción de Mercado Pago, en Preguntas frecuentes y en Términos (todo sale de `SERVICE_FEE_RATE` / `SERVICE_FEE_LABEL`), y el monto en pesos en el resumen: "Entrada + Cargo por servicio = Total".
  - Mercado Pago cobra el total, con las dos líneas separadas.
  - `amount_paid_uyu` guarda el total.
  - Las cuotas con interés las paga el comprador.
- **Cómo se muestran las tandas al público:** solo en `/entradas` (la landing no muestra tandas ni precios: tiene un botón Entradas). Cada una dice "Disponible", "Sold out" o "Próximamente" (§5.2d), siempre con el precio (también las agotadas). El "% vendida" no se muestra en la web a propósito.
  - `/entradas?tanda=<id>` llega con esa tanda ya elegida. El `?tanda=` y el `?preventa=` sobreviven al paso por la contraseña.

Código: `src/app/entradas/actions.ts`, `src/lib/mercadopago.ts`, `src/app/api/mp/webhook/route.ts`, `src/app/compra/resultado/page.tsx`.

**El formulario** (`src/app/entradas/buy-form.tsx`), en orden: tanda con su precio → datos de la persona → código de descuento (opcional) → transporte (opcional, §5.8) → cómo paga: **Mercado Pago** o **transferencia**. Los medios de pago se prenden y apagan en `/admin/config`. Mercado Pago además necesita `MP_ACCESS_TOKEN`, y la transferencia, los datos de la cuenta cargados (`src/lib/sale-config.ts`).

### 5.2b Transferencia con comprobante

Igual que en la web de Arcano:

1. La persona elige "Transferencia bancaria": ve los datos de la cuenta (con botón "Copiar datos") y el total exacto. **No hay cargo por servicio** porque no hay comisión.
2. Sube el comprobante: foto, captura o PDF, hasta 4 MB. Vercel no acepta pedidos de más de 4,5 MB, así que el formulario achica en el celular las fotos pesadas.
3. Se crea la entrada `pending` con una reserva de 15 minutos, se sube el comprobante al bucket **privado** `comprobantes` de Supabase Storage (`src/lib/receipts.ts`) y recién ahí pasa a `review` con `receipt_path`, en un solo UPDATE que exige que siga `pending`. Desde ese momento el lugar queda reservado sin vencimiento. Si la subida falla, la entrada se anula; si la función se corta en el medio, la reserva vence sola y no queda una entrada en revisión sin comprobante bloqueando la cédula, el email y el lugar (`0016`). `approve_transfer` devuelve `no_receipt` si no hay comprobante.
4. Le llega el mail "Recibimos tu comprobante". A los owners activos les llega un aviso con el comprobante adjunto y el link a **Entradas a confirmar**.
5. Un owner la valida en **Entradas a confirmar** (`/admin/confirmar`, en el menú del admin con un contador de pendientes). Solo owners: el staff no ve el ítem, la página lo manda a `/admin` y las acciones y los comprobantes le dan error.
   - **Qué muestra:** todas las transferencias en `review` de todos los eventos, la más vieja primero, con filtro por evento si hay de más de uno. Cada tarjeta trae nombre, CI, email, celular e Instagram (si los dejó), evento y tanda, cuándo mandó el comprobante (hora de Montevideo) y el desglose: entrada, descuento con su código, transporte y **total a transferir**.
   - **Ver comprobante:** una foto se abre a pantalla completa con el total esperado arriba, para compararlo. "Ampliar" (o tocar la imagen) la agranda y "Abrir en pestaña" la abre sola. Un PDF se abre en una pestaña nueva. El link es `/admin/confirmar/comprobante/<id>`: el servidor chequea que sea owner y redirige a un link firmado del bucket que vence a los 60 segundos, así nunca queda un link vencido en la página.
   - **Aceptar** (`approve_transfer`): pasa a `paid`, suma a la tanda y le llega el mail con la entrada y el QR.
   - **Declinar** (pide confirmar; `reject_transfer`): pasa a `cancelled` con `reviewed_at`, se liberan el lugar de la tanda y el del bus, y le llega el mail "No pudimos validar tu transferencia". El mail nombra los tres motivos posibles (monto distinto, comprobante que no se lee, transferencia que no aparece), igual que Preguntas frecuentes, y dice que si la plata llegó se le devuelve; que escriba por Instagram.
   - Las dos quedan en `admin_logs` (`approve_transfer` / `reject_transfer`, a nombre del owner) y la tarjeta sale de la lista. El aviso del resultado viaja en la URL (`?hecho=…&entrada=…`), así sobrevive a recargar la página. Si el mail no salió, el aviso lo dice.
   - **Doble toque o dos owners a la vez:** el botón manda un solo pedido, y la base resuelve una sola vez (la función bloquea la entrada y exige que siga en `review`). Al segundo le aparece "ya estaba resuelta" y no sale otro mail.
   - Si no tiene comprobante dice "Sin comprobante" y solo se puede declinar. Una entrada en revisión no se anula: se acepta o se declina.
   - Lo mismo sigue en Admin → evento → **Entradas**, arriba de todo ("Transferencias a validar", con Aprobar y Rechazar), con la misma lógica (`src/lib/transfers.ts`).
6. Mientras está en revisión, `/compra/resultado?transferencia=<id>` y `/ticket/<token>` muestran "Validando tu transferencia".
7. **Si la compra no sale después de transferir** (tanda o bus agotados, código sin usos, cédula o email repetidos, límite de intentos, precio que cambió, comprobante que no se pudo subir): la persona transfiere antes de enviar el formulario, así que a esos errores se les suma "Si ya transferiste, escribinos por Instagram con el comprobante y lo resolvemos". Si falla la subida del comprobante, se le aclara que no hace falta transferir otra vez.

Una transferencia aprobada no se reembolsa desde la web: se anula y la plata se devuelve por fuera, igual que una entrada manual.

### 5.2c Códigos de descuento

- Se cargan por evento en Admin → evento → **Descuentos** (solo owners): código, porcentaje (1 a 99 %) o monto fijo en pesos, y opcionalmente usos máximos y vencimiento. Se pueden pausar.
- La persona lo escribe en el formulario y toca "Aplicar": ve el precio con descuento antes de pagar. Vale para cualquier tanda del evento y con los dos medios de pago.
- **Búsqueda exacta.** Se pasa a mayúsculas, se rechaza lo que no sea `^[A-Z0-9_-]{3,30}$` y se busca por igualdad (`findDiscount` en `src/lib/discounts.ts`). Antes se buscaba con `ilike` y `S*` encontraba STAFF500 (PostgREST toma `*` como comodín). Cuando el código no sirve, la respuesta tarda unos 400 ms, y "Aplicar" tiene límite de intentos (§8c).
- El descuento se resta del precio de la entrada. Con Mercado Pago, el cargo por servicio se calcula sobre el precio ya descontado (`quote()` en `src/lib/pricing.ts`). No puede dejar la entrada en $0: para eso están las invitaciones.
- **Un uso es una entrada viva con ese código** (`pending` sin vencer, `review`, `paid` o `used`). Si se anula, el uso se libera. `create_ticket` bloquea el código mientras crea la entrada, así el último uso no se lo llevan dos personas a la vez.
- La entrada guarda el código y el monto descontado (`discount_code_id`, `discount_uyu`). Los mails muestran la línea "Descuento".

### 5.2d Tandas: ingreso temprano, próximas y preventa

Se cargan en el alta y en la edición de los tiers (Admin → evento → Editar), con tres campos opcionales. Código: `src/components/admin/events/tier-fields.tsx`, `src/lib/next-event.ts` · SQL: `0014_tier_features.sql`.

**Ingreso temprano** ("Ingreso hasta", `ticket_tiers.entry_until`, hora de Montevideo). Para una tanda más barata con horario límite, por ejemplo hasta las 00:30.
- Se muestra en la tarjeta de la tanda en `/entradas`, en `/ticket/<token>` y en el mail de la entrada ("Ingreso · Hasta las 00:30").
- La hora cuenta para la noche del evento: se toma la vez de esa hora más cercana al inicio (±12 h). En una fiesta que arranca a las 23:00, "00:30" es la madrugada siguiente (`entry_deadline`).
- En puerta, si se escanea después de ese horario, la pantalla azul suma el aviso **"Fuera de horario: era ingreso hasta 00:30"**. La entrada sigue válida: **decide el portero**, que puede confirmar el ingreso igual. Si lo confirma, el check-in queda marcado (`check_ins.late_entry`).

**Próximas** ("Sale a la venta", `ticket_tiers.sales_start`). Una tanda activa con fecha de salida en el futuro se ve en `/entradas` con su precio y **"Próximamente · Sale el vie 20.11 · 20:00 hs"**, sin poder elegirse. Sirve para que se vea a cuánto pasa la entrada, sin inventar urgencia. A esa hora pasa sola a "Disponible". `create_ticket` rechaza la compra antes de tiempo (`tier_not_started`), aunque alguien fuerce el formulario.

**Preventa** ("Código de preventa", `ticket_tiers.presale_code`, en mayúsculas, único por evento):
- La tanda **no se ve** en `/entradas` ni en la landing. Solo aparece con el link `/entradas?preventa=CODIGO`, ya elegida y con el detalle violeta "Preventa". El `?preventa=` sobrevive al paso por la contraseña. Si el código no existe, se avisa "Ese link de preventa no es válido o la preventa ya terminó".
- El código se valida en el servidor: `create_ticket` rechaza la compra de una tanda de preventa sin el código correcto (`presale_required`). Las entradas manuales del admin no lo piden.
- En Admin → evento → Resumen, sección **Preventa**: el link para copiar y el botón **"Mandar preventa a quienes vinieron antes"** (solo owners).
  - Destinatarios (`presale_audience`): un mail por persona (email normalizado) con una entrada `paid` o `used` de un **evento anterior**: publicado o archivado, que ya empezó y que no es este. No se le manda a quien ya tiene entrada para este evento ni a los emails bloqueados en la whitelist.
  - No se repite: cada envío queda en `presale_sends` (uno por tanda y email), reservado en `sending` antes de mandar, así dos envíos a la vez no duplican. "Mandar" va solo a quien no lo recibió; los que fallaron quedan pendientes. Manda unos 45 segundos por clic, igual que la Comunicación (§10).
  - Solo se puede mandar con el evento publicado, con ventas activas y sin terminar, y la tanda activa, sin agotado manual, ya a la venta y con lugar (en la tanda y en el evento). Si no, la página dice por qué y el servidor lo vuelve a chequear.
  - No hay formulario para pedir la preventa: el link se manda por mail o lo comparten los owners (regla 7.1 de `.claude/CLAUDE.md`).

### 5.3 Puerta

Pantalla aparte (`/admin/scan/<id>`, botón "Puerta" del evento):
- Ocupa todo el celular, sin el menú del admin.
- En la compu solo muestra "Usalo desde el celular".

**Cada persona pasa en dos pasos.** El QR prueba que la entrada existe; la cédula prueba que es de esa persona.

1. **Escanear** el QR, o escribir la cédula en "Sin QR". El escaneo **solo consulta: no cambia nada**.
   - **Azul "Entrada válida"** con nombre, cédula y tanda (o "Invitación"). Queda fijo hasta que el portero decide.
   - **Rojo** con el motivo y botón **Cerrar**: ya usada (y a qué hora entró), QR inválido, de otro evento, puerta cerrada, o una entrada que no está paga, con su estado real para que el portero sepa qué hacer. También queda fijo.

     | Estado | Pantalla roja |
     |---|---|
     | `review` | "Transferencia sin validar" · "Avisale a un owner: la puede aprobar ahora desde Entradas a confirmar." |
     | `pending` | "Pago sin confirmar" |
     | `cancelled` | "Entrada anulada" |
     | `refunded` | "Entrada reembolsada" |

   - **Sin conexión** (se cortó internet, la base no respondió o un timeout): **no es un rechazo**. Aviso neutro (oscuro, no rojo) "Sin conexión. Probá de nuevo." con **Reintentar**, y la cámara sigue escaneando. Si falla al confirmar, la pantalla azul queda con el aviso y el botón pasa a "Reintentar"; la entrada no cambió.
2. **Cotejar** la cédula física con la pantalla:
   - **"Coincide, confirmar ingreso"** → recién ahí la entrada pasa a `used` y suma al contador "X / Y".
   - **"Cancelar"** → la entrada **no cambia** (sigue válida). Se registra el intento como `id_mismatch`.

Detalles:

- El uso único lo garantiza `check_in_ticket` en Postgres, un solo `UPDATE … WHERE status = 'paid'`. Si dos porteros confirman la misma entrada a la vez, al segundo le aparece "Ya usada".
- El scanner ignora el mismo QR durante 3 segundos después de cerrar un resultado (o de un "Sin conexión"), porque suele seguir delante de la cámara.
- **Por cédula:** si hay varias entradas con esa cédula en el evento (una viva y otras anuladas), muestra la válida o ya usada; si no hay, la más nueva.
- **Deploy nuevo con la pantalla abierta:** las acciones viejas ya no existen en el servidor. La pantalla se recarga sola, solo si el sitio responde; sin internet queda el aviso "Sin conexión".
- **Cámara:** "Cambiar cámara" arriba a la derecha si el celular tiene más de una (pasa a la siguiente); "Reintentar" si no se pudo abrir. La pantalla no se apaga mientras está abierta, y lo vuelve a pedir al volver a la pestaña.
- **Cerrar puerta** (solo owner): desde ahí todo escaneo se rechaza.
- **Tanda de ingreso temprano fuera de horario:** aviso "Fuera de horario" sobre la pantalla azul; decide el portero (§5.2d).
- Todo queda en `check_ins`:
  - los rechazos, al escanear (`inspect_ticket`);
  - los ingresos, al confirmar (`check_in_ticket`);
  - las cancelaciones del portero (`reject_check_in`).
- **Plan B si falla el escáner o internet:** en **Ventas**, "Descargar lista (CSV)" o "Imprimir lista". Trae las entradas válidas y ya usadas, por orden alfabético del nombre (como lo escribió la persona), con cédula completa, tanda o "Invitación" y hora de ingreso. Conviene bajarla o imprimirla antes de abrir: lo que se tilde a mano no queda registrado en la base.

Código: `src/app/admin/scan/[id]/` · Lista: `src/app/admin/(panel)/events/[id]/lista/` · SQL: migraciones `0006`, `0007` y `0014` (última versión de `inspect_ticket` y `check_in_ticket`).

### 5.4 Anular y reembolsar

- En **Entradas**, solo las entradas válidas (`paid`) tienen "Anular" (manual/invitación/transferencia) o "Reembolsar" (compra con Mercado Pago). Las `pending` no: vencen solas.
- **Reembolsar** devuelve el total por MP y recién después anula (`refunded`). Antes consulta el pago en MP: si ya figura devuelto (lo devolvieron desde el panel de MP), no lo devuelve de nuevo y solo deja la entrada reembolsada. Si MP rechaza la devolución, no se anula nada.
- **Anular** una manual o una compra por transferencia no devuelve plata: la transferencia se devuelve por fuera.
- Solo si `cancel_ticket` devuelve `cancelled` se registra en `admin_logs` y sale el mail "Tu entrada fue anulada". Si se usó mientras tanto, ya estaba anulada o falla la base, la página lo dice y no se manda nada.
- Anular devuelve el lugar al stock de la tanda. Una entrada ya usada no se puede anular.

### 5.5 Acceso de admins

- Un admin necesita: un usuario en Supabase (Authentication → Users) **y** una fila activa en la tabla `admins` con `role` `owner` o `staff`.
- Para darle acceso (o resetear su contraseña) sin depender del mail: se genera un link de un solo uso (`auth.admin.generateLink`) hacia `/auth/confirm`. La persona toca **Continuar** y elige su contraseña en `/admin/account`. El botón existe para que la vista previa de WhatsApp no gaste el link.
- Si tiene usuario pero no fila en `admins`, el login le avisa "no está habilitado como admin".
- **Si el email ya tenía usuario** (por ejemplo, alguien creó una cuenta de comprador con ese email): antes de darle acceso, borrar sus sesiones y cambiarle la contraseña (`docs/EXTERNAL_SERVICES.md`). Además, abrir el link del mail le pone una contraseña al azar y cierra las otras sesiones (§8c).
- Cambiar la contraseña en `/admin/account` cierra las otras sesiones de esa persona.

### 5.6 Cuentas de compradores

Opcionales: se puede comprar sin cuenta, como siempre. Código: `src/lib/customers.ts` · migración `0011_customer_accounts.sql`.

- **Qué es:** un usuario de Supabase Auth (el mismo de los admins) + su perfil en `customers` (nombre, cédula, celular). **No da acceso al admin**: el admin sigue pidiendo fila activa en `admins`; un comprador que abre `/admin` termina en el login con "no está habilitado como admin".
- **Cómo se crea:** en `/entradas`, el campo opcional "Creá una contraseña" (mínimo 8 caracteres). La cuenta se crea **recién con la compra hecha** (comprobante subido o pago de Mercado Pago iniciado): si la compra falla (agotado, cédula repetida, etc.) no se crea nada, y si falla la cuenta, la compra sigue igual. Queda logueada y le llega el mail "Confirmá tu email". Nadie se registra solo: Supabase tiene el registro público apagado y la cuenta la crea el servidor.
- **Si el email ya tiene cuenta** y completa la contraseña: no se cobra nada y el campo avisa "Ya tenés cuenta con este email: ingresá".
- **Con la sesión iniciada:** el formulario viene con nombre, cédula y celular del perfil; el email es el de la cuenta (no se puede cambiar) y no aparece el campo de contraseña. La entrada queda asociada a la cuenta (`tickets.customer_id`).
- **Mis entradas (`/cuenta`):** próximas primero y pasadas después, con estado (Válida, Transferencia a validar, Usada, Anulada) y "Ver entrada" → `/ticket/<token>`. No muestra reservas de Mercado Pago vencidas ni compras con Mercado Pago que nunca se pagaron.
- **Pedidos de barra (`/cuenta`):** los pedidos **pagos** hechos con la sesión iniciada (`bar_orders.user_id`, §5.7), del evento más nuevo al más viejo: evento y fecha, cuántos tragos y cuántos entregados, y "Ver pedido" → `/barra/pedido/<token>`. Los comprados sin sesión no aparecen (no se buscan por email). Sin pedidos, la sección no se muestra.
  - La cuenta se crea con un email que nadie verificó. Por eso, hasta que la persona confirma el email, ve **solo las entradas compradas desde la cuenta**. Confirmado, ve además todas las entradas a ese email (comparado normalizado, `normalizeEmail`): invitaciones, entradas manuales y compras sin cuenta.
  - **Confirmar el email es elegir la contraseña:** el link de "Confirmá tu email" (y el de recupero) lleva a `/cuenta/nueva-clave`, y el email queda verificado recién al guardar ahí la contraseña, después de cerrar todas las otras sesiones. Así, si alguien compró con un email ajeno y le puso su contraseña, cuando el dueño confirma esa contraseña deja de servir y el otro queda afuera. Tocar el link sin guardar no verifica nada. Puede repetir la contraseña que ya tenía.
  - `/cuenta/nueva-clave` solo funciona con la sesión que abrió un link del mail (Supabase la marca en el token, `amr` otp); con la de email + contraseña manda a `/cuenta/recuperar`.
- **Recuperar contraseña:** `/cuenta/recuperar` manda un link de un solo uso (vence en 1 hora) a `/auth/confirm` → "Continuar" → `/cuenta/nueva-clave`. Responde lo mismo exista o no la cuenta, y no manda más de un mail por minuto al mismo usuario. Al guardar la contraseña nueva se cierran las otras sesiones y, si no estaba confirmado, el email queda verificado.
- **Los mails de cuenta** salen por el mismo SMTP que las entradas (§8), no por el de Supabase: el SMTP por defecto de Supabase solo le manda a los miembros del proyecto y con un límite de pocos mails por hora. Los links se arman con `auth.admin.generateLink`.
- **Datos:** `customers` y las entradas se leen solo desde el servidor (service_role). La migración `0011` sacó la policy `tickets_lectura_dueno` de `0003`, que con cuentas de compradores dejaba leer desde la API, con la sesión, las entradas de cualquier email (con la cédula completa).

### 5.7 Barra

Tragos que se compran por la web y se retiran en la barra con un QR por trago. Código: `src/lib/bar.ts`, `src/app/barra/`, `src/app/admin/barra/`, `src/app/admin/(panel)/events/[id]/barra/` · migración `0012_bar.sql`.

**Reglas**

- **La carta es por evento.** Los owners la cargan en Admin → evento → **Barra**: nombre, precio y descripción opcional. Se ordena con ↑ ↓ (es el orden de `/barra`) y cada trago se activa o desactiva. Uno desactivado no aparece en `/barra`. No se borran.
- **El precio de la carta es el final:** la barra no tiene cargo por servicio. El total lo calcula la base con los precios vigentes al comprar (`create_bar_order`): la app nunca manda un precio. Cada trago comprado guarda nombre y precio del momento, así que editar la carta no cambia los pedidos hechos.
- **Cuándo se vende:** para el próximo evento (el mismo de la landing, `getNextEvent()`), mientras esté publicado y no haya terminado, antes o durante la fiesta. No depende de "ventas activas" de las entradas ni de la contraseña del gate.
- **Pausar venta** (owners, Admin → Barra): nadie puede comprar; los QRs ya pagos se siguen entregando. Arranca prendida (`events.bar_paused = false`).
- **Solo Mercado Pago.** Hasta 20 de cada trago y 30 tragos por pedido.
- **No hace falta cuenta:** alcanza con el email (nombre opcional). La página recomienda ingresar con la cuenta; con sesión iniciada se precarga el email y el pedido guarda `user_id`, y una vez pago aparece en **Mi cuenta → Pedidos de barra** (§5.6).
- **Un QR por unidad:** 2 Fernet + 1 Jäger = 3 QRs, cada uno con su token opaco (como el de las entradas). Cada QR vale un trago y se entrega una sola vez.
  - El QR codifica `https://<sitio>/barra/qr/<token>`. Con la cámara del celular abre ese trago solo, sin datos del comprador: sirve para pasarle un trago a otra persona.
  - La página del pedido (`/barra/pedido/<token>`) usa otro token, distinto del de cada QR. Compartir un QR no expone el resto del pedido.

| Estado del pedido | Significa |
|---|---|
| `pending` | Armó el pedido y fue a pagar. Los QRs todavía no valen |
| `paid` | Mercado Pago lo aprobó: los QRs valen |
| `cancelled` | No se pudo crear el pago en Mercado Pago (no se cobró nada) |
| `refunded` | Se devolvió la plata: los QRs no valen. Hoy nada lo marca (ver §9) |

Cada trago del pedido está **Para retirar** (`delivered_at` vacío) o **Entregado** (con la hora y quién lo entregó).

**Compra**

```
/barra → elige tragos + email → startBarCheckoutAction
   │
   ├─ create_bar_order: pedido `pending` + una fila por trago (bar_order_units)
   └─ preferencia de Mercado Pago: una línea por trago, external_reference = "bar:<id>",
      vence cuando termina el evento
   ▼
página de pago de Mercado Pago
   ├──► MP llama a POST /api/mp/webhook ───────┐
   └──► la persona vuelve a /barra/pedido/<token> ┤
                                               ▼
        syncPayment: ve el prefijo "bar:" → confirm_bar_order_payment → `paid`
        → mail "Tu pedido de barra" con los QRs
```

- Igual que en las entradas: nunca se confía en la URL de vuelta ni en el cuerpo del webhook, se le pregunta a Mercado Pago. Confirmar dos veces no hace nada y el mail lo manda solo la llamada que confirmó. Si Mercado Pago informa un monto menor al total, no se confirma.
- **La vuelta consulta a Mercado Pago una sola vez:** después redirige a la misma página sin `payment_id` (queda `?status=` solo para el texto "El pago no se completó" o "en proceso"). Si Mercado Pago no respondió en ese momento, lo confirma el webhook.
- **Mercado Pago sin conectar** (falta `MP_ACCESS_TOKEN`): el botón avisa "El pago con Mercado Pago se habilita pronto" y no se crea nada.
- **Modo local** (`npm run dev` + `LOCAL_SIN_CLAVES=1`): aparece además **"Simular pago (solo local)"**. Crea el pedido y lo confirma como si Mercado Pago lo hubiera aprobado (la misma `confirm_bar_order_payment` y el mismo mail). La acción vuelve a chequear el modo local en el servidor: en Vercel no aparece ni funciona.

**La página del pedido** muestra un QR grande por vez. Se desliza de costado y abajo tiene un número por trago para saltar. Cada QR lleva el nombre del trago y "Para retirar" o "Entregado a las HH:MM". Mientras quede algo por retirar (o el pago esté pendiente) se refresca sola cada 5 s, sin perder el QR que se está mirando; con el pago rechazado, no. "Guardar este QR" baja el PNG de un trago y "Guardar todos en PDF" imprime todos.

**En la barra** (`/admin/barra/<id>`, botón "Abrir escáner de barra"). Lo usa cualquier admin, owner o staff:

1. **Escanear** el QR: muestra qué trago es (y a nombre de quién). No cambia nada.
2. **"Entregar"**: `deliver_bar_unit` lo marca entregado con un solo `UPDATE … WHERE delivered_at IS NULL`. Si dos barmans entregan el mismo QR a la vez, al segundo le aparece "Ya entregado a las HH:MM".

- Rechazos en rojo, hasta tocar "Cerrar": ya entregado, QR inválido, de otro evento, pedido sin pagar, y "Es una entrada" si escanean el QR de una entrada.
- **Sin QR:** el email muestra los tragos para retirar de esa persona en ese evento, con "Entregar" en cada uno. También acepta el código del QR pegado a mano. Un trago sale de la lista solo si quedó entregado (ahora, o justo antes por otro barman); cualquier otro resultado (pedido anulado, sesión vencida) se muestra en rojo como en el escaneo.
- **Sin conexión:** igual que en la puerta (§5.3): aviso neutro "Sin conexión. Probá de nuevo." con Reintentar, nunca "QR inválido". Si falla al entregar, el trago sigue en pantalla (o en la lista) para reintentar. Mismos botones de cámara y misma recarga tras un deploy nuevo.
- Arriba, el contador de tragos entregados / vendidos.
- Todo queda registrado: cada trago guarda `delivered_at` y `delivered_by_admin_id`, y cada escaneo (entregas y rechazos) queda en `bar_scans`.

### 5.8 Transporte

Bus opcional que se suma al comprar la entrada (la fiesta es fuera de Montevideo). Código: `src/lib/transport.ts`, `src/app/admin/(panel)/events/[id]/transporte/` · migración `0015_transport.sql`.

- **Opciones por evento**, en Admin → evento → **Transporte** (solo owners): nombre ("Ida", "Vuelta", "Ida y vuelta"), punto y horario de salida (texto libre), precio y cupo opcional. Se activan o desactivan. Una opción que alguien eligió no se borra: se desactiva.
- **En `/entradas`**, antes de "¿Cómo querés pagar?": "¿Necesitás transporte?" con "No, gracias" (por defecto) y las opciones activas con precio, horario y "Quedan N" si tienen cupo ("Sin lugares" si se llenó). Va antes del pago para que el total a transferir ya incluya el bus. Sin opciones activas, no aparece.
- **Precio:** se suma al total. El código de descuento aplica solo a la entrada. Con Mercado Pago el cargo del 7,5 % va sobre todo lo que se cobra (entrada con descuento + bus); con transferencia no hay cargo. Ej.: $1.600 + bus $400 → Mercado Pago $2.150 (cargo $150); transferencia $2.000.
- **Registro:** `amount_paid_uyu` guarda el total cobrado (entrada + bus + cargo), así cierra con lo que confirma Mercado Pago. El bus va en `ticket_transport` (una fila por entrada) con el precio del momento: cambiar el precio de la opción no toca a quien ya compró. En Mercado Pago es una línea más de la preferencia ("Transporte · …"). Reembolsar devuelve el total, bus incluido.
- **Cupo:** cuenta solo entradas vivas (`pending` sin vencer, `review`, `paid`, `used`). Si la entrada se anula, se rechaza la transferencia o vence la reserva de Mercado Pago, el lugar se libera solo.
  - Justo después de `create_ticket`, `reserve_transport` bloquea la opción (como la tanda) y reserva el lugar. Si no hay, borra en la misma transacción la entrada recién creada (todavía sin pago ni comprobante): la persona ve "No quedan lugares en el bus…" y no se crea ni se cobra nada.
  - Igual que con la tanda, un pago de Mercado Pago aprobado después de vencida la reserva se honra, y puede pasar el cupo por 1.
- **Dónde se ve:** la entrada (`/ticket/<token>`), los mails "Recibimos tu comprobante", "Entrada confirmada" y el aviso a los owners (línea "Transporte" en el desglose, más el punto y horario), Mis entradas y Admin → Entradas ("Bus: …").
- **Lista para el chofer:** Admin → Transporte muestra los pasajeros de cada opción (nombre, cédula, celular, estado). "Descargar CSV" (`;`, UTF-8 con BOM) e "Imprimir" (una hoja por opción, con casilla para tildar) llevan solo entradas válidas (pagas o usadas): una transferencia sin validar no figura.
- **Fuera de alcance:** las entradas manuales e invitaciones no llevan bus; si hace falta, se arregla por fuera.

---

## 6. Dónde vive cada regla

| Regla | Dónde |
|---|---|
| Stock, una por persona, reservas | `create_ticket` — `supabase/migrations/0006_ticketing.sql` (última versión en `0014_tier_features.sql`) |
| Preventa (código) y tandas que todavía no salieron | `create_ticket` (`0014`): `presale_required`, `tier_not_started` |
| Ingreso temprano en puerta (aviso, `late_entry`) | `entry_deadline`, `inspect_ticket`, `check_in_ticket` (`0014`) |
| A quién le llega el mail de preventa | `presale_audience` + `presale_sends` (`0014`) · `src/lib/mail/presale-mails.ts` |
| Confirmar pago (idempotente, controla el monto, pagos tarde o repetidos) | `confirm_ticket_payment` — misma migración (última versión en `0017_payment_fixes.sql`) · `syncPayment` en `src/lib/mercadopago.ts` |
| Reserva que espera un pago pendiente; devolución o contracargo desde MP | `extend_ticket_hold` / `reverse_ticket_payment` (`0017`) |
| Capacidad del evento | `event_available` y `create_ticket` (`0018_event_capacity.sql`) · `src/lib/next-event.ts` |
| No repetir recordatorio, encuesta ni preventa | `0019_comms_dedupe.sql` (`email_log.send_key` + `sending`) · `src/lib/mail/event-mails.ts`, `src/lib/mail/presale-mails.ts` |
| Anular / devolver stock | `cancel_ticket` — misma migración |
| Puerta: consultar sin cambiar / confirmar / cancelar | `inspect_ticket`, `reject_check_in` (`0007_door_two_step.sql`) y `check_in_ticket` (`0006`) |
| Normalizar email/CI/IG, token, URL del QR | `src/lib/tickets.ts` |
| Precio: descuento + cargo por servicio según medio de pago | `src/lib/pricing.ts` |
| Códigos de descuento (validez, usos) | `src/lib/discounts.ts` · `discount_code_uses` y `create_ticket` (`0010`) |
| Transferencias: comprobante, aprobar y rechazar | `src/lib/receipts.ts`, `src/lib/transfers.ts` · `approve_transfer` / `reject_transfer` (`0010`; `approve_transfer` en `0016`) · panel `src/app/admin/(panel)/confirmar/` |
| Límite de intentos por IP | `src/lib/rate-limit.ts` · `rate_limit_hit` / `rate_limit_hits` (`0016`) |
| Contraseña sí/no, medios de pago, datos para transferir | `src/lib/sale-config.ts` (`site_config`) |
| Mercado Pago (preferencia, consulta, reembolso, firma) | `src/lib/mercadopago.ts` |
| Contraseña del gate y rotación | `src/lib/auth/gate.ts`, `src/app/api/gate/route.ts` |
| Qué rutas se protegen | `src/middleware.ts` |
| Cuentas de compradores: crear, Mis entradas, confirmar email, recupero | `src/lib/customers.ts` · `customers`, `tickets.customer_id`, `find_auth_user` (`0011`) |
| Próximo evento y qué tandas se pueden comprar (próximas, preventa oculta sin código) | `src/lib/next-event.ts` |
| Barra: crear pedido (total con precios vigentes, tragos activos, evento abierto y sin pausar) | `create_bar_order` — `supabase/migrations/0012_bar.sql` |
| Barra: confirmar pago (idempotente) | `confirm_bar_order_payment` (`0012`) · `confirmBarOrder` en `src/lib/mercadopago.ts` |
| Barra: escanear sin cambiar / entregar una sola vez | `inspect_bar_unit` / `deliver_bar_unit` (`0012`) |
| Barra: resumen por trago | `bar_summary` (`0012`) |
| Barra: carrito, tokens y URLs de los QRs | `src/lib/bar.ts` |
| Transporte: cupo del bus (atómico, solo entradas vivas) | `reserve_transport` / `transport_seats_taken` — `supabase/migrations/0015_transport.sql` · `src/lib/transport.ts` |
| CSV de puerta y de bus: celular como texto ("099 123 456", para que Excel no se coma el 0), sin tope de 1000 filas | `formatPhone` en `src/lib/tickets.ts` · `fetchAll` en `src/lib/supabase/admin.ts` |

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

## 8. Mails

| Mail | Cuándo se manda | Código |
|---|---|---|
| Entrada confirmada (con QR) | Mercado Pago aprueba el pago: lo manda solo la llamada que confirmó, así webhook + página de vuelta no lo duplican | `syncPayment` en `src/lib/mercadopago.ts` |
| Entrada confirmada | Un admin carga una entrada manual o invitación, con la casilla "Mandarle la entrada por mail" (tildada por defecto) | `createManualTicketAction` |
| Entrada confirmada | Botón "Reenviar mail" en Admin → Entradas | `resendTicketMailAction` |
| Entrada anulada (+ reembolso) | Un admin anula o reembolsa una entrada **válida** (no se avisa por compras pendientes), o Mercado Pago informa una devolución o contracargo (§5.2). Texto neutro, sin acusar: también se anula por arrepentimiento o fecha cancelada | `cancelTicketAction`, `syncPayment` |
| Pago para revisar (a los owners) | Un pago de Mercado Pago que hay que resolver a mano: revivió una entrada anulada, pago repetido, persona con otra entrada, monto menor, devolución o contracargo (§5.2). Una vez por entrada (`payment_alert`) | `alertOwners` en `src/lib/mercadopago.ts` |
| Recibimos tu comprobante | La persona compra por transferencia | `startCheckoutAction` |
| Transferencia para validar (a los owners, con el comprobante adjunto) | Ídem | `sendTransferAdminAlert` |
| Entrada confirmada | Un owner acepta la transferencia (Entradas a confirmar o la pestaña Entradas) | `approveTransfer` en `src/lib/transfers.ts` |
| No pudimos validar tu transferencia | Un owner la declina | `rejectTransfer` en `src/lib/transfers.ts` |
| Confirmá tu email (cuenta) | Se crea una cuenta al comprar, o la persona toca "Mandame el link de nuevo" en `/cuenta` | `sendAccountConfirmMail` en `src/lib/customers.ts` |
| Elegí una contraseña nueva (cuenta) | La persona lo pide en `/cuenta/recuperar` | `sendPasswordResetMail` |
| Preventa (link `/entradas?preventa=CODIGO`) | Un owner toca "Mandar preventa a quienes vinieron antes" (§5.2d). Queda en `presale_sends`, no en `email_log` | `sendPresaleMails` en `src/lib/mail/presale-mails.ts` |
| Tu pedido de barra (un QR por trago, con su nombre, y el link al pedido) | Se confirma el pago (Mercado Pago o la simulación local): lo manda solo la llamada que confirmó | `sendBarOrderMail` en `src/lib/mail/bar-mails.ts` |

- **Envío:** SMTP de Gmail (`src/lib/mail/send.ts`), con `GMAIL_USER` + `GMAIL_APP_PASSWORD`. Gmail permite unos 500 mails por día.
- **Si falta configuración o falla el envío**, se loguea y la acción sigue: un mail nunca bloquea una compra.
- **Registro:** cada envío queda en `email_log` (enviado o fallido). Los mails de cuenta no, porque no son de una entrada. Los de barra se registran con `bar_order_id` (tipo `bar_order`).
- **Plantillas:** `src/lib/mail/templates.ts`, con tablas y estilos inline, que es lo que respetan los clientes de mail. El QR va como imagen adjunta embebida (`cid:qr`), porque Gmail no muestra imágenes `data:`.
- **Instagram del pie y de los botones:** sale de `site_config.ig_handle` (`getIgHandle()`), como en la web.
- **Preventa:** lleva al pie cómo darse de baja (responder el mail o escribir por Instagram). La baja se carga poniendo el email en la tabla `whitelist` con status `banned`, que `presale_audience` ya excluye.
- La cédula enmascarada usa espacios de no corte, para que no se parta en dos líneas en el celular.
- Estos mails (Antes de ir, encuesta y preventa) están declarados en `/privacidad`.
- **Pendiente:** dominio propio + `no-reply@` con Resend; ver `docs/BACKLOG.md`.

## 8b. Caché

Las consultas a Supabase se hacen con `cache: 'no-store'` (`src/lib/supabase/admin.ts` y `server.ts`). Next 14 cachea por defecto los `fetch` del servidor, y la app mostraba datos viejos: una entrada usada seguía figurando como válida. Los datos de esta app cambian en tiempo real, así que **no se cachea nada de la base**.

## 8c. Seguridad: límite de intentos y lectura pública

**Límite de intentos por IP** (`src/lib/rate-limit.ts`, migración `0016`). La IP sale de `x-forwarded-for` (primer valor; en Vercel lo pone la plataforma) o `x-real-ip`. El conteo es atómico en Postgres (`rate_limit_hit` sobre `rate_limit_hits`, sin acceso público). Pasado el límite se muestra "Hiciste muchos intentos seguidos. Esperá unos minutos y probá de nuevo."

| Qué | Límite | Se cuenta |
|---|---|---|
| Compra (`startCheckoutAction`) | 30 cada 10 min | Después de validar el formulario (un error de tipeo no gasta intentos), antes de consultar cuentas, códigos o crear la entrada |
| "Aplicar" código (`checkDiscountAction`) | 30 cada 10 min | Antes de buscar el código |
| Pedido de barra | 120 cada 10 min (en la fiesta todos comparten el wifi; un pedido sin pagar no reserva nada) | Con el carrito ya validado, antes de crear el pedido |
| Contraseña del gate (`/api/gate`) | 5 cada 15 min (fijado en CLAUDE.md §7.2) | Todos los intentos, antes de comparar la contraseña |
| Login de compradores y de admins | 10 cada 15 min | Antes de llamar a Supabase (Supabase ve la IP de Vercel, no la de quien prueba, así que su propio límite no sirve) |
| Recuperar contraseña y reenviar confirmación (compradores y admins) | 5 cada 15 min | Cada uno manda un mail y Gmail corta en ~500 por día. Pasado el límite, el recupero responde lo mismo que siempre y no manda nada |
| `/compra/resultado` | 60 cada 10 min | Antes de consultar el pago a Mercado Pago |

- Los intentos rechazados no se registran: el bloqueo se levanta solo cuando vence la ventana.
- **Si la tabla o la función fallan, se deja pasar** (y se loguea): un límite caído no frena una compra.
- **En `npm run dev`, los pedidos desde la propia máquina (`::1`, `127.0.0.1`) no cuentan**, para que los scripts de prueba puedan comprar muchas veces. Para probar el límite en local, mandar otro `x-forwarded-for`.
- Varias personas detrás de la misma IP (por ejemplo, el mismo wifi) comparten el límite.
- **Recuperar contraseña tarda siempre 1,5 s** y responde igual exista o no la cuenta: no se puede averiguar quién tiene cuenta.

**Redirecciones** (`safeNextPath` en `src/lib/auth/gate.ts`): `?next=` solo acepta rutas del propio sitio. Se resuelve como lo haría el navegador (que borra tabs y saltos de línea, así que `/	/sitio.com` terminaría en `//sitio.com`): cualquier cosa que apunte afuera vuelve a la ruta por defecto.

**Links del mail** (`/auth/confirm`): al abrir un link válido (confirmar email, recupero, invitación de admin) se le pone una contraseña al azar a la cuenta y se cierran las otras sesiones. Así, si alguien había creado la cuenta con ese email, su contraseña y su sesión dejan de valer; la persona elige la suya en la pantalla siguiente.

**Admin sin conexión** (`getAdminUser`): si Supabase no responde, tira error en vez de tratarlo como "sesión vencida". En la puerta y la barra se ve "Sin conexión" y se puede reintentar sin que echen al portero.

**Sin lectura pública** (`0016`). Se borraron las policies `eventos_lectura_publica` y `tiers_lectura_publica`: con la anon key se podían leer todas las columnas de eventos y tandas, incluido el código de preventa (`presale_code`) y `quantity_sold`. La app lee todo desde el servidor con la service key, así que no cambia nada visible. `tier_available` tampoco se puede llamar con la anon key.

## 9. Límites conocidos (decisiones conscientes)

- **Una entrada por compra.** No hay selector de cantidad: cada persona compra la suya, con su cédula.
- **La contraseña es compartida.** Alguien puede pasársela a un amigo, que compraría con su propia cédula. Se mitiga rotándola y revisando la lista por Instagram.
- **Sin modo offline en puerta.** El scanner necesita internet.
- **Invitaciones sin control de capacidad total.** No descuentan de ninguna tanda.
- **Barra: devoluciones por fuera.** No hay reembolso de barra desde el admin, y si se devuelve un pago desde el panel de Mercado Pago el webhook no lo marca `refunded`: esos QRs siguen valiendo hasta que alguien cambie el pedido a mano.

## 10. Comunicación con quienes tienen entrada

En Admin → evento → **Resumen**, sección "Comunicación". Mandar: solo owners.

| Mail | A quién | Qué lleva |
|---|---|---|
| **Antes de ir** (recordatorio) | Entradas válidas (`paid`) | Fecha y hora, lugar con link a Google Maps, "Cómo llegar" (si se cargó), qué llevar (cédula física + QR), las reglas de la landing y su entrada con el QR embebido |
| **Encuesta** | Quienes entraron (`used`) | Link a `/encuesta/<token>` (el mismo token del QR, que ya no sirve para entrar). Tocar un número del mail abre la encuesta con ese puntaje elegido |

- **No se repite:** cada envío queda en `email_log` (`reminder` / `survey`). "Mandar" va solo a quien no tiene un envío exitoso de ese tipo; los que fallaron quedan pendientes. **"Reenviar a todos"** manda de nuevo a todos.
- **Dos envíos a la vez no duplican** (`0019_comms_dedupe.sql`): cada destinatario se reserva antes de mandar (fila de `email_log` en `sending` con `send_key` único) y el mail sale solo si la reserva entró; después pasa a `sent` o `failed`. Vale para dos owners a la vez, un doble clic o el cron mientras alguien manda a mano. El aviso dice a cuántos "ya se lo estaba mandando otro envío". Una reserva colgada más de 10 minutos se reintenta. Límite conocido: dos "Reenviar a todos" iniciados a la vez sí pueden duplicar.
- El Instagram del pie sale de `site_config.ig_handle`, como el resto de los mails.
- **Por tandas:** un clic manda durante unos 45 segundos (4 mails en paralelo). Si quedan pendientes, el aviso dice cuántos y se toca de nuevo. Si fallan 5 seguidos (por ejemplo, se llegó al límite de Gmail), se corta.
- **"Cómo llegar":** texto libre del evento (`events.arrival_info`), opcional. Va en el recordatorio, abajo del link a Maps.
- **Automático:** `GET /api/cron/comunicacion`, una vez por día a las 12:00 de Montevideo (`vercel.json`). El día anterior al evento manda el recordatorio a quien no lo recibió, y el mismo día lo vuelve a intentar con los que compraron después. El día siguiente, ya terminado el evento, manda la encuesta, y al otro día repite con los pendientes. Pide `CRON_SECRET`: sin esa variable solo responde en desarrollo.
- **Encuesta** (`/encuesta/<token>`): puntaje del 1 al 5, "¿Qué mejorarías?" (opcional) y "¿Volverías a la próxima?". Una respuesta por entrada (`event_feedback`, `ticket_id` único): si vuelve a entrar, la ve cargada y la puede cambiar. Un token que no existe da 404. Una entrada que no se usó en puerta ve "Esta encuesta es para quienes vinieron".
- **Resultados** en la misma sección: promedio, cuántos respondieron de los que entraron, % que volvería, puntajes y los comentarios (sin nombre).
- **Límite de Gmail:** unos 500 mails por día **en total**, contando las entradas que se venden ese día. Con más de ~400 entradas, el recordatorio puede dejar a Gmail sin cupo para los mails de compra; hasta tener Resend (ver `docs/BACKLOG.md`), conviene mandarlo a mano un par de días antes.

Código: `src/lib/mail/event-mails.ts` · `src/app/admin/(panel)/events/[id]/comms.tsx` · `src/app/encuesta/[token]/` · `src/app/api/cron/comunicacion/route.ts` · SQL: `0013_event_comms.sql`.
