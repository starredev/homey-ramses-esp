import { basePath } from '@/lib/shared';

/** An image from public/ with a light and a dark variant. */
export function ThemedImage({ light, dark, alt, className }: { light: string; dark: string; alt: string; className?: string }) {
  return (
    <span className={`not-prose my-6 block overflow-hidden rounded-xl border bg-fd-card ${className ?? ''}`}>
      <img src={`${basePath}${light}`} alt={alt} className="block w-full dark:hidden" />
      <img src={`${basePath}${dark}`} alt={alt} className="hidden w-full dark:block" />
    </span>
  );
}
