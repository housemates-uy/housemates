import Link from 'next/link';
import QRCode from 'qrcode';
import { Download, Printer } from 'lucide-react';
import { ConfirmSubmitButton } from '@/components/admin/submit-button';
import { buttonVariants } from '@/components/ui/button';
import { barAccessUrl } from '@/lib/bar-access';
import { qrSvg } from '@/lib/tickets';
import { rotateBarKeyAction } from './actions';
import { CopyBarLink } from './copy-bar-link';

// Link y QR de la barra: a /barra se entra solo por acá (src/lib/bar-access.ts).
export async function BarLinkSection({
  eventId,
  slug,
  barKey,
  isOwner,
}: {
  eventId: string;
  slug: string;
  barKey: string;
  isOwner: boolean;
}) {
  const url = barAccessUrl(barKey);
  const [svg, png] = await Promise.all([
    qrSvg(url),
    QRCode.toDataURL(url, { width: 1200, margin: 2, errorCorrectionLevel: 'M' }),
  ]);

  return (
    <section aria-labelledby="link-barra" className="space-y-4 rounded-card border border-bone/10 p-5">
      <div>
        <h2 id="link-barra" className="text-lg font-bold tracking-tight">
          Link y QR de la barra
        </h2>
        <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-bone/55">
          A la barra se entra solo con este link (para las historias de Instagram) o con el QR impreso en la fiesta.
          Quien escribe /barra a mano ve un aviso, sin la carta. Desde que abre el link, cada persona puede pedir
          durante 24 h.
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <div
          aria-label="QR de la barra"
          role="img"
          className="w-36 shrink-0 rounded-xl bg-white p-2 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className="min-w-0 flex-1 space-y-3">
          <p className="break-all rounded-control border border-bone/10 bg-bone/[0.04] px-3 py-2 font-mono text-xs text-bone/80">
            {url}
          </p>
          <div className="flex flex-wrap gap-2">
            <CopyBarLink url={url} />
            <a href={png} download={`barra-${slug}.png`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <Download size={15} aria-hidden />
              Descargar QR
            </a>
            <Link
              href={`/admin/events/${eventId}/barra/imprimir`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <Printer size={15} aria-hidden />
              Imprimir QR
            </Link>
          </div>
          {isOwner && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-bone/10 pt-3">
              <form action={rotateBarKeyAction.bind(null, eventId)}>
                <ConfirmSubmitButton variant="outline" size="sm" confirmLabel="Sí, cambiar el link">
                  Cambiar link
                </ConfirmSubmitButton>
              </form>
              <p className="max-w-[48ch] text-xs leading-relaxed text-bone/50">
                El link y el QR de ahora dejan de abrir la barra, también para quien ya entró. Después hay que
                imprimir el QR nuevo y cambiar el link de las historias.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
