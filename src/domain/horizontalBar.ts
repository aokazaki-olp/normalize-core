/**
 * horizontalBar.ts
 *
 * @description 横棒として扱う文字の集合を表す、正規表現のパターンの文字列
 */

/**
 * 正規表現のパターンの文字列（文字クラス1つ分の source）。横棒として扱う文字の集合を表す
 *
 * RegExp ではなく文字列なので、使う側で RegExp を組み立てる。
 * NJA v3.1.3 が横棒として扱う18文字（src/lib/normalizeHelpers.ts の文字クラス）。
 * 1コードポイントに当たる文字クラス1つ（`[...]`）なので、そのまま量指定子を付けられる。
 * `-` はエスケープしてあるので、フラグなし・u・v のどれで組み立てても同じ18文字に当たる。
 *
 * RegExp のインスタンスは共有すると書き換えられる（compile()）ので、文字列で公開する。
 * 組み立て方の例：`new RegExp('^(?:' + HORIZONTAL_BAR_PATTERN + ')+', 'u')`
 */
export const HORIZONTAL_BAR_PATTERN = '[\\-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━]';
