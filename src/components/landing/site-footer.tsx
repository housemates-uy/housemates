import Image from 'next/image';

export function SiteFooter({ igHandle, igHref }: { igHandle: string; igHref: string }) {
  return (
    <footer className="border-t border-bone/10">
      <div className="mx-auto flex max-w-page flex-col gap-8 px-5 py-12 md:flex-row md:items-end md:justify-between md:px-10">
        <Image
          src="/brand/lockup-horizontal.webp"
          alt="House Mates, est. 2023"
          width={1600}
          height={480}
          className="h-auto w-56 md:w-72"
        />
        <div className="flex flex-col gap-2 text-sm text-bone/50 md:items-end">
          <a
            href={igHref}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-bone transition-colors hover:text-bone/70"
          >
            Instagram {igHandle}
          </a>
          <p>Montevideo, Uruguay · © {new Date().getFullYear()}</p>
        </div>
      </div>
    </footer>
  );
}
