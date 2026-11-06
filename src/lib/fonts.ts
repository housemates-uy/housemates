// Tipografía informativa del manual: Neue Montreal (paga). El repo es público, así que los
// .woff2 no se commitean: se usan solo si NEXT_PUBLIC_FONTS_URL apunta a donde están
// (en local, con los archivos en public/fonts/, poné NEXT_PUBLIC_FONTS_URL=/fonts).
// Mientras tanto se usa General Sans, la alternativa gratuita que indica el mismo manual
// (pág. 05), servida desde Fontshare. Así no hay pedidos a archivos que no existen.
const base = process.env.NEXT_PUBLIC_FONTS_URL?.replace(/\/$/, '') ?? null;

const weights = [
  ['Light', 300],
  ['Regular', 400],
  ['Medium', 500],
  ['Bold', 700],
] as const;

export const fontPreloads = base ? [`${base}/NeueMontreal-Regular.woff2`, `${base}/NeueMontreal-Bold.woff2`] : [];

export const fontFaceCss = base
  ? weights
      .map(
        ([name, weight]) =>
          `@font-face{font-family:"Neue Montreal";src:url("${base}/NeueMontreal-${name}.woff2") format("woff2");font-weight:${weight};font-style:normal;font-display:swap}`,
      )
      .join('')
  : '';

// General Sans (Fontshare, licencia ITF Free Font: libre para uso comercial).
export const FALLBACK_FONT_CSS = 'https://api.fontshare.com/v2/css?f[]=general-sans@300,400,500,600,700&display=swap';
