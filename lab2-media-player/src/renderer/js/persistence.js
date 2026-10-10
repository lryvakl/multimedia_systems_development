import { REPEAT_MODES } from './core/playlist.js';

/**
 * Restores saved preferences and keeps them in sync with the models.
 * @param {import('./core/settings.js').Settings} settings
 * @param {{ player: import('./core/player.js').Player, playlist: import('./core/playlist.js').Playlist, visualizer: import('./ui/visualizer.js').AudioVisualizer }} models
 */
export function bindSettings(settings, { player, playlist, visualizer }) {
  player.setVolume(settings.get('volume'));
  player.setMuted(settings.get('muted'));
  player.setPlaybackRate(settings.get('playbackRate'));
  if (REPEAT_MODES.includes(settings.get('repeat'))) playlist.setRepeat(settings.get('repeat'));
  playlist.setShuffle(settings.get('shuffle'));

  player.addEventListener('volumechange', () => {
    settings.set('volume', player.volume);
    settings.set('muted', player.muted);
  });
  player.addEventListener('ratechange', () => settings.set('playbackRate', player.playbackRate));
  visualizer.addEventListener('modechange', () => settings.set('visualizerMode', visualizer.mode));
  playlist.addEventListener('change', () => {
    settings.set('repeat', playlist.repeat);
    settings.set('shuffle', playlist.shuffle);
  });
}
