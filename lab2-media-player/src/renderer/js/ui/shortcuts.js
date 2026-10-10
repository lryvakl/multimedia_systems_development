import { MODIFIER_KEY, isTextInput } from './dom.js';

const DIGIT_CODES = Array.from({ length: 10 }, (_, digit) => `Digit${digit}`);

/**
 * Bound to `KeyboardEvent.code`, so shortcuts work regardless of the active
 * keyboard layout (e.g. Ukrainian). Entries without `codes` are handled by the
 * native menu and are listed here for the help dialog only.
 */
export const SHORTCUTS = [
  { keys: ['Space', 'K'], codes: ['Space', 'KeyK'], command: 'toggle-play', description: 'Play / pause' },
  { keys: ['S'], codes: ['KeyS'], command: 'stop', description: 'Stop' },
  { keys: ['→'], codes: ['ArrowRight'], command: 'forward', description: 'Forward 10 s' },
  { keys: ['←'], codes: ['ArrowLeft'], command: 'backward', description: 'Back 10 s' },
  { keys: ['Shift', '→ / ←'], description: 'Seek 60 s' },
  { keys: ['0 … 9'], codes: DIGIT_CODES, command: 'seek-percent', description: 'Jump to 0 … 90%' },
  { keys: ['↑'], codes: ['ArrowUp'], command: 'volume-up', description: 'Volume up' },
  { keys: ['↓'], codes: ['ArrowDown'], command: 'volume-down', description: 'Volume down' },
  { keys: ['M'], codes: ['KeyM'], command: 'mute', description: 'Mute / unmute' },
  { keys: ['N'], codes: ['KeyN'], command: 'next', description: 'Next track' },
  { keys: ['P'], codes: ['KeyP'], command: 'previous', description: 'Previous track' },
  { keys: ['R'], codes: ['KeyR'], command: 'cycle-repeat', description: 'Repeat mode' },
  { keys: ['H'], codes: ['KeyH'], command: 'toggle-shuffle', description: 'Shuffle' },
  { keys: ['[', ']'], codes: ['BracketLeft', 'BracketRight'], command: 'change-rate', description: 'Playback speed − / +' },
  { keys: ['F'], codes: ['KeyF'], command: 'fullscreen', description: 'Full screen' },
  { keys: ['I'], codes: ['KeyI'], command: 'pip', description: 'Picture-in-picture' },
  { keys: ['V'], codes: ['KeyV'], command: 'cycle-visualizer', description: 'Visualization style' },
  { keys: [MODIFIER_KEY, 'O'], description: 'Open files' },
  { keys: [MODIFIER_KEY, 'U'], description: 'Open URL' },
  { keys: [MODIFIER_KEY, 'T'], description: 'Load subtitles' },
  { keys: [MODIFIER_KEY, 'L'], description: 'Show / hide playlist' },
  { keys: ['F1'], description: 'This help' },
];

const SHORTCUT_BY_CODE = new Map(
  SHORTCUTS.flatMap((shortcut) => (shortcut.codes ?? []).map((code) => [code, shortcut])),
);

const ARGUMENT_BY_COMMAND = {
  'seek-percent': (event) => Number(event.code.replace('Digit', '')) * 10,
  forward: (event) => (event.shiftKey ? 60 : 10),
  backward: (event) => (event.shiftKey ? 60 : 10),
  'change-rate': (event) => (event.code === 'BracketRight' ? 1 : -1),
};

/** @param {import('./commands.js').CommandRegistry} commands */
export function bindShortcuts(commands) {
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || isTextInput(event.target)) return;
    if (document.querySelector('dialog[open]')) return;
    const shortcut = SHORTCUT_BY_CODE.get(event.code);
    if (!shortcut) return;
    event.preventDefault();
    commands.run(shortcut.command, ARGUMENT_BY_COMMAND[shortcut.command]?.(event));
  });
}
