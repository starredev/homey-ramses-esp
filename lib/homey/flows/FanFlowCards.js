import { BoostStarted, FanModeChanged, ReadingChanged } from '../../domain/events.js';
import { Reading } from '../../ramses/decoders.js';
import { FlowCardSet } from './FlowCardSet.js';

/** @typedef {import('../../domain/events.js').DeviceEvent} DeviceEvent */
/** @typedef {import('../../domain/FanUnit.js').FanUnit} FanUnit */
/** @typedef {import('./FlowCardSet.js').TriggerInvocation} TriggerInvocation */

/**
 * @typedef {object} FanDevice
 * @property {FanUnit} unit
 */

/** Flow card ids, as declared in `drivers/fan/driver.flow.compose.json`. */
export const FanCards = Object.freeze({
  MODE_CHANGED: 'fan_mode_changed',
  MODE_CHANGED_TO: 'fan_mode_changed_to',
  BOOST_STARTED: 'boost_started',
  FAULT_ON: 'fault_on',
  FAULT_OFF: 'fault_off',
  FILTER_DIRTY: 'filter_dirty',
  MODE_IS: 'fan_mode_is',
  HAS_FAULT: 'has_fault',
  SET_BYPASS: 'set_bypass',
  SET_MODE: 'set_fan_mode',
  START_BOOST: 'start_boost',
  RESET_FILTER: 'reset_filter',
  REQUEST_STATUS: 'request_status',
});

/** Flow cards of the ventilation unit. */
export class FanFlowCards extends FlowCardSet {
  /** @returns {this} */
  register() {
    this.filterTrigger(FanCards.MODE_CHANGED_TO, (args, state) => {
      return args.mode === state.mode;
    });

    this.onCondition(FanCards.MODE_IS, ({ device, mode }) => {
      return /** @type {FanDevice} */ (device).unit.mode === mode;
    });

    this.onCondition(FanCards.HAS_FAULT, ({ device }) => {
      return /** @type {FanDevice} */ (device).unit.reading(Reading.FAULT) === true;
    });

    this.onAction(FanCards.SET_BYPASS, ({ device, mode }) => {
      return /** @type {FanDevice} */ (device).unit.setBypass(mode);
    });
    this.onAction(FanCards.SET_MODE, ({ device, mode }) => {
      return /** @type {FanDevice} */ (device).unit.setMode(mode);
    });
    this.onAction(FanCards.START_BOOST, ({ device, minutes }) => {
      return /** @type {FanDevice} */ (device).unit.boost(minutes);
    });
    this.onAction(FanCards.RESET_FILTER, ({ device }) => {
      return /** @type {FanDevice} */ (device).unit.resetFilter();
    });
    this.onAction(FanCards.REQUEST_STATUS, ({ device }) => {
      return /** @type {FanDevice} */ (device).unit.requestStatus();
    });

    return this;
  }

  /**
   * Maps a domain event onto the triggers it fires.
   * @param {DeviceEvent} event
   * @returns {TriggerInvocation[]}
   */
  static translate(event) {
    if (event instanceof FanModeChanged) {
      return [
        {
          card: FanCards.MODE_CHANGED,
          tokens: { mode: event.mode, source: event.source },
        },
        {
          card: FanCards.MODE_CHANGED_TO,
          state: { mode: event.mode },
        },
      ];
    }

    if (event instanceof ReadingChanged && event.key === Reading.FAULT) {
      return FanFlowCards.#fault(event);
    }

    if (event instanceof ReadingChanged && event.key === Reading.FILTER_DIRTY && event.value === true) {
      return [{ card: FanCards.FILTER_DIRTY }];
    }

    if (event instanceof BoostStarted) {
      return [{
        card: FanCards.BOOST_STARTED,
        tokens: { minutes: event.minutes, source: event.source },
      }];
    }

    return [];
  }

  /**
   * A fault coming fires "fault"; going fires "fault gone", but not the first
   * report of a healthy unit.
   * @param {ReadingChanged} event
   * @returns {TriggerInvocation[]}
   */
  static #fault(event) {
    if (event.value === true) {
      return [{ card: FanCards.FAULT_ON }];
    }

    return event.previous === true ? [{ card: FanCards.FAULT_OFF }] : [];
  }
}
