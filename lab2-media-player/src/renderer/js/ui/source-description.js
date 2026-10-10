import { STREAM_TYPE, getExtension, getStreamType } from '../../../shared/formats.js';

const STREAM_LABELS = { [STREAM_TYPE.HLS]: 'HLS', [STREAM_TYPE.DASH]: 'MPEG-DASH' };
const ORIGIN_LABELS = { url: 'Network', file: 'Local file' };

/** @param {{ title: string, url: string, streamType?: string }} source */
export function formatLabel({ title, url, streamType = getStreamType(url) }) {
  return STREAM_LABELS[streamType] ?? (getExtension(title) || getExtension(url)).toUpperCase();
}

/** @param {{ title: string, url: string, origin: string, streamType?: string }} item */
export function describeItem(item) {
  return [formatLabel(item), ORIGIN_LABELS[item.origin]].filter(Boolean).join(' · ');
}

/**
 * Technical summary of the current source, e.g. "MP4 · 1920×1080 · Local file".
 * @param {import('../core/player.js').Player} player
 */
export function describeSource(player) {
  const { source } = player;
  const { width, height } = player.videoSize;
  const parts = [
    formatLabel(source),
    player.hasVideo ? `${width}×${height}` : player.hasMetadata ? 'Audio' : null,
    player.isLive ? 'Live' : null,
    ORIGIN_LABELS[source.origin],
  ];
  return parts.filter(Boolean).join(' · ');
}
