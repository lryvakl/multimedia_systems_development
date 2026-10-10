const IDLE_TIMEOUT_MS = 2500;

/** Fullscreen for the player area, with auto-hiding controls while the pointer is idle. */
export class FullscreenController extends EventTarget {
  /** @param {HTMLElement} element */
  constructor(element) {
    super();
    this.element = element;
    this.idleTimer = 0;
    document.addEventListener('fullscreenchange', () => {
      this.markActive();
      this.dispatchEvent(new Event('change'));
    });
    element.addEventListener('pointermove', () => this.markActive());
  }

  get isActive() {
    return document.fullscreenElement === this.element;
  }

  toggle() {
    return this.isActive ? document.exitFullscreen() : this.element.requestFullscreen();
  }

  markActive() {
    this.element.classList.remove('player--idle');
    clearTimeout(this.idleTimer);
    if (!this.isActive) return;
    this.idleTimer = setTimeout(() => this.element.classList.add('player--idle'), IDLE_TIMEOUT_MS);
  }
}
