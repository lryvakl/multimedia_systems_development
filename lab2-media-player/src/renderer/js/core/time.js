/** `m:ss` or `h:mm:ss`; unknown/live durations give `--:--`. */
export function formatTime(totalSeconds, { forceHours = false } = {}) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '--:--';
  const whole = Math.floor(totalSeconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const seconds = whole % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0 || forceHours) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  }
  return `${minutes}:${ss}`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function positionToTime(offsetX, width, duration) {
  if (!Number.isFinite(duration) || duration <= 0 || width <= 0) return 0;
  return clamp(offsetX / width, 0, 1) * duration;
}

/** End of the buffered range containing `currentTime` (TimeRanges-like input). */
export function bufferedEnd(buffered, currentTime) {
  for (let i = 0; i < buffered.length; i += 1) {
    if (buffered.start(i) <= currentTime + 0.5 && currentTime <= buffered.end(i)) {
      return buffered.end(i);
    }
  }
  return currentTime;
}
