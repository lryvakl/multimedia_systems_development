/**
 * Single dispatch point for user actions: buttons (`data-command`), hotkeys
 * and the native menu all go through `run`, so every action has one implementation.
 */
export class CommandRegistry {
  constructor({ onError }) {
    this.handlers = new Map();
    this.onError = onError;
  }

  /** @param {Record<string, (arg?: unknown) => unknown>} handlers */
  registerAll(handlers) {
    for (const [name, handler] of Object.entries(handlers)) this.handlers.set(name, handler);
  }

  async run(name, arg) {
    const handler = this.handlers.get(name);
    if (!handler) {
      console.warn(`Unknown command: ${name}`);
      return;
    }
    try {
      await handler(arg);
    } catch (error) {
      this.onError(error);
    }
  }

  bindButtons(root = document) {
    root.addEventListener('click', (event) => {
      const button = event.target.closest('[data-command]');
      if (!button) return;
      event.stopPropagation();
      this.run(button.dataset.command, button.dataset.arg);
      button.blur();
    });
  }
}
