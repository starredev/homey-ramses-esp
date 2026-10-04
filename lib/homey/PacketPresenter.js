import { codeName } from '../ramses/codes.js';
import { decode } from '../ramses/decoders.js';

/** @typedef {import('../ramses/Packet.js').Packet} Packet */
/** @typedef {import('../ramses/BusScanner.js').BusDeviceSnapshot} BusDeviceSnapshot */

/**
 * @typedef {object} PacketView
 * A packet as the settings page shows it.
 * @property {number} time epoch ms
 * @property {string} gateway
 * @property {string} verb
 * @property {string} src
 * @property {string | null} dst
 * @property {string} code
 * @property {string} name human-readable name of the code
 * @property {string} payload
 * @property {number | null} rssi
 * @property {boolean} echo Homey's own transmission
 * @property {string} frame
 * @property {Record<string, unknown>} decoded readings, mode and boost it carries
 */

/**
 * @typedef {BusDeviceSnapshot & { gateway: string, paired: boolean }} BusDeviceView
 */

/**
 * Turns domain objects into plain JSON for the web views (settings page,
 * flow tokens), so the views never depend on the domain classes.
 */
export class PacketPresenter {
  /**
   * @param {Packet} packet
   * @param {object} context
   * @param {string} context.gateway
   * @param {boolean} [context.echo]
   * @param {number} context.time
   * @returns {PacketView}
   */
  static packet(packet, { gateway, echo = false, time }) {
    const { readings, mode, boostMinutes } = decode(packet);
    /** @type {Record<string, unknown>} */
    const decoded = { ...readings };

    if (mode) {
      decoded.mode = mode;
    }

    if (boostMinutes) {
      decoded.boostMinutes = boostMinutes;
    }

    return {
      time,
      gateway,
      verb: packet.verb,
      src: packet.src,
      dst: packet.dst,
      code: packet.code,
      name: codeName(packet.code),
      payload: packet.payload,
      rssi: packet.rssi,
      echo,
      frame: packet.toFrame(),
      decoded,
    };
  }

  /**
   * Flow tokens of the packet triggers.
   * @param {Packet} packet
   * @returns {{ verb: string, src: string, dst: string, code: string, payload: string, frame: string, rssi: number }}
   */
  static tokens(packet) {
    return {
      verb: packet.verb,
      src: packet.src,
      dst: packet.dst ?? '',
      code: packet.code,
      payload: packet.payload,
      frame: packet.toFrame(),
      rssi: packet.rssi ?? 0,
    };
  }

  /**
   * @param {BusDeviceSnapshot} device
   * @param {string} gateway
   * @param {(id: string) => boolean} isPaired
   * @returns {BusDeviceView}
   */
  static device(device, gateway, isPaired) {
    return {
      ...device,
      gateway,
      paired: isPaired(device.id),
    };
  }
}

/**
 * Keeps the most recent packets in memory for the live view.
 * @template T
 */
export class RingBuffer {
  /** @type {T[]} */
  #items = [];

  /** @type {number} */
  #capacity;

  /** @param {number} capacity */
  constructor(capacity) {
    this.#capacity = capacity;
  }

  /** @param {T} item */
  push(item) {
    this.#items.push(item);

    if (this.#items.length > this.#capacity) {
      this.#items.splice(0, this.#items.length - this.#capacity);
    }
  }

  /** @returns {T[]} oldest first */
  toArray() {
    return [...this.#items];
  }

  clear() {
    this.#items = [];
  }
}
