/**
 * Dashboard widget: the mode of one ventilation unit, as a spinning fan and a
 * word, with buttons to change it.
 */

/** Seconds per rotation of the fan icon, per mode. */
const SPIN_SECONDS = Object.freeze({
  low: 3,
  medium: 1.6,
  high: 0.7,
  auto: 1.6,
  away: 5,
});

const PHRASES = Object.freeze({
  en: {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    auto: 'Auto',
    away: 'Away',
    unknown: 'Unknown',
    empty: 'No ventilation unit found. Add one first.',
    offline: 'not reachable',
  },
  nl: {
    low: 'Laag',
    medium: 'Midden',
    high: 'Hoog',
    auto: 'Auto',
    away: 'Afwezig',
    unknown: 'Onbekend',
    empty: 'Geen ventilatie-unit gevonden. Voeg er eerst een toe.',
    offline: 'niet bereikbaar',
  },
});

/**
 * @typedef {object} FanView
 * @property {string} id
 * @property {string} name
 * @property {boolean} available
 * @property {string | null} mode
 * @property {number | null} speed
 * @property {number | null} co2
 * @property {number | null} humidity
 * @property {number | null} temperature
 */

/**
 * @typedef {object} WidgetBridge
 * The `Homey` object Homey passes to a dashboard widget.
 * @property {(method: string, path: string, body?: unknown) => Promise<any>} api
 * @property {(event: string, handler: (data: any) => void) => void} on
 * @property {() => any} getSettings
 * @property {(options?: { height?: number }) => void} ready
 */

/** Looks up phrases in the language of the dashboard. */
class Translator {
  /** @type {Record<string, any>} */
  #phrases;

  /** @param {string} locale */
  constructor(locale) {
    const language = locale.toLowerCase().slice(0, 2);

    this.#phrases = /** @type {Record<string, any>} */ (PHRASES)[language] ?? PHRASES.en;
  }

  /**
   * @param {string} key
   * @param {...unknown} args
   * @returns {string}
   */
  t(key, ...args) {
    const phrase = this.#phrases[key];

    return typeof phrase === 'function' ? phrase(...args) : (phrase ?? key);
  }
}

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
function element(id) {
  return /** @type {HTMLElement} */ (document.getElementById(id));
}

/** The widget controller. */
class FanWidget {
  /** @type {WidgetBridge} */
  #homey;

  #i18n = new Translator(globalThis.navigator?.language ?? 'en');

  /** @type {string | null} */
  #deviceId;

  /** @type {FanView | null} */
  #view = null;

  #announcedReady = false;

  /** @param {WidgetBridge} homey */
  constructor(homey) {
    this.#homey = homey;
    this.#deviceId = homey.getSettings()?.device?.id ?? null;
  }

  async start() {
    for (const node of document.querySelectorAll('[data-t]')) {
      node.textContent = this.#i18n.t(node.getAttribute('data-t') ?? '');
    }

    element('buttons').addEventListener('click', (event) => {
      const button = /** @type {HTMLElement} */ (event.target).closest('button');

      if (button?.dataset.mode) {
        this.#setMode(button.dataset.mode);
      }
    });

    this.#homey.on('ramses.fan', (view) => {
      if (view?.id === this.#deviceId) {
        this.#show(view);
      }
    });

    await this.#load();
  }

  async #load() {
    const query = this.#deviceId ? `?id=${encodeURIComponent(this.#deviceId)}` : '';

    try {
      this.#show(await this.#homey.api('GET', `/${query}`));
    } catch {
      this.#show(null);
    }
  }

  /** @param {string} mode */
  async #setMode(mode) {
    if (!this.#view || this.#view.mode === mode) {
      return;
    }

    const previous = this.#view;

    element('message').textContent = '';
    this.#show({ ...previous, mode });

    try {
      this.#show(await this.#homey.api('PUT', '/mode', { id: previous.id, mode }));
    } catch (error) {
      this.#show(previous);
      element('message').textContent = error instanceof Error ? error.message : String(error);
    }
  }

  /** @param {FanView | null} view */
  #show(view) {
    if (!view) {
      element('content').hidden = true;
      element('empty').hidden = false;
      element('empty').textContent = this.#i18n.t('empty');
      this.#announceReady();

      return;
    }

    this.#view = view;
    this.#deviceId = view.id;

    const mode = view.mode ?? 'unknown';
    const fan = /** @type {SVGElement} */ (document.querySelector('.fan'));
    const spinning = view.available && view.mode !== null;

    element('name').textContent = view.name;
    element('dot').classList.toggle('on', view.available);
    element('mode').textContent = this.#i18n.t(mode);
    fan.style.setProperty('--spin', `${SPIN_SECONDS[/** @type {keyof typeof SPIN_SECONDS} */ (mode)] ?? 2}s`);
    fan.style.setProperty('--play', spinning ? 'running' : 'paused');

    for (const button of /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll('[data-mode]'))) {
      button.classList.toggle('on', button.dataset.mode === view.mode);
      button.disabled = !view.available;
    }

    element('details').replaceChildren(...this.#details(view).map((text) => {
      const span = document.createElement('span');

      span.textContent = text;

      return span;
    }));

    this.#announceReady();
  }

  /**
   * @param {FanView} view
   * @returns {string[]}
   */
  #details(view) {
    if (!view.available) {
      return [this.#i18n.t('offline')];
    }

    return [
      view.speed === null ? null : `${Math.round(view.speed)} %`,
      view.co2 === null ? null : `${view.co2} ppm`,
      view.humidity === null ? null : `${Math.round(view.humidity)} %RV`,
      view.temperature === null ? null : `${view.temperature.toFixed(1)} °C`,
    ].filter((text) => text !== null);
  }

  /** Tells Homey the widget rendered, once, with its final height. */
  #announceReady() {
    if (this.#announcedReady) {
      return;
    }

    const shown = element('content').hidden ? element('empty') : element('content');

    this.#announcedReady = true;
    this.#homey.ready({ height: Math.ceil(shown.getBoundingClientRect().height) });
  }
}

const homey = /** @type {WidgetBridge} */ (await /** @type {any} */ (window).homeyReady);

new FanWidget(homey).start();
