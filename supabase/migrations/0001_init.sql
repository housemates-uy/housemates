-- ============================================================
-- 0001_init.sql — Schema inicial HOUSE MATES
-- ============================================================

-- Tipos enumerados
CREATE TYPE event_status     AS ENUM ('draft', 'published', 'archived');
CREATE TYPE ticket_source    AS ENUM ('purchase', 'invitation', 'manual');
CREATE TYPE ticket_status    AS ENUM ('pending', 'paid', 'used', 'refunded', 'cancelled');
CREATE TYPE whitelist_status AS ENUM ('active', 'banned');
CREATE TYPE checkin_result   AS ENUM ('admitted', 'already_used', 'invalid', 'wrong_event', 'not_paid', 'door_closed');
CREATE TYPE admin_role       AS ENUM ('owner', 'staff');
CREATE TYPE email_type       AS ENUM ('confirmation', 'reminder', 'resent');
CREATE TYPE email_status     AS ENUM ('sent', 'failed', 'bounced');

-- ============================================================
-- ADMINS
-- id referencia auth.users — Supabase Auth maneja las passwords.
-- ============================================================
CREATE TABLE admins (
  id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          text UNIQUE NOT NULL,
  name           text NOT NULL,
  role           admin_role NOT NULL DEFAULT 'staff',
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_login_at  timestamptz
);

-- ============================================================
-- EVENTOS
-- ============================================================
CREATE TABLE events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text UNIQUE NOT NULL,
  title            text NOT NULL,
  date_start       timestamptz NOT NULL,
  date_end         timestamptz NOT NULL,
  location_name    text NOT NULL,
  location_url     text,
  description_md   text,
  hero_image_url   text,
  gallery_urls     text[] NOT NULL DEFAULT '{}',
  lineup           jsonb NOT NULL DEFAULT '[]',
  status           event_status NOT NULL DEFAULT 'draft',
  sales_active     boolean NOT NULL DEFAULT false,
  door_closed      boolean NOT NULL DEFAULT false,
  capacity         int NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TIERS DE TICKETS
-- ============================================================
CREATE TABLE ticket_tiers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  price_uyu       numeric(10,2) NOT NULL,
  quantity_total  int NOT NULL,
  quantity_sold   int NOT NULL DEFAULT 0,
  sales_start     timestamptz,
  sales_end       timestamptz,
  sort_order      int NOT NULL DEFAULT 0,
  active          boolean NOT NULL DEFAULT true
);

-- ============================================================
-- TICKETS (compras + invitaciones + manuales)
-- ============================================================
CREATE TABLE tickets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           uuid NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  tier_id            uuid REFERENCES ticket_tiers(id) ON DELETE RESTRICT,
  source             ticket_source NOT NULL DEFAULT 'purchase',
  buyer_name         text NOT NULL,
  buyer_email        text NOT NULL,
  buyer_phone        text,
  buyer_document     text NOT NULL,
  status             ticket_status NOT NULL DEFAULT 'pending',
  qr_token           text UNIQUE,
  mp_preference_id   text,
  mp_payment_id      text UNIQUE,
  amount_paid_uyu    numeric(10,2) NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  paid_at            timestamptz,
  used_at            timestamptz,
  used_by_admin_id   uuid REFERENCES admins(id) ON DELETE SET NULL,
  notes              text,
  UNIQUE (event_id, buyer_email),
  UNIQUE (event_id, buyer_document)
);

-- ============================================================
-- WHITELIST
-- ============================================================
CREATE TABLE whitelist (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 text UNIQUE NOT NULL,
  name                  text,
  instagram_handle      text,
  tags                  text[] NOT NULL DEFAULT '{}',
  status                whitelist_status NOT NULL DEFAULT 'active',
  notes                 text,
  added_by_admin_id     uuid REFERENCES admins(id) ON DELETE SET NULL,
  added_at              timestamptz NOT NULL DEFAULT now(),
  events_attended_count int NOT NULL DEFAULT 0,
  last_attended_at      timestamptz
);

-- ============================================================
-- CHECK-INS (auditoría de escaneos en puerta)
-- ============================================================
CREATE TABLE check_ins (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    uuid NOT NULL REFERENCES tickets(id) ON DELETE RESTRICT,
  admin_id     uuid REFERENCES admins(id) ON DELETE SET NULL,
  scanned_at   timestamptz NOT NULL DEFAULT now(),
  result       checkin_result NOT NULL,
  device_info  text
);

-- ============================================================
-- LOGS DE CAMBIOS ADMIN
-- ============================================================
CREATE TABLE admin_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     uuid REFERENCES admins(id) ON DELETE SET NULL,
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    uuid,
  diff         jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- CONFIG DEL SITE
-- ============================================================
CREATE TABLE site_config (
  key          text PRIMARY KEY,
  value        text NOT NULL DEFAULT '',
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid REFERENCES admins(id) ON DELETE SET NULL
);

-- ============================================================
-- RATE LIMITING DEL GATE
-- ============================================================
CREATE TABLE gate_attempts (
  id            bigserial PRIMARY KEY,
  ip            inet NOT NULL,
  success       boolean NOT NULL DEFAULT false,
  attempted_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- LOG DE EMAILS ENVIADOS
-- ============================================================
CREATE TABLE email_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  type         email_type NOT NULL,
  provider_id  text,
  status       email_status NOT NULL DEFAULT 'sent',
  sent_at      timestamptz NOT NULL DEFAULT now()
);

-- updated_at automático en events
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
