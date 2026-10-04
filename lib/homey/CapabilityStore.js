/** @typedef {import('../utils.js').Logger} Logger */

/**
 * @typedef {object} CapabilityHost
 * The subset of `Homey.Device` this store relies on.
 * @property {(id: string) => boolean} hasCapability
 * @property {(id: string) => unknown} getCapabilityValue
 * @property {(id: string, value: unknown) => Promise<void>} setCapabilityValue
 * @property {(id: string) => Promise<void>} addCapability
 * @property {(id: string) => Promise<void>} removeCapability
 * @property {(id: string, options: object) => Promise<void>} setCapabilityOptions
 */

/**
 * Write-through access to a device's capabilities that skips no-op writes,
 * which keeps Insights free of duplicate points and avoids needless I/O.
 */
export class CapabilityStore {
  /** @type {CapabilityHost} */
  #host;

  /** @type {Logger} */
  #logger;

  /**
   * @param {CapabilityHost} host
   * @param {Logger} logger
   */
  constructor(host, logger) {
    this.#host = host;
    this.#logger = logger;
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  has(id) {
    return this.#host.hasCapability(id);
  }

  /**
   * @param {string} id
   * @returns {unknown} the current value, or `null` when the device lacks the capability
   */
  get(id) {
    if (!this.#host.hasCapability(id)) {
      return null;
    }

    return this.#host.getCapabilityValue(id);
  }

  /**
   * Sets a value when the capability exists and the value differs.
   * Failures are logged, never thrown: a stale reading must not break the stream.
   * @param {string} id
   * @param {unknown} value
   * @returns {Promise<void>}
   */
  async set(id, value) {
    if (!this.#host.hasCapability(id) || this.#host.getCapabilityValue(id) === value) {
      return;
    }

    try {
      await this.#host.setCapabilityValue(id, value);
    } catch (error) {
      this.#logger.error(`Could not set ${id}:`, error);
    }
  }

  /**
   * @param {string} id
   * @param {object} [options]
   */
  async add(id, options = {}) {
    if (this.#host.hasCapability(id)) {
      return;
    }

    await this.#host.addCapability(id);

    if (Object.keys(options).length > 0) {
      await this.#host.setCapabilityOptions(id, options);
    }
  }

  /** @param {string} id */
  async remove(id) {
    if (this.#host.hasCapability(id)) {
      await this.#host.removeCapability(id);
    }
  }
}
