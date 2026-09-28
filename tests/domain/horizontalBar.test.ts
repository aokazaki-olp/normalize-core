import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HORIZONTAL_BAR_PATTERN } from '../../src/domain/horizontalBar.ts';

// NJA v3.1.3 の src/lib/normalizeHelpers.ts の文字クラス
const NJA_HORIZONTAL_BAR_CODE_POINTS = [
  0x002d, 0xff0d, 0xfe63, 0x2212, 0x2010, 0x2043, 0x2011, 0x2012, 0x2013,
  0x2014, 0xfe58, 0x2015, 0x23af, 0x23e4, 0x30fc, 0xff70, 0x2500, 0x2501,
];

const membersOf = (pattern: RegExp): number[] => {
  const members: number[] = [];
  for (let codePoint = 0; codePoint <= 0x10ffff; codePoint++) {
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
      continue;
    }
    if (pattern.test(String.fromCodePoint(codePoint))) {
      members.push(codePoint);
    }
  }
  return members;
};

describe('HORIZONTAL_BAR_PATTERN', () => {
  for (const flags of ['u', 'v', '']) {
    it(`フラグ '${flags}' で組み立てると NJA v3.1.3 の18文字と一致する`, () => {
      assert.deepEqual(
        membersOf(new RegExp(`^${HORIZONTAL_BAR_PATTERN}$`, flags)),
        NJA_HORIZONTAL_BAR_CODE_POINTS.toSorted((a, b) => a - b),
      );
    });
  }

  it('量指定子を付けて先頭の横棒の並びに当てられる', () => {
    const leading = new RegExp(`^(?:${HORIZONTAL_BAR_PATTERN})+`, 'u');
    assert.equal('-－ーA-1'.replace(leading, ''), 'A-1');
    assert.equal('A-1'.replace(leading, ''), 'A-1');
  });
});
