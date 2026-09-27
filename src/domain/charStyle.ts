/**
 * charStyle.ts
 *
 * @description 字形の指定（CharStyle）と、それを文字列にかける関数
 */

export type WidthMode = 'half' | 'full';
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- 設計文書の型どおり、half / full を受けることを型の上で示す
export type CharTarget = WidthMode | string;

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

type CharClass = 'digit' | 'alpha' | 'symbol' | 'space';

const CLASSES: readonly CharClass[] = ['digit', 'alpha', 'symbol', 'space'];
const SINGLE_CODE_POINT = /^.$/su;
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
export const applyCharStyle = (text: string, style: CharStyle): string => {
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

/**
 * 2つの字形の指定を重ねる
 *
 * クラスは override を優先し、chars はキーごとにマージする（override にあるキーだけ上書き）。
 * 結果の検査は applyCharStyle で行う。
 *
 * @param base - 元の指定
 * @param override - 上書きする指定
 * @returns 重ねた指定
 * @throws {TypeError} base または override が object でない場合
 */
export const mergeCharStyle = (
  base: CharStyle,
  override: CharStyle,
): CharStyle => {
  if (!isObject(base) || !isObject(override)) {
    throw new TypeError('base と override には object を指定してください');
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
