import { FlowCardSet } from './FlowCardSet.js';

/** @typedef {import('../../domain/VirtualSensor.js').VirtualSensor} VirtualSensor */

/**
 * @typedef {object} VirtualSensorDevice
 * @property {VirtualSensor} sensor
 * @property {(capability: string, value: number) => Promise<unknown>} show
 */

/** Flow card ids, as declared in `drivers/virtual_sensor/driver.flow.compose.json`. */
export const VirtualSensorCards = Object.freeze({
  REPORT_CO2: 'report_co2',
  REPORT_HUMIDITY: 'report_humidity',
  REPORT_DEMAND: 'report_demand',
});

/** Flow cards of the CO₂ sensor Homey plays: whatever a flow reports reaches the unit. */
export class VirtualSensorFlowCards extends FlowCardSet {
  /** @returns {this} */
  register() {
    this.onAction(VirtualSensorCards.REPORT_CO2, async ({ device, ppm }) => {
      const target = /** @type {VirtualSensorDevice} */ (device);

      const demand = await target.sensor.reportCo2(ppm);

      await target.show('measure_co2', ppm);
      await VirtualSensorFlowCards.#showDemand(target, demand);
    });
    this.onAction(VirtualSensorCards.REPORT_HUMIDITY, async ({ device, percent }) => {
      const target = /** @type {VirtualSensorDevice} */ (device);

      const demand = await target.sensor.reportHumidity(percent);

      await target.show('measure_humidity', percent);
      await VirtualSensorFlowCards.#showDemand(target, demand);
    });
    this.onAction(VirtualSensorCards.REPORT_DEMAND, async ({ device, percent }) => {
      const target = /** @type {VirtualSensorDevice} */ (device);

      await target.sensor.reportDemand(percent);
      await target.show('measure_ramses_demand', percent);
    });

    return this;
  }

  /**
   * @param {VirtualSensorDevice} device
   * @param {number | null} demand
   */
  static async #showDemand(device, demand) {
    if (demand !== null) {
      await device.show('measure_ramses_demand', demand);
    }
  }
}
