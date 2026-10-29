import { Hero } from '@/components/landing/hero';
import { House } from '@/components/landing/house';
import { NextDate } from '@/components/landing/next-date';
import { Rules } from '@/components/landing/rules';
import { SiteFooter } from '@/components/landing/site-footer';
import { SiteNav } from '@/components/landing/site-nav';
import { isAccountsEnabled } from '@/lib/customers';
import { getNextEvent } from '@/lib/next-event';
import { getIgHandle, getLandingContent, igUrl } from '@/lib/site';

export const revalidate = 60;

export default async function HomePage() {
  const [event, igHandle, content, accountsOn] = await Promise.all([
    getNextEvent(),
    getIgHandle(),
    getLandingContent(),
    isAccountsEnabled(),
  ]);
  const igHref = igUrl(igHandle);

  return (
    <>
      <SiteNav igHandle={igHandle} igHref={igHref} accountsEnabled={accountsOn} />
      <main id="contenido">
        <Hero event={event} title={content.heroTitle} media={content.media} />
        <NextDate event={event} />
        <House content={content} />
        <Rules content={content} />
      </main>
      <SiteFooter igHandle={igHandle} igHref={igHref} />
    </>
  );
}
