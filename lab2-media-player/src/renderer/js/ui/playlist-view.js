import { createElement, createIcon } from './dom.js';
import { describeItem } from './source-description.js';

const createEqualizer = () =>
  createElement('span', { className: 'equalizer', attrs: { 'aria-hidden': 'true' } }, [
    createElement('i'),
    createElement('i'),
    createElement('i'),
  ]);

export class PlaylistView {
  /**
   * @param {import('../core/playlist.js').Playlist} playlist
   * @param {{ list: HTMLElement, count: HTMLElement, empty: HTMLElement }} elements
   * @param {{ onSelect: (index: number) => void, onRemove: (id: number) => void }} callbacks
   */
  constructor(playlist, elements, callbacks) {
    this.playlist = playlist;
    this.elements = elements;
    this.callbacks = callbacks;
    playlist.addEventListener('change', () => this.render());
    this.bindList();
    this.render();
  }

  bindList() {
    const { list } = this.elements;
    list.addEventListener('click', (event) => {
      const item = event.target.closest('[data-index]');
      if (!item) return;
      if (event.target.closest('[data-remove]')) this.callbacks.onRemove(Number(item.dataset.id));
      else this.callbacks.onSelect(Number(item.dataset.index));
    });
    list.addEventListener('keydown', (event) => {
      const item = event.target.closest('[data-index]');
      if (!item || event.target !== item) return;
      if (event.key === 'Enter') this.callbacks.onSelect(Number(item.dataset.index));
      if (event.key === 'Delete' || event.key === 'Backspace') this.callbacks.onRemove(Number(item.dataset.id));
    });
  }

  render() {
    const { items, currentIndex } = this.playlist;
    const { list, count, empty } = this.elements;
    list.replaceChildren(...items.map((item, index) => this.renderItem(item, index, index === currentIndex)));
    count.textContent = String(items.length);
    empty.hidden = items.length > 0;
    list.querySelector('.track--current')?.scrollIntoView({ block: 'nearest' });
  }

  renderItem(item, index, isCurrent) {
    const removeButton = createElement(
      'button',
      { className: 'icon-btn icon-btn--sm track__remove', attrs: { type: 'button', title: 'Remove', 'data-remove': '' } },
      [createIcon('close')],
    );
    const position = String(index + 1).padStart(2, '0');
    return createElement(
      'li',
      {
        className: `track${isCurrent ? ' track--current' : ''}`,
        attrs: {
          tabindex: '0',
          title: item.url.startsWith('blob:') ? item.title : item.url,
          'data-index': String(index),
          'data-id': String(item.id),
          ...(isCurrent && { 'aria-current': 'true' }),
        },
      },
      [
        createElement('span', { className: 'track__index' }, [isCurrent ? createEqualizer() : position]),
        createElement('span', { className: 'track__body' }, [
          createElement('span', { className: 'track__title', text: item.title }),
          createElement('span', { className: 'track__meta', text: describeItem(item) }),
        ]),
        removeButton,
      ],
    );
  }
}
