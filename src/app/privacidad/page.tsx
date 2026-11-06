import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalSection } from '@/components/legal/legal-page';
import { isAccountsEnabled } from '@/lib/customers';
import { getIgHandle, igUrl } from '@/lib/site';

// A CONFIRMAR: texto pendiente de revisión de un abogado (ver docs/BACKLOG.md).

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description:
    'Qué datos pide House Mates, para qué los usa, dónde se guardan y cómo ejercer tus derechos según la Ley 18.331 de Protección de Datos Personales.',
};

export const revalidate = 3600;

const UPDATED = { iso: '2026-10-28', label: '28 de octubre de 2026' };

const COOKIES = [
  {
    name: 'hm_access',
    what: 'Recuerda que pusiste la contraseña de compra, cuando la compra la pide.',
    lasts: '24 horas, o hasta que cambie la contraseña.',
  },
  {
    name: 'sb-…',
    what: 'Mantiene tu sesión si entraste a tu cuenta.',
    lasts: 'Mientras tengas la sesión iniciada.',
  },
];

export default async function PrivacyPage() {
  // Con "Mi cuenta" apagada (/admin/config) no se habla de cuentas.
  const [handle, accounts] = await Promise.all([getIgHandle(), isAccountsEnabled()]);
  const instagram = (
    <a href={igUrl(handle)} target="_blank" rel="noreferrer">
      Instagram ({handle})
    </a>
  );

  const sections: { id: string; title: string; body: React.ReactNode }[] = [
    {
      id: 'responsable',
      title: 'Quién es responsable',
      body: (
        <>
          {/* A CONFIRMAR: razón social, RUT y domicilio del responsable, e inscripción de la base de datos ante la URCDP. */}
          <p>
            Los datos que nos das los trata House Mates, organizadora de la fiesta. Esta política sigue la Ley 18.331 de
            Protección de Datos Personales y su decreto reglamentario (414/009).
          </p>
          <p>Para cualquier consulta sobre tus datos, escribinos por {instagram}.</p>
        </>
      ),
    },
    {
      id: 'datos',
      title: 'Qué datos pedimos',
      body: (
        <ul>
          <li>
            <strong>Para comprar una entrada:</strong> nombre y apellido, cédula, email y, si querés, celular. Si te
            cargamos la entrada a mano, podemos anotar tu usuario de Instagram.
          </li>
          <li>
            <strong>Si pagás por transferencia:</strong> el comprobante que subís, que puede mostrar tu nombre, tu banco
            y tu cuenta.
          </li>
          <li>
            <strong>Si pagás con Mercado Pago:</strong> el pago lo procesa Mercado Pago. Nosotros recibimos el número de
            operación, el estado y el monto; nunca vemos tu tarjeta.
          </li>
          {accounts && (
            <li>
              <strong>Si creás una cuenta:</strong> tu email, tu contraseña (la guarda cifrada nuestro proveedor y
              nosotros no la vemos) y los datos de compra, para precargarte el formulario.
            </li>
          )}
          {/* A CONFIRMAR: quién opera el bus y qué datos de la lista de pasajeros recibe. */}
          <li>
            <strong>Si sumás transporte:</strong> qué bus elegiste. Para la lista de pasajeros usamos tu nombre, tu
            cédula y tu celular, si lo dejaste.
          </li>
          <li>
            <strong>Si comprás en la barra:</strong> tu email, tu nombre si lo ponés, y tu pedido.
          </li>
          <li>
            <strong>En la puerta:</strong> a qué hora entraste y el resultado de cada escaneo de tu QR.
          </li>
          <li>
            <strong>Si respondés la encuesta:</strong> tu puntaje, tu comentario y si volverías (ver «La encuesta»,
            más abajo).
          </li>
          <li>
            <strong>Registros técnicos:</strong> los mails que te mandamos y datos mínimos de conexión, como la
            dirección IP, que guardan nuestros proveedores por seguridad.
          </li>
        </ul>
      ),
    },
    {
      id: 'para-que',
      title: 'Para qué los usamos',
      body: (
        <>
          <ul>
            <li>Emitir tu entrada y mandártela por mail.</li>
            <li>
              Controlar que haya una entrada por persona y cotejar tu identidad en la puerta: para eso es la cédula.
            </li>
            <li>Cobrar, validar transferencias y hacer devoluciones.</li>
            <li>Avisarte cambios sobre la fiesta, como fecha, lugar o cancelación.</li>
            <li>{accounts ? 'Manejar tu cuenta, tus pedidos de barra y tu lugar en el bus.' : 'Manejar tus pedidos de barra y tu lugar en el bus.'}</li>
            <li>
              Mandarte los mails que explicamos en «Los mails que te mandamos»: el recordatorio antes de la fiesta, la
              encuesta del día después y la preventa de la próxima fecha si tuviste entrada para una anterior.
            </li>
            <li>Prevenir fraudes y cumplir con la ley.</li>
          </ul>
          {/* A CONFIRMAR (abogado): base legal del mail de preventa a quienes compraron antes (art. 21 de la Ley
              18.331) y si hace falta pedir el consentimiento aparte al comprar. */}
          <p>
            Los usamos con tu consentimiento, que das al comprar, y porque los necesitamos para cumplir con tu compra.
            No vendemos ni alquilamos tus datos, y no le pasamos tu email a nadie para que te mande publicidad. Fuera de
            los mails que explicamos abajo, no te mandamos novedades sin pedirte permiso antes.
          </p>
        </>
      ),
    },
    {
      id: 'mails',
      title: 'Los mails que te mandamos',
      body: (
        <>
          {/* A CONFIRMAR (abogado): estos mails, sus destinatarios y la forma de darse de baja. */}
          <p>
            Además de los mails de tu compra (tu entrada, el aviso de que recibimos tu comprobante o de que se anuló una
            entrada){accounts && ' y los de tu cuenta'}, te podemos mandar estos:
          </p>
          <ul>
            <li>
              <strong>Encuesta.</strong> El día después, si entraste a la fiesta: un link para contarnos cómo estuvo.
              Usamos tu nombre, tu email y el registro de que entraste.
            </li>
            <li>
              <strong>Preventa.</strong> Si tuviste entrada para una fecha anterior, te podemos mandar el link para
              comprar en preventa la próxima. Usamos tu nombre, tu email y el registro de esa entrada. No se lo mandamos
              a quien ya tiene entrada para la próxima fecha.
            </li>
          </ul>
          <p>
            <strong>Para no recibir más la preventa:</strong> respondé ese mail o escribinos por {instagram} y te
            sacamos de la lista. Lo dice también al pie de cada mail de preventa. El recordatorio y la encuesta te
            llegan solo por la fiesta para la que tuviste entrada.
          </p>
        </>
      ),
    },
    {
      id: 'encuesta',
      title: 'La encuesta',
      body: (
        <>
          {/* A CONFIRMAR (abogado): plazo de conservación de las respuestas. */}
          <p>
            Es opcional. Si la respondés, guardamos tu puntaje del 1 al 5, lo que escribas en «¿Qué mejorarías?» (si
            escribís algo) y si volverías a la próxima.
          </p>
          <p>
            La respuesta queda asociada a tu entrada, así podés cambiarla si volvés a abrir el link. El equipo
            organizador ve los resultados juntos (promedio y puntajes) y los comentarios sin tu nombre. La usamos solo
            para mejorar la fiesta. No hace falta que pongas datos personales en el comentario.
          </p>
        </>
      ),
    },
    {
      id: 'quien-los-ve',
      title: 'Quién los ve',
      body: (
        <>
          <ul>
            <li>
              El equipo organizador y el staff de puerta, que ve tu nombre y tu cédula para cotejarla con tu documento.
            </li>
            <li>
              Si sumaste transporte, quien maneja el bus, que recibe la lista de pasajeros con tu nombre, tu cédula y tu
              celular.
            </li>
            <li>
              La página de tu entrada muestra solo los últimos 4 dígitos de tu cédula, porque cualquiera con el link la
              puede abrir.
            </li>
            <li>
              Los proveedores que nos dan el servicio, que usan los datos solo para eso: Supabase (base de datos y
              archivos), Vercel (alojamiento del sitio), Mercado Pago (pagos), Google (envío de mails) y Fontshare (la
              tipografía del sitio: tu navegador la descarga de sus servidores, que reciben tu dirección IP).
            </li>
            <li>Las autoridades, solo cuando la ley lo exige.</li>
          </ul>
          {/* A CONFIRMAR: transferencia internacional de datos (art. 23 de la Ley 18.331): país de cada proveedor y
              garantías (adecuación o cláusulas contractuales). */}
          <p>
            Algunos de esos proveedores guardan datos fuera de Uruguay: por ejemplo, la base de datos está en servidores
            en San Pablo, Brasil.
          </p>
        </>
      ),
    },
    {
      id: 'seguridad',
      title: 'Dónde y cómo se guardan',
      body: (
        <ul>
          <li>En una base de datos de acceso restringido: solo nuestro servidor la consulta, nadie desde afuera.</li>
          <li>
            Los comprobantes de transferencia van a un almacenamiento <strong>privado</strong>. Solo los organizadores
            los abren, con links que vencen a los 10 minutos.
          </li>
          <li>Todo viaja cifrado (HTTPS).</li>
          <li>Ningún sistema es infalible: si pasa algo que afecte tus datos, te avisamos.</li>
        </ul>
      ),
    },
    {
      id: 'plazos',
      title: 'Cuánto tiempo los guardamos',
      body: (
        <>
          {/* A CONFIRMAR: plazos de conservación (datos de compra, comprobantes, registros de puerta y cuentas). */}
          <p>
            Los datos de tu compra, mientras los necesitemos para la fiesta y lo que pida la ley (por ejemplo, registros
            contables). Los comprobantes de transferencia, hasta un año después de la fiesta.
            {accounts && ' Tu cuenta, hasta que nos pidas borrarla.'}
          </p>
        </>
      ),
    },
    {
      id: 'derechos',
      title: 'Tus derechos',
      body: (
        <>
          <ul>
            <li>
              <strong>Acceso:</strong> saber qué datos tuyos tenemos. Es gratis, cada seis meses, o antes si hay un
              motivo legítimo.
            </li>
            <li>
              <strong>Rectificación y actualización:</strong> corregir lo que esté mal o haya cambiado.
            </li>
            <li>
              <strong>Supresión:</strong> que borremos tus datos, salvo los que tengamos que guardar por ley. Si tenés
              una entrada para una fecha próxima, borrarlos implica anularla: sin tu cédula no podemos cotejarte en la
              puerta.
            </li>
            <li>
              <strong>Retirar tu consentimiento</strong> cuando quieras. Vale de ahí en adelante.
            </li>
          </ul>
          <p>Te respondemos dentro de los 5 días hábiles, como marca la ley.</p>
        </>
      ),
    },
    {
      id: 'como-pedirlos',
      title: 'Cómo pedirlos',
      body: (
        <>
          {/* A CONFIRMAR: sumar un email de contacto para pedidos de datos personales. */}
          <p>
            Escribinos por {instagram} con tu nombre y el email con el que compraste. Para cuidarte, te podemos pedir
            que confirmes que sos vos antes de darte o cambiar información.
          </p>
          <p>
            Si no te respondemos o no estás de acuerdo con la respuesta, podés reclamar ante la Unidad Reguladora y de
            Control de Datos Personales (URCDP) o iniciar una acción de habeas data.
          </p>
        </>
      ),
    },
    {
      id: 'cookies',
      title: 'Cookies',
      body: (
        <>
          <p>Usamos solo las cookies que el sitio necesita para funcionar:</p>
          <dl className="divide-y divide-bone/10 rounded-card border border-bone/15 bg-ink/40">
            {COOKIES.filter((c) => accounts || c.name !== 'sb-…').map((c) => (
              <div key={c.name} className="grid gap-1 px-4 py-4 sm:grid-cols-[8rem_1fr] sm:gap-4">
                <dt className="font-mono text-[13px] text-bone">{c.name}</dt>
                <dd>
                  {c.what} <span className="text-bone/50">{c.lasts}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p>
            No usamos cookies de publicidad ni de analítica de terceros. Cuando pagás, Mercado Pago usa las suyas en su
            propia página.
          </p>
        </>
      ),
    },
    {
      id: 'menores',
      title: 'Menores de edad',
      body: (
        <>
          {/* A CONFIRMAR: edad mínima de ingreso. */}
          <p>
            La fiesta es para mayores de 18. No pedimos datos de menores a sabiendas; si nos enteramos de que tenemos
            alguno, lo borramos.
          </p>
        </>
      ),
    },
    {
      id: 'fotos',
      title: 'Fotos y video',
      body: (
        <>
          {/* A CONFIRMAR: uso de fotos y videos tomados en la fiesta. */}
          <p>
            En la fiesta se sacan fotos y videos que pueden publicarse en nuestras redes. Tu imagen también es un dato
            personal: si no querés aparecer, decíselo a quien saca las fotos o escribinos y la bajamos.
          </p>
        </>
      ),
    },
    {
      id: 'cambios',
      title: 'Cambios a esta política',
      body: (
        <p>
          Si la cambiamos, actualizamos la fecha de arriba; si el cambio es importante, te avisamos por mail. Las
          condiciones de compra están en los <Link href="/terminos">Términos</Link>.
        </p>
      ),
    },
  ];

  return (
    <LegalPage
      current="/privacidad"
      eyebrow="Legal"
      title="Política de privacidad"
      intro="Pedimos lo justo para que entres a la fiesta, lo cuidamos y no lo vendemos."
      updated={UPDATED}
      toc={sections.map((s) => ({ id: s.id, label: s.title }))}
      igHandle={handle}
    >
      {sections.map((s, i) => (
        <LegalSection key={s.id} id={s.id} number={i + 1} title={s.title}>
          {s.body}
        </LegalSection>
      ))}
    </LegalPage>
  );
}
