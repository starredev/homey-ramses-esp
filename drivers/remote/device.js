import { ButtonPressed } from '../../lib/domain/events.js';
import { Remote } from '../../lib/domain/Remote.js';
import { RamsesDevice } from '../../lib/homey/RamsesDevice.js';
import { RemoteFlowCards } from '../../lib/homey/flows/RemoteFlowCards.js';

/** @typedef {import('../../lib/domain/events.js').DeviceEvent} DeviceEvent */

/**
 * A physical remote. Shows its last button and battery, and starts flows
 * when a button is pressed.
 * @augments {RamsesDevice<Remote>}
 */
export default class RemoteDevice extends RamsesDevice {
  /** @param {string} address */
  createModel(address) {
    return new Remote({ address });
  }

  /** @param {DeviceEvent} event */
  triggersFor(event) {
    return RemoteFlowCards.translate(event);
  }

  /** @param {DeviceEvent} event */
  async onModelEvent(event) {
    if (event instanceof ButtonPressed) {
      await this.capabilities.set('ramses_last_button', event.button);
    }
  }
}
