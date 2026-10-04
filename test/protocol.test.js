import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ValidationError } from '../lib/errors.js';
import { codeName, CODE_NAMES } from '../lib/ramses/codes.js';
import { FanCommands, MAX_BOOST_MINUTES, StatusCode } from '../lib/ramses/commands.js';
import { decode, decodedCodes, Reading } from '../lib/ramses/decoders.js';
import { FanMode, fanModes } from '../lib/ramses/FanMode.js';
import {
  DEFAULT_SCHEME, SCHEMES, schemeById, schemeBySuffix,
} from '../lib/ramses/FanScheme.js';
import {
  BROADCAST, isAddress, isDeviceAddress, NO_ADDRESS, Packet, unwrap,
} from '../lib/ramses/Packet.js';
import { STATUS_31DA } from './fixtures.js';

/**
 * @param {string} line
 * @returns {Packet}
 */
function parsed(line) {
  const packet = Packet.parse(line);

  assert.ok(packet, `expected "${line}" to parse`);

  return packet;
}

describe('Packet.parse', () => {
  it('parses a frame with RSSI as ramses_esp publishes it', () => {
    const packet = parsed('045  I --- 29:173894 29:233244 --:------ 22F1 003 000304');

    assert.equal(packet.rssi, 45);
    assert.equal(packet.verb, 'I');
    assert.equal(packet.src, '29:173894');
    assert.equal(packet.dst, '29:233244');
    assert.equal(packet.code, '22F1');
    assert.equal(packet.payload, '000304');
    assert.equal(packet.length, 3);
  });

  it('unwraps the JSON envelope of the rx topic', () => {
    const packet = parsed('{"msg":"052 RP --- 29:233244 18:203612 --:------ 31DA 001 00","ts":"2026-10-04T10:00:00"}');

    assert.equal(packet.verb, 'RP');
    assert.equal(packet.src, '29:233244');
    assert.equal(packet.dst, '18:203612');
  });

  it('accepts lower case and frames without RSSI', () => {
    const packet = parsed('rq --- 18:203612 29:233244 --:------ 31da 001 00');

    assert.equal(packet.verb, 'RQ');
    assert.equal(packet.code, '31DA');
    assert.equal(packet.rssi, null);
  });

  it('treats an announcement (same address twice) as having no destination', () => {
    const packet = parsed(' I --- 29:233244 --:------ 29:233244 31D9 003 00FF64');

    assert.equal(packet.src, '29:233244');
    assert.equal(packet.dst, null);
  });

  it('takes the third slot as source when the first is empty', () => {
    const packet = parsed(' I --- --:------ --:------ 29:233244 1298 003 00028A');

    assert.equal(packet.src, '29:233244');
  });

  it('does not see a broadcast address as destination', () => {
    const packet = parsed(' I --- 29:173894 63:262142 --:------ 22F1 003 000304');

    assert.equal(packet.dst, null);
  });

  it('rejects text that is no frame', () => {
    assert.equal(Packet.parse(''), null);
    assert.equal(Packet.parse('hello'), null);
    assert.equal(Packet.parse('{"msg": 3}'), null);
    assert.equal(Packet.parse('{broken json'), null);
    assert.equal(Packet.parse(' I --- 29:173894 nonsense --:------ 22F1 003 000304'), null);
  });

  it('rejects a frame whose length does not match its payload', () => {
    assert.equal(Packet.parse(' I --- 29:173894 29:233244 --:------ 22F1 004 000304'), null);
  });

  it('is immutable', () => {
    const packet = parsed(' I --- 29:173894 29:233244 --:------ 22F1 003 000304');

    assert.throws(() => {
      /** @type {any} */ (packet).code = '1234';
    });
  });
});

