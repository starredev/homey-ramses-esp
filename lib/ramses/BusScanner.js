import {
  FAN_CODES, PREFIX_HINTS, REMOTE_CODES, SENSOR_CODES,
} from './codes.js';
import { isDeviceAddress } from './Packet.js';

/** Ventilation demand a sensor sends to the unit it is bound to. */
const DEMAND_CODE = '31E0';

/** @typedef {import('./Packet.js').Packet} Packet */

/** What a device on the bus most likely is. */
export const Role = Object.freeze({
  GATEWAY: 'gateway',
  FAN: 'fan',
  REMOTE: 'remote',
  SENSOR: 'sensor',
  UNKNOWN: 'unknown',
});

/**
 * @typedef {object} BusDeviceSnapshot
 * Serialisable state of one device, for persistence and the web views.
 * @property {string} id
 * @property {string} role
 * @property {number} firstSeen epoch ms
 * @property {number} lastSeen epoch ms
 * @property {number} sent packets sent
 * @property {number} received packets addressed to it
 * @property {Record<string, number>} codes count per code it reported (requests excluded)
 * @property {string[]} commands devices it sent fan commands (22F1/22F3) to
 * @property {string[]} demands units it sent a ventilation demand (31E0) to
 * @property {boolean} [commanded] it received fan commands or a ventilation demand
 * @property {number | null} rssi signal of its last packet
 * @property {string | null} hint guess from the address prefix
 */

/**
 * Infers the role of a device from the codes it sends; the address prefix
 * decides only when the codes do not. A device that sends a ventilation
 * demand (31E0) is a sensor, even when it has buttons and never reports a
 * measurement of its own, like some humidity control sensors. A device that
 * only ever received fan commands or a ventilation demand is a unit that has
 * not reported yet; many units stay silent until asked.
 * @param {string} id
 * @param {string[]} codes
 * @param {boolean} [commanded] whether remotes or sensors sent it fan commands
 * @returns {string}
 */
export function roleOf(id, codes, commanded = false) {
  const prefix = id.slice(0, 2);
  const sends = (/** @type {readonly string[]} */ list) => codes.some((code) => list.includes(code));

  if (prefix === '18') {
    return Role.GATEWAY;
  }

  if (sends(FAN_CODES)) {
    return Role.FAN;
  }

  if (sends(SENSOR_CODES) || codes.includes(DEMAND_CODE)) {
    return Role.SENSOR;
  }

  if (sends(REMOTE_CODES)) {
    return Role.REMOTE;
  }

  if (commanded) {
    return Role.FAN;
  }

  if (prefix === '30') {
    return Role.GATEWAY;
  }

  return Role.UNKNOWN;
}

/** One device seen on the bus. */
class BusDevice {
  /**
   * @param {string} id
   * @param {number} now
   */
  constructor(id, now) {
    this.id = id;
    this.firstSeen = now;
    this.lastSeen = now;
    this.sent = 0;
    this.received = 0;
    /** @type {Map<string, number>} */
    this.codes = new Map();
    /** @type {Set<string>} */
    this.commands = new Set();
    /** @type {Set<string>} */
    this.demands = new Set();
    /** @type {number | null} */
    this.rssi = null;
    this.commanded = false;
  }

  /** @returns {string} */
  get role() {
    return roleOf(this.id, [...this.codes.keys()], this.commanded);
  }

  /** @returns {BusDeviceSnapshot} */
  toJSON() {
    return {
      id: this.id,
      role: this.role,
      firstSeen: this.firstSeen,
      lastSeen: this.lastSeen,
      sent: this.sent,
      received: this.received,
      codes: Object.fromEntries([...this.codes].sort(([a], [b]) => a.localeCompare(b))),
      commands: [...this.commands].sort(),
      demands: [...this.demands].sort(),
      commanded: this.commanded,
      rssi: this.rssi,
      hint: PREFIX_HINTS[/** @type {keyof typeof PREFIX_HINTS} */ (this.id.slice(0, 2))] ?? null,
    };
  }

