'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { submitSurveyAction, type SurveyResult } from './actions';

type Answer = { rating: number | null; improve: string; wouldReturn: 'si' | 'no' | null };

const SCALE = [1, 2, 3, 4, 5];

// Radio nativo escondido + cuadro visible: se maneja con teclado (flechas) y lector de
// pantalla como cualquier radio.
function Choice({
  name,
  value,
  checked,
  onChange,
  className,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="relative block cursor-pointer">
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        className={cn(
          'flex items-center justify-center rounded-control border border-bone/25 bg-ink/50 font-bold text-bone transition duration-150',
          'hover:border-bone/60 peer-checked:border-bone peer-checked:bg-bone peer-checked:text-ink',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-bone peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ink',
          className,
        )}
      >
        {children}
      </span>
      {checked && <span aria-hidden className="absolute bottom-2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-violet" />}
    </label>
  );
}

export function SurveyForm({
  token,
  firstName,
  initial,
  answered,
}: {
  token: string;
  firstName: string;
  initial: Answer;
  answered: boolean;
}) {
  const [answer, setAnswer] = useState<Answer>(initial);
  const [done, setDone] = useState(false);
  const [saved, setSaved] = useState(answered);
  const [result, setResult] = useState<SurveyResult | null>(null);
  const [pending, startTransition] = useTransition();
  const error = result && 'error' in result ? result : null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!answer.rating) return setResult({ error: 'Elegí un puntaje del 1 al 5.', field: 'rating' });
    if (!answer.wouldReturn) return setResult({ error: 'Contanos si volverías.', field: 'would_return' });
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await submitSurveyAction(token, data);
      setResult(r);
      if ('ok' in r) {
        setDone(true);
        setSaved(true);
      }
    });
  }

  if (done) {
    return (
      <div role="status" className="mt-12 animate-fade-up motion-reduce:animate-none">
        <p className="text-[2rem] font-bold leading-[1.05] tracking-[-0.03em]">Gracias, {firstName}.</p>
        <p className="mt-3 text-bone/75">Ya tenemos tu respuesta. Nos vemos en la próxima.</p>
        <Button variant="ghost" size="sm" className="-ml-3.5 mt-8" onClick={() => setDone(false)}>
          Cambiar mi respuesta
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-10 space-y-10" noValidate>
      {saved && (
        <p className="rounded-control border border-bone/15 bg-ink/50 px-4 py-3 text-sm text-bone/75">
          Ya respondiste. Si querés, cambiá lo que necesites y guardá de nuevo.
        </p>
      )}

      <fieldset aria-describedby={error?.field === 'rating' ? 'error-encuesta' : undefined}>
        <legend className="text-lg font-medium">Del 1 al 5, ¿cómo la pasaste?</legend>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {SCALE.map((n) => (
            <Choice
              key={n}
              name="rating"
              value={String(n)}
              checked={answer.rating === n}
              onChange={() => setAnswer((a) => ({ ...a, rating: n }))}
              className="aspect-square text-[2rem] tracking-[-0.04em]"
            >
              {n}
            </Choice>
          ))}
        </div>
        <div aria-hidden className="mt-2 flex justify-between text-xs text-bone/55">
          <span>No me gustó</span>
          <span>Increíble</span>
        </div>
      </fieldset>

      <div>
        <label htmlFor="improve" className="text-lg font-medium">
          ¿Qué mejorarías? <span className="text-sm font-normal text-bone/50">Opcional</span>
        </label>
        <Textarea
          id="improve"
          name="improve"
          rows={4}
          maxLength={1000}
          value={answer.improve}
          onChange={(e) => setAnswer((a) => ({ ...a, improve: e.target.value }))}
          placeholder="La música, la barra, la entrada, lo que sea."
          className="mt-4 bg-ink/50 text-base"
        />
      </div>

      <fieldset>
        <legend className="text-lg font-medium">¿Volverías a la próxima?</legend>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(['si', 'no'] as const).map((v) => (
            <Choice
              key={v}
              name="would_return"
              value={v}
              checked={answer.wouldReturn === v}
              onChange={() => setAnswer((a) => ({ ...a, wouldReturn: v }))}
              className="h-16 text-xl"
            >
              {v === 'si' ? 'Sí' : 'No'}
            </Choice>
          ))}
        </div>
      </fieldset>

      <div className="space-y-3">
        {error && (
          <p id="error-encuesta" role="alert" className="text-sm text-alert">
            {error.error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending}>
          {pending ? 'Enviando…' : saved ? 'Guardar cambios' : 'Enviar respuesta'}
        </Button>
      </div>
    </form>
  );
}
