'use client';

import { useState } from 'react';
import { Check, Link2 } from 'lucide-react';

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      aria-label="Copiar link de la entrada"
      className="flex h-9 w-9 items-center justify-center rounded-control text-bone/55 hover:bg-bone/5 hover:text-bone"
    >
      {copied ? <Check size={15} aria-hidden /> : <Link2 size={15} aria-hidden />}
    </button>
  );
}
