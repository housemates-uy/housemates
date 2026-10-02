import { Logo } from '@/components/ui/logo';

export default function Loading() {
  return (
    <div role="status" aria-label="Cargando" className="flex min-h-[100dvh] items-center justify-center">
      <Logo className="h-16 animate-pulse" title="Cargando" />
    </div>
  );
}
