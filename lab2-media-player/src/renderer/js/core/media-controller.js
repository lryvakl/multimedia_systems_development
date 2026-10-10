import { titleFromUrl } from '../../../shared/formats.js';

const RESTART_THRESHOLD_SECONDS = 3;

/** Coordinates the playlist and the player: what to play, and what comes next. */
export class MediaController {
  /**
   * @param {import('./player.js').Player} player
   * @param {import('./playlist.js').Playlist} playlist
   */
  constructor(player, playlist) {
    this.player = player;
    this.playlist = playlist;
    player.media.addEventListener('ended', () => this.playNext({ auto: true }));
  }

  /** @param {Array<{ name: string, url: string }>} descriptors file:// sources from the main process */
  openFiles(descriptors) {
    return this.enqueue(descriptors.map(({ name, url }) => ({ title: name, url, origin: 'file' })));
  }

  /** @param {File[]} files dropped files, played through blob: URLs */
  openDroppedFiles(files) {
    return this.enqueue(
      files.map((file) => {
        const url = URL.createObjectURL(file);
        return { title: file.name, url, origin: 'file', dispose: () => URL.revokeObjectURL(url) };
      }),
    );
  }

  /** @param {{ url: string, streamType?: string }} link a validated link */
  openUrl({ url, streamType }) {
    return this.enqueue([{ title: titleFromUrl(url), url, streamType, origin: 'url' }]);
  }

  enqueue(entries) {
    if (entries.length === 0) return Promise.resolve();
    return this.playIndex(this.playlist.add(entries));
  }

  playIndex(index) {
    const item = this.playlist.select(index);
    return item ? this.player.load(item) : Promise.resolve();
  }

  playNext({ auto = false } = {}) {
    const index = this.playlist.nextIndex({ auto });
    if (index !== -1) return this.playIndex(index);
    if (auto) this.player.stop();
    return Promise.resolve();
  }

  playPrevious() {
    if (this.player.currentTime > RESTART_THRESHOLD_SECONDS) {
      this.player.seek(0);
      return Promise.resolve();
    }
    return this.playIndex(this.playlist.previousIndex());
  }

  remove(id) {
    const isCurrent = this.playlist.current?.id === id;
    this.playlist.remove(id);
    if (isCurrent) this.player.eject();
  }

  clear() {
    this.playlist.clear();
    this.player.eject();
  }
}
