import Homey from 'homey';
import { RamsesError } from '../../lib/errors.js';
import { loggerFrom } from '../../lib/utils.js';
import { VirtualSensor } from '../../lib/domain/VirtualSensor.js';

import { CapabilityStore } from '../../lib/homey/CapabilityStore.js';
import { SENSOR_OFFERS } from '../../lib/ramses/binding.js';

/** @typedef {import('../../app.js').default} RamsesApp */
/** @typedef {import('../../lib/domain/VirtualSensor.js').DemandCurve} DemandCurve */

/** Settings that shape the demand curve. */
const CURVE_SETTINGS = Object.freeze(['auto_demand', 'co2_low', 'co2_high', 'humidity_low', 'humidity_high']);

/** Maintenance action that binds the sensor to a unit. */
const BIND_ACTION = 'button.bind_sensor';

/**
 * The CO₂ sensor Homey plays. Flows report values; the sensor sends them to
 * the unit it is bound to and repeats them, as a real sensor does.
 */
export default class VirtualSensorDevice extends Homey.Device {
  /** Time between two repeats of the last reports. */
  static REPEAT_MS = 5 * 60 * 1000;

  /** @type {VirtualSensor} */
  #sensor;

  /** @type {CapabilityStore} */
  #capabilities;

  /** @type {unknown} */
  #repeater = null;

  async onInit() {
    this.#capabilities = new CapabilityStore(this, loggerFrom(this));
    this.#sensor = new VirtualSensor({
      address: this.getData().id,
      unit: this.getStoreValue('unit') ?? null,
      curve: VirtualSensorDevice.curveOf(this.getSettings()),
      send: (packet) => this.#app.gateways.send(packet),
    });

    this.registerCapabilityListener(BIND_ACTION, async () => {
      await this.#bind();
    });

    this.#repeater = this.homey.setInterval(() => {
      this.#sensor.repeat().catch((error) => this.log('Repeat failed:', error.message));
    }, VirtualSensorDevice.REPEAT_MS);
  }

  async onUninit() {
    this.#stop();
  }

  async onDeleted() {
    this.#stop();
  }

  /**
   * @param {{ newSettings: Record<string, any>, changedKeys: string[] }} event
   */
  async onSettings({ newSettings, changedKeys }) {
    if (changedKeys.some((key) => CURVE_SETTINGS.includes(key))) {
      this.#sensor.useCurve(VirtualSensorDevice.curveOf(newSettings));
    }
  }

  /**
   * @param {Record<string, any>} settings
   * @returns {DemandCurve | null} null when flows set the demand themselves
   */
  static curveOf(settings) {
    if (settings.auto_demand === false) {
      return null;
    }

    return {
      co2Low: Number(settings.co2_low ?? 400),
      co2High: Number(settings.co2_high ?? 1000),
      humidityLow: Number(settings.humidity_low ?? 60),
      humidityHigh: Number(settings.humidity_high ?? 80),
    };
  }

  /** @returns {VirtualSensor} used by the flow cards */
  get sensor() {
    return this.#sensor;
  }

  /**
   * Shows a reported value on the device.
   * @param {string} capability
   * @param {number} value
   */
  async show(capability, value) {
    await this.#capabilities.set(capability, value);
  }

  async #bind() {
    try {
      const unit = await this.#app.binder.bind({ supplicant: this.#sensor.address, offers: SENSOR_OFFERS });

      this.#sensor.bindTo(unit);
      await this.setStoreValue('unit', unit);
      await this.setSettings({ bound_unit: unit });
      this.log(`Bound to unit ${unit}`);
    } catch (error) {
      if (error instanceof RamsesError && error.code === 'BINDING_TIMEOUT') {
        throw new Error(this.homey.__('device.binding_timeout'));
      }

      throw error;
    }
  }

  #stop() {
    if (this.#repeater !== null) {
      this.homey.clearInterval(/** @type {any} */ (this.#repeater));
      this.#repeater = null;
    }
  }

  /** @returns {RamsesApp} */
  get #app() {
    return /** @type {RamsesApp} */ (this.homey.app);
  }
}
