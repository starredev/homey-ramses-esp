import { ValidationError } from '../errors.js';
import { NO_ADDRESS, Packet } from '../ramses/Packet.js';

/** @typedef {(packet: Packet) => Promise<void>} Sender */

/**
 * @typedef {object} DemandCurve
 * Where a reading starts to ask for ventilation (0 %) and where it asks for all (100 %).
 * @property {number} co2Low ppm
 * @property {number} co2High ppm
 * @property {number} humidityLow percent
 * @property {number} humidityHigh percent
 */

/**
 * The default curve, after an Orcon CO2 15RF (about 450 ppm asks 10 %, 700
 * ppm 50 %) and the humidity at which bathrooms need extracting.
 * @type {Readonly<DemandCurve>}
 */
export const DEFAULT_CURVE = Object.freeze({
  co2Low: 400,
  co2High: 1000,
  humidityLow: 60,
  humidityHigh: 80,
});

/**
 * @param {number} value
 * @param {number} low
 * @param {number} high
 * @returns {number} 0..100
 */
function ramp(value, low, high) {
  if (high <= low) {
    return value >= high ? 100 : 0;
  }

  return Math.round(Math.min(100, Math.max(0, ((value - low) / (high - low)) * 100)));
}

/**
 * How much ventilation a room asks for: the highest of what its CO₂ and its
 * humidity ask, each rising linearly between the low and high point.
 * @param {{ co2?: number | null, humidity?: number | null }} readings
 * @param {DemandCurve} [curve]
 * @returns {number | null} percent, or null without readings
 */
export function ventilationDemand({ co2 = null, humidity = null }, curve = DEFAULT_CURVE) {
  const asks = [];

  if (co2 !== null) {
    asks.push(ramp(co2, curve.co2Low, curve.co2High));
  }

  if (humidity !== null) {
    asks.push(ramp(humidity, curve.humidityLow, curve.humidityHigh));
  }

  return asks.length > 0 ? Math.max(...asks) : null;
}

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

  /** @type {DemandCurve | null} null when flows set the demand themselves */
  #curve;

  /** @type {{ co2: number | null, humidity: number | null }} */
  #readings = { co2: null, humidity: null };

  /**
   * @param {object} options
   * @param {string} options.address the address Homey plays, e.g. `37:123456`
   * @param {Sender} options.send
   * @param {string | null} [options.unit] the unit it is bound to
   * @param {DemandCurve | null} [options.curve] derives the demand from CO₂ and humidity; null leaves it to flows
   */
  constructor({ address, send, unit = null, curve = DEFAULT_CURVE }) {
    this.#address = address;
    this.#send = send;
    this.#unit = unit;
    this.#curve = curve;
  }

  /** @param {DemandCurve | null} curve */
  useCurve(curve) {
    this.#curve = curve;
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

  /**
   * @param {number} ppm
   * @returns {Promise<number | null>} the demand sent with it, if derived
   */
  async reportCo2(ppm) {
    const value = within(ppm, 0, 0x7ffe, 'CO₂');

    this.#readings.co2 = value;
    await this.#report(this.#announcement('1298', `00${hex(value, 2)}`));

    return this.#deriveDemand();
  }

  /**
   * @param {number} percent relative humidity
   * @returns {Promise<number | null>} the demand sent with it, if derived
   */
  async reportHumidity(percent) {
    const value = within(percent, 0, 100, 'Humidity');

    this.#readings.humidity = value;
    await this.#report(this.#announcement('12A0', `00${hex(value, 1)}`));

    return this.#deriveDemand();
  }

  /** @returns {Promise<number | null>} */
  async #deriveDemand() {
    if (!this.#curve || !this.#unit) {
      return null;
    }

    const demand = ventilationDemand(this.#readings, this.#curve);

    if (demand !== null) {
      await this.reportDemand(demand);
    }

    return demand;
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
