// ============================================================
// Envío de mails. Ver docs/LOGICA_DE_NEGOCIO.md → "Mails".
// ============================================================
// Hoy: SMTP de Gmail (cuenta personal de Tato) con una "contraseña de aplicación".
// Límite de Gmail: ~500 mails por día. Pendiente (docs/BACKLOG.md): dominio propio y
// no-reply@<dominio> con Resend; solo cambia este archivo.
//
// Si faltan GMAIL_USER / GMAIL_APP_PASSWORD no se manda nada (se loguea) y la app sigue
// funcionando: los mails nunca bloquean una compra ni una acción del admin.
import nodemailer, { type Transporter } from 'nodemailer';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/types/database';

type EmailType = Database['public']['Enums']['email_type'];

let transporter: Transporter | null = null;

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  transporter ??= nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  return transporter;
}

export async function sendMail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: Buffer; cid: string }[];
  log?: { ticketId: string; type: EmailType };
}): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    console.warn('[mail] GMAIL_USER / GMAIL_APP_PASSWORD no configurados: no se mandó', params.subject);
    return false;
  }

  let ok = false;
  let providerId: string | null = null;
  try {
    const info = await t.sendMail({
      from: process.env.MAIL_FROM ?? `House Mates <${process.env.GMAIL_USER}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      attachments: params.attachments,
    });
    ok = true;
    providerId = info.messageId ?? null;
  } catch (err) {
    console.error('[mail] falló el envío', params.subject, (err as Error)?.message);
  }

  if (params.log) {
    await createAdminClient()
      .from('email_log')
      .insert({
        ticket_id: params.log.ticketId,
        type: params.log.type,
        provider_id: providerId,
        status: ok ? 'sent' : 'failed',
      });
  }
  return ok;
}