describe('Packet.create and toFrame', () => {
  it('builds the frame ramses_esp expects on tx', () => {
    const packet = Packet.create({
      verb: 'I', src: '29:173894', dst: '29:233244', code: '22f1', payload: '00 03 04',
    });

    assert.equal(packet.toFrame(), ' I --- 29:173894 29:233244 --:------ 22F1 003 000304');
    assert.equal(String(packet), packet.toFrame());
  });

  it('round-trips through parse', () => {
    const frame = 'RQ --- 18:203612 29:233244 --:------ 31DA 001 00';

    assert.equal(parsed(frame).toFrame(), frame);
  });

  it('builds an announcement without destination', () => {
    const packet = Packet.create({
      verb: 'I', src: '18:203612', code: '1F09', payload: 'FF',
    });

    assert.deepEqual(packet.addresses, ['18:203612', NO_ADDRESS, NO_ADDRESS]);
  });

  it('validates every field', () => {
    const valid = {
      verb: 'I', src: '18:203612', dst: '29:233244', code: '22F1', payload: '000304',
    };

    assert.throws(() => Packet.create({ ...valid, verb: 'X' }), ValidationError);
    assert.throws(() => Packet.create({ ...valid, src: '18-203612' }), ValidationError);
    assert.throws(() => Packet.create({ ...valid, dst: 'fan' }), ValidationError);
    assert.throws(() => Packet.create({ ...valid, code: '22F' }), ValidationError);
    assert.throws(() => Packet.create({ ...valid, payload: '0003' + '0' }), ValidationError);
    assert.throws(() => Packet.create({ ...valid, payload: '' }), ValidationError);
    assert.throws(() => Packet.create({ ...valid, payload: '00'.repeat(49) }), ValidationError);
  });

  it('parses user input strictly', () => {
    assert.equal(Packet.fromUserInput(' I --- 29:173894 29:233244 --:------ 22F1 003 000304').code, '22F1');
    assert.throws(() => Packet.fromUserInput('22F1 000304'), ValidationError);
  });
});

describe('addresses', () => {
  it('recognises device addresses', () => {
    assert.equal(isAddress('29:173894'), true);
    assert.equal(isAddress(NO_ADDRESS), false);
    assert.equal(isAddress(/** @type {any} */ (undefined)), false);
    assert.equal(isDeviceAddress(BROADCAST), false);
    assert.equal(isDeviceAddress('18:203612'), true);
  });

  it('unwraps bare lines and envelopes', () => {
    assert.equal(unwrap('  I --- x '), 'I --- x');
    assert.equal(unwrap('{"msg":"  I --- x "}'), 'I --- x');
    assert.equal(unwrap(/** @type {any} */ (null)), '');
  });
});

describe('FanScheme', () => {
  it('numbers Orcon modes as confirmed on a live unit', () => {
    const orcon = SCHEMES.orcon;

    assert.equal(orcon.modeOf('03'), FanMode.HIGH);
    assert.equal(orcon.modeOf('00'), FanMode.AWAY);
    assert.equal(orcon.modeOf('05'), FanMode.AUTO);
    assert.equal(orcon.modeOf('07'), FanMode.OFF);
    assert.equal(orcon.modeOf('99'), null);
    assert.equal(orcon.rateOf(FanMode.LOW), '01');
    assert.equal(orcon.suffix, '04');
    assert.equal(DEFAULT_SCHEME, orcon);
  });

  it('numbers the same byte differently per brand', () => {
    assert.equal(SCHEMES.orcon.modeOf('04'), FanMode.AUTO);
    assert.equal(SCHEMES.itho.modeOf('04'), FanMode.HIGH);
    assert.equal(SCHEMES.vasco.modeOf('04'), FanMode.HIGH);
    assert.equal(SCHEMES.vasco.rateOf(FanMode.AUTO), '05');
    assert.equal(SCHEMES.nuaire.modeOf('03'), FanMode.HIGH);
  });

  it('rejects modes a brand does not have', () => {
    assert.throws(() => SCHEMES.itho.rateOf(FanMode.AUTO), ValidationError);
    assert.throws(() => SCHEMES.nuaire.rateOf('turbo'), ValidationError);
    assert.equal(SCHEMES.nuaire.supports(FanMode.LOW), false);
    assert.deepEqual(SCHEMES.nuaire.modes(), ['medium', 'high']);
  });

  it('finds schemes by id and by the last byte of a command', () => {
    assert.equal(schemeById('vasco'), SCHEMES.vasco);
    assert.equal(schemeById('nonsense'), DEFAULT_SCHEME);
    assert.equal(schemeById(undefined), DEFAULT_SCHEME);
    assert.equal(schemeBySuffix('06'), SCHEMES.vasco);
    assert.equal(schemeBySuffix('0a'), SCHEMES.nuaire);
    assert.equal(schemeBySuffix('04'), null);
  });

  it('lists the modes a user can choose', () => {
    assert.deepEqual(fanModes(), ['low', 'medium', 'high', 'auto', 'away', 'off']);
  });
});

describe('codes', () => {
  it('names known codes and falls back to the code', () => {
    assert.equal(codeName('31DA'), CODE_NAMES['31DA']);
    assert.equal(codeName('ABCD'), 'ABCD');
  });
});

