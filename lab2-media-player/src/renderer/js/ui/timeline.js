import { bufferedEnd, formatTime, positionToTime } from '../core/time.js';

const KEYBOARD_STEP_SECONDS = 5;
const LIVE_LABEL = 'LIVE';

const percent = (value, total) => (total > 0 ? `${(value / total) * 100}%` : '0%');

/** Seekable progress bar with buffered range, hover preview and keyboard support. */
export class Timeline {
  /**
   * @param {import('../core/player.js').Player} player
   * @param {{ bar: HTMLElement, tooltip: HTMLElement, currentTime: HTMLElement, duration: HTMLElement }} elements
   */
  constructor(player, elements) {
    this.player = player;
    this.elements = elements;
    this.dragTime = null;
    this.bindPlayer();
    this.bindPointer();
    this.bindKeyboard();
    this.render();
  }

  bindPlayer() {
    const render = () => this.render();
    for (const type of ['timeupdate', 'durationchange', 'progress', 'seeked', 'sourcechange', 'loadedmetadata']) {
      this.player.addEventListener(type, render);
    }
  }

  bindPointer() {
    const { bar } = this.elements;

    bar.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || !this.player.canSeek) return;
      bar.setPointerCapture(event.pointerId);
      bar.classList.add('progress--dragging');
      this.dragTime = this.timeAt(event);
      this.render();
    });

    bar.addEventListener('pointermove', (event) => {
      this.showTooltip(event);
      if (this.dragTime === null) return;
      this.dragTime = this.timeAt(event);
      this.render();
    });

    const finishDrag = () => {
      if (this.dragTime === null) return;
      this.player.seek(this.dragTime);
      this.dragTime = null;
      bar.classList.remove('progress--dragging');
    };
    bar.addEventListener('pointerup', finishDrag);
    bar.addEventListener('pointercancel', finishDrag);
  }

  bindKeyboard() {
    const actions = {
      ArrowRight: () => this.player.skip(KEYBOARD_STEP_SECONDS),
      ArrowLeft: () => this.player.skip(-KEYBOARD_STEP_SECONDS),
      Home: () => this.player.seek(0),
      End: () => this.player.seek(this.player.duration),
    };
    this.elements.bar.addEventListener('keydown', (event) => {
      const action = actions[event.key];
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      action();
    });
  }

  timeAt(event) {
    const rect = this.elements.bar.getBoundingClientRect();
    return positionToTime(event.clientX - rect.left, rect.width, this.player.duration);
  }

  showTooltip(event) {
    const { bar, tooltip } = this.elements;
    const time = this.timeAt(event);
    bar.style.setProperty('--hover', percent(time, this.player.duration));
    tooltip.textContent = formatTime(time);
  }

  render() {
    const { player } = this;
    const { bar, currentTime, duration } = this.elements;
    const total = player.duration;
    const position = this.dragTime ?? player.currentTime;
    const forceHours = total >= 3600;

    bar.classList.toggle('progress--disabled', !player.canSeek);
    bar.style.setProperty('--played', percent(position, total));
    bar.style.setProperty('--buffered', percent(bufferedEnd(player.bufferedRanges, position), total));
    bar.setAttribute('aria-valuemax', String(Number.isFinite(total) ? Math.floor(total) : 0));
    bar.setAttribute('aria-valuenow', String(Math.floor(position)));
    bar.setAttribute('aria-valuetext', `${formatTime(position)} of ${formatTime(total)}`);

    currentTime.textContent = player.isLive ? '' : formatTime(player.source ? position : 0, { forceHours });
    duration.textContent = player.isLive ? LIVE_LABEL : formatTime(player.source ? total : 0);
    duration.classList.toggle('timeline__time--live', player.isLive);
  }
}
