import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeProbe } from './summarize-native-motion-probe.mjs';

const order = ['native', 'web-waapi', 'web-raf', 'web-raf', 'web-waapi', 'native'];
const rows = () => Array.from({ length: 24 }, (_, trial) => ({ trial, mode: order[trial % 6],
  artwork: false, nativeCallbackGapsMs: [16, 17, 40], web: { trial, rafGapsMs: [16, 45] } }));
const log = data => '[JIMI_NATIVE_PROBE] COMPLETE ' + JSON.stringify(data);
test('same-domain native metrics and supplementary web metrics remain separate', () => {
  const result = summarizeProbe(log(rows()));
  assert.equal(result.modes[0].trials, 8);
  assert.equal(result.modes[0].sharedNativeCallback.worstMs, 40);
  assert.equal(result.modes[1].supplementaryWebRAF.worstMs, 45);
  assert.equal(result.modes[0].supplementaryWebRAF, undefined);
});
test('rejects missing, duplicate and aborted receipts', () => {
  assert.throws(() => summarizeProbe('READY'));
  assert.throws(() => summarizeProbe(log(rows()) + '\n' + log(rows())));
  assert.throws(() => summarizeProbe(log(rows()) + '\n[JIMI_NATIVE_PROBE] ABORT'));
});
test('rejects empty, mixed and reordered samples', () => {
  const empty = rows(); empty[0].nativeCallbackGapsMs = [];
  const mixed = rows(); mixed[3].artwork = true;
  const reordered = rows(); reordered[2].trial = 1;
  for (const data of [empty, mixed, reordered, rows().slice(1)]) assert.throws(() => summarizeProbe(log(data)));
});
