import { PLAYER_STATE } from '../core/player.js';
import { describeSource } from './source-description.js';
import { setIcon } from './dom.js';

const REPEAT_VIEW = {
  off: { icon: 'repeat', active: false, title: 'Repeat: off' },
  all: { icon: 'repeat', active: true, title: 'Repeat: playlist' },
  one: { icon: 'repeat-one', active: true, title: 'Repeat: current track' },
};

const SOURCE_DEPENDENT_COMMANDS = ['stop', 'forward', 'backward'];
const VIDEO_DEPENDENT_COMMANDS = ['screenshot', 'pip'];
const PLAYLIST_DEPENDENT_COMMANDS = ['next', 'previous'];

/** Reflects player/playlist state in the control bar and handles its inputs. */
export class ControlsView {
  /**
   * @param {{ player: import('../core/player.js').Player, playlist: import('../core/playlist.js').Playlist }} deps
   * @param {Record<string, HTMLElement>} elements
   */
  constructor({ player, playlist }, elements) {
    this.player = player;
    this.playlist = playlist;
    this.elements = elements;
    this.bindInputs();
    this.bindModel();
    this.renderAll();
  }

  bindInputs() {
    const { volumeSlider, rateSelect } = this.elements;
    volumeSlider.addEventListener('input', () => this.player.setVolume(volumeSlider.valueAsNumber / 100));
    rateSelect.addEventListener('change', () => {
      this.player.setPlaybackRate(Number(rateSelect.value));
      rateSelect.blur();
    });
  }

  bindModel() {
    const on = (target, types, handler) => types.forEach((type) => target.addEventListener(type, handler));
    on(this.player, ['statechange', 'sourcechange'], () => this.renderPlayback());
    on(this.player, ['loadedmetadata', 'durationchange', 'resize', 'sourcechange'], () => this.renderNowPlaying());
    on(this.player, ['volumechange'], () => this.renderVolume());
    on(this.player, ['ratechange'], () => this.renderRate());
    on(this.playlist, ['change'], () => this.renderPlaylistModes());
  }

  renderAll() {
    this.renderPlayback();
    this.renderNowPlaying();
    this.renderVolume();
    this.renderRate();
    this.renderPlaylistModes();
  }

  renderPlayback() {
    const { playButton } = this.elements;
    const isPlaying = this.player.state === PLAYER_STATE.PLAYING;
    setIcon(playButton, isPlaying ? 'pause' : 'play');
    playButton.title = isPlaying ? 'Pause (Space)' : 'Play (Space)';
    playButton.setAttribute('aria-label', playButton.title);
    this.setCommandsDisabled(SOURCE_DEPENDENT_COMMANDS, !this.player.source);
  }

  renderNowPlaying() {
    const { trackTitle, trackMeta } = this.elements;
    const { source } = this.player;
    trackTitle.textContent = source?.title ?? 'No media';
    trackTitle.title = source?.title ?? '';
    trackMeta.textContent = source ? describeSource(this.player) : '';
    trackMeta.title = trackMeta.textContent;
    this.setCommandsDisabled(VIDEO_DEPENDENT_COMMANDS, !this.player.hasVideo);
  }

  renderVolume() {
    const { volumeSlider, muteButton } = this.elements;
    const { isSilent, volume } = this.player;
    const level = isSilent ? 0 : Math.round(volume * 100);
    volumeSlider.value = String(level);
    volumeSlider.style.setProperty('--value', `${level}%`);
    volumeSlider.setAttribute('aria-valuetext', `${level}%`);
    setIcon(muteButton, isSilent ? 'volume-off' : volume < 0.5 ? 'volume-low' : 'volume-high');
    muteButton.title = isSilent ? 'Unmute (M)' : 'Mute (M)';
  }

  renderRate() {
    this.elements.rateSelect.value = String(this.player.playbackRate);
  }

  renderPlaylistModes() {
    const { repeatButton, shuffleButton } = this.elements;
    const repeat = REPEAT_VIEW[this.playlist.repeat];
    setIcon(repeatButton, repeat.icon);
    repeatButton.classList.toggle('icon-btn--active', repeat.active);
    repeatButton.title = `${repeat.title} (R)`;
    shuffleButton.classList.toggle('icon-btn--active', this.playlist.shuffle);
    shuffleButton.setAttribute('aria-pressed', String(this.playlist.shuffle));
    this.setCommandsDisabled(PLAYLIST_DEPENDENT_COMMANDS, this.playlist.length < 2);
  }

  setFullscreen(isFullscreen) {
    setIcon(this.elements.fullscreenButton, isFullscreen ? 'fullscreen-exit' : 'fullscreen');
  }

  setPlaylistVisible(isVisible) {
    this.elements.playlistButton.classList.toggle('icon-btn--active', isVisible);
  }

  setCommandsDisabled(commands, disabled) {
    for (const command of commands) {
      this.elements.controls
        .querySelectorAll(`[data-command="${command}"]`)
        .forEach((button) => (button.disabled = disabled));
    }
  }
}
