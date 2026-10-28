'use client';

import { Download, FileText } from 'lucide-react';

// Guardar la entrada: imagen (PNG formato historia) o PDF (diálogo de impresión del
// navegador → "Guardar como PDF"). Los estilos `print:` de la página la dejan en blanco
// y negro en una sola hoja.
export function SaveButtons({ token }: { token: string }) {
  const btn =
    'flex h-10 items-center justify-center gap-2 rounded-control border border-bone/25 px-4 text-sm text-bone/85 transition-colors hover:border-bone hover:text-bone';
  return (
    <div className="flex shrink-0 gap-2 print:hidden">
      <a href={`/ticket/${token}/imagen`} download className={btn}>
        <Download size={16} strokeWidth={1.5} aria-hidden />
        Guardar imagen
      </a>
      <button type="button" onClick={() => window.print()} className={btn}>
        <FileText size={16} strokeWidth={1.5} aria-hidden />
        Guardar PDF
      </button>
    </div>
  );
}
