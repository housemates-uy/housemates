'use client';

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Confirm = { title: string; body?: string; label: string };

type ActionItem = {
  action: () => Promise<unknown>;
  confirm?: Confirm;
  danger?: boolean;
  // Aviso al terminar bien, si el cambio no se ve en la fila (p. ej. "Mail reenviado").
  done?: string;
};

export type ContextMenuItem = { label: string; hint?: string } & (
  | { href: string; newTab?: boolean }
  | { copy: string; done: string }
  // Abre el <details id=…> de la fila (la edición en el lugar) y pone el foco en su primer campo.
  | { reveal: string }
  | { onSelect: () => void }
  | ActionItem
);

type Anchor = { x: number; y: number } | { rect: DOMRect };

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE = 10;
const EDGE = 8;
const FIELD = 'input, textarea, select, [contenteditable="true"]';

const MenuContext = createContext<{
  open: boolean;
  menuId: string;
  label: string;
  buttonRef: RefObject<HTMLButtonElement>;
  toggle: () => void;
} | null>(null);

const isField = (target: EventTarget | null) => target instanceof Element && !!target.closest(FIELD);

function errorOf(result: unknown): string | null {
  if (result && typeof result === 'object' && 'error' in result && typeof result.error === 'string') {
    return result.error || null;
  }
  return null;
}

// Menú propio de una fila del admin: clic derecho, mantener apretado en el celular, Shift+F10 o
// la tecla de menú, y el botón "⋯" (ContextMenuButton) que va dentro de la fila. Sin ítems (p. ej.
// el staff, que no puede hacer nada en esa lista) la fila queda como siempre.
export function ContextMenu({
  items,
  label,
  as = 'div',
  className,
  children,
}: {
  items: ContextMenuItem[];
  label: string;
  as?: 'div' | 'li';
  className?: string;
  children: ReactNode;
}) {
  if (items.length === 0) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }
  return (
    <MenuArea items={items} label={label} as={as} className={className}>
      {children}
    </MenuArea>
  );
}

export function ContextMenuButton({ className }: { className?: string }) {
  const ctx = useContext(MenuContext);
  if (!ctx) return null;
  return (
    <button
      ref={ctx.buttonRef}
      type="button"
      onClick={ctx.toggle}
      aria-haspopup="menu"
      aria-expanded={ctx.open}
      aria-controls={ctx.open ? ctx.menuId : undefined}
      aria-label={ctx.label}
      className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-bone/60 transition-colors hover:bg-bone/5 hover:text-bone aria-expanded:bg-bone/10 aria-expanded:text-bone sm:h-9 sm:w-9',
        className,
      )}
    >
      <MoreHorizontal size={18} strokeWidth={1.5} aria-hidden />
    </button>
  );
}

