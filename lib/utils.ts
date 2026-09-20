export function cn(...inputs: (string | false | null | undefined)[]): string {
  return inputs.filter(Boolean).join(" ");
}

/** Base path prefix for public/ assets. Empty during local dev,
 *  "/bhuynh22/gaussian-scene-viewer" (or similar) in production. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefix a public asset path with the deployment base path. */
export function publicUrl(path: string): string {
  return `${BASE_PATH}${path}`;
}
