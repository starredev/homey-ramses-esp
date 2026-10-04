import { ValidationError } from '../errors.js';
import { FanCommands, StatusCode } from '../ramses/commands.js';
import { decode } from '../ramses/decoders.js';
import { isAddress } from '../ramses/Packet.js';
import { DeviceModel } from './DeviceModel.js';
import { StatusProbe } from './StatusProbe.js';
import { BoostStarted, FanModeChanged, Source } from './events.js';

/** @typedef {import('../ramses/Packet.js').Packet} Packet */
/** @typedef {import('./DeviceModel.js').PacketContext} PacketContext */

/**
 * @typedef {(packet: Packet) => Promise<void>} Sender
 * Transmits a frame through a gateway.
 */

/**
 * A ventilation unit (FAN / heat recovery unit). Follows its state from its
 * own status reports and from the commands remotes send it, and commands it
 * in the name of a remote it is bound to.
 */
export class FanUnit extends DeviceModel {
  /** @type {Sender} */
  #send;

  /** @type {string | null} */
  #remote;

  /** @type {string | null} */
  #gateway;

  /** @type {string | null} */
  #mode = null;

  /** @type {Map<string, StatusProbe>} optional codes the unit may answer */
  #probes = new Map([
    [StatusCode.EXTENDED, new StatusProbe()],
    [StatusCode.HUMIDITY, new StatusProbe()],
  ]);

  /**
   * @param {object} options
   * @param {string} options.address
   * @param {Sender} options.send
   * @param {string | null} [options.remote] the bound remote Homey speaks as
   * @param {string | null} [options.gateway] the gateway that asks for status
   * @param {() => number} [options.clock]
   */
  constructor({ address, send, remote = null, gateway = null, clock }) {
    super({ address, clock });
    this.#send = send;
    this.#remote = remote;
    this.#gateway = gateway;
  }

  /** @returns {string | null} */
  get mode() {
    return this.#mode;
  }

  /** @returns {string | null} */
  get remote() {
    return this.#remote;
  }

  /**
   * @param {object} addresses
   * @param {string | null} [addresses.remote]
   * @param {string | null} [addresses.gateway]
   */
  configure({ remote, gateway }) {
    if (remote !== undefined) {
      this.#remote = remote || null;
    }

    if (gateway !== undefined) {
      this.#gateway = gateway || null;
    }
  }

  // --- Commands -------------------------------------------------------------

  /** @param {string} mode see `FanMode` */
  async setMode(mode) {
    await this.#send(this.#commands().setMode(mode));
    this.#changeMode(mode, Source.HOMEY, this.#remote);
  }

  /** @param {number} minutes */
  async boost(minutes) {
    const packet = this.#commands().boost(minutes);

    await this.#send(packet);
    this.publish(new BoostStarted(Math.round(Number(minutes)), Source.HOMEY, this.#remote));
  }

  async resetFilter() {
    await this.#send(this.#commands().resetFilter());
  }

  /**
   * Asks the unit for its fan state, and for the optional codes (extended
   * status, humidity) as long as it might answer them.
   */
  async requestStatus() {
    const gateway = this.#gateway;

    if (!gateway) {
      throw new ValidationError('No gateway to ask the status with');
    }

    const commands = new FanCommands({ remote: gateway, unit: this.address });

    await this.#send(commands.requestStatus(gateway, StatusCode.FAN));

    for (const [code, probe] of this.#probes) {
      if (probe.shouldAsk()) {
        await this.#send(commands.requestStatus(gateway, code));
      }
    }
  }

  /** @returns {boolean | null} whether the unit reports the extended status; null until known */
  get extended() {
    return this.#probes.get(StatusCode.EXTENDED)?.supported ?? null;
  }

  /** @returns {boolean | null} whether the unit reports its humidity; null until known */
  get humidity() {
    return this.#probes.get(StatusCode.HUMIDITY)?.supported ?? null;
  }

  // --- Packets --------------------------------------------------------------

  /** @param {Packet} packet */
  fromDevice(packet) {
    const { readings, mode } = decode(packet);

    this.#probes.get(packet.code)?.answered();

    this.applyReadings(readings);

    if (mode) {
      this.#changeMode(mode, Source.UNIT, null);
    }
  }

  /**
   * @param {Packet} packet
   * @param {PacketContext} context
   */
  toDevice(packet, context) {
    if (packet.verb !== 'I' || this.repeats.isRepeat(packet)) {
      return;
    }

    const { mode, boostMinutes } = decode(packet);
    const source = context.echo ? Source.HOMEY : Source.REMOTE;

    if (mode) {
      this.#changeMode(mode, source, packet.src);
    }

    if (boostMinutes && !context.echo) {
      this.publish(new BoostStarted(boostMinutes, source, packet.src));
    }
  }

  // --- Internals --------------------------------------------------------------

  /** @returns {FanCommands} */
  #commands() {
    if (!this.#remote || !isAddress(this.#remote)) {
      throw new ValidationError('No remote address set to command the unit with');
    }

    return new FanCommands({ remote: this.#remote, unit: this.address });
  }

  /**
   * @param {string} mode
   * @param {string} source
   * @param {string | null} by
   */
  #changeMode(mode, source, by) {
    if (mode === this.#mode) {
      return;
    }

    const previous = this.#mode;

    this.#mode = mode;
    this.publish(new FanModeChanged(mode, previous, source, by));
  }
}