describe('decode', () => {
  it('reads the mode of a 22F1 command', () => {
    assert.deepEqual(decode(parsed(' I --- 29:173894 29:233244 --:------ 22F1 003 000204')), { mode: 'medium' });
    assert.deepEqual(decode(parsed(' I --- 29:173894 29:233244 --:------ 22F1 003 000904')), {});
  });

  it('reads a boost in minutes and in hours, with the rate of the long form', () => {
    assert.deepEqual(decode(parsed(' I --- 29:173894 29:233244 --:------ 22F3 003 00001E')), { boostMinutes: 30 });
    assert.deepEqual(decode(parsed(' I --- 29:173894 29:233244 --:------ 22F3 003 000102')), { boostMinutes: 120 });
    assert.deepEqual(decode(parsed(' I --- 29:173894 29:233244 --:------ 22F3 001 00')), {});
    assert.deepEqual(decode(parsed(' I --- 37:044778 29:233244 --:------ 22F3 007 00420203040404')).boostMinutes, 120);
    assert.deepEqual(decode(parsed(' I --- 37:044778 29:233244 --:------ 22F3 007 00123C03040404')), {
      boostMinutes: 60,
      mode: 'high',
    });
  });

  it('reads the full status of a heat recovery unit (31DA)', () => {
    const decoded = decode(parsed(`RP --- 29:233244 18:203612 --:------ 31DA 029 ${STATUS_31DA}`));

    assert.deepEqual(decoded, {
      mode: 'medium',
      readings: {
        [Reading.AIR_QUALITY]: 50,
        [Reading.CO2]: 650,
        [Reading.HUMIDITY]: 55,
        [Reading.EXHAUST_TEMPERATURE]: 21,
        [Reading.SUPPLY_TEMPERATURE]: 20,
        [Reading.TEMPERATURE]: 22,
        [Reading.OUTDOOR_TEMPERATURE]: -2,
        [Reading.BYPASS]: 0,
        [Reading.FAN_SPEED]: 50,
        [Reading.SUPPLY_FAN_SPEED]: 50,
        [Reading.BOOST_REMAINING]: 0,
      },
    });
  });

  it('ignores a short 31DA and requests', () => {
    assert.deepEqual(decode(parsed('RP --- 29:233244 18:203612 --:------ 31DA 002 0064')), {});
    assert.deepEqual(decode(parsed('RQ --- 18:203612 29:233244 --:------ 31DA 001 00')), {});
  });

  it('leaves out the mode for fan info values without a remote mode', () => {
    const payload = `${STATUS_31DA.slice(0, 36)}1A${STATUS_31DA.slice(38)}`;
    const decoded = decode(parsed(`RP --- 29:233244 18:203612 --:------ 31DA 029 ${payload}`));

    assert.equal(decoded.mode, undefined);
  });

  it('reads the fan speed of 31D9, or the mode an Orcon unit reports', () => {
    assert.deepEqual(decode(parsed(' I --- 29:233244 --:------ 29:233244 31D9 003 00FFC8')).readings, { fanSpeed: 100 });
    assert.deepEqual(decode(parsed(' I --- 29:230662 --:------ 29:230662 31D9 003 000003')), {
      readings: { fault: false, filterDirty: false, frostProtection: false },
      mode: 'high',
    });
    assert.equal(decode(parsed(' I --- 29:230662 --:------ 29:230662 31D9 003 000006')).mode, 'high');
    assert.equal(decode(parsed(' I --- 29:230662 --:------ 29:230662 31D9 003 00A004')).readings?.fault, true);
    assert.equal(decode(parsed(' I --- 32:155617 --:------ 32:155617 31D9 003 000003'), { scheme: SCHEMES.itho }).readings?.fanSpeed, 1.5);
    assert.equal(decode(parsed(' I --- 29:230662 --:------ 29:230662 31D9 003 000007')).mode, 'off');
    assert.equal(decode(parsed(' I --- 29:230662 --:------ 29:230662 31D9 003 000080')).readings?.fanSpeed, 64);
    assert.deepEqual(decode(parsed(' I --- 29:233244 --:------ 29:233244 31D9 003 00FFFF')), {});
  });

  it('reads filter days and percentage, and ignores unknown days', () => {
    assert.deepEqual(decode(parsed('RP --- 29:233244 18:203612 --:------ 10D0 004 00146E80')).readings, {
      filterDays: 20,
      filterRemaining: 64,
    });
    assert.deepEqual(decode(parsed('RP --- 29:233244 18:203612 --:------ 10D0 004 00FF6E80')).readings, { filterRemaining: 64 });
    assert.deepEqual(decode(parsed('RP --- 29:233244 18:203612 --:------ 10D0 001 00')), {});
  });

  it('reads the battery and its low flag', () => {
    assert.deepEqual(decode(parsed(' I --- 29:173894 --:------ 29:173894 1060 003 00C801')).readings, {
      battery: 100,
      batteryLow: false,
    });
    assert.deepEqual(decode(parsed(' I --- 29:173894 --:------ 29:173894 1060 003 00FF00')).readings, { batteryLow: true });
  });

  it('reads CO₂, humidity and temperature sensors', () => {
    assert.deepEqual(decode(parsed(' I --- 29:111111 --:------ 29:111111 1298 003 00028A')).readings, { co2: 650 });
    assert.deepEqual(decode(parsed(' I --- 29:111111 --:------ 29:111111 1298 003 007FFF')), {});
    assert.deepEqual(decode(parsed(' I --- 29:111111 --:------ 29:111111 12A0 002 0037')).readings, { humidity: 55 });
    assert.deepEqual(decode(parsed(' I --- 29:111111 --:------ 29:111111 12A0 004 00370898')).readings, {
      humidity: 55,
      temperature: 22,
    });
    assert.deepEqual(decode(parsed(' I --- 29:111111 --:------ 29:111111 1280 002 0050')).readings, { outdoorHumidity: 80 });
    assert.deepEqual(decode(parsed(' I --- 29:111111 --:------ 29:111111 1260 003 0007D0')).readings, { temperature: 20 });
    assert.deepEqual(decode(parsed(' I --- 29:111111 --:------ 29:111111 1260 003 007EFF')), {});
  });

  it('reads the ventilation demand of a sensor (31E0)', () => {
    assert.deepEqual(decode(parsed(' I --- 37:044778 29:233244 --:------ 31E0 008 0000000001001E00')).readings, {
      demand: 15,
    });
    assert.deepEqual(decode(parsed(' I --- 29:146052 32:023459 --:------ 31E0 003 0000C8')).readings, { demand: 100 });
    assert.deepEqual(decode(parsed(' I --- 37:044778 29:233244 --:------ 31E0 008 0000FF000100FF00')), {});
  });

  it('reads the model from device info (10E0)', () => {
    const unit = '000001C8260E0467FFFFFFFFFFFFFFFFFFFF564D432D31355250303100';
    const sensor = '000001C8510E0167FEFFFFFFFFFF040B07E6564D532D3135434D313700000000000000000000';

    assert.deepEqual(decode(parsed(`RP --- 29:233244 18:203612 --:------ 10E0 029 ${unit}`)), { model: 'VMC-15RP01' });
    assert.deepEqual(decode(parsed(`RP --- 37:044778 18:203612 --:------ 10E0 038 ${sensor}`)), { model: 'VMS-15CM17' });
    assert.deepEqual(decode(parsed('RP --- 37:044778 18:203612 --:------ 10E0 003 000001')), {});
  });

  it('returns nothing for codes without a decoder', () => {
    assert.deepEqual(decode(parsed(' I --- 29:111111 --:------ 29:111111 1FC9 001 00')), {});
    assert.ok(decodedCodes().includes('31DA'));
  });
});

