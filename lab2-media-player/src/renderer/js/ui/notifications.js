import { createElement } from './dom.js';

const TOAST_DURATION_MS = 4000;
const TOAST_FADE_MS = 300;
const OSD_DURATION_MS = 900;

export class Toasts {
  /** @param {HTMLElement} container */
  constructor(container) {
    this.container = container;
  }

  /** @param {'info'|'success'|'error'} [type] */
  show(message, type = 'info') {
    const toast = createElement('div', { className: `toast toast--${type}`, text: message, attrs: { role: 'status' } });
    this.container.append(toast);
    setTimeout(() => {
      toast.classList.add('toast--leaving');
      setTimeout(() => toast.remove(), TOAST_FADE_MS);
    }, TOAST_DURATION_MS);
  }

  error(message) {
    this.show(message, 'error');
  }

  success(message) {
    this.show(message, 'success');
  }
}

/** Short on-screen feedback for hotkey actions (volume, seek, speed). */
export class OnScreenDisplay {
  /** @param {HTMLElement} element */
  constructor(element) {
    this.element = element;
    this.timer = 0;
  }

  show(text) {
    this.element.textContent = text;
    this.element.classList.add('osd--visible');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.element.classList.remove('osd--visible'), OSD_DURATION_MS);
  }
}
