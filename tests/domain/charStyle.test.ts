import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CharStyle, type FieldStyle } from '../../src/domain/charStyle.ts';

const ASCII_SAMPLE = '09AZaz!/:@[`{~ ';

describe('CharStyle', () => {
  it('キーは apply・merge・prepareFields', () => {
    assert.deepEqual(Object.keys(CharStyle).toSorted(), [
      'apply',
      'merge',
      'prepareFields',
    ]);
  });
});

describe('CharStyle.apply', () => {
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
        assert.equal(CharStyle.apply(input, style), expected);
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
      assert.equal(CharStyle.apply('1-2', style), 'ー-２');
    });

    it('chars で full にする', () => {
      assert.equal(CharStyle.apply('a-b', { chars: { '-': 'full' } }), 'a－b');
    });

    it('ASCII 以外のキーを置き換える', () => {
      assert.equal(CharStyle.apply('1ー2', { chars: { ー: '-' } }), '1-2');
    });

    it('サロゲートペアを1文字として扱う', () => {
      assert.equal(
        CharStyle.apply('𠮷野家𠮷', { chars: { '𠮷': '吉' } }),
        '吉野家吉',
      );
      assert.equal(CharStyle.apply('𠮷', { alpha: 'full' }), '𠮷');
    });

    it('空文字列', () => {
      assert.equal(CharStyle.apply('', { digit: 'full' }), '');
    });

    it('大量の入力（10万字）', () => {
      const style: CharStyle = {
        digit: 'full',
        alpha: 'full',
        space: 'full',
        chars: { ー: '-', '𠮷': '吉' },
      };
      const unit = '1a ー𠮷東!-9Z';
      const expected = '１ａ\u3000-吉東!-９Ｚ';
      assert.equal(
        CharStyle.apply(unit.repeat(10_000), style),
        expected.repeat(10_000),
      );
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
        const once = CharStyle.apply(input, style);
        assert.equal(CharStyle.apply(once, style), once);
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
        assert.throws(() => CharStyle.apply('a', style as any), TypeError);
      });
    }

    it('クラスが full でも、chars で half にした字の全角形はキーにできる', () => {
      const style: CharStyle = {
        alpha: 'full',
        chars: { A: 'half', Ａ: '吉' },
      };
      const once = CharStyle.apply('AＡb', style);
      assert.equal(once, 'A吉ｂ');
      assert.equal(CharStyle.apply(once, style), once);
    });

    it('全角の字のキーは、そのクラスが half なら通る', () => {
      const style: CharStyle = {
        alpha: 'half',
        chars: { Ａ: '吉', '\u3000': '＿' },
      };
      const once = CharStyle.apply('AＡ \u3000', style);
      assert.equal(once, 'A吉 ＿');
      assert.equal(CharStyle.apply(once, style), once);
    });

    it('値の ASCII の字のクラスが half なら通る', () => {
      assert.equal(
        CharStyle.apply('ー', { alpha: 'half', chars: { ー: 'a' } }),
        'a',
      );
    });

    for (const value of [undefined, null, 1, ['a']]) {
      it(`text が ${String(value)}`, () => {
        assert.throws(() => CharStyle.apply(value as any, {}), TypeError);
      });
    }
  });
});

describe('CharStyle.merge', () => {
  it('クラスは override を優先する', () => {
    assert.deepEqual(
      CharStyle.merge(
        { digit: 'full', alpha: 'full' },
        { digit: 'half', space: 'full' },
      ),
      { digit: 'half', alpha: 'full', space: 'full' },
    );
  });

  it('chars はキーごとにマージする', () => {
    assert.deepEqual(
      CharStyle.merge(
        { chars: { '-': 'full', ー: '-' } },
        { chars: { '-': 'half', '#': '＃' } },
      ),
      { chars: { '-': 'half', ー: '-', '#': '＃' } },
    );
  });

  it('chars が片方にだけあれば、それを使う', () => {
    assert.deepEqual(
      CharStyle.merge({ chars: { ー: '-' } }, { digit: 'full' }),
      {
        digit: 'full',
        chars: { ー: '-' },
      },
    );
  });

  it('引数を変えない', () => {
    const base: CharStyle = { chars: { ー: '-' } };
    CharStyle.merge(base, { chars: { '#': '＃' } });
    assert.deepEqual(base, { chars: { ー: '-' } });
  });

  for (const value of [undefined, null, 'full', []]) {
    it(`引数が ${JSON.stringify(value)}`, () => {
      assert.throws(() => CharStyle.merge(value as any, {}), TypeError);
      assert.throws(() => CharStyle.merge({}, value as any), TypeError);
    });
  }

  for (const value of ['abc', ['a'], null, 1]) {
    it(`chars が ${JSON.stringify(value)}`, () => {
      assert.throws(
        () => CharStyle.merge({ chars: value as any }, {}),
        TypeError,
      );
      assert.throws(
        () => CharStyle.merge({}, { chars: value as any }),
        TypeError,
      );
    });
  }

  it('chars が undefined なら無いものとして扱う', () => {
    assert.deepEqual(
      CharStyle.merge({ chars: undefined }, { chars: { ー: '-' } }),
      { chars: { ー: '-' } },
    );
  });
});

