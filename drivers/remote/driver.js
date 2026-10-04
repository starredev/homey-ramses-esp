import { Role } from '../../lib/ramses/BusScanner.js';
import { BusDeviceDriver } from '../../lib/homey/BusDeviceDriver.js';
import { RemoteFlowCards } from '../../lib/homey/flows/RemoteFlowCards.js';

/** Driver for physical RF remotes; their buttons start flows. */
export default class RemoteDriver extends BusDeviceDriver {
  get role() {
    return Role.REMOTE;
  }

  /**
   * @param {import('../../lib/homey/flows/FlowCardSet.js').FlowManager} flow
   * @param {import('../../lib/utils.js').Logger} logger
   */
  createFlowCards(flow, logger) {
    return new RemoteFlowCards(flow, logger).register();
  }
}
