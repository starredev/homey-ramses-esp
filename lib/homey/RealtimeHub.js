import { Batcher } from '../timers.js';

/** @typedef {import('../timers.js').Timers} Timers */
/** @typedef {import('../utils.js').Logger} Logger */
/** @typedef {import('./PacketPresenter.js').PacketView} PacketView */
/** @typedef {import('./FanPresenter.js').FanView} FanView */

/**
 * @typedef {object} RealtimeApi
 * @property {(event: string, data: unknown) => unknown} realtime
 */

/** Realtime channels the settings page and the widgets subscribe to. */
export const Channels = Object.freeze({
  PACKETS: 'ramses.packets',
  BUS: 'ramses.bus',
  FAN: 'ramses.fan',
});

/**
 * Pushes bus activity to the settings page over Homey's realtime API.
 * Packets are batched: a burst of frames becomes one message.
 */
export class RealtimeHub {
  /** Time between two packet batches. */
  static BATCH_MS = 500;

  /** @type {RealtimeApi} */
  #api;

  /** @type {Logger} */
  #logger;

  /** @type {Batcher<PacketView>} */
  #packets;

  /**
   * @param {object} options
   * @param {RealtimeApi} options.api
   * @param {Timers} options.timers
   * @param {Logger} options.logger
   */
  constructor({ api, timers, logger }) {
    this.#api = api;
    this.#logger = logger;
    this.#packets = new Batcher(timers, RealtimeHub.BATCH_MS, (views) => {
      this.#publish(Channels.PACKETS, views);
    });
  }

  /** @param {PacketView} view */
  packet(view) {
    this.#packets.push(view);
  }

  /** Tells the settings page that the device list or a gateway changed. */
  busChanged() {
    this.#publish(Channels.BUS, null);
  }

  /**
   * Tells the dashboard widgets that a ventilation unit changed.
   * @param {FanView} view
   */
  fan(view) {
    this.#publish(Channels.FAN, view);
  }

  dispose() {
    this.#packets.cancel();
  }

  /**
   * Fire-and-forget: a settings page that is not open is not an error.
   * @param {string} channel
   * @param {unknown} data
   */
  async #publish(channel, data) {
    try {
      await this.#api.realtime(channel, data);
    } catch (error) {
      this.#logger.error(`Realtime ${channel} failed:`, error);
    }
  }
}
