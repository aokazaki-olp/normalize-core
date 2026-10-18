# normalize-core 設計

正規化器の系列（住所・名前・郵便番号・電話番号）が共通で使う部品。複数の正規化器で実際に使うものだけを入れる。系列全体の設計は作業場所の `docs/design.md` にある。

## レイヤー

```
src/
  index.ts    公開面
  domain/     ガード付き NFKC と、それが判定に使う横棒の集合（住所に固有。下記。公開もする）、字形の指定、1コードポイントの判定（codePoint.ts。両者で共有）
```

- 依存は `index.ts` → `domain` の一方向。lint で止める（層の表は `eslint.config.js` の `LAYER_TABLE`）。lint の層の検査は層のディレクトリと `index.ts` にしか掛からないので、`src/` の直下に置けるもの（`index.ts` と層のディレクトリ）はテスト（`tests/srcLayout.test.ts`）で閉じる
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

- 横棒は、NJA v3.1.3 が横棒として扱う18文字（`src/lib/normalizeHelpers.ts` の文字クラス）。住所に固有の集合なので、`domain/horizontalBar.ts` に分けて置く。公開については次節
- 漢数字は数字として扱わない。康熙部首（`⼀` → `一`）、囲みの CJK（`🈩` → `一`）、CJK 互換漢字（U+F9B2 → `零`）が漢数字に変わるのは意図どおり。字形違いを正規の字にそろえるため（住所では `道玄坂⼀丁目2-3` が番地まで解析できるようになる。2026-09-26 実測）
- 既知の制限：こうした文字が番地の数字の直後に詰めて書かれると（`1-2-3⼀`）、NJA が変換後の漢数字を番地の一部として読むことがある
- 最後の NFC は、残した文字にもかかる（例：U+1FEE → U+0385）
- 判定は実行環境の Unicode の版に依存する
- 引数が文字列でなければ `TypeError` を投げる

## 横棒の集合の正規表現パターン（HORIZONTAL_BAR_PATTERN）

```ts
export const HORIZONTAL_BAR_PATTERN: string; // 正規表現のパターンの文字列。文字クラス1つ分の source（'[\\-－﹣…━]'）
```

- 正規表現のパターンの文字列（`RegExp` ではない）。利用者（normalize-address）が、横棒を扱う正規表現を組み立てるために使う（例：``new RegExp(`^(?:${HORIZONTAL_BAR_PATTERN})+`, 'u')``）
- 1コードポイントに当たる文字クラス1つ（`[...]`）。そのまま量指定子を付けられる
- `-` はエスケープしてあるので、フラグなし・`u`・`v` のどれで組み立てても同じ18文字に当たる
- `RegExp` ではなく文字列で公開する。`RegExp` のインスタンスは共有すると書き換えられる（`compile()` は、`Object.freeze` した正規表現でも、例外を投げる前に中身を書き換える。Node v24.21.0 で実測）。ガード付き NFKC が使う正規表現は、この文字列から内部で作る

## 字形の指定（CharStyle）

正規化器の出力を、利用者が指定した字形にそろえる。出力の直前にだけかける（正規化の処理は半角のまま行う）。

関数は値のオブジェクト `CharStyle` にまとめ、型 `CharStyle` と同じ名前で公開する（規約 §2.1 のモジュールオブジェクト）。`Object.freeze` はしない（規約 §3「ランタイム凍結が本当に要る場合のみ」）。

```ts
export type WidthMode = 'half' | 'full';
export type CharTarget = WidthMode | (string & {}); // string は1コードポイント

export interface CharStyle {
  digit?: WidthMode; // 0-9
  alpha?: WidthMode; // A-Z a-z
  symbol?: WidthMode; // ASCII の記号（U+0021〜U+007E のうち数字・英字以外の32字）
  space?: WidthMode; // U+0020
  chars?: Record<string, CharTarget>; // 1字ずつの指定
}

export interface FieldStyle<TField extends string> {
  default?: CharStyle; // すべての項目に共通の指定
  fields?: Partial<Record<TField, CharStyle | false>>; // 項目ごとの上書き。false なら当てない
}

export const CharStyle: {
  apply: (text: string, style: CharStyle) => string;
  merge: (base: CharStyle, override: CharStyle) => CharStyle;
  prepareFields: <TField extends string>(
    fieldNames: readonly TField[],
    style: FieldStyle<TField> | undefined,
  ) => (field: TField) => CharStyle | undefined;
};
```

