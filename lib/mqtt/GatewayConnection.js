import { EventEmitter } from 'node:events';
import { NotConnectedError } from '../errors.js';
import { silentLogger } from '../utils.js';
import { Packet, unwrap } from '../ramses/Packet.js';
import { clientOptions, isAuthFailure } from './client.js';

/** @typedef {import('./BrokerConfig.js').BrokerConfig} BrokerConfig */
/** @typedef {import('./client.js').ConnectFn} ConnectFn */
/** @typedef {import('./client.js').MqttClient} MqttClient */
/** @typedef {import('../utils.js').Logger} Logger */

/** Root of every topic ramses_esp uses. */
export const TOPIC_ROOT = 'RAMSES/GATEWAY';

/**
 * @param {string} gatewayId
 * @returns {{ status: string, rx: string, tx: string }}
 */
export function topicsOf(gatewayId) {
  const base = `${TOPIC_ROOT}/${gatewayId}`;

  return {
    status: base,
    rx: `${base}/rx`,
    tx: `${base}/tx`,
  };
}

/**
 * MQTT link to one ramses_esp: receives the frames it hears on `rx` and
 * hands frames to transmit to `tx`. Reconnects on its own.
 *
 * Events:
 * - `connected` / `disconnected`: the broker connection
 * - `online` (boolean): the gateway's own status topic (its last will)
 * - `packet` (Packet): a frame heard on the bus
 * - `unparsed` (string): a line on `rx` that is not a RAMSES frame
 * - `authFailed` (Error): the broker refused the credentials
 */
export class GatewayConnection extends EventEmitter {
  /** Seconds between reconnect attempts. */
  static RECONNECT_MS = 5000;

  /** @type {BrokerConfig} */
  #broker;

  /** @type {string} */
  #gatewayId;

  /** @type {ConnectFn} */
  #connect;

  /** @type {Logger} */
  #logger;

  /** @type {MqttClient | null} */
  #client = null;

  #connected = false;

  /**
   * @param {object} options
   * @param {BrokerConfig} options.broker
   * @param {string} options.gatewayId e.g. `18:203612`
   * @param {ConnectFn} options.connect mqtt.js `connect`, injectable for tests
   * @param {Logger} [options.logger]
   */
  constructor({ broker, gatewayId, connect, logger = silentLogger }) {
    super();
    this.#broker = broker;
    this.#gatewayId = gatewayId;
    this.#connect = connect;
    this.#logger = logger;
  }

  /** @returns {string} */
  get gatewayId() {
    return this.#gatewayId;
  }

  /** @returns {BrokerConfig} */
  get broker() {
    return this.#broker;
  }

  /** @returns {boolean} */
  get connected() {
    return this.#connected;
  }

  start() {
    if (this.#client) {
      return;
    }

    const client = this.#connect(this.#broker.url, {
      ...clientOptions(this.#broker, 'gateway'),
      reconnectPeriod: GatewayConnection.RECONNECT_MS,
    });

    this.#client = client;
    client.on('connect', () => {
      this.#onConnect(client);
    });
    client.on('message', (topic, message) => {
      this.#onMessage(String(topic), String(message));
    });
    client.on('close', () => {
      this.#setConnected(false);
    });
    client.on('error', (error) => {
      this.#onError(error);
    });
  }

  stop() {
    const client = this.#client;

    this.#client = null;
    client?.end(true);
    this.#setConnected(false);
  }

  /**
   * Moves the connection to another broker.
   * @param {BrokerConfig} broker
   */
  reconfigure(broker) {
    if (broker.equals(this.#broker)) {
      return;
    }

    this.#broker = broker;

    if (this.#client) {
      this.stop();
      this.start();
    }
  }

  /**
   * Hands a frame to the gateway for transmission.
   * @param {Packet} packet
   * @returns {Promise<void>}
   */
  send(packet) {
    const client = this.#client;

    if (!client || !this.#connected) {
      return Promise.reject(new NotConnectedError(this.#broker.toString()));
    }

    const message = JSON.stringify({ msg: packet.toFrame() });

    return new Promise((resolve, reject) => {
      client.publish(topicsOf(this.#gatewayId).tx, message, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /** @param {MqttClient} client */
  #onConnect(client) {
    const { status, rx } = topicsOf(this.#gatewayId);

    client.subscribe([status, rx], (error) => {
      if (error) {
        this.#logger.error(`Subscribing to ${rx} failed:`, error);
      }
    });
    this.#setConnected(true);
  }

  /**
   * @param {string} topic
   * @param {string} message
   */
  #onMessage(topic, message) {
    const { status, rx } = topicsOf(this.#gatewayId);

    if (topic === status) {
      this.emit('online', message.trim().toLowerCase() === 'online');

      return;
    }

    if (topic !== rx) {
      return;
    }

    const packet = Packet.parse(message);

    if (packet) {
      this.emit('packet', packet);
    } else {
      this.emit('unparsed', unwrap(message));
    }
  }

  /** @param {Error} error */
  #onError(error) {
    if (isAuthFailure(error)) {
      this.emit('authFailed', error);

      return;
    }

    this.#logger.error(`MQTT ${this.#broker}:`, error.message);
  }

  /** @param {boolean} connected */
  #setConnected(connected) {
    if (connected === this.#connected) {
      return;
    }

    this.#connected = connected;
    this.emit(connected ? 'connected' : 'disconnected');
  }
}
