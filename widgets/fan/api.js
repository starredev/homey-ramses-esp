/**
 * Web API of the ventilation widget (see `api` in `widget.compose.json`).
 * Each handler is a thin adapter onto {@link import('../../lib/homey/RamsesApi.js').RamsesApi}.
 */

/** @typedef {import('../../app.js').default} RamsesApp */

/**
 * @typedef {object} WidgetRequest
 * @property {{ app: unknown }} homey
 * @property {Record<string, string>} [query]
 * @property {unknown} [body]
 */

/**
 * @param {WidgetRequest} request
 */
const ramsesApi = ({ homey }) => /** @type {RamsesApp} */ (homey.app).api;

export default {
  /**
   * The unit selected in the widget settings, or the first one.
   * @param {WidgetRequest} request
   */
  async getState(request) {
    return ramsesApi(request).fan(request.query?.id);
  },

  /** @param {WidgetRequest} request */
  async setMode(request) {
    return ramsesApi(request).setFanMode(request.body);
  },
};
