import { RamsesError } from '../errors.js';
import {
  confirmPacket, offerPacket, parseBinding, Phase,
} from '../ramses/binding.js';

/** @typedef {import('../ramses/Packet.js').Packet} Packet */
/** @typedef {import('../timers.js').Timers} Timers */

/** No unit accepted the offer in time; the unit was not in binding mode. */
export class BindingTimeoutError extends RamsesError {
  constructor() {
    super('No unit accepted the binding; put the unit in binding mode first', { code: 'BINDING_TIMEOUT' });
  }
}

/**
 * Binds a device Homey plays (a remote, a CO₂ sensor) to a unit in binding
 * mode: repeats the offer until a unit accepts, then confirms. Only the
 * expected unit counts when one is given, so a neighbour's unit that happens
 * to be in binding mode is not bound by accident.
 */
export class BindingSession {
  /** Time between two offers. */
  static OFFER_INTERVAL_MS = 5000;

  /** How long to keep offering. */
  static TIMEOUT_MS = 90000;

  /** @type {string} */
  #supplicant;

  /** @type {ReadonlyArray<readonly [string, string]>} */
  #offer;

  /** @type {string | null} */
  #expected;

  /** @type {(packet: Packet) => Promise<void>} */
  #send;

  /** @type {Timers} */
  #timers;

  /** @type {Array<unknown>} */
  #handles = [];

  /** @type {((unit: string) => void) | null} */
  #resolve = null;

  /**
   * @param {object} options
   * @param {string} options.supplicant the address Homey binds as
   * @param {ReadonlyArray<readonly [string, string]>} options.offer index and code pairs
   * @param {string | null} [options.unit] the only unit that may accept
   * @param {(packet: Packet) => Promise<void>} options.send
   * @param {Timers} options.timers
   */
  constructor({ supplicant, offer, unit = null, send, timers }) {
    this.#supplicant = supplicant;
    this.#offer = offer;
    this.#expected = unit;
    this.#send = send;
    this.#timers = timers;
  }

  /** @returns {string} */
  get supplicant() {
    return this.#supplicant;
  }

  /**
   * Starts offering.
   * @returns {Promise<string>} the address of the unit that accepted
   */
  start() {
    return new Promise((resolve, reject) => {
      this.#resolve = resolve;

      const deadline = this.#timers.setTimeout(() => {
        this.#finish();
        reject(new BindingTimeoutError());
      }, BindingSession.TIMEOUT_MS);

      this.#handles.push(deadline);
      this.#sendOffer(reject);
    });
  }

  /**
   * Offers a packet heard on the bus to the session.
   * @param {Packet} packet
   * @returns {boolean} whether it completed the binding
   */
  handle(packet) {
    const message = parseBinding(packet);

    if (!this.#resolve || message?.phase !== Phase.ACCEPT || message.to !== this.#supplicant) {
      return false;
    }

    if (this.#expected && message.from !== this.#expected) {
      return false;
    }

    const resolve = this.#resolve;

    this.#finish();
    this.#send(confirmPacket(this.#supplicant, message.from)).catch(() => {});
    resolve(message.from);

    return true;
  }

  /** Stops offering without a result. */
  cancel() {
    this.#finish();
  }

  /** @param {(error: unknown) => void} reject */
  #sendOffer(reject) {
    if (!this.#resolve) {
      return;
    }

    this.#send(offerPacket(this.#supplicant, this.#offer)).catch((error) => {
      this.#finish();
      reject(error);
    });

    this.#handles.push(this.#timers.setTimeout(() => {
      this.#sendOffer(reject);
    }, BindingSession.OFFER_INTERVAL_MS));
  }

  #finish() {
    this.#resolve = null;

    for (const handle of this.#handles) {
      this.#timers.clearTimeout(handle);
    }

    this.#handles = [];
  }
}
