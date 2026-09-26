import assert from 'node:assert/strict';
import { it } from 'node:test';

import { HORIZONTAL_BAR } from '../../src/domain/horizontalBar.ts';

// NJA v3.1.3 の src/lib/normalizeHelpers.ts の文字クラス。NJA を上げたらここで差分を見る
const NJA_HORIZONTAL_BAR = [
  0x002d, 0xff0d, 0xfe63, 0x2212, 0x2010, 0x2043, 0x2011, 0x2012, 0x2013,
  0x2014, 0xfe58, 0x2015, 0x23af, 0x23e4, 0x30fc, 0xff70, 0x2500, 0x2501,
];

it('横棒の集合は NJA v3.1.3 の18文字と一致する', () => {
  const members: number[] = [];
  for (let codePoint = 0; codePoint <= 0x10ffff; codePoint++) {
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
      continue;
    }
    if (HORIZONTAL_BAR.test(String.fromCodePoint(codePoint))) {
      members.push(codePoint);
    }
  }
  assert.deepEqual(
    members,
    NJA_HORIZONTAL_BAR.toSorted((a, b) => a - b),
  );
});
