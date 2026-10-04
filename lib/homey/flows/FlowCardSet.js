/** @typedef {import('../../utils.js').Logger} Logger */

/**
 * @typedef {object} TriggerCard
 * @property {(device: any, tokens?: object, state?: object) => Promise<unknown>} trigger
 * @property {(listener: (args: any, state: any) => Promise<boolean>) => unknown} registerRunListener
 */

/**
 * @typedef {object} RunListenerCard
 * @property {(listener: (args: any) => Promise<unknown>) => unknown} registerRunListener
 * @property {(arg: string, listener: (query: string, args: any) => Promise<any>) => unknown}
 *   [registerArgumentAutocompleteListener]
 */

/**
 * @typedef {object} FlowManager
 * The subset of `homey.flow` used here.
 * @property {(id: string) => TriggerCard} getDeviceTriggerCard
 * @property {(id: string) => RunListenerCard} getConditionCard
 * @property {(id: string) => RunListenerCard} getActionCard
 */

/**
 * @typedef {object} TriggerInvocation
 * @property {string} card
 * @property {Record<string, unknown>} [tokens]
 * @property {Record<string, unknown>} [state]
 */

/**
 * Base for the flow cards of one driver: caches the trigger cards, fires
 * invocations and registers condition and action listeners. Failing triggers
 * are logged, never thrown, so a broken flow cannot stop the packet stream.
 */
export class FlowCardSet {
  /** @type {FlowManager} */
  #flow;

  /** @type {Logger} */
  #logger;

  /** @type {Map<string, TriggerCard>} */
  #triggers = new Map();

  /**
   * @param {FlowManager} flow
   * @param {Logger} logger
   */
  constructor(flow, logger) {
    this.#flow = flow;
    this.#logger = logger;
  }

  /**
   * @param {object} device
   * @param {TriggerInvocation[]} invocations
   * @returns {Promise<void>}
   */
  async fire(device, invocations) {
    await Promise.all(invocations.map(async ({ card, tokens = {}, state = {} }) => {
      try {
        await this.trigger(card).trigger(device, tokens, state);
      } catch (error) {
        this.#logger.error(`Trigger ${card} failed:`, error);
      }
    }));
  }

  /**
   * @param {string} id
   * @returns {TriggerCard}
   */
  trigger(id) {
    let card = this.#triggers.get(id);

    if (!card) {
      card = this.#flow.getDeviceTriggerCard(id);
      this.#triggers.set(id, card);
    }

    return card;
  }

  /**
   * Fires a trigger only for flows whose arguments match the state.
   * @param {string} id
   * @param {(args: any, state: any) => boolean} matches
   */
  filterTrigger(id, matches) {
    this.trigger(id).registerRunListener(async (args, state) => {
      return matches(args, state);
    });
  }

  /**
   * @param {string} id
   * @param {(args: any) => boolean} evaluate
   */
  onCondition(id, evaluate) {
    this.#flow.getConditionCard(id).registerRunListener(async (args) => {
      return evaluate(args);
    });
  }

  /**
   * Offers the choices of an autocomplete argument of an action card.
   * @param {string} id
   * @param {string} arg
   * @param {(query: string) => unknown[]} search
   */
  onAutocomplete(id, arg, search) {
    this.#flow.getActionCard(id).registerArgumentAutocompleteListener?.(arg, async (query) => {
      return search(String(query ?? ''));
    });
  }

  /**
   * @param {string} id
   * @param {(args: any) => unknown} run
   */
  onAction(id, run) {
    this.#flow.getActionCard(id).registerRunListener(async (args) => {
      await run(args);
    });
  }
}
