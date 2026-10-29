// Textos, fotos y videos de la landing que los owners cambian en /admin/landing. Se guardan
// en site_config (claves landing_*); si una clave no está, va lo de siempre. Las reglas van
// una por renglón en landing_rules. Ver docs/LOGICA_DE_NEGOCIO.md → "Landing".
// Sin imports de servidor: lo usa también el formulario del admin.
import { z } from 'zod';

export type LandingContent = {
  heroTitle: string;
  houseTitle: string;
  houseText: string;
  houseCredits: string;
  rulesTitle: string;
  rules: string[];
};

export const LANDING_DEFAULTS: LandingContent = {
  heroTitle: 'Tu casa favorita vuelve a MVD',
  houseTitle: 'Una casa, de noche.',
  houseText:
    'House Mates nació como una junta de amigos en una casa y creció sin perder eso: la calidez de estar en casa y la energía de una noche de club.',
  houseCredits: 'Fotos: @photolechu · Video: @xbengala',
  rulesTitle: 'Cuidemos la casa',
  rules: [
    'El ingreso es por lista.',
    'Al llegar presentá tu CI y se te coloca un precinto.',
    'No se venden entradas en puerta.',
    'Hay ropería: el ticket se compra en barra.',
  ],
};

export const LANDING_KEYS: Record<keyof LandingContent, string> = {
  heroTitle: 'landing_hero_title',
  houseTitle: 'landing_house_title',
  houseText: 'landing_house_text',
  houseCredits: 'landing_house_credits',
  rulesTitle: 'landing_rules_title',
  rules: 'landing_rules',
};

export const LANDING_LIMITS = {
  heroTitle: 60,
  houseTitle: 60,
  houseText: 600,
  houseCredits: 120,
  rulesTitle: 60,
  rule: 160,
  rules: 12,
};

// Los créditos pueden quedar vacíos (no se muestran); el resto, vacío, vuelve al de siempre.
export function landingFromConfig(config: Map<string, string>): LandingContent {
  const text = (field: Exclude<keyof LandingContent, 'rules'>) => {
    const value = config.get(LANDING_KEYS[field]);
    if (value === undefined) return LANDING_DEFAULTS[field];
    return field === 'houseCredits' ? value.trim() : value.trim() || LANDING_DEFAULTS[field];
  };
  const rules = (config.get(LANDING_KEYS.rules) ?? '')
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean);
  return {
    heroTitle: text('heroTitle'),
    houseTitle: text('houseTitle'),
    houseText: text('houseText'),
    houseCredits: text('houseCredits'),
    rulesTitle: text('rulesTitle'),
    rules: rules.length > 0 ? rules : LANDING_DEFAULTS.rules,
  };
}

// Cómo queda cada campo en site_config.value.
export function landingToConfig(content: LandingContent): Record<string, string> {
  return {
    [LANDING_KEYS.heroTitle]: content.heroTitle,
    [LANDING_KEYS.houseTitle]: content.houseTitle,
    [LANDING_KEYS.houseText]: content.houseText,
    [LANDING_KEYS.houseCredits]: content.houseCredits,
    [LANDING_KEYS.rulesTitle]: content.rulesTitle,
    [LANDING_KEYS.rules]: content.rules.join('\n'),
  };
}

// ------------------------------------------------------------
// Fotos y videos
// ------------------------------------------------------------
// Cada foto o video es un "lugar": los dos recortes de la portada (compu y celular) y los
// nueve de la grilla de La casa. Cualquiera puede ser foto o video. En landing_media van solo
// los lugares cambiados, como JSON ({ lugar: archivo }); el resto muestra lo de siempre
// (public/photos y public/video). Lo que suben los owners va al bucket público `landing`.
export const LANDING_MEDIA_KEY = 'landing_media';
export const LANDING_BUCKET = 'landing';

export const MEDIA_SLOTS = [
  'hero-desktop',
  'hero-mobile',
  'house-1',
  'house-2',
  'house-3',
  'house-4',
  'house-5',
  'house-6',
  'house-7',
  'house-8',
  'house-9',
] as const;
export type MediaSlot = (typeof MEDIA_SLOTS)[number];

