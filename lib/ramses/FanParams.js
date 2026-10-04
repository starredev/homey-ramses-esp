import { ValidationError } from '../errors.js';

/**
 * @typedef {object} ParamDefinition
 * A setting inside a heat recovery unit (code `2411`), after ramses_rf.
 * @property {string} id two hex digits
 * @property {{ en: string, nl: string }} name
 * @property {string} type data type byte: 0F percent, 92 °C, 00 minutes, 10 count/days, 01 tenths of a percent
 * @property {number} min in user units
 * @property {number} max in user units
 * @property {number} step in user units
 * @property {string} units
 */

/**
 * @typedef {object} ParamValue
 * A parameter as a unit reports it, in user units (percent, °C, minutes).
 * @property {string} id
 * @property {string} type
 * @property {number} value
 * @property {number} min
 * @property {number} max
 * @property {number} step
 * @property {string} trailer the two closing bytes; a write echoes the second
 */

/**
 * The parameters this app knows, with the ranges ramses_rf documents. Units
 * report their own range with every value, which takes precedence.
 * @type {readonly ParamDefinition[]}
 */
export const FAN_PARAMS = Object.freeze([
  ['31', 'Time to change filter', 'Filter vervangen na', '10', 0, 1800, 30, 'days'],
  ['3D', 'Away: supply fan', 'Afwezig: toevoer', '0F', 0, 40, 0.5, '%'],
  ['3E', 'Away: exhaust fan', 'Afwezig: afvoer', '0F', 0, 40, 0.5, '%'],
  ['3F', 'Low: supply fan', 'Laag: toevoer', '0F', 0, 75, 0.5, '%'],
  ['40', 'Low: exhaust fan', 'Laag: afvoer', '0F', 0, 75, 0.5, '%'],
  ['41', 'Medium: supply fan', 'Midden: toevoer', '0F', 0, 75, 0.5, '%'],
  ['42', 'Medium: exhaust fan', 'Midden: afvoer', '0F', 0, 75, 0.5, '%'],
  ['43', 'High: supply fan', 'Hoog: toevoer', '0F', 0, 100, 0.5, '%'],
  ['44', 'High: exhaust fan', 'Hoog: afvoer', '0F', 0, 100, 0.5, '%'],
  ['95', 'Boost: supply and exhaust', 'Boost: toevoer en afvoer', '0F', 0, 100, 0.5, '%'],
  ['4B', 'Night mode timer', 'Timer nachtstand', '00', 0, 180, 10, 'min'],
  ['4C', 'Away mode timer', 'Timer afwezig', '00', 0, 180, 10, 'min'],
  ['4E', 'High mode timer', 'Timer hoog', '00', 0, 180, 10, 'min'],
  ['50', 'Low mode timer', 'Timer laag', '00', 0, 180, 10, 'min'],
  ['52', 'Trickle mode timer', 'Timer minimum', '00', 0, 180, 10, 'min'],
  ['54', 'Humidity sensor overrun', 'Nalooptijd vochtsensor', '00', 15, 60, 1, 'min'],
  ['64', 'Exhaust temperature limit', 'Temperatuurgrens afvoer', '92', 5, 25, 1, '°C'],
  ['65', 'Supply temperature limit', 'Temperatuurgrens toevoer', '92', 5, 25, 1, '°C'],
  ['75', 'Comfort temperature', 'Comforttemperatuur', '92', 0, 30, 0.5, '°C'],
  ['CA', 'Bypass override timer', 'Timer bypass handmatig', '00', 0, 180, 10, 'min'],
  ['CB', 'Summer mode limit', 'Grens zomerstand', '92', 15, 25, 1, '°C'],
  ['CE', 'Winter mode limit', 'Grens winterstand', '92', 5, 15, 1, '°C'],
  ['CF', 'Bypass hysteresis', 'Hysterese bypass', '92', 0.5, 5, 0.5, '°C'],
  ['F5', 'Pre-heater limit', 'Grens voorverwarmer', '92', -15, -5, 1, '°C'],
  ['F6', 'Pre-heater hysteresis', 'Hysterese voorverwarmer', '92', 0.5, 5, 0.5, '°C'],
].map(([id, en, nl, type, min, max, step, units]) => Object.freeze({
  id: String(id),
  name: Object.freeze({ en: String(en), nl: String(nl) }),
  type: String(type),
  min: Number(min),
  max: Number(max),
  step: Number(step),
  units: String(units),
})));

/**
 * @param {string} id
 * @returns {ParamDefinition | null}
 */
export function paramById(id) {
  return FAN_PARAMS.find((param) => param.id === String(id).toUpperCase()) ?? null;
}

/** Raw units per user unit, by data type. */
const SCALE = Object.freeze({ '0F': 2, '92': 100, '01': 10 });

/**
 * @param {string} type
 * @returns {number} raw counts per user unit
 */
function scaleOf(type) {
  return SCALE[/** @type {keyof typeof SCALE} */ (type)] ?? 1;
}

/**
 * @param {string} hex eight hex digits
 * @returns {number} signed 32-bit integer
 */
function int32(hex) {
  const value = parseInt(hex, 16);

  return value > 0x7fffffff ? value - 0x100000000 : value;
}

/**
 * @param {number} value
 * @returns {string} signed 32-bit integer as eight hex digits
 */
function hex32(value) {
  return ((value < 0 ? value + 0x100000000 : value) >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

/**
 * Reads a parameter from a `2411` reply:
 * `00 PPPP 00 TT VVVVVVVV MMMMMMMM XXXXXXXX SSSSSSSS ZZZZ`.
 * @param {string} payload
 * @returns {ParamValue | null} null for requests and parameters a unit marks unavailable
 */
export function decodeParam(payload) {
  if (payload.length < 42) {
    return null;
  }

  const type = payload.slice(8, 10);
  const scale = scaleOf(type);
  const raw = int32(payload.slice(10, 18));

  if (raw === -1 || raw === 0xff) {
    return null;
  }

  return {
    id: payload.slice(4, 6),
    type,
    value: raw / scale,
    min: int32(payload.slice(18, 26)) / scale,
    max: int32(payload.slice(26, 34)) / scale,
    step: int32(payload.slice(34, 42)) / scale,
    trailer: payload.slice(42, 46).padEnd(4, '0'),
  };
}

/**
 * Builds the payload that writes a parameter. The range and trailer come
 * from what the unit reported, or from the table when it has not yet.
 * @param {string} id
 * @param {number} value in user units
 * @param {ParamValue | null} [known] the last value the unit reported
 * @returns {string} payload of a `W 2411`
 */
export function encodeParam(id, value, known = null) {
  const definition = paramById(id);
  const base = known ?? (definition && {
    id: definition.id,
    type: definition.type,
    min: definition.min,
    max: definition.max,
    step: definition.step,
    trailer: definition.type === '92' || definition.type === '00' || definition.type === '10' ? '0001' : '0032',
  });

  if (!base) {
    throw new ValidationError(`Unknown fan parameter "${id}"`);
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < base.min || number > base.max) {
    throw new ValidationError(`${definition?.name.en ?? id} must be between ${base.min} and ${base.max}`);
  }

  const scale = scaleOf(base.type);
  const raw = (/** @type {number} */ amount) => hex32(Math.round(amount * scale));

  // A unit replies with a status byte in front of the trailer (A6 2C); a write carries 00 there.
  const trailer = `00${base.trailer.slice(2, 4)}`;

  return `0000${base.id.toUpperCase()}00${base.type}${raw(number)}${raw(base.min)}${raw(base.max)}${raw(base.step)}${trailer}`;
}
