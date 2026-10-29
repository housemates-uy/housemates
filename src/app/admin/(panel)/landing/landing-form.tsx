'use client';

import { useRef, useState } from 'react';
import { useFormState } from 'react-dom';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { SubmitButton } from '@/components/admin/submit-button';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { LANDING_LIMITS, type LandingContent } from '@/lib/landing';
import { saveLandingAction, type LandingFormState } from './actions';

type Rule = { id: number; text: string };

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        <p className="mt-1 max-w-[60ch] text-sm text-bone/55">{hint}</p>
      </div>
      {children}
    </section>
  );
}

export function LandingForm({ values, igHandle, saved }: { values: LandingContent; igHandle: string; saved: boolean }) {
  const [state, action] = useFormState<LandingFormState, FormData>(saveLandingAction, null);
  // "Guardado." se va apenas se toca algo, para que no parezca guardado lo que todavía no lo está.
  const [dirty, setDirty] = useState(false);
  const nextId = useRef(values.rules.length);
  const [rules, setRules] = useState<Rule[]>(() => values.rules.map((text, id) => ({ id, text })));
  const [focusId, setFocusId] = useState<number | null>(null);
  const fieldError = (name: string) => (state?.field === name ? state.error : undefined);

  function updateRules(next: Rule[]) {
    setRules(next);
    setDirty(true);
  }

  function move(i: number, delta: -1 | 1) {
    const next = [...rules];
    [next[i], next[i + delta]] = [next[i + delta], next[i]];
    updateRules(next);
  }

  function addRule() {
    const id = nextId.current++;
    setFocusId(id);
    updateRules([...rules, { id, text: '' }]);
  }

  return (
    <form action={action} onChange={() => setDirty(true)} className="space-y-12">
      <Section
        title="Portada"
        hint="Lo primero que se ve. La fecha, la hora y el formato salen del próximo evento; la foto de fondo se cambia en «Fotos y videos»."
      >
        <Field label="Título" error={fieldError('hero_title')}>
          <Input name="hero_title" required maxLength={LANDING_LIMITS.heroTitle} defaultValue={values.heroTitle} />
        </Field>
      </Section>

      <Section
        title="La casa"
        hint="El texto al lado de las fotos. Las fotos y los videos se cambian en «Fotos y videos»: tocá el que quieras cambiar y elegí otro archivo."
      >
        <Field label="Título" error={fieldError('house_title')}>
          <Input name="house_title" required maxLength={LANDING_LIMITS.houseTitle} defaultValue={values.houseTitle} />
        </Field>
        <Field label="Texto" hint="Con un renglón vacío se arma otro párrafo." error={fieldError('house_text')}>
          <Textarea
            name="house_text"
            rows={5}
            required
            maxLength={LANDING_LIMITS.houseText}
            defaultValue={values.houseText}
          />
        </Field>
        <Field
          label="Créditos de fotos y video (opcional)"
          hint="Va debajo de las fotos. Vacío, no se muestra."
          error={fieldError('house_credits')}
        >
          <Input name="house_credits" maxLength={LANDING_LIMITS.houseCredits} defaultValue={values.houseCredits} />
        </Field>
      </Section>

      <Section title="Reglas" hint="Se muestran numeradas, en este orden.">
        <Field label="Título" error={fieldError('rules_title')}>
          <Input name="rules_title" required maxLength={LANDING_LIMITS.rulesTitle} defaultValue={values.rulesTitle} />
        </Field>
        <div className="space-y-3">
          <ol aria-label="Reglas" className="space-y-2">
            {rules.map((rule, i) => (
              <li key={rule.id} className="flex items-start gap-1.5">
                <span aria-hidden className="mt-3.5 w-7 shrink-0 text-xs font-bold tabular-nums text-bone/50">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {/* Textarea para que en el celular se lea la regla entera; un solo renglón (Enter no corta). */}
                <Textarea
                  name="rule"
                  rows={2}
                  required
                  maxLength={LANDING_LIMITS.rule}
                  value={rule.text}
                  autoFocus={rule.id === focusId}
                  aria-label={`Regla ${i + 1}`}
                  onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                  onChange={(e) => updateRules(rules.map((r) => (r.id === rule.id ? { ...r, text: e.target.value } : r)))}
                  className="min-h-11 min-w-0 flex-1 resize-none py-2.5 [field-sizing:content]"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 shrink-0 px-2.5"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  aria-label={`Subir regla ${i + 1}`}
                >
                  <ArrowUp size={14} aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 shrink-0 px-2.5"
                  disabled={i === rules.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={`Bajar regla ${i + 1}`}
                >
                  <ArrowDown size={14} aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 shrink-0 px-2.5"
                  disabled={rules.length === 1}
                  onClick={() => updateRules(rules.filter((r) => r.id !== rule.id))}
                  aria-label={`Sacar regla ${i + 1}`}
                >
                  <X size={14} aria-hidden />
                </Button>
              </li>
            ))}
          </ol>
          {fieldError('rules') && (
            <p role="alert" className="text-xs text-alert">
              {fieldError('rules')}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={rules.length >= LANDING_LIMITS.rules}
            onClick={addRule}
          >
            <Plus size={14} aria-hidden />
            Agregar regla
          </Button>
        </div>
      </Section>

      <Section
        title="Instagram"
        hint="Sale en el menú y el pie de la web, en las páginas de ayuda y en los mails."
      >
        <Field label="Usuario" hint="Con o sin @. También podés pegar el link del perfil." error={fieldError('ig_handle')}>
          <Input
            name="ig_handle"
            required
            maxLength={100}
            defaultValue={igHandle}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </Field>
      </Section>

      <div className="flex flex-wrap items-center gap-4 border-t border-bone/10 pt-6">
        <SubmitButton variant="outline">Guardar</SubmitButton>
        {saved && !dirty && !state && (
          <p role="status" className="text-sm text-bone/75">
            Guardado. La landing ya muestra lo nuevo.
          </p>
        )}
        {state && (
          <p role="alert" className="text-sm text-alert">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
