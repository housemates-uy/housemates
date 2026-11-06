# Lógica de negocio — House Mates web

> Cómo funciona la app, explicado para alguien que no escribió el código.
> Si cambiás una regla de negocio, actualizá este documento en el mismo PR.
> Última actualización: 2026-11-05.

---

## 1. Qué es esto

Una sola app (Next.js en Vercel + base Postgres en Supabase) con tres partes:

| Parte | Para quién | Dónde |
|---|---|---|
| **Sitio público** | Cualquiera que llega desde Instagram | `/` |
| **Compra de entradas** | Cualquiera con el link (o quien tiene la contraseña, si está prendida) | `/entradas` |
| **Barra** | Quien entra con el QR impreso en la fiesta o el link de las historias compra antes o durante la fiesta: un QR por trago, que se retira solo durante la fiesta (§5.7) | `/barra` |
| **Admin** | Los socios (owners) y el staff de puerta | `/admin` |
| **Escáner** | Los barmans con su usuario de barra (solo el escáner de barra), y owners y staff (links a la puerta y la barra) | `/scan` |

Las entradas son **QR personales**: una por persona, a nombre y cédula, y de un solo uso en puerta.

---

## 2. Mapa de rutas

### Públicas (no piden nada)

| Ruta | Qué hace | Archivo |
|---|---|---|
| `/` | Landing: próxima fecha (con el formato del evento, p. ej. "Open air", y su descripción si se cargó), la casa, reglas y botón Entradas (sin tandas ni precios). Arriba a la derecha va **solo Entradas**, destacado (más "Mi cuenta" si está prendida); la Barra y el Instagram quedan en el pie. **El lugar y las reglas se ven solo con acceso** (contraseña o código, §3: "Lo que se ve con acceso"). Los textos se cambian en `/admin/landing`. Sin evento publicado, o si la base no responde en 2,5 s, dice "Próxima fecha a confirmar": nunca una fecha ni un lugar inventados (`getNextEvent` devuelve `id: null`) | `src/app/page.tsx` |
| `/access?next=…` | Pide la contraseña del gate y te manda a `next` | `src/app/access/` |
| `/ticket/<token>` | La entrada de una persona, con el QR | `src/app/ticket/[token]/page.tsx` |
| `/compra/resultado` | Adonde vuelve la persona después de pagar en Mercado Pago o de mandar el comprobante. El link a la entrada (y su nombre) se muestra solo a quien la compró: cookie `hm_compra` de este navegador, el `preference_id` de esa compra o la cuenta que la compró. A cualquier otro le dice que la entrada le llega por mail | `src/app/compra/resultado/page.tsx` |
| `/barra` | **Barra**: carta del próximo evento, elegir tragos, email y pagar con Mercado Pago (§5.7). Solo con la cookie del link o el QR de la barra; sin ella, un aviso y no la carta | `src/app/barra/page.tsx` |
| `/barra/k/<clave>` | Lo que abre el QR impreso en la fiesta o el link de las historias: deja la cookie `hm_barra` (24 h) y manda a `/barra`. Con una clave vieja o que no existe, a `/barra` sin cookie | `src/app/barra/k/[key]/route.ts` |
| `/barra/pedido/<token>` | Un pedido de barra: un QR por trago con su estado; se actualiza sola. Adonde vuelve la persona desde Mercado Pago | `src/app/barra/pedido/[token]/` |
| `/barra/qr/<token>` | Un trago suelto: lo que abre la cámara al escanear un QR de barra (sin datos del comprador). `/imagen` lo baja en PNG | `src/app/barra/qr/[token]/` |
| `/preguntas-frecuentes`, `/terminos`, `/privacidad` | Ayuda y legales (FAQ en acordeón, términos con devoluciones según Ley 17.250, privacidad según Ley 18.331). Linkeadas desde el pie de la landing. **Preguntas frecuentes pide acceso** (contraseña o código, §3): sin él va a `/access?next=/preguntas-frecuentes` y, al entrar, vuelve ahí. Términos y Privacidad siguen públicas | `src/app/preguntas-frecuentes/`, `src/app/terminos/`, `src/app/privacidad/` · `src/components/legal/` |
| `/auth/confirm` | Links por mail: invitación / recuperar contraseña de un admin, y confirmar email / recuperar contraseña de un comprador (estos traen `&next=/cuenta…`) | `src/app/auth/confirm/` |
| `/admin/login` | Login del admin | `src/app/admin/login/` |

### Compra (contraseña opcional)

| Ruta | Qué hace | Archivo |
|---|---|---|
| `/entradas` | Muestra el próximo evento y el formulario de compra | `src/app/entradas/page.tsx` |

### Cuenta del comprador (ver §5.6)

Solo con **Mi cuenta prendida** en `/admin/config`. Apagada, estas rutas llevan al inicio.

| Ruta | Qué hace | Archivo |
|---|---|---|
| `/cuenta` | **Mis entradas** (próximas y pasadas, con "Ver entrada"), **Pedidos de barra** pagos con la cuenta (con "Ver pedido"), editar nombre y celular, salir. Sin sesión → `/cuenta/ingresar` | `src/app/cuenta/page.tsx` |
| `/cuenta/ingresar?next=…` | Email + contraseña; vuelve a `next` | `src/app/cuenta/ingresar/` |
| `/cuenta/recuperar` | Pide el link por mail para elegir otra contraseña | `src/app/cuenta/recuperar/` |
| `/cuenta/nueva-clave` | Elegir la contraseña (solo con la sesión del link del mail: confirmar email o recupero) | `src/app/cuenta/nueva-clave/` |

### Admin (requiere usuario de Supabase **y** fila activa en la tabla `admins`, con rol owner o staff: el usuario de barra va a `/scan`, §5.5)

| Ruta | Qué hace | Quién |
|---|---|---|
| `/admin` | Inicio: el próximo evento publicado (vale hasta que termina: durante la fiesta dice "Evento en curso") y sus entradas válidas | todos |
| `/admin/events` | Lista y alta de eventos. Cada evento tiene Editar y Duplicar a la vista, y un menú (⋯ o clic derecho) con Editar, Duplicar, Archivar/Desarchivar y Eliminar | ver: todos; alta, editar, duplicar, archivar y eliminar: owner |
| `/admin/confirmar` | **Entradas a confirmar**: las transferencias con comprobante de todos los eventos, para aceptar o declinar (§5.2b). Una tarjeta por compra (con todas sus entradas, §5.2e). En el menú, con un contador de compras pendientes | owner (el staff no la ve) |
| `/admin/events/<id>` | Resumen del evento, tandas, activar ventas, archivar, preventa (link y mail a quienes vinieron antes), duplicar para otra fecha | ver: todos; editar el evento, tandas (precio, cupo, activar, agotar), ventas, archivar, preventa y duplicar: owner |
| `/admin/events/<id>/duplicar` | **Duplicar para otra fecha**: título (precargado), Inicio y Fin (hora de Montevideo; el fin se completa con la duración del original). Crea una copia en borrador y lleva a su edición con un aviso para revisar lugar, tandas y precios, transporte y barra | owner |
| `/admin/events/<id>/ventas` | **Ventas**: entradas válidas contra capacidad, vendidas por tanda, códigos de descuento, ventas por día y, el día del evento, la puerta en vivo (se refresca sola cada 10 s). "Recaudado" incluye transporte y cargo por servicio, con el desglose "Entradas y cargo" / "Transporte". El Resumen del evento usa las mismas "Entradas válidas" (pagas + usadas, con invitaciones) | todos; la plata (recaudado, medios de pago, montos): owner |
| `/admin/events/<id>/lista` | Descarga la **lista de la puerta** en CSV para Excel (`;`, UTF-8 con BOM) | todos |
| `/admin/events/<id>/lista/imprimir` | La misma lista para imprimir en blanco y negro, con casilla para tildar a mano | todos |
| `/admin/events/<id>/tickets` | **Entradas**: transferencias a validar del evento (lo mismo que Entradas a confirmar), cargar manuales/invitaciones, buscar (en la base, por nombre, email o cédula), anular, reembolsar. Lista de a 100 con "Más nuevas / Más viejas"; los totales se cuentan en la base, sin el tope de 1000 filas | ver y buscar: todos; cargar entradas e invitaciones, anular, reembolsar, validar transferencias, ver comprobantes y la plata: owner |
| `/admin/events/<id>/descuentos` | **Descuentos**: códigos del evento y sus usos | crear y pausar: owner |
| `/admin/events/<id>/barra` | **Barra**: venta abierta/pausada, **link y QR de la barra** (copiar el link, descargar el QR en PNG, imprimirlo y "Cambiar link"), resumen (pedidos pagos, total vendido, tragos vendidos y entregados por trago), carta y pedidos | todos; carta, pausar venta y cambiar link: owner |
| `/admin/events/<id>/barra/imprimir` | Cartel A4 con el QR de la barra para pegar en la fiesta, en negro sobre blanco | todos |
| `/admin/events/<id>/transporte` | **Transporte**: opciones de bus del evento y pasajeros por opción, con CSV (`/pasajeros`) e imprimible (`/imprimir`) para el chofer (§5.8) | todos; cambiar opciones: owner |
| `/admin/scan/<id>` | **Puerta**: scanner de QR, pantalla completa, solo celular | todos; cerrar puerta: owner |
| `/admin/barra/<id>` | **Escáner de barra**: un QR = un trago, pantalla completa; sin QR, por email | owner y staff (el usuario de barra lo usa desde `/scan`) |
| `/scan` | **Escáner** (fuera del panel): el usuario de barra ve solo el escáner de barra de la fiesta en curso o la próxima; owners y staff, links a la Puerta y a la Barra de esa fiesta. Sin sesión, al login del admin, que vuelve a `/scan` | usuario de barra, owner y staff |
| `/admin/config` | Venta (pedir contraseña sí/no, medios de pago, datos para transferir, máximo de entradas por compra), **Mi cuenta** (prender o apagar, §5.6) y contraseña del gate | cambiar: owner |
| `/admin/landing` | **Landing**: título de la portada, La casa (título, texto y créditos opcionales), Reglas (título y lista: agregar, sacar, reordenar, hasta 12) e Instagram del sitio. **Fotos y videos**: maqueta de la portada (compu y celular) y de la grilla de La casa; tocar un lugar para cambiarlo por una foto o un video, editar su texto alternativo o volver a la original. Ver "Landing" abajo | owner (el staff no la ve) |
| `/admin/events/<id>/accesos` | **Accesos**: códigos de acceso del evento (§3b) | owner (el staff no la ve) |
| `/admin/account` | Cambiar mi contraseña | todos |
| `/admin/admins` | Usuarios y **Nuevo usuario de barra** (nombre, email y contraseña; §5.5) | owner |
| `/admin/compradores` | **Compradores**: la base para el mailing, un email por persona con su nombre, última fiesta, en cuántas fiestas tuvo entrada y si pidió la baja. Buscador, totales y "Descargar CSV" (`/admin/compradores/csv`). Solo para ver y bajar: no manda mails (§8) | owner (ni staff ni barra) |
| `/admin/logs` | **Historial**: las últimas 200 acciones, con fecha (hora de Montevideo), quién, qué y el detalle "Campo: antes → después" al editar evento, tanda, configuración de venta (incluidos los datos para transferir; nunca la contraseña) y la landing (incluido el Instagram, y las fotos y videos: lugar, archivo antes → después y texto alternativo) | owner |

