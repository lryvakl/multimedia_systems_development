import { PLAYER_STATE } from '../core/player.js';

/** Video area: empty state, loading spinner, and video vs. audio visualizer switching. */
export class StageView {
  /**
   * @param {{ player: import('../core/player.js').Player, visualizer: import('./visualizer.js').AudioVisualizer }} deps
   * @param {{ root: HTMLElement, spinner: HTMLElement, audioInfo: HTMLElement, audioTitle: HTMLElement, visualizerModes: HTMLElement }} elements
   */
  constructor({ player, visualizer }, elements) {
    this.player = player;
    this.visualizer = visualizer;
    this.elements = elements;
    this.isBuffering = false;
    this.bindPlayer();
    visualizer.addEventListener('modechange', () => this.renderVisualizerMode());
    this.render();
    this.renderVisualizerMode();
  }

  renderVisualizerMode() {
    for (const button of this.elements.visualizerModes.querySelectorAll('[data-arg]')) {
      button.setAttribute('aria-pressed', String(button.dataset.arg === this.visualizer.mode));
    }
  }

  bindPlayer() {
    const { player } = this;
    const setBuffering = (value) => () => {
      this.isBuffering = value;
      this.render();
    };
    player.addEventListener('waiting', setBuffering(true));
    player.addEventListener('playing', setBuffering(false));
    player.addEventListener('seeked', setBuffering(false));
    for (const type of ['statechange', 'sourcechange', 'loadedmetadata', 'resize']) {
      player.addEventListener(type, () => this.render());
    }
  }

  render() {
    const { player, visualizer } = this;
    const { root, spinner, audioInfo, audioTitle } = this.elements;
    const hasSource = Boolean(player.source);
    const isAudioOnly = hasSource && player.hasMetadata && !player.hasVideo;
    const isLoading = player.state === PLAYER_STATE.LOADING || (this.isBuffering && player.isPlaying);

    root.classList.toggle('player--has-media', hasSource);
    spinner.hidden = !isLoading;
    audioInfo.hidden = !isAudioOnly;
    audioTitle.textContent = isAudioOnly ? player.source.title : '';
    visualizer.setVisible(isAudioOnly);
    visualizer.setRunning(isAudioOnly && player.isPlaying);
  }
}
