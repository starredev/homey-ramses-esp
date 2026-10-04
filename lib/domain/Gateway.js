import { EventEmitter } from 'node:events';
import { BusScanner } from '../ramses/BusScanner.js';
import { DeviceDiscovered } from './events.js';
import { RepeatFilter } from './RepeatFilter.js';

/** @typedef {import('../ramses/Packet.js').Packet} Packet */
/** @typedef {import('../mqtt/GatewayConnection.js').GatewayConnection} GatewayConnection */
/** @typedef {import('../ramses/BusScanner.js').BusDeviceSnapshot} BusDeviceSnapshot */

/**
 * One ramses_esp on the bus: forwards what it hears, scans which devices
 * exist and transmits frames. It recognises its own transmissions when the
 * radio hears them back (echo), so they are not taken for remote presses.
 *
 * Events:
 * - `packet` (Packet, { echo }) every frame heard
 * - `discovered` (DeviceDiscovered) a device heard for the first time
 * - `connected` / `disconnected` the broker connection
 * - `online` (boolean) the gateway's own status
 * - `authFailed` (Error)
 */
export class Gateway extends EventEmitter {
  /** @type {GatewayConnection} */
  #connection;

  /** @type {BusScanner} */
  #scanner;

  /** @type {RepeatFilter} */
  #transmitted;

  /** @type {boolean | null} */
  #online = null;

  /** @type {number} */
  #packets = 0;

  /**
   * @param {object} options
   * @param {GatewayConnection} options.connection
   * @param {BusScanner} [options.scanner]
   * @param {() => number} [options.clock]
   */
  constructor({ connection, scanner, clock = Date.now }) {
    super();
    this.setMaxListeners(0);
    this.#connection = connection;
    this.#scanner = scanner ?? new BusScanner({ clock });
    this.#transmitted = new RepeatFilter({ clock, window: 5000 });

    connection.on('packet', (packet) => {
      this.#onPacket(packet);
    });
    connection.on('connected', () => {
      this.emit('connected');
    });
    connection.on('disconnected', () => {
      this.emit('disconnected');
    });
    connection.on('online', (online) => {
      this.#online = online;
      this.emit('online', online);
    });
    connection.on('authFailed', (error) => {
      this.emit('authFailed', error);
    });
  }

  /** @returns {string} */
  get id() {
    return this.#connection.gatewayId;
  }

  /** @returns {boolean} */
  get connected() {
    return this.#connection.connected;
  }

  /** @returns {boolean | null} the gateway's own status; null until it reported */
  get online() {
    return this.#online;
  }

  /** @returns {number} frames heard since start */
  get packetCount() {
    return this.#packets;
  }

  /** @returns {BusScanner} */
  get scanner() {
    return this.#scanner;
  }

  /** @returns {GatewayConnection} */
  get connection() {
    return this.#connection;
  }

  start() {
    this.#connection.start();
  }

  stop() {
    this.#connection.stop();
  }

  /**
   * @param {Packet} packet
   * @returns {Promise<void>}
   */
  async send(packet) {
    this.#transmitted.remember(packet);
    await this.#connection.send(packet);
  }

  /** @param {Packet} packet */
  #onPacket(packet) {
    this.#packets += 1;

    const echo = this.#transmitted.has(packet);
    const discovered = this.#scanner.record(packet);

    this.emit('packet', packet, { echo });

    for (const id of discovered) {
      const role = this.#scanner.get(id)?.role ?? 'unknown';

      this.emit('discovered', new DeviceDiscovered(id, role));
    }
  }
}
