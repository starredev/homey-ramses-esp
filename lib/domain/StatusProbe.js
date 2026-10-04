/**
 * Learns whether a unit answers requests for an optional code (extended
 * status, humidity). Homey keeps asking while the unit might answer and stops
 * after a few requests without one, so units without that sensor get no
 * pointless traffic.
 */
export class StatusProbe {
  /** Requests without an answer after which the unit is taken not to know the code. */
  static ATTEMPTS = 2;

  /** @type {boolean | null} */
  #supported = null;

  #unanswered = 0;

  /** @returns {boolean | null} whether the unit answers; null until known */
  get supported() {
    return this.#supported;
  }

  /**
   * Decides whether to ask now, and counts the request.
   * @returns {boolean}
   */
  shouldAsk() {
    if (this.#supported === false) {
      return false;
    }

    if (this.#supported === null && this.#unanswered >= StatusProbe.ATTEMPTS) {
      this.#supported = false;

      return false;
    }

    this.#unanswered += 1;

    return true;
  }

  /** The unit reported the code. */
  answered() {
    this.#supported = true;
    this.#unanswered = 0;
  }
}
