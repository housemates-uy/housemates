'use server';

import { redirect } from 'next/navigation';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_TYPES: EmailOtpType[] = ['invite', 'recovery'];

export async function confirmLinkAction(formData: FormData) {
  const tokenHash = String(formData.get('token_hash') ?? '');
  const type = String(formData.get('type') ?? '') as EmailOtpType;

  if (tokenHash && ALLOWED_TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect('/admin/account?set=1');
  }

  redirect('/admin/login?error=link');
}
