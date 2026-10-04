/** Test doubles: a clock, an MQTT client, a gateway connection, a Homey device and flow manager. */

import { EventEmitter } from 'node:events';
import { NotConnectedError } from '../lib/errors.js';
import { BrokerConfig } from '../lib/mqtt/BrokerConfig.js';

/**
 * Deterministic clock implementing the Timers port and a `clock()` function.
 */
export class FakeTimers {
  #now = 1_700_000_000_000;

  #nextHandle = 1;

  /** @type {Map<number, { at: number, callback: () => void }>} */
  #pending = new Map();

  /** @returns {number} */
  get now() {
    return this.#now;
  }

  /** A `() => number` clock bound to this fake. */
  clock = () => this.#now;

  /**
   * @param {() => void} callback
   * @param {number} ms
   * @returns {number}
   */
  setTimeout(callback, ms) {
    const handle = this.#nextHandle;

    this.#nextHandle += 1;
    this.#pending.set(handle, { at: this.#now + ms, callback });

    return handle;
  }

  /** @param {unknown} handle */
  clearTimeout(handle) {
    this.#pending.delete(Number(handle));
  }

  /** @returns {number} */
  get pendingCount() {
    return this.#pending.size;
  }

  /**
   * Moves the clock forward and runs every timer that became due, in order.
   * @param {number} ms
   */
  tick(ms) {
    const target = this.#now + ms;

    for (;;) {
      let next = null;

      for (const [handle, timer] of this.#pending) {
        if (timer.at <= target && (next === null || timer.at < next.at)) {
          next = { handle, ...timer };
        }
      }

      if (!next) {
        break;
      }

      this.#pending.delete(next.handle);
      this.#now = next.at;
      next.callback();
    }

    this.#now = target;
  }

  /**
   * Ticks and lets awaiting promises continue between steps.
   * @param {number} ms
   * @param {number} [step]
   */
  async advance(ms, step = 100) {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      this.tick(Math.min(step, ms - elapsed));
      await flush();
    }
  }
}

/** Lets pending promise callbacks run. */
export async function flush() {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
}

/**
 * Fake mqtt.js client. Tests drive it with `connectNow()`, `receive()`, `fail()`.
 */
export class FakeMqttClient extends EventEmitter {
  connected = false;

  ended = false;

  /** @type {string[]} */
  subscriptions = [];

  /** @type {Array<{ topic: string, message: string }>} */
  published = [];

  /** @type {Error | null} */
  publishError = null;

  /** @type {Error | null} */
  subscribeError = null;

  /**
   * @param {string} url
   * @param {Record<string, unknown>} options
   */
  constructor(url, options) {
    super();
    this.url = url;
    this.options = options;
  }

  /**
   * @param {string | string[]} topics
   * @param {(error?: Error | null) => void} [callback]
   */
  subscribe(topics, callback) {
    this.subscriptions.push(...[topics].flat());
    callback?.(this.subscribeError);
  }

  /**
   * @param {string} topic
   * @param {string} message
   * @param {(error?: Error) => void} [callback]
   */
  publish(topic, message, callback) {
    this.published.push({ topic, message });
    callback?.(this.publishError ?? undefined);
  }

  /** @param {boolean} [_force] */
  end(_force) {
    this.ended = true;
    this.connected = false;
  }

  connectNow() {
    this.connected = true;
    this.emit('connect');
  }

  close() {
    this.connected = false;
    this.emit('close');
  }

  /** @param {Error} error */
  fail(error) {
    this.emit('error', error);
  }

  /**
   * @param {string} topic
   * @param {string} message
   */
  receive(topic, message) {
    this.emit('message', topic, Buffer.from(message));
  }
}

/**
 * @typedef {object} FakeMqtt
 * @property {(url: string, options: Record<string, unknown>) => FakeMqttClient} connect
 * @property {FakeMqttClient[]} clients
 * @property {() => FakeMqttClient} last
 */

/**
 * A `connect` function that records the clients it creates.
 * @returns {FakeMqtt}
 */
export function fakeMqtt() {
  /** @type {FakeMqttClient[]} */
  const clients = [];

  return {
    clients,
    connect: (url, options) => {
      const client = new FakeMqttClient(url, options);

      clients.push(client);

      return client;
    },
    last: () => clients[clients.length - 1],
  };
}

