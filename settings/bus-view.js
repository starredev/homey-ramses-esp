/**
 * Settings page of the app: the gateways, the devices on the bus (device
 * finder), live traffic and a form to send a raw frame.
 */

/** Packets kept on screen. */
const MAX_PACKETS = 300;

/** @typedef {(error: Error | null, result: any) => void} ApiCallback */

/**
 * @typedef {object} HomeyBridge
 * @property {(method: string, path: string, body: unknown, callback: ApiCallback) => void} api
 * @property {(event: string, callback: (data: any) => void) => void} on
 * @property {(key: string) => string} __
 * @property {() => void} ready
 */

/**
 * @param {string} tag
 * @param {Record<string, string>} [attributes]
 * @param {Array<Node | string>} [children]
 * @returns {HTMLElement}
 */
function element(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);

  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }

  node.append(...children);

  return node;
}

/**
 * @param {number} time epoch ms
 * @returns {string}
 */
function clock(time) {
  return new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * @param {Record<string, unknown>} decoded
 * @returns {string}
 */
function describe(decoded) {
  return Object.entries(decoded)
    .map(([key, value]) => `${key}=${value}`)
    .join('  ');
}

/** The page controller. */
class BusView {
  /** @type {HomeyBridge} */
  #homey;

  /** @type {Array<Record<string, any>>} */
  #packets = [];

  #paused = false;

  /** @type {number | null} */
  #refresh = null;

  /** @param {HomeyBridge} homey */
  constructor(homey) {
    this.#homey = homey;
  }

  async start() {
    this.#translate();
    this.#bindControls();

    this.#homey.on('ramses.packets', (views) => {
      this.#addPackets(views);
    });
    this.#homey.on('ramses.bus', () => {
      this.#scheduleRefresh();
    });

    this.#homey.ready();

    const [packets] = await Promise.all([
      this.#call('GET', '/packets'),
      this.#refreshBus(),
    ]);

    this.#addPackets(packets ?? []);
  }

  #translate() {
    for (const node of document.querySelectorAll('[data-i18n]')) {
      node.textContent = this.#homey.__(/** @type {HTMLElement} */ (node).dataset.i18n ?? '');
    }

    /** @type {HTMLInputElement} */ (document.getElementById('filter')).placeholder = this.#homey.__('settings.filter');
  }

  #bindControls() {
    const filter = /** @type {HTMLInputElement} */ (document.getElementById('filter'));
    const pause = /** @type {HTMLButtonElement} */ (document.getElementById('pause'));

    filter.addEventListener('input', () => {
      this.#renderPackets();
    });

    pause.addEventListener('click', () => {
      this.#paused = !this.#paused;
      pause.textContent = this.#homey.__(this.#paused ? 'settings.resume' : 'settings.pause');

      if (!this.#paused) {
        this.#renderPackets();
      }
    });

    document.getElementById('clear')?.addEventListener('click', () => {
      this.#packets = [];
      this.#renderPackets();
    });

    document.getElementById('send-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.#send();
    });
  }

  // --- Gateways and devices ----------------------------------------------------

  #scheduleRefresh() {
    if (this.#refresh !== null) {
      return;
    }

    this.#refresh = window.setTimeout(() => {
      this.#refresh = null;
      this.#refreshBus();
    }, 1000);
  }

  async #refreshBus() {
    const [gateways, devices] = await Promise.all([
      this.#call('GET', '/gateways'),
      this.#call('GET', '/devices'),
    ]);

    this.#renderGateways(gateways ?? []);
    this.#renderDevices(devices ?? []);
  }

  /** @param {Array<Record<string, any>>} gateways */
  #renderGateways(gateways) {
    const container = /** @type {HTMLElement} */ (document.getElementById('gateways'));

    if (gateways.length === 0) {
      container.replaceChildren(element('p', { class: 'muted' }, [this.#homey.__('settings.no_gateways')]));

      return;
    }

    container.replaceChildren(...gateways.map((gateway) => {
      let state = 'disconnected';
      let dot = '';

      if (gateway.connected && gateway.online === false) {
        state = 'offline';
        dot = 'warn';
      } else if (gateway.connected) {
        state = 'connected';
        dot = 'ok';
      }

      return element('div', { class: 'gateway' }, [
        element('span', { class: `dot ${dot}` }),
        element('strong', { class: 'mono' }, [gateway.id]),
        element('span', { class: 'muted' }, [
          [
            this.#homey.__(`settings.${state}`),
            gateway.broker,
            `${gateway.devices} ${this.#homey.__('settings.device_count')}`,
            `${gateway.packets} ${this.#homey.__('settings.packet_count')}`,
          ].join(' · '),
        ]),
      ]);
    }));
  }

  /** @param {Array<Record<string, any>>} devices */
  #renderDevices(devices) {
    const body = /** @type {HTMLElement} */ (document.getElementById('devices'));

    if (devices.length === 0) {
      body.replaceChildren(element('tr', {}, [
        element('td', { colspan: '4', class: 'muted' }, [this.#homey.__('settings.no_devices')]),
      ]));

      return;
    }

    body.replaceChildren(...devices.map((device) => {
      const address = element('td', { class: 'mono' }, [device.id]);

      if (device.paired) {
        address.append(element('div', { class: 'muted' }, [`✓ ${this.#homey.__('settings.in_homey')}`]));
      }

      const role = element('td', {}, [
        element('span', { class: `role ${device.role}` }, [this.#homey.__(`settings.roles.${device.role}`)]),
      ]);

      if (device.hint) {
        role.append(element('div', { class: 'muted homey-text-small' }, [device.hint]));
      }

      return element('tr', {}, [
        address,
        role,
        element('td', { class: 'mono' }, [Object.keys(device.codes).join(' ')]),
        element('td', { class: 'muted' }, [clock(device.lastSeen)]),
      ]);
    }));
  }

  // --- Live traffic -----------------------------------------------------------

  /** @param {Array<Record<string, any>>} views */
  #addPackets(views) {
    this.#packets.push(...views);

    if (this.#packets.length > MAX_PACKETS) {
      this.#packets.splice(0, this.#packets.length - MAX_PACKETS);
    }

    if (!this.#paused) {
      this.#renderPackets();
    }
  }

  #renderPackets() {
    const container = /** @type {HTMLElement} */ (document.getElementById('packets'));
    const needle = /** @type {HTMLInputElement} */ (document.getElementById('filter')).value.trim().toUpperCase();
    const matches = (/** @type {Record<string, any>} */ packet) => {
      return !needle || packet.frame.toUpperCase().includes(needle) || packet.name.toUpperCase().includes(needle);
    };

    const shown = this.#packets.filter(matches).reverse();

    if (shown.length === 0) {
      container.replaceChildren(element('div', { class: 'muted' }, [this.#homey.__('settings.no_packets')]));

      return;
    }

    container.replaceChildren(...shown.map((packet) => {
      const children = [
        element('span', { class: 'muted' }, [clock(packet.time)]),
        element('span', {}, [packet.frame]),
        element('span', { class: 'name muted' }, [`${packet.name}${packet.rssi === null ? '' : ` · RSSI ${packet.rssi}`}`]),
      ];
      const decoded = describe(packet.decoded);

      if (decoded) {
        children.push(element('span', { class: 'decoded' }, [decoded]));
      }

      return element('div', { class: `packet${packet.echo ? ' echo' : ''}` }, children);
    }));
  }

  // --- Sending ----------------------------------------------------------------

  async #send() {
    const input = /** @type {HTMLInputElement} */ (document.getElementById('frame'));
    const status = /** @type {HTMLElement} */ (document.getElementById('send-status'));

    status.classList.remove('error');
    status.textContent = '';

    try {
      const result = await this.#call('POST', '/send', { frame: input.value }, true);

      status.textContent = `${this.#homey.__('settings.sent')}: ${result.frame} (${result.gateway})`;
    } catch (error) {
      status.classList.add('error');
      status.textContent = /** @type {Error} */ (error)?.message ?? String(error);
    }
  }

  /**
   * @param {string} method
   * @param {string} path
   * @param {unknown} [body]
   * @param {boolean} [rethrow] reject on errors instead of resolving null
   * @returns {Promise<any>}
   */
  #call(method, path, body = undefined, rethrow = false) {
    return new Promise((resolve, reject) => {
      this.#homey.api(method, path, body, (error, result) => {
        if (!error) {
          resolve(result);
        } else if (rethrow) {
          reject(error);
        } else {
          resolve(null);
        }
      });
    });
  }
}

const homey = /** @type {HomeyBridge} */ (await /** @type {any} */ (window).homeyReady);

new BusView(homey).start();
