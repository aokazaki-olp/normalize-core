# normalize-core 設計

正規化器の系列（住所・名前・郵便番号・電話番号）が共通で使う部品。複数の正規化器で実際に使うものだけを入れる。系列全体の設計は作業場所の `docs/design.md` にある。

## レイヤー

```
src/
  index.ts    公開面
  domain/     ガード付き NFKC と、それが判定に使う横棒の集合（住所に固有。下記）、字形の指定
```

- 依存は `index.ts` → `domain` の一方向
- `src/` からは、相対パス以外（`node:` のモジュール・外部パッケージ）を import しない。I/O を持ち込まないため。lint で止める
- 既知の制限：`src/` にも Node の型定義とグローバルが与えられているので、`fetch` や `process` のようなグローバルは使えてしまう（レビューで守る）

## ガード付き NFKC

```ts
export const guardedNfkc: (text: string) => string;
```

1コードポイントずつ NFKC をかけ、NFKC で変わる文字のうち次のどれかに当たるものは残す。最後に全体に NFC をかける（半角カナの濁点を合成するため）。

| 条件                                                           | 例                        |
| -------------------------------------------------------------- | ------------------------- |
| 一般カテゴリが `Nl` または `No`                                | `①` `²` `½` `Ⅰ` `〸` `㊀` |
| NFKC の結果が2コードポイント以上になる                         | `㈱` `㍉` `…` `№` `゛`    |
| NFKC の結果が ASCII の数字を含む（全角数字 `０`〜`９` は除く） | `𝟏`                       |
| NFKC の結果が横棒を含み、元の文字は横棒でない                  | `⁻` → `−`                 |

- 横棒は、NJA v3.1.3 が横棒として扱う18文字（`src/lib/normalizeHelpers.ts` の文字クラス）。住所に固有の集合なので、`domain/horizontalBar.ts` に分けて置く
- 漢数字は数字として扱わない。康熙部首（`⼀` → `一`）、囲みの CJK（`🈩` → `一`）、CJK 互換漢字（U+F9B2 → `零`）が漢数字に変わるのは意図どおり。字形違いを正規の字にそろえるため（住所では `道玄坂⼀丁目2-3` が番地まで解析できるようになる。2026-09-26 実測）
- 既知の制限：こうした文字が番地の数字の直後に詰めて書かれると（`1-2-3⼀`）、NJA が変換後の漢数字を番地の一部として読むことがある
- 最後の NFC は、残した文字にもかかる（例：U+1FEE → U+0385）
- 判定は実行環境の Unicode の版に依存する
- 引数が文字列でなければ `TypeError` を投げる

## 字形の指定（CharStyle）

正規化器の出力を、利用者が指定した字形にそろえる。出力の直前にだけかける（正規化の処理は半角のまま行う）。

```ts
export type WidthMode = 'half' | 'full';
export type CharTarget = WidthMode | string; // string は1コードポイント

export interface CharStyle {
  digit?: WidthMode; // 0-9
  alpha?: WidthMode; // A-Z a-z
  symbol?: WidthMode; // ASCII の記号（U+0021〜U+007E のうち数字・英字以外の32字）
  space?: WidthMode; // U+0020
  chars?: Record<string, CharTarget>; // 1字ずつの指定
}

export const applyCharStyle: (text: string, style: CharStyle) => string;
export const mergeCharStyle: (
  base: CharStyle,
  override: CharStyle,
) => CharStyle;
```

- 1コードポイントずつ、`chars` の指定 → その字のクラスの指定 → そのまま、の順で決める
- `full` は、ASCII の字を U+FF01〜U+FF5E（コードポイントに 0xFEE0 を足す）に、空白を U+3000 にする。`half` は変えない
- 省略したクラスは `half`
- `mergeCharStyle` は、クラスは `override` を優先し、`chars` はキーごとにマージする（`override` にあるキーだけ上書き）

### 検査（`applyCharStyle` の入口で `TypeError`）

- `chars` のキーと、文字列の値は、どちらも1コードポイント
- クラスの無い字（ASCII 以外、および制御文字 U+0000〜U+001F・U+007F）のキーに `half` / `full` を指定しない
- 値に使った字を、キーにしない（置き換えが連鎖しないように）
- 値が ASCII の字なら、その字は自分のクラスの指定（とそれを上書きする `chars`）で変わらないこと。2回かけても結果が変わらないようにするため
- クラスの指定が `full` のとき、そのクラスの字の全角形（U+FF01〜U+FF5E のうち該当するもの。`space` なら U+3000）をキーにしない。`full` で作った字が2回目に置き換わらないようにするため
- 上を満たせば、同じ `style` で2回かけても結果は変わらない
