import { Hero } from '@/components/landing/hero';
import { House } from '@/components/landing/house';
import { NextDate } from '@/components/landing/next-date';
import { Rules } from '@/components/landing/rules';
import { SiteFooter } from '@/components/landing/site-footer';
import { SiteNav } from '@/components/landing/site-nav';
import { hasGateAccess } from '@/lib/auth/gate';
import { isAccountsEnabled } from '@/lib/customers';
import { getNextEvent } from '@/lib/next-event';
import { getIgHandle, getLandingContent, igUrl } from '@/lib/site';

// Depende de la cookie de acceso de cada persona: nunca se sirve una copia guardada (con el
// lugar a la vista) a otra.
export const dynamic = 'force-dynamic';

// Como el resto de la portada, no espera a una base lenta más de 2,5 s. Ante la duda, se ve
// como sin acceso, nunca al revés.
function gateAccessOrLocked(): Promise<boolean> {
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2500));
  return Promise.race([hasGateAccess().catch(() => false), timeout]);
}

export default async function HomePage() {
  const [nextEvent, igHandle, content, accountsOn, access] = await Promise.all([
    getNextEvent(),
    getIgHandle(),
    getLandingContent(),
    isAccountsEnabled(),
    gateAccessOrLocked(),
  ]);
  // Sin la contraseña o un código, el lugar no sale del servidor: ni en el HTML ni en lo que
  // reciben los componentes. Las reglas tampoco.
  const event = access ? nextEvent : { ...nextEvent, locationName: null, locationUrl: null };
  const igHref = igUrl(igHandle);

  return (
    <>
      <SiteNav accountsEnabled={accountsOn} />
      <main id="contenido">
        <Hero event={event} title={content.heroTitle} media={content.media} />
        <NextDate event={event} locked={!access} />
        <House content={content} />
        <Rules content={content} locked={!access} />
      </main>
      <SiteFooter igHandle={igHandle} igHref={igHref} />
    </>
  );
}
