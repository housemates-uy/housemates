import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

// Destino de los links de invitación y de recuperación de contraseña.
// Los templates de mail de Supabase tienen que apuntar acá:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite   (o type=recovery)
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL('/admin/account?set=1', request.url));
    }
  }

  return NextResponse.redirect(new URL('/admin/login?error=link', request.url));
}
