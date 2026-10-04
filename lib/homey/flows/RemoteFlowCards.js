import { ButtonPressed } from '../../domain/events.js';
import { FlowCardSet } from './FlowCardSet.js';

/** @typedef {import('../../domain/events.js').DeviceEvent} DeviceEvent */
/** @typedef {import('./FlowCardSet.js').TriggerInvocation} TriggerInvocation */
/** @typedef {import('./FlowCardSet.js').FlowManager} FlowManager */
/** @typedef {import('../../utils.js').Logger} Logger */

/** Flow card ids, as declared in `drivers/remote/driver.flow.compose.json`. */
export const RemoteCards = Object.freeze({
  BUTTON_PRESSED: 'button_pressed',
  ANY_BUTTON_PRESSED: 'any_button_pressed',
});

/**
 * Prefix of the same cards on the sensor driver (control sensors with
 * buttons); flow card ids are unique within an app.
 */
export const SENSOR_PREFIX = 'sensor_';

/** Flow cards of a device with buttons: a button press starts a flow. */
export class RemoteFlowCards extends FlowCardSet {
  /** @type {string} */
  #prefix;

  /**
   * @param {FlowManager} flow
   * @param {Logger} logger
   * @param {string} [prefix] prefix of the card ids of this driver
   */
  constructor(flow, logger, prefix = '') {
    super(flow, logger);
    this.#prefix = prefix;
  }

  /** @returns {this} */
  register() {
    this.filterTrigger(`${this.#prefix}${RemoteCards.BUTTON_PRESSED}`, (args, state) => {
      return args.button === state.button;
    });

    return this;
  }

  /**
   * @param {DeviceEvent} event
   * @param {string} [prefix] prefix of the card ids of the driver
   * @returns {TriggerInvocation[]}
   */
  static translate(event, prefix = '') {
    if (!(event instanceof ButtonPressed)) {
      return [];
    }

    return [
      {
        card: `${prefix}${RemoteCards.BUTTON_PRESSED}`,
        tokens: { minutes: event.minutes },
        state: { button: event.button },
      },
      {
        card: `${prefix}${RemoteCards.ANY_BUTTON_PRESSED}`,
        tokens: { button: event.button, minutes: event.minutes },
      },
    ];
  }
}
