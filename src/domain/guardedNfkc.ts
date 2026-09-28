/**
 * guardedNfkc.ts
 *
 * @description ガード付き NFKC（条件に当たる文字を残して NFKC をかける）
 */

import { HORIZONTAL_BAR } from './horizontalBar.ts';

const NUMBER_LETTER_OR_OTHER = /^[\p{Nl}\p{No}]$/u;
const SINGLE_CODE_POINT = /^.$/su;
const ASCII_DIGIT = /[0-9]/u;
const FULLWIDTH_DIGIT = /^[０-９]$/u;
const HORIZONTAL_BAR_CHAR = new RegExp(HORIZONTAL_BAR, 'u');

const isGuarded = (char: string, normalized: string): boolean =>
  NUMBER_LETTER_OR_OTHER.test(char) ||
  !SINGLE_CODE_POINT.test(normalized) ||
  (ASCII_DIGIT.test(normalized) && !FULLWIDTH_DIGIT.test(char)) ||
  (HORIZONTAL_BAR_CHAR.test(normalized) && !HORIZONTAL_BAR_CHAR.test(char));

const normalizeChar = (char: string): string => {
  const normalized = char.normalize('NFKC');
  return normalized !== char && !isGuarded(char, normalized)
    ? normalized
    : char;
};

/**
 * 条件に当たる文字を残して NFKC をかけ、最後に全体に NFC をかける
 *
 * 1コードポイントずつ NFKC をかけ、NFKC で変わる文字のうち次のどれかに当たるものは NFKC をかけずに残す。
 *
 * - 一般カテゴリが Nl または No（例：① ² ½ Ⅰ 〸）
 * - NFKC の結果が2コードポイント以上になる（例：㈱ ㍉ … № ゛）
 * - NFKC の結果が ASCII の数字（0〜9）を含む。全角数字（０〜９）は除く（例：𝟏）
 * - NFKC の結果が横棒を含み、元の文字は横棒でない（例：⁻ → −）。横棒は NJA v3.1.3 が横棒として扱う18文字
 *
 * 漢数字は数字として扱わない（例：⼀ U+2F00 は 一 になる）。
 *
 * 最後の NFC は、条件に当たって残した文字にもかかる。正準分解を持つ文字は NFC の結果になり、
 * その多くは NFKC をかけた場合と同じ結果になる（例：U+0958 → U+0915 U+093C）。
 *
 * 判定は実行環境の Unicode の版に依存する（一般カテゴリは Unicode の版の間で変わりうる）。
 *
 * @param text - 正規化する文字列
 * @returns 正規化した文字列
 * @throws {TypeError} text が文字列でない場合
 */
export const guardedNfkc = (text: string): string => {
  if (typeof text !== 'string') {
    throw new TypeError('text には string を指定してください');
  }
  return Array.from(text, normalizeChar).join('').normalize('NFC');
};
