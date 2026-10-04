import Homey from 'homey';
import { loggerFrom } from '../../lib/utils.js';
import { VirtualSensorFlowCards } from '../../lib/homey/flows/VirtualSensorFlowCards.js';

/** @typedef {import('../../app.js').default} RamsesApp */

/** The RAMSES device type of a CO₂ sensor. */
const SENSOR_TYPE = '37';

/**
 * Driver for the CO₂ sensor Homey plays on the bus. Adding one gives it an
 * address of its own; binding it to a unit is a maintenance action.
 */
export default class VirtualSensorDriver extends Homey.Driver {
  /** @type {VirtualSensorFlowCards} */
  #flowCards;

  async onInit() {
    this.#flowCards = new VirtualSensorFlowCards(this.homey.flow, loggerFrom(this)).register();
  }

  /** @returns {VirtualSensorFlowCards} */
  get flowCards() {
    return this.#flowCards;
  }

  async onPairListDevices() {
    const app = /** @type {RamsesApp} */ (this.homey.app);

    if (app.gateways.size === 0) {
      throw new Error(this.homey.__('pair.no_gateway'));
    }

    const address = app.binder.freeAddress(SENSOR_TYPE);

    return [{
      name: this.homey.__('pair.name.virtual_sensor'),
      data: { id: address },
      settings: { address },
    }];
  }
}
