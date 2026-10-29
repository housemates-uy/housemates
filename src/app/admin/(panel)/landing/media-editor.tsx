'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ImageUp, Play, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  HOUSE_TILES,
  LANDING_BUCKET,
  MEDIA_ACCEPT,
  MEDIA_LABELS,
  MEDIA_LIMITS,
  MEDIA_TYPES,
  bucketPath,
  isOriginalMedia,
  mediaFileError,
  mediaFileName,
  type LandingMedia,
  type LandingMediaSet,
  type MediaSlot,
} from '@/lib/landing';
import { cn } from '@/lib/utils';
import {
  createLandingUploadAction,
  discardLandingUploadsAction,
  saveLandingMediaAction,
  type MediaActionResult,
} from './media-actions';

// Maqueta de la landing para cambiar fotos y videos: la portada (compu y celular) y la grilla
// de La casa con la misma disposición y proporciones que la de verdad, en chico (las medidas
// van en cqw: proporcionales al ancho de la maqueta). Tocar un lugar abre el panel para
// cambiarlo. El archivo sube directo del navegador a Storage con un link firmado.

const HERO_POSITION: Partial<Record<MediaSlot, string>> = {
  'hero-desktop': 'object-[50%_0%]',
  'hero-mobile': 'object-[50%_40%]',
};

// Vista grande en el panel, con el recorte del lugar en la landing.
const TALL = 'h-[min(46dvh,24rem)]';
const PREVIEW: Record<MediaSlot, string> = {
  'hero-desktop': 'w-full aspect-[16/10]',
  'hero-mobile': cn(TALL, 'aspect-[390/844]'),
  'house-1': 'w-full aspect-[16/9]',
  'house-2': cn(TALL, 'aspect-[2/3]'),
  'house-3': 'w-full aspect-[4/3]',
  'house-4': 'w-full aspect-[4/3]',
  'house-5': 'w-full aspect-[16/9]',
  'house-6': cn(TALL, 'aspect-[2/3]'),
  'house-7': 'w-full aspect-[4/3]',
  'house-8': 'w-full aspect-[4/3]',
  'house-9': 'w-full aspect-[4/3]',
};

