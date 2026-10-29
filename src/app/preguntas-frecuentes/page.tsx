import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { LegalPage, proseClass } from '@/components/legal/legal-page';
import { buttonVariants } from '@/components/ui/button';
import { isAccountsEnabled } from '@/lib/customers';
import { getNextEvent, mapsUrl, type NextEvent } from '@/lib/next-event';
import { SERVICE_FEE_LABEL } from '@/lib/pricing';
import { getIgHandle, igUrl } from '@/lib/site';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Preguntas frecuentes',
  description:
    'Cómo comprar tu entrada, cómo pagar, qué llevar el día de la fiesta y la barra: lo que más nos preguntan.',
};

export const revalidate = 300;

type Group = { id: string; title: string; items: { q: string; a: React.ReactNode }[] };

// accounts: "Mi cuenta" prendida en /admin/config. Apagada, no se habla de cuentas.
function faq(event: NextEvent, ig: { handle: string; href: string }, accounts: boolean): Group[] {
  const instagram = (
    <a href={ig.href} target="_blank" rel="noreferrer">
      Instagram ({ig.handle})
    </a>
  );
  const where = event.locationName ? (
    <a href={mapsUrl(event.locationName, event.locationUrl)} target="_blank" rel="noopener noreferrer">
      {event.locationName}
      <span className="sr-only"> (abre Google Maps)</span>
    </a>
  ) : null;
  // El formato es del evento (Open air, Indoor): "al aire libre" va solo si lo es.
  const openAir = /open air|aire libre/i.test(event.format ?? '');

  return [
    {
      id: 'entradas',
      title: 'Entradas',
      items: [
        {
          q: '¿Cómo compro?',
          a: (
            <p>
              En <Link href="/entradas">Entradas</Link>: elegís la tanda y cuántas entradas querés, completás los datos
              de cada una (nombre, cédula y email; tu celular es opcional) y pagás. Si te pide una contraseña o un
              código, lo pasamos por {instagram}.
            </p>
          ),
        },
        {
          q: '¿Puedo comprar para otra persona?',
          a: (
            <p>
              Sí: en la misma compra podés sumar entradas para tus amigos. Cada entrada es personal, con el nombre,
              la cédula y el email de quien la usa, y a cada uno le llega la suya a su mail. Pagás todas juntas.
            </p>
          ),
        },
        {
          q: '¿La puedo transferir o revender?',
          a: (
            <p>
              No. Es nominativa e intransferible: en puerta tiene que coincidir con tu cédula. Una entrada comprada a
              otra persona no te hace entrar.
            </p>
          ),
        },
        {
          q: '¿Por qué me piden la cédula?',
          a: (
            <p>
              Porque en puerta la cotejamos. Hay una lista con los nombres, escaneamos tu QR y miramos tu cédula
              física: si no coincide, no se entra. Por eso también hay una sola entrada por cédula y por email en
              cada fecha.
            </p>
          ),
        },
        {
          q: 'No tengo cédula uruguaya.',
          a: (
            <>
              {/* A CONFIRMAR: si se aceptan pasaporte u otros documentos (la compra web valida cédula uruguaya). */}
              <p>La compra web pide cédula uruguaya. Si tenés otro documento, escribinos por {instagram} y lo vemos.</p>
            </>
          ),
        },
        {
          q: '¿Hay edad mínima?',
          a: (
            <>
              {/* A CONFIRMAR: edad mínima de ingreso. */}
              <p>Sí, es para mayores de 18. En puerta te pedimos la cédula igual.</p>
            </>
          ),
        },
        {
          q: '¿Qué son las tandas?',
          a: (
            <p>
              Las entradas salen por tandas, cada una con su precio y su cantidad. En{' '}
              <Link href="/entradas">Entradas</Link> ves cuáles están disponibles, cuáles ya son sold out y cuáles
              vienen después: esas aparecen como «Próximamente», con el día y la hora en que salen a la venta. Ya ves
              su precio, pero se pueden comprar recién desde ese momento.
            </p>
          ),
        },
        {
          q: '¿Cómo es mi entrada?',
          a: (
            <p>
              Un QR personal que te llega por mail y que también ves en el link de tu entrada. Desde ahí la guardás
              como imagen o PDF. Vale una sola vez: cuando entrás, queda usada. No la publiques.
            </p>
          ),
        },
        {
          q: 'No me llegó el mail.',
          a: (
            <>
              <p>
                Revisá spam y promociones.
                {accounts && (
                  <>
                    {' '}Si creaste cuenta, la tenés en <Link href="/cuenta">Mi cuenta</Link>.
                  </>
                )}
              </p>
              <p>
                Si pagaste por transferencia, primero te llega «Recibimos tu comprobante» y la entrada recién cuando la
                validamos. ¿Nada de nada? Escribinos por {instagram} con el nombre y el email con los que compraste.
              </p>
            </>
          ),
        },
        {
          q: 'Me equivoqué en un dato.',
          a: <p>Escribinos por {instagram} antes de la fiesta y lo corregimos.</p>,
        },
        {
          q: '¿Puedo pedir la devolución?',
          a: (
            <>
              {/* A CONFIRMAR: política de devoluciones (ver /terminos, sección "Arrepentimiento y devoluciones"). */}
              <p>
                Tenés 5 días hábiles desde que compraste para arrepentirte, siempre antes de que empiece la fiesta.
                Después no hay devoluciones, salvo que se cancele o cambie la fecha. El detalle está en los{' '}
                <Link href="/terminos#devoluciones">Términos</Link>.
              </p>
            </>
          ),
        },
      ],
    },
    {
      id: 'pago',
      title: 'Pago',
      items: [
        {
          q: '¿Cómo puedo pagar?',
          a: (
            <p>
              Con transferencia bancaria (sin cargo por servicio) o con Mercado Pago (con un cargo por servicio del{' '}
              {SERVICE_FEE_LABEL}). Según la fecha, puede estar habilitado uno solo de los dos.
            </p>
          ),
        },
        {
          q: '¿Cómo funciona la transferencia?',
          a: (
            <>
              {/* A CONFIRMAR: cuánto tarda en validarse una transferencia. */}
              <p>
                Elegís «Transferencia bancaria», ves los datos de la cuenta y el total exacto, transferís y subís el
                comprobante (foto, captura o PDF). Tu lugar queda reservado mientras lo validamos.
              </p>
              <p>
                La revisamos a mano, en general en el día, y te llega la entrada por mail. No tiene cargo por servicio.
              </p>
            </>
          ),
        },
        {
          q: '¿Y con Mercado Pago?',
          a: (
            <>
              <p>
                Pagás con tarjeta de crédito o débito, saldo de Mercado Pago, o en efectivo en Abitab o RedPagos. Al ir
                a pagar, tu lugar queda reservado 20 minutos.
              </p>
              <p>
                Si pagás en efectivo, la entrada se confirma cuando Mercado Pago acredita el pago. Si Mercado Pago te
                ofrece cuotas con interés, ese interés lo pagás vos.
              </p>
            </>
          ),
        },
        {
          q: '¿Por qué hay un cargo por servicio?',
          a: (
            <p>
              Cubre la comisión de Mercado Pago. Es el {SERVICE_FEE_LABEL} de todo lo que pagás por Mercado Pago: la
              entrada (ya con el descuento, si tenés un código) y el transporte, si lo sumás. Lo ves en pesos, separado,
              antes de pagar. Con transferencia no hay cargo por servicio.
            </p>
          ),
        },
        {
          q: 'Tengo un código de descuento.',
          a: (
            <p>
              Escribilo en el formulario y tocá «Aplicar»: ves el precio final antes de pagar. Vale para cualquier tanda
              y con los dos medios de pago. Es uno por compra, y puede tener usos limitados o vencimiento.
            </p>
          ),
        },
        {
          q: 'Me rechazaron la transferencia.',
          a: (
            <>
              {/* A CONFIRMAR: cómo y en qué plazo se devuelve una transferencia rechazada si la plata llegó. */}
              <p>
                Te llega un mail avisando y el lugar se libera. Pasa si el monto no coincide con el total, si el
                comprobante no se lee o si no encontramos la transferencia en la cuenta. Escribinos por {instagram}: si
                la plata llegó, te la devolvemos.
              </p>
            </>
          ),
        },
      ],
    },
    {
      id: 'el-dia',
      title: 'El día de la fiesta',
      items: [
        {
          q: '¿Dónde y a qué hora?',
          a: (
            <>
              {/* A CONFIRMAR: horario de cierre de la fiesta. */}
              {event.id ? (
                <p>
                  La próxima es el {event.weekday} {event.dateLong}
                  {where ? <>, en {where}</> : null}. Es {event.format?.toLowerCase()} y arranca a las{' '}
                  {event.time}. Sigue hasta la madrugada.
                </p>
              ) : (
                <p>La próxima fecha está a confirmar: la anunciamos por {instagram}, con el lugar y el horario.</p>
              )}
              {event.id && !where && <p>El lugar lo anunciamos por {instagram}.</p>}
            </>
          ),
        },
        {
          q: '¿Qué tengo que llevar?',
          a: (
            <p>
              Tu cédula física (no sirve una foto) y tu entrada en el celu: el link, la imagen o el PDF.
              {openAir && ' Es al aire libre: calzado cómodo y algo de abrigo por si refresca.'}
            </p>
          ),
        },
        {
          q: '¿Cómo es el ingreso?',
          a: (
            <p>
              Por lista. Mostrás tu QR, cotejamos tu nombre con tu cédula y te ponemos un precinto. Tené todo a mano y
              la fila avanza rápido.
            </p>
          ),
        },
        {
          q: '¿Hasta qué hora puedo llegar?',
          a: (
            <>
              {/* A CONFIRMAR: horario de cierre de puerta. */}
              <p>
                Vení temprano: en algún momento de la noche cerramos la puerta y desde ahí no entra nadie, aunque tenga
                entrada.
              </p>
            </>
          ),
        },
        {
          q: '¿Venden entradas en puerta?',
          a: <p>No. Se compran solo por la web, antes de la fiesta.</p>,
        },
        {
          q: '¿Hay ropería?',
          a: <p>Sí. El ticket de ropería se compra en la barra.</p>,
        },
        {
          q: '¿Hay transporte?',
          a: (
            <>
              {/* A CONFIRMAR: quién opera el bus. */}
              <p>
                Sí. Al comprar tu entrada, antes de pagar, podés sumar tu lugar en el bus de ida y vuelta. Ahí ves el
                horario, el punto de salida, el precio y los lugares que quedan.
              </p>
              <p>El bus se suma al total de tu compra y lo ves en tu entrada y en el mail. Los lugares son limitados.</p>
            </>
          ),
        },
        {
          q: '¿Y si llueve?',
          a: (
            <>
              {/* A CONFIRMAR: plan por lluvia o mal clima. */}
              <p>
                Si el clima obliga a cambiar algo, te avisamos por mail y por {instagram}. Si hubiera que pasar la
                fecha, tu entrada sigue valiendo (más en los <Link href="/terminos#cancelacion">Términos</Link>).
              </p>
            </>
          ),
        },
      ],
    },
    {
      id: 'barra',
      title: 'Barra',
      items: [
        {
          q: '¿Cómo compro tragos?',
          a: (
            <p>
              En <Link href="/barra">Barra</Link>, antes o durante la fiesta, y pagás con Mercado Pago. El precio que
              ves es el final, sin cargo por servicio. Te llega un QR por cada trago: si pedís tres, son tres QR.
              {accounts && ' No hace falta cuenta, alcanza con tu email.'}
            </p>
          ),
        },
        {
          q: '¿Cómo lo retiro?',
          a: (
            <p>
              Mostrás el QR en la barra, lo escanean y te dan el trago. Cada QR vale un trago, una sola vez, y solo en
              la fiesta para la que lo compraste.
            </p>
          ),
        },
        {
          q: '¿Venden alcohol a menores?',
          a: <p>No. Solo a mayores de 18.</p>,
        },
      ],
    },
    {
      id: 'cuenta',
      title: 'Cuenta',
      items: [
        {
          q: '¿Necesito una cuenta?',
          a: (
            <p>
              No, es opcional. Si la creás, guarda tus datos para la próxima compra y tenés tus entradas juntas en{' '}
              <Link href="/cuenta">Mi cuenta</Link>.
            </p>
          ),
        },
        {
          q: '¿Cómo la creo?',
          a: <p>Al comprar: elegís una contraseña y la cuenta queda con el email de esa compra.</p>,
        },
        {
          q: 'No veo todas mis entradas.',
          a: (
            <p>
              Confirmá tu email con el link que te mandamos. Hasta entonces ves solo las que compraste con la cuenta;
              después aparecen también las demás a tu email, como las invitaciones.
            </p>
          ),
        },
        {
          q: 'Me olvidé la contraseña.',
          a: (
            <p>
              En <Link href="/cuenta/ingresar">Ingresar</Link>, tocá «¿Te olvidaste la contraseña?» y te llega un link
              por mail.
            </p>
          ),
        },
        {
          q: '¿Puedo borrar mi cuenta?',
          a: (
            <p>
              Sí. Escribinos por {instagram} y la borramos junto con tus datos, salvo lo que tengamos que guardar por
              ley. Más en <Link href="/privacidad">Privacidad</Link>.
            </p>
          ),
        },
      ],
    },
  ];
}