const mediaSchema = z.object({
  type: z.enum(['image', 'video']),
  src: z.string(),
  // Solo los videos: la imagen que se ve mientras carga (y sola, con "reducir movimiento").
  poster: z.string().optional(),
  alt: z.string(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export type LandingMedia = z.infer<typeof mediaSchema>;
export type LandingMediaSet = Record<MediaSlot, LandingMedia>;
export type LandingMediaOverrides = Partial<LandingMediaSet>;
export type LandingPageContent = LandingContent & { media: LandingMediaSet };

export const MEDIA_LABELS: Record<MediaSlot, string> = {
  'hero-desktop': 'Portada · compu',
  'hero-mobile': 'Portada · celular',
  'house-1': 'La casa · 1',
  'house-2': 'La casa · 2',
  'house-3': 'La casa · 3',
  'house-4': 'La casa · 4',
  'house-5': 'La casa · 5',
  'house-6': 'La casa · 6',
  'house-7': 'La casa · 7',
  'house-8': 'La casa · 8',
  'house-9': 'La casa · 9',
};

// Fotos de las últimas fechas (12.12.25 open air, 20.03.26 y 04.09.26).
// Fotos: @photolechu · Video: @xbengala. Los originales están en el Drive de cada fecha.
// La portada es de fondo (sin texto alternativo) y tiene dos recortes: con una sola foto
// horizontal, el celular mostraba un pedazo chico agrandado y se veía pixelado.
export const LANDING_MEDIA_DEFAULTS: LandingMediaSet = {
  'hero-desktop': { type: 'image', src: '/photos/portada.webp', alt: '', width: 2800, height: 1540 },
  'hero-mobile': { type: 'image', src: '/photos/portada-vertical.webp', alt: '', width: 1080, height: 2160 },
  'house-1': {
    type: 'image',
    src: '/photos/casa-de-noche.webp',
    alt: 'La carpa iluminada de noche, entre árboles con luces azules y rojas',
  },
  'house-2': {
    type: 'video',
    src: '/video/casita-neon.mp4',
    poster: '/video/casita-neon.webp',
    alt: 'La casita de neón violeta con la pista llena, en el open air',
  },
  'house-3': { type: 'image', src: '/photos/abrazo.webp', alt: 'Un grupo de amigos abrazados y riéndose en la pista' },
  'house-4': {
    type: 'image',
    src: '/photos/cartel-madera.webp',
    alt: 'El logo de la casita en neón blanco sobre una puerta de madera',
  },
  'house-5': {
    type: 'image',
    src: '/photos/escenario-de-dia.webp',
    alt: 'La cabina con forma de casita en el open air, de día, con la gente bailando adelante',
  },
  'house-6': { type: 'image', src: '/photos/baile-vinedo.webp', alt: 'Una chica bailando con los brazos arriba en el viñedo' },
  'house-7': { type: 'image', src: '/photos/atardecer.webp', alt: 'Cuatro amigos en un sillón al atardecer, con el viñedo atrás' },
  'house-8': { type: 'image', src: '/photos/laseres.webp', alt: 'La pista llena bajo láseres azules' },
  'house-9': { type: 'image', src: '/photos/carpa-violeta.webp', alt: 'La carpa llena de gente con luces violetas' },
};

// La grilla de La casa (6 columnas): la usan la landing y la maqueta del admin. El 2 va
// vertical, al lado del 3 y el 4 apilados; el 7 toma la altura del 6.
export const HOUSE_TILES: { slot: MediaSlot; className: string; sizes: string; delay: number }[] = [
  { slot: 'house-1', className: 'col-span-6 aspect-[16/9]', sizes: '(min-width: 1024px) 58vw, 100vw', delay: 0 },
  { slot: 'house-2', className: 'col-span-3 row-span-2', sizes: '(min-width: 1024px) 29vw, 50vw', delay: 0.06 },
  { slot: 'house-3', className: 'col-span-3 aspect-[4/3]', sizes: '(min-width: 1024px) 29vw, 50vw', delay: 0.1 },
  { slot: 'house-4', className: 'col-span-3 aspect-[4/3]', sizes: '(min-width: 1024px) 29vw, 50vw', delay: 0.14 },
  { slot: 'house-5', className: 'col-span-6 aspect-[16/9]', sizes: '(min-width: 1024px) 58vw, 100vw', delay: 0 },
  { slot: 'house-6', className: 'col-span-2 aspect-[2/3]', sizes: '(min-width: 1024px) 19vw, 33vw', delay: 0.06 },
  { slot: 'house-7', className: 'col-span-4 h-full', sizes: '(min-width: 1024px) 38vw, 66vw', delay: 0 },
  { slot: 'house-8', className: 'col-span-3 aspect-[4/3]', sizes: '(min-width: 1024px) 29vw, 50vw', delay: 0.06 },
  { slot: 'house-9', className: 'col-span-3 aspect-[4/3]', sizes: '(min-width: 1024px) 29vw, 50vw', delay: 0 },
];

// Tipos que se aceptan y tope por archivo (el bucket corta en 50 MB).
export const MEDIA_TYPES: Record<string, { type: LandingMedia['type']; ext: string }> = {
  'image/jpeg': { type: 'image', ext: 'jpg' },
  'image/png': { type: 'image', ext: 'png' },
  'image/webp': { type: 'image', ext: 'webp' },
  'image/avif': { type: 'image', ext: 'avif' },
  'video/mp4': { type: 'video', ext: 'mp4' },
  'video/webm': { type: 'video', ext: 'webm' },
  'video/quicktime': { type: 'video', ext: 'mov' },
};
export const MEDIA_ACCEPT = Object.keys(MEDIA_TYPES).join(',');
export const MEDIA_LIMITS = { imageMb: 15, videoMb: 50, alt: 200 };

// Lo controlan el navegador antes de subir y el servidor al dar el link y al guardar.
export function mediaFileError(mimeType: string, bytes: number): string | null {
  const type = MEDIA_TYPES[mimeType]?.type;
  if (!type) return 'Tiene que ser una foto (JPG, PNG, WebP o AVIF) o un video (MP4, WebM o MOV).';
  if (bytes <= 0) return 'El archivo está vacío.';
  if (type === 'video' && bytes > MEDIA_LIMITS.videoMb * 1024 * 1024) {
    return `El video pesa más de ${MEDIA_LIMITS.videoMb} MB: probá con uno más corto o más liviano.`;
  }
  if (type === 'image' && bytes > MEDIA_LIMITS.imageMb * 1024 * 1024) {
    return `La foto pesa más de ${MEDIA_LIMITS.imageMb} MB: probá con una más liviana.`;
  }
  return null;
}

// Archivos del bucket: <lugar>/<8 hex>-<nombre>.<ext>. Se guarda la URL pública entera.
const BUCKET_URL = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')}/storage/v1/object/public/${LANDING_BUCKET}/`;
const BUCKET_PATH = /^(hero-desktop|hero-mobile|house-[1-9])\/[0-9a-f]{8}-[a-z0-9-]{1,60}\.(jpg|png|webp|avif|mp4|webm|mov)$/;

export function bucketPath(src: string | undefined): string | null {
  if (!src?.startsWith(BUCKET_URL)) return null;
  const path = src.slice(BUCKET_URL.length);
  return BUCKET_PATH.test(path) ? path : null;
}

export function bucketUrl(path: string): string {
  return BUCKET_URL + path;
}

export function isBucketPathFor(slot: MediaSlot, path: string): boolean {
  return BUCKET_PATH.test(path) && path.startsWith(`${slot}/`);
}

export function typeOfPath(path: string): LandingMedia['type'] | undefined {
  const ext = path.split('.').pop();
  return Object.values(MEDIA_TYPES).find((t) => t.ext === ext)?.type;
}

// Para el admin y el Historial: "abrazo.webp", sin el prefijo al azar de los subidos.
export function mediaFileName(src: string): string {
  const name = src.split('/').pop() ?? src;
  return bucketPath(src) ? name.replace(/^[0-9a-f]{8}-/, '') : name;
}

// Solo vale lo de siempre de ese lugar o un archivo del bucket de ese mismo lugar, con el
// tipo que dice su extensión: next/image no acepta otros hosts y la landing se caería.
function allowedMedia(slot: MediaSlot, media: LandingMedia): boolean {
  const original = LANDING_MEDIA_DEFAULTS[slot];
  if (media.src === original.src) return media.type === original.type && media.poster === original.poster;
  const path = bucketPath(media.src);
  if (!path || !isBucketPathFor(slot, path) || typeOfPath(path) !== media.type) return false;
  if (media.type === 'image') return media.poster === undefined;
  const poster = bucketPath(media.poster);
  return !!poster && isBucketPathFor(slot, poster) && typeOfPath(poster) === 'image';
}

export function parseMediaOverrides(value: string | undefined): LandingMediaOverrides {
  let raw: unknown;
  try {
    raw = JSON.parse(value || '{}');
  } catch {
    return {};
  }
  if (!raw || typeof raw !== 'object') return {};
  const overrides: LandingMediaOverrides = {};
  for (const slot of MEDIA_SLOTS) {
    const parsed = mediaSchema.safeParse((raw as Record<string, unknown>)[slot]);
    if (parsed.success && allowedMedia(slot, parsed.data)) overrides[slot] = parsed.data;
  }
  return overrides;
}

export function isOriginalMedia(slot: MediaSlot, media: LandingMedia): boolean {
  const original = LANDING_MEDIA_DEFAULTS[slot];
  return media.src === original.src && media.alt === original.alt;
}

export function resolveMedia(overrides: LandingMediaOverrides): LandingMediaSet {
  return Object.fromEntries(
    MEDIA_SLOTS.map((slot) => [slot, overrides[slot] ?? LANDING_MEDIA_DEFAULTS[slot]]),
  ) as LandingMediaSet;
}
