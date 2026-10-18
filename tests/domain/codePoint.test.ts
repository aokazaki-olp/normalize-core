import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SINGLE_CODE_POINT } from '../../src/domain/codePoint.ts';

describe('SINGLE_CODE_POINT', () => {
  const cases: [string, string, boolean][] = [
    ['ASCII の1字', 'a', true],
    ['サロゲートペアの1字', '𠮷', true],
    ['改行の1字', '\n', true],
    ['空文字', '', false],
    ['2字', 'ab', false],
    ['結合文字を伴う字（2コードポイント）', 'が', false],
  ];
  for (const [name, input, expected] of cases) {
    it(name, () => {
      assert.equal(SINGLE_CODE_POINT.test(input), expected);
    });
  }
});
