import { ValidationError } from '../errors.js';
import { NO_ADDRESS, Packet } from '../ramses/Packet.js';

/** @typedef {(packet: Packet) => Promise<void>} Sender */

/**
 * @param {number} value
 * @param {number} bytes
 * @returns {string}
 */
function hex(value, bytes) {
  return Math.round(value).toString(16).toUpperCase().padStart(bytes * 2, '0');
}

/**
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {string} what
 * @returns {number}
 */
function within(value, min, max, what) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < min || number > max) {
    throw new ValidationError(`${what} must be between ${min} and ${max}`);
  }

  return number;
}

/**
 * A CO₂ and humidity sensor that Homey plays on the bus, bound to a unit:
 * whatever Homey reports (from any sensor it knows) drives the unit's auto
 * mode as a real sensor would. Frames follow an Orcon CO2 sensor.
 */
export class VirtualSensor {
  /** @type {string} */
  #address;

  /** @type {Sender} */
  #send;

  /** @type {string | null} */
  #unit;

  /** @type {Map<string, Packet>} the last report per code, for repeating */
  #last = new Map();

  /**
   * @param {object} options
   * @param {string} options.address the address Homey plays, e.g. `37:123456`
   * @param {Sender} options.send
   * @param {string | null} [options.unit] the unit it is bound to
   */
  constructor({ address, send, unit = null }) {
    this.#address = address;
    this.#send = send;
    this.#unit = unit;
  }

  /** @returns {string} */
  get address() {
    return this.#address;
  }

  /** @returns {string | null} */
  get unit() {
    return this.#unit;
  }

  /** @param {string | null} unit */
  bindTo(unit) {
    this.#unit = unit;
  }

  /** @param {number} ppm */
  async reportCo2(ppm) {
    const value = within(ppm, 0, 0x7ffe, 'CO₂');

    await this.#report(this.#announcement('1298', `00${hex(value, 2)}`));
  }

  /** @param {number} percent relative humidity */
  async reportHumidity(percent) {
    const value = within(percent, 0, 100, 'Humidity');

    await this.#report(this.#announcement('12A0', `00${hex(value, 1)}`));
  }

  /** @param {number} percent how much ventilation the sensor asks for */
  async reportDemand(percent) {
    const value = within(percent, 0, 100, 'Demand');

    if (!this.#unit) {
      throw new ValidationError('Bind the sensor to a unit first');
    }

    await this.#report(Packet.create({
      verb: 'I',
      src: this.#address,
      dst: this.#unit,
      code: '31E0',
      payload: `000000000100${hex(value * 2, 1)}00`,
    }));
  }

  /** Sends the last reports again, as real sensors do every few minutes. */
  async repeat() {
    for (const packet of this.#last.values()) {
      await this.#send(packet);
    }
  }

  /**
   * @param {string} code
   * @param {string} payload
   * @returns {Packet}
   */
  #announcement(code, payload) {
    return new Packet({
      verb: 'I',
      addresses: [this.#address, NO_ADDRESS, this.#address],
      code,
      payload,
    });
  }

  /** @param {Packet} packet */
  async #report(packet) {
    this.#last.set(packet.code, packet);
    await this.#send(packet);
  }
}
