import {
  LANDING_DEFAULTS,
  LANDING_KEYS,
  LANDING_MEDIA_DEFAULTS,
  LANDING_MEDIA_KEY,
  landingFromConfig,
  parseMediaOverrides,
  resolveMedia,
  type LandingPageContent,
} from '@/lib/landing';
import { createAdminClient } from '@/lib/supabase/admin';

export const SITE_NAME = 'House Mates';
export const DEFAULT_IG_HANDLE = '@house__mates';

export async function getIgHandle(): Promise<string> {
  try {
    const db = createAdminClient({ timeoutMs: 2500 });
    const { data } = await db.from('site_config').select('value').eq('key', 'ig_handle').maybeSingle().retry(false);
    return data?.value || DEFAULT_IG_HANDLE;
  } catch {
    return DEFAULT_IG_HANDLE;
  }
}

// Si la base no responde, la landing sale con los textos, las fotos y los videos de siempre.
export async function getLandingContent(): Promise<LandingPageContent> {
  try {
    const db = createAdminClient({ timeoutMs: 2500 });
    const { data } = await db
      .from('site_config')
      .select('key, value')
      .in('key', [...Object.values(LANDING_KEYS), LANDING_MEDIA_KEY])
      .retry(false);
    const config = new Map((data ?? []).map((r) => [r.key, r.value]));
    return {
      ...landingFromConfig(config),
      media: resolveMedia(parseMediaOverrides(config.get(LANDING_MEDIA_KEY))),
    };
  } catch {
    return { ...LANDING_DEFAULTS, media: LANDING_MEDIA_DEFAULTS };
  }
}

export function igUrl(handle: string) {
  return `https://instagram.com/${handle.replace(/^@/, '')}`;
}
