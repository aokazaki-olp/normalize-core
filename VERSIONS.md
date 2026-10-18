# 固定したバージョンとその理由

規約 §8.1 の「固定した版とその理由は `package.json` の隣に書く」に対応する。

## Node — `^24.12.0 || >=25.2.0`

確認日は 2026-09-27。

型注釈の除去が stable になった版を下限にする。v24.12.0 と v25.2.0 のリリースノートに「mark type stripping as stable」がある（v25.0.0・v25.1.0 には無い）。

- https://nodejs.org/en/blog/release/v24.12.0
- https://nodejs.org/en/blog/release/v25.2.0

## @types/node — `~24.12.0`

確認日は 2026-10-19（`npm view @types/node@'~24.12.0' version` で 24.12.4 が最新の 24.12 系）。

`engines` の下限に合わせる。新しい版の型を入れると、24.12 に無い API が型チェックを通ってしまう。

## TypeScript — `6.0.3`（キャレットなし）

確認日は 2026-10-19。

最新は 7.0.2（`npm view typescript dist-tags`）だが、typescript-eslint 8.71.2 の peerDependencies が `typescript: >=4.8.4 <6.1.0`（`npm view typescript-eslint@8.71.2 peerDependencies`）で、型情報を使う lint が 7 では動かない。規約 §8.1 の「型情報を使う lint が動く組み合わせを選ぶ」に従う。6.0 系の最新は 6.0.3（`npm view typescript@'>=6.0.0 <6.1.0' version`）。typescript-eslint が 7 に対応したら固定を外し、§8.3 の確認をやり直す。

## 解決した devDependencies の版

確認日は 2026-10-19。`package.json` の範囲の中で `npm update` し、`npm ls --depth=0` で確かめた。最新は `npm view <パッケージ> version` で確かめた。

| パッケージ             | 範囲       | 解決した版 | 最新    |
| ---------------------- | ---------- | ---------- | ------- |
| @eslint/js             | `^10.0.1`  | 10.0.1     | 10.0.1  |
| @types/node            | `~24.12.0` | 24.12.4    | 26.6.5  |
| eslint                 | `^10.11.0` | 10.13.0    | 10.13.0 |
| eslint-config-prettier | `^10.1.8`  | 10.1.8     | 10.1.8  |
| globals                | `^17.12.0` | 17.13.0    | 17.13.0 |
| prettier               | `^3.9.9`   | 3.9.10     | 3.9.10  |
| typescript             | `6.0.3`    | 6.0.3      | 7.0.2   |
| typescript-eslint      | `^8.70.1`  | 8.71.2     | 8.71.2  |

@types/node と typescript が最新でないのは、上の節の理由による。
