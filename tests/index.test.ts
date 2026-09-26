import assert from 'node:assert/strict';
import { it } from 'node:test';

import * as NormalizeCore from '../src/index.ts';

it('公開面は guardedNfkc だけ', () => {
  assert.deepEqual(Object.keys(NormalizeCore), ['guardedNfkc']);
  assert.equal(NormalizeCore.guardedNfkc('ﾋﾞﾙ①'), 'ビル①');
});
