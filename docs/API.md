# HOUSE MATES — API Spec

> Todos los endpoints devuelven JSON. Errores siempre como `{ error: string, code?: string }` + HTTP status acorde.
> Última actualización: 2026-04-14

---

## Convenciones

- **Auth público (gate):** cookie `hm_access` firmada (iron-session), 1 día de vida
- **Auth admin:** Supabase Auth JWT en header `Authorization: Bearer <token>` + verificación de rol en middleware
- **Rate limit:** por IP, ventana deslizante, implementado con Upstash Redis o tabla Postgres
- **Idempotencia:** webhooks de MP se deduplican por `mp_payment_id`

---

## 1. Endpoints públicos

### `POST /api/gate`
Valida el password universal y setea cookie.

**Body:**
```json
{ "password": "string" }
```

**Respuestas:**
- `200` → setea cookie `hm_access`, `{ ok: true }`
- `401` → `{ error: "invalid_password" }`
- `429` → `{ error: "rate_limited", retry_after: 900 }` (tras 5 intentos fallidos / 15 min por IP)

**Side effects:** inserta registro en `gate_attempts`.

---

### `POST /api/whitelist/check`
Consulta si un email está en la whitelist. No revela detalles del registro.

**Body:**
```json
{ "email": "string" }
```

**Respuestas:**
- `200` → `{ allowed: true }` o `{ allowed: false }`
- `400` → `{ error: "invalid_email" }`
- `429` → rate limit (10 consultas / min / IP)

**Normalización:** el backend aplica lowercase + strip gmail dots/tag antes de consultar.

---

### `POST /api/checkout`
Crea un ticket pending y una preferencia en Mercado Pago.

**Body:**
```json
{
  "event_id": "uuid",
  "tier_id": "uuid",
  "buyer": {
    "name": "string",
    "email": "string",
    "phone": "string",
    "document": "1.234.567-8"
  }
}
```

**Validaciones:**
- Cookie `hm_access` válida
- Email en whitelist
- CI uruguaya válida (dígito verificador)
- Tier activo, dentro de ventana de venta
- Stock disponible (lock optimista)
- No existe ticket previo del mismo email o CI para ese evento

**Respuestas:**
- `200` → `{ ticket_id, init_point: "https://mercadopago.com/..." }`
- `400` → `{ error: "validation_failed", fields: {...} }`
- `403` → `{ error: "email_not_in_whitelist" }`
- `409` → `{ error: "already_bought" | "sold_out" }`

---

### `POST /api/mp/webhook`
Webhook de Mercado Pago. Llamado por MP al aprobar/rechazar pago.

**Body:** formato estándar de MP (`{ type, data: { id } }`)

**Flujo interno:**
1. Verifica header `x-signature` contra `MP_WEBHOOK_SECRET`
2. GET al endpoint de MP `/v1/payments/{id}` para obtener estado real
3. Mira si ya procesamos este `mp_payment_id` (idempotencia)
4. Si `approved`:
   - UPDATE ticket → status=paid, paid_at=now()
   - Genera `qr_token = HMAC(QR_HMAC_SECRET, ticket_id + event_id + created_at)`
   - Dispara email con Resend (ticket + QR + PDF)
   - Incrementa `ticket_tiers.quantity_sold`
5. Si `rejected/cancelled`: UPDATE ticket → status=cancelled, libera stock
6. Logea en `email_log` si corresponde

**Respuestas:**
- `200` siempre que se procese (MP reintenta con otros códigos)
- `401` si firma inválida

---

### `GET /api/ticket/[qrToken]`
Vista pública del ticket por si el comprador pierde el email. No requiere auth.

**Respuestas:**
- `200` → `{ ticket: { event: {...}, tier: {...}, buyer_name, qr_image_url, used_at } }`
- `404` → `{ error: "ticket_not_found" }`

**Nota:** no devuelve email ni CI completa (solo primeras 3 letras del nombre + inicial apellido, por privacidad).

---

## 2. Endpoints admin

Todos requieren auth. Middleware valida JWT y rol.

### 2.1 Eventos

