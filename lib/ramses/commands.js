import { ValidationError } from '../errors.js';
import { rateFromMode } from './FanMode.js';
import { Packet } from './Packet.js';

/**
 * Codes a unit can be asked for.
 * @enum {string}
 */
export const StatusCode = Object.freeze({
  /** Fan state: mode or speed. */
  FAN: '31D9',
  /** Extended status of a heat recovery unit. */
  EXTENDED: '31DA',
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
   */
  constructor({ remote, unit }) {
    this.remote = remote;
    this.unit = unit;
  }

  /**
   * @param {string} mode see `FanMode`
   * @returns {Packet} `22F1` with payload `00 RR 04`
   */
  setMode(mode) {
    return Packet.create({
      verb: 'I',
      src: this.remote,
      dst: this.unit,
      code: '22F1',
      payload: `00${rateFromMode(mode)}04`,
    });
  }

  /**
   * Runs the fan on high for a while, then returns to auto. Uses the long
   * form an Orcon CO2 15RF sends for its "High" button, which units that
   * accept the short form understand too.
   * @param {number} minutes
   * @returns {Packet} `22F3` with payload `00 12 DD 03 04 04 04`
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
      payload: `0012${hexByte(whole)}${rateFromMode('high')}${rateFromMode('auto')}0404`,
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
