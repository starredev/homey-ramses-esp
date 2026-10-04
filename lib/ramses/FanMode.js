import { ValidationError } from '../errors.js';

/**
 * The fan modes of a RAMSES ventilation unit, as Orcon numbers them. The
 * `rate` is the middle byte of a `22F1` payload `00 RR 04`; Orcon units report
 * the same number as their state in `31D9`.
 */
export const FanMode = Object.freeze({
  AWAY: 'away',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  AUTO: 'auto',
});

/**
 * Rate byte → mode. 05 is a second auto mode (comfort), 06 a boost (high on a
 * timer); both read as the mode the user knows. 07 (off) has no mode.
 * @type {Readonly<Record<string, string>>}
 */
const MODE_BY_RATE = Object.freeze({
  '00': FanMode.AWAY,
  '01': FanMode.LOW,
  '02': FanMode.MEDIUM,
  '03': FanMode.HIGH,
  '04': FanMode.AUTO,
  '05': FanMode.AUTO,
  '06': FanMode.HIGH,
});

/** @type {Readonly<Record<string, string>>} mode → rate byte */
const RATE_BY_MODE = Object.freeze({
  [FanMode.AWAY]: '00',
  [FanMode.LOW]: '01',
  [FanMode.MEDIUM]: '02',
  [FanMode.HIGH]: '03',
  [FanMode.AUTO]: '04',
});

/** @returns {string[]} the modes a user can choose, in the order of a remote */
export function fanModes() {
  return [FanMode.LOW, FanMode.MEDIUM, FanMode.HIGH, FanMode.AUTO, FanMode.AWAY];
}

/**
 * @param {string} rate two hex digits
 * @returns {string | null}
 */
export function modeFromRate(rate) {
  return MODE_BY_RATE[String(rate).toUpperCase()] ?? null;
}

/**
 * @param {string} mode
 * @returns {string} the rate byte for a `22F1` payload
 */
export function rateFromMode(mode) {
  const rate = RATE_BY_MODE[mode];

  if (!rate) {
    throw new ValidationError(`Unknown fan mode "${mode}"; use ${fanModes().join(', ')}`);
  }

  return rate;
}
