/**
 * charStyle.ts
 *
 * @description 字形の指定（CharStyle）の型と、それを扱う関数をまとめた値のオブジェクト
 */

import { SINGLE_CODE_POINT } from './codePoint.ts';

/** 字形の幅。half は変えない、full は全角にする */
export type WidthMode = 'half' | 'full';
/**
 * chars の値。half・full か、1コードポイントの字
 *
 * `string & {}` は、`WidthMode | string` が string に畳まれて補完から half・full が消えるのを防ぐため。受けられる値は string と同じ。
 */
export type CharTarget = WidthMode | (string & {});

/**
 * 字形の指定
 *
 * 省略したクラスは half として扱う。
 */
export interface CharStyle {
  /** 0-9 */
  digit?: WidthMode;
  /** A-Z a-z */
  alpha?: WidthMode;
  /** ASCII の記号（U+0021〜U+007E のうち数字・英字以外の32字） */
  symbol?: WidthMode;
  /** U+0020 */
  space?: WidthMode;
  /** 1字ずつの指定。キーは1コードポイント、値は half・full か1コードポイントの字 */
  chars?: Record<string, CharTarget>;
}

/**
 * 項目ごとの字形の指定
 *
 * 正規化器が、結果の項目ごとに字形の指定を当てるときに使う。
 */
export interface FieldStyle<TField extends string> {
  /** すべての項目に共通の指定 */
  default?: CharStyle;
  /** 項目ごとの上書き。false なら、その項目には字形の指定を当てない */
  fields?: Partial<Record<TField, CharStyle | false>>;
}

type CharClass = 'digit' | 'alpha' | 'symbol' | 'space';

