import { normalizeMediaUrl } from '../../../shared/formats.js';

/**
 * Two-step URL validation: an instant syntax check in the renderer, then a
 * network probe in the main process (reachability, HTTP status, Content-Type).
 * @param {{ probeMediaUrl(url: string): Promise<{ ok: boolean, url?: string, streamType?: string, error?: string }> }} desktop
 */
export function createUrlValidator(desktop) {
  return async (input) => {
    const syntax = normalizeMediaUrl(input);
    return syntax.ok ? desktop.probeMediaUrl(syntax.url) : syntax;
  };
}
