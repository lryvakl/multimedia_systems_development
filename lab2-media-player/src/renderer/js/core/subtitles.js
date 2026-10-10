const SRT_TIMESTAMP = /(\d{1,2}:\d{2}:\d{2}),(\d{3})/g;

/** <track> understands WebVTT only; SubRip is converted, WebVTT is returned as is. */
export function srtToVtt(text) {
  const normalized = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (/^WEBVTT/.test(normalized)) return normalized;
  const body = normalized
    .split(/\n{2,}/)
    .map((cue) => cue.trim())
    .filter(Boolean)
    .map((cue) => {
      const lines = cue.split('\n');
      if (/^\d+$/.test(lines[0]) && lines[1]?.includes('-->')) lines.shift();
      if (lines[0]) lines[0] = lines[0].replace(SRT_TIMESTAMP, '$1.$2');
      return lines.join('\n');
    })
    .join('\n\n');
  return `WEBVTT\n\n${body}\n`;
}