const CLASSES: readonly CharClass[] = ['digit', 'alpha', 'symbol', 'space'];
const DIGIT = /^[0-9]$/u;
const ALPHA = /^[A-Za-z]$/u;
const SYMBOL = /^[!-/:-@[-`{-~]$/u;
const IDEOGRAPHIC_SPACE = '　';
const FULLWIDTH_OFFSET = 0xfee0;

const classOf = (char: string): CharClass | undefined => {
  if (DIGIT.test(char)) {
    return 'digit';
  }
  if (ALPHA.test(char)) {
    return 'alpha';
  }
  if (SYMBOL.test(char)) {
    return 'symbol';
  }
  if (char === ' ') {
    return 'space';
  }
  return undefined;
};

const isWidthMode = (value: unknown): value is WidthMode =>
  value === 'half' || value === 'full';

const toWidth = (char: string, mode: WidthMode): string => {
  if (mode === 'half') {
    return char;
  }
  if (char === ' ') {
    return IDEOGRAPHIC_SPACE;
  }
  return String.fromCodePoint((char.codePointAt(0) ?? 0) + FULLWIDTH_OFFSET);
};

const fromFullWidth = (char: string): string | undefined => {
  if (char === IDEOGRAPHIC_SPACE) {
    return ' ';
  }
  const codePoint = char.codePointAt(0) ?? 0;
  return codePoint >= 0xff01 && codePoint <= 0xff5e
    ? String.fromCodePoint(codePoint - FULLWIDTH_OFFSET)
    : undefined;
};

const isObject = (value: unknown): value is object =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validateChars = (
  style: CharStyle,
  chars: Record<string, unknown>,
): Map<string, CharTarget> => {
  const entries = new Map<string, CharTarget>();
  for (const [key, value] of Object.entries(chars)) {
    if (!SINGLE_CODE_POINT.test(key)) {
      throw new TypeError(
        `chars のキー ${key} は1コードポイントにしてください`,
      );
    }
    if (typeof value !== 'string') {
      throw new TypeError(`chars の ${key} の値には string を指定してください`);
    }
    if (isWidthMode(value)) {
      if (classOf(key) === undefined) {
        throw new TypeError(
          `chars の ${key} にはクラスが無いので half / full を指定できません`,
        );
      }
    } else if (!SINGLE_CODE_POINT.test(value)) {
      throw new TypeError(
        `chars の ${key} の値は1コードポイントにしてください`,
      );
    }
    entries.set(key, value);
  }
  for (const [key, value] of entries) {
    const halfWidth = fromFullWidth(key);
    const halfClass = halfWidth === undefined ? undefined : classOf(halfWidth);
    if (halfWidth !== undefined && halfClass !== undefined) {
      const mode = entries.get(halfWidth) ?? style[halfClass];
      if (mode === 'full') {
        throw new TypeError(
          `chars のキー ${key} は ${halfWidth} を full にした字なのでキーにできません`,
        );
      }
    }
    if (isWidthMode(value)) {
      continue;
    }
    if (entries.has(value)) {
      throw new TypeError(`chars の ${key} の値 ${value} はキーにできません`);
    }
    const valueClass = classOf(value);
    if (valueClass !== undefined && (style[valueClass] ?? 'half') !== 'half') {
      throw new TypeError(
        `chars の ${key} の値 ${value} は ${valueClass} の指定で変わります`,
      );
    }
  }
  return entries;
};

const validateStyle = (style: unknown): Map<string, CharTarget> => {
  if (!isObject(style)) {
    throw new TypeError('style には object を指定してください');
  }
  const candidate: CharStyle = style;
  for (const name of CLASSES) {
    const mode: unknown = candidate[name];
    if (mode !== undefined && !isWidthMode(mode)) {
      throw new TypeError(`${name} には half または full を指定してください`);
    }
  }
  const chars: unknown = candidate.chars;
  if (chars === undefined) {
    return new Map();
  }
  if (!isObject(chars)) {
    throw new TypeError('chars には object を指定してください');
  }
  return validateChars(candidate, { ...chars });
};

const apply = (text: string, style: CharStyle): string => {
  if (typeof text !== 'string') {
    throw new TypeError('text には string を指定してください');
  }
  const chars = validateStyle(style);
  return Array.from(text, (char) => {
    const target = chars.get(char);
    if (isWidthMode(target)) {
      return toWidth(char, target);
    }
    if (target !== undefined) {
      return target;
    }
    const charClass = classOf(char);
    return charClass === undefined
      ? char
      : toWidth(char, style[charClass] ?? 'half');
  }).join('');
};

const merge = (base: CharStyle, override: CharStyle): CharStyle => {
  if (!isObject(base) || !isObject(override)) {
    throw new TypeError('base と override には object を指定してください');
  }
  const baseChars: unknown = base.chars;
  const overrideChars: unknown = override.chars;
  if (
    (baseChars !== undefined && !isObject(baseChars)) ||
    (overrideChars !== undefined && !isObject(overrideChars))
  ) {
    throw new TypeError(
      'base と override の chars には object を指定してください',
    );
  }
  const merged: CharStyle = {};
  for (const name of CLASSES) {
    const mode = override[name] ?? base[name];
    if (mode !== undefined) {
      merged[name] = mode;
    }
  }
  if (base.chars !== undefined || override.chars !== undefined) {
    merged.chars = { ...base.chars, ...override.chars };
  }
  return merged;
};

const checkFields = <TField extends string>(
  fieldNames: readonly TField[],
  fields: FieldStyle<TField>['fields'],
): void => {
  if (fields === undefined) {
    return;
  }
  if (!isObject(fields)) {
    throw new TypeError('style.fields には object を指定してください');
  }
  for (const key of Object.keys(fields)) {
    if (!fieldNames.some((field) => field === key)) {
      throw new TypeError(
        `style.fields のキーには ${fieldNames.join('・')} を指定してください: ${key}`,
      );
    }
  }
  for (const field of fieldNames) {
    const value = fields[field];
    if (value !== undefined && value !== false && !isObject(value)) {
      throw new TypeError(
        `style.fields.${field} には object または false を指定してください`,
      );
    }
  }
};

const prepareFields = <TField extends string>(
  fieldNames: readonly TField[],
  style: FieldStyle<TField> | undefined,
): ((field: TField) => CharStyle | undefined) => {
  if (style !== undefined && !isObject(style)) {
    throw new TypeError('style には object を指定してください');
  }
  const base = style?.default;
  if (base !== undefined && !isObject(base)) {
    throw new TypeError('style.default には object を指定してください');
  }
  const fields = style?.fields;
  checkFields(fieldNames, fields);
  const resolved = new Map<TField, CharStyle | undefined>();
  for (const field of fieldNames) {
    const fieldStyle = fields?.[field];
    if (fieldStyle === false) {
      resolved.set(field, undefined);
      continue;
    }
    const merged = merge(base ?? {}, fieldStyle ?? {});
    validateStyle(merged);
    resolved.set(field, merged);
  }
  return (field) => resolved.get(field);
};

/**
 * 字形の指定を扱う関数（型 CharStyle と同じ名前の値）
 */
export const CharStyle = {
  /**
   * 文字列を、指定した字形にそろえる
   *
   * 1コードポイントずつ、chars の指定 → その字のクラスの指定 → そのまま、の順で決める。
   * full は ASCII の字を U+FF01〜U+FF5E に、空白を U+3000 にする。half は変えない。
   *
   * @param text - そろえる文字列
   * @param style - 字形の指定
   * @returns そろえた文字列
   * @throws {TypeError} text が文字列でない場合、または style が検査を満たさない場合
   */
  apply,
  /**
   * 2つの字形の指定を重ねる
   *
   * クラスは override を優先し、chars はキーごとにマージする（override にあるキーだけ上書き）。
   * 結果の検査は apply で行う。
   *
   * @param base - 元の指定
   * @param override - 上書きする指定
   * @returns 重ねた指定
   * @throws {TypeError} base・override、またはそれぞれの chars が object でない場合
   */
  merge,
  /**
   * 項目ごとの字形の指定を検査し、default とマージしておく
   *
   * 正規化器の create のときに呼ぶ。検査とマージはこの呼び出しで全部済ませ、返す関数は検査をしない。
   * 項目の字形の指定は、fields の値が false なら undefined（当てない）、
   * そうでなければ merge(default ?? {}, fields の値 ?? {}) を apply と同じ検査にかけたもの。
   * style・default・fields の検査の TypeError のメッセージには style. の前置きが付く（正規化器のオプションの style をそのまま渡すため）。
   * マージした指定の検査のメッセージは apply と同じ。
   *
   * @param fieldNames - 項目の名前の一覧
   * @param style - 項目ごとの字形の指定
   * @returns 項目の名前から、その項目に当てる字形の指定（当てないなら undefined）を返す関数
   * @throws {TypeError} style・style.default・style.fields が object でない場合、style.fields のキーが fieldNames に無い場合、style.fields の値が object または false でない場合、またはマージした指定が apply の検査を満たさない場合
   */
  prepareFields,
};
