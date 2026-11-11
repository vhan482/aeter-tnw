import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDamageDisplay, estimateAverageDps } from './damage.js';

test('Mirror World damage display parsing preserves approximate screenshot totals', () => {
  assert.deepEqual(parseDamageDisplay('18.8B'), {normalized:'18800000000',approximate:true});
  assert.deepEqual(parseDamageDisplay('1.25M'), {normalized:'1250000',approximate:true});
  assert.deepEqual(parseDamageDisplay('18,800,000'), {normalized:'18800000',approximate:false});
  assert.deepEqual(parseDamageDisplay('0'), {normalized:'0',approximate:false});
  assert.deepEqual(parseDamageDisplay('2.345K'), {normalized:'2345',approximate:true});
  assert.equal(parseDamageDisplay('18.8'), null);
  assert.equal(parseDamageDisplay('18,80'), null);
  assert.equal(parseDamageDisplay('1.2345B'), null);
  assert.equal(parseDamageDisplay('-1B'), null);
  assert.equal(parseDamageDisplay('999999999999999T'), null);
});

test('Mirror World full-duration average DPS is an estimate, not screenshot DPS', () => {
  assert.equal(estimateAverageDps('18800000000',900),'20888888.89');
  assert.equal(estimateAverageDps('0',900),'0.00');
  assert.throws(()=>estimateAverageDps('5',0));
});
