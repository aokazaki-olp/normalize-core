/**
 * index.ts
 *
 * @description 正規化器の系列が共通で使う部品の公開面
 */

export { guardedNfkc } from './domain/guardedNfkc.ts';
export { applyCharStyle, mergeCharStyle } from './domain/charStyle.ts';
export type { CharStyle, CharTarget, WidthMode } from './domain/charStyle.ts';
