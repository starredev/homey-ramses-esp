import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AuthError, NotConnectedError, NotReachableError, ValidationError,
} from '../lib/errors.js';
import { BrokerConfig, DEFAULT_PORT } from '../lib/mqtt/BrokerConfig.js';
import { BrokerProbe, gatewayIdOf } from '../lib/mqtt/BrokerProbe.js';
import { clientOptions, isAuthFailure, toBrokerError } from '../lib/mqtt/client.js';
import { GatewayConnection, topicsOf } from '../lib/mqtt/GatewayConnection.js';
import { Packet } from '../lib/ramses/Packet.js';
import {
  broker, fakeMqtt, FakeTimers, flush, recordingLogger,
} from './fakes.js';

describe('BrokerConfig', () => {
  it('validates and normalises form input', () => {
    const config = BrokerConfig.from({
      host: ' 192.168.1.10 ', port: '1884', username: ' user ', password: 'p w',
    });

    assert.equal(config.url, 'mqtt://192.168.1.10:1884');
    assert.equal(config.username, 'user');
    assert.equal(config.password, 'p w');
    assert.equal(String(config), '192.168.1.10:1884');
  });

  it('uses the default port and mqtts for TLS', () => {
    const config = BrokerConfig.from({ host: 'homey.local', port: '', tls: true });

    assert.equal(config.port, DEFAULT_PORT);
    assert.equal(config.url, `mqtts://homey.local:${DEFAULT_PORT}`);
  });

  it('rejects bad hosts and ports', () => {
    assert.throws(() => BrokerConfig.from({ host: '' }), ValidationError);
    assert.throws(() => BrokerConfig.from({ host: 'http://x' }), ValidationError);
    assert.throws(() => BrokerConfig.from({ host: 'x', port: 70000 }), ValidationError);
    assert.throws(() => BrokerConfig.from(/** @type {any} */ (null)), ValidationError);
  });

  it('compares by value and serialises', () => {
    const a = BrokerConfig.from({ host: 'x', username: 'u', password: 'p' });

    assert.equal(a.equals(BrokerConfig.from({ host: 'x', username: 'u', password: 'p' })), true);
    assert.equal(a.equals(BrokerConfig.from({ host: 'x', username: 'u', password: 'q' })), false);
    assert.equal(a.equals(null), false);
    assert.deepEqual(a.toJSON(), {
      host: 'x', port: 1883, username: 'u', password: 'p', tls: false,
    });
  });
});

describe('client helpers', () => {
  it('recognises refused credentials by code and by message', () => {
    assert.equal(isAuthFailure(Object.assign(new Error('x'), { code: 5 })), true);
    assert.equal(isAuthFailure(new Error('Connection refused: Not authorized')), true);
    assert.equal(isAuthFailure(new Error('Connection refused: Bad username or password')), true);
    assert.equal(isAuthFailure(new Error('ECONNREFUSED')), false);
    assert.equal(isAuthFailure(null), false);
  });

  it('maps connection errors onto domain errors', () => {
    assert.ok(toBrokerError(Object.assign(new Error('x'), { code: 134 }), 'h:1') instanceof AuthError);
    assert.ok(toBrokerError(new Error('ECONNREFUSED'), 'h:1') instanceof NotReachableError);
  });

  it('builds client options without empty credentials', () => {
    const options = clientOptions(BrokerConfig.from({ host: 'x' }), 'test');

    assert.match(String(options.clientId), /^homey-ramses-test-/);
    assert.equal(options.username, undefined);
    assert.equal(options.password, undefined);
  });
});

