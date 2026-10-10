import { formatTime } from '../core/time.js';

/**
 * @param {HTMLVideoElement} video
 * @returns {string} PNG data URL of the current frame at native resolution
 */
export function captureFrame(video) {
  const canvas = Object.assign(document.createElement('canvas'), {
    width: video.videoWidth,
    height: video.videoHeight,
  });
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

export function frameFileName(title, seconds) {
  const base = title.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60) || 'frame';
  return `${base}_${formatTime(seconds).replaceAll(':', '-')}.png`;
}
