import { BindingSession } from '../domain/BindingSession.js';
import { freeAddress } from '../ramses/binding.js';

/** @typedef {import('./GatewayRegistry.js').GatewayRegistry} GatewayRegistry */
/** @typedef {import('../timers.js').Timers} Timers */
/** @typedef {import('../ramses/Packet.js').Packet} Packet */

/**
 * Runs a binding for a device Homey plays, over every gateway: sends the
 * offers through the registry and feeds it what the gateways hear.
 */
export class Binder {
  /** @type {GatewayRegistry} */
  #registry;

  /** @type {Timers} */
  #timers;

  /**
   * @param {object} options
   * @param {GatewayRegistry} options.registry
   * @param {Timers} options.timers
   */
  constructor({ registry, timers }) {
    this.#registry = registry;
    this.#timers = timers;
  }

  /**
   * An address for a new device Homey plays, unused on every bus.
   * @param {string} type two digits: `29` remote, `37` CO₂ sensor
   * @returns {string}
   */
  freeAddress(type) {
    const taken = new Set();

    for (const gateway of this.#registry.list()) {
      for (const device of gateway.scanner.list()) {
        taken.add(device.id);
      }
    }

    return freeAddress(type, taken);
  }

  /**
   * @param {object} options
   * @param {string} options.supplicant the address Homey binds as
   * @param {ReadonlyArray<readonly [string, string]>} options.offer
   * @param {string | null} [options.unit] the only unit that may accept
   * @param {string | null} [options.gateway] the gateway to send through
   * @returns {Promise<string>} the unit that accepted
   */
  async bind({ supplicant, offer, unit = null, gateway = null }) {
    const session = new BindingSession({
      supplicant,
      offer,
      unit,
      timers: this.#timers,
      send: (packet) => this.#registry.send(packet, gateway),
    });
    /** @param {Packet} packet */
    const listener = (packet) => {
      session.handle(packet);
    };

    this.#registry.on('packet', listener);

    try {
      return await session.start();
    } finally {
      this.#registry.off('packet', listener);
    }
  }
}
