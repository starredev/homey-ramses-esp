/**
 * Web API of the app (see `api` in `.homeycompose/app.json`).
 * Each handler is a thin adapter onto {@link import('./lib/homey/RamsesApi.js').RamsesApi}.
 */

/** @typedef {import('./app.js').default} RamsesApp */

/**
 * @typedef {object} ApiRequest
 * @property {{ app: unknown }} homey
 * @property {Record<string, string>} [params]
 * @property {Record<string, string>} [query]
 * @property {unknown} [body]
 */

/**
 * @param {ApiRequest} request
 */
const ramsesApi = ({ homey }) => /** @type {RamsesApp} */ (homey.app).api;

export default {
  /** @param {ApiRequest} request */
  async getGateways(request) {
    return ramsesApi(request).gateways();
  },

  /** @param {ApiRequest} request */
  async getDevices(request) {
    return ramsesApi(request).devices();
  },

  /** @param {ApiRequest} request */
  async getPackets(request) {
    return ramsesApi(request).packets();
  },

  /** @param {ApiRequest} request */
  async sendFrame(request) {
    return ramsesApi(request).send(request.body);
  },
};
