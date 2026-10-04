import { ValidationError } from '../errors.js';

/** Placeholder for an empty address slot. */
export const NO_ADDRESS = '--:------';

/** Broadcast address used by some devices for announcements. */
export const BROADCAST = '63:262142';

/** Largest payload a RAMSES II frame carries, in bytes. */
const MAX_PAYLOAD_BYTES = 48;

const ADDRESS = /^\d{2}:\d{6}$/;

const ADDRESS_SLOT = /^(?:\d{2}:\d{6}|--:------)$/;

const VERBS = new Set(['I', 'RQ', 'RP', 'W']);

/**
 * A frame line as ramses_esp publishes it, e.g.
 * `045  I --- 29:173894 29:233244 --:------ 22F1 003 000304`
 * (the leading RSSI is optional).
 */
const FRAME = /^(?:(\d{3})\s+)?(I|RQ|RP|W)\s+(---|\d{3})\s+(\S+)\s+(\S+)\s+(\S+)\s+([0-9A-F]{4})\s+(\d{3})\s+([0-9A-F]*)$/i;

/**
 * @param {string} value
 * @returns {boolean} whether the value is a device address like `29:173894`
 */
export function isAddress(value) {
  return ADDRESS.test(String(value ?? ''));
}

/**
 * @param {string} value
 * @returns {boolean} whether the address points at a real device (not empty, not broadcast)
 */
export function isDeviceAddress(value) {
  return isAddress(value) && value !== BROADCAST;
}

/**
 * Takes the bare frame out of an MQTT payload; ramses_esp wraps it as
 * `{"msg": "...", "ts": "..."}`, other tools publish the line as is.
 * @param {string} text
 * @returns {string}
 */
export function unwrap(text) {
  const line = String(text ?? '').trim();

  if (!line.startsWith('{')) {
    return line;
  }

  try {
    const json = JSON.parse(line);

    return typeof json?.msg === 'string' ? json.msg.trim() : '';
  } catch {
    return '';
  }
}

/**
 * One RAMSES II frame: who sent what to whom.
 */
export class Packet {
  /**
   * @param {object} fields
   * @param {string} fields.verb `I`, `RQ`, `RP` or `W`
   * @param {string[]} fields.addresses the three address slots
   * @param {string} fields.code four hex digits, upper case
   * @param {string} fields.payload hex, upper case
   * @param {number | null} [fields.rssi]
   * @param {string} [fields.seq]
   */
  constructor({ verb, addresses, code, payload, rssi = null, seq = '---' }) {
    this.verb = verb;
    this.addresses = Object.freeze([...addresses]);
    this.code = code;
    this.payload = payload;
    this.rssi = rssi;
    this.seq = seq;
    Object.freeze(this);
  }

  /**
   * Parses a frame, or returns null when the text is not a RAMSES II frame.
   * @param {string} text a bare line or an MQTT payload
   * @returns {Packet | null}
   */
  static parse(text) {
    const match = unwrap(text).match(FRAME);

    if (!match) {
      return null;
    }

    const [, rssi, verb, seq, a0, a1, a2, code, length, payload] = match;
    const addresses = [a0, a1, a2];

    if (!addresses.every((slot) => ADDRESS_SLOT.test(slot))) {
      return null;
    }

    if (payload.length !== Number(length) * 2) {
      return null;
    }

    return new Packet({
      verb: verb.toUpperCase(),
      addresses,
      code: code.toUpperCase(),
      payload: payload.toUpperCase(),
      rssi: rssi === undefined ? null : Number(rssi),
      seq,
    });
  }

  /**
   * Builds an outgoing frame and checks it against the protocol rules.
   * @param {object} fields
   * @param {string} fields.verb
   * @param {string} fields.src
   * @param {string | null} [fields.dst] null for an announcement
   * @param {string} fields.code
   * @param {string} [fields.payload]
   * @returns {Packet}
   */
  static create({ verb, src, dst = null, code, payload = '' }) {
    const upperVerb = String(verb ?? '').trim().toUpperCase();
    const upperCode = String(code ?? '').trim().toUpperCase();
    const upperPayload = String(payload ?? '').replace(/\s+/g, '').toUpperCase();

    if (!VERBS.has(upperVerb)) {
      throw new ValidationError(`Unknown verb "${verb}"; use I, RQ, RP or W`);
    }

    if (!isAddress(src)) {
      throw new ValidationError(`"${src}" is not a device address like 18:123456`);
    }

    if (dst !== null && !isAddress(dst)) {
      throw new ValidationError(`"${dst}" is not a device address like 29:123456`);
    }

    if (!/^[0-9A-F]{4}$/.test(upperCode)) {
      throw new ValidationError(`"${code}" is not a 4-digit hex message code`);
    }

    if (!/^(?:[0-9A-F]{2})+$/.test(upperPayload) || upperPayload.length > MAX_PAYLOAD_BYTES * 2) {
      throw new ValidationError(`The payload must be 1 to ${MAX_PAYLOAD_BYTES} hex bytes`);
    }

    return new Packet({
      verb: upperVerb,
      addresses: [src, dst ?? NO_ADDRESS, NO_ADDRESS],
      code: upperCode,
      payload: upperPayload,
    });
  }

  /**
   * Parses a frame typed by a user (for the raw-send flow card) and rejects
   * anything that is not well formed.
   * @param {string} text
   * @returns {Packet}
   */
  static fromUserInput(text) {
    const packet = Packet.parse(text);

    if (!packet) {
      throw new ValidationError('Not a valid RAMSES frame, e.g. " I --- 18:123456 29:123456 --:------ 22F1 003 000304"');
    }

    return packet;
  }

  /** @returns {string} the sending device */
  get src() {
    const [first, , third] = this.addresses;

    return first === NO_ADDRESS ? third : first;
  }

  /** @returns {string | null} the receiving device; null for announcements and broadcasts */
  get dst() {
    const [, second, third] = this.addresses;
    const src = this.src;

    for (const candidate of [second, third]) {
      if (isDeviceAddress(candidate) && candidate !== src) {
        return candidate;
      }
    }

    return null;
  }

  /** @returns {number} payload length in bytes */
  get length() {
    return this.payload.length / 2;
  }

  /**
   * The frame as ramses_esp expects it on the `tx` topic (no RSSI).
   * @returns {string}
   */
  toFrame() {
    const length = String(this.length).padStart(3, '0');

    return `${this.verb.padStart(2, ' ')} ${this.seq} ${this.addresses.join(' ')} ${this.code} ${length} ${this.payload}`;
  }

  /** @returns {string} */
  toString() {
    return this.toFrame();
  }
}
