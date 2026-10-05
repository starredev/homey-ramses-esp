import { ValidationError } from '../errors.js';
import { isAddress, NO_ADDRESS, Packet } from './Packet.js';

/**
 * @typedef {object} Binding
 * One entry of a `1FC9` packet: a code the device sends (offer) or answers
 * with (accept), under an index, from an address.
 * @property {string} index two hex digits
 * @property {string} code four hex digits
 * @property {string} address
 */

/**
 * @typedef {object} BindingMessage
 * @property {'offer' | 'accept' | 'confirm'} phase
 * @property {string} from
 * @property {string | null} to
 * @property {Binding[]} bindings
 */

/** Binding phases. */
export const Phase = Object.freeze({
  OFFER: 'offer',
  ACCEPT: 'accept',
  CONFIRM: 'confirm',
});

/**
 * What a remote offers when it binds, as Orcon and Itho remotes do:
 * fan mode, boost timer, device info and the binding itself.
 * @type {ReadonlyArray<readonly [string, string]>}
 */
export const REMOTE_OFFER = Object.freeze([
  ['00', '22F1'],
  ['00', '22F3'],
  ['67', '10E0'],
  ['00', '1FC9'],
]);

/**
 * What a CO₂ control sensor offers, as an Orcon CO2 15RF does: it binds as a
 * remote (AUTO + 1 on the sensor) and sends its CO₂ and ventilation demand
 * afterwards. An Orcon unit ignored the offer of a plain sensor
 * (31E0, 1298, 2E10); this is the offer a real Orcon unit accepted from a
 * type 37 device in the ramses_rf logs.
 * @type {ReadonlyArray<readonly [string, string]>}
 */
export const SENSOR_OFFER = REMOTE_OFFER;

/**
 * The offer of a plain CO₂ sensor (ventilation demand, CO₂, presence), for
 * units that bind sensors that way.
 * @type {ReadonlyArray<readonly [string, string]>}
 */
export const PLAIN_SENSOR_OFFER = Object.freeze([
  ['00', '31E0'],
  ['00', '1298'],
  ['00', '2E10'],
  ['01', '10E0'],
  ['00', '1FC9'],
]);

/**
 * Encodes an address as the three bytes a `1FC9` carries: the device type
 * in the top six bits, the number in the lower eighteen.
 * @param {string} address e.g. `29:091138`
 * @returns {string} six hex digits, e.g. `756402`
 */
export function encodeAddress(address) {
  if (!isAddress(address)) {
    throw new ValidationError(`"${address}" is not a device address`);
  }

  const [type, number] = address.split(':').map(Number);

  return ((type << 18) + number).toString(16).toUpperCase().padStart(6, '0');
}

/**
 * @param {string} hex six hex digits
 * @returns {string} the address, e.g. `29:091138`
 */
export function decodeAddress(hex) {
  const value = parseInt(hex, 16);
  const type = value >> 18;
  const number = value & 0x3ffff;

  return `${String(type).padStart(2, '0')}:${String(number).padStart(6, '0')}`;
}

/**
 * Reads a `1FC9` packet.
 * @param {Packet} packet
 * @returns {BindingMessage | null}
 */
export function parseBinding(packet) {
  if (packet.code !== '1FC9') {
    return null;
  }

  /** @type {Binding[]} */
  const bindings = [];

  for (let offset = 0; offset + 12 <= packet.payload.length; offset += 12) {
    const group = packet.payload.slice(offset, offset + 12);

    bindings.push({
      index: group.slice(0, 2),
      code: group.slice(2, 6),
      address: decodeAddress(group.slice(6, 12)),
    });
  }

  /** @type {BindingMessage['phase']} */
  let phase = Phase.OFFER;

  if (packet.verb === 'W') {
    phase = Phase.ACCEPT;
  } else if (packet.dst !== null && bindings.every((binding) => binding.code === 'FFFF' || binding.code === '1FC9')) {
    phase = Phase.CONFIRM;
  }

  return {
    phase, from: packet.src, to: packet.dst, bindings,
  };
}

/**
 * The offer a device broadcasts to bind with whatever unit is in binding mode.
 * @param {string} supplicant the address that wants to bind
 * @param {ReadonlyArray<readonly [string, string]>} offer index and code pairs
 * @returns {Packet}
 */
export function offerPacket(supplicant, offer) {
  const address = encodeAddress(supplicant);
  const payload = offer.map(([index, code]) => `${index}${code}${address}`).join('');

  return new Packet({
    verb: 'I',
    addresses: [supplicant, NO_ADDRESS, supplicant],
    code: '1FC9',
    payload,
  });
}

/**
 * The confirmation that closes a binding after the unit accepted.
 * @param {string} supplicant
 * @param {string} unit the address that accepted
 * @returns {Packet}
 */
export function confirmPacket(supplicant, unit) {
  return Packet.create({
    verb: 'I',
    src: supplicant,
    dst: unit,
    code: '1FC9',
    payload: '00',
  });
}

/**
 * A free address for a device Homey plays, of the given type, avoiding
 * addresses already on the bus.
 * @param {string} type two digits, `29` for a remote, `37` for a CO₂ sensor
 * @param {Set<string>} taken
 * @param {() => number} [random] 0..1, injectable for tests
 * @returns {string}
 */
export function freeAddress(type, taken, random = Math.random) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const number = 100000 + Math.floor(random() * 162143);
    const address = `${type}:${String(number).padStart(6, '0')}`;

    if (!taken.has(address)) {
      return address;
    }
  }

  throw new ValidationError(`No free ${type}: address found`);
}