describe('FanCommands', () => {
  const commands = new FanCommands({ remote: '29:173894', unit: '29:233244' });

  it('sets the mode with 22F1', () => {
    assert.equal(commands.setMode('high').toFrame(), ' I --- 29:173894 29:233244 --:------ 22F1 003 000304');
    assert.equal(commands.setMode('auto').payload, '000404');
  });

  it('boosts in the long Orcon form: high for N minutes, then auto', () => {
    assert.equal(commands.boost(60).payload, '00123C03040404');
    assert.equal(commands.boost(255).payload, '0012FF03040404');
    assert.throws(() => commands.boost(0), ValidationError);
    assert.throws(() => commands.boost(MAX_BOOST_MINUTES + 1), ValidationError);
    assert.throws(() => commands.boost(Number.NaN), ValidationError);
  });

  it('sets the bypass, and uses the numbering of other brands', () => {
    assert.equal(commands.setBypass('auto').payload, '00FFEF');
    assert.equal(commands.setBypass('off').payload, '0000EF');
    assert.throws(() => commands.setBypass('half'), ValidationError);

    const vasco = new FanCommands({ remote: '29:173894', unit: '32:123456', scheme: SCHEMES.vasco });

    assert.equal(vasco.setMode('auto').payload, '000506');
    assert.equal(vasco.boost(30).payload, '00001E');
  });

  it('resets the filter and requests the status', () => {
    assert.equal(commands.resetFilter().toFrame(), ' W --- 29:173894 29:233244 --:------ 10D0 002 00FF');
    assert.equal(commands.requestStatus('18:203612').toFrame(), 'RQ --- 18:203612 29:233244 --:------ 31DA 001 00');
    assert.equal(commands.requestStatus('18:203612', StatusCode.FAN).code, '31D9');
  });

  it('round-trips its own commands through the decoder', () => {
    assert.equal(decode(commands.setMode('low')).mode, 'low');
    assert.equal(decode(commands.boost(45)).boostMinutes, 45);
  });
});
