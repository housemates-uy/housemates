'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PrintButton() {
  return (
    <Button size="sm" onClick={() => window.print()}>
      <Printer size={14} strokeWidth={1.5} aria-hidden />
      Imprimir
    </Button>
  );
}
