import { DoodleBackdrop } from '@/components/ui/doodle-backdrop';
import { Reveal } from '@/components/ui/reveal';

const RULES = [
  'El ingreso es por lista.',
  'Al llegar presentá tu CI y se te coloca un precinto.',
  'No se venden entradas en puerta.',
  'La ubicación exacta se comparte el día del evento.',
  'Hay ropería: el ticket se compra en barra.',
];

export function Rules() {
  return (
    <section id="reglas" className="relative isolate overflow-hidden border-t border-bone/10">
      <DoodleBackdrop className="-z-10" />
      <div className="mx-auto max-w-page px-5 py-20 md:px-10 md:py-28">
        <Reveal className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold tracking-[-0.02em] md:text-5xl">Cuidemos la casa</h2>
          <span aria-hidden className="mt-6 block h-px w-16 bg-violet" />
          <ol className="mt-8 space-y-5">
            {RULES.map((rule, i) => (
              <li key={rule} className="grid grid-cols-[2.5rem_1fr] items-baseline text-lg md:text-xl">
                <span className="text-sm font-bold text-bone/45">{String(i + 1).padStart(2, '0')}</span>
                <span className="font-medium leading-snug">{rule}</span>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
