import { ValidationError } from '../../lib/errors.js';
import { FanModeChanged, ReadingChanged } from '../../lib/domain/events.js';
import { FanUnit } from '../../lib/domain/FanUnit.js';
import { FanStatus } from '../../lib/homey/FanStatus.js';
import { RamsesDevice } from '../../lib/homey/RamsesDevice.js';
import { FanFlowCards } from '../../lib/homey/flows/FanFlowCards.js';
import { isAddress } from '../../lib/ramses/Packet.js';

/** @typedef {import('../../lib/domain/events.js').DeviceEvent} DeviceEvent */
/** @typedef {import('../../lib/homey/FanPresenter.js').FanSource} FanSource */

/**
 * A ventilation unit. The mode can be set from Homey; status, sensors and
 * filter appear as the unit reports them. Homey commands the unit in the name
 * of a remote it is bound to (setting `remote_id`).
 * @augments {RamsesDevice<FanUnit>}
 */
export default class FanDevice extends RamsesDevice {
  /** Delay before the first status request, so the gateway can connect. */
  static FIRST_STATUS_MS = 15000;

  /**
   * Version of the capability layout. 2: readings lent by a linked CO₂ sensor
   * are gone (the sensor is its own device). 3: the mode as a word for the
   * tile. 4: the numeric status indicator is gone again.
   */
  static SCHEMA = 4;

  /** @type {unknown} */
  #poller = null;

  /** @type {string | null} the mode the indicator shows */
  #indicated = null;

  async onInit() {
    await super.onInit();
    await this.#migrate().catch(this.error);
    await this.#showStatus(this.capabilities.get('ramses_fan_mode')).catch(this.error);

    this.registerCapabilityListener('ramses_fan_mode', async (mode) => {
      try {
        await this.unit.setMode(mode);
      } catch (error) {
        throw this.toUserError(error);
      }
    });

    await this.#showRemoteWarning(this.getSetting('remote_id'));
    this.#startPolling(this.getSetting('poll_interval'));
    this.homey.setTimeout(() => {
      this.#requestStatus();
    }, FanDevice.FIRST_STATUS_MS);
  }

  async onUninit() {
    this.#stopPolling();
    await super.onUninit();
  }

  async onDeleted() {
    this.#stopPolling();
    await super.onDeleted();
  }

  /** @param {string} address */
  createModel(address) {
    return new FanUnit({
      address,
      send: (packet) => this.send(packet),
      remote: this.getSetting('remote_id') || null,
      gateway: this.gatewayId,
    });
  }

  /** @returns {FanUnit} used by the flow cards */
  get unit() {
    return this.model;
  }

  /** @returns {FanSource} read model for the dashboard widget */
  get source() {
    return {
      id: this.getData().id,
      name: this.getName(),
      available: this.getAvailable(),
      mode: this.unit.mode,
      capabilityValue: (capability) => this.capabilities.get(capability),
      setMode: async (mode) => {
        await this.triggerCapabilityListener('ramses_fan_mode', mode);
      },
    };
  }

  /** @param {DeviceEvent} event */
  triggersFor(event) {
    return FanFlowCards.translate(event);
  }

  /** @param {DeviceEvent} event */
  async onModelEvent(event) {
    if (event instanceof FanModeChanged) {
      await this.capabilities.set('ramses_fan_mode', event.mode);
      await this.#showStatus(event.mode);
    }

    if (event instanceof FanModeChanged || event instanceof ReadingChanged) {
      this.app.publishFan(this.source);
    }
  }

  /**
   * @param {{ newSettings: Record<string, any>, changedKeys: string[] }} event
   */
  async onSettings({ newSettings, changedKeys }) {
    if (changedKeys.includes('remote_id')) {
      const remote = String(newSettings.remote_id ?? '').trim();

      if (remote !== '' && !isAddress(remote)) {
        throw new Error(this.homey.__('device.invalid_remote'));
      }

      this.unit.configure({ remote });
      await this.#showRemoteWarning(remote);
    }

    if (changedKeys.includes('poll_interval')) {
      this.#startPolling(newSettings.poll_interval);
    }
  }

  /**
   * Shows the mode as a word, for the indicator on the device tile.
   * @param {unknown} mode
   */
  async #showStatus(mode) {
    if (typeof mode !== 'string' || mode === this.#indicated) {
      return;
    }

    await this.capabilities.add(FanStatus.LABEL_CAPABILITY);
    await this.capabilities.set(FanStatus.LABEL_CAPABILITY, FanStatus.label(mode, this.homey.i18n.getLanguage()));
    this.#indicated = mode;
  }

  /** Brings a unit added by an earlier version up to the current layout. */
  async #migrate() {
    if ((this.getStoreValue('schema') ?? 1) >= FanDevice.SCHEMA) {
      return;
    }

    const schema = this.getStoreValue('schema') ?? 1;

    if (schema < 2) {
      for (const id of ['measure_co2', 'measure_humidity', 'measure_temperature']) {
        await this.capabilities.remove(id);
      }
    }

    await this.capabilities.remove('measure_ramses_fan_status');
    await this.capabilities.add(FanStatus.LABEL_CAPABILITY);
    await this.setStoreValue('schema', FanDevice.SCHEMA);
  }

  /** @param {unknown} remote */
  async #showRemoteWarning(remote) {
    if (remote) {
      await this.unsetWarning().catch(this.error);
    } else {
      await this.setWarning(this.homey.__('device.no_remote')).catch(this.error);
    }
  }

  /** @param {unknown} minutes 0 turns polling off */
  #startPolling(minutes) {
    this.#stopPolling();

    const interval = Number(minutes);

    if (!Number.isFinite(interval) || interval <= 0) {
      return;
    }

    this.#poller = this.homey.setInterval(() => {
      this.#requestStatus();
    }, interval * 60 * 1000);
  }

  /** Asks the unit for its status; failures only matter in the log. */
  #requestStatus() {
    this.unit.requestStatus().catch((error) => {
      if (!(error instanceof ValidationError)) {
        this.log('Status request failed:', error.message);
      }
    });
  }

  #stopPolling() {
    if (this.#poller !== null) {
      this.homey.clearInterval(/** @type {any} */ (this.#poller));
      this.#poller = null;
    }
  }
}
