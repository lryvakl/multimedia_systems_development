const SVG_NS = 'http://www.w3.org/2000/svg';

export function byId(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Element #${id} not found`);
  return element;
}

export function createIcon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.classList.add('icon');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

export function setIcon(container, name) {
  container.querySelector('use').setAttribute('href', `#i-${name}`);
}

export function createElement(tag, { className, text, attrs = {} } = {}, children = []) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
  element.append(...children);
  return element;
}

const IS_MAC = /Mac/.test(navigator.platform);
export const MODIFIER_KEY = IS_MAC ? '⌘' : 'Ctrl';

export function formatShortcut(key) {
  return IS_MAC ? `⌘${key}` : `Ctrl+${key}`;
}

/** Fills `<kbd data-shortcut="O">` hints and rewrites "Ctrl+" in tooltips for the current platform. */
export function localizeShortcutHints(root) {
  root.querySelectorAll('[data-shortcut]').forEach((kbd) => (kbd.textContent = formatShortcut(kbd.dataset.shortcut)));
  if (!IS_MAC) return;
  root.querySelectorAll('[title*="Ctrl+"]').forEach((element) => (element.title = element.title.replaceAll('Ctrl+', '⌘')));
}

export function isTextInput(target) {
  return target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'));
}
