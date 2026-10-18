import assert from 'node:assert/strict';
import { it } from 'node:test';

import * as NormalizeCore from '../src/index.ts';

it('公開面は guardedNfkc・HORIZONTAL_BAR_PATTERN・CharStyle', () => {
  assert.deepEqual(Object.keys(NormalizeCore).toSorted(), [
    'CharStyle',
    'HORIZONTAL_BAR_PATTERN',
    'guardedNfkc',
  ]);
  assert.equal(NormalizeCore.guardedNfkc('ﾋﾞﾙ①'), 'ビル①');
  assert.equal(NormalizeCore.CharStyle.apply('1', { digit: 'full' }), '１');
  assert.deepEqual(
    NormalizeCore.CharStyle.merge({ digit: 'full' }, { alpha: 'full' }),
    { digit: 'full', alpha: 'full' },
  );
  const styleOf = NormalizeCore.CharStyle.prepareFields(['code'], {
    default: { digit: 'full' },
  });
  assert.deepEqual(styleOf('code'), { digit: 'full' });
  assert.equal(typeof NormalizeCore.HORIZONTAL_BAR_PATTERN, 'string');
});

it('型 CharStyle と値 CharStyle を同じ名前で使える', () => {
  const style: NormalizeCore.CharStyle = { symbol: 'full' };
  const fieldStyle: NormalizeCore.FieldStyle<'code'> = {
    fields: { code: style },
  };
  assert.equal(NormalizeCore.CharStyle.apply('a-b', style), 'a－b');
  assert.deepEqual(
    NormalizeCore.CharStyle.prepareFields(['code'], fieldStyle)('code'),
    style,
  );
});
