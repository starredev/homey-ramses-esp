import Homey from 'homey';
import mqtt from 'mqtt';
import { ValidationError } from '../../lib/errors.js';
import { Debouncer } from '../../lib/timers.js';
import { loggerFrom } from '../../lib/utils.js';
import { Gateway } from '../../lib/domain/Gateway.js';
import { BrokerConfig } from '../../lib/mqtt/BrokerConfig.js';
import { GatewayConnection } from '../../lib/mqtt/GatewayConnection.js';
import { BusScanner } from '../../lib/ramses/BusScanner.js';
import { CapabilityStore } from '../../lib/homey/CapabilityStore.js';
import { GatewayFlowCards } from '../../lib/homey/flows/GatewayFlowCards.js';

/** @typedef {import('../../app.js').default} RamsesApp */
/** @typedef {import('./driver.js').default} GatewayDriver */
/** @typedef {import('../../lib/ramses/Packet.js').Packet} Packet */
/** @typedef {import('../../lib/domain/events.js').DeviceDiscovered} DeviceDiscovered */
/** @typedef {import('../../lib/homey/flows/FlowCardSet.js').TriggerInvocation} TriggerInvocation */

/** Capabilities of earlier versions and what replaced them. */
const RENAMED_CAPABILITIES = Object.freeze({
  ramses_bus_devices: 'measure_ramses_bus_devices',
});

/** Capabilities every gateway shows, in display order. */
const CAPABILITIES = Object.freeze(['ramses_gateway_address', 'measure_ramses_bus_devices', 'ramses_last_packet']);

/** Settings that hold the broker connection. */
const BROKER_SETTINGS = Object.freeze(['host', 'port', 'username', 'password', 'tls']);

/**
 * Homey adapter for one ramses_esp. Owns the MQTT connection, shows the
 * gateway's status and the size of the bus, keeps the scanned device list
 * across restarts, and fires the raw-bus flow cards.
 */
export default class GatewayDevice extends Homey.Device {
  /** How long the device list may stay unsaved after a change. */
  static SAVE_DELAY_MS = 60 * 1000;

  /** @type {Gateway} */
  #gateway;

  /** @type {CapabilityStore} */
  #capabilities;

  /** @type {Debouncer} */
  #saveBus;

  async onInit() {
    const logger = loggerFrom(this);
    const connection = new GatewayConnection({
      broker: BrokerConfig.from(this.getSettings()),
      gatewayId: this.getData().id,
      connect: /** @type {any} */ (mqtt.connect),
      logger,
    });

    this.#gateway = new Gateway({
      connection,
      scanner: new BusScanner({ snapshot: this.getStoreValue('bus') ?? [] }),
    });
    this.#capabilities = new CapabilityStore(this, logger);
    this.#saveBus = new Debouncer(this.homey, GatewayDevice.SAVE_DELAY_MS, () => {
      this.#runSafely(() => this.#persistBus());
    });

    this.#bindGatewayEvents();
    this.#app.gateways.add(this.#gateway);

    await this.#migrateCapabilities().catch(this.error);
    await this.setUnavailable(this.homey.__('gateway.connecting')).catch(this.error);
    await this.#capabilities.set('ramses_gateway_address', this.#gateway.id);
    await this.#capabilities.set('measure_ramses_bus_devices', this.#gateway.scanner.size);
    this.#gateway.start();
  }

  async onUninit() {
    await this.#shutdown();
  }

  async onDeleted() {
    await this.#shutdown();
  }

  /** @returns {Gateway} used by the flow cards */
  get gateway() {
    return this.#gateway;
  }

  /**
   * @param {{ newSettings: Record<string, any>, changedKeys: string[] }} event
   */
  async onSettings({ newSettings, changedKeys }) {
    if (!changedKeys.some((key) => BROKER_SETTINGS.includes(key))) {
      return;
    }

    try {
      this.#gateway.connection.reconfigure(BrokerConfig.from(newSettings));
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new Error(this.homey.__('pair.broker.invalid'));
      }

      throw error;
    }

    await this.setUnavailable(this.homey.__('gateway.connecting')).catch(this.error);
  }

  #bindGatewayEvents() {
    const gateway = this.#gateway;

    gateway.on('connected', () => {
      this.#runSafely(() => this.setAvailable());
    });

    gateway.on('disconnected', () => {
      this.#runSafely(() => this.setUnavailable(this.homey.__('gateway.disconnected')));
    });

    gateway.on('authFailed', () => {
      this.#runSafely(() => this.setUnavailable(this.homey.__('gateway.auth_failed')));
    });

    gateway.on('online', (online) => {
      this.#runSafely(() => this.#onOnline(online));
    });

    gateway.on('packet', (packet) => {
      this.#runSafely(() => this.#onPacket(packet));
    });

    gateway.on('discovered', (event) => {
      this.#runSafely(() => this.#onDiscovered(event));
    });
  }

  /** @param {boolean} online */
  async #onOnline(online) {
    if (online) {
      await this.unsetWarning();
    } else {
      await this.setWarning(this.homey.__('gateway.offline'));
    }

    await this.#fire(GatewayFlowCards.online(online));
  }

  /** @param {Packet} packet */
  async #onPacket(packet) {
    await this.#capabilities.set('ramses_last_packet', `${packet.code} ${packet.src}`);
    await this.#fire(GatewayFlowCards.packet(packet));
  }

  /** @param {DeviceDiscovered} event */
  async #onDiscovered(event) {
    this.log(`Discovered ${event.id} (${event.role})`);
    this.#saveBus.schedule();
    await this.#capabilities.set('measure_ramses_bus_devices', this.#gateway.scanner.size);
    await this.#fire(GatewayFlowCards.discovered(event));
  }

  /** Brings a gateway added by an earlier version up to the current capabilities. */
  async #migrateCapabilities() {
    for (const legacy of Object.keys(RENAMED_CAPABILITIES)) {
      await this.#capabilities.remove(legacy);
    }

    for (const id of CAPABILITIES) {
      await this.#capabilities.add(id);
    }
  }

  /** @param {TriggerInvocation[]} invocations */
  async #fire(invocations) {
    await /** @type {GatewayDriver} */ (this.driver).flowCards.fire(this, invocations);
  }

  async #persistBus() {
    await this.setStoreValue('bus', this.#gateway.scanner.toJSON());
  }

  async #shutdown() {
    if (!this.#gateway) {
      return;
    }

    this.#saveBus.cancel();
    this.#gateway.stop();
    this.#app.gateways.remove(this.#gateway.id);
    await this.#persistBus().catch(this.error);
  }

  /**
   * Runs an async side effect from an event listener and logs its failure.
   * @param {() => Promise<unknown>} task
   */
  #runSafely(task) {
    task().catch((error) => {
      this.error(error);
    });
  }

  /** @returns {RamsesApp} */
  get #app() {
    return /** @type {RamsesApp} */ (this.homey.app);
  }
}
