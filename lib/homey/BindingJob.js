/**
 * Runs a binding in the background, so the maintenance button that starts it
 * returns at once: Homey gives up on a button long before a unit in binding
 * mode answers. The outcome reaches the device through the callbacks.
 */
export class BindingJob {
  /** @type {() => Promise<string>} */
  #bind;

  /** @type {(unit: string) => Promise<void>} */
  #onBound;

  /** @type {(error: unknown) => Promise<void>} */
  #onFailed;

  /** @type {Promise<void> | null} */
  #running = null;

  /**
   * @param {object} options
   * @param {() => Promise<string>} options.bind runs the binding, resolves with the unit that accepted
   * @param {(unit: string) => Promise<void>} options.onBound
   * @param {(error: unknown) => Promise<void>} options.onFailed
   */
  constructor({ bind, onBound, onFailed }) {
    this.#bind = bind;
    this.#onBound = onBound;
    this.#onFailed = onFailed;
  }

  /** @returns {boolean} whether a binding is under way */
  get running() {
    return this.#running !== null;
  }

  /**
   * Starts a binding, unless one is under way already.
   * @returns {Promise<void> | null} settles when it ends, for tests; null when one was under way
   */
  start() {
    if (this.#running) {
      return null;
    }

    this.#running = this.#run().finally(() => {
      this.#running = null;
    });

    return this.#running;
  }

  async #run() {
    let unit;

    try {
      unit = await this.#bind();
    } catch (error) {
      await this.#onFailed(error).catch(() => {});

      return;
    }

    await this.#onBound(unit).catch((error) => this.#onFailed(error)).catch(() => {});
  }
}
