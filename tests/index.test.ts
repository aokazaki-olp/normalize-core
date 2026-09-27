import assert from 'node:assert/strict';
import { it } from 'node:test';

import * as NormalizeCore from '../src/index.ts';

it('公開面は guardedNfkc・applyCharStyle・mergeCharStyle', () => {
  assert.deepEqual(Object.keys(NormalizeCore).sort(), [
    'applyCharStyle',
    'guardedNfkc',
    'mergeCharStyle',
  ]);
  assert.equal(NormalizeCore.guardedNfkc('ﾋﾞﾙ①'), 'ビル①');
  assert.equal(NormalizeCore.applyCharStyle('1', { digit: 'full' }), '１');
});
