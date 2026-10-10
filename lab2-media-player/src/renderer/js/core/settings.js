const STORAGE_KEY = 'player.settings.v1';
const MAX_RECENT_URLS = 5;

export const DEFAULT_SETTINGS = Object.freeze({
  volume: 0.8,
  muted: false,
  playbackRate: 1,
  repeat: 'off',
  shuffle: false,
  playlistVisible: true,
  visualizerMode: 'bars',
  recentUrls: [],
});

export class Settings {
  /** @param {Storage | null} [storage] */
  constructor(storage = globalThis.localStorage ?? null) {
    this.storage = storage;
    this.values = { ...DEFAULT_SETTINGS, ...this.read() };
  }

  read() {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  get(key) {
    return this.values[key];
  }

  set(key, value) {
    this.values[key] = value;
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.values));
    } catch {
      // Preferences are best-effort: storage may be unavailable or full.
    }
  }

  addRecentUrl(url) {
    const recent = [url, ...this.values.recentUrls.filter((item) => item !== url)];
    this.set('recentUrls', recent.slice(0, MAX_RECENT_URLS));
  }
}