  /**
   * @param {BusDeviceSnapshot} snapshot
   * @returns {BusDevice}
   */
  static from(snapshot) {
    const device = new BusDevice(snapshot.id, snapshot.firstSeen);

    device.lastSeen = snapshot.lastSeen;
    device.sent = snapshot.sent;
    device.received = snapshot.received;
    device.codes = new Map(Object.entries(snapshot.codes ?? {}));
    device.commands = new Set(snapshot.commands ?? []);
    device.demands = new Set(snapshot.demands ?? []);
    device.rssi = snapshot.rssi ?? null;
    device.commanded = snapshot.commanded === true;

    return device;
  }
}

/**
 * Learns which devices are on the bus from the packets passing by: who
 * exists, what they send and which remote commands which unit.
 */
export class BusScanner {
  /** @type {Map<string, BusDevice>} */
  #devices = new Map();

  /** @type {() => number} */
  #clock;

  /**
   * @param {object} [options]
   * @param {() => number} [options.clock] epoch ms; injectable for tests
   * @param {BusDeviceSnapshot[]} [options.snapshot] devices from a previous run
   */
  constructor({ clock = Date.now, snapshot = [] } = {}) {
    this.#clock = clock;

    for (const entry of snapshot) {
      if (isDeviceAddress(entry?.id)) {
        this.#devices.set(entry.id, BusDevice.from(entry));
      }
    }
  }

  /**
   * Records a packet.
   * @param {Packet} packet
   * @returns {string[]} the addresses seen for the first time
   */
  record(packet) {
    const now = this.#clock();
    const discovered = [];
    const { src, dst } = packet;

    if (isDeviceAddress(src)) {
      const [sender, isNew] = this.#touch(src, now);

      sender.sent += 1;

      // A request asks for a code; only what a device reports says what it is.
      if (packet.verb !== 'RQ') {
        sender.codes.set(packet.code, (sender.codes.get(packet.code) ?? 0) + 1);
      }

      if (packet.rssi !== null) {
        sender.rssi = packet.rssi;
      }

      if (dst && packet.verb === 'I' && REMOTE_CODES.includes(packet.code)) {
        sender.commands.add(dst);
      }

      if (dst && packet.verb === 'I' && packet.code === DEMAND_CODE) {
        sender.demands.add(dst);
      }

      if (isNew) {
        discovered.push(src);
      }
    }

    if (dst) {
      const [receiver, isNew] = this.#touch(dst, now);

      receiver.received += 1;

      if (packet.verb === 'I' && (REMOTE_CODES.includes(packet.code) || packet.code === DEMAND_CODE)) {
        receiver.commanded = true;
      }

      if (isNew) {
        discovered.push(dst);
      }
    }

    return discovered;
  }

  /**
   * @param {string} id
   * @returns {BusDeviceSnapshot | null}
   */
  get(id) {
    return this.#devices.get(id)?.toJSON() ?? null;
  }

  /**
   * Every device, the busiest first.
   * @param {string} [role] only devices with this role
   * @returns {BusDeviceSnapshot[]}
   */
  list(role) {
    return [...this.#devices.values()]
      .map((device) => device.toJSON())
      .filter((device) => !role || device.role === role)
      .sort((a, b) => (b.sent + b.received) - (a.sent + a.received) || a.id.localeCompare(b.id));
  }

  /**
   * The devices a unit is bound to, so Homey can command it in their name:
   * first those that sent it fan commands (remotes), then those that sent it
   * a ventilation demand (CO₂ and humidity sensors).
   * @param {string} unit
   * @returns {string[]} remotes first, each group most active first
   */
  controllersOf(unit) {
    const devices = this.list();
    const remotes = devices.filter((device) => device.commands.includes(unit));
    const sensors = devices.filter((device) => !remotes.includes(device) && device.demands.includes(unit));

    return [...remotes, ...sensors].map((device) => device.id);
  }

  /** @returns {number} */
  get size() {
    return this.#devices.size;
  }

  /** @returns {BusDeviceSnapshot[]} */
  toJSON() {
    return this.list();
  }

  /**
   * @param {string} id
   * @param {number} now
   * @returns {[BusDevice, boolean]} the device and whether it is new
   */
  #touch(id, now) {
    const known = this.#devices.get(id);

    if (known) {
      known.lastSeen = now;

      return [known, false];
    }

    const device = new BusDevice(id, now);

    this.#devices.set(id, device);

    return [device, true];
  }
}
