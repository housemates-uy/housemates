-- ============================================================
-- 0011_customer_accounts.sql — Cuentas de compradores
-- ============================================================
-- Explicación completa en docs/LOGICA_DE_NEGOCIO.md → "Cuentas de compradores".
-- La cuenta es un usuario de Supabase Auth (el mismo Auth de los admins). Ser comprador
-- no da acceso al admin: eso sigue pidiendo una fila activa en `admins`.

-- ------------------------------------------------------------
-- 1. Perfil del comprador (para precargar el formulario de compra)
-- ------------------------------------------------------------
-- email_verified_at: la cuenta se crea al comprar con el email que escribió la persona,
-- sin probar que es suya. Hasta que toca el link del mail (o recupera la contraseña),
-- "Mis entradas" muestra solo las entradas compradas desde la cuenta.
CREATE TABLE customers (
  id                 uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name               text NOT NULL,
  document           text NOT NULL CHECK (document ~ '^[0-9]{8}$'),
  phone              text,
  email_verified_at  timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);
-- Sin policies: solo el servidor (service_role) lee y escribe.
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 2. Entradas compradas desde una cuenta
-- ------------------------------------------------------------
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_customer ON tickets(customer_id) WHERE customer_id IS NOT NULL;
-- "Mis entradas" busca por email normalizado en todos los eventos.
CREATE INDEX IF NOT EXISTS idx_tickets_buyer_email_norm ON tickets(buyer_email_normalized);

-- ------------------------------------------------------------
-- 3. Lectura de entradas con la sesión del usuario: se saca
-- ------------------------------------------------------------
-- La policy de 0003 dejaba leer, con la anon key + la sesión, todas las entradas cuyo
-- buyer_email coincidiera con el email del usuario (con cédula completa, celular y QR).
-- Con cuentas de compradores cualquiera podría crear una cuenta con un email ajeno y
-- leerlas directo de la API. La app nunca la usó: todas las lecturas van por el servidor.
DROP POLICY IF EXISTS "tickets_lectura_dueno" ON tickets;

-- ------------------------------------------------------------
-- 4. Buscar un usuario de Auth por email (solo el servidor)
-- ------------------------------------------------------------
-- Para avisar "ya tenés cuenta" antes de cobrar y para no mandar más de un mail de
-- recupero por minuto.
CREATE OR REPLACE FUNCTION find_auth_user(p_email text)
RETURNS TABLE (id uuid, recovery_sent_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id, u.recovery_sent_at
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(p_email))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION find_auth_user(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION find_auth_user(text) TO service_role;
