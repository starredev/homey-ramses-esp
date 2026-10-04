import { RamsesError } from '../errors.js';
import { delay } from '../timers.js';
import { Role } from '../ramses/BusScanner.js';
import { BrokerConfig } from '../mqtt/BrokerConfig.js';
import { isAddress } from '../ramses/Packet.js';

/** @typedef {import('./GatewayRegistry.js').GatewayRegistry} GatewayRegistry */
/** @typedef {import('../mqtt/BrokerProbe.js').BrokerProbe} BrokerProbe */
/** @typedef {import('../timers.js').Timers} Timers */

/**
 * @typedef {object} DeviceCandidate
 * A device for Homey's `list_devices` pairing template.
 * @property {string} name
 * @property {{ id: string }} data
 * @property {Record<string, unknown>} [store]
 * @property {Record<string, unknown>} [settings]
 */

/** Name of a new gateway device; its address shows as a capability. */
export const GATEWAY_NAME = 'Ramses Gateway';

/** No ramses_esp published anything on the broker. */
export class NoGatewaysError extends RamsesError {
  constructor() {
    super('No ramses_esp gateway found on the broker', { code: 'NO_GATEWAYS' });
  }
}

/** A device driver is paired before any gateway. */
export class NoGatewayAddedError extends RamsesError {
  constructor() {
    super('Add a ramses_esp gateway first', { code: 'NO_GATEWAY_ADDED' });
  }
}

/**
 * Pairing of gateways: find the ramses_esp gateways on a broker.
 */
export class GatewayPairing {
  /** @type {BrokerProbe} */
  #probe;

  /**
   * @param {BrokerProbe} probe
   */
  constructor(probe) {
    this.#probe = probe;
  }

  /**
   * @param {Record<string, unknown>} input broker form, optionally with a `gatewayId`
   * @param {Set<string>} paired gateway ids already added
   * @returns {Promise<DeviceCandidate[]>}
   */
  async find(input, paired) {
    const broker = BrokerConfig.from(input);
    const { gateways } = await this.#probe.probe(broker);
    const manual = String(input?.gatewayId ?? '').trim();
    const ids = new Set(gateways);

    if (isAddress(manual)) {
      ids.add(manual);
    }

    if (ids.size === 0) {
      throw new NoGatewaysError();
    }

    return [...ids]
      .filter((id) => !paired.has(id))
      .map((id) => ({
        name: GATEWAY_NAME,
        data: { id },
        settings: {
          host: broker.host,
          port: broker.port,
          username: broker.username,
          password: broker.password,
          tls: broker.tls,
          gateway_id: id,
        },
      }));
  }
}

/**
 * Pairing of bus devices (units, remotes, sensors): offers what the gateways
 * heard on the bus, and waits a while for devices that have not talked yet.
 */
export class DevicePairing {
  /** How long to wait for a device to talk when none is known yet. */
  static SCAN_MS = 30000;

  static POLL_MS = 1000;

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
   * The unpaired devices with a role, as heard right now.
   * @param {object} query
   * @param {string} query.role see `Role`
   * @param {Set<string>} query.paired addresses already added
   * @param {(id: string) => string} query.name device name for an address
   * @returns {DeviceCandidate[]}
   */
  candidates({ role, paired, name }) {
    if (this.#registry.size === 0) {
      throw new NoGatewayAddedError();
    }

    /** @type {Map<string, DeviceCandidate>} */
    const found = new Map();

    for (const gateway of this.#registry.list()) {
      for (const device of gateway.scanner.list(role)) {
        if (paired.has(device.id) || found.has(device.id)) {
          continue;
        }

        found.set(device.id, this.#candidate(device.id, gateway, role, name));
      }
    }

    return [...found.values()];
  }

  /**
   * Like {@link candidates}, but when none is known it keeps listening until
   * one shows up (the user presses a button) or the scan times out.
   * @param {Parameters<DevicePairing['candidates']>[0]} query
   * @returns {Promise<DeviceCandidate[]>}
   */
  async scan(query) {
    const deadline = DevicePairing.SCAN_MS / DevicePairing.POLL_MS;

    for (let round = 0; round < deadline; round += 1) {
      const candidates = this.candidates(query);

      if (candidates.length > 0) {
        return candidates;
      }

      await delay(this.#timers, DevicePairing.POLL_MS);
    }

    return this.candidates(query);
  }

  /**
   * @param {string} id
   * @param {import('../domain/Gateway.js').Gateway} gateway
   * @param {string} role
   * @param {(id: string) => string} name
   * @returns {DeviceCandidate}
   */
  #candidate(id, gateway, role, name) {
    /** @type {Record<string, unknown>} */
    const settings = { address: id, gateway: gateway.id };

    if (role === Role.FAN) {
      settings.remote_id = gateway.scanner.controllersOf(id)[0] ?? '';
    }

    return {
      name: name(id),
      data: { id },
      store: { gateway: gateway.id },
      settings,
    };
  }
}
