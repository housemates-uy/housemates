import { Hero } from '@/components/landing/hero';
import { House } from '@/components/landing/house';
import { NextDate } from '@/components/landing/next-date';
import { Rules } from '@/components/landing/rules';
import { SiteFooter } from '@/components/landing/site-footer';
import { SiteNav } from '@/components/landing/site-nav';
import { getNextEvent } from '@/lib/next-event';
import { getIgHandle, igUrl } from '@/lib/site';

export const revalidate = 60;

export default async function HomePage() {
  const [event, igHandle] = await Promise.all([getNextEvent(), getIgHandle()]);
  const igHref = igUrl(igHandle);

  return (
    <>
      <SiteNav igHandle={igHandle} igHref={igHref} />
      <main id="contenido">
        <Hero event={event} />
        <NextDate event={event} />
        <House />
        <Rules />
      </main>
      <SiteFooter igHandle={igHandle} igHref={igHref} />
    </>
  );
}
