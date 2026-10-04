import { Reading } from '../ramses/decoders.js';

/** @typedef {import('./CapabilityStore.js').CapabilityStore} CapabilityStore */

/**
 * @typedef {object} ReadingBinding
 * @property {string} capability
 * @property {Record<string, string>} [title] for sub-capabilities, which need their own name
 */

/**
 * Which capability shows which reading. Capabilities are added the first
 * time a device reports the reading, so a unit without a CO₂ sensor never
 * shows an empty CO₂ tile.
 * @type {Readonly<Record<string, ReadingBinding>>}
 */
export const READING_BINDINGS = Object.freeze({
  [Reading.CO2]: { capability: 'measure_co2' },
  [Reading.HUMIDITY]: { capability: 'measure_humidity' },
  [Reading.TEMPERATURE]: { capability: 'measure_temperature' },
  [Reading.OUTDOOR_TEMPERATURE]: {
    capability: 'measure_temperature.outdoor',
    title: { en: 'Outdoor temperature', nl: 'Buitentemperatuur' },
  },
  [Reading.SUPPLY_TEMPERATURE]: {
    capability: 'measure_temperature.supply',
    title: { en: 'Supply air temperature', nl: 'Temperatuur toevoerlucht' },
  },
  [Reading.EXHAUST_TEMPERATURE]: {
    capability: 'measure_temperature.exhaust',
    title: { en: 'Exhaust air temperature', nl: 'Temperatuur afvoerlucht' },
  },
  [Reading.OUTDOOR_HUMIDITY]: {
    capability: 'measure_humidity.outdoor',
    title: { en: 'Outdoor humidity', nl: 'Buitenluchtvochtigheid' },
  },
  [Reading.AIR_QUALITY]: { capability: 'measure_ramses_air_quality' },
  [Reading.BYPASS]: { capability: 'measure_ramses_bypass' },
  [Reading.FAN_SPEED]: { capability: 'measure_ramses_fan_speed' },
  [Reading.SUPPLY_FAN_SPEED]: {
    capability: 'measure_ramses_fan_speed.supply',
    title: { en: 'Supply fan speed', nl: 'Snelheid toevoerventilator' },
  },
  [Reading.SUPPLY_FLOW]: { capability: 'measure_ramses_supply_flow' },
  [Reading.EXHAUST_FLOW]: { capability: 'measure_ramses_exhaust_flow' },
  [Reading.POST_HEATER]: { capability: 'measure_ramses_post_heater' },
  [Reading.PRE_HEATER]: { capability: 'measure_ramses_pre_heater' },
  [Reading.BOOST_REMAINING]: { capability: 'measure_ramses_boost_remaining' },
  [Reading.FILTER_DAYS]: { capability: 'measure_ramses_filter_days' },
  [Reading.FILTER_REMAINING]: { capability: 'measure_ramses_filter_remaining' },
  [Reading.FILTER_DIRTY]: { capability: 'alarm_ramses_filter' },
  [Reading.FAULT]: { capability: 'alarm_ramses_fault' },
  [Reading.FROST_PROTECTION]: { capability: 'alarm_ramses_frost' },
  [Reading.PRESENCE]: {
    capability: 'alarm_motion',
    title: { en: 'Presence', nl: 'Aanwezigheid' },
  },
  [Reading.DEMAND]: { capability: 'measure_ramses_demand' },
  [Reading.BATTERY]: { capability: 'measure_battery' },
  [Reading.BATTERY_LOW]: { capability: 'alarm_battery' },
});

/**
 * Capabilities of earlier versions, renamed so Homey offers them as the
 * indicator on the device tile (only `measure_` numbers qualify). They are
 * removed on start; the next reading adds the new one.
 */
export const LEGACY_CAPABILITIES = Object.freeze([
  'ramses_fan_level',
  'measure_ramses_fan_level',
  'ramses_fan_speed',
  'ramses_fan_speed.supply',
  'ramses_air_quality',
  'ramses_bypass',
  'ramses_boost_remaining',
  'ramses_filter_days',
]);

/**
 * Shows readings of the domain model as device capabilities.
 */
export class ReadingCapabilities {
  /** @type {CapabilityStore} */
  #store;

  /**
   * @param {CapabilityStore} store
   */
  constructor(store) {
    this.#store = store;
  }

  /**
   * @param {string} key see `Reading`
   * @param {number | boolean} value
   * @returns {Promise<boolean>} false for readings without a capability
   */
  async apply(key, value) {
    const binding = READING_BINDINGS[key];

    if (!binding) {
      return false;
    }

    const options = binding.title ? { title: binding.title } : {};

    await this.#store.add(binding.capability, options);
    await this.#store.set(binding.capability, value);

    return true;
  }

  /**
   * Removes capabilities that earlier versions of the app added.
   * @returns {Promise<string[]>} the capabilities removed
   */
  async migrate() {
    const removed = LEGACY_CAPABILITIES.filter((id) => this.#store.has(id));

    for (const id of removed) {
      await this.#store.remove(id);
    }

    return removed;
  }
}
