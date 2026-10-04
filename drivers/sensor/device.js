import { ButtonPressed } from '../../lib/domain/events.js';
import { ClimateSensor } from '../../lib/domain/ClimateSensor.js';
import { RamsesDevice } from '../../lib/homey/RamsesDevice.js';
import { RemoteFlowCards, SENSOR_PREFIX } from '../../lib/homey/flows/RemoteFlowCards.js';

/** @typedef {import('../../lib/domain/events.js').DeviceEvent} DeviceEvent */

/**
 * A room sensor. Its capabilities appear as it reports them; the buttons of a
 * control sensor (Orcon CO2 15RF) start flows and show as the last button.
 * @augments {RamsesDevice<ClimateSensor>}
 */
export default class SensorDevice extends RamsesDevice {
  /** @param {string} address */
  createModel(address) {
    return new ClimateSensor({ address });
  }

  /** @param {DeviceEvent} event */
  triggersFor(event) {
    return RemoteFlowCards.translate(event, SENSOR_PREFIX);
  }

  /** @param {DeviceEvent} event */
  async onModelEvent(event) {
    if (event instanceof ButtonPressed) {
      await this.capabilities.add('ramses_last_button');
      await this.capabilities.set('ramses_last_button', event.button);
    }
  }
}