- 型と値が同じ名前なので、`import { CharStyle } from '@arihirookazaki/normalize-core'` の1つで、型の注釈（`const style: CharStyle`）と関数の呼び出し（`CharStyle.apply(text, style)`）の両方に使える。index.ts に実装を置かない（規約 §2.5）ので、`CharStyle` の型・関数・`FieldStyle` は `domain/charStyle.ts` にまとめて置き、index.ts は再公開だけにする
- `apply` は、1コードポイントずつ、`chars` の指定 → その字のクラスの指定 → そのまま、の順で決める
- `full` は、ASCII の字を U+FF01〜U+FF5E（コードポイントに 0xFEE0 を足す）に、空白を U+3000 にする。`half` は変えない
- 省略したクラスは `half`
- `CharTarget` の `string & {}` は、`WidthMode | string` が `string` に畳まれて、エディタの補完から `half`・`full` が消えるのを防ぐため。受けられる値は `string` と同じ
- `merge` は、クラスは `override` を優先し、`chars` はキーごとにマージする（`override` にあるキーだけ上書き）
- `merge` は、`base`・`override` が配列でない object であること、それぞれの `chars` が（省略されていなければ）配列でない object であることを検査し、満たさなければ `TypeError` を投げる。`chars` はスプレッドで展開するので、文字列や配列を渡すと object に化けて、`apply` の検査をすり抜けるため。それ以外の検査は `apply`（と `prepareFields`）で行う

### 項目ごとの字形の指定（prepareFields）

正規化器が、結果の項目ごとに字形の指定を当てるときに使う（住所の `prefecture`・`city`…、郵便番号の `postalCode`）。正規化器の `create` のときに呼び、検査とマージを済ませておく。

- 返す関数は、項目の名前から、その項目に当てる字形の指定を返す。`fields[field]` が `false` なら `undefined`（字形の指定を当てない）、そうでなければ `merge(default ?? {}, fields[field] ?? {})` を検査したもの
- 検査とマージは呼んだときに全部済ませる。返す関数は検査をしない。マージした指定は新しい object なので、呼んだあとに利用者が `style` を書き換えても変わらない
- 検査（満たさなければ `TypeError`）。`style`・`default`・`fields` の検査のメッセージには `style.` の前置きが付く（正規化器のオプションの `style` をそのまま渡すため）。マージした指定の検査のメッセージは `apply` と同じ

| 検査                                                                           | メッセージ                                                                         |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `style` が（省略されていなければ）配列でない object                            | `style には object を指定してください`                                             |
| `style.default` が（省略されていなければ）配列でない object                    | `style.default には object を指定してください`                                     |
| `style.fields` が（省略されていなければ）配列でない object                     | `style.fields には object を指定してください`                                      |
| `style.fields` のキーが `fieldNames` のどれか                                  | `style.fields のキーには A・B を指定してください: x`                               |
| `style.fields` の値が（省略されていなければ）object または `false`             | `style.fields.X には object または false を指定してください`                       |
| `default`・`fields` の値の `chars` が（省略されていなければ）配列でない object | `base と override の chars には object を指定してください`（`merge` のメッセージ） |
| マージした指定が `apply` の検査を満たす                                        | `apply` と同じメッセージ（下記）                                                   |

- 検査の順は上の表のとおり。ただし下の2行（`chars` とマージした指定の検査）は、`fieldNames` の順に1項目ずつ「マージ（`chars` の検査）→ `apply` の検査」を続けて行う。前の項目が `apply` の検査で落ちると、後ろの項目の `chars` の誤りは報告されない
- 項目の一覧（`fieldNames`）は正規化器が持ち、`as const` のリテラルの配列で渡す（ただの `string[]` だと項目の名前の型が `string` に広がり、綴りの誤った名前を型の検査で止められず、黙って字形の指定を当てない扱いになる）。正規化器は、項目の型に足した項目を一覧に足し忘れないよう、自分の側で網羅を検査する

### 検査（`apply` の入口で `TypeError`）

- `chars` のキーと、文字列の値は、どちらも1コードポイント
- クラスの無い字（ASCII 以外、および制御文字 U+0000〜U+001F・U+007F）のキーに `half` / `full` を指定しない
- 値に使った字を、キーにしない（置き換えが連鎖しないように）
- 値が ASCII の字なら、その字は自分のクラスの指定（とそれを上書きする `chars`）で変わらないこと。2回かけても結果が変わらないようにするため
- 字が最終的に `full` になるとき（`chars` の指定が優先、無ければクラスの指定）、その字の全角形（U+FF01〜U+FF5E のうち該当するもの。空白なら U+3000）をキーにしない。`full` で作った字が2回目に置き換わらないようにするため
- 上を満たせば、同じ `style` で2回かけても結果は変わらない
