import { ValidationError } from '../errors.js';
import { FanMode } from './FanMode.js';
import { encodeParam } from './FanParams.js';
import { DEFAULT_SCHEME } from './FanScheme.js';
import { Packet } from './Packet.js';

/** @typedef {import('./FanScheme.js').FanScheme} FanScheme */

/** Bypass modes and their byte in a `22F7` write. */
export const BypassMode = Object.freeze({
  AUTO: 'auto',
  OPEN: 'on',
  CLOSED: 'off',
});

/** @type {Readonly<Record<string, string>>} */
const BYPASS_BYTES = Object.freeze({ auto: 'FF', on: 'C8', off: '00' });

/**
 * Codes a unit can be asked for.
 * @enum {string}
 */
export const StatusCode = Object.freeze({
  /** Fan state: mode or speed. */
  FAN: '31D9',
  /** Extended status of a heat recovery unit. */
  EXTENDED: '31DA',
  /** Filter status. */
  FILTER: '10D0',
  /** Bypass position and mode. */
  BYPASS: '22F7',
  /** Indoor humidity, of units with a humidity sensor (Orcon RHB). */
  HUMIDITY: '12A0',
  /** Device info: model and firmware. */
  INFO: '10E0',
});

/** Longest boost a `22F3` command can express: one byte of minutes. */
export const MAX_BOOST_MINUTES = 0xff;

/**
 * @param {number} value
 * @returns {string} one byte as two upper-case hex digits
 */
function hexByte(value) {
  return value.toString(16).toUpperCase().padStart(2, '0');
}

/**
 * Builds the commands a remote sends to a ventilation unit. The unit only
 * obeys remotes it is bound to, so `remote` must be such a bound address.
 */
export class FanCommands {
  /**
   * @param {object} addresses
   * @param {string} addresses.remote the address the unit is bound to
   * @param {string} addresses.unit the ventilation unit
   * @param {FanScheme} [addresses.scheme] how the unit numbers its modes
   */
  constructor({ remote, unit, scheme = DEFAULT_SCHEME }) {
    this.remote = remote;
    this.unit = unit;
    this.scheme = scheme;
  }

  /**
   * @param {string} mode see `FanMode`
   * @returns {Packet} `22F1` with payload `00 RR SS`, numbered as the brand does
   */
  setMode(mode) {
    return Packet.create({
      verb: 'I',
      src: this.remote,
      dst: this.unit,
      code: '22F1',
      payload: `00${this.scheme.rateOf(mode)}${this.scheme.suffix}`,
    });
  }

  /**
   * Runs the fan on high for a while, then lets it return on its own. Orcon
   * uses the long form its CO2 15RF sends for "High" (`00 12 DD 03 04 04 04`:
   * high, then auto); other brands the short form `00 00 DD`.
   * @param {number} minutes
   * @returns {Packet} `22F3`
   */
  boost(minutes) {
    const whole = Math.round(Number(minutes));

    if (!Number.isFinite(whole) || whole < 1 || whole > MAX_BOOST_MINUTES) {
      throw new ValidationError(`A boost lasts 1 to ${MAX_BOOST_MINUTES} minutes`);
    }

    return Packet.create({
      verb: 'I',
      src: this.remote,
      dst: this.unit,
      code: '22F3',
      payload: this.scheme.longBoost
        ? `0012${hexByte(whole)}${this.scheme.rateOf(FanMode.HIGH)}${this.scheme.rateOf(FanMode.AUTO)}0404`
        : `0000${hexByte(whole)}`,
    });
  }

  /**
   * Asks the unit for one of its parameters; it answers with a `2411`.
   * @param {string} gateway
   * @param {string} id two hex digits, see `FanParams`
   * @returns {Packet}
   */
  getParam(gateway, id) {
    return Packet.create({
      verb: 'RQ',
      src: gateway,
      dst: this.unit,
      code: '2411',
      payload: `0000${String(id).toUpperCase()}`,
    });
  }

  /**
   * Writes one of the unit's parameters.
   * @param {string} id two hex digits, see `FanParams`
   * @param {number} value in user units (percent, °C, minutes)
   * @param {import('./FanParams.js').ParamValue | null} [known] what the unit reported last
   * @returns {Packet} `W 2411`
   */
  setParam(id, value, known = null) {
    return Packet.create({
      verb: 'W',
      src: this.remote,
      dst: this.unit,
      code: '2411',
      payload: encodeParam(id, value, known),
    });
  }

  /**
   * Sets the bypass of a heat recovery unit.
   * @param {string} mode see {@link BypassMode}
   * @returns {Packet} `22F7` write with payload `00 MM EF`
   */
  setBypass(mode) {
    const byte = BYPASS_BYTES[mode];

    if (!byte) {
      throw new ValidationError(`Unknown bypass mode "${mode}"; use auto, on or off`);
    }

    return Packet.create({
      verb: 'W',
      src: this.remote,
      dst: this.unit,
      code: '22F7',
      payload: `00${byte}EF`,
    });
  }

  /** @returns {Packet} `10D0` write that resets the filter counter */
  resetFilter() {
    return Packet.create({
      verb: 'W',
      src: this.remote,
      dst: this.unit,
      code: '10D0',
      payload: '00FF',
    });
  }

  /**
   * Asks the unit for its state. Sent from the gateway, since any device may
   * ask. `31DA` is the extended status of heat recovery units; `31D9` the
   * fan state every unit knows.
   * @param {string} gateway
   * @param {StatusCode} [code]
   * @returns {Packet}
   */
  requestStatus(gateway, code = StatusCode.EXTENDED) {
    return Packet.create({
      verb: 'RQ',
      src: gateway,
      dst: this.unit,
      code,
      payload: '00',
    });
  }
}
