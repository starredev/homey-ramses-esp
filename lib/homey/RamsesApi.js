import { NotFoundError, ValidationError } from '../errors.js';
import { fanModes } from '../ramses/FanMode.js';
import { Packet } from '../ramses/Packet.js';
import { FanPresenter } from './FanPresenter.js';
import { PacketPresenter } from './PacketPresenter.js';

/** @typedef {import('./GatewayRegistry.js').GatewayRegistry} GatewayRegistry */
/** @typedef {import('./PacketPresenter.js').PacketView} PacketView */
/** @typedef {import('./PacketPresenter.js').BusDeviceView} BusDeviceView */
/** @typedef {import('./PacketPresenter.js').RingBuffer<PacketView>} PacketLog */
/** @typedef {import('./FanPresenter.js').FanSource} FanSource */
/** @typedef {import('./FanPresenter.js').FanView} FanView */

/**
 * @typedef {object} GatewayView
 * @property {string} id
 * @property {string} broker
 * @property {boolean} connected
 * @property {boolean | null} online
 * @property {number} devices
 * @property {number} packets
 */

/**
 * Use cases behind the web API of the app: gateways, the devices on the bus,
 * recent packets and sending a frame (settings page), and the ventilation
 * units (dashboard widget).
 */
export class RamsesApi {
  /** @type {GatewayRegistry} */
  #registry;

  /** @type {PacketLog} */
  #log;

  /** @type {(address: string) => boolean} */
  #isPaired;

  /** @type {() => FanSource[]} */
  #fans;

  /**
   * @param {object} options
   * @param {GatewayRegistry} options.registry
   * @param {PacketLog} options.log
   * @param {(address: string) => boolean} options.isPaired whether an address is added to Homey
   * @param {() => FanSource[]} [options.fans] the ventilation units added to Homey
   */
  constructor({ registry, log, isPaired, fans = () => [] }) {
    this.#registry = registry;
    this.#log = log;
    this.#isPaired = isPaired;
    this.#fans = fans;
  }

  /** @returns {FanView[]} */
  fans() {
    return this.#fans().map((source) => FanPresenter.view(source));
  }

  /**
   * One ventilation unit, or the first one when no id is given (a widget
   * that is not configured yet).
   * @param {string | undefined} id
   * @returns {FanView | null}
   */
  fan(id) {
    const source = this.#findFan(id);

    return source ? FanPresenter.view(source) : null;
  }

  /**
   * @param {unknown} body `{ id, mode }`
   * @returns {Promise<FanView>}
   */
  async setFanMode(body) {
    const { id, mode } = /** @type {{ id?: unknown, mode?: unknown }} */ (body ?? {});

    if (typeof mode !== 'string' || !fanModes().includes(mode)) {
      throw new ValidationError(`Unknown fan mode "${mode}"`);
    }

    const source = this.#findFan(typeof id === 'string' ? id : undefined);

    if (!source) {
      throw new NotFoundError('No ventilation unit');
    }

    await source.setMode(mode);

    return FanPresenter.view(source);
  }

  /**
   * @param {string | undefined} id
   * @returns {FanSource | null}
   */
  #findFan(id) {
    const fans = this.#fans();

    if (!id) {
      return fans[0] ?? null;
    }

    return fans.find((fan) => fan.id === id) ?? null;
  }

  /** @returns {GatewayView[]} */
  gateways() {
    return this.#registry.list().map((gateway) => ({
      id: gateway.id,
      broker: gateway.connection.broker.toString(),
      connected: gateway.connected,
      online: gateway.online,
      devices: gateway.scanner.size,
      packets: gateway.packetCount,
    }));
  }

  /**
   * Every device on every bus; a device heard by two gateways is listed once,
   * under the gateway that heard it most.
   * @returns {BusDeviceView[]}
   */
  devices() {
    /** @type {Map<string, BusDeviceView>} */
    const devices = new Map();

    for (const gateway of this.#registry.list()) {
      for (const device of gateway.scanner.list()) {
        const known = devices.get(device.id);

        if (!known || known.sent + known.received < device.sent + device.received) {
          devices.set(device.id, PacketPresenter.device(device, gateway.id, this.#isPaired));
        }
      }
    }

    return [...devices.values()].sort((a, b) => (b.sent + b.received) - (a.sent + a.received));
  }

  /** @returns {PacketView[]} oldest first */
  packets() {
    return this.#log.toArray();
  }

  /**
   * Transmits a frame typed by the user.
   * @param {unknown} body `{ frame, gateway? }`
   * @returns {Promise<{ frame: string, gateway: string }>}
   */
  async send(body) {
    const { frame, gateway } = /** @type {{ frame?: unknown, gateway?: unknown }} */ (body ?? {});

    if (typeof frame !== 'string' || frame.trim() === '') {
      throw new ValidationError('Enter a frame to send');
    }

    const packet = Packet.fromUserInput(frame);
    const target = this.#registry.pick(typeof gateway === 'string' ? gateway : null);

    if (!target) {
      throw new NotFoundError('No connected gateway');
    }

    await target.send(packet);

    return { frame: packet.toFrame(), gateway: target.id };
  }
}
