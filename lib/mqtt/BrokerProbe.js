import { delay } from '../timers.js';
import { isAddress } from '../ramses/Packet.js';
import { clientOptions, toBrokerError } from './client.js';
import { TOPIC_ROOT } from './GatewayConnection.js';

/** @typedef {import('./BrokerConfig.js').BrokerConfig} BrokerConfig */
/** @typedef {import('./client.js').ConnectFn} ConnectFn */
/** @typedef {import('./client.js').MqttClient} MqttClient */
/** @typedef {import('../timers.js').Timers} Timers */

/**
 * @typedef {object} ProbeResult
 * @property {string[]} gateways ramses_esp gateway ids that published on the broker
 */

const GATEWAY_TOPIC = new RegExp(`^${TOPIC_ROOT}/(\\d{2}:\\d{6})(?:/|$)`);

/**
 * @param {string} topic
 * @returns {string | null} the gateway id in a ramses_esp topic
 */
export function gatewayIdOf(topic) {
  const id = GATEWAY_TOPIC.exec(topic)?.[1];

  return id && isAddress(id) ? id : null;
}

/**
 * Looks for ramses_esp gateways on a broker: connects once, listens to every
 * gateway topic for a moment and reports the gateway ids it heard.
 */
export class BrokerProbe {
  /** How long to listen after connecting. Retained status topics arrive at once. */
  static LISTEN_MS = 4000;

  /** @type {ConnectFn} */
  #connect;

  /** @type {Timers} */
  #timers;

  /**
   * @param {object} options
   * @param {ConnectFn} options.connect
   * @param {Timers} options.timers
   */
  constructor({ connect, timers }) {
    this.#connect = connect;
    this.#timers = timers;
  }

  /**
   * @param {BrokerConfig} broker
   * @returns {Promise<ProbeResult>}
   * @throws {import('../errors.js').AuthError | import('../errors.js').NotReachableError}
   */
  async probe(broker) {
    const client = this.#connect(broker.url, {
      ...clientOptions(broker, 'probe'),
      reconnectPeriod: 0,
    });
    /** @type {Set<string>} */
    const gateways = new Set();

    client.on('message', (topic) => {
      const id = gatewayIdOf(String(topic));

      if (id) {
        gateways.add(id);
      }
    });

    try {
      await this.#connected(client, broker);
      client.subscribe(`${TOPIC_ROOT}/#`);
      await delay(this.#timers, BrokerProbe.LISTEN_MS);
    } finally {
      client.end(true);
    }

    return { gateways: [...gateways].sort() };
  }

  /**
   * @param {MqttClient} client
   * @param {BrokerConfig} broker
   * @returns {Promise<void>}
   */
  #connected(client, broker) {
    return new Promise((resolve, reject) => {
      client.on('connect', () => {
        resolve();
      });
      client.on('error', (error) => {
        reject(toBrokerError(error, broker.toString()));
      });
      client.on('close', () => {
        reject(toBrokerError(new Error('Connection closed'), broker.toString()));
      });
    });
  }
}
