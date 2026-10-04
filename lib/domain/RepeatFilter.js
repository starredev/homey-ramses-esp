/** @typedef {import('../ramses/Packet.js').Packet} Packet */

/**
 * RF remotes send every command several times in quick succession, so one
 * button press arrives as a burst of identical frames. This filter lets the
 * first frame of a burst through and drops the copies.
 */
export class RepeatFilter {
  /** Identical frames within this window count as one. */
  static WINDOW_MS = 3000;

  /** @type {() => number} */
  #clock;

  /** @type {number} */
  #window;

  /** @type {Map<string, number>} frame key → time it was last seen */
  #seen = new Map();

  /**
   * @param {object} [options]
   * @param {() => number} [options.clock]
   * @param {number} [options.window] milliseconds
   */
  constructor({ clock = Date.now, window = RepeatFilter.WINDOW_MS } = {}) {
    this.#clock = clock;
    this.#window = window;
  }

  /**
   * @param {Packet} packet
   * @returns {string}
   */
  static keyOf(packet) {
    return `${packet.addresses.join(' ')} ${packet.code} ${packet.payload}`;
  }

  /**
   * Records a frame.
   * @param {Packet} packet
   * @returns {boolean} true when the same frame was seen within the window
   */
  isRepeat(packet) {
    const now = this.#clock();
    const key = RepeatFilter.keyOf(packet);
    const last = this.#seen.get(key);

    this.#seen.set(key, now);
    this.#prune(now);

    return last !== undefined && now - last < this.#window;
  }

  /**
   * Checks without recording.
   * @param {Packet} packet
   * @returns {boolean}
   */
  has(packet) {
    const last = this.#seen.get(RepeatFilter.keyOf(packet));

    return last !== undefined && this.#clock() - last < this.#window;
  }

  /** @param {Packet} packet */
  remember(packet) {
    this.#seen.set(RepeatFilter.keyOf(packet), this.#clock());
  }

  /** @param {number} now */
  #prune(now) {
    for (const [key, time] of this.#seen) {
      if (now - time >= this.#window) {
        this.#seen.delete(key);
      }
    }
  }
}
