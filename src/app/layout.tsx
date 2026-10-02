import type { Metadata, Viewport } from 'next';
import { fontFaceCss, fontPreloads } from '@/lib/fonts';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'House Mates', template: '%s · House Mates' },
  description: 'Una casa, de noche. Fiesta privada en Montevideo.',
  robots: { index: false, follow: false },
};

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
        <style dangerouslySetInnerHTML={{ __html: fontFaceCss }} />
      </head>
      <body className="min-h-[100dvh] bg-ink font-sans text-bone antialiased">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-bone focus:px-4 focus:py-2 focus:text-sm focus:text-ink"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
