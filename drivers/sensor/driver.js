import { Role } from '../../lib/ramses/BusScanner.js';
import { BusDeviceDriver } from '../../lib/homey/BusDeviceDriver.js';
import { RemoteFlowCards, SENSOR_PREFIX } from '../../lib/homey/flows/RemoteFlowCards.js';

/**
 * Driver for room sensors (CO₂, humidity, temperature). Their measurements
 * use Homey's own capabilities, which come with flow cards built in; control
 * sensors with buttons get the button cards of a remote.
 */
export default class SensorDriver extends BusDeviceDriver {
  get role() {
    return Role.SENSOR;
  }

  /**
   * @param {import('../../lib/homey/flows/FlowCardSet.js').FlowManager} flow
   * @param {import('../../lib/utils.js').Logger} logger
   */
  createFlowCards(flow, logger) {
    return new RemoteFlowCards(flow, logger, SENSOR_PREFIX).register();
  }
}
