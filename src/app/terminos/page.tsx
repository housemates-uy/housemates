import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalSection } from '@/components/legal/legal-page';
import { SERVICE_FEE_RATE } from '@/lib/pricing';
import { getIgHandle, igUrl } from '@/lib/site';

// A CONFIRMAR: texto pendiente de revisión de un abogado (ver docs/BACKLOG.md).

export const metadata: Metadata = {
  title: 'Términos y condiciones',
  description:
    'Condiciones de compra de entradas, barra y transporte de House Mates, y política de devoluciones según la Ley 17.250 de Defensa del Consumidor.',
};

export const revalidate = 3600;

const UPDATED = { iso: '2026-10-28', label: '28 de octubre de 2026' };
const FEE = `${(SERVICE_FEE_RATE * 100).toLocaleString('es-UY')} %`;

export default async function TermsPage() {
  const handle = await getIgHandle();
  const instagram = (
    <a href={igUrl(handle)} target="_blank" rel="noreferrer">
      Instagram ({handle})
    </a>
  );

  const sections: { id: string; title: string; body: React.ReactNode }[] = [
    {
      id: 'alcance',
      title: 'Qué cubren',
      body: (
        <>
          {/* A CONFIRMAR: razón social, RUT y domicilio del organizador. */}
          <p>
            House Mates es una fiesta privada que se hace en Uruguay. Estos términos valen para todo lo que comprás en
            este sitio: entradas, tragos de barra y, cuando esté disponible, transporte.
          </p>
          <p>
            Al comprar, confirmás que los leíste y que los aceptás. Para cualquier consulta, escribinos por {instagram}.
          </p>
        </>
      ),
    },
    {
      id: 'entrada',
      title: 'La entrada',
      body: (
        <ul>
          <li>
            Es <strong>personal, nominativa e intransferible</strong>: está a nombre de una persona y asociada a su
            cédula.
          </li>
          <li>
            Hay <strong>una por persona y por fecha</strong>: no puede haber dos entradas para la misma fiesta con la
            misma cédula ni con el mismo email.
          </li>
          <li>Te da derecho a un ingreso a la fiesta y la fecha que figuran en ella.</li>
          <li>
            Los datos que cargás tienen que ser tuyos y verdaderos. Si no coinciden con tu cédula, no se entra y no hay
            devolución.
          </li>
          <li>
            Solo valen las entradas compradas en este sitio o emitidas por nosotros, como las invitaciones. No vendemos
            en puerta ni a través de terceros, y la reventa no está permitida: una entrada comprada a otra persona no
            da ingreso.
          </li>
        </ul>
      ),
    },
    {
      id: 'precio-y-pago',
      title: 'Precio y pago',
      body: (
        <>
          <p>
            Los precios están en pesos uruguayos. Las entradas se venden por tandas, cada una con su precio y su
            cantidad. Antes de pagar ves el total final, desglosado.
          </p>
          <p>
            <strong>Mercado Pago.</strong> Con tarjeta de crédito o débito, saldo de Mercado Pago, o en efectivo en
            Abitab o RedPagos. Se suma un <strong>cargo por servicio del {FEE}</strong> sobre el precio de la entrada (ya
            con el descuento, si hay), que corresponde a la comisión de la plataforma y se muestra en pesos, separado.
            El pago lo procesa Mercado Pago según sus propios términos: nosotros no vemos los datos de tu tarjeta. Si
            elegís cuotas con interés, el interés lo pagás vos. Al ir a pagar, tu lugar queda reservado 20 minutos; si
            el pago no se completa, se libera. Con pago en efectivo, la entrada se confirma cuando Mercado Pago lo
            acredita.
          </p>
          {/* A CONFIRMAR: plazo de validación y forma y plazo de devolución de una transferencia rechazada. */}
          <p>
            <strong>Transferencia bancaria.</strong> No tiene cargo por servicio. Transferís el total exacto a la cuenta
            que te mostramos y subís el comprobante. Tu lugar queda reservado mientras lo validamos. Si no podemos
            validarlo (por ejemplo, porque el monto no coincide o la plata no se acreditó), la compra se anula, el lugar
            se libera y te avisamos por mail. Si la plata llegó, te la devolvemos por transferencia.
          </p>
          <p>
            <strong>Códigos de descuento.</strong> Se usa uno por compra. Pueden tener usos limitados y vencimiento, no
            se cambian por dinero y no dejan la entrada en cero.
          </p>
        </>
      ),
    },
    {
      id: 'confirmacion',
      title: 'Confirmación de la compra',
      body: (
        <>
          <p>
            La entrada es válida recién cuando el pago está aprobado o la transferencia, validada. Ahí te llega por mail
            con tu QR, y también la ves en el link de tu entrada y, si creaste una, en tu cuenta.
          </p>
          <p>Revisá que tu email esté bien escrito: es por donde te mandamos la entrada y cualquier aviso.</p>
          <p>
            Podemos anular una entrada si detectamos datos falsos, compras duplicadas o un pago desconocido ante el
            banco o la tarjeta. Si la anulamos por un error nuestro, te devolvemos todo lo que pagaste.
          </p>
        </>
      ),
    },
    {
      id: 'qr',
      title: 'Tu QR',
      body: (
        <ul>
          <li>
            Cada entrada tiene un QR único. No contiene tus datos: solo vale si existe en nuestro sistema y está
            válido.
          </li>
          <li>
            Sirve para <strong>un solo ingreso</strong>. Cuando confirmamos tu entrada en puerta, queda usada y no se
            puede volver a usar.
          </li>
          <li>
            Cuidalo como una llave: no lo publiques ni lo compartas. Igual, para entrar el QR tiene que coincidir con tu
            cédula.
          </li>
          <li>Un QR copiado, adulterado o de una entrada anulada no da ingreso.</li>
        </ul>
      ),
    },
    {
      id: 'admision',
      title: 'Ingreso y derecho de admisión',
      body: (
        <>
          {/* A CONFIRMAR: edad mínima de ingreso y horario de cierre de puerta. */}
          <ul>
            <li>
              Para entrar necesitás tu <strong>cédula física</strong> y tu QR. El ingreso es por lista: cotejamos tu
              cédula con la entrada y te ponemos un precinto.
            </li>
            <li>
              La fiesta es solo para <strong>mayores de 18 años</strong>.
            </li>
            <li>
              La puerta cierra en un horario determinado de la noche. Después de ese momento no se entra, aunque tengas
              entrada.
            </li>
          </ul>
          <p>
            Nos reservamos el derecho de admisión y permanencia por razones de seguridad o de convivencia: por ejemplo,
            si no presentás tu cédula o no coincide con la entrada, si estás en un estado que pone en riesgo a vos o a
            los demás, si llevás objetos peligrosos o si no respetás las reglas de la casa. Nunca lo ejercemos por
            motivos discriminatorios (Ley 17.817).
          </p>
          <p>Si no te dejamos entrar o te pedimos que te retires por alguna de estas razones, no hay devolución.</p>
        </>
      ),
    },
    {
      id: 'devoluciones',
      title: 'Arrepentimiento y devoluciones',
      body: (
        <>
          {/* A CONFIRMAR (abogado): cómo aplica el art. 16 de la Ley 17.250 a entradas con fecha; acá se opta por
              aceptar el arrepentimiento hasta el inicio de la fiesta, aunque no hayan pasado los 5 días hábiles. */}
          <p>
            <strong>Derecho de arrepentimiento.</strong> Como la compra es a distancia, el artículo 16 de la Ley 17.250
            de Defensa del Consumidor te da <strong>5 días hábiles desde la compra</strong> para arrepentirte, sin dar
            motivos y sin costo.
          </p>
          <p>
            <strong>Con una entrada con fecha.</strong> La entrada es para una noche puntual, así que el arrepentimiento
            vale mientras la fiesta no haya empezado. Si compraste a menos de 5 días hábiles de la fecha, el plazo
            termina a la hora de inicio de la fiesta.
          </p>
          {/* A CONFIRMAR: sumar un email de contacto como segundo canal para pedir el arrepentimiento. */}
          <p>
            <strong>Cómo pedirlo.</strong> Escribinos por {instagram} dentro del plazo, con tu nombre, el email con el
            que compraste y la fecha de la fiesta. Te confirmamos por escrito.
          </p>
          <p>
            <strong>Qué te devolvemos.</strong> Todo lo que pagaste, incluido el cargo por servicio, por el mismo medio:
            si pagaste con Mercado Pago, a través de Mercado Pago (cuándo se acredita depende de tu tarjeta o tu banco);
            si fue por transferencia, a la cuenta que nos indiques. La entrada queda anulada.
          </p>
          {/* A CONFIRMAR: si en casos puntuales se permite cambiar el titular de la entrada o devolver fuera de plazo. */}
          <p>
            <strong>Fuera de ese plazo</strong> no hay devoluciones por no poder ir, por llegar después del cierre de la
            puerta ni por no cumplir las condiciones de ingreso. Si no podés ir, escribinos igual antes de la fiesta y
            vemos tu caso.
          </p>
        </>
      ),
    },
    {
      id: 'cancelacion',
      title: 'Cancelación o cambio de fecha',
      body: (
        <>
          {/* A CONFIRMAR: plazo para devolver si se cancela, plazo para pedir la devolución si se reprograma y plan
              por lluvia. */}
          <ul>
            <li>
              Si <strong>cancelamos la fiesta</strong>, te devolvemos todo lo que pagaste, incluido el cargo por
              servicio, por el mismo medio de pago.
            </li>
            <li>
              Si <strong>cambia la fecha o el lugar</strong>, tu entrada sigue valiendo para la nueva fecha. Si no
              podés ir, podés pedir la devolución total dentro de los 10 días corridos desde que lo anunciamos.
            </li>
            <li>
              Es una fiesta al aire libre: si el clima o una disposición de las autoridades obliga a suspenderla, aplica
              lo mismo, con nueva fecha o devolución.
            </li>
            <li>Los cambios menores, como horarios o line-up, no dan derecho a devolución.</li>
          </ul>
          <p>Cualquier cambio te lo avisamos por mail y por Instagram.</p>
        </>
      ),
    },
    {
      id: 'barra',
      title: 'Barra',
      body: (
        <>
          <ul>
            <li>
              Los tragos se pueden comprar desde la web, antes o durante la fiesta, con Mercado Pago. Por cada trago
              recibís un QR, que se canjea <strong>una sola vez</strong> en la barra y solo en la fiesta para la que lo
              compraste.
            </li>
            <li>El precio es el de la carta al momento de la compra, sin cargo por servicio.</li>
            <li>
              No vendemos ni servimos alcohol a menores de 18 años, y podemos no servirle a quien esté visiblemente
              alcoholizado.
            </li>
            {/* A CONFIRMAR (abogado): arrepentimiento en pedidos de barra, por los QR no canjeados. */}
            <li>
              Podés arrepentirte de un pedido dentro de los 5 días hábiles desde la compra, por los QR que no hayas
              canjeado. Un trago ya entregado no se devuelve.
            </li>
            <li>La ropería se paga aparte, en la barra.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'transporte',
      title: 'Transporte',
      body: (
        <>
          {/* A CONFIRMAR: todo el servicio de transporte (quién lo opera, horarios, puntos de salida, precio, si es
              nominativo y condiciones propias). */}
          <p>
            Lo estamos armando. Cuando esté, vas a poder sumar al final de la compra un lugar en un bus de ida y vuelta.
            Horarios, puntos de salida y precio se informan antes de pagar.
          </p>
          <p>
            Es un servicio aparte de la entrada, con lugares limitados. Si cancelamos la fiesta, también te devolvemos
            el transporte, y podés arrepentirte con las mismas reglas que la entrada.
          </p>
        </>
      ),
    },
    {
      id: 'convivencia',
      title: 'Reglas de la casa',
      body: (
        <>
          <p>
            Cuidá la casa: respetá a la gente, al staff y al lugar. Si causás daños, te hacés responsable de ellos.
          </p>
          {/* A CONFIRMAR: uso de fotos y videos tomados en la fiesta. */}
          <p>
            En la fiesta se sacan fotos y videos que pueden publicarse en nuestras redes. Si no querés aparecer, decíselo
            a quien saca las fotos o escribinos y la bajamos.
          </p>
        </>
      ),
    },
    {
      id: 'datos',
      title: 'Tus datos',
      body: (
        <p>
          Usamos tus datos solo para tu compra, el ingreso y los avisos sobre la fiesta. El detalle está en la{' '}
          <Link href="/privacidad">Política de privacidad</Link>.
        </p>
      ),
    },
    {
      id: 'cambios',
      title: 'Cambios a estos términos',
      body: (
        <p>
          Podemos actualizarlos; la fecha de arriba indica la última versión. A cada compra se le aplican los términos
          vigentes cuando se hizo.
        </p>
      ),
    },
    {
      id: 'ley',
      title: 'Ley aplicable y reclamos',
      body: (
        <>
          <p>
            Estos términos se rigen por las leyes de la República Oriental del Uruguay, en especial la Ley 17.250 de
            Defensa del Consumidor.
          </p>
          <p>
            Si tenés un problema, escribinos primero: lo queremos resolver. También podés hacer tu reclamo ante el Área
            de Defensa del Consumidor del Ministerio de Economía y Finanzas.
          </p>
        </>
      ),
    },
  ];

  return (
    <LegalPage
      current="/terminos"
      eyebrow="Legal"
      title="Términos y condiciones"
      intro="Las reglas de la compra, en claro: qué te llevás, cómo se usa y qué pasa si algo cambia."
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
