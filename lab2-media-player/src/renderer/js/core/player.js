import { getStreamType } from '../../../shared/formats.js';
import { createStreamAdapter } from './stream-adapters.js';
import { clamp } from './time.js';

export const PLAYER_STATE = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  PLAYING: 'playing',
  PAUSED: 'paused',
  STOPPED: 'stopped',
  ENDED: 'ended',
  ERROR: 'error',
});

const FORWARDED_EVENTS = [
  'timeupdate',
  'durationchange',
  'progress',
  'loadedmetadata',
  'resize',
  'volumechange',
  'ratechange',
  'waiting',
  'playing',
  'seeking',
  'seeked',
];

const MEDIA_ERROR_MESSAGES = {
  1: 'Loading was aborted',
  2: 'Network error while loading the media',
  3: 'Could not decode the media (corrupted file or unsupported codec)',
  4: 'The format or source is not supported',
};

const isRemote = (url) => /^https?:/i.test(url);

/**
 * Facade over an HTMLMediaElement: unified playback API, explicit state machine
 * and stream-type specific loading. Events: `statechange`, `error`, `sourcechange`
 * plus the forwarded media element events.
 */
export class Player extends EventTarget {
  /** @param {HTMLMediaElement} media */
  constructor(media) {
    super();
    this.media = media;
    this.state = PLAYER_STATE.IDLE;
    this.source = null;
    this.adapter = null;
    this.loadToken = 0;
    this.subtitleUrls = [];
    this.bindMediaEvents();
  }

  bindMediaEvents() {
    const { media } = this;
    for (const type of FORWARDED_EVENTS) {
      media.addEventListener(type, () => this.dispatchEvent(new Event(type)));
    }
    media.addEventListener('play', () => this.setState(PLAYER_STATE.PLAYING));
    media.addEventListener('pause', () => {
      if (this.state === PLAYER_STATE.PLAYING) this.setState(PLAYER_STATE.PAUSED);
    });
    media.addEventListener('ended', () => this.setState(PLAYER_STATE.ENDED));
    media.addEventListener('canplay', () => {
      if (this.state === PLAYER_STATE.LOADING) this.setState(PLAYER_STATE.PAUSED);
    });
    media.addEventListener('error', () => {
      if (!this.source || !media.error) return;
      this.fail(MEDIA_ERROR_MESSAGES[media.error.code] ?? 'Unknown playback error');
    });
  }

  /**
   * @param {{ url: string, title: string, streamType?: string }} source
   * @param {{ autoplay?: boolean }} [options]
   */
  async load(source, { autoplay = true } = {}) {
    const token = ++this.loadToken;
    this.unload();
    this.source = { ...source, streamType: source.streamType ?? getStreamType(source.url) };
    this.setState(PLAYER_STATE.LOADING);
    this.dispatchEvent(new Event('sourcechange'));

    this.media.crossOrigin = isRemote(source.url) ? 'anonymous' : null;
    this.adapter = createStreamAdapter(this.source.streamType, (message) => {
      if (token === this.loadToken) this.fail(message);
    });

    try {
      await this.adapter.attach(this.media, source.url);
    } catch (error) {
      if (token === this.loadToken) this.fail(`Could not open the source: ${error.message}`);
      return;
    }
    if (token === this.loadToken && autoplay) await this.play();
  }

  eject() {
    this.loadToken += 1;
    this.unload();
    this.source = null;
    this.setState(PLAYER_STATE.IDLE);
    this.dispatchEvent(new Event('sourcechange'));
  }

  unload() {
    this.adapter?.destroy(this.media);
    this.adapter = null;
    this.clearSubtitles();
  }

  async play() {
    if (!this.source) return;
    try {
      await this.media.play();
    } catch (error) {
      const reportedByMediaErrorEvent = ['AbortError', 'NotSupportedError'].includes(error.name);
      if (!reportedByMediaErrorEvent) this.fail(error.message);
    }
  }

  pause() {
    this.media.pause();
  }

  togglePlay() {
    if (this.media.paused || this.media.ended) return this.play();
    this.pause();
    return Promise.resolve();
  }

  stop() {
    if (!this.source) return;
    this.media.pause();
    if (!this.isLive) this.media.currentTime = 0;
    this.setState(PLAYER_STATE.STOPPED);
  }

  seek(seconds) {
    if (!this.canSeek) return;
    this.media.currentTime = clamp(seconds, 0, this.duration);
  }

  skip(deltaSeconds) {
    this.seek(this.currentTime + deltaSeconds);
  }

  setVolume(volume) {
    this.media.volume = clamp(volume, 0, 1);
    if (this.media.volume > 0) this.media.muted = false;
  }

  changeVolume(delta) {
    this.setVolume(this.volume + delta);
  }

  setMuted(muted) {
    this.media.muted = muted;
  }

  toggleMute() {
    this.setMuted(!this.media.muted);
  }

  setPlaybackRate(rate) {
    this.media.playbackRate = rate;
    this.media.defaultPlaybackRate = rate;
  }

  /** @param {string} vttText @param {string} label */
  addSubtitles(vttText, label) {
    this.clearSubtitles();
    const url = URL.createObjectURL(new Blob([vttText], { type: 'text/vtt' }));
    const track = Object.assign(document.createElement('track'), {
      kind: 'subtitles',
      label,
      srclang: 'en',
      src: url,
      default: true,
    });
    this.media.append(track);
    track.track.mode = 'showing';
    this.subtitleUrls.push(url);
  }

  clearSubtitles() {
    this.media.querySelectorAll('track').forEach((element) => {
      element.track.mode = 'disabled';
      element.remove();
    });
    this.subtitleUrls.forEach((url) => URL.revokeObjectURL(url));
    this.subtitleUrls = [];
  }

  get currentTime() {
    return this.media.currentTime;
  }

  get duration() {
    return this.media.duration;
  }

  get bufferedRanges() {
    return this.media.buffered;
  }

  get isLive() {
    return this.duration === Infinity;
  }

  get canSeek() {
    return Boolean(this.source) && Number.isFinite(this.duration) && this.duration > 0;
  }

  get isPlaying() {
    return this.state === PLAYER_STATE.PLAYING;
  }

  get hasMetadata() {
    return this.media.readyState >= HTMLMediaElement.HAVE_METADATA;
  }

  get hasVideo() {
    return this.media.videoWidth > 0;
  }

  get videoSize() {
    return { width: this.media.videoWidth, height: this.media.videoHeight };
  }

  get volume() {
    return this.media.volume;
  }

  get muted() {
    return this.media.muted;
  }

  get isSilent() {
    return this.muted || this.volume === 0;
  }

  get playbackRate() {
    return this.media.playbackRate;
  }

  fail(message) {
    this.setState(PLAYER_STATE.ERROR);
    this.dispatchEvent(new CustomEvent('error', { detail: { message } }));
  }

  setState(state) {
    if (this.state === state) return;
    this.state = state;
    this.dispatchEvent(new Event('statechange'));
  }
}
