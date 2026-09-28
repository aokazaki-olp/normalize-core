import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { guardedNfkc } from '../../src/domain/guardedNfkc.ts';
import { HORIZONTAL_BAR } from '../../src/domain/horizontalBar.ts';

// 見た目で区別できない字は、コードポイントで書く
const chars = (...codePoints: number[]): string =>
  String.fromCodePoint(...codePoints);

const label = (char: string): string =>
  `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase()}`;

function* allCodePoints(): Generator<string> {
  for (let codePoint = 0; codePoint <= 0x10ffff; codePoint++) {
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
      continue;
    }
    yield String.fromCodePoint(codePoint);
  }
}

describe('guardedNfkc', () => {
  describe('NFKC をかける', () => {
    const cases: [string, string, string][] = [
      ['半角カナの地名', 'ﾆｾｺ町ﾆｾｺ', 'ニセコ町ニセコ'],
      ['半角カナと数字', 'ｾﾝﾄﾚｱ1-1', 'セントレア1-1'],
      ['半角のケ', '鶴ｹ島市', '鶴ケ島市'],
      ['康熙部首の長', `${chars(0x2fa7)}野市`, `${chars(0x9577)}野市`],
      [
        '康熙部首の一',
        `道玄坂${chars(0x2f00)}丁目`,
        `道玄坂${chars(0x4e00)}丁目`,
      ],
      ['全角英数', 'ＡＢＣ０１９', 'ABC019'],
      ['全角のハイフン（横棒どうし）', `1${chars(0xff0d)}2`, '1-2'],
      ['半角の長音（横棒どうし）', 'ｽｰﾊﾟｰ', 'スーパー'],
      ['全角スペース', `東京都${chars(0x3000)}渋谷区`, '東京都 渋谷区'],
      ['CJK 互換漢字', chars(0xfa10), chars(0x585a)],
      ['囲みの CJK の漢数字', chars(0x1f229), chars(0x4e00)],
      ['CJK 互換漢字の漢数字', chars(0xf9b2), chars(0x96f6)],
      ['結果が補助面の1コードポイント', chars(0x1079c), chars(0x1df04)],
    ];
    for (const [name, input, expected] of cases) {
      it(name, () => {
        assert.equal(guardedNfkc(input), expected);
      });
    }
  });

  describe('半角カナの濁点・半濁点を合成する', () => {
    it('ﾋﾞ → ビ', () => {
      assert.equal(guardedNfkc('ﾋﾞﾙ'), 'ビル');
    });

    it('ﾊﾟ → パ', () => {
      assert.equal(guardedNfkc('ﾊﾟﾝ'), 'パン');
    });

    it('分解された濁点も合成する', () => {
      assert.equal(guardedNfkc(chars(0x30d2, 0x3099)), chars(0x30d3));
    });
  });

  describe('条件に当たる文字は残す', () => {
    const cases: [string, string][] = [
      ['一般カテゴリ No（丸数字）', '①'],
      ['一般カテゴリ No（上付き数字）', '²'],
      ['一般カテゴリ No（分数）', '½'],
      ['一般カテゴリ Nl（ローマ数字）', 'Ⅰ'],
      ['一般カテゴリ Nl（ローマ数字）', 'Ⅱ'],
      ['一般カテゴリ Nl（蘇州数字）', chars(0x3038)],
      ['一般カテゴリ No（囲みの漢数字）', chars(0x3280)],
      ['結果が2コードポイント以上（囲み文字）', '㈱'],
      ['結果が2コードポイント以上（組文字）', '㍉'],
      ['結果が2コードポイント以上（三点リーダー）', '…'],
      ['結果が2コードポイント以上（ナンバー記号）', '№'],
      ['結果が2コードポイント以上（濁点）', chars(0x309b)],
      ['結果が ASCII の数字を含む', chars(0x1d7cf)],
      ['結果が横棒を含み、元は横棒でない', chars(0x207b)],
    ];
    for (const [name, char] of cases) {
      it(`${name}: ${label(char)}`, () => {
        assert.notEqual(
          char.normalize('NFKC'),
          char,
          'NFKC で変わる文字でなければ検証にならない',
        );
        assert.equal(guardedNfkc(char), char);
      });
    }

    it('番地の直後の丸数字は番地に吸収されない', () => {
      assert.equal(guardedNfkc('道玄坂1-2-3①'), '道玄坂1-2-3①');
    });

    it('残した文字の前後は NFKC をかける', () => {
      assert.equal(guardedNfkc('ﾋﾞﾙ㈱ＡＢ②'), 'ビル㈱AB②');
    });

    it('残した文字にも最後の NFC がかかる', () => {
      assert.equal(guardedNfkc(chars(0x1fee)), chars(0x0385));
    });

    it('残した濁点は前の字と合成しない', () => {
      assert.equal(guardedNfkc(`ｶ${chars(0x309b)}`), `カ${chars(0x309b)}`);
    });
  });

  describe('境界値', () => {
    it('空文字列', () => {
      assert.equal(guardedNfkc(''), '');
    });

    it('タブ・改行はそのまま', () => {
      assert.equal(guardedNfkc('a\tb\nc\r\n'), 'a\tb\nc\r\n');
    });

    it('サロゲートペアを1文字として扱う', () => {
      assert.equal(guardedNfkc(chars(0x1d400)), 'A');
    });

    it('対になっていないサロゲートはそのまま', () => {
      const input = `a${String.fromCharCode(0xd800)}b`;
      assert.equal(guardedNfkc(input), input);
    });

    it('大量の入力（10万字）', () => {
      const unit = `ﾋﾞﾙ①ＡＢ１${chars(0x2fa7)}ｰ${chars(0x3000)}`;
      const expected = `ビル①AB1${chars(0x9577)}ー `;
      assert.equal(guardedNfkc(unit.repeat(10_000)), expected.repeat(10_000));
    });
  });

  describe('全コードポイントで性質を満たす', () => {
    it('2回かけても結果が変わらない', () => {
      for (const char of allCodePoints()) {
        const once = guardedNfkc(char);
        assert.equal(guardedNfkc(once), once, label(char));
      }
    });

    it('元に無かった ASCII の数字を生まない（全角数字からを除く）', () => {
      for (const char of allCodePoints()) {
        if (/[0-9０-９]/u.test(char)) {
          continue;
        }
        assert.doesNotMatch(guardedNfkc(char), /[0-9]/u, label(char));
      }
    });

    it('元に無かった横棒を生まない（横棒どうしを除く）', () => {
      const horizontalBar = new RegExp(HORIZONTAL_BAR, 'u');
      for (const char of allCodePoints()) {
        if (horizontalBar.test(char)) {
          continue;
        }
        assert.doesNotMatch(guardedNfkc(char), horizontalBar, label(char));
      }
    });
  });

  it('条件に当たる文字を含まなければ NFKC と同じ', () => {
    const input = `ﾆｾｺ町${chars(0x3000)}ＡＢ１${chars(0xff0d)}２ﾋﾞﾙ${chars(0x2fa7, 0xfa10)}`;
    assert.equal(guardedNfkc(input), input.normalize('NFKC'));
  });

  describe('引数の検査', () => {
    const cases: [string, unknown][] = [
      ['undefined', undefined],
      ['null', null],
      ['数値', 1],
      ['オブジェクト', {}],
      ['配列', ['a']],
    ];
    for (const [name, value] of cases) {
      it(`文字列でない値（${name}）は TypeError`, () => {
        assert.throws(() => guardedNfkc(value as any), TypeError);
      });
    }
  });
});
