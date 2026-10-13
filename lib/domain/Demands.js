/**
 * @typedef {object} Demand
 * @property {number} percent the highest ventilation demand still standing
 * @property {string | null} by the sensor that asks it; null when nobody asks for more than 0 %
 */

/**
 * The ventilation demands sensors send to one unit (31E0). A unit in auto
 * ventilates on the highest of them. Sensors repeat their demand every few
 * minutes; a demand that is not repeated in time no longer counts.
 */
export class Demands {
  /** A sensor that stays silent this long no longer asks anything. */
  static TTL_MS = 15 * 60 * 1000;

  /** @type {() => number} */
  #clock;

  /** @type {number} */
  #ttl;

  /** @type {Map<string, { percent: number, at: number }>} */
  #entries = new Map();

  /**
   * @param {object} [options]
   * @param {() => number} [options.clock]
   * @param {number} [options.ttl] milliseconds a demand stands
   */
  constructor({ clock = Date.now, ttl = Demands.TTL_MS } = {}) {
    this.#clock = clock;
    this.#ttl = ttl;
  }

  /**
   * @param {string} address the sensor that sent it
   * @param {number} percent
   */
  record(address, percent) {
    this.#entries.set(address, { percent, at: this.#clock() });
  }

  /** @returns {Demand | null} null when no sensor asked anything lately */
  highest() {
    const now = this.#clock();
    /** @type {[string, { percent: number }] | null} */
    let best = null;

    for (const [address, entry] of this.#entries) {
      if (now - entry.at >= this.#ttl) {
        this.#entries.delete(address);
      } else if (best === null || entry.percent > best[1].percent) {
        best = [address, entry];
      }
    }

    if (best === null) {
      return null;
    }

    return { percent: best[1].percent, by: best[1].percent > 0 ? best[0] : null };
  }
}
