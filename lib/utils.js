/** Shared helpers: logging and number handling. */

/**
 * @typedef {object} Logger
 * @property {(...args: unknown[]) => void} log
 * @property {(...args: unknown[]) => void} error
 */

/**
 * Logger that discards everything; the default for components under test.
 * @type {Logger}
 */
export const silentLogger = Object.freeze({
  log() {},
  error() {},
});

/**
 * Binds the logging methods of a Homey App, Driver or Device into a plain Logger.
 * @param {Logger} source
 * @returns {Logger}
 */
export function loggerFrom(source) {
  return {
    log: (...args) => {
      source.log(...args);
    },
    error: (...args) => {
      source.error(...args);
    },
  };
}

/**
 * Clamps a number into the inclusive range [min, max].
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Creates a converter that rounds to a fixed number of decimals.
 * @param {number} decimals
 * @returns {(value: unknown) => number}
 */
export function roundTo(decimals) {
  const factor = 10 ** decimals;

  return (value) => {
    return Math.round(Number(value) * factor) / factor;
  };
}

/**
 * Parses a finite number, falling back when the input is not numeric.
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
export function toFiniteNumber(value, fallback) {
  const number = Number(value);

  if (Number.isFinite(number)) {
    return number;
  }

  return fallback;
}
