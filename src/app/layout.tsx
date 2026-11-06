import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { FALLBACK_FONT_CSS, fontFaceCss, fontPreloads } from '@/lib/fonts';
import { appUrl } from '@/lib/tickets';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: { default: 'House Mates', template: '%s · House Mates' },
  description: 'Una casa, de noche. Fiesta privada en Uruguay.',
  robots: { index: false, follow: false },
};

const FONT_SWAP =
  "(function(){var l=document.getElementById('fuente-respaldo');if(!l)return;var on=function(){l.media='all'};if(l.sheet)on();else l.addEventListener('load',on)})()";

export const viewport: Viewport = {
  themeColor: '#0A0A0A',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        {fontPreloads.map((href) => (
          <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="anonymous" />
        ))}
        {fontFaceCss && <style dangerouslySetInnerHTML={{ __html: fontFaceCss }} />}
        {/* La hoja de Fontshare se pide sin CORS y las fuentes con CORS: cada una usa su conexión. */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="anonymous" />
        <link rel="preload" href={FALLBACK_FONT_CSS} as="style" />
        {/* Sin bloquear el primer dibujo: entra como media="print" y el script la pasa a "all"
            cuando cargó. suppressHydrationWarning: el script cambia media antes de hidratar. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- fuente de respaldo del manual */}
        <link id="fuente-respaldo" rel="stylesheet" href={FALLBACK_FONT_CSS} media="print" suppressHydrationWarning />
        <script dangerouslySetInnerHTML={{ __html: FONT_SWAP }} />
        <noscript>
          {/* eslint-disable-next-line @next/next/no-page-custom-font -- fuente de respaldo del manual */}
          <link rel="stylesheet" href={FALLBACK_FONT_CSS} />
        </noscript>
      </head>
      <body className="min-h-[100dvh] bg-ink font-sans text-bone antialiased">
        {/* Link y no <a>: con un <a href="#…"> el botón "Atrás" queda trabado (Next 14). */}
        <Link
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-bone focus:px-4 focus:py-2 focus:text-sm focus:text-ink"
        >
          Saltar al contenido
        </Link>
        {children}
      </body>
    </html>
  );
}
