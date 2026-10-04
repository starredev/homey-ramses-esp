import { Packet } from '../../ramses/Packet.js';
import { PacketPresenter } from '../PacketPresenter.js';
import { FlowCardSet } from './FlowCardSet.js';

/** @typedef {import('../../domain/Gateway.js').Gateway} Gateway */
/** @typedef {import('../../domain/events.js').DeviceDiscovered} DeviceDiscovered */
/** @typedef {import('./FlowCardSet.js').TriggerInvocation} TriggerInvocation */

/**
 * @typedef {object} GatewayDevice
 * @property {Gateway} gateway
 */

/** Flow card ids, as declared in `drivers/gateway/driver.flow.compose.json`. */
export const GatewayCards = Object.freeze({
  PACKET_RECEIVED: 'packet_received',
  CODE_RECEIVED: 'code_received',
  DEVICE_DISCOVERED: 'device_discovered',
  WENT_OFFLINE: 'gateway_went_offline',
  CAME_ONLINE: 'gateway_came_online',
  IS_ONLINE: 'gateway_is_online',
  SEND_FRAME: 'send_frame',
  SEND_COMMAND: 'send_command',
});

/**
 * @param {unknown} value
 * @returns {string} upper case, without spaces
 */
function normalise(value) {
  return String(value ?? '').replace(/\s+/g, '').toUpperCase();
}

/**
 * Flow cards of the gateway: the raw bus, for everything the device cards
 * do not cover. Any packet can start a flow and any frame can be sent.
 */
export class GatewayFlowCards extends FlowCardSet {
  /** @returns {this} */
  register() {
    this.filterTrigger(GatewayCards.CODE_RECEIVED, (args, state) => {
      const address = String(args.address ?? '').trim();
      const matchesAddress = address === '' || address === '*' || address === state.src || address === state.dst;

      return normalise(args.code) === state.code && matchesAddress;
    });

    this.onCondition(GatewayCards.IS_ONLINE, ({ device }) => {
      const { gateway } = /** @type {GatewayDevice} */ (device);

      return gateway.connected && gateway.online !== false;
    });

    this.onAction(GatewayCards.SEND_FRAME, ({ device, frame }) => {
      return /** @type {GatewayDevice} */ (device).gateway.send(Packet.fromUserInput(frame));
    });
    this.onAction(GatewayCards.SEND_COMMAND, ({ device, verb, address, code, payload }) => {
      const { gateway } = /** @type {GatewayDevice} */ (device);

      return gateway.send(Packet.create({
        verb,
        src: gateway.id,
        dst: String(address ?? '').trim() || null,
        code,
        payload,
      }));
    });

    return this;
  }

  /**
   * @param {Packet} packet
   * @returns {TriggerInvocation[]}
   */
  static packet(packet) {
    const tokens = PacketPresenter.tokens(packet);

    return [
      { card: GatewayCards.PACKET_RECEIVED, tokens },
      {
        card: GatewayCards.CODE_RECEIVED,
        tokens,
        state: { code: packet.code, src: packet.src, dst: packet.dst },
      },
    ];
  }

  /**
   * @param {DeviceDiscovered} event
   * @returns {TriggerInvocation[]}
   */
  static discovered(event) {
    return [{
      card: GatewayCards.DEVICE_DISCOVERED,
      tokens: { address: event.id, role: event.role },
    }];
  }

  /**
   * @param {boolean} online
   * @returns {TriggerInvocation[]}
   */
  static online(online) {
    return [{ card: online ? GatewayCards.CAME_ONLINE : GatewayCards.WENT_OFFLINE }];
  }
}
