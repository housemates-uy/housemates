import { createAdminClient } from '@/lib/supabase/admin';

export const SITE_NAME = 'House Mates';
const DEFAULT_IG_HANDLE = '@house__mates';

export async function getIgHandle(): Promise<string> {
  try {
    const db = createAdminClient({ timeoutMs: 2500 });
    const { data } = await db.from('site_config').select('value').eq('key', 'ig_handle').maybeSingle().retry(false);
    return data?.value || DEFAULT_IG_HANDLE;
  } catch {
    return DEFAULT_IG_HANDLE;
  }
}

export function igUrl(handle: string) {
  return `https://instagram.com/${handle.replace(/^@/, '')}`;
}
