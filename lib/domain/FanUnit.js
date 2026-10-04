import { ValidationError } from '../errors.js';
import { FanCommands, StatusCode } from '../ramses/commands.js';
import { decode } from '../ramses/decoders.js';
import { DEFAULT_SCHEME } from '../ramses/FanScheme.js';
import { isAddress } from '../ramses/Packet.js';
import { DeviceModel } from './DeviceModel.js';
import { StatusProbe } from './StatusProbe.js';
import {
  BoostStarted, BypassModeChanged, FanModeChanged, SchemeDetected, Source,
} from './events.js';

/** @typedef {import('../ramses/Packet.js').Packet} Packet */
/** @typedef {import('../ramses/FanScheme.js').FanScheme} FanScheme */
/** @typedef {import('./DeviceModel.js').PacketContext} PacketContext */

/**
 * @typedef {(packet: Packet) => Promise<void>} Sender
 * Transmits a frame through a gateway.
 */

/** Codes a unit may or may not answer; asked for until it is clear. */
const OPTIONAL_CODES = Object.freeze([
  StatusCode.EXTENDED,
  StatusCode.HUMIDITY,
  StatusCode.FILTER,
  StatusCode.BYPASS,
]);

/**
 * A ventilation unit (FAN / heat recovery unit). Follows its state from its
 * own status reports and from the commands remotes send it, and commands it
 * in the name of a remote it is bound to. Brands number their modes
 * differently; the unit uses the scheme it is given, or learns it from the
 * commands its remotes send when it may.
 */
export class FanUnit extends DeviceModel {
  /** @type {Sender} */
  #send;

  /** @type {string | null} */
  #remote;

  /** @type {string | null} */
  #gateway;

  /** @type {FanScheme} */
  #scheme;

  /** Whether the scheme may be learnt from the bus. */
  #learnScheme;

  /** @type {string | null} */
  #mode = null;

  /** @type {string | null} */
  #bypassMode = null;

  /** @type {Map<string, StatusProbe>} optional codes the unit may answer */
  #probes = new Map(OPTIONAL_CODES.map((code) => [code, new StatusProbe()]));

  /**
   * @param {object} options
   * @param {string} options.address
   * @param {Sender} options.send
   * @param {string | null} [options.remote] the bound remote Homey speaks as
   * @param {string | null} [options.gateway] the gateway that asks for status
   * @param {FanScheme} [options.scheme] how the unit numbers its modes
   * @param {boolean} [options.learnScheme] whether to adopt a scheme revealed on the bus
   * @param {() => number} [options.clock]
   */
  constructor({
    address, send, remote = null, gateway = null, scheme = DEFAULT_SCHEME, learnScheme = true, clock,
  }) {
    super({ address, clock });
    this.#send = send;
    this.#remote = remote;
    this.#gateway = gateway;
    this.#scheme = scheme;
    this.#learnScheme = learnScheme;
  }

  /** @returns {string | null} */
  get mode() {
    return this.#mode;
  }

  /** @returns {string | null} `auto`, `on` (open) or `off` (closed) */
  get bypassMode() {
    return this.#bypassMode;
  }

  /** @returns {string | null} */
  get remote() {
    return this.#remote;
  }

  /** @returns {FanScheme} */
  get scheme() {
    return this.#scheme;
  }

  /**
   * @param {object} options
   * @param {string | null} [options.remote]
   * @param {string | null} [options.gateway]
   * @param {FanScheme} [options.scheme]
   * @param {boolean} [options.learnScheme]
   */
  configure({ remote, gateway, scheme, learnScheme }) {
    if (remote !== undefined) {
      this.#remote = remote || null;
    }

    if (gateway !== undefined) {
      this.#gateway = gateway || null;
    }

    if (scheme !== undefined) {
      this.#scheme = scheme;
    }

    if (learnScheme !== undefined) {
      this.#learnScheme = learnScheme;
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

  /** @param {string} mode `auto`, `on` (open) or `off` (closed) */
  async setBypass(mode) {
    await this.#send(this.#commands().setBypass(mode));
    this.#changeBypass(mode);
  }

  /**
   * Asks the unit for its fan state, and for the optional codes (extended
   * status, humidity, filter, bypass) as long as it might answer them.
   */
  async requestStatus() {
    const gateway = this.#gateway;

    if (!gateway) {
      throw new ValidationError('No gateway to ask the status with');
    }

    const commands = new FanCommands({ remote: gateway, unit: this.address, scheme: this.#scheme });

    await this.#send(commands.requestStatus(gateway, StatusCode.FAN));

    for (const [code, probe] of this.#probes) {
      if (probe.shouldAsk()) {
        await this.#send(commands.requestStatus(gateway, code));
      }
    }
  }

  /**
   * @param {string} code one of {@link StatusCode}
   * @returns {boolean | null} whether the unit answers the code; null until known
   */
  supports(code) {
    return this.#probes.get(code)?.supported ?? null;
  }

  /** @returns {boolean | null} whether the unit reports the extended status; null until known */
  get extended() {
    return this.supports(StatusCode.EXTENDED);
  }

  /** @returns {boolean | null} whether the unit reports its humidity; null until known */
  get humidity() {
    return this.supports(StatusCode.HUMIDITY);
  }

  // --- Packets --------------------------------------------------------------

  /** @param {Packet} packet */
  fromDevice(packet) {
    const { readings, mode, bypassMode } = decode(packet, { scheme: this.#scheme });

    this.#probes.get(packet.code)?.answered();
    this.applyReadings(readings);

    if (mode) {
      this.#changeMode(mode, Source.UNIT, null);
    }

    if (bypassMode) {
      this.#changeBypass(bypassMode);
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

    const revealed = decode(packet).scheme;

    if (revealed && this.#learnScheme && revealed !== this.#scheme) {
      this.#scheme = revealed;
      this.publish(new SchemeDetected(revealed.id));
    }

    const { mode, boostMinutes } = decode(packet, { scheme: this.#scheme });
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

    return new FanCommands({ remote: this.#remote, unit: this.address, scheme: this.#scheme });
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

  /** @param {string} mode */
  #changeBypass(mode) {
    if (mode === this.#bypassMode) {
      return;
    }

    this.#bypassMode = mode;
    this.publish(new BypassModeChanged(mode));
  }
}
