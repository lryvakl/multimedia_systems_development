import { AUDIO_EXTENSIONS, VIDEO_EXTENSIONS } from '../../shared/formats.js';
import { MediaController } from './core/media-controller.js';
import { Player } from './core/player.js';
import { Playlist } from './core/playlist.js';
import { Settings } from './core/settings.js';
import { createCommandHandlers } from './app-commands.js';
import { bindSettings } from './persistence.js';
import { bindMediaSession } from './services/media-session.js';
import { createUrlValidator } from './services/url-validator.js';
import { CommandRegistry } from './ui/commands.js';
import { ControlsView } from './ui/controls-view.js';
import { UrlDialog, createHelpDialog } from './ui/dialogs.js';
import { byId, createElement, localizeShortcutHints } from './ui/dom.js';
import { bindDragAndDrop } from './ui/drag-drop.js';
import { FullscreenController } from './ui/fullscreen.js';
import { OnScreenDisplay, Toasts } from './ui/notifications.js';
import { PlaylistView } from './ui/playlist-view.js';
import { SHORTCUTS, bindShortcuts } from './ui/shortcuts.js';
import { StageView } from './ui/stage-view.js';
import { Timeline } from './ui/timeline.js';
import { AudioVisualizer } from './ui/visualizer.js';

function renderFormats(list) {
  const groups = { Audio: AUDIO_EXTENSIONS, Video: VIDEO_EXTENSIONS, Streams: ['hls', 'mpeg-dash'] };
  list.replaceChildren(
    ...Object.entries(groups).flatMap(([label, formats]) => [
      createElement('dt', { text: label }),
      createElement('dd', { text: formats.join('  ').toUpperCase() }),
    ]),
  );
}

function createLayout(app, settings, controlsView) {
  const apply = (isVisible) => {
    app.classList.toggle('app--no-sidebar', !isVisible);
    controlsView.setPlaylistVisible(isVisible);
  };
  apply(settings.get('playlistVisible'));
  return {
    togglePlaylist() {
      const isVisible = !settings.get('playlistVisible');
      settings.set('playlistVisible', isVisible);
      apply(isVisible);
    },
  };
}

function bindStageGestures(stage, media, commands, player) {
  media.addEventListener('click', () => commands.run('toggle-play'));
  media.addEventListener('dblclick', () => commands.run('fullscreen'));
  stage.addEventListener(
    'wheel',
    (event) => {
      if (!player.source) return;
      event.preventDefault();
      commands.run(event.deltaY < 0 ? 'volume-up' : 'volume-down');
    },
    { passive: false },
  );
}

function main() {
  const { desktop } = window;
  const media = byId('media');
  const app = byId('app');
  const playerRoot = byId('player');

  const settings = new Settings();
  const player = new Player(media);
  const playlist = new Playlist();
  const controller = new MediaController(player, playlist);
  const visualizer = new AudioVisualizer(byId('visualizer'), media, settings.get('visualizerMode'));
  bindSettings(settings, { player, playlist, visualizer });

  const toasts = new Toasts(byId('toasts'));
  const osd = new OnScreenDisplay(byId('osd'));
  const fullscreen = new FullscreenController(playerRoot);
  const commands = new CommandRegistry({ onError: (error) => toasts.error(error.message ?? String(error)) });

  new Timeline(player, {
    bar: byId('progress'),
    tooltip: byId('progressTooltip'),
    currentTime: byId('currentTime'),
    duration: byId('duration'),
  });
  new StageView(
    { player, visualizer },
    {
      root: playerRoot,
      spinner: byId('spinner'),
      audioInfo: byId('audioInfo'),
      audioTitle: byId('audioTitle'),
      visualizerModes: byId('visualizerModes'),
    },
  );
  const controlsView = new ControlsView(
    { player, playlist },
    {
      controls: byId('controls'),
      playButton: byId('playButton'),
      muteButton: byId('muteButton'),
      volumeSlider: byId('volumeSlider'),
      rateSelect: byId('rateSelect'),
      repeatButton: byId('repeatButton'),
      shuffleButton: byId('shuffleButton'),
      fullscreenButton: byId('fullscreenButton'),
      playlistButton: byId('playlistButton'),
      trackTitle: byId('trackTitle'),
      trackMeta: byId('trackMeta'),
    },
  );
  new PlaylistView(
    playlist,
    { list: byId('playlist'), count: byId('playlistCount'), empty: byId('playlistEmpty') },
    { onSelect: (index) => controller.playIndex(index), onRemove: (id) => controller.remove(id) },
  );

  const validateUrl = createUrlValidator(desktop);
  const urlDialog = new UrlDialog(
    {
      dialog: byId('urlDialog'),
      form: byId('urlForm'),
      input: byId('urlInput'),
      status: byId('urlStatus'),
      recentList: byId('recentUrls'),
      recentSection: byId('recentUrlsSection'),
      exampleList: byId('exampleUrls'),
    },
    { getRecentUrls: () => settings.get('recentUrls'), validate: validateUrl },
  );
  const helpDialog = createHelpDialog(byId('helpDialog'), byId('shortcutsTable'), SHORTCUTS);
  const layout = createLayout(app, settings, controlsView);

  commands.registerAll(
    createCommandHandlers({
      player,
      playlist,
      controller,
      settings,
      visualizer,
      fullscreen,
      urlDialog,
      validateUrl,
      helpDialog,
      layout,
      toasts,
      osd,
      desktop,
    }),
  );
  commands.bindButtons();
  bindShortcuts(commands);
  bindStageGestures(byId('stage'), media, commands, player);
  bindMediaSession(player, commands);

  bindDragAndDrop(app, {
    onMediaFiles: (files) => controller.openDroppedFiles(files),
    onSubtitleFile: async (file) => commands.run('apply-subtitles', { text: await file.text(), name: file.name }),
    onUrl: (url) => commands.run('open-link', url),
    onUnsupported: (names) => toasts.error(`Unsupported format: ${names.join(', ')}`),
  });

  fullscreen.addEventListener('change', () => controlsView.setFullscreen(fullscreen.isActive));
  player.addEventListener('error', (event) => toasts.error(event.detail.message));
  player.addEventListener('sourcechange', () => desktop.setTitle(player.source?.title ?? ''));
  player.addEventListener('statechange', () => (app.dataset.playerState = player.state));
  desktop.onMenuCommand((name) => commands.run(name));
  desktop.onOpenFiles((files) => controller.openFiles(files));

  renderFormats(byId('formatsHint'));
  localizeShortcutHints(document);
}

main();
