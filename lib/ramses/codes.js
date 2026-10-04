/**
 * Message codes and address prefixes of RAMSES II, as far as this app uses
 * them. Labels are for humans (settings page, flow tokens), not for logic.
 */

/** Human-readable names of the message codes seen on HVAC and heating buses. */
export const CODE_NAMES = Object.freeze({
  '0418': 'Fault log',
  '042F': 'Counters',
  '1060': 'Battery',
  '10D0': 'Filter status',
  '10E0': 'Device info',
  '1260': 'Temperature',
  '1280': 'Outdoor humidity',
  '1298': 'CO₂ level',
  '12A0': 'Indoor humidity',
  '12C8': 'Air quality',
  '1F09': 'System sync',
  '1FC9': 'RF binding',
  '22F1': 'Fan mode',
  '22F3': 'Fan boost timer',
  '22F4': 'Fan mode (extended)',
  '313F': 'Date and time',
  '31D9': 'Fan state',
  '31DA': 'Ventilation status',
  '31E0': 'Ventilation demand',
});

/** Weak hints from the address prefix; reliable for heating, not for HVAC. */
export const PREFIX_HINTS = Object.freeze({
  '01': 'evohome controller',
  '02': 'Underfloor heating controller',
  '03': 'Thermostat or sensor',
  '04': 'Radiator valve (TRV)',
  '07': 'Hot water sensor',
  '10': 'OpenTherm bridge',
  '13': 'Relay (BDR91)',
  '18': 'Gateway (ramses_esp / HGI80)',
  '22': 'Thermostat',
  '30': 'Gateway or HVAC bridge',
  '34': 'Round thermostat (T87RF)',
});

/** Codes only a ventilation unit sends. */
export const FAN_CODES = Object.freeze(['31D9', '31DA']);

/** Codes a remote sends to command a ventilation unit. */
export const REMOTE_CODES = Object.freeze(['22F1', '22F3', '22F4']);

/** Codes a sensor sends with a measurement. */
export const SENSOR_CODES = Object.freeze(['1298', '12A0', '12C8', '1280', '1260']);

/**
 * @param {string} code
 * @returns {string} a human-readable name, or the code itself
 */
export function codeName(code) {
  return CODE_NAMES[/** @type {keyof typeof CODE_NAMES} */ (code)] ?? code;
}
