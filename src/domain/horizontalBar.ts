/**
 * horizontalBar.ts
 *
 * @description ガード付き NFKC が横棒として扱う文字の集合
 */

// NJA v3.1.3 が横棒として扱う文字クラス（src/lib/normalizeHelpers.ts）
export const HORIZONTAL_BAR = /[-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━]/u;
