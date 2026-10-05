import { ValidationError } from '../../lib/errors.js';
import {
  BypassModeChanged, FanModeChanged, ParamChanged, ReadingChanged, SchemeDetected,
} from '../../lib/domain/events.js';
import { FAN_PARAMS } from '../../lib/ramses/FanParams.js';
import { REMOTE_OFFER } from '../../lib/ramses/binding.js';
import { FanUnit } from '../../lib/domain/FanUnit.js';
import { FanStatus } from '../../lib/homey/FanStatus.js';
import { RamsesDevice } from '../../lib/homey/RamsesDevice.js';
import { FanFlowCards } from '../../lib/homey/flows/FanFlowCards.js';
import { schemeById } from '../../lib/ramses/FanScheme.js';
import { isAddress } from '../../lib/ramses/Packet.js';

/** Setting value that lets the unit learn its brand from the bus. */
const AUTO_SCHEME = 'auto';

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
   * tile. 4: the numeric status indicator is gone again. 5: binding Homey as
   * a remote, as a maintenance action.
   */
  static SCHEMA = 5;

  /** Maintenance action that binds Homey to the unit as a remote. */
  static BIND_ACTION = 'button.bind_remote';

  /** Time between two parameter requests, so the bus is not flooded. */
  static PARAM_SPACING_MS = 1500;

  /** How long to wait for a first parameter before calling them unsupported. */
  static PARAM_PROBE_MS = 10000;

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

    if (this.hasCapability('ramses_bypass_mode')) {
      this.#listenToBypass();
    }

    if (this.hasCapability(FanDevice.BIND_ACTION)) {
      this.registerCapabilityListener(FanDevice.BIND_ACTION, async () => {
        await this.#bindAsRemote();
      });
    }

    await this.#showRemoteWarning(this.getSetting('remote_id'));
    this.#startPolling(this.getSetting('poll_interval'));
    this.homey.setTimeout(() => {
      this.#requestStatus();
      this.runSafely(() => this.#probeParams());
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
      ...this.#schemeOptions(this.getSetting('scheme')),
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

    if (event instanceof BypassModeChanged) {
      await this.#showBypass(event.mode);
    }

    if (event instanceof ParamChanged) {
      await this.setSettings({
        [`param_${event.param.id}`]: event.param.value,
        params_status: this.homey.__('device.params_supported'),
      }).catch(this.error);
    }

    if (event instanceof SchemeDetected) {
      this.log(`The unit numbers its modes as ${event.scheme} does`);
      await this.setStoreValue('scheme', event.scheme);
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

    for (const key of changedKeys.filter((changed) => changed.startsWith('param_'))) {
      const id = key.slice('param_'.length);

      try {
        await this.unit.setParam(id, newSettings[key]);
      } catch (error) {
        throw this.toUserError(error);
      }

      this.homey.setTimeout(() => {
        this.runSafely(() => this.unit.readParam(id));
      }, FanDevice.PARAM_SPACING_MS);
    }

    if (changedKeys.includes('scheme')) {
      this.unit.configure(this.#schemeOptions(newSettings.scheme));
    }

    if (changedKeys.includes('poll_interval')) {
      this.#startPolling(newSettings.poll_interval);
    }
  }

  /**
   * Binds Homey to the unit as a remote of its own, so it no longer needs to
   * speak in the name of a physical remote. The unit must be in binding mode.
   */
  async #bindAsRemote() {
    const binder = this.app.binder;
    const remote = this.getStoreValue('own_remote') ?? binder.freeAddress('29');

    await this.setStoreValue('own_remote', remote);

    try {
      await binder.bind({
        supplicant: remote,
        offers: [REMOTE_OFFER],
        unit: this.getData().id,
        gateway: this.gatewayId,
      });
    } catch (error) {
      throw this.toUserError(error);
    }

    this.log(`Bound as remote ${remote}`);
    this.unit.configure({ remote });
    await this.setSettings({ remote_id: remote });
    await this.#showRemoteWarning(remote);
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

  /**
   * @param {unknown} setting `auto` or the id of a scheme
   * @returns {{ scheme: import('../../lib/ramses/FanScheme.js').FanScheme, learnScheme: boolean }}
   */
  #schemeOptions(setting) {
    const learn = !setting || setting === AUTO_SCHEME;

    return {
      scheme: schemeById(learn ? this.getStoreValue('scheme') : String(setting)),
      learnScheme: learn,
    };
  }

  /**
   * Shows the bypass of a heat recovery unit; units without one never report it.
   * @param {string} mode
   */
  async #showBypass(mode) {
    if (!this.hasCapability('ramses_bypass_mode')) {
      await this.capabilities.add('ramses_bypass_mode');
      this.#listenToBypass();
    }

    await this.capabilities.set('ramses_bypass_mode', mode);
  }

  #listenToBypass() {
    this.registerCapabilityListener('ramses_bypass_mode', async (mode) => {
      try {
        await this.unit.setBypass(mode);
      } catch (error) {
        throw this.toUserError(error);
      }
    });
  }

  /**
   * Asks for one parameter; when the unit answers, reads them all, one at a
   * time. Units without parameters are asked once and then left alone.
   */
  async #probeParams() {
    if (!(await this.unit.readParam(FAN_PARAMS[0].id))) {
      return;
    }

    this.homey.setTimeout(() => {
      if (this.unit.paramsSupported) {
        this.#readParams(1);
      } else {
        this.setSettings({ params_status: this.homey.__('device.params_unsupported') }).catch(this.error);
      }
    }, FanDevice.PARAM_PROBE_MS);
  }

  /** @param {number} index the next parameter to ask for */
  #readParams(index) {
    const param = FAN_PARAMS[index];

    if (!param) {
      return;
    }

    this.runSafely(() => this.unit.readParam(param.id));
    this.homey.setTimeout(() => {
      this.#readParams(index + 1);
    }, FanDevice.PARAM_SPACING_MS);
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
    await this.capabilities.add(FanDevice.BIND_ACTION, {
      maintenanceAction: true,
      title: { en: 'Bind Homey as a remote', nl: 'Koppel Homey als afstandsbediening' },
    });
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
