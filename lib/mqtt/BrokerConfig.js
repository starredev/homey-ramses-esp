import { ValidationError } from '../errors.js';

/** Default port of a plain MQTT broker. */
export const DEFAULT_PORT = 1883;

const HOST = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

/**
 * Where and how to reach the MQTT broker. Immutable value object.
 */
export class BrokerConfig {
  /**
   * @param {object} fields
   * @param {string} fields.host
   * @param {number} [fields.port]
   * @param {string} [fields.username]
   * @param {string} [fields.password]
   * @param {boolean} [fields.tls]
   */
  constructor({ host, port = DEFAULT_PORT, username = '', password = '', tls = false }) {
    this.host = host;
    this.port = port;
    this.username = username;
    this.password = password;
    this.tls = tls;
    Object.freeze(this);
  }

  /**
   * Validates loose input (a pairing form, device settings).
   * @param {Record<string, unknown>} input
   * @returns {BrokerConfig}
   */
  static from(input) {
    const host = String(input?.host ?? '').trim();
    const port = input?.port === undefined || input.port === '' ? DEFAULT_PORT : Number(input.port);

    if (!HOST.test(host)) {
      throw new ValidationError(`"${host}" is not a valid host name or IP address`);
    }

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new ValidationError(`"${input?.port}" is not a valid port`);
    }

    return new BrokerConfig({
      host,
      port,
      username: String(input?.username ?? '').trim(),
      password: String(input?.password ?? ''),
      tls: input?.tls === true,
    });
  }

  /** @returns {string} the URL the MQTT client connects to */
  get url() {
    return `${this.tls ? 'mqtts' : 'mqtt'}://${this.host}:${this.port}`;
  }

  /**
   * @param {BrokerConfig | null | undefined} other
   * @returns {boolean}
   */
  equals(other) {
    return Boolean(other)
      && this.url === other?.url
      && this.username === other?.username
      && this.password === other?.password;
  }

  /** @returns {{ host: string, port: number, username: string, password: string, tls: boolean }} */
  toJSON() {
    return {
      host: this.host,
      port: this.port,
      username: this.username,
      password: this.password,
      tls: this.tls,
    };
  }

  /** @returns {string} the address without credentials, for logs */
  toString() {
    return `${this.host}:${this.port}`;
  }
}