describe('CharStyle.prepareFields', () => {
  const FIELDS = ['name', 'code'] as const;
  type Field = (typeof FIELDS)[number];
  const resolveAll = (
    style: FieldStyle<Field> | undefined,
  ): Record<Field, CharStyle | undefined> => {
    const styleOf = CharStyle.prepareFields(FIELDS, style);
    return { name: styleOf('name'), code: styleOf('code') };
  };

  describe('正しい指定', () => {
    const cases: [
      string,
      FieldStyle<Field> | undefined,
      Record<Field, CharStyle | undefined>,
    ][] = [
      ['省略', undefined, { name: {}, code: {} }],
      ['空の object', {}, { name: {}, code: {} }],
      [
        'default だけ',
        { default: { digit: 'full' } },
        { name: { digit: 'full' }, code: { digit: 'full' } },
      ],
      [
        'fields で上書きする',
        { default: { digit: 'full' }, fields: { code: { digit: 'half' } } },
        { name: { digit: 'full' }, code: { digit: 'half' } },
      ],
      [
        'chars はキーごとにマージする',
        {
          default: { chars: { '-': 'ー', '~': '〜' } },
          fields: { name: { chars: { '-': 'full' } } },
        },
        {
          name: { chars: { '-': 'full', '~': '〜' } },
          code: { chars: { '-': 'ー', '~': '〜' } },
        },
      ],
      [
        'false なら当てない',
        { default: { alpha: 'full' }, fields: { name: false } },
        { name: undefined, code: { alpha: 'full' } },
      ],
      [
        'fields の値が undefined なら default',
        { default: { space: 'full' }, fields: { name: undefined } },
        { name: { space: 'full' }, code: { space: 'full' } },
      ],
    ];
    for (const [name, style, expected] of cases) {
      it(name, () => {
        assert.deepEqual(resolveAll(style), expected);
      });
    }
  });

  describe('誤った指定', () => {
    const cases: [string, unknown, string][] = [
      ['style が null', null, 'style には object を指定してください'],
      ['style が文字列', 'full', 'style には object を指定してください'],
      ['style が配列', [], 'style には object を指定してください'],
      [
        'default が文字列',
        { default: 'full' },
        'style.default には object を指定してください',
      ],
      [
        'default が null',
        { default: null },
        'style.default には object を指定してください',
      ],
      [
        'default が配列',
        { default: [] },
        'style.default には object を指定してください',
      ],
      [
        'fields が null',
        { fields: null },
        'style.fields には object を指定してください',
      ],
      [
        'fields が配列',
        { fields: [] },
        'style.fields には object を指定してください',
      ],
      [
        'fields に無い項目',
        { fields: { street: {} } },
        'style.fields のキーには name・code を指定してください: street',
      ],
      [
        'fields の値が true',
        { fields: { code: true } },
        'style.fields.code には object または false を指定してください',
      ],
      [
        'fields の値が配列',
        { fields: { name: [] } },
        'style.fields.name には object または false を指定してください',
      ],
      [
        'default の chars が文字列',
        { default: { chars: 'abc' } },
        'base と override の chars には object を指定してください',
      ],
      [
        'fields の chars が数',
        { fields: { name: { chars: 1 } } },
        'base と override の chars には object を指定してください',
      ],
      [
        'default のクラスの値が誤り',
        { default: { digit: 'wide' } },
        'digit には half または full を指定してください',
      ],
      [
        'fields の chars のキーが2コードポイント',
        { fields: { code: { chars: { ab: 'x' } } } },
        'chars のキー ab は1コードポイントにしてください',
      ],
      [
        'マージした結果が検査を満たさない',
        {
          default: { chars: { '~': '〜' } },
          fields: { code: { chars: { '〜': 'x' } } },
        },
        'chars の ~ の値 〜 はキーにできません',
      ],
      [
        'マージした結果で full の字がキーになる',
        { default: { symbol: 'full', chars: { '－': '-' } } },
        'chars のキー － は - を full にした字なのでキーにできません',
      ],
    ];
    for (const [name, style, message] of cases) {
      it(name, () => {
        assert.throws(() => CharStyle.prepareFields(FIELDS, style as any), {
          name: 'TypeError',
          message,
        });
      });
    }

    it('マージした指定の検査は fieldNames の順に行う', () => {
      assert.throws(
        () =>
          CharStyle.prepareFields(FIELDS, {
            fields: {
              code: { digit: 'wide' as any },
              name: { alpha: 'wide' as any },
            },
          }),
        { message: 'alpha には half または full を指定してください' },
      );
    });

    it('fields の値の検査はマージより先に行う', () => {
      assert.throws(
        () =>
          CharStyle.prepareFields(FIELDS, {
            fields: { name: { digit: 'wide' as any }, code: 1 as any },
          }),
        {
          message:
            'style.fields.code には object または false を指定してください',
        },
      );
    });
  });

  it('呼んだあとに style を書き換えても結果は変わらない', () => {
    const style: FieldStyle<Field> = {
      default: { digit: 'full', chars: { '-': 'ー' } },
      fields: { code: { alpha: 'full' } },
    };
    const styleOf = CharStyle.prepareFields(FIELDS, style);
    style.default = { digit: 'half' };
    style.fields = { code: false };
    assert.deepEqual(styleOf('code'), {
      digit: 'full',
      alpha: 'full',
      chars: { '-': 'ー' },
    });
  });

  it('返す指定は apply にそのまま渡せる', () => {
    const styleOf = CharStyle.prepareFields(FIELDS, {
      default: { digit: 'full' },
      fields: { name: false },
    });
    const codeStyle = styleOf('code');
    assert.notEqual(codeStyle, undefined);
    assert.equal(CharStyle.apply('1-2', codeStyle ?? {}), '１-２');
    assert.equal(styleOf('name'), undefined);
  });

  it('項目の一覧が空なら、fields のキーはどれも受けない', () => {
    const styleOf = CharStyle.prepareFields([] as const, {});
    assert.equal(typeof styleOf, 'function');
    assert.throws(
      () => CharStyle.prepareFields([] as const, { fields: { x: {} } as any }),
      TypeError,
    );
  });
});
