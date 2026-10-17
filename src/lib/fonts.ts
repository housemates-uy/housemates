// Neue Montreal es una fuente paga y el repo es público, así que los .woff2 no se commitean.
// En local viven en public/fonts/ (gitignored). En deploy, NEXT_PUBLIC_FONTS_URL apunta a
// donde estén alojados. Si no se encuentran, cae a Helvetica Neue / Arial.
const base = (process.env.NEXT_PUBLIC_FONTS_URL ?? '/fonts').replace(/\/$/, '');

const weights = [
  ['Light', 300],
  ['Regular', 400],
  ['Medium', 500],
  ['Bold', 700],
] as const;

export const fontPreloads = [`${base}/NeueMontreal-Regular.woff2`, `${base}/NeueMontreal-Bold.woff2`];

export const fontFaceCss = weights
  .map(
    ([name, weight]) =>
      `@font-face{font-family:"Neue Montreal";src:url("${base}/NeueMontreal-${name}.woff2") format("woff2");font-weight:${weight};font-style:normal;font-display:swap}`,
  )
  .join('');
