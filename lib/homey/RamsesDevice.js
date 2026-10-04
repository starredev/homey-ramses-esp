import Homey from 'homey';
import { DeviceInfoReceived, ReadingChanged } from '../domain/events.js';
import { StatusCode } from '../ramses/commands.js';
import { Packet } from '../ramses/Packet.js';
import { RamsesError } from '../errors.js';
import { loggerFrom } from '../utils.js';
import { CapabilityStore } from './CapabilityStore.js';
import { ReadingCapabilities } from './ReadingCapabilities.js';

/** @typedef {import('../../app.js').default} RamsesApp */
/** @typedef {import('../domain/DeviceModel.js').DeviceModel} DeviceModel */
/** @typedef {import('../domain/events.js').DeviceEvent} DeviceEvent */
/** @typedef {import('./flows/FlowCardSet.js').TriggerInvocation} TriggerInvocation */
/** @typedef {import('./BusDeviceDriver.js').BusDeviceDriver} BusDeviceDriver */

/** Error codes with a translated message for the user. */
const USER_MESSAGES = Object.freeze({
  NOT_CONNECTED: 'device.no_gateway',
});

/**
 * Homey adapter for a device on the bus (unit, remote, sensor). Feeds the
 * packets of every gateway to its domain model and turns the model's events
 * into capability values and flow triggers. Holds no protocol logic.
 * @template {DeviceModel} M
 */
export class RamsesDevice extends Homey.Device {
  /** Delay before asking a device for its model, so the gateway can connect. */
  static INFO_DELAY_MS = 20000;

  /** @type {M} */
  #model;

  /** @type {CapabilityStore} */
  #capabilities;

  /** @type {ReadingCapabilities} */
  #readings;

  /** @type {(() => void) | null} */
  #detach = null;

  async onInit() {
    const logger = loggerFrom(this);

    this.#capabilities = new CapabilityStore(this, logger);
    this.#readings = new ReadingCapabilities(this.#capabilities);
    await this.#readings.migrate().catch(this.error);
    this.#model = this.createModel(this.getData().id);

    this.#model.on('event', (event) => {
      this.runSafely(() => this.#onEvent(event));
    });

    this.#listen();

    if (!this.getSetting('model') || this.getSetting('model') === '-') {
      this.homey.setTimeout(() => {
        this.runSafely(() => this.#requestInfo());
      }, RamsesDevice.INFO_DELAY_MS);
    }
  }

  async onUninit() {
    this.#stopListening();
  }

  async onDeleted() {
    this.#stopListening();
  }

  /**
   * Builds the domain model. Subclasses override.
   * @abstract
   * @param {string} _address
   * @returns {M}
   */
  createModel(_address) {
    throw new Error('createModel() not implemented');
  }

  /**
   * Maps a domain event onto flow triggers. Subclasses override.
   * @param {DeviceEvent} _event
   * @returns {TriggerInvocation[]}
   */
  triggersFor(_event) {
    return [];
  }

  /**
   * Updates device-specific capabilities. Subclasses override.
   * @param {DeviceEvent} _event
   * @returns {Promise<void>}
   */
  async onModelEvent(_event) {}

  /** @returns {M} */
  get model() {
    return this.#model;
  }

  /** @returns {CapabilityStore} */
  get capabilities() {
    return this.#capabilities;
  }

  /** @returns {RamsesApp} */
  get app() {
    return /** @type {RamsesApp} */ (this.homey.app);
  }

  /** @returns {string | null} the gateway the device was found through */
  get gatewayId() {
    return this.getStoreValue('gateway') ?? null;
  }

  /**
   * Transmits through the device's own gateway, or any gateway online.
   * @param {Packet} packet
   * @returns {Promise<void>}
   */
  async send(packet) {
    try {
      await this.app.gateways.send(packet, this.gatewayId);
    } catch (error) {
      throw this.toUserError(error);
    }
  }

  /**
   * @param {unknown} error
   * @returns {Error}
   */
  toUserError(error) {
    if (!(error instanceof RamsesError)) {
      return /** @type {Error} */ (error);
    }

    const key = USER_MESSAGES[/** @type {keyof typeof USER_MESSAGES} */ (error.code)];

    return key ? new Error(this.homey.__(key)) : error;
  }

  /**
   * Runs an async side effect from an event listener and logs its failure,
   * so a rejected promise never goes unhandled.
   * @param {() => Promise<unknown>} task
   */
  runSafely(task) {
    task().catch((error) => {
      this.error(error);
    });
  }

  /** @param {DeviceEvent} event */
  async #onEvent(event) {
    if (event instanceof ReadingChanged) {
      await this.#readings.apply(event.key, event.value);
    }

    if (event instanceof DeviceInfoReceived) {
      await this.setSettings({ model: event.model });
    }

    await this.onModelEvent(event);
    await /** @type {BusDeviceDriver} */ (this.driver).flowCards.fire(this, this.triggersFor(event));
  }

  /** Asks the device for its model once; battery devices may not answer. */
  async #requestInfo() {
    const gateway = this.app.gateways.pick(this.gatewayId);

    if (!gateway) {
      return;
    }

    await gateway.send(Packet.create({
      verb: 'RQ',
      src: gateway.id,
      dst: this.getData().id,
      code: StatusCode.INFO,
      payload: '00',
    }));
  }

  #listen() {
    const registry = this.app.gateways;
    /** @type {(packet: Packet, context: { echo?: boolean }) => void} */
    const listener = (packet, context) => {
      this.#model.accept(packet, context);
    };

    registry.on('packet', listener);
    this.#detach = () => {
      registry.off('packet', listener);
    };
  }

  #stopListening() {
    this.#detach?.();
    this.#detach = null;
  }
}
