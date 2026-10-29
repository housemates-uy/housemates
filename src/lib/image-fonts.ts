// Letra de las imágenes para guardar en el celular (la entrada y los tragos de la barra).
// Satori (next/og) no lee woff2, por eso no se usan los archivos de la página.
import { FALLBACK_FONT_CSS } from '@/lib/fonts';

export type ImageFont = { name: string; data: ArrayBuffer; weight: 400 | 500 | 700; style: 'normal' };

// La letra de la web (src/lib/fonts.ts): Neue Montreal si NEXT_PUBLIC_FONTS_URL apunta a sus
// archivos (acá hacen falta los .otf: Satori no lee woff2); si no, General Sans de Fontshare.
export async function loadImageFonts(req: Request): Promise<ImageFont[]> {
  const base = process.env.NEXT_PUBLIC_FONTS_URL?.replace(/\/$/, '');
  if (base) {
    const weights = [['Regular', 400], ['Medium', 500], ['Bold', 700]] as const;
    const neue = await Promise.all(
      weights.map(async ([name, weight]): Promise<ImageFont | null> => {
        try {
          const res = await fetch(new URL(`${base}/NeueMontreal-${name}.otf`, req.url), { cache: 'force-cache' });
          return res.ok ? { name: 'Neue Montreal', data: await res.arrayBuffer(), weight, style: 'normal' } : null;
        } catch {
          return null;
        }
      }),
    );
    const loaded = neue.filter((f): f is ImageFont => f !== null);
    if (loaded.length === weights.length) return loaded;
  }
  try {
    const css = await (await fetch(FALLBACK_FONT_CSS, { cache: 'force-cache' })).text();
    const faces = await Promise.all(
      [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map(async ([, face]): Promise<ImageFont | null> => {
        const weight = Number(/font-weight:\s*(\d+)/.exec(face)?.[1]);
        const url = /url\('([^']+\.ttf)'\)/.exec(face)?.[1];
        if (!url || (weight !== 400 && weight !== 500 && weight !== 700)) return null;
        const res = await fetch(url.startsWith('//') ? `https:${url}` : url, { cache: 'force-cache' });
        return res.ok ? { name: 'General Sans', data: await res.arrayBuffer(), weight, style: 'normal' } : null;
      }),
    );
    return faces.filter((f): f is ImageFont => f !== null);
  } catch {
    return [];
  }
}