describe('GatewayConnection', () => {
  /**
   * @param {ReturnType<typeof fakeMqtt>} mqtt
   * @param {ReturnType<typeof recordingLogger>} [logger]
   */
  function connection(mqtt, logger = recordingLogger()) {
    return new GatewayConnection({
      broker: broker(), gatewayId: '18:203612', connect: mqtt.connect, logger,
    });
  }

  it('subscribes to the status and rx topics once connected', () => {
    const mqtt = fakeMqtt();
    const gateway = connection(mqtt);
    const events = [];

    gateway.on('connected', () => events.push('connected'));
    gateway.start();
    gateway.start();
    mqtt.last().connectNow();

    assert.equal(mqtt.clients.length, 1);
    assert.equal(mqtt.last().url, 'mqtt://192.168.1.10:1883');
    assert.equal(mqtt.last().options.username, 'mqtt-user');
    assert.deepEqual(mqtt.last().subscriptions, ['RAMSES/GATEWAY/18:203612', 'RAMSES/GATEWAY/18:203612/rx']);
    assert.deepEqual(events, ['connected']);
    assert.equal(gateway.connected, true);
    assert.equal(gateway.gatewayId, '18:203612');
  });

  it('logs a failed subscription', () => {
    const mqtt = fakeMqtt();
    const logger = recordingLogger();
    const gateway = connection(mqtt, logger);

    gateway.start();
    mqtt.last().subscribeError = new Error('denied');
    mqtt.last().connectNow();

    assert.equal(logger.errors.length, 1);
  });

  it('emits parsed packets, unparsed lines and the online status', () => {
    const mqtt = fakeMqtt();
    const gateway = connection(mqtt);
    /** @type {unknown[]} */
    const events = [];

    gateway.on('packet', (packet) => events.push(packet.code));
    gateway.on('unparsed', (line) => events.push(`unparsed:${line}`));
    gateway.on('online', (online) => events.push(online));
    gateway.start();
    mqtt.last().connectNow();

    const { rx, status } = topicsOf('18:203612');

    mqtt.last().receive(rx, '{"msg":"045  I --- 29:173894 29:233244 --:------ 22F1 003 000304"}');
    mqtt.last().receive(rx, '{"msg":"# evofw3 0.7.1"}');
    mqtt.last().receive(status, 'online');
    mqtt.last().receive(status, 'offline');
    mqtt.last().receive('RAMSES/GATEWAY/18:203612/info/version', '0.4.0');

    assert.deepEqual(events, ['22F1', 'unparsed:# evofw3 0.7.1', true, false]);
  });

  it('publishes frames to tx as JSON', async () => {
    const mqtt = fakeMqtt();
    const gateway = connection(mqtt);
    const packet = Packet.create({
      verb: 'I', src: '29:173894', dst: '29:233244', code: '22F1', payload: '000304',
    });

    gateway.start();
    mqtt.last().connectNow();
    await gateway.send(packet);

    assert.deepEqual(mqtt.last().published, [{
      topic: 'RAMSES/GATEWAY/18:203612/tx',
      message: '{"msg":" I --- 29:173894 29:233244 --:------ 22F1 003 000304"}',
    }]);
  });

  it('rejects sending while offline and passes publish errors on', async () => {
    const mqtt = fakeMqtt();
    const gateway = connection(mqtt);
    const packet = Packet.create({
      verb: 'I', src: '29:173894', dst: '29:233244', code: '22F1', payload: '000304',
    });

    await assert.rejects(gateway.send(packet), NotConnectedError);

    gateway.start();
    mqtt.last().connectNow();
    mqtt.last().publishError = new Error('queue full');
    await assert.rejects(gateway.send(packet), /queue full/);
  });

  it('reports refused credentials, logs other errors and tracks closing', () => {
    const mqtt = fakeMqtt();
    const logger = recordingLogger();
    const gateway = connection(mqtt, logger);
    const events = [];

    gateway.on('authFailed', () => events.push('auth'));
    gateway.on('disconnected', () => events.push('disconnected'));
    gateway.start();
    mqtt.last().connectNow();
    mqtt.last().fail(Object.assign(new Error('Not authorized'), { code: 5 }));
    mqtt.last().fail(new Error('ECONNRESET'));
    mqtt.last().close();
    mqtt.last().close();

    assert.deepEqual(events, ['auth', 'disconnected']);
    assert.equal(logger.errors.length, 1);
  });

  it('reconnects to a new broker, and ignores an unchanged one', () => {
    const mqtt = fakeMqtt();
    const gateway = connection(mqtt);

    gateway.reconfigure(broker());
    gateway.reconfigure(BrokerConfig.from({ host: '10.0.0.2' }));
    assert.equal(mqtt.clients.length, 0, 'not started yet');

    gateway.start();
    gateway.reconfigure(BrokerConfig.from({ host: '10.0.0.3' }));

    assert.equal(mqtt.clients.length, 2);
    assert.equal(mqtt.clients[0].ended, true);
    assert.equal(mqtt.last().url, 'mqtt://10.0.0.3:1883');
    assert.equal(gateway.broker.host, '10.0.0.3');
  });

  it('stops cleanly', () => {
    const mqtt = fakeMqtt();
    const gateway = connection(mqtt);

    gateway.stop();
    gateway.start();
    mqtt.last().connectNow();
    gateway.stop();

    assert.equal(mqtt.last().ended, true);
    assert.equal(gateway.connected, false);
  });
});

describe('BrokerProbe', () => {
  it('reads gateway ids from topics', () => {
    assert.equal(gatewayIdOf('RAMSES/GATEWAY/18:203612/rx'), '18:203612');
    assert.equal(gatewayIdOf('RAMSES/GATEWAY/18:203612'), '18:203612');
    assert.equal(gatewayIdOf('RAMSES/GATEWAY/abc/rx'), null);
    assert.equal(gatewayIdOf('homey/foo'), null);
  });

  it('lists the gateways that publish on the broker', async () => {
    const mqtt = fakeMqtt();
    const timers = new FakeTimers();
    const probe = new BrokerProbe({ connect: mqtt.connect, timers });
    const result = probe.probe(broker());

    mqtt.last().connectNow();
    await flush();
    assert.deepEqual(mqtt.last().subscriptions, ['RAMSES/GATEWAY/#']);
    assert.equal(mqtt.last().options.reconnectPeriod, 0);

    mqtt.last().receive('RAMSES/GATEWAY/18:203612', 'online');
    mqtt.last().receive('RAMSES/GATEWAY/18:203612/rx', '{}');
    mqtt.last().receive('RAMSES/GATEWAY/18:000730/rx', '{}');
    timers.tick(BrokerProbe.LISTEN_MS);

    assert.deepEqual(await result, { gateways: ['18:000730', '18:203612'] });
    assert.equal(mqtt.last().ended, true);
  });

  it('fails with an auth error when credentials are refused', async () => {
    const mqtt = fakeMqtt();
    const probe = new BrokerProbe({ connect: mqtt.connect, timers: new FakeTimers() });
    const result = probe.probe(broker());

    mqtt.last().fail(Object.assign(new Error('Bad username or password'), { code: 4 }));

    await assert.rejects(result, AuthError);
    assert.equal(mqtt.last().ended, true);
  });

  it('fails as not reachable when the connection closes', async () => {
    const mqtt = fakeMqtt();
    const probe = new BrokerProbe({ connect: mqtt.connect, timers: new FakeTimers() });
    const result = probe.probe(broker());

    mqtt.last().close();

    await assert.rejects(result, NotReachableError);
  });
});