const kindLabel = (type: LandingMedia['type']) => (type === 'video' ? 'Video' : 'Foto');
const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString('es-UY', { maximumFractionDigits: 1 })} MB`;

// ------------------------------------------------------------
// Subida directa a Storage
// ------------------------------------------------------------
// uploadToSignedUrl usa fetch, que no avisa cuánto subió: este fetch con XMLHttpRequest sí,
// para la barra de avance.
let reportProgress: ((loaded: number) => void) | null = null;

function fetchWithProgress(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(init?.method ?? 'GET', input instanceof Request ? input.url : String(input));
    new Headers(init?.headers).forEach((value, key) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = (e) => reportProgress?.(e.loaded);
    xhr.onload = () =>
      xhr.status
        ? resolve(
            new Response(xhr.responseText, {
              status: xhr.status,
              headers: { 'Content-Type': xhr.getResponseHeader('Content-Type') ?? 'application/json' },
            }),
          )
        : reject(new TypeError('Failed to fetch'));
    xhr.onerror = () => reject(new TypeError('Failed to fetch'));
    xhr.onabort = () => reject(new TypeError('Failed to fetch'));
    xhr.send((init?.body ?? null) as XMLHttpRequestBodyInit | null);
  });
}

let storageClient: SupabaseClient | null = null;
function landingStorage() {
  storageClient ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchWithProgress },
  });
  return storageClient.storage.from(LANDING_BUCKET);
}

// Algunos sistemas no dicen el tipo (p. ej. .mov en Windows): sale de la extensión.
function fileType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'jpeg') return 'image/jpeg';
  return Object.entries(MEDIA_TYPES).find(([, t]) => t.ext === ext)?.[0] ?? '';
}

function waitFor(target: EventTarget, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 20000);
    target.addEventListener(
      event,
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    target.addEventListener(
      'error',
      () => {
        clearTimeout(timer);
        reject(new Error('error'));
      },
      { once: true },
    );
  });
}

async function readImage(url: string) {
  const img = new window.Image();
  img.src = url;
  await img.decode();
  return { width: img.naturalWidth, height: img.naturalHeight };
}

// Medidas del video y su primer cuadro, como imagen fija para mientras carga.
async function readVideo(url: string) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  await waitFor(video, 'loadeddata');
  const seeked = waitFor(video, 'seeked');
  video.currentTime = Math.min(0.1, (video.duration || 0) / 2);
  await seeked;
  const { videoWidth: width, videoHeight: height } = video;
  if (!width || !height) throw new Error('sin cuadro');
  const scale = Math.min(1, 1600 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
  // Safari no arma webp: devuelve png, que también vale.
  const poster = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
  video.removeAttribute('src');
  video.load();
  if (!poster) throw new Error('sin cuadro');
  return { width, height, poster };
}

function uploadError(message: string): string {
  if (/size|exceeded|too large/i.test(message)) return 'El archivo es demasiado pesado para subirlo.';
  if (/mime|type/i.test(message)) return 'Ese tipo de archivo no se puede subir.';
  return 'No se pudo subir el archivo. Revisá la conexión e intentá de nuevo.';
}

// ------------------------------------------------------------
// Foto o video ocupando su lugar
// ------------------------------------------------------------
function Media({
  media,
  sizes,
  className,
  play,
}: {
  media: { type: LandingMedia['type']; src: string; poster?: string; alt: string };
  sizes: string;
  className?: string;
  play?: boolean;
}) {
  const cover = cn('absolute inset-0 h-full w-full object-cover', className);
  const local = media.src.startsWith('blob:');
  if (media.type === 'video' && (play || local)) {
    return <video src={media.src} poster={media.poster} autoPlay muted loop playsInline aria-label={media.alt} className={cover} />;
  }
  const still = media.type === 'video' ? media.poster : media.src;
  if (!still) return null;
  if (local) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={still} alt={media.alt} className={cover} />;
  }
  return <Image src={still} alt={media.alt} fill sizes={sizes} className={cover} />;
}

function SlotButton({
  slot,
  media,
  sizes,
  className,
  onOpen,
  registerTrigger,
  children,
}: {
  slot: MediaSlot;
  media: LandingMedia;
  sizes: string;
  className?: string;
  onOpen: (slot: MediaSlot) => void;
  registerTrigger: (slot: MediaSlot, el: HTMLButtonElement | null) => void;
  children?: React.ReactNode;
}) {
  const changed = !isOriginalMedia(slot, media);
  return (
    <button
      type="button"
      ref={(el) => registerTrigger(slot, el)}
      onClick={() => onOpen(slot)}
      aria-label={`${MEDIA_LABELS[slot]}: ${kindLabel(media.type).toLowerCase()} ${mediaFileName(media.src)}${changed ? ', cambiada' : ''}. Cambiar`}
      className={cn(
        'group relative block w-full overflow-hidden bg-bone/5 outline-none ring-offset-2 ring-offset-ink transition focus-visible:ring-2 focus-visible:ring-bone',
        className,
      )}
    >
      <Media media={{ ...media, alt: '' }} sizes={sizes} className={HERO_POSITION[slot]} />
      {children}
      {media.type === 'video' && (
        <span aria-hidden className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-ink/70">
          <Play size={8} fill="currentColor" strokeWidth={0} />
        </span>
      )}
      {changed && (
        <span aria-hidden title="Cambiada" className="absolute right-1 top-1 h-2 w-2 rounded-full bg-violet ring-2 ring-ink" />
      )}
      <span
        aria-hidden
        className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-ink/65 text-[11px] font-medium text-bone opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        <ImageUp size={15} strokeWidth={1.5} />
        Cambiar
      </span>
    </button>
  );
}

// El texto de la portada encima de la foto, como en la landing (para ver qué tapa).
function HeroText({ title, phone }: { title: string; phone?: boolean }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      <span className="absolute inset-0 bg-gradient-to-t from-ink via-ink/45 to-ink/10" />
      <span
        className={cn(
          'absolute inset-x-0 bottom-0 flex flex-col items-start text-left',
          phone ? 'px-[5.1cqw] pb-[12.3cqw]' : 'px-[3.1cqw] pb-[5cqw]',
        )}
      >
        <span className={cn('rounded-full bg-bone/60', phone ? 'h-[2.4cqw] w-[45cqw]' : 'h-[0.8cqw] w-[16cqw]')} />
        <span
          className={`max-w-[13ch] font-bold uppercase leading-[0.92] tracking-[-0.03em] text-bone ${
            phone ? 'mt-[4.1cqw] text-[length:11.3cqw]' : 'mt-[1.25cqw] text-[length:6cqw]'
          }`}
        >
          {title}
        </span>
        {phone ? (
          <>
            <span className="mt-[9.2cqw] h-[14.4cqw] w-full rounded-[2.6cqw] bg-bone" />
            <span className="mt-[2cqw] h-[12.3cqw] w-full" />
          </>
        ) : (
          <span className="mt-[2.8cqw] h-[4.4cqw] w-[13cqw] rounded-[0.8cqw] bg-bone" />
        )}
      </span>
    </span>
  );
}

const ALT_ERROR = 'Escribí qué se ve (texto alternativo): lo leen los lectores de pantalla.';

export function MediaEditor({
  media,
  heroTitle,
  houseTitle,
}: {
  media: LandingMediaSet;
  heroTitle: string;
  houseTitle: string;
}) {
  const [open, setOpen] = useState<MediaSlot | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const triggers = useRef(new Map<MediaSlot, HTMLButtonElement>());

  const registerTrigger = useCallback((slot: MediaSlot, el: HTMLButtonElement | null) => {
    if (el) triggers.current.set(slot, el);
  }, []);

  const openSlot = useCallback((slot: MediaSlot) => {
    setNotice(null);
    setOpen(slot);
  }, []);

  const close = useCallback(() => {
    const trigger = open ? triggers.current.get(open) : undefined;
    setOpen(null);
    requestAnimationFrame(() => trigger?.focus());
  }, [open]);

  const saved = useCallback(
    (slot: MediaSlot) => {
      setNotice(`Guardado: ${MEDIA_LABELS[slot]}. La landing ya muestra lo nuevo.`);
      close();
    },
    [close],
  );

  const slotProps = { onOpen: openSlot, registerTrigger };

  return (
    <aside
      aria-labelledby="fotos-y-videos"
      className="space-y-6 rounded-card border border-bone/10 bg-bone/[0.02] p-4 sm:p-5 xl:sticky xl:top-[5.5rem] xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto"
    >
      <div>
        <h2 id="fotos-y-videos" className="text-lg font-bold tracking-tight">
          Fotos y videos
        </h2>
        <p className="mt-1 text-sm text-bone/55">
          Así se ven en la landing. Tocá una foto o un video para cambiarlo por otra foto o por un video.
        </p>
        {notice && (
          <p role="status" className="mt-3 text-sm text-bone/80">
            {notice}
          </p>
        )}
      </div>

      <section aria-label="Portada" className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-label text-bone/50">Portada</h3>
        <div className="flex items-start gap-3">
          <figure className="min-w-0 flex-[1.6]">
            <SlotButton
              slot="hero-desktop"
              media={media['hero-desktop']}
              sizes="(min-width: 1280px) 300px, 70vw"
              className="aspect-[16/10] rounded-chip [container-type:inline-size]"
              {...slotProps}
            >
              <HeroText title={heroTitle} />
            </SlotButton>
            <figcaption className="mt-1.5 text-xs text-bone/50">Compu</figcaption>
          </figure>
          <figure className="min-w-0 flex-[0.462]">
            <SlotButton
              slot="hero-mobile"
              media={media['hero-mobile']}
              sizes="(min-width: 1280px) 100px, 25vw"
              className="aspect-[390/844] rounded-chip [container-type:inline-size]"
              {...slotProps}
            >
              <HeroText title={heroTitle} phone />
            </SlotButton>
            <figcaption className="mt-1.5 text-xs text-bone/50">Celular</figcaption>
          </figure>
        </div>
      </section>

      <section aria-label="La casa" className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-label text-bone/50">La casa</h3>
        {/* Como en la landing: en la compu el texto a la izquierda (5 de 12) y la grilla a la
            derecha; en el celular, uno abajo del otro. */}
        <div className="[container-type:inline-size]">
          <div className="grid grid-cols-12 gap-y-[8cqw] sm:gap-x-[3.3cqw]">
          <div aria-hidden className="col-span-12 self-start sm:col-span-5">
            <p className="text-[length:10cqw] font-bold leading-[1.02] tracking-[-0.02em] sm:text-[length:5cqw]">
              {houseTitle}
            </p>
            <div className="mt-[4cqw] space-y-[2cqw] sm:mt-[2cqw] sm:space-y-[0.9cqw]">
              {[100, 92, 96, 60].map((w) => (
                <span
                  key={w}
                  style={{ width: `${w}%` }}
                  className="block h-[2.2cqw] rounded-full bg-bone/15 sm:h-[0.75cqw]"
                />
              ))}
            </div>
          </div>
          <div className="col-span-12 grid grid-cols-6 gap-[3.4cqw] sm:col-span-7 sm:gap-[1.33cqw]">
            {HOUSE_TILES.map((tile) => (
              <SlotButton
                key={tile.slot}
                slot={tile.slot}
                media={media[tile.slot]}
                sizes="(min-width: 1280px) 240px, 90vw"
                  className={cn('rounded-[4cqw] sm:rounded-[1.2cqw]', tile.className)}
                  {...slotProps}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <p className="text-xs leading-relaxed text-bone/50">
        Fotos JPG, PNG, WebP o AVIF de hasta {MEDIA_LIMITS.imageMb} MB. Videos MP4, WebM o MOV de hasta{' '}
        {MEDIA_LIMITS.videoMb} MB: en la landing se ven sin sonido y en loop. El punto violeta marca lo que
        ya cambiaste.
      </p>

      {open && <MediaDialog key={open} slot={open} media={media[open]} onClose={close} onSaved={saved} />}
    </aside>
  );
}

// ------------------------------------------------------------
// Panel para cambiar un lugar
// ------------------------------------------------------------
type Pending = { file: File; type: LandingMedia['type']; url: string };
type Phase = { step: 'idle' } | { step: 'reading' } | { step: 'uploading'; progress: number } | { step: 'saving' };

function MediaDialog({
  slot,
  media,
  onClose,
  onSaved,
}: {
  slot: MediaSlot;
  media: LandingMedia;
  onClose: () => void;
  onSaved: (slot: MediaSlot) => void;
}) {
  const titleId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const isHero = slot.startsWith('hero');
  const [pending, setPending] = useState<Pending | null>(null);
  const [alt, setAlt] = useState(media.alt);
  const [phase, setPhase] = useState<Phase>({ step: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const busy = phase.step !== 'idle';
  const original = isOriginalMedia(slot, media);
  const cleanAlt = alt.replace(/\s+/g, ' ').trim();
  const dirty = !!pending || cleanAlt !== media.alt;

  useEffect(() => {
    if (!pending) return;
    return () => URL.revokeObjectURL(pending.url);
  }, [pending]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    const type = fileType(picked);
    const problem = mediaFileError(type, picked.size);
    if (problem) {
      setError(problem);
      return;
    }
    const file = picked.type === type ? picked : new File([picked], picked.name, { type });
    setError(null);
    setConfirmRestore(false);
    setPending({ file, type: MEDIA_TYPES[type].type, url: URL.createObjectURL(file) });
    // El texto alternativo describía la foto anterior.
    if (!isHero) setAlt('');
  }

  async function upload(file: Pending): Promise<MediaActionResult> {
    setPhase({ step: 'reading' });
    let size: { width: number; height: number };
    let poster: Blob | undefined;
    try {
      if (file.type === 'video') ({ poster, ...size } = await readVideo(file.url));
      else size = await readImage(file.url);
    } catch {
      return {
        error:
          file.type === 'video'
            ? 'No se pudo leer el video en este navegador. Probá con un MP4.'
            : 'No se pudo leer la foto. Probá con otra (JPG, PNG, WebP o AVIF).',
      };
    }

    const blobs: Blob[] = poster ? [file.file, poster] : [file.file];
    const ticket = await createLandingUploadAction(
      slot,
      blobs.map((b, i) => ({ name: i === 0 ? file.file.name : 'poster', type: b.type, size: b.size })),
    );
    if ('error' in ticket) return ticket;

    const total = blobs.reduce((sum, b) => sum + b.size, 0);
    let done = 0;
    setPhase({ step: 'uploading', progress: 0 });
    try {
      for (const [i, { path, token }] of ticket.uploads.entries()) {
        reportProgress = (loaded) => setPhase({ step: 'uploading', progress: Math.min(1, (done + loaded) / total) });
        const { error } = await landingStorage().uploadToSignedUrl(path, token, blobs[i], { cacheControl: '31536000' });
        if (error) throw error;
        done += blobs[i].size;
      }
    } catch (e) {
      void discardLandingUploadsAction(ticket.uploads.map((u) => u.path));
      return { error: uploadError(e instanceof Error ? e.message : '') };
    } finally {
      reportProgress = null;
    }

    setPhase({ step: 'saving' });
    return saveLandingMediaAction({
      slot,
      alt: cleanAlt,
      upload: { path: ticket.uploads[0].path, posterPath: ticket.uploads[1]?.path, ...size },
    });
  }

  async function run(action: () => Promise<MediaActionResult>) {
    setError(null);
    let result: MediaActionResult;
    try {
      result = await action();
    } catch {
      result = { error: 'Sin conexión con el servidor. Intentá de nuevo.' };
    }
    if ('error' in result) {
      setError(result.error);
      setPhase({ step: 'idle' });
      return;
    }
    onSaved(slot);
  }

  function save() {
    if (!isHero && !cleanAlt) {
      setError(ALT_ERROR);
      return;
    }
    void run(() => {
      if (pending) return upload(pending);
      setPhase({ step: 'saving' });
      return saveLandingMediaAction({ slot, alt: cleanAlt });
    });
  }

  function restore() {
    void run(() => {
      setPhase({ step: 'saving' });
      return saveLandingMediaAction({ slot, restore: true });
    });
  }

  const shown = pending ? { type: pending.type, src: pending.url, alt: cleanAlt } : media;
  const percent = phase.step === 'uploading' ? Math.round(phase.progress * 100) : 0;
  const status =
    phase.step === 'reading'
      ? pending?.type === 'video'
        ? 'Preparando el video…'
        : 'Preparando la foto…'
      : phase.step === 'uploading'
        ? `Subiendo… ${percent}%`
        : phase.step === 'saving'
          ? 'Guardando…'
          : null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-card border border-bone/10 bg-ink shadow-2xl sm:rounded-card"
      >
        <div className="flex items-center justify-between gap-3 border-b border-bone/10 py-2 pl-5 pr-2">
          <h2 id={titleId} className="text-base font-bold tracking-tight">
            {MEDIA_LABELS[slot]}
          </h2>
          <Button ref={closeRef} type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            <X size={16} strokeWidth={1.5} aria-hidden />
            Cerrar
          </Button>
        </div>

        <div className="space-y-5 overflow-y-auto px-5 py-5">
          <div className="flex justify-center">
            <div className={cn('relative max-w-full overflow-hidden rounded-control bg-bone/5', PREVIEW[slot])}>
              <Media media={shown} sizes="(min-width: 640px) 32rem, 100vw" className={HERO_POSITION[slot]} play />
            </div>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
            {pending ? (
              <>
                <p className="min-w-0 break-words text-bone/80">
                  {pending.type === 'video' ? 'Video nuevo' : 'Foto nueva'}: {pending.file.name} ·{' '}
                  {megabytes(pending.file.size)}
                  <span className="block text-xs text-bone/50">Todavía no se guardó.</span>
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setPending(null);
                    setAlt(media.alt);
                    setError(null);
                  }}
                >
                  Descartar
                </Button>
              </>
            ) : (
              <p className="min-w-0 break-words text-bone/70">
                {kindLabel(media.type)} · {mediaFileName(media.src)}
                {original ? <span className="text-bone/45"> · la de siempre</span> : null}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <input ref={fileRef} type="file" accept={MEDIA_ACCEPT} onChange={pick} className="hidden" tabIndex={-1} />
            <Button type="button" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
              <ImageUp size={16} strokeWidth={1.5} aria-hidden />
              Cambiar por una foto o un video
            </Button>
            <p className="text-xs text-bone/55">
              Foto hasta {MEDIA_LIMITS.imageMb} MB o video hasta {MEDIA_LIMITS.videoMb} MB (se ve sin sonido y en
              loop).
            </p>
          </div>

          {!isHero && (
            <Field label="Texto alternativo" hint="Qué se ve, en una frase. Lo leen los lectores de pantalla.">
              <Input
                value={alt}
                maxLength={MEDIA_LIMITS.alt}
                disabled={busy}
                onChange={(e) => {
                  setAlt(e.target.value);
                  if (error === ALT_ERROR) setError(null);
                }}
                placeholder={pending ? 'Describí la foto o el video nuevo' : undefined}
              />
            </Field>
          )}

          {!original && !pending && (
            <div className="border-t border-bone/10 pt-4">
              {confirmRestore ? (
                <div className="space-y-3">
                  <p className="text-sm text-bone/75">
                    {bucketPath(media.src)
                      ? 'Vuelve la de siempre y se borra la que subiste.'
                      : 'Vuelve el texto alternativo de siempre.'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="danger" size="sm" disabled={busy} onClick={restore}>
                      Sí, volver a la original
                    </Button>
                    <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmRestore(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmRestore(true)}>
                  <RotateCcw size={14} strokeWidth={1.5} aria-hidden />
                  Volver a la original
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-bone/10 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          {phase.step === 'uploading' && (
            <div
              role="progressbar"
              aria-label="Avance de la subida"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-1.5 overflow-hidden rounded-full bg-bone/10"
            >
              <div className="h-full rounded-full bg-bone transition-[width] duration-200" style={{ width: `${percent}%` }} />
            </div>
          )}
          {status && (
            <p role="status" className="text-sm text-bone/70">
              {status}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" disabled={busy || !dirty} onClick={save} aria-busy={busy}>
              Guardar
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
