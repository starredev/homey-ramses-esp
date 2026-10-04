import { decode } from '../ramses/decoders.js';
import { DeviceModel } from './DeviceModel.js';
import { ButtonPressed } from './events.js';

/** @typedef {import('../ramses/Packet.js').Packet} Packet */
/** @typedef {import('./DeviceModel.js').PacketContext} PacketContext */

/** Button name for the boost (timer) button. */
export const BOOST_BUTTON = 'boost';

/**
 * A physical RF remote. Every button press becomes a {@link ButtonPressed};
 * the repeated frames of one press and Homey's own commands sent in the
 * remote's name are not presses.
 */
export class Remote extends DeviceModel {
  /** @type {string | null} */
  #lastButton = null;

  /** @returns {string | null} */
  get lastButton() {
    return this.#lastButton;
  }

  /**
   * @param {Packet} packet
   * @param {PacketContext} context
   */
  fromDevice(packet, context) {
    const { readings, mode, boostMinutes } = decode(packet);

    this.applyReadings(readings);

    if (context.echo || packet.verb !== 'I' || (!mode && !boostMinutes)) {
      return;
    }

    if (this.repeats.isRepeat(packet)) {
      return;
    }

    // A timer that names its rate (Orcon "High" for 60 minutes) is that button.
    const button = mode ?? BOOST_BUTTON;

    this.#lastButton = button;
    this.publish(new ButtonPressed(button, packet.dst, boostMinutes ?? 0));
  }
}
