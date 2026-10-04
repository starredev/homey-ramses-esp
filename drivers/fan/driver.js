import { Role } from '../../lib/ramses/BusScanner.js';
import { BusDeviceDriver } from '../../lib/homey/BusDeviceDriver.js';
import { FanFlowCards } from '../../lib/homey/flows/FanFlowCards.js';

/** Driver for ventilation units (heat recovery and mechanical ventilation). */
export default class FanDriver extends BusDeviceDriver {
  get role() {
    return Role.FAN;
  }

  /**
   * @param {import('../../lib/homey/flows/FlowCardSet.js').FlowManager} flow
   * @param {import('../../lib/utils.js').Logger} logger
   */
  createFlowCards(flow, logger) {
    return new FanFlowCards(flow, logger, this.homey.i18n.getLanguage()).register();
  }
}
