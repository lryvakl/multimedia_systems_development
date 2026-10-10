import { STREAM_TYPE } from '../../../shared/formats.js';

const VENDOR_DIR = '../../../../node_modules';
const loadHls = () => import(`${VENDOR_DIR}/hls.js/dist/hls.min.mjs`).then((module) => module.default);
const loadDash = () => import(`${VENDOR_DIR}/dashjs/dist/modern/esm/dash.all.min.js`);

class ProgressiveAdapter {
  async attach(media, url) {
    media.src = url;
  }

  destroy(media) {
    media.removeAttribute('src');
    media.load();
  }
}

class HlsAdapter {
  constructor(onFatalError) {
    this.onFatalError = onFatalError;
    this.hls = null;
  }

  async attach(media, url) {
    const Hls = await loadHls();
    if (!Hls.isSupported()) {
      media.src = url;
      return;
    }
    this.hls = new Hls({ capLevelToPlayerSize: true });
    this.hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) this.onFatalError(`HLS: ${data.details}`);
    });
    this.hls.loadSource(url);
    this.hls.attachMedia(media);
  }

  destroy(media) {
    this.hls?.destroy();
    this.hls = null;
    media.removeAttribute('src');
    media.load();
  }
}

class DashAdapter {
  constructor(onFatalError) {
    this.onFatalError = onFatalError;
    this.player = null;
  }

  async attach(media, url) {
    const { MediaPlayer } = await loadDash();
    this.player = MediaPlayer().create();
    this.player.updateSettings({ streaming: { abr: { limitBitrateByPortal: true } } });
    this.player.on(MediaPlayer.events.ERROR, ({ error }) => {
      this.onFatalError(`DASH: ${error?.message ?? 'playback error'}`);
    });
    this.player.initialize(media, url, false);
  }

  destroy(media) {
    this.player?.reset();
    this.player = null;
    media.removeAttribute('src');
    media.load();
  }
}

const ADAPTERS = {
  [STREAM_TYPE.PROGRESSIVE]: ProgressiveAdapter,
  [STREAM_TYPE.HLS]: HlsAdapter,
  [STREAM_TYPE.DASH]: DashAdapter,
};

/**
 * @param {'progressive'|'hls'|'dash'} streamType
 * @param {(message: string) => void} onFatalError
 * @returns {{ attach(media: HTMLMediaElement, url: string): Promise<void>, destroy(media: HTMLMediaElement): void }}
 */
export function createStreamAdapter(streamType, onFatalError) {
  const Adapter = ADAPTERS[streamType] ?? ProgressiveAdapter;
  return new Adapter(onFatalError);
}
