import Homey from 'homey';
import mqtt from 'mqtt';
import { RamsesError } from '../../lib/errors.js';
import { loggerFrom } from '../../lib/utils.js';
import { BrokerProbe } from '../../lib/mqtt/BrokerProbe.js';
import { GatewayFlowCards } from '../../lib/homey/flows/GatewayFlowCards.js';
import { GatewayPairing } from '../../lib/homey/Pairing.js';

/** @typedef {import('../../lib/homey/Pairing.js').DeviceCandidate} DeviceCandidate */

/** Pairing errors with a message for the user, by error code. */
const PAIRING_MESSAGES = Object.freeze({
  VALIDATION: 'pair.broker.invalid',
  NOT_REACHABLE: 'pair.broker.not_reachable',
  AUTH: 'pair.broker.auth_failed',
  NO_GATEWAYS: 'pair.broker.no_gateways',
});

/** Driver for ramses_esp gateways, reached through an MQTT broker. */
export default class GatewayDriver extends Homey.Driver {
  /** @type {GatewayFlowCards} */
  #flowCards;

  /** @type {GatewayPairing} */
  #pairing;

  async onInit() {
    this.#flowCards = new GatewayFlowCards(this.homey.flow, loggerFrom(this)).register();
    this.#pairing = new GatewayPairing(new BrokerProbe({
      connect: /** @type {any} */ (mqtt.connect),
      timers: this.homey,
    }));
  }

  /** @returns {GatewayFlowCards} */
  get flowCards() {
    return this.#flowCards;
  }

  /**
   * @param {Parameters<Homey.Driver['onPair']>[0]} session
   */
  async onPair(session) {
    /** @type {DeviceCandidate[]} */
    let found = [];

    session.setHandler('broker_defaults', async () => {
      return { host: await this.#homeyAddress(), port: 1883 };
    });

    session.setHandler('find_gateways', async (input) => {
      found = await this.#find(input);

      return found.length;
    });

    session.setHandler('list_devices', async () => {
      return found;
    });
  }

  /**
   * @param {Record<string, unknown>} input
   * @returns {Promise<DeviceCandidate[]>}
   */
  async #find(input) {
    const paired = new Set(this.getDevices().map((device) => device.getData().id));

    try {
      return await this.#pairing.find(input, paired);
    } catch (error) {
      throw this.#toUserError(error);
    }
  }

  /**
   * The LAN address of Homey, where the MQTT broker app usually runs.
   * @returns {Promise<string>}
   */
  async #homeyAddress() {
    try {
      const address = await this.homey.cloud.getLocalAddress();

      return address.split(':')[0];
    } catch {
      return '';
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

    this.log(`Finding gateways failed: ${error.message}`);

    return key ? new Error(this.homey.__(key)) : error;
  }
}
