import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { buttonVariants } from '@/components/ui/button';
import { getAdminUser } from '@/lib/auth/admin';
import { LANDING_KEYS, LANDING_MEDIA_KEY, landingFromConfig, parseMediaOverrides, resolveMedia } from '@/lib/landing';
import { DEFAULT_IG_HANDLE } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';
import { LandingForm } from './landing-form';
import { MediaEditor } from './media-editor';

export const metadata = { title: 'Landing' };

// Textos, fotos y videos de la landing e Instagram del sitio (solo owners). La fecha, el
// formato y la descripción salen del próximo evento. En la compu, a la derecha, la maqueta
// de las fotos y videos queda fija mientras se bajan los textos; en el celular va abajo.
export default async function LandingAdminPage({ searchParams }: { searchParams: { guardada?: string } }) {
  const admin = await getAdminUser();
  if (!admin) redirect('/admin/login');
  if (admin.role !== 'owner') redirect('/admin');

  const { data, error } = await createAdminClient()
    .from('site_config')
    .select('key, value')
    .in('key', [...Object.values(LANDING_KEYS), LANDING_MEDIA_KEY, 'ig_handle']);
  if (error) throw error;
  const stored = new Map((data ?? []).map((r) => [r.key, r.value]));
  const values = landingFromConfig(stored);

  return (
    <div className="space-y-8 xl:max-w-[76rem]">
      <PageHeader
        title="Landing"
        description="Los textos, las fotos y los videos de la página principal. Si no cambiás nada, se ve como siempre."
        action={
          <Link href="/" target="_blank" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Ver la landing
            <ArrowUpRight size={14} aria-hidden />
            <span className="sr-only"> (se abre en otra pestaña)</span>
          </Link>
        }
      />
      <div className="grid gap-12 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start xl:gap-10">
        <div className="min-w-0 max-w-2xl">
          <LandingForm
            values={values}
            igHandle={stored.get('ig_handle') || DEFAULT_IG_HANDLE}
            saved={searchParams.guardada === '1'}
          />
        </div>
        <MediaEditor
          media={resolveMedia(parseMediaOverrides(stored.get(LANDING_MEDIA_KEY)))}
          heroTitle={values.heroTitle}
          houseTitle={values.houseTitle}
        />
      </div>
    </div>
  );
}