#### `POST /api/admin/events`
Crea un evento nuevo.

#### `GET /api/admin/events?status=...`
Listado con filtros.

#### `GET /api/admin/events/[id]`
Detalle.

#### `PATCH /api/admin/events/[id]`
Edita campos. Logea en `admin_logs`.

#### `POST /api/admin/events/[id]/close-door`
Marca `door_closed=true`.

#### `DELETE /api/admin/events/[id]`
Archiva (no borra físicamente).

---

### 2.2 Ticket tiers

#### `POST /api/admin/events/[id]/tiers`
Crea tier.

#### `PATCH /api/admin/tiers/[id]`
Edita.

#### `DELETE /api/admin/tiers/[id]`
Desactiva.

---

### 2.3 Tickets

#### `GET /api/admin/events/[id]/tickets?status=...&search=...`
Listado.

#### `POST /api/admin/events/[id]/tickets`
Crear ticket manual (owner agrega a alguien sin pasar por MP).

**Body:**
```json
{
  "tier_id": "uuid",
  "buyer": { "name", "email", "phone", "document" },
  "mark_as_paid": true,
  "notes": "string"
}
```

#### `PATCH /api/admin/tickets/[id]`
Editar datos del comprador (cambio de titular).

#### `POST /api/admin/tickets/[id]/resend-email`
Reenviar email con QR.

#### `POST /api/admin/tickets/[id]/refund`
**Body:** `{ reason: string }`
- UPDATE ticket → status=refunded
- Invalida qr_token (puede regenerarse si se revierte, pero el actual deja de validar)
- Genera refund en MP vía API
- Libera stock (decrementa `quantity_sold`)

#### `DELETE /api/admin/tickets/[id]`
Cancelación (status=cancelled).

---

### 2.4 Invitaciones (guest list)

Son tickets con `source=invitation`, `tier_id=null`, `amount_paid_uyu=0`, `status=paid`. **No requieren whitelist.**

#### `POST /api/admin/events/[id]/invitations`
Crea invitación.

**Body:**
```json
{
  "buyer": { "name", "email", "document" },
  "send_email": true,
  "notes": "string"
}
```

#### `GET /api/admin/events/[id]/invitations`
Listado.

#### `PATCH /api/admin/invitations/[id]`
Editar.

#### `DELETE /api/admin/invitations/[id]`
Eliminar.

---

### 2.5 Whitelist

#### `GET /api/admin/whitelist?search=...&tag=...&status=...&page=...`
Listado paginado.

#### `POST /api/admin/whitelist/bulk`
Agregar varios emails separados por coma.

**Body:**
```json
{
  "emails_raw": "ana@gmail.com, juan.perez+hm@gmail.com, LUCAS@HOTMAIL.COM",
  "tags": ["originales"],
  "notes": "agregados manualmente por José"
}
```

**Respuesta:**
```json
{
  "inserted": 2,
  "already_existed": 1,
  "invalid": 0,
  "details": [
    { "raw": "ana@gmail.com", "normalized": "ana@gmail.com", "status": "inserted" },
    { "raw": "juan.perez+hm@gmail.com", "normalized": "juanperez@gmail.com", "status": "inserted" },
    { "raw": "LUCAS@HOTMAIL.COM", "normalized": "lucas@hotmail.com", "status": "already_existed" }
  ]
}
```

#### `PATCH /api/admin/whitelist/[id]`
Editar nombre, tags, notas.

#### `POST /api/admin/whitelist/[id]/ban`
**Body:** `{ reason: string }` → marca status=banned.

#### `DELETE /api/admin/whitelist/[id]`
Eliminar físicamente (solo si no tiene tickets asociados).

---

### 2.6 Scanner

#### `POST /api/admin/scan/validate`
Valida un QR escaneado en puerta.

**Body:**
```json
{ "qr_token": "string", "event_id": "uuid" }
```

**Flujo:**
1. Verifica HMAC del token
2. Verifica evento correcto
3. Verifica `door_closed=false`
4. `UPDATE tickets SET used_at=now(), used_by_admin_id=... WHERE qr_token=? AND event_id=? AND status='paid' AND used_at IS NULL RETURNING *`
5. Inserta `check_ins` con resultado
6. Devuelve datos del ticket

