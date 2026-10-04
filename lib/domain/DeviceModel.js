import { EventEmitter } from 'node:events';
import { decode } from '../ramses/decoders.js';
import { DeviceInfoReceived, ReadingChanged } from './events.js';
import { RepeatFilter } from './RepeatFilter.js';

/** @typedef {import('../ramses/Packet.js').Packet} Packet */
/** @typedef {import('./events.js').DeviceEvent} DeviceEvent */

/**
 * @typedef {object} PacketContext
 * @property {boolean} [echo] the frame is Homey's own transmission, heard back
 */

/**
 * Base of every device on the bus. Routes the packets that concern this
 * device to {@link DeviceModel#fromDevice} (sent by it) or
 * {@link DeviceModel#toDevice} (sent to it), and keeps its readings.
 *
 * Emits `event` with a domain event, and `seen` whenever the device talked.
 */
export class DeviceModel extends EventEmitter {
  /** @type {string} */
  #address;

  /** @type {Map<string, number | boolean>} */
  #readings = new Map();

  /** @type {() => number} */
  #clock;

  /** @type {number | null} */
  #lastSeen = null;

  /** @type {string | null} */
  #model = null;

  /**
   * @param {object} options
   * @param {string} options.address
   * @param {() => number} [options.clock]
   */
  constructor({ address, clock = Date.now }) {
    super();
    this.#address = address;
    this.#clock = clock;
    this.repeats = new RepeatFilter({ clock });
  }

  /** @returns {string} */
  get address() {
    return this.#address;
  }

  /** @returns {number | null} epoch ms of the last packet it sent */
  get lastSeen() {
    return this.#lastSeen;
  }

  /**
   * @param {string} key
   * @returns {number | boolean | undefined}
   */
  reading(key) {
    return this.#readings.get(key);
  }

  /** @returns {Record<string, number | boolean>} */
  readings() {
    return Object.fromEntries(this.#readings);
  }

  /**
   * Offers a packet heard on the bus.
   * @param {Packet} packet
   * @param {PacketContext} [context]
   * @returns {boolean} whether the packet concerned this device
   */
  accept(packet, context = {}) {
    if (packet.src === this.#address) {
      this.#lastSeen = this.#clock();
      this.emit('seen', packet);
      this.#takeInfo(packet);
      this.fromDevice(packet, context);

      return true;
    }

    if (packet.dst === this.#address) {
      this.toDevice(packet, context);

      return true;
    }

    return false;
  }

  /**
   * A packet this device sent. Subclasses override.
   * @param {Packet} _packet
   * @param {PacketContext} _context
   */
  fromDevice(_packet, _context) {}

  /**
   * A packet sent to this device. Subclasses override.
   * @param {Packet} _packet
   * @param {PacketContext} _context
   */
  toDevice(_packet, _context) {}

  /**
   * Stores readings and emits {@link ReadingChanged} for each one that changed.
   * @param {Record<string, number | boolean> | undefined} readings
   */
  applyReadings(readings) {
    for (const [key, value] of Object.entries(readings ?? {})) {
      const previous = this.#readings.get(key);

      if (previous === value) {
        continue;
      }

      this.#readings.set(key, value);
      this.publish(new ReadingChanged(key, value, previous));
    }
  }

  /** @param {DeviceEvent} event */
  publish(event) {
    this.emit('event', event);
  }

  /** @param {Packet} packet */
  #takeInfo(packet) {
    const { model } = packet.code === '10E0' ? decode(packet) : {};

    if (model && model !== this.#model) {
      this.#model = model;
      this.publish(new DeviceInfoReceived(model));
    }
  }

  /** @returns {string | null} the model the device reported */
  get model() {
    return this.#model;
  }
}
