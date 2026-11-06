// El Instagram de una persona (`buyer_instagram`, guardado sin @) con link a su perfil, para
// que los owners lo revisen antes de aceptar o para anular una entrada sospechosa.
export function InstagramLink({ handle, className }: { handle: string; className?: string }) {
  return (
    <a
      href={`https://www.instagram.com/${encodeURIComponent(handle)}/`}
      target="_blank"
      rel="noreferrer"
      className={className ?? 'underline decoration-bone/30 underline-offset-2 hover:text-bone hover:decoration-bone'}
    >
      @{handle}
    </a>
  );
}
