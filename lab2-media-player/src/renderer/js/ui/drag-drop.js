import { isSubtitleFile, isSupportedMediaFile } from '../../../shared/formats.js';

/**
 * Accepts dropped media files, subtitle files and links (e.g. dragged from a browser).
 * @param {HTMLElement} target
 * @param {{
 *   onMediaFiles: (files: File[]) => void,
 *   onSubtitleFile: (file: File) => void,
 *   onUrl: (url: string) => void,
 *   onUnsupported: (names: string[]) => void,
 * }} handlers
 */
export function bindDragAndDrop(target, handlers) {
  let depth = 0;
  const setDragging = (isDragging) => target.classList.toggle('app--dragging', isDragging);

  target.addEventListener('dragenter', (event) => {
    event.preventDefault();
    depth += 1;
    setDragging(true);
  });
  target.addEventListener('dragover', (event) => event.preventDefault());
  target.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (depth === 0) setDragging(false);
  });
  target.addEventListener('drop', (event) => {
    event.preventDefault();
    depth = 0;
    setDragging(false);
    dispatchDrop(event.dataTransfer, handlers);
  });
}

function dispatchDrop(dataTransfer, { onMediaFiles, onSubtitleFile, onUrl, onUnsupported }) {
  const files = [...dataTransfer.files];
  if (files.length === 0) {
    const url = dataTransfer.getData('text/uri-list').split('\n').find((line) => line && !line.startsWith('#'));
    if (url) onUrl(url.trim());
    return;
  }
  const media = files.filter((file) => isSupportedMediaFile(file.name));
  const subtitle = files.find((file) => isSubtitleFile(file.name));
  const unsupported = files.filter((file) => file !== subtitle && !media.includes(file));
  if (media.length > 0) onMediaFiles(media);
  if (subtitle) onSubtitleFile(subtitle);
  if (unsupported.length > 0) onUnsupported(unsupported.map((file) => file.name));
}
