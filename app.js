import Homey from 'homey';
import { loggerFrom } from './lib/utils.js';
import { Binder } from './lib/homey/Binder.js';
import { FanPresenter } from './lib/homey/FanPresenter.js';
import { GatewayRegistry } from './lib/homey/GatewayRegistry.js';
import { PacketPresenter, RingBuffer } from './lib/homey/PacketPresenter.js';
import { RamsesApi } from './lib/homey/RamsesApi.js';
import { RealtimeHub } from './lib/homey/RealtimeHub.js';

/** @typedef {import('./lib/homey/PacketPresenter.js').PacketView} PacketView */
/** @typedef {import('./lib/homey/FanPresenter.js').FanSource} FanSource */
/** @typedef {import('./drivers/fan/device.js').default} FanDevice */

/** Drivers whose devices are identified by a bus address. */
const DRIVER_IDS = Object.freeze(['gateway', 'fan', 'remote', 'sensor', 'virtual_sensor']);

/**
 * Composition root. Creates the app-wide services: the register of gateways
 * every device listens to, the packet log and realtime feed of the settings
 * page and the widgets, and the web API.
 */
export default class RamsesApp extends Homey.App {
  static WIDGET_ID = 'fan';

  /** Packets kept for the live view of the settings page. */
  static LOG_SIZE = 300;

  /** @type {GatewayRegistry} */
  #gateways;

  /** @type {Binder} */
  #binder;

  /** @type {RingBuffer<PacketView>} */
  #log;

  /** @type {RealtimeHub} */
  #realtime;

  /** @type {RamsesApi} */
  #api;

  async onInit() {
    this.#gateways = new GatewayRegistry();
    this.#binder = new Binder({ registry: this.#gateways, timers: this.homey });
    this.#log = new RingBuffer(RamsesApp.LOG_SIZE);
    this.#realtime = new RealtimeHub({
      api: this.homey.api,
      timers: this.homey,
      logger: loggerFrom(this),
    });
    this.#api = new RamsesApi({
      registry: this.#gateways,
      log: this.#log,
      isPaired: (address) => this.#pairedAddresses().has(address),
      fans: () => this.#fanSources(),
    });

    this.#bindRegistry();
    this.#registerWidgetSettings();
    this.log('RAMSES app started');
  }

  async onUninit() {
    this.#realtime?.dispose();
  }

  /** @returns {GatewayRegistry} */
  get gateways() {
    return this.#gateways;
  }

  /** @returns {Binder} binds devices Homey plays to units */
  get binder() {
    return this.#binder;
  }

  /** @returns {RamsesApi} */
  get api() {
    return this.#api;
  }

  /**
   * Tells the dashboard widgets that a ventilation unit changed.
   * @param {FanSource} source
   */
  publishFan(source) {
    this.#realtime.fan(FanPresenter.view(source));
  }

  #bindRegistry() {
    this.#gateways.on('packet', (packet, context, gateway) => {
      const view = PacketPresenter.packet(packet, {
        gateway: gateway.id,
        echo: context.echo,
        time: Date.now(),
      });

      this.#log.push(view);
      this.#realtime.packet(view);
    });

    this.#gateways.on('discovered', () => {
      this.#realtime.busChanged();
    });

    this.#gateways.on('changed', () => {
      this.#realtime.busChanged();
    });
  }

  /** @returns {FanSource[]} */
  #fanSources() {
    try {
      const devices = /** @type {FanDevice[]} */ (this.homey.drivers.getDriver('fan').getDevices());

      return devices.map((device) => device.source);
    } catch {
      // The driver is not ready yet while the app is still starting.
      return [];
    }
  }

  #registerWidgetSettings() {
    try {
      const widget = this.homey.dashboards.getWidget(RamsesApp.WIDGET_ID);

      widget.registerSettingAutocompleteListener('device', async (query) => {
        const needle = String(query ?? '').toLowerCase();

        return this.#api.fans()
          .filter((fan) => fan.name.toLowerCase().includes(needle))
          .map((fan) => ({ id: fan.id, name: fan.name }));
      });
    } catch (error) {
      this.error('Could not register the widget settings', error);
    }
  }

  /** @returns {Set<string>} the addresses of every device added to Homey */
  #pairedAddresses() {
    const addresses = new Set();

    for (const id of DRIVER_IDS) {
      try {
        for (const device of this.homey.drivers.getDriver(id).getDevices()) {
          addresses.add(device.getData().id);
        }
      } catch {
        // The driver is not ready yet while the app is still starting.
      }
    }

    return addresses;
  }
}
