import { createElement } from './dom.js';

export const EXAMPLE_URLS = [
  { label: 'MP4', url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4' },
  { label: 'WebM', url: 'https://test-videos.co.uk/vids/bigbuckbunny/webm/vp9/360/Big_Buck_Bunny_360_10s_1MB.webm' },
  { label: 'MP3', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { label: 'HLS', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  { label: 'HLS live', url: 'https://demo.unified-streaming.com/k8s/live/scte35.isml/.m3u8' },
  { label: 'DASH', url: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd' },
  { label: 'DASH live', url: 'https://livesim2.dashif.org/livesim2/testpic_2s/Manifest.mpd' },
];

function renderUrlList(list, entries, onPick) {
  list.replaceChildren(
    ...entries.map(({ label, url }) => {
      const button = createElement('button', { className: 'url-list__button', attrs: { type: 'button', title: url } }, [
        ...(label ? [createElement('span', { className: 'url-list__label', text: label })] : []),
        createElement('span', { className: 'url-list__url', text: url }),
      ]);
      button.addEventListener('click', () => onPick(url));
      return createElement('li', {}, [button]);
    }),
  );
}

export class UrlDialog {
  /**
   * @param {Record<string, HTMLElement>} elements
   * @param {{ getRecentUrls: () => string[], validate: (input: string) => Promise<object> }} deps
   */
  constructor(elements, { getRecentUrls, validate }) {
    this.elements = elements;
    this.getRecentUrls = getRecentUrls;
    this.validate = validate;
    this.resolve = null;
    this.checkToken = 0;
    this.bind();
  }

  bind() {
    const { dialog, form, input } = this.elements;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.submit(input.value);
    });
    input.addEventListener('input', () => this.showStatus(''));
    dialog.querySelector('[data-dialog-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      this.checkToken += 1;
      this.setBusy(false);
      this.settle(null);
    });
  }

  /** @returns {Promise<{ url: string, streamType: string } | null>} a verified link, or null when cancelled */
  open() {
    const { dialog, input, recentList, recentSection, exampleList } = this.elements;
    const recent = this.getRecentUrls();
    const pick = (url) => {
      input.value = url;
      this.submit(url);
    };
    renderUrlList(recentList, recent.map((url) => ({ url })), pick);
    renderUrlList(exampleList, EXAMPLE_URLS, pick);
    recentSection.hidden = recent.length === 0;
    input.value = '';
    this.showStatus('');
    dialog.showModal();
    input.focus();
    return new Promise((resolve) => (this.resolve = resolve));
  }

  async submit(value) {
    const token = ++this.checkToken;
    this.setBusy(true);
    this.showStatus('Checking the link…', { pending: true });
    const result = await this.validate(value);
    if (token !== this.checkToken) return;
    this.setBusy(false);
    if (!result.ok) {
      this.showStatus(result.error);
      this.elements.input.focus();
      return;
    }
    this.settle({ url: result.url, streamType: result.streamType });
    this.elements.dialog.close();
  }

  setBusy(isBusy) {
    const { form, input } = this.elements;
    input.readOnly = isBusy;
    form.querySelector('[type="submit"]').disabled = isBusy;
    form.classList.toggle('dialog__form--busy', isBusy);
  }

  showStatus(message, { pending = false } = {}) {
    const { status } = this.elements;
    status.textContent = message;
    status.classList.toggle('dialog__status--pending', pending);
  }

  settle(value) {
    this.resolve?.(value);
    this.resolve = null;
  }
}

/**
 * @param {HTMLDialogElement} dialog
 * @param {HTMLTableElement} table
 * @param {Array<{ keys: string[], description: string }>} shortcuts
 */
export function createHelpDialog(dialog, table, shortcuts) {
  table.replaceChildren(
    ...shortcuts.map(({ keys, description }) =>
      createElement('tr', {}, [
        createElement('td', {}, keys.map((key) => createElement('kbd', { text: key }))),
        createElement('td', { text: description }),
      ]),
    ),
  );
  return { open: () => dialog.showModal() };
}
