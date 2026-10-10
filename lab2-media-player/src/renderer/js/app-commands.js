import { formatTime } from './core/time.js';
import { srtToVtt } from './core/subtitles.js';
import { captureFrame, frameFileName } from './services/frame-capture.js';

const SEEK_STEP_SECONDS = 10;
const VOLUME_STEP = 0.05;
const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

const REPEAT_LABELS = { off: 'Repeat off', all: 'Repeat playlist', one: 'Repeat track' };
const VISUALIZER_LABELS = { bars: 'Spectrum', wave: 'Waveform', radial: 'Radial' };

/**
 * Application use cases, keyed by command name.
 * @param {{
 *   player: import('./core/player.js').Player,
 *   playlist: import('./core/playlist.js').Playlist,
 *   controller: import('./core/media-controller.js').MediaController,
 *   settings: import('./core/settings.js').Settings,
 *   visualizer: import('./ui/visualizer.js').AudioVisualizer,
 *   fullscreen: import('./ui/fullscreen.js').FullscreenController,
 *   urlDialog: import('./ui/dialogs.js').UrlDialog,
 *   validateUrl: ReturnType<typeof import('./services/url-validator.js').createUrlValidator>,
 *   helpDialog: { open(): void },
 *   layout: { togglePlaylist(): void },
 *   toasts: import('./ui/notifications.js').Toasts,
 *   osd: import('./ui/notifications.js').OnScreenDisplay,
 *   desktop: Window['desktop'],
 * }} ctx
 */
export function createCommandHandlers(ctx) {
  const { player, playlist, controller, settings, visualizer, fullscreen, toasts, osd, desktop } = ctx;

  const requireVideo = (action) => {
    if (player.hasVideo) return true;
    toasts.error(`${action} is available for video only`);
    return false;
  };

  const seekBy = (seconds) => {
    if (!player.canSeek) return;
    player.skip(seconds);
    osd.show(`${seconds > 0 ? '+' : '−'}${Math.abs(seconds)} s · ${formatTime(player.currentTime)}`);
  };

  const changeVolume = (delta) => {
    player.changeVolume(delta);
    osd.show(`Volume ${Math.round(player.volume * 100)}%`);
  };

  const applySubtitles = (text, name) => {
    if (!player.source) {
      toasts.error('Open a video first');
      return;
    }
    player.addSubtitles(srtToVtt(text), name);
    toasts.success(`Subtitles: ${name}`);
  };

  const openVerifiedLink = (link) => {
    settings.addRecentUrl(link.url);
    return controller.openUrl(link);
  };

  const openFiles = async () => controller.openFiles(await desktop.openMediaDialog());

  return {
    'open-file': openFiles,

    'open-url': async () => {
      const link = await ctx.urlDialog.open();
      if (link) await openVerifiedLink(link);
    },

    'open-link': async (input) => {
      const link = await ctx.validateUrl(input);
      if (link.ok) await openVerifiedLink(link);
      else toasts.error(link.error);
    },

    'open-subtitles': async () => {
      const file = await desktop.openSubtitlesDialog();
      if (file) applySubtitles(file.text, file.name);
    },

    'apply-subtitles': ({ text, name }) => applySubtitles(text, name),

    'toggle-play': () => {
      if (player.source) return player.togglePlay();
      return playlist.length > 0 ? controller.playIndex(Math.max(0, playlist.currentIndex)) : openFiles();
    },

    stop: () => player.stop(),
    forward: (seconds = SEEK_STEP_SECONDS) => seekBy(seconds),
    backward: (seconds = SEEK_STEP_SECONDS) => seekBy(-seconds),

    'seek-percent': (percent) => {
      if (!player.canSeek) return;
      player.seek((player.duration * percent) / 100);
      osd.show(`${percent}% · ${formatTime(player.currentTime)}`);
    },

    next: () => controller.playNext(),
    previous: () => controller.playPrevious(),
    'volume-up': () => changeVolume(VOLUME_STEP),
    'volume-down': () => changeVolume(-VOLUME_STEP),

    mute: () => {
      player.toggleMute();
      osd.show(player.isSilent ? 'Muted' : `Volume ${Math.round(player.volume * 100)}%`);
    },

    'change-rate': (direction) => {
      const index = PLAYBACK_RATES.indexOf(player.playbackRate);
      const next = PLAYBACK_RATES[Math.min(PLAYBACK_RATES.length - 1, Math.max(0, index + direction))];
      player.setPlaybackRate(next ?? 1);
      osd.show(`Speed ${player.playbackRate}×`);
    },

    'cycle-repeat': () => osd.show(REPEAT_LABELS[playlist.cycleRepeat()]),

    'toggle-shuffle': () => {
      playlist.setShuffle(!playlist.shuffle);
      osd.show(playlist.shuffle ? 'Shuffle on' : 'Shuffle off');
    },

    'cycle-visualizer': () => osd.show(VISUALIZER_LABELS[visualizer.cycleMode()]),
    'set-visualizer': (mode) => visualizer.setMode(mode),

    fullscreen: () => fullscreen.toggle(),

    pip: async () => {
      if (document.pictureInPictureElement) return document.exitPictureInPicture();
      if (requireVideo('Picture-in-picture')) await player.media.requestPictureInPicture();
    },

    screenshot: async () => {
      if (!requireVideo('Frame capture')) return;
      const savedPath = await desktop.saveScreenshot(
        captureFrame(player.media),
        frameFileName(player.source.title, player.currentTime),
      );
      if (savedPath) toasts.success(`Frame saved: ${savedPath}`);
    },

    'toggle-playlist': () => ctx.layout.togglePlaylist(),
    'clear-playlist': () => controller.clear(),
    'show-help': () => ctx.helpDialog.open(),
  };
}