**Menú de acciones (clic derecho), solo en el admin** (`src/components/admin/context-menu.tsx`):
- En las listas del admin (eventos, tandas, transporte, carta, descuentos, accesos y entradas), el clic derecho, mantener apretado en el celular, Shift+F10 o el botón ⋯ abren las acciones de esa fila.
- Son las mismas acciones y permisos que los botones: el staff solo ve lo que puede hacer (en Entradas: Ver entrada y Reenviar mail; en Descuentos: Copiar código).
- Anular, reembolsar, archivar y eliminar piden confirmación.
- La web pública no tiene este menú: ahí el clic derecho es el del navegador.

**Edición de eventos y tandas:**
- Archivar y desarchivar (también desde Editar y en el alta) es solo de owners; archivar apaga las ventas. **Desarchivar** deja el evento en borrador.
- **Eliminar** (`0025_admin_delete.sql`, solo owners, con la confirmación "¿Eliminar X? No se puede deshacer"). Solo se elimina lo que nunca se usó; lo demás se archiva, se desactiva o se pausa:
  - **Evento:** solo si nunca tuvo entradas (de ningún estado), pedidos de barra ni escaneos en la puerta o la barra (`event_delete_blocker`). Se va con sus tandas, transporte, carta y códigos en una sola transacción (`admin_delete_event`). Si no se puede, el menú ofrece archivarlo y dice por qué.
  - **Tanda:** solo sin ninguna entrada; si no, se desactiva.
  - **Opción de transporte:** solo si nadie la eligió; si no, se desactiva.
  - **Trago:** solo si no está en ningún pedido (`admin_delete_bar_product`); si no, se desactiva.
  - **Código de descuento o de acceso:** solo si ninguna entrada lo usó, de ningún estado (`admin_delete_discount_code`; el de acceso lo frena la base); si no, se pausa.
  - Todo queda en el Historial (`delete_event`, `delete_tier`, `delete_transport_option`, `delete_bar_product`, `delete_discount_code`, `delete_access_code`, `unarchive`) con el nombre de lo eliminado y, en un evento, la lista de lo que se borró con él.
- El nombre de la tanda es único por evento sin importar mayúsculas. El cupo no puede quedar por debajo de lo vendido (el servidor lo controla).
- Si las tandas activas suman más que la capacidad del evento, se avisa: se vende hasta la capacidad, invitaciones incluidas (§4.3).
- El alta es atómica: si fallan las tandas, no queda el evento creado.
- **Duplicar** (`duplicate_event`, migración `0023`, una sola transacción): para cada fiesta nueva se copia la anterior y se ajusta a mano.
  - **Se copia:** lugar, URL del mapa, capacidad, formato, descripción, hero, galería y lineup; las tandas (nombre, descripción, precio, cupo, orden, activa, ingreso temprano y código de preventa) con 0 vendidas, sin agotar a mano y sin fechas de salida a la venta; el transporte (nombre, punto y horario de salida, precio, cupo, activa) en el mismo orden; la carta de la barra (nombre, descripción, precio, activo, orden y foto).
  - **Cómo queda:** borrador, ventas apagadas, puerta abierta y barra sin pausar, con un link de barra nuevo (`0031`: el QR de la fiesta anterior no abre la barra de esta). Slug desde el título, con -2, -3… si ya existe.
  - **No se copia:** entradas, compras, check-ins, códigos de descuento y de acceso, pedidos de barra, comunicaciones ni encuestas.
  - Queda en el Historial (`duplicate_event`) con de qué evento se copió.
- **Formato** (`events.format`, migración `0022`, por defecto "Open air", hasta 30 caracteres): sale en la landing, `/entradas`, la entrada y Preguntas frecuentes. "Es al aire libre: calzado cómodo…" sale solo si el formato dice open air o aire libre.
- **Descripción** (`description_md`, hasta 1000 caracteres): texto simple con saltos de línea debajo de la próxima fecha, sin Markdown.

**Landing** (`/admin/landing`, `src/lib/landing.ts`, `getLandingContent` en `src/lib/site.ts`):
- Claves en `site_config`: `landing_hero_title`, `landing_house_title`, `landing_house_text` (un renglón vacío arma otro párrafo), `landing_house_credits` (vacío = no se muestra), `landing_rules_title`, `landing_rules` (una por renglón, hasta 12 de 160 caracteres) e `ig_handle` (se normaliza y se guarda con @; es el Instagram de toda la web y de los mails).
- Si una clave no está, va el texto de siempre (`LANDING_DEFAULTS`). Si la base no responde en 2,5 s, también.
- Se guarda solo lo que cambió, queda en el Historial (`update_landing`, con antes y después) y se actualiza todo el sitio.
- **Fotos y videos** (`0024_landing_media.sql`, `src/app/admin/(panel)/landing/media-editor.tsx`):
  - **Lugares:** 11: portada compu (`hero-desktop`), portada celular (`hero-mobile`) y La casa 1 a 9 en orden de lectura. Cualquiera puede ser foto o video. Por defecto, los de `public/photos` y `public/video` (`LANDING_MEDIA_DEFAULTS` en `src/lib/landing.ts`).
  - **Dónde se guarda:** `site_config.landing_media`, un JSON solo con los lugares cambiados (tipo, URL, poster si es video, texto alternativo y medidas). Solo se acepta el archivo de siempre de ese lugar o uno del bucket de ese lugar; si la base no responde, van los de siempre.
  - **Archivos:** bucket público `landing` de Supabase Storage: fotos JPG, PNG, WebP o AVIF hasta 15 MB y videos MP4, WebM o MOV hasta 50 MB. El navegador sube directo con un link firmado que el servidor da solo a owners (Vercel corta los pedidos en 4,5 MB), con barra de avance. De cada video se saca el primer cuadro como imagen fija.
  - **Al reemplazar o volver a la original** se borra del bucket el archivo anterior (nunca los de `public/`), queda en el Historial (`update_landing_media`) y la landing se actualiza.
  - **Texto alternativo:** obligatorio en La casa; la portada no lo lleva porque es de fondo.
  - **En la landing:** las fotos pasan por `next/image` (`remotePatterns` con el host de Supabase en `next.config.mjs`); los videos, sin sonido, en loop, se bajan al entrar en pantalla y con "reducir movimiento" se ve solo la imagen fija.
  - Límite conocido: si dos owners guardan lugares distintos en el mismo segundo, el último puede pisar al otro.

### Endpoints de máquina

| Ruta | Quién la llama | Qué hace |
|---|---|---|
| `POST /api/gate` | El form de `/access` | Valida la contraseña y deja una cookie |
| `POST /api/mp/webhook` | Mercado Pago | Avisa cambios de un pago → confirma la entrada, o el pedido de barra si el `external_reference` es `bar:<id>` |
| `GET /api/cron/keepalive` | Vercel, una vez por día | Consulta mínima para que Supabase (plan gratis) no se pause |

`src/middleware.ts` protege solo `/admin*`, `/api/admin*` y `/scan` (sin sesión, al login; desde `/scan`, con `?next=/scan`), y en `/cuenta*`, `/entradas` y `/compra/resultado` solo refresca la sesión de Supabase (las páginas de `/cuenta` piden la sesión ellas mismas). La contraseña de compra la chequea `/entradas` con `hasGateAccess()`, igual que la landing (lugar y reglas) y Preguntas frecuentes (§3) (el middleware no puede saber si está prendida sin consultar la base).

