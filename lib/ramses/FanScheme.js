import { ValidationError } from '../errors.js';
import { FanMode } from './FanMode.js';

/**
 * @typedef {object} SchemeDefinition
 * @property {string} id
 * @property {Record<string, string>} modes rate byte → mode, for decoding
 * @property {Record<string, string>} rates mode → rate byte, for commands
 * @property {string} suffix last byte of a `22F1` command
 * @property {boolean} stateIsMode whether `31D9` reports the mode (else a speed)
 * @property {boolean} longBoost whether a boost uses the long `22F3` form
 */

const { OFF, AWAY, LOW, MEDIUM, HIGH, AUTO } = FanMode;

/**
 * How one brand numbers its fan modes. Brands share the RAMSES II codes but
 * not the numbers: `22F1 00 04 ..` is Auto on an Orcon and High on an Itho.
 * The tables follow ramses_rf; the Orcon one is confirmed on a live unit.
 */
export class FanScheme {
  /** @param {SchemeDefinition} definition */
  constructor({ id, modes, rates, suffix, stateIsMode, longBoost }) {
    this.id = id;
    this.suffix = suffix;
    this.stateIsMode = stateIsMode;
    this.longBoost = longBoost;
    this.#modes = Object.freeze({ ...modes });
    this.#rates = Object.freeze({ ...rates });
    Object.freeze(this);
  }

  /** @type {Readonly<Record<string, string>>} */
  #modes;

  /** @type {Readonly<Record<string, string>>} */
  #rates;

  /**
   * @param {string} rate two hex digits
   * @returns {string | null} the mode, or null for numbers this brand does not use
   */
  modeOf(rate) {
    return this.#modes[String(rate).toUpperCase()] ?? null;
  }

  /**
   * @param {string} mode
   * @returns {string} the rate byte that selects the mode
   */
  rateOf(mode) {
    const rate = this.#rates[mode];

    if (!rate) {
      throw new ValidationError(`A ${this.id} unit has no "${mode}" mode; use ${this.modes().join(', ')}`);
    }

    return rate;
  }

  /** @returns {string[]} the modes a user can choose on this brand */
  modes() {
    return Object.keys(this.#rates);
  }

  /**
   * @param {string} mode
   * @returns {boolean} whether a user can choose the mode on this brand
   */
  supports(mode) {
    return mode in this.#rates;
  }
}

/** The brands, by id. */
export const SCHEMES = Object.freeze({
  orcon: new FanScheme({
    id: 'orcon',
    modes: {
      '00': AWAY, '01': LOW, '02': MEDIUM, '03': HIGH, '04': AUTO, '05': AUTO, '06': HIGH, '07': OFF,
    },
    rates: {
      [LOW]: '01', [MEDIUM]: '02', [HIGH]: '03', [AUTO]: '04', [AWAY]: '00', [OFF]: '07',
    },
    suffix: '04',
    stateIsMode: true,
    longBoost: true,
  }),
  itho: new FanScheme({
    id: 'itho',
    modes: {
      '00': OFF, '01': AWAY, '02': LOW, '03': MEDIUM, '04': HIGH,
    },
    rates: {
      [LOW]: '02', [MEDIUM]: '03', [HIGH]: '04', [AWAY]: '01', [OFF]: '00',
    },
    suffix: '04',
    stateIsMode: false,
    longBoost: false,
  }),
  vasco: new FanScheme({
    id: 'vasco',
    modes: {
      '00': OFF, '01': AWAY, '02': LOW, '03': MEDIUM, '04': HIGH, '05': AUTO,
    },
    rates: {
      [LOW]: '02', [MEDIUM]: '03', [HIGH]: '04', [AUTO]: '05', [AWAY]: '01', [OFF]: '00',
    },
    suffix: '06',
    stateIsMode: true,
    longBoost: false,
  }),
  climarad: new FanScheme({
    id: 'climarad',
    modes: {
      '00': OFF, '01': AWAY, '02': LOW, '03': MEDIUM, '04': HIGH, '05': AUTO,
    },
    rates: {
      [LOW]: '02', [MEDIUM]: '03', [HIGH]: '04', [AUTO]: '05', [AWAY]: '01', [OFF]: '00',
    },
    suffix: '06',
    stateIsMode: false,
    longBoost: false,
  }),
  nuaire: new FanScheme({
    id: 'nuaire',
    modes: { '02': MEDIUM, '03': HIGH },
    rates: { [MEDIUM]: '02', [HIGH]: '03' },
    suffix: '0A',
    stateIsMode: false,
    longBoost: false,
  }),
});

/** The scheme used until a unit tells otherwise. */
export const DEFAULT_SCHEME = SCHEMES.orcon;

/**
 * @param {string | null | undefined} id
 * @returns {FanScheme} the scheme with this id, or the default
 */
export function schemeById(id) {
  return SCHEMES[/** @type {keyof typeof SCHEMES} */ (String(id ?? ''))] ?? DEFAULT_SCHEME;
}

/**
 * The scheme a `22F1` command reveals by its last byte, where that byte is
 * unique to one brand family (Vasco and ClimaRad: 06, Nuaire: 0A). Orcon and
 * Itho both end on 04, so 04 reveals nothing.
 * @param {string} suffix
 * @returns {FanScheme | null}
 */
export function schemeBySuffix(suffix) {
  const found = { '06': SCHEMES.vasco, '0A': SCHEMES.nuaire }[String(suffix).toUpperCase()];

  return found ?? null;
}
