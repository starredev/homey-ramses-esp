import { EventEmitter } from 'node:events';
import { NotConnectedError } from '../errors.js';

/** @typedef {import('../domain/Gateway.js').Gateway} Gateway */
/** @typedef {import('../ramses/Packet.js').Packet} Packet */

/**
 * App-wide register of the gateways that are paired. Devices listen here for
 * packets instead of on one gateway, so a unit keeps working when it is heard
 * through another gateway, and commands go out through any gateway online.
 *
 * Events:
 * - `packet` (Packet, { echo }, Gateway)
 * - `discovered` (DeviceDiscovered, Gateway)
 * - `changed` () a gateway was added, removed or changed status
 */
export class GatewayRegistry extends EventEmitter {
  /** @type {Map<string, { gateway: Gateway, detach: () => void }>} */
  #entries = new Map();

  constructor() {
    super();
    this.setMaxListeners(0);
  }

  /** @param {Gateway} gateway */
  add(gateway) {
    this.remove(gateway.id);

    /** @type {Array<[string, (...args: any[]) => void]>} */
    const listeners = [
      ['packet', (packet, context) => {
        this.emit('packet', packet, context, gateway);
      }],
      ['discovered', (event) => {
        this.emit('discovered', event, gateway);
      }],
      ['connected', () => {
        this.emit('changed');
      }],
      ['disconnected', () => {
        this.emit('changed');
      }],
      ['online', () => {
        this.emit('changed');
      }],
    ];

    for (const [event, listener] of listeners) {
      gateway.on(event, listener);
    }

    this.#entries.set(gateway.id, {
      gateway,
      detach: () => {
        for (const [event, listener] of listeners) {
          gateway.off(event, listener);
        }
      },
    });
    this.emit('changed');
  }

  /** @param {string} id */
  remove(id) {
    const entry = this.#entries.get(id);

    if (!entry) {
      return;
    }

    entry.detach();
    this.#entries.delete(id);
    this.emit('changed');
  }

  /**
   * @param {string} id
   * @returns {Gateway | null}
   */
  get(id) {
    return this.#entries.get(id)?.gateway ?? null;
  }

  /** @returns {Gateway[]} */
  list() {
    return [...this.#entries.values()].map((entry) => entry.gateway);
  }

  /** @returns {number} */
  get size() {
    return this.#entries.size;
  }

  /**
   * The gateway to transmit through: the preferred one when it is connected,
   * otherwise any connected one.
   * @param {string | null} [preferred]
   * @returns {Gateway | null}
   */
  pick(preferred) {
    const first = preferred ? this.get(preferred) : null;

    if (first?.connected) {
      return first;
    }

    return this.list().find((gateway) => gateway.connected) ?? null;
  }

  /**
   * @param {Packet} packet
   * @param {string | null} [preferred] gateway id
   * @returns {Promise<void>}
   */
  async send(packet, preferred) {
    const gateway = this.pick(preferred);

    if (!gateway) {
      throw new NotConnectedError(this.size === 0 ? 'no gateway added' : 'no gateway connected');
    }

    await gateway.send(packet);
  }
}