function Question({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group border-b border-bone/10">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-5 rounded-sm py-5 text-base font-medium leading-snug md:text-[17px] [&::-webkit-details-marker]:hidden">
        <span>{q}</span>
        <Plus
          size={18}
          strokeWidth={1.75}
          aria-hidden
          className="mt-0.5 shrink-0 text-bone/45 transition-transform duration-200 group-open:rotate-45 group-open:text-violet"
        />
      </summary>
      <div className={cn(proseClass, 'pb-6 pr-8 md:text-[15px]')}>{children}</div>
    </details>
  );
}

export default async function FaqPage() {
  const [event, handle, accounts] = await Promise.all([getNextEvent(), getIgHandle(), isAccountsEnabled()]);
  const href = igUrl(handle);
  const groups = faq(event, { handle, href }, accounts).filter((g) => accounts || g.id !== 'cuenta');

  return (
    <LegalPage
      current="/preguntas-frecuentes"
      eyebrow="Ayuda"
      title="Preguntas frecuentes"
      intro="Lo que más nos preguntan, corto y al pie. Si no encontrás lo tuyo, escribinos."
      toc={groups.map((g) => ({ id: g.id, label: g.title }))}
      igHandle={handle}
    >
      <div className="space-y-14">
        {groups.map((group) => (
          <section key={group.id} id={group.id} aria-labelledby={`${group.id}-titulo`} className="scroll-mt-6">
            <h2 id={`${group.id}-titulo`} className="text-2xl font-bold tracking-[-0.02em] md:text-3xl">
              {group.title}
            </h2>
            <div className="mt-4 border-t border-bone/15">
              {group.items.map((item) => (
                <Question key={item.q} q={item.q}>
                  {item.a}
                </Question>
              ))}
            </div>
          </section>
        ))}

        <aside className="rounded-card border border-bone/15 bg-ink/50 p-6 md:p-8">
          <p className="text-xl font-bold tracking-[-0.015em]">¿Te quedó alguna duda?</p>
          <p className="mt-2 text-[15px] leading-relaxed text-bone/70">
            Escribinos por Instagram y te respondemos ahí.
          </p>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: 'outline', className: 'mt-5' })}
          >
            {handle}
          </a>
        </aside>
      </div>
    </LegalPage>
  );
}