**Respuestas:**
- `200` admit OK:
  ```json
  {
    "result": "admitted",
    "ticket": {
      "buyer_name": "Juan Pérez",
      "buyer_document": "4.123.456-7",
      "tier_name": "Early Bird",
      "source": "purchase",
      "created_at": "2026-03-01T..."
    }
  }
  ```
- `200` ya usado:
  ```json
  {
    "result": "already_used",
    "used_at": "2026-04-14T22:14:00Z",
    "used_by": "tato",
    "ticket": { ... }
  }
  ```
- `200` otros errores:
  - `{ "result": "invalid" }`
  - `{ "result": "wrong_event" }`
  - `{ "result": "not_paid" }`
  - `{ "result": "door_closed" }`
- `401` si no está autenticado

---

### 2.7 Stats

#### `GET /api/admin/stats/event/[id]`
Datos agregados para el dashboard del evento.

**Respuesta:**
```json
{
  "hero": {
    "revenue_uyu": 234000,
    "tickets_sold": 180,
    "capacity": 300,
    "occupation_pct": 60,
    "days_until": 45
  },
  "live": {
    "attendees_inside": 142,
    "not_entered": 38,
    "peak_time": "21:47",
    "admission_pct": 87
  },
  "tiers": [
    { "name": "Early Bird", "sold": 100, "total": 100, "revenue": 100000 },
    { "name": "General", "sold": 80, "total": 200, "revenue": 134000 }
  ],
  "timeline": [
    { "date": "2026-03-01", "sold": 10, "cumulative": 10 }
  ]
}
```

---

### 2.8 Config

#### `GET /api/admin/config`
Devuelve todos los pares key/value de `site_config`.

#### `PATCH /api/admin/config`
**Body:** `{ key: "gate_password", value: "nuevo_pass" }`
Logea cambio en `admin_logs`.

---

### 2.9 Admins

#### `GET /api/admin/admins`
Listado.

#### `POST /api/admin/admins`
Invitar admin (envía email con setup via Supabase Auth).

#### `PATCH /api/admin/admins/[id]`
Cambiar rol, activar/desactivar.

#### `DELETE /api/admin/admins/[id]`
Eliminar.

---

### 2.10 Logs

#### `GET /api/admin/logs?entity_type=...&admin_id=...&from=...&to=...`
Listado paginado de `admin_logs`.

---

## 3. Cron jobs (Vercel Cron)

### Recordatorio 24h antes del evento
**Schedule:** `0 * * * *` (cada hora)
**Endpoint:** `POST /api/cron/send-reminders`

Flujo:
1. Query eventos con `date_start` entre ahora+23h y ahora+25h
2. Para cada ticket con status=paid sin `reminder_sent`:
   - Envía email con QR + info del evento
   - Marca flag `reminder_sent=true` en `email_log`

**Autenticación:** header `authorization: Bearer <CRON_SECRET>`

---

## 4. Códigos de error estándar

| code | HTTP | Descripción |
|---|---|---|
| `invalid_password` | 401 | Password del gate incorrecto |
| `invalid_email` | 400 | Formato de email inválido |
| `invalid_document` | 400 | CI uruguaya inválida |
| `email_not_in_whitelist` | 403 | Email no autorizado para compra |
| `already_bought` | 409 | Ya existe ticket del mismo email/CI para el evento |
| `sold_out` | 409 | Tier sin stock |
| `sales_closed` | 409 | Fuera de ventana de venta |
| `rate_limited` | 429 | Demasiados intentos |
| `unauthorized` | 401 | No autenticado |
| `forbidden` | 403 | Autenticado pero sin permisos |
| `not_found` | 404 | Recurso inexistente |
| `mp_signature_invalid` | 401 | Webhook MP con firma inválida |
| `qr_invalid` | 400 | HMAC del QR no coincide |
| `door_closed` | 409 | Puerta cerrada — no se admite más gente |
