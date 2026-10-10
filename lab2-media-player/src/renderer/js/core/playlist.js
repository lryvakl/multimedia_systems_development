export const REPEAT_MODES = Object.freeze(['off', 'all', 'one']);

let nextId = 1;

export class Playlist extends EventTarget {
  /** @param {{ random?: () => number }} [options] injectable RNG for tests */
  constructor({ random = Math.random } = {}) {
    super();
    this.items = [];
    this.currentIndex = -1;
    this.repeat = 'off';
    this.shuffle = false;
    this.random = random;
    this.order = [];
  }

  get current() {
    return this.items[this.currentIndex] ?? null;
  }

  get length() {
    return this.items.length;
  }

  add(entries) {
    const firstIndex = this.items.length;
    for (const entry of entries) this.items.push({ ...entry, id: nextId++ });
    this.rebuildOrder();
    this.emitChange();
    return firstIndex;
  }

  remove(id) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) return;
    const [removed] = this.items.splice(index, 1);
    removed.dispose?.();
    if (index < this.currentIndex) this.currentIndex -= 1;
    else if (index === this.currentIndex) this.currentIndex = -1;
    this.rebuildOrder();
    this.emitChange();
  }

  clear() {
    for (const item of this.items) item.dispose?.();
    this.items = [];
    this.order = [];
    this.currentIndex = -1;
    this.emitChange();
  }

  select(index) {
    if (index < 0 || index >= this.items.length) return null;
    this.currentIndex = index;
    this.emitChange();
    return this.current;
  }

  setRepeat(mode) {
    if (!REPEAT_MODES.includes(mode)) throw new RangeError(`Unknown repeat mode: ${mode}`);
    this.repeat = mode;
    this.emitChange();
  }

  cycleRepeat() {
    const next = REPEAT_MODES[(REPEAT_MODES.indexOf(this.repeat) + 1) % REPEAT_MODES.length];
    this.setRepeat(next);
    return next;
  }

  setShuffle(enabled) {
    this.shuffle = Boolean(enabled);
    this.rebuildOrder();
    this.emitChange();
  }

  /** @returns {number} next index, or -1 when playback should stop */
  nextIndex({ auto = false } = {}) {
    if (this.items.length === 0) return -1;
    if (this.currentIndex === -1) return this.order[0];
    if (auto && this.repeat === 'one') return this.currentIndex;
    const position = this.order.indexOf(this.currentIndex);
    if (position + 1 < this.order.length) return this.order[position + 1];
    if (this.repeat === 'off') return -1;
    if (this.shuffle) this.rebuildOrder({ keepCurrentFirst: false });
    return this.order[0];
  }

  previousIndex() {
    if (this.items.length === 0) return -1;
    if (this.currentIndex === -1) return this.order[0];
    const position = this.order.indexOf(this.currentIndex);
    if (position > 0) return this.order[position - 1];
    return this.repeat === 'all' ? this.order[this.order.length - 1] : this.currentIndex;
  }

  /** Fisher–Yates; the current track goes first so `next` never repeats it within a cycle. */
  rebuildOrder({ keepCurrentFirst = true } = {}) {
    const indices = this.items.map((_, i) => i);
    if (!this.shuffle) {
      this.order = indices;
      return;
    }
    for (let i = indices.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    if (keepCurrentFirst && this.currentIndex !== -1) {
      indices.splice(indices.indexOf(this.currentIndex), 1);
      indices.unshift(this.currentIndex);
    }
    this.order = indices;
  }

  emitChange() {
    this.dispatchEvent(new Event('change'));
  }
}
