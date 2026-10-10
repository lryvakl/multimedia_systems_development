export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'oga', 'opus', 'flac', 'm4a', 'aac'];
export const VIDEO_EXTENSIONS = ['mp4', 'm4v', 'webm', 'ogv', 'mov', 'mkv'];
export const SUBTITLE_EXTENSIONS = ['vtt', 'srt'];

const STREAM_EXTENSIONS = { m3u8: 'hls', mpd: 'dash' };

export const MEDIA_KIND = Object.freeze({ AUDIO: 'audio', VIDEO: 'video', UNKNOWN: 'unknown' });
export const STREAM_TYPE = Object.freeze({ PROGRESSIVE: 'progressive', HLS: 'hls', DASH: 'dash' });

export function getExtension(nameOrUrl) {
  if (!nameOrUrl) return '';
  let pathname = String(nameOrUrl);
  try {
    pathname = new URL(pathname).pathname;
  } catch {
    pathname = pathname.split(/[?#]/)[0];
  }
  const lastSegment = pathname.split(/[\\/]/).pop() || '';
  const dot = lastSegment.lastIndexOf('.');
  return dot === -1 ? '' : lastSegment.slice(dot + 1).toLowerCase();
}

export function getMediaKind(nameOrUrl) {
  const ext = getExtension(nameOrUrl);
  if (AUDIO_EXTENSIONS.includes(ext)) return MEDIA_KIND.AUDIO;
  if (VIDEO_EXTENSIONS.includes(ext) || ext in STREAM_EXTENSIONS) return MEDIA_KIND.VIDEO;
  return MEDIA_KIND.UNKNOWN;
}

export function getStreamType(url) {
  return STREAM_EXTENSIONS[getExtension(url)] ?? STREAM_TYPE.PROGRESSIVE;
}

export function isSupportedMediaFile(name) {
  return getMediaKind(name) !== MEDIA_KIND.UNKNOWN && !(getExtension(name) in STREAM_EXTENSIONS);
}

export function isSubtitleFile(name) {
  return SUBTITLE_EXTENSIONS.includes(getExtension(name));
}

/** Accepts http(s) only; a missing scheme defaults to https. */
export function normalizeMediaUrl(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: false, error: 'Enter a URL' };
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, error: 'Invalid URL' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Only http:// and https:// URLs are supported' };
  }
  if (!parsed.hostname) return { ok: false, error: 'Invalid URL' };
  return { ok: true, url: parsed.href };
}

export function titleFromUrl(url) {
  try {
    const parsed = new URL(url);
    const segment = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '');
    return segment || parsed.hostname;
  } catch {
    return String(url);
  }
}

const HLS_MIME_TYPES = ['application/vnd.apple.mpegurl', 'application/x-mpegurl', 'audio/mpegurl', 'audio/x-mpegurl'];
const DASH_MIME_TYPES = ['application/dash+xml'];
const GENERIC_MEDIA_MIME_TYPES = ['application/octet-stream', 'binary/octet-stream', 'application/mp4', 'application/ogg'];

function describeHttpStatus(status) {
  if (status === 404 || status === 410) return `The file was not found on the server (HTTP ${status})`;
  if (status === 401 || status === 403) return `Access to the file is denied (HTTP ${status})`;
  if (status >= 500) return `The server failed to respond correctly (HTTP ${status})`;
  return `The server responded with HTTP ${status}`;
}

/**
 * Decides whether a probed URL can be played, based on the HTTP status and
 * Content-Type, and detects HLS/DASH manifests served without a telling extension.
 * @param {{ url: string, status: number, contentType?: string | null }} response
 * @returns {{ ok: true, streamType: string } | { ok: false, error: string }}
 */
export function evaluateProbeResponse({ url, status, contentType }) {
  if (status < 200 || status >= 300) return { ok: false, error: describeHttpStatus(status) };

  const mime = String(contentType ?? '').split(';')[0].trim().toLowerCase();
  const streamTypeFromUrl = getStreamType(url);
  if (HLS_MIME_TYPES.includes(mime)) return { ok: true, streamType: STREAM_TYPE.HLS };
  if (DASH_MIME_TYPES.includes(mime)) return { ok: true, streamType: STREAM_TYPE.DASH };

  const isMediaMime = mime.startsWith('audio/') || mime.startsWith('video/');
  const isUnspecified = !mime || GENERIC_MEDIA_MIME_TYPES.includes(mime);
  const isManifestUrl = streamTypeFromUrl !== STREAM_TYPE.PROGRESSIVE;
  if (isMediaMime || isUnspecified || isManifestUrl) return { ok: true, streamType: streamTypeFromUrl };

  if (mime === 'text/html') return { ok: false, error: 'The link points to a web page, not to a media file' };
  return { ok: false, error: `The link is not a media file (server reports "${mime}")` };
}