function MenuArea({
  items,
  label,
  as: Tag,
  className,
  children,
}: {
  items: ContextMenuItem[];
  label: string;
  as: 'div' | 'li';
  className?: string;
  children: ReactNode;
}) {
  const menuId = useId();
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [confirming, setConfirming] = useState<(ActionItem & { confirm: Confirm }) | null>(null);
  const [dialogError, setDialogError] = useState('');
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const areaRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const press = useRef<{ x: number; y: number; timer: number } | null>(null);
  // Después de mantener apretado, el navegador puede mandar un clic al soltar: no tiene que
  // abrir el link de la fila.
  const swallowClick = useRef(false);

  function openAt(next: Anchor) {
    const active = document.activeElement;
    returnFocus.current =
      active instanceof HTMLElement && areaRef.current?.contains(active) ? active : buttonRef.current;
    setAnchor(next);
  }

  function close(restore: boolean) {
    setAnchor(null);
    if (restore) returnFocus.current?.focus({ preventScroll: true });
  }

  function clearPress() {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  }

  // Ubica el menú dentro de la pantalla (abajo del punto o del botón; arriba si no entra) y
  // pone el foco en el primer ítem.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!anchor || !menu) return;
    const { width, height } = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left: number;
    let top: number;
    if ('rect' in anchor) {
      left = anchor.rect.right - width;
      top = anchor.rect.bottom + 4;
      if (top + height > vh - EDGE) top = anchor.rect.top - height - 4;
    } else {
      // Corrido unos px del dedo o del puntero: al soltar, el clic no cae sobre un ítem.
      left = anchor.x + 2;
      top = anchor.y + 2;
      if (top + height > vh - EDGE) top = anchor.y - height - 2;
    }
    menu.style.left = `${Math.min(Math.max(EDGE, left), vw - width - EDGE)}px`;
    menu.style.top = `${Math.min(Math.max(EDGE, top), vh - height - EDGE)}px`;
    menu.style.visibility = 'visible';
    menu.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
  }, [anchor]);

  useEffect(() => {
    if (!anchor) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setAnchor(null);
    };
    const dismiss = () => setAnchor(null);
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    window.addEventListener('blur', dismiss);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('blur', dismiss);
    };
  }, [anchor]);

  useLayoutEffect(() => {
    if (confirming) dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
  }, [confirming]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), toast.error ? 7000 : 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  function run(item: ActionItem, inDialog: boolean) {
    startTransition(async () => {
      let error: string | null;
      try {
        error = errorOf(await item.action());
      } catch {
        error = 'No se pudo hacer. Probá de nuevo.';
      }
      if (inDialog) {
        if (error) {
          setDialogError(error);
          return;
        }
        setConfirming(null);
        returnFocus.current?.focus({ preventScroll: true });
      } else if (error) {
        setToast({ text: error, error: true });
      }
      if (!error && item.done) setToast({ text: item.done });
    });
  }

  function select(item: ContextMenuItem) {
    if ('href' in item) {
      setAnchor(null);
      return;
    }
    close(!('reveal' in item));
    if ('copy' in item) {
      navigator.clipboard.writeText(item.copy).then(
        () => setToast({ text: item.done }),
        () => setToast({ text: 'No se pudo copiar.', error: true }),
      );
    } else if ('reveal' in item) {
      const target = document.getElementById(item.reveal);
      if (target instanceof HTMLDetailsElement) target.open = true;
      target?.scrollIntoView({ block: 'nearest' });
      target?.querySelector<HTMLElement>(FIELD)?.focus({ preventScroll: true });
    } else if ('onSelect' in item) {
      item.onSelect();
    } else if (item.confirm) {
      setDialogError('');
      setConfirming({ ...item, confirm: item.confirm });
    } else {
      run(item, false);
    }
  }

  function onMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const entries = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const i = entries.indexOf(document.activeElement as HTMLElement);
    const focusAt = (n: number) => entries[(n + entries.length) % entries.length]?.focus();
    if (e.key === 'ArrowDown') focusAt(i + 1);
    else if (e.key === 'ArrowUp') focusAt(i - 1);
    else if (e.key === 'Home') focusAt(0);
    else if (e.key === 'End') focusAt(entries.length - 1);
    else if (e.key === 'Escape' || e.key === 'Tab') close(true);
    else return;
    e.preventDefault();
  }

  function cancelDialog() {
    if (pending) return;
    setConfirming(null);
    returnFocus.current?.focus({ preventScroll: true });
  }

  function onDialogKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelDialog();
    } else if (e.key === 'Tab') {
      // El foco queda entre los dos botones mientras el diálogo está abierto.
      const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled)'));
      const i = buttons.indexOf(document.activeElement as HTMLElement);
      e.preventDefault();
      buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
    }
  }

  const hasSelectionInside = () => {
    const selection = window.getSelection();
    return !!selection && !selection.isCollapsed && !!areaRef.current?.contains(selection.anchorNode);
  };

  const itemClass = (danger?: boolean) =>
    cn(
      'flex min-h-11 w-full flex-col items-start justify-center gap-0.5 px-3.5 py-2 text-left text-sm outline-none transition-colors hover:bg-bone/[0.07] focus:bg-bone/[0.09] sm:min-h-10',
      danger ? 'text-alert' : 'text-bone/90',
    );

  const content = (item: ContextMenuItem) => (
    <>
      <span>{item.label}</span>
      {item.hint && <span className="text-xs leading-snug text-bone/50">{item.hint}</span>}
    </>
  );

  const Area = Tag as 'div';

  return (
    <MenuContext.Provider
      value={{
        open: !!anchor,
        menuId,
        label,
        buttonRef,
        toggle: () => {
          if (anchor) close(true);
          else if (buttonRef.current) openAt({ rect: buttonRef.current.getBoundingClientRect() });
        },
      }}
    >
      <Area
        ref={areaRef as RefObject<HTMLDivElement>}
        aria-busy={pending || undefined}
        className={cn(
          // En el celular, mantener apretado abre el menú en vez de seleccionar texto; los campos
          // de una edición dentro de la fila se siguen pudiendo usar.
          '[-webkit-touch-callout:none] [@media(pointer:coarse)]:select-none [&_input]:select-text [&_textarea]:select-text',
          pending && 'opacity-60 transition-opacity',
          className,
        )}
        onContextMenu={(e) => {
          if (isField(e.target) || hasSelectionInside()) return;
          e.preventDefault();
          // Ya abierto: por el teclado (que también dispara este evento) o por mantener apretado.
          if (anchor || swallowClick.current) return;
          clearPress();
          // Shift+F10 en algunos navegadores llega solo como este evento, sin coordenadas.
          if (e.clientX === 0 && e.clientY === 0 && e.target instanceof Element) {
            openAt({ rect: e.target.getBoundingClientRect() });
          } else {
            openAt({ x: e.clientX, y: e.clientY });
          }
        }}
        onKeyDown={(e) => {
          if ((e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) && !isField(e.target)) {
            e.preventDefault();
            openAt({ rect: (e.target as Element).getBoundingClientRect() });
          }
        }}
        onPointerDown={(e) => {
          swallowClick.current = false;
          if (e.pointerType === 'mouse' || isField(e.target)) return;
          clearPress();
          const { clientX: x, clientY: y } = e;
          press.current = {
            x,
            y,
            timer: window.setTimeout(() => {
              press.current = null;
              swallowClick.current = true;
              window.getSelection()?.removeAllRanges();
              openAt({ x, y });
            }, LONG_PRESS_MS),
          };
        }}
        onPointerMove={(e) => {
          const p = press.current;
          if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_TOLERANCE) clearPress();
        }}
        onPointerUp={clearPress}
        onPointerCancel={clearPress}
        onClickCapture={(e) => {
          if (!swallowClick.current) return;
          swallowClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {children}
      </Area>

      {anchor &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKeyDown}
            onContextMenu={(e) => e.preventDefault()}
            style={{ position: 'fixed', left: 0, top: 0, visibility: 'hidden' }}
            className="z-50 w-max min-w-[13rem] max-w-[min(20rem,calc(100vw-16px))] overflow-hidden rounded-control border border-bone/15 bg-ink py-1 shadow-[0_16px_48px_rgba(0,0,0,0.65)]"
          >
            {items.map((item, i) => {
              const danger = 'action' in item && item.danger;
              const separated = danger && i > 0 ? 'mt-1 border-t border-bone/10 pt-1' : undefined;
              if ('href' in item) {
                return item.newTab ? (
                  <a
                    key={item.label}
                    role="menuitem"
                    tabIndex={-1}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => select(item)}
                    className={itemClass()}
                  >
                    {content(item)}
                  </a>
                ) : (
                  <Link key={item.label} role="menuitem" tabIndex={-1} href={item.href} onClick={() => select(item)} className={itemClass()}>
                    {content(item)}
                  </Link>
                );
              }
              return (
                <div key={item.label} role="none" className={separated}>
                  <button type="button" role="menuitem" tabIndex={-1} onClick={() => select(item)} className={itemClass(danger)}>
                    {content(item)}
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}

      {confirming &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-ink/75 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"
            onPointerDown={(e) => e.target === e.currentTarget && cancelDialog()}
          >
            <div
              ref={dialogRef}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={`${menuId}-titulo`}
              aria-describedby={confirming.confirm.body ? `${menuId}-detalle` : undefined}
              onKeyDown={onDialogKeyDown}
              className="w-full max-w-sm rounded-card border border-bone/15 bg-ink p-5 shadow-[0_16px_48px_rgba(0,0,0,0.65)]"
            >
              <h2 id={`${menuId}-titulo`} className="text-base font-bold leading-snug tracking-tight">
                {confirming.confirm.title}
              </h2>
              {confirming.confirm.body && (
                <p id={`${menuId}-detalle`} className="mt-2 text-sm leading-relaxed text-bone/60">
                  {confirming.confirm.body}
                </p>
              )}
              {dialogError && (
                <p role="alert" className="mt-3 text-sm text-alert">
                  {dialogError}
                </p>
              )}
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={cancelDialog} disabled={pending}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant={confirming.danger ? 'danger' : 'solid'}
                  onClick={() => run(confirming, true)}
                  disabled={pending}
                  aria-busy={pending}
                >
                  {pending ? 'Un momento...' : confirming.confirm.label}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {toast &&
        createPortal(
          <p
            role={toast.error ? 'alert' : 'status'}
            className={cn(
              'fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-control border bg-ink px-4 py-3 text-sm shadow-[0_16px_48px_rgba(0,0,0,0.65)] md:bottom-6',
              toast.error ? 'border-alert/50 text-bone' : 'border-bone/20 text-bone/90',
            )}
          >
            {toast.text}
          </p>,
          document.body,
        )}
    </MenuContext.Provider>
  );
}
