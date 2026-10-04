import { AuthError, NotReachableError } from '../errors.js';

/**
 * @typedef {object} MqttClient
 * The subset of an mqtt.js client this app uses; tests inject a fake.
 * @property {(event: string, listener: (...args: any[]) => void) => unknown} on
 * @property {(topics: string | string[], callback?: (error?: Error | null) => void) => unknown} subscribe
 * @property {(topic: string, message: string, callback?: (error?: Error) => void) => unknown} publish
 * @property {(force?: boolean) => unknown} end
 * @property {boolean} connected
 */

/**
 * @typedef {(url: string, options: Record<string, unknown>) => MqttClient} ConnectFn
 */

/** MQTT connack codes (3.1.1 and 5) that mean "wrong credentials". */
const AUTH_CODES = new Set([4, 5, 134, 135]);

/**
 * @param {unknown} error
 * @returns {boolean} whether the broker rejected the credentials
 */
export function isAuthFailure(error) {
  const code = /** @type {{ code?: unknown }} */ (error)?.code;

  if (typeof code === 'number' && AUTH_CODES.has(code)) {
    return true;
  }

  return /not authori[sz]ed|bad user ?name or password/i.test(String(/** @type {Error} */ (error)?.message ?? ''));
}

/**
 * Turns a connection error into a domain error with a stable code.
 * @param {unknown} error
 * @param {string} address
 * @returns {Error}
 */
export function toBrokerError(error, address) {
  if (isAuthFailure(error)) {
    return new AuthError(error);
  }

  return new NotReachableError(address, error);
}

/**
 * Connection options shared by every client of this app.
 * @param {import('./BrokerConfig.js').BrokerConfig} broker
 * @param {string} purpose shows up in the broker's client list
 * @returns {Record<string, unknown>}
 */
export function clientOptions(broker, purpose) {
  return {
    clientId: `homey-ramses-${purpose}-${Math.random().toString(16).slice(2, 8)}`,
    username: broker.username || undefined,
    password: broker.password || undefined,
    connectTimeout: 8000,
    clean: true,
    rejectUnauthorized: false,
  };
}
