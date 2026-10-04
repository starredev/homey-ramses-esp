/**
 * @typedef {object} FanSource
 * What a ventilation unit device offers to the web views.
 * @property {string} id the Homey device id
 * @property {string} name
 * @property {boolean} available
 * @property {string | null} mode
 * @property {(capability: string) => unknown} capabilityValue
 * @property {(mode: string) => Promise<void>} setMode
 */

/**
 * @typedef {object} FanView
 * A ventilation unit as the dashboard widget shows it.
 * @property {string} id
 * @property {string} name
 * @property {boolean} available
 * @property {string | null} mode low, medium, high, auto or away
 * @property {number | null} speed the fan speed in percent
 * @property {number | null} co2
 * @property {number | null} humidity
 * @property {number | null} temperature
 */

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Presents ventilation units to the dashboard widget. */
export class FanPresenter {
  /**
   * @param {FanSource} source
   * @returns {FanView}
   */
  static view(source) {
    const value = (/** @type {string} */ capability) => numberOrNull(source.capabilityValue(capability));
    const stored = source.capabilityValue('ramses_fan_mode');

    return {
      id: source.id,
      name: source.name,
      available: source.available,
      mode: source.mode ?? (typeof stored === 'string' ? stored : null),
      speed: value('measure_ramses_fan_speed'),
      co2: value('measure_co2'),
      humidity: value('measure_humidity'),
      temperature: value('measure_temperature'),
    };
  }
}