/** @returns {BrokerConfig} */
export function broker() {
  return new BrokerConfig({
    host: '192.168.1.10', port: 1883, username: 'mqtt-user', password: 'secret',
  });
}

/**
 * Stand-in for a GatewayConnection.
 */
export class FakeConnection extends EventEmitter {
  connected = false;

  started = false;

  /** @type {import('../lib/ramses/Packet.js').Packet[]} */
  sent = [];

  broker = broker();

  /** @param {string} gatewayId */
  constructor(gatewayId = '18:203612') {
    super();
    this.gatewayId = gatewayId;
  }

  start() {
    this.started = true;
  }

  stop() {
    this.started = false;
  }

  /** @param {import('../lib/ramses/Packet.js').Packet} packet */
  async send(packet) {
    if (!this.connected) {
      throw new NotConnectedError();
    }

    this.sent.push(packet);
  }

  connect() {
    this.connected = true;
    this.emit('connected');
  }

  /** @param {import('../lib/ramses/Packet.js').Packet} packet */
  hear(packet) {
    this.emit('packet', packet);
  }
}

/**
 * The capability surface of a Homey device.
 */
export class FakeCapabilityHost {
  /** @type {Map<string, unknown>} */
  values = new Map();

  /** @type {Map<string, object>} */
  options = new Map();

  /** @type {Error | null} */
  failSet = null;

  /** @param {string[]} [capabilities] */
  constructor(capabilities = []) {
    for (const id of capabilities) {
      this.values.set(id, null);
    }
  }

  /** @param {string} id */
  hasCapability(id) {
    return this.values.has(id);
  }

  /** @param {string} id */
  getCapabilityValue(id) {
    return this.values.get(id) ?? null;
  }

  /**
   * @param {string} id
   * @param {unknown} value
   */
  async setCapabilityValue(id, value) {
    if (this.failSet) {
      throw this.failSet;
    }

    this.values.set(id, value);
  }

  /** @param {string} id */
  async addCapability(id) {
    this.values.set(id, null);
  }

  /** @param {string} id */
  async removeCapability(id) {
    this.values.delete(id);
  }

  /**
   * @param {string} id
   * @param {object} options
   */
  async setCapabilityOptions(id, options) {
    this.options.set(id, options);
  }
}

/**
 * Records flow card registrations and triggers.
 */
export class FakeFlow {
  /** @type {Map<string, any>} */
  triggers = new Map();

  /** @type {Map<string, (args: any) => Promise<unknown>>} */
  conditions = new Map();

  /** @type {Map<string, (args: any) => Promise<unknown>>} */
  actions = new Map();

  /** @type {Array<{ card: string, device: unknown, tokens: object, state: object }>} */
  fired = [];

  /** @type {Set<string>} */
  failing = new Set();

  /** @param {string} id */
  getDeviceTriggerCard(id) {
    if (!this.triggers.has(id)) {
      const card = {
        listener: null,
        /** @param {(args: any, state: any) => Promise<boolean>} listener */
        registerRunListener: (listener) => {
          card.listener = listener;
        },
        /**
         * @param {unknown} device
         * @param {object} tokens
         * @param {object} state
         */
        trigger: async (device, tokens, state) => {
          if (this.failing.has(id)) {
            throw new Error(`${id} failed`);
          }

          this.fired.push({
            card: id, device, tokens, state,
          });
        },
      };

      this.triggers.set(id, card);
    }

    return this.triggers.get(id);
  }

  /** @param {string} id */
  getConditionCard(id) {
    return {
      /** @param {(args: any) => Promise<unknown>} listener */
      registerRunListener: (listener) => {
        this.conditions.set(id, listener);
      },
    };
  }

  /** @param {string} id */
  getActionCard(id) {
    return {
      /** @param {(args: any) => Promise<unknown>} listener */
      registerRunListener: (listener) => {
        this.actions.set(id, listener);
      },
    };
  }
}

/** A logger that remembers what it was told. */
export function recordingLogger() {
  /** @type {unknown[][]} */
  const errors = [];
  /** @type {unknown[][]} */
  const logs = [];

  return {
    errors,
    logs,
    log: (/** @type {unknown[]} */ ...args) => {
      logs.push(args);
    },
    error: (/** @type {unknown[]} */ ...args) => {
      errors.push(args);
    },
  };
}