---

## 3. La contraseña del gate

- **Se prende y apaga** desde `/admin/config` → "Pedir contraseña para comprar" (`site_config.gate_enabled`). Arranca **prendida** (migración `0010`) y solo se apaga con un `'0'` explícito: si falta el valor o la base no responde, se pide igual. Apagada, cualquiera con el link compra.
- Si está prendida, se pide **para comprar** (`/entradas`) y para ver lo que no es para el público (abajo). El resto de la landing es pública.
- **Lo que se ve con acceso** (ADR #039). Con acceso = `hasGateAccess()`: entró con la contraseña, entró con un código al que le quedan entradas, o la contraseña está apagada (ahí lo ve cualquiera).
  - **El lugar del evento** ("Dónde" en la landing): sin acceso va un texto de relleno desenfocado (no es el lugar) y "Se ve al entrar con la contraseña o tu código", que lleva a `/access?next=/#fecha` y vuelve a la próxima fecha. El nombre y el link del mapa se sacan **en el servidor** (`src/app/page.tsx`): no están en el HTML ni en lo que reciben los componentes. La entrada y los mails son para quien ya compró y lo siguen mostrando.
  - **Las reglas** ("Cuidemos la casa"): sin acceso, el título y "Las reglas de la casa se ven al entrar con la contraseña o tu código", con el botón **Entrar** (`/access?next=/#reglas`).
  - **Preguntas frecuentes** entera (dice el lugar y cómo es la fiesta): sin acceso, `/access?next=/preguntas-frecuentes`.
  - La landing y Preguntas frecuentes son dinámicas (`force-dynamic`): dependen de la cookie de cada persona, así que nunca se sirve una copia guardada con el lugar a quien no tiene acceso. La landing espera a la base hasta 2,5 s para saber si hay acceso; si no responde, se ve como sin acceso (nunca al revés).
  - `/barra`, la imagen para compartir (`opengraph-image.png`, solo el logo) y la metadata no dicen el lugar. La descripción del evento sí se ve sin acceso: no escribir ahí el lugar.
- La cambian los owners desde `/admin/config`. Se le pasa a quien pide comprar por Instagram y se **rota** cada tanto: así alguien que la consiguió no puede volver a entrar ni pasársela a desconocidos indefinidamente.
- Se guarda y se compara sin espacios en los bordes (el autocompletar del celular a veces agrega uno). Una guardada antes con espacios también anda.
- Al entrar, se guarda una cookie (`hm_access`, 24 h) con la **huella** de la contraseña. Si la contraseña cambia, la huella ya no coincide y la cookie deja de valer (`hasGateAccess()` en `src/lib/auth/gate.ts`).
- Si en la base no hay contraseña cargada, se usa la variable `GATE_PASSWORD`.
- **5 intentos cada 15 minutos por IP** (§8c). El sexto, aunque sea la contraseña correcta, recibe 429 con "Hiciste muchos intentos seguidos...".
- **Modo local sin claves** (`src/lib/auth/local-mode.ts`): saltea esta contraseña y el login del admin **solo en la máquina de quien desarrolla**. Exige `npm run dev` (en producción `NODE_ENV` es `production`), `LOCAL_SIN_CLAVES=1`, que no sea Vercel (`VERCEL`) y que la base sea la de Docker (`127.0.0.1`/`localhost`). `npm run dev` escucha solo en `127.0.0.1`, así nadie de la misma red entra al admin. En la web publicada nunca aplica. Si el navegador tiene la sesión de un admin real (por ejemplo un usuario de barra, para probar ese rol), el admin usa esa en vez del owner local.

## 3b. Códigos de acceso

La venta es selectiva: quien quiere ir les escribe por Instagram y los owners deciden. Si le dicen que sí, le generan un **código de acceso para X entradas** (por ejemplo, para ella y sus amigas) y se lo pasan.

**Dos tipos** (`access_codes.kind`, `0029_access_code_kind.sql`):

| Tipo | Para qué | Entradas por compra | Total |
|---|---|---|---|
| **Personal** | Una persona y sus amigos ("Vicky: 4 entradas") | Las que le quedan al código | Obligatorio, 1 a 1000 |
| **Público** | Una historia de Instagram | **Una sola**, sin amigos | Opcional, 1 a 1000. Vacío = sin tope (`max_uses` en `NULL`): sirve hasta que se pause, venza o termine el evento |

- **Con un código público, cada persona saca como mucho una:** cada compra lleva una entrada y, como hay una por email y una por cédula por evento (§4.3), nadie saca dos. Si vienen amigos, cada uno hace su compra (cualquiera con el link puede comprar a nombre de otra persona: es el límite de un código público).
- **Se controla en el servidor, no solo en la pantalla:** la acción de compra rechaza más de una entrada con un código público y `create_order` también (`access_single#2`), aunque alguien fuerce el pedido. El tope opcional lo cuenta `create_order` como en los personales (`access_exhausted`); sin tope no cuenta.
- **Se crean** en Admin → evento → **Accesos** (solo owners): tipo, para quién (texto libre, "Sofi @sofi.mates y amigas" o "Historia 20/11"), cuántas entradas (en el público, el tope opcional) y vencimiento opcional. El código son 8 letras y números al azar sin caracteres que se confunden (`K7P2-QX9M`, `src/lib/access-codes.ts`). Se copia el código o el link `/acceso/<código>`, o se manda por WhatsApp (el del público aclara "una entrada por compra").
- **Se usa:** abriendo el link (`src/app/acceso/[codigo]/route.ts`) o escribiéndolo en `/access`, en la misma caja que la contraseña ("Contraseña o código"). Queda guardado en la cookie de acceso (`hm_access`, 24 h). Con la contraseña de compra prendida, el código da acceso a `/entradas` mientras le queden entradas.
- **Solo del evento a la venta:** un código sirve únicamente para el próximo evento publicado (el de `/entradas`). Uno de una fecha nueva en borrador, o de la siguiente, no abre la compra de la actual (`findAccessCode`).
- **Para dejar entrar no cuentan las reservas sin terminar** (`openLeft`): si el pago con Mercado Pago no salió, quien vuelve puede entrar y reintentar aunque su reserva siga viva. En `/entradas` puede comprar lo que le queda al código más lo que tiene reservado la compra sin terminar de ese navegador (cookie `hm_compra`), porque al reintentar se libera.
- **Quien entró solo con el código compra siempre con él:** `create_order` controla los usos, así no se compra de más sin la contraseña. Si todas sus entradas están reservadas en la compra de otra persona, `/entradas` dice "Tu código está en uso" en vez de mostrar el formulario.
- **En `/entradas`** aparece "Entraste con el código K7P2-QX9M. Te quedan N entradas", y el selector de cantidad no pasa de esas N (ni del máximo por compra). Con uno público dice "Con este código podés sacar 1 entrada: si vienen amigos, cada uno saca la suya" y no hay selector de cantidad.
- **Cada entrada comprada con el código gasta un uso** y queda marcada con él (`tickets.access_code_id`). Cuentan las vivas y las reservas vigentes (`access_code_uses`): una compra abandonada devuelve el uso cuando vence la reserva. La compra usa el código de la cookie, nunca uno que mande el formulario.
- **Todo o nada** (`create_order`, `0021_access_codes.sql`): bloquea la fila del código, así dos compras no se llevan el último uso. Si no alcanza: "Tu código de acceso alcanza para N entradas: bajá la cantidad". Si la misma persona reintenta, toda su compra anterior sin terminar se anula (también la de un amigo que sacó o cambió) y no gasta otro uso.
- **Deja de servir** si se pausa en el admin, si vence, si se usaron todas sus entradas o si terminó su evento. En `/access` se dice por qué (no existe o venció, ya se usó).
- **Para una historia de Instagram:** un código público, con tope o sin tope, y un vencimiento corto.
- **Estados en el admin:** Activo, Pausado (lo pausó un owner), Vencido o Agotado (un público sin tope nunca se agota). El vencimiento se pone en hora de Montevideo y no puede estar en el pasado.
- **Trazabilidad:** en Accesos, cada código muestra su tipo (Personal o Público), "X de N usadas" (o "X usadas · sin tope · 1 por compra") y se despliegan las entradas compradas con él (nombre, CI y estado). En la pestaña Entradas, cada entrada dice "Código K7P2-QX9M · para …" (solo lo ven los owners). El Historial registra crear (con el tipo y el tope), pausar y activar.
- **Límite de intentos:** 20 cada 15 minutos por IP para los códigos (un grupo de amigas en el mismo wifi entra con el mismo código; con 8 caracteres al azar no se pueden adivinar). La contraseña sigue en 5 cada 15 minutos.
- Si la contraseña de compra está apagada, cualquiera compra igual; el código (si entró con el link) solo marca las entradas y respeta sus usos.
- **Código y contraseña juntos** (`hasPasswordAccess`):
  - **Código personal:** mientras le queden entradas, la compra va con él aunque la persona tenga la contraseña (o esté apagada): marca las entradas y gasta usos. Con la contraseña, un código personal sin entradas no limita: se compra sin él, hasta el máximo por compra.
  - **Código público:** con la contraseña no se usa (la contraseña ya deja comprar para amigos): ni limita a una entrada ni gasta usos.
  - **Sin la contraseña:** siempre con el código.
  - **Límite conocido:** quien entró con un código público y después consigue la contraseña sigue de a una entrada mientras dure la cookie (24 h), porque `/access` no se muestra a quien ya tiene acceso.

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
| `cancelled` | Anulada por un admin, o compra abandonada. Si se cobró por transferencia, con el comprobante de la devolución (§5.4) | No |
| `refunded` | Anulada con devolución por Mercado Pago | No |

### 4.2 Origen (`source`)

| Origen | Cómo se crea | Monto | ¿Descuenta stock de la tanda? |
|---|---|---|---|
| `purchase` | Compra web, con Mercado Pago o transferencia (`payment_method`) | Precio de la tanda − descuento; + cargo por servicio solo con Mercado Pago | Sí (reserva al empezar, confirma al pagar o al validar) |
| `manual` | Un admin la carga: se cobró por transferencia | Lo que se cobró | Sí |
| `invitation` | Un admin la carga eligiendo **"Cortesía (gratis)"** en Tipo: el monto queda en $0 fijo | 0 | No (no tiene tanda), pero cuenta para la capacidad del evento |

Las tres generan el **mismo tipo de QR** y pasan por el **mismo scanner**. En la web, el admin, la puerta y los mails, las `invitation` se muestran como **Cortesía**.

### 4.3 Reglas

1. **Una entrada por email y una por cédula, por evento.** Solo cuentan las entradas vivas (`pending`, `review`, `paid`, `used`): si una se anuló, la persona puede volver a tener otra.
   - El email se compara normalizado: en Gmail, `Juan.Perez+fiesta@gmail.com` = `juanperez@gmail.com` (`normalizeEmail`).
   - La cédula se guarda solo con dígitos y 8 cifras: `1.234.567-2` = `12345672` (`normalizeDocument`). Se valida el dígito verificador uruguayo.
2. **Datos obligatorios:** nombre, cédula y email. En la compra web, también el **Instagram de cada persona** (quien compra y cada amigo), para que los owners miren el perfil y puedan anular si es sospechoso. Celular (solo quien compra), opcional. En las entradas que carga un admin, el Instagram sigue opcional.
   - El Instagram se acepta como `@usuario`, `usuario` o el link del perfil, y se valida en el formulario y en el servidor (`instagramRequiredSchema` en `src/lib/validation/schemas.ts`, `src/lib/validation/instagram.ts`): letras, números, puntos y guiones bajos, hasta 30. Se guarda como siempre en `tickets.buyer_instagram`, sin @ y en minúsculas, y se muestra `@usuario`. Sin él, la compra no sale y el aviso aparece en el campo de esa entrada ("Falta el usuario de Instagram.").
3. **Stock por tanda.** Disponibles = total − vendidas − reservas web en curso (`tier_available`).
   - **Capacidad del evento** (`events.capacity`, migración `0018`): además del cupo de cada tanda, no se vende por encima de la capacidad. Libres = capacidad − entradas vivas, invitaciones incluidas (`event_available`). `create_ticket` lo controla bloqueando la fila del evento; la landing y `/entradas` muestran cada tanda como agotada si el evento está lleno. Las invitaciones no se frenan, pero cuentan.
4. **"Agotado manual"** (`sold_out_override` en la tanda): corta la venta web aunque quede stock.
5. **Excepciones de los owners** (`0026_manual_ticket_override.sql`): una entrada cargada a mano en el admin puede ser de una tanda agotada (por cupo o a mano) y pasar la capacidad del evento; el formulario avisa "Tanda agotada: se carga igual, como excepción". Los cupos y la capacidad los respeta solo la compra web.
6. **Una cortesía (invitación) no tiene tanda** ni descuenta stock de la tanda.

Todo esto lo hace la función `create_ticket` en Postgres (`supabase/migrations/0006_ticketing.sql`; la última versión, con preventa, tandas próximas y capacidad del evento, está en `0018_event_capacity.sql`). Bloquea la tanda mientras crea la entrada, así dos compras por el último lugar nunca salen las dos.

### 4.4 El QR

- La persona puede **guardar la entrada** desde su página:
  - **"Guardar imagen"** descarga un PNG formato historia (`/ticket/<token>/imagen`, solo si está válida). Es la misma entrada de la página: fondo doodle (`public/brand/ticket-bg.jpg`, el de `DoodleBackdrop` ya desenfocado), la letra de la web (Neue Montreal si `NEXT_PUBLIC_FONTS_URL` tiene sus `.otf`; si no, General Sans de Fontshare), punto violeta, día, hora y formato, "Ingreso hasta" en la tanda temprana y el bus con el texto completo de salida. Si ese texto es largo, el QR se achica para que entre todo.
  - Límite conocido: en Windows la imagen no se puede generar (falla la librería de Next que la dibuja, también en el build de producción). En Vercel (Linux) funciona.
  - **"Guardar PDF"** abre la impresión del navegador; la versión impresa sale en blanco y negro.

- Cada entrada tiene un `qr_token`: 22 caracteres aleatorios. No contiene datos ni firma; solo vale si existe en la base. Adivinarlo es imposible en la práctica.
- El QR codifica la URL `https://<sitio>/ticket/<token>`. Si alguien lo escanea con la cámara del celular, abre su entrada. El scanner de puerta extrae el token de esa URL.
- La entrada muestra la cédula **parcial** ("CI •••• 298-0", `maskDocument` en `src/lib/tickets.ts`): la página `/ticket/<token>`, la imagen que se guarda y los mails de la entrada, del comprobante recibido, de anulación y de rechazo. Cualquiera con el link de la entrada la ve. La **completa** aparece solo al escanear, en el escáner de la puerta, para cotejarla con el documento (y en las pantallas del admin). Decisión de la reunión de socios del 05/11 (vuelve atrás la cédula completa en la entrada, ADR #040).
- Mientras la entrada está válida (o pendiente de pago), la página se refresca sola cada 5 segundos. Cuando el portero confirma el ingreso, el celular de la persona pasa a "Usada" sin recargar.

---

## 5. Flujos

### 5.1 Entrada manual (venta por transferencia) o invitación

1. Admin → evento → **Entradas** → "Nueva entrada".
2. Completa los datos; elige la tanda y el monto cobrado, o "Cortesía (gratis)".
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
- **Reintentar libera la compra anterior:** al empezar una compra se anula entera la compra anterior sin terminar (`pending`) de la misma persona en ese evento: la que tiene como entrada 1 el mismo email o la misma cédula (`create_order`, `0021`). Así el amigo que sacó o cambió no le sigue ocupando lugar, usos de códigos o de descuentos ni el bus. Una transferencia en revisión no se toca.
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
   - **Qué muestra:** todas las transferencias en `review` de todos los eventos, la más vieja primero, con filtro por evento si hay de más de uno. Cada tarjeta trae nombre, CI, email, celular (si lo dejó) e Instagram con link al perfil (también el de cada amigo), evento y tanda, cuándo mandó el comprobante (hora de Montevideo) y el desglose: entrada, descuento con su código, transporte y **total a transferir**.
   - **Ver comprobante:** una foto se abre a pantalla completa con el total esperado arriba, para compararlo. "Ampliar" (o tocar la imagen) la agranda y "Abrir en pestaña" la abre sola. Un PDF se abre en una pestaña nueva. El link es `/admin/confirmar/comprobante/<id>`: el servidor chequea que sea owner y redirige a un link firmado del bucket que vence a los 60 segundos, así nunca queda un link vencido en la página.
   - **Aceptar** (`approve_transfer`): pasa a `paid`, suma a la tanda y le llega el mail con la entrada y el QR.
   - **Declinar** (pide confirmar; `reject_transfer`): pasa a `cancelled` con `reviewed_at`, se liberan el lugar de la tanda y el del bus, y le llega el mail "No pudimos validar tu transferencia". El mail nombra los tres motivos posibles (monto distinto, comprobante que no se lee, transferencia que no aparece), igual que Preguntas frecuentes, y dice que si la plata llegó se le devuelve; que escriba por Instagram.
   - Las dos quedan en `admin_logs` (`approve_transfer` / `reject_transfer`, a nombre del owner) y la tarjeta sale de la lista. El aviso del resultado viaja en la URL (`?hecho=…&entrada=…`), así sobrevive a recargar la página. Si el mail no salió, el aviso lo dice.
   - **Doble toque o dos owners a la vez:** el botón manda un solo pedido, y la base resuelve una sola vez (la función bloquea la entrada y exige que siga en `review`). Al segundo le aparece "ya estaba resuelta" y no sale otro mail.
   - Si no tiene comprobante dice "Sin comprobante" y solo se puede declinar. Una entrada en revisión no se anula: se acepta o se declina.
   - Lo mismo sigue en Admin → evento → **Entradas**, arriba de todo ("Transferencias a validar", con Aprobar y Rechazar), con la misma lógica (`src/lib/transfers.ts`).
6. Mientras está en revisión, `/compra/resultado?transferencia=<id>` y `/ticket/<token>` muestran "Validando tu transferencia".
7. **Si la compra no sale después de transferir** (tanda o bus agotados, código sin usos, cédula o email repetidos, límite de intentos, precio que cambió, comprobante que no se pudo subir): la persona transfiere antes de enviar el formulario, así que a esos errores se les suma "Si ya transferiste, escribinos por Instagram con el comprobante y lo resolvemos". Si falla la subida del comprobante, se le aclara que no hace falta transferir otra vez.

Una transferencia aprobada no se reembolsa desde la web: se anula y la plata se devuelve por fuera, igual que una entrada manual. Para anularla hay que subir el comprobante de la devolución (§5.4).

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

### 5.2e Comprar para amigos (varias entradas en una compra)

Quien compra puede sumar entradas para sus amigos y pagar todo junto. Cada entrada sigue siendo **nominativa**: una por persona, con su nombre, cédula y email.

- **Cuántas:** de 1 hasta el tope de `/admin/config` → "Máximo de entradas por compra" (`site_config.max_tickets_per_order`, arranca en 6, máximo 10). Si entró con un código de acceso (§3b), además hasta las entradas que le quedan al código; con uno público, una sola (sin amigos).
- **Fichas:** "Entrada 1" (la de quien compra), "Entrada 2", "Entrada 3"…
- **La entrada 1 es siempre la de quien compra** (con celular opcional y su cuenta, si tiene). Las demás piden nombre, cédula, email e Instagram de cada amigo, obligatorios (§4.3). En una misma compra no se pueden repetir emails ni cédulas, y valen las reglas de siempre: una entrada por email y una por cédula por evento (§4.3).
- **Misma tanda para todas.** El código de descuento se aplica a cada entrada y cada una gasta un uso: si no alcanzan los usos, se avisa cuántas entradas cubre.
- **Transporte por persona:** cada uno elige su bus o ninguno.
- **Precio:** cada entrada guarda lo que paga ella (`amount_paid_uyu`: entrada con descuento + su bus + su parte del cargo por servicio con Mercado Pago). El total de la compra es la suma.
- **Todo o nada** (`create_order`, `0020_group_purchase.sql`): las entradas se crean en una sola transacción. Si una falla (cédula o email que ya tienen entrada, sin lugar en la tanda o en el evento, bus lleno, código sin usos), no queda ninguna, y el error dice de qué entrada es ("Entrada 3: …").
- **El grupo:** `tickets.order_id` apunta a la entrada de quien compró (que se apunta a sí misma). Las entradas de antes y las manuales no tienen grupo y se tratan como un grupo de una.
- **Pago:**
  - Mercado Pago: un solo pago para todo el grupo, con el desglose (N entradas, bus por opción, cargo). `external_reference` es la entrada de quien compró. `confirm_order_payment` confirma todas juntas, con las mismas reglas de pagos tarde, repetidos y monto de §5.2 (si a alguna persona no se le puede confirmar porque ya tiene otra entrada, devuelve `partial_duplicate` y se avisa a los owners para devolver esa parte). `extend_order_hold` y `reverse_order_payment` hacen lo mismo que en §5.2 para todo el grupo.
  - Transferencia: un comprobante para toda la compra (queda en cada entrada del grupo). En **Entradas a confirmar** se acepta o se declina la compra entera (`src/lib/transfers.ts`).
  - Un pago de Mercado Pago ahora paga varias entradas, así que `tickets.mp_payment_id` ya no es único.
- **Mails:** a cada persona le llega **su** entrada a **su** mail, con "X te compró tu entrada" y sin el monto pagado. "Recibimos tu comprobante" y "No pudimos validar tu transferencia" le llegan solo a quien compró, con la lista de entradas y el total. El aviso a los owners lista las entradas de la compra.
- **Reembolsar una entrada de una compra con Mercado Pago** devuelve solo su parte (`refundPayment(pago, monto)`), no el pago entero.
- **Mi cuenta:** quien compró ve su entrada y "También compraste para: Nombre (email), …", sin los QR ni links: a cada uno le llega la suya. Las entradas de sus amigos no aparecen en su cuenta; un amigo con cuenta propia y email confirmado ve la suya como siempre.
- **`/compra/resultado`:** pagada → "Listo, X. Ya tenés tu entrada." + "Las otras N entradas les llegan a cada uno a su mail."; en revisión → "Cuando lo validemos, a cada uno le llega su entrada con el QR a su mail".
- **Admin:**
  - **Entradas a confirmar** y la sección "Transferencias a validar" de la pestaña Entradas muestran una tarjeta por compra: quien compró, la lista de entradas (nombre, CI, email, Instagram con link al perfil y bus de cada una), el desglose y el total a transferir (suma de `amount_paid_uyu`). Un solo comprobante; "Aceptar las N" / "Declinar" resuelven toda la compra. Al declinar, el mail le llega solo a quien compró.
  - En la lista de Entradas, cada entrada de una compra de varias dice "Compra de N · la hizo X". El Instagram de cada persona va con link a su perfil (se abre en otra pestaña).
  - **Reembolsar una entrada** pagada con Mercado Pago: si otras entradas del mismo pago siguen válidas, devuelve solo lo que pagó esa (`refund_amount` en `admin_logs`); la última devuelve lo que quede. "Ya figura devuelto en MP" vale solo si se devolvió el pago entero. Si es la entrada de un amigo, el mail de anulación aclara que la plata vuelve al medio de quien pagó la compra.
  - "Máximo de entradas por compra" en `/admin/config`: entero de 1 a 10, solo owners, con antes/después en el Historial.
- **Pendiente (bloque de acceso):** cuando se defina quién puede comprar, cada amigo de la compra también va a tener que estar habilitado.

### 5.3 Puerta

Pantalla aparte (`/admin/scan/<id>`, botón "Puerta" del evento):
- Ocupa todo el celular, sin el menú del admin.
- En la compu solo muestra "Usalo desde el celular".

**Cada persona pasa en dos pasos.** El QR prueba que la entrada existe; la cédula prueba que es de esa persona.

1. **Escanear** el QR, o escribir la cédula en "Sin QR". El escaneo **solo consulta: no cambia nada**.
   - **Azul "Entrada válida"** con nombre, cédula y tanda (o "Cortesía"). Queda fijo hasta que el portero decide. En celulares chicos el centro se puede deslizar y los botones de confirmar y cancelar siempre quedan a la vista.
   - **Un QR de barra** escaneado en la puerta dice "Es un QR de barra" (no "QR inválido") y no queda registrado como inválido.
   - **Puerta cerrada desde otro celular:** cada escaneo actualiza el estado ("Puerta cerrada" / "Puerta abierta") en el celular que escanea, sin recargar.
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
- **Plan B si falla el escáner o internet:** en **Ventas**, "Descargar lista (CSV)" o "Imprimir lista". Trae las entradas válidas y ya usadas, por orden alfabético del nombre (como lo escribió la persona), con cédula completa, tanda o "Cortesía" y hora de ingreso. Conviene bajarla o imprimirla antes de abrir: lo que se tilde a mano no queda registrado en la base.

Código: `src/app/admin/scan/[id]/` · Lista: `src/app/admin/(panel)/events/[id]/lista/` · SQL: migraciones `0006`, `0007` y `0014` (última versión de `inspect_ticket` y `check_in_ticket`).

### 5.4 Anular y reembolsar

- En **Entradas**, solo las entradas válidas (`paid`) tienen "Anular" (manual/invitación/transferencia) o "Reembolsar" (compra con Mercado Pago). Las `pending` no: vencen solas.
- **Reembolsar** devuelve el total por MP y recién después anula (`refunded`). En una compra de varias entradas devuelve solo la parte de esa entrada (§5.2e). Antes consulta el pago en MP: si ya figura devuelto (lo devolvieron desde el panel de MP), no lo devuelve de nuevo y solo deja la entrada reembolsada. Si MP rechaza la devolución, no se anula nada.
- **Anular** una manual o una compra por transferencia no devuelve plata: la transferencia se devuelve por fuera.
- **Comprobante de devolución** (`0030_refund_receipts.sql`): una entrada válida que se cobró por transferencia (compra web por transferencia ya aprobada, o entrada manual) y costó más de $0 **no se anula sin subir el comprobante de que se devolvió la plata**.
  - "Anular" abre un diálogo: "¿Anular la entrada de X?", el archivo y "Sí, anular". Foto JPG, PNG o WebP, o PDF, hasta 4 MB. El tipo se controla por los primeros bytes del archivo, no por lo que dice el navegador. "Anular" del menú de la fila abre el mismo diálogo.
  - Lo exige el servidor, no solo la pantalla: sin archivo, `cancelTicketAction` responde "Subí el comprobante de la devolución para anularla", y `cancel_ticket` devuelve `refund_receipt_required` sin tocar nada si no le llega la ruta.
  - Se sube al bucket privado `comprobantes` como `devoluciones/<entrada>/<8 hex>.<ext>` (`uploadRefundReceipt` en `src/lib/receipts.ts`) y la ruta queda en `tickets.refund_receipt_path` en el mismo UPDATE que anula. Si al final no se anula (se usó mientras tanto, por ejemplo), el archivo se borra.
  - **Compra de varias:** se anula una entrada por vez, como siempre; cada una lleva su comprobante. Las demás de la compra siguen válidas.
  - La entrada anulada muestra **"Ver comprobante de devolución"** (también en el menú de la fila), solo para owners: `/admin/events/<evento>/tickets/<entrada>/devolucion` chequea que sea owner y redirige a un link firmado de 60 segundos, igual que el comprobante de la transferencia.
  - El Historial lo anota: "Anuló la entrada: X" con "Comprobante de devolución: PDF" (o JPG, PNG, WebP).
  - Siguen igual: Mercado Pago (se devuelve por MP con "Reembolsar"), las transferencias en revisión (se aceptan o se declinan) y las cortesías o entradas de $0 (no hay nada que devolver).
  - El mail de anulación no cambia: para una transferencia no habla de la devolución.
- Solo si `cancel_ticket` devuelve `cancelled` se registra en `admin_logs` y sale el mail "Tu entrada fue anulada". Si se usó mientras tanto, ya estaba anulada o falla la base, la página lo dice y no se manda nada.
- Anular devuelve el lugar al stock de la tanda. Una entrada ya usada no se puede anular.

### 5.5 Acceso de admins

- Un admin necesita: un usuario en Supabase (Authentication → Users) **y** una fila activa en la tabla `admins` con `role` `owner` o `staff`.
- Para darle acceso (o resetear su contraseña) sin depender del mail: se genera un link de un solo uso (`auth.admin.generateLink`) hacia `/auth/confirm`. La persona toca **Continuar** y elige su contraseña en `/admin/account`. El botón existe para que la vista previa de WhatsApp no gaste el link.
- Si tiene usuario pero no fila en `admins`, el login le avisa "no está habilitado como admin".
- **Si el email ya tenía usuario** (por ejemplo, alguien creó una cuenta de comprador con ese email): antes de darle acceso, borrar sus sesiones y cambiarle la contraseña (`docs/EXTERNAL_SERVICES.md`). Además, abrir el link del mail le pone una contraseña al azar y cierra las otras sesiones (§8c).
- Cambiar la contraseña en `/admin/account` cierra las otras sesiones de esa persona.

**Usuario de barra** (rol `barra`, migración `0031_bar_access.sql`, ADR #037): para los barmans, solo escáner.
- **Alta:** un owner lo crea en Admin → Administradores → **Nuevo usuario de barra** con nombre, email y contraseña (mínimo 8), y se la pasa a los barmans. Se crea el usuario de Auth ya confirmado y la fila en `admins` con rol `barra`; queda en el Historial ("Creó el usuario de barra", con email y nombre).
  - El email no puede tener ya un usuario: compradores y admins comparten Auth, y reusarlo dejaría entrar a quien creó esa cuenta. Para cambiarle la contraseña o desactivarlo: desde Supabase, como con los demás admins (`docs/EXTERNAL_SERVICES.md`).
- **Entra por `housemates.uy/scan`:** sin sesión va al login del admin (`/admin/login?next=/scan`) y vuelve a `/scan`. Ahí ve solo el escáner de barra de la fiesta que corresponde: la publicada en curso (o terminada hace menos de 6 h, para terminar de entregar) o, si no hay, la próxima (`getScanEvent`). El ícono de arriba a la izquierda cierra la sesión, con confirmación.
- **No puede usar nada más del admin.** Está centralizado en `src/lib/auth/admin.ts`:
  - `getAdminUser`, `requireAdmin` y `requireOwner` lo rechazan siempre. Lo usan todas las páginas, acciones y rutas del admin y la puerta, así que una pantalla nueva queda cerrada sin hacer nada.
  - Si abre una página del admin (o el login lo manda a `/admin`), va a `/scan`. Una ruta (CSV, comprobante) también redirige, sin datos. Una acción de otra pantalla responde como sesión vencida y no hace nada.
  - Solo el escáner de barra (`requireBarScanner`) y `/scan` (`getScanUser`) lo dejan pasar, y solo con la fiesta de `getScanEvent`: otro evento responde "Sesión vencida".
- **Owners y staff** también pueden abrir `/scan`: ven links a la Puerta y a la Barra de esa fiesta.
- Lo que entrega queda a su nombre, como con cualquier admin (`delivered_by_admin_id`, `bar_scans`).

### 5.6 Cuentas de compradores

Opcionales: se puede comprar sin cuenta, como siempre. Código: `src/lib/customers.ts` · migración `0011_customer_accounts.sql`.

- **Prender o apagar** (`/admin/config` → Mi cuenta, solo owners; `site_config.accounts_enabled`, `isAccountsEnabled`):
  - **Apagada** (el valor de siempre si la fila no está o la base no responde): la web no muestra nada de cuentas. No aparece "Creá una contraseña" al comprar ni "Ingresar" o "Mi cuenta" en la compra y la portada. Tampoco el recuadro de la barra, el aviso del resultado de la compra, la sección Cuenta de Preguntas frecuentes ni las menciones en privacidad y términos.
  - **Apagada, del lado del servidor:** no se crean cuentas (la contraseña se ignora), `getCustomer` no devuelve sesión, `/cuenta/*` lleva al inicio y las acciones de ingresar y recuperar no hacen nada.
  - **Prendida:** vuelve todo como se describe abajo.
  - El cambio es al instante para todo el sitio y queda en el Historial ("Mi cuenta para el público").

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

- **La carta es por evento.** Los owners la cargan en Admin → evento → **Barra**: nombre, precio, descripción opcional y foto opcional. Se ordena con ↑ ↓ (es el orden de `/barra`) y cada trago se activa o desactiva. Uno desactivado no aparece en `/barra`. No se borran.
- **Foto de cada trago** (`0028_bar_product_images.sql`): se elige al cargar el trago o en **Editar** (Cambiar foto / Sacar la foto). El navegador la achica (lado más largo 1400 px, WebP o JPG) y el servidor la sube con la service key al bucket público `bar`, después de controlar por los primeros bytes que sea JPG, PNG o WebP de hasta 4 MB. En `/barra` se ve cuadrada, recortada al centro, al lado del nombre; si ningún trago tiene foto, la carta va sin fotos, y si solo algunos tienen, los demás muestran un vaso dibujado. La foto vieja se borra del bucket cuando ya no la usa ningún trago (al duplicar un evento la carta nueva usa los mismos archivos). En el Historial queda como "Foto: Nueva" o "Foto: Sacada".
- **El precio de la carta es el final, igual que en la barra de la fiesta:** la barra no tiene cargo por servicio y la comisión de Mercado Pago la absorbe la fiesta. Lo que cobra Mercado Pago es la suma de los precios de la carta (`createBarPreference` manda el precio de cada trago tal cual). El total lo calcula la base con los precios vigentes al comprar (`create_bar_order`): la app nunca manda un precio. Cada trago comprado guarda nombre y precio del momento, así que editar la carta no cambia los pedidos hechos.
- **Cuándo se vende:** para el próximo evento (el mismo de la landing, `getNextEvent()`), mientras esté publicado y no haya terminado, antes o durante la fiesta. No depende de "ventas activas" de las entradas ni de la contraseña del gate.
- **Solo con el QR de la fiesta o el link de las historias** (`0031_bar_access.sql`, `src/lib/bar-access.ts`, ADR #036). Escribir `/barra` a mano no alcanza:
  - **La clave:** cada evento tiene una al azar (`events.bar_key`, 16 caracteres). El link es `/barra/k/<clave>` y es lo que codifica el QR. Al duplicar un evento, la copia recibe otra.
  - **La cookie:** el link deja la cookie `hm_barra` (httpOnly, 24 h, como una historia) con la clave de ese evento y manda a `/barra`.
  - **Sin la cookie del próximo evento,** `/barra` no muestra la carta: dice "La barra se abre con el QR de la fiesta o con el link de nuestras historias de Instagram", con el botón de Instagram. Las acciones que arman el pedido (`startBarCheckoutAction` y la de simular) vuelven a controlarlo: llamadas directo, devuelven ese mismo aviso y no crean nada.
  - **Quien ya compró** no necesita la cookie: `/barra/pedido/<token>` y `/barra/qr/<token>` andan con su token.
  - **En el admin** (Admin → evento → Barra → "Link y QR de la barra"): el link para copiar, el QR para descargar (PNG) o imprimir (cartel A4) y, para owners, **"Cambiar link"** (con confirmación). Cambiarlo pone otra clave: el link y el QR viejos dejan de abrir la barra, también para quien ya había entrado. Queda en el Historial ("Cambió el link de la barra").
  - **No se saltea en modo local**, así se puede probar.
  - Límite conocido: la cookie es de ese navegador. Si alguien abre el link en el navegador de Instagram y después pasa a Safari, ahí no tiene la cookie: vuelve a abrir el link o escanea el QR de la fiesta.
- **Pausar venta** (owners, Admin → Barra): nadie puede comprar; los QRs ya pagos se siguen entregando. Arranca prendida (`events.bar_paused = false`).
- **Solo Mercado Pago, con tarjeta y al instante** (`binary_mode`, sin Abitab ni Redpagos): un cupón de efectivo se pagaría al día siguiente, con la fiesta terminada. Hasta 20 de cada trago y 30 tragos por pedido.
- **Pagos que no sirven** (`confirm_bar_order_payment`, `0027_bar_payment_checks.sql`): si el pedido ya estaba pago con otro pago (dos pestañas), o si el pago llega con la fiesta terminada, el pedido no cambia y les llega a los owners "Pago de barra para revisar" para devolverlo. Lo mismo con un monto menor al total.
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

**En la barra** (`/admin/barra/<id>`, botón "Abrir escáner de barra"). Lo usan owners y staff, y los barmans con su usuario de barra desde `/scan` (§5.5):

1. **Escanear** el QR: muestra qué trago es (y a nombre de quién). No cambia nada.
2. **"Entregar"**: `deliver_bar_unit` lo marca entregado con un solo `UPDATE … WHERE delivered_at IS NULL`. Si dos barmans entregan el mismo QR a la vez, al segundo le aparece "Ya entregado a las HH:MM".

- Rechazos en rojo, hasta tocar "Cerrar": ya entregado, QR inválido, de otro evento, pedido sin pagar, y "Es una entrada" si escanean el QR de una entrada.
- **Sin QR:** el email muestra los tragos para retirar de esa persona en ese evento, con "Entregar" en cada uno. También acepta el código del QR pegado a mano. Un trago sale de la lista solo si quedó entregado (ahora, o justo antes por otro barman); cualquier otro resultado (pedido anulado, sesión vencida) se muestra en rojo como en el escaneo.
- **Sin conexión:** igual que en la puerta (§5.3): aviso neutro "Sin conexión. Probá de nuevo." con Reintentar, nunca "QR inválido". Si falla al entregar, el trago sigue en pantalla (o en la lista) para reintentar. Mismos botones de cámara y misma recarga tras un deploy nuevo.
- Arriba, el contador de tragos entregados / vendidos.
- Todo queda registrado: cada trago guarda `delivered_at` y `delivered_by_admin_id`, y cada escaneo (entregas y rechazos) queda en `bar_scans`.

### 5.8 Transporte

Bus opcional que se suma al comprar la entrada (la fiesta es fuera de Montevideo). Código: `src/lib/transport.ts`, `src/app/admin/(panel)/events/[id]/transporte/` · migración `0015_transport.sql`.

- **Opciones por evento**, en Admin → evento → **Transporte** (solo owners): nombre ("Ida", "Vuelta", "Ida y vuelta"), punto y horario de salida (texto libre), precio y cupo opcional. Se activan o desactivan. Eliminar está en el menú de la fila (⋯ o clic derecho): una opción que alguien eligió no se borra, se desactiva.
- **En `/entradas`**, antes de "¿Cómo querés pagar?": "¿Necesitás transporte?" con "No, gracias" (por defecto) y las opciones activas con precio, horario y "Quedan N" si tienen cupo ("Sin lugares" si se llenó). Va antes del pago para que el total a transferir ya incluya el bus. Sin opciones activas, no aparece.
- **Precio:** se suma al total. El código de descuento aplica solo a la entrada. Con Mercado Pago el cargo del 7,5 % va sobre todo lo que se cobra (entrada con descuento + bus); con transferencia no hay cargo. Ej.: $1.600 + bus $400 → Mercado Pago $2.150 (cargo $150); transferencia $2.000.
- **Registro:** `amount_paid_uyu` guarda el total cobrado (entrada + bus + cargo), así cierra con lo que confirma Mercado Pago. El bus va en `ticket_transport` (una fila por entrada) con el precio del momento: cambiar el precio de la opción no toca a quien ya compró. En Mercado Pago es una línea más de la preferencia ("Transporte · …"). Reembolsar devuelve el total, bus incluido.
- **Cupo:** cuenta solo entradas vivas (`pending` sin vencer, `review`, `paid`, `used`). Si la entrada se anula, se rechaza la transferencia o vence la reserva de Mercado Pago, el lugar se libera solo.
  - Justo después de `create_ticket`, `reserve_transport` bloquea la opción (como la tanda) y reserva el lugar. Si no hay, borra en la misma transacción la entrada recién creada (todavía sin pago ni comprobante): la persona ve "No quedan lugares en el bus…" y no se crea ni se cobra nada.
  - Igual que con la tanda, un pago de Mercado Pago aprobado después de vencida la reserva se honra, y puede pasar el cupo por 1.
- **Dónde se ve:** la entrada (`/ticket/<token>`), los mails "Recibimos tu comprobante", "Entrada confirmada" y el aviso a los owners (línea "Transporte" en el desglose, más el punto y horario), Mis entradas y Admin → Entradas ("Bus: …"). Siempre es el mismo texto que se ve al elegir el bus, completo y sacado de la opción, así que si se edita en el admin cambia en todos lados (en los mails, desde el próximo que se mande).
- **Lista para el chofer:** Admin → Transporte muestra los pasajeros de cada opción (nombre, cédula, celular, estado). "Descargar CSV" (`;`, UTF-8 con BOM) e "Imprimir" (una hoja por opción, con casilla para tildar) llevan solo entradas válidas (pagas o usadas): una transferencia sin validar no figura. En una compra para amigos solo quien compra deja celular: a los amigos se les pone el suyo, aclarado ("099 123 456 (de Sofía)").
- **Fuera de alcance:** las entradas manuales e invitaciones no llevan bus; si hace falta, se arregla por fuera.

---

## 6. Dónde vive cada regla

| Regla | Dónde |
|---|---|
| Stock, una por persona, reservas | `create_ticket` — `supabase/migrations/0006_ticketing.sql` (última versión en `0014_tier_features.sql`) |
| Preventa (código) y tandas que todavía no salieron | `create_ticket` (`0014`): `presale_required`, `tier_not_started` |
| Ingreso temprano en puerta (aviso, `late_entry`) | `entry_deadline`, `inspect_ticket`, `check_in_ticket` (`0014`) |
| A quién le llega el mail de preventa | `presale_audience` + `presale_sends` (`0014`) · `src/lib/mail/presale-mails.ts` |
| Comprar varias entradas (todo o nada, una por persona) | `create_order` — `0020_group_purchase.sql` (última versión, con código de acceso, en `0021`) · `createOrder` en `src/lib/tickets.ts` · `startCheckoutAction` |
| Eliminar desde el admin (qué se puede y qué no) | `event_delete_blocker`, `admin_delete_event`, `admin_delete_bar_product`, `admin_delete_discount_code` — `supabase/migrations/0025_admin_delete.sql` · menú: `src/components/admin/context-menu.tsx` |
| Duplicar un evento (qué se copia y qué no) | `duplicate_event` — `supabase/migrations/0023_duplicate_event.sql` · `src/app/admin/(panel)/events/[id]/duplicar/` |
| Textos de la landing e Instagram | `src/lib/landing.ts` · `getLandingContent` en `src/lib/site.ts` · `src/app/admin/(panel)/landing/` |
| Códigos de acceso (usos, vencimiento, cookie) | `access_codes`, `access_code_uses` (`0021`) · `src/lib/access-codes.ts` · `getSessionAccessCode` / `hasGateAccess` en `src/lib/auth/gate.ts` · `/api/gate`, `/acceso/<código>` |
| Confirmar pago (idempotente, controla el monto, pagos tarde o repetidos, todo el grupo) | `confirm_order_payment` (`0020`; misma lógica que `confirm_ticket_payment` de `0017`) · `syncPayment` en `src/lib/mercadopago.ts` |
| Reserva que espera un pago pendiente; devolución o contracargo desde MP | `extend_order_hold` / `reverse_order_payment` (`0020`) |
| Capacidad del evento | `event_available` y `create_ticket` (`0018_event_capacity.sql`) · `src/lib/next-event.ts` |
| No repetir encuesta ni preventa | `0019_comms_dedupe.sql` (`email_log.send_key` + `sending`) · `src/lib/mail/event-mails.ts`, `src/lib/mail/presale-mails.ts` |
| Anular / devolver stock | `cancel_ticket` — misma migración (última versión, que exige el comprobante de devolución, en `0030_refund_receipts.sql`) |
| Comprobante de devolución al anular una transferencia | `needsRefundReceipt`, `uploadRefundReceipt` en `src/lib/receipts.ts` · `cancel_ticket` (`0030`) · `src/app/admin/(panel)/events/[id]/tickets/` |
| Puerta: consultar sin cambiar / confirmar / cancelar | `inspect_ticket`, `reject_check_in` (`0007_door_two_step.sql`) y `check_in_ticket` (última versión en `0014`) |
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
| Barra: foto de cada trago (bucket `bar`, copia al duplicar) | `bar_products.image_path` y `duplicate_event` (`0028_bar_product_images.sql`) · `saveBarProductAction` en `src/app/admin/(panel)/events/[id]/barra/actions.ts` |
| Barra solo con el link o el QR (clave, cookie, cambiar link) | `events.bar_key`, `new_bar_key()` y `duplicate_event` (`0031_bar_access.sql`) · `src/lib/bar-access.ts` · `src/app/barra/k/[key]/route.ts` · `rotateBarKeyAction` y `bar-link.tsx` en `src/app/admin/(panel)/events/[id]/barra/` |
| Usuario de barra: solo `/scan` y el escáner de barra | `getAdminUser`, `requireBarScanner`, `getScanEvent` en `src/lib/auth/admin.ts` · `src/app/scan/page.tsx` · `createBarUserAction` en `src/app/admin/(panel)/admins/actions.ts` |
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
- **Base de compradores para mailing** (`/admin/compradores`, ADR #038, `src/app/admin/(panel)/compradores/buyers.ts`). Una pantalla y un CSV para los mails de futuras fiestas; desde el admin no se manda nada. Se arma en el momento leyendo las entradas: no se guarda en otra tabla ni carga nada en la whitelist (CLAUDE.md §7.1).
  - **Quiénes:** un email por persona (se agrupa por el email normalizado) con al menos una entrada `paid` o `used` de cualquier evento, cortesías incluidas. Las anuladas (también compras abandonadas y transferencias rechazadas) y las reembolsadas no cuentan: quien solo tiene esas no aparece.
  - **Por persona:** el email y el nombre de su última entrada cargada (el email como lo escribió, que es adonde manda la preventa), la última fiesta (título y fecha), en cuántas fiestas tuvo entrada (la próxima incluida) y si pidió la baja. Ordenada por última fiesta, la más nueva primero.
  - **Bajas:** el mismo criterio que la preventa (email normalizado en `whitelist` con status `banned`). Se ven en la lista con "Baja" y la pantalla dice cuántas son, pero **quedan afuera del CSV**.
  - **Buscador:** por nombre o email, sin importar tildes ni mayúsculas. Se muestran hasta 300 filas; el CSV trae a todos.
  - **CSV** (`/admin/compradores/csv`, `compradores-AAAA-MM-DD.csv`): columnas `email`, `nombre`, `ultima_fiesta` ("Título (dd/mm/aaaa)") y `fiestas`; separado por `;` y UTF-8 con BOM, como la lista de la puerta, para que Excel lo abra con las tildes bien. Un valor que empieza con `=`, `+`, `-` o `@` va con un apóstrofo adelante, para que Excel no lo tome como fórmula.
  - **Quién:** solo owners, en la pantalla y en la ruta del CSV (el staff va al inicio o recibe 403; el usuario de barra, a `/scan`). Cada descarga queda en el Historial ("Descargó la base de compradores (CSV)", con cuántos emails bajó y cuántas bajas quedaron afuera).
- La cédula usa espacios de no corte ("CI 4.097.298-0"), para que no se parta en dos líneas en el celular.
- Estos mails (encuesta y preventa) están declarados en `/privacidad`.
- **Pendiente:** dominio propio + `no-reply@` con Resend; ver `docs/BACKLOG.md`.

## 8b. Caché

Las consultas a Supabase se hacen con `cache: 'no-store'` (`src/lib/supabase/admin.ts` y `server.ts`). Next 14 cachea por defecto los `fetch` del servidor, y la app mostraba datos viejos: una entrada usada seguía figurando como válida. Los datos de esta app cambian en tiempo real, así que **no se cachea nada de la base**.

## 8c. Seguridad: límite de intentos y lectura pública

**Límite de intentos por IP** (`src/lib/rate-limit.ts`, migración `0016`). La IP sale de `x-forwarded-for` (primer valor; en Vercel lo pone la plataforma) o `x-real-ip`. El conteo es atómico en Postgres (`rate_limit_hit` sobre `rate_limit_hits`, sin acceso público). Pasado el límite se muestra "Hiciste muchos intentos seguidos. Esperá unos minutos y probá de nuevo."

| Qué | Límite | Se cuenta |
|---|---|---|
| Compra (`startCheckoutAction`) | 60 **entradas** cada 10 min (una compra de 4 suma 4) | Después de validar el formulario (un error de tipeo no gasta intentos), antes de consultar cuentas, códigos o crear la entrada |
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

**Redirecciones** (`safeNextPath` en `src/lib/auth/gate.ts`): `?next=` solo acepta rutas del propio sitio. Se resuelve como lo haría el navegador (que borra tabs y saltos de línea, así que `/	/sitio.com` terminaría en `//sitio.com`): cualquier cosa que apunte afuera vuelve a la ruta por defecto. También resuelve los puntos: `/.//sitio.com` termina en `//sitio.com` y se rechaza igual.

**Contraseña de compra: 24 h desde que se escribió** (`grantedAt`), aunque la cookie se vuelva a guardar después (por ejemplo, al entrar un código).

**Sesión de Supabase solo en el servidor:** las cookies `sb-*` (admins y compradores) van `httpOnly` (`SESSION_COOKIE_OPTIONS` en `src/lib/supabase/server.ts` y el middleware): el navegador no las lee nunca, así que un XSS no podría robar la sesión de un admin.

**Modo local solo desde esta compu:** con `isLocalNoAuth()` el middleware responde 403 si el `Host` no es `127.0.0.1` o `localhost` (una página que apunta un dominio a 127.0.0.1, o el server abierto a la red).

**Otros controles:** el link del mapa del evento solo acepta `http(s)://` (va tal cual a la landing y a los mails); "Reenviar mail" solo manda si la entrada es válida y del evento; en Fotos y videos no se aceptan AVIF (aviso de seguridad del optimizador de imágenes de Next 14); al duplicar un evento, la tanda de preventa recibe un código nuevo (`PRE-XXXXXX`), así el link de la fecha anterior no abre la nueva; los avisos de pagos a los owners salen uno por problema y por pago (`email_log.send_key`), también para un pago aprobado sobre una compra reembolsada.

**Links del mail** (`/auth/confirm`): al abrir un link válido (confirmar email, recupero, invitación de admin) se le pone una contraseña al azar a la cuenta y se cierran las otras sesiones. Así, si alguien había creado la cuenta con ese email, su contraseña y su sesión dejan de valer; la persona elige la suya en la pantalla siguiente.

**Admin sin conexión** (`getAdminUser`): si Supabase no responde, tira error en vez de tratarlo como "sesión vencida". En la puerta y la barra se ve "Sin conexión" y se puede reintentar sin que echen al portero.

**Sin lectura pública** (`0016`). Se borraron las policies `eventos_lectura_publica` y `tiers_lectura_publica`: con la anon key se podían leer todas las columnas de eventos y tandas, incluido el código de preventa (`presale_code`) y `quantity_sold`. La app lee todo desde el servidor con la service key, así que no cambia nada visible. `tier_available` tampoco se puede llamar con la anon key.

## 9. Límites conocidos (decisiones conscientes)

- **Hasta 10 entradas por compra** (el máximo se elige en `/admin/config`), cada una nominativa (§5.2e).
- **La contraseña es compartida.** Alguien puede pasársela a un amigo, que compraría con su propia cédula. Se mitiga rotándola y revisando la lista por Instagram.
- **Sin modo offline en puerta.** El scanner necesita internet.
- **Invitaciones sin control de capacidad total.** No descuentan de ninguna tanda.
- **Barra: devoluciones por fuera.** No hay reembolso de barra desde el admin, y si se devuelve un pago desde el panel de Mercado Pago el webhook no lo marca `refunded`: esos QRs siguen valiendo hasta que alguien cambie el pedido a mano.

## 10. Encuesta del día después

En Admin → evento → **Resumen**, sección "Encuesta". Mandar: solo owners, y recién cuando terminó la fiesta (antes el botón no aparece y la acción no manda). Lo de "antes de ir" (fecha, lugar, qué llevar) se comunica por **Instagram**: no hay mail de recordatorio.

- **A quién:** a quienes entraron (`used`). Link a `/encuesta/<token>` (el mismo token del QR, que ya no sirve para entrar). Tocar un número del mail abre la encuesta con ese puntaje elegido.
- **No se repite:** cada envío queda en `email_log` (`survey`). "Mandar" va solo a quien no tiene un envío exitoso; los que fallaron quedan pendientes. **"Reenviar a todos"** manda de nuevo a todos.
- **Dos envíos a la vez no duplican** (`0019_comms_dedupe.sql`): cada destinatario se reserva antes de mandar (fila de `email_log` en `sending` con `send_key` único) y el mail sale solo si la reserva entró. Una reserva colgada más de 10 minutos se reintenta. Límite conocido: dos "Reenviar a todos" iniciados a la vez sí pueden duplicar.
- **Por tandas:** un clic manda durante unos 45 segundos (4 mails en paralelo). Si quedan pendientes, el aviso dice cuántos y se toca de nuevo. Si fallan 5 seguidos (por ejemplo, se llegó al límite de Gmail), se corta.
- **Automático:** `GET /api/cron/comunicacion`, una vez por día a las 12:00 de Montevideo (`vercel.json`). El día siguiente al evento, ya terminado, manda la encuesta a quien no la recibió, y al otro día repite con los pendientes. Pide `CRON_SECRET`: sin esa variable solo responde en desarrollo.
- **Encuesta** (`/encuesta/<token>`): puntaje del 1 al 5, "¿Qué mejorarías?" (opcional) y "¿Volverías a la próxima?". Una respuesta por entrada (`event_feedback`, `ticket_id` único): si vuelve a entrar, la ve cargada y la puede cambiar. Un token que no existe da 404. Una entrada que no se usó en puerta ve "Esta encuesta es para quienes vinieron".
- **Resultados** en la misma sección: promedio, cuántos respondieron de los que entraron, % que volvería, puntajes y los comentarios (sin nombre).
- El Instagram del pie sale de `site_config.ig_handle`, como el resto de los mails.
- `events.arrival_info` ("Cómo llegar") quedó sin uso: solo iba en el recordatorio.

Código: `src/lib/mail/event-mails.ts` · `src/app/admin/(panel)/events/[id]/comms.tsx` · `src/app/encuesta/[token]/` · `src/app/api/cron/comunicacion/route.ts` · SQL: `0013_event_comms.sql`.
