import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyCharStyle,
  type CharStyle,
  mergeCharStyle,
} from '../../src/domain/charStyle.ts';

const ASCII_SAMPLE = '09AZaz!/:@[`{~ ';

describe('applyCharStyle', () => {
  describe('クラスの指定', () => {
    const cases: [string, CharStyle, string, string][] = [
      ['digit: full', { digit: 'full' }, '0-9', '０-９'],
      ['alpha: full', { alpha: 'full' }, 'Az1', 'Ａｚ1'],
      ['symbol: full', { symbol: 'full' }, '!-~a', '！－～a'],
      ['symbol は記号32字', { symbol: 'full' }, '[`{', '［｀｛'],
      ['space: full は U+3000', { space: 'full' }, 'a b', 'a\u3000b'],
      [
        'すべて half',
        { digit: 'half', alpha: 'half' },
        ASCII_SAMPLE,
        ASCII_SAMPLE,
      ],
      ['省略したクラスは half', {}, ASCII_SAMPLE, ASCII_SAMPLE],
      [
        'すべて full',
        { digit: 'full', alpha: 'full', symbol: 'full', space: 'full' },
        '1a-',
        '１ａ－',
      ],
      ['クラスの無い字は変えない', { alpha: 'full' }, '東京ａ\n', '東京ａ\n'],
    ];
    for (const [name, style, input, expected] of cases) {
      it(name, () => {
        assert.equal(applyCharStyle(input, style), expected);
      });
    }
  });

  describe('chars の指定', () => {
    it('chars はクラスより優先する', () => {
      const style: CharStyle = {
        symbol: 'full',
        digit: 'full',
        chars: { '-': 'half', '1': 'ー' },
      };
      assert.equal(applyCharStyle('1-2', style), 'ー-２');
    });

    it('chars で full にする', () => {
      assert.equal(applyCharStyle('a-b', { chars: { '-': 'full' } }), 'a－b');
    });

    it('ASCII 以外のキーを置き換える', () => {
      assert.equal(applyCharStyle('1ー2', { chars: { ー: '-' } }), '1-2');
    });

    it('サロゲートペアを1文字として扱う', () => {
      assert.equal(
        applyCharStyle('𠮷野家𠮷', { chars: { '𠮷': '吉' } }),
        '吉野家吉',
      );
      assert.equal(applyCharStyle('𠮷', { alpha: 'full' }), '𠮷');
    });

    it('空文字列', () => {
      assert.equal(applyCharStyle('', { digit: 'full' }), '');
    });
  });

  describe('2回かけても結果が変わらない', () => {
    const styles: [string, CharStyle][] = [
      [
        'すべて full',
        { digit: 'full', alpha: 'full', symbol: 'full', space: 'full' },
      ],
      [
        'クラスと chars の組み合わせ',
        {
          digit: 'full',
          alpha: 'full',
          chars: { ー: '-', '#': '＃', '〜': '～' },
        },
      ],
    ];
    const input = '東京都 1-2ー3 #4〜5 Ab!';
    for (const [name, style] of styles) {
      it(name, () => {
        const once = applyCharStyle(input, style);
        assert.equal(applyCharStyle(once, style), once);
      });
    }
  });

  describe('検査', () => {
    const cases: [string, unknown][] = [
      ['style が null', null],
      ['style が配列', []],
      ['クラスの値が不正', { digit: 'wide' }],
      ['chars が object でない', { chars: 'abc' }],
      ['キーが2コードポイント', { chars: { ab: 'c' } }],
      ['値が string でない', { chars: { a: 1 } }],
      ['値が2コードポイント', { chars: { a: 'bc' } }],
      ['値が空文字列', { chars: { a: '' } }],
      ['ASCII 以外のキーに full', { chars: { ー: 'full' } }],
      ['ASCII 以外のキーに half', { chars: { ー: 'half' } }],
      ['制御文字のキーに full', { chars: { '\u0001': 'full' } }],
      ['値をキーにする', { chars: { a: 'b', b: 'c' } }],
      ['値が自分と同じキー', { chars: { ー: 'ー' } }],
      [
        '値の ASCII の字がクラスの指定で変わる',
        { alpha: 'full', chars: { ー: 'a' } },
      ],
      [
        '値の空白が space の指定で変わる',
        { space: 'full', chars: { '\u3000': ' ' } },
      ],
      [
        'full で作る全角の字をキーにする',
        { alpha: 'full', chars: { Ａ: '吉' } },
      ],
      [
        'full で作る U+3000 をキーにする',
        { space: 'full', chars: { '\u3000': '＿' } },
      ],
      [
        'chars で full にした字の全角形をキーにする',
        { chars: { A: 'full', Ａ: '吉' } },
      ],
    ];
    for (const [name, style] of cases) {
      it(name, () => {
        assert.throws(() => applyCharStyle('a', style as any), TypeError);
      });
    }

    it('クラスが full でも、chars で half にした字の全角形はキーにできる', () => {
      const style: CharStyle = {
        alpha: 'full',
        chars: { A: 'half', Ａ: '吉' },
      };
      const once = applyCharStyle('AＡb', style);
      assert.equal(once, 'A吉ｂ');
      assert.equal(applyCharStyle(once, style), once);
    });

    it('全角の字のキーは、そのクラスが half なら通る', () => {
      const style: CharStyle = {
        alpha: 'half',
        chars: { Ａ: '吉', '\u3000': '＿' },
      };
      const once = applyCharStyle('AＡ \u3000', style);
      assert.equal(once, 'A吉 ＿');
      assert.equal(applyCharStyle(once, style), once);
    });

    it('値の ASCII の字のクラスが half なら通る', () => {
      assert.equal(
        applyCharStyle('ー', { alpha: 'half', chars: { ー: 'a' } }),
        'a',
      );
    });

    for (const value of [undefined, null, 1, ['a']]) {
      it(`text が ${String(value)}`, () => {
        assert.throws(() => applyCharStyle(value as any, {}), TypeError);
      });
    }
  });
});

describe('mergeCharStyle', () => {
  it('クラスは override を優先する', () => {
    assert.deepEqual(
      mergeCharStyle(
        { digit: 'full', alpha: 'full' },
        { digit: 'half', space: 'full' },
      ),
      { digit: 'half', alpha: 'full', space: 'full' },
    );
  });

  it('chars はキーごとにマージする', () => {
    assert.deepEqual(
      mergeCharStyle(
        { chars: { '-': 'full', ー: '-' } },
        { chars: { '-': 'half', '#': '＃' } },
      ),
      { chars: { '-': 'half', ー: '-', '#': '＃' } },
    );
  });

  it('chars が片方にだけあれば、それを使う', () => {
    assert.deepEqual(
      mergeCharStyle({ chars: { ー: '-' } }, { digit: 'full' }),
      {
        digit: 'full',
        chars: { ー: '-' },
      },
    );
  });

  it('引数を変えない', () => {
    const base: CharStyle = { chars: { ー: '-' } };
    mergeCharStyle(base, { chars: { '#': '＃' } });
    assert.deepEqual(base, { chars: { ー: '-' } });
  });

  for (const value of [undefined, null, 'full']) {
    it(`引数が ${String(value)}`, () => {
      assert.throws(() => mergeCharStyle(value as any, {}), TypeError);
      assert.throws(() => mergeCharStyle({}, value as any), TypeError);
    });
  }
});
