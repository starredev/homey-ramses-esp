import Homey from 'homey';
import { RamsesError } from '../errors.js';
import { loggerFrom } from '../utils.js';
import { DevicePairing } from './Pairing.js';

/** @typedef {import('../../app.js').default} RamsesApp */
/** @typedef {import('./flows/FlowCardSet.js').FlowCardSet} FlowCardSet */
/** @typedef {import('./flows/FlowCardSet.js').FlowManager} FlowManager */
/** @typedef {import('../utils.js').Logger} Logger */

/** Pairing errors with a translated message, by error code. */
const PAIRING_MESSAGES = Object.freeze({
  NO_GATEWAY_ADDED: 'pair.no_gateway',
});

/**
 * Base driver for devices found on the bus. Pairing lists what the gateways
 * heard with the driver's role and, when nothing is known yet, keeps
 * listening while the user presses a button on the device.
 */
export class BusDeviceDriver extends Homey.Driver {
  /** @type {FlowCardSet} */
  #flowCards;

  async onInit() {
    this.#flowCards = this.createFlowCards(this.homey.flow, loggerFrom(this));
  }

  /**
   * The bus role this driver pairs. Subclasses override.
   * @abstract
   * @returns {string}
   */
  get role() {
    throw new Error('role not implemented');
  }

  /**
   * Subclasses override.
   * @abstract
   * @param {FlowManager} _flow
   * @param {Logger} _logger
   * @returns {FlowCardSet}
   */
  createFlowCards(_flow, _logger) {
    throw new Error('createFlowCards() not implemented');
  }

  /** @returns {FlowCardSet} */
  get flowCards() {
    return this.#flowCards;
  }

  async onPairListDevices() {
    const pairing = new DevicePairing({
      registry: /** @type {RamsesApp} */ (this.homey.app).gateways,
      timers: this.homey,
    });

    try {
      return await pairing.scan({
        role: this.role,
        paired: new Set(this.getDevices().map((device) => device.getData().id)),
        name: (id) => this.homey.__(`pair.name.${this.role}`, { id }),
      });
    } catch (error) {
      throw this.#toUserError(error);
    }
  }

  /**
   * @param {unknown} error
   * @returns {Error}
   */
  #toUserError(error) {
    if (!(error instanceof RamsesError)) {
      return /** @type {Error} */ (error);
    }

    const key = PAIRING_MESSAGES[/** @type {keyof typeof PAIRING_MESSAGES} */ (error.code)];

    return key ? new Error(this.homey.__(key)) : error;
  }
}
