# ポケモンの全身イラスト

取得・目視確認日：2026-09-20。全358フォームのPNGを `public/pokemon/artwork/` に保存し、外部通信なしで表示する。選択・対戦・パーティ・履歴・すばやさ一覧で同じ画像を使う。名称・画像の権利は各権利者に帰属する。

## 出典

- 355フォーム：[PokeAPI/sprites の official-artwork](https://github.com/PokeAPI/sprites/tree/master/sprites/pokemon/other/official-artwork)。リザードン・ガブリアスと同系統の全身イラストを、メガシンカやリージョンフォームにも使用する。
- ビビヨン（ファンシー）：[Bulbagarden Archives の公式イラスト](https://archives.bulbagarden.net/wiki/File:0666Vivillon-Fancy.png)。
- ビビヨン（ボール）：[Bulbagarden Archives の公式イラスト](https://archives.bulbagarden.net/wiki/File:0666Vivillon-Pok%C3%A9_Ball.png)。
- ミミッキュ（ばれたすがた）：[Pokémon Database掲載のGlobal Link公式イラスト](https://pokemondb.net/artwork/mimikyu)。同系統のSugimoriイラストを確認できなかったため、この1フォームは画風が異なる。ドット絵は使用しない。

取得元URL、画像サイズ、SHA-256、フォームIDとPokeAPIの対応は `src/generated/artwork.json` に記録する。画面の「このツールについて」にも画像集の出典を掲載する。

ポットデス（しんさく／がんさく）、ヤバソチャ（タカイモノ／マガイモノ）は、通常の絵で見えない底面の印が違いのため、同じ種族のイラストを共有する。イッカネズミの3びき／4ひき、通常ニャオニクスの性別、メガX／Y／Zは別画像で対応する。パンプジンのサイズ違いとメガニャオニクスの性別は、取得元が同一のアートワークを提供しているため共通の絵を使用する。

## 更新

```sh
node scripts/generate-artwork.mjs
npm test
```

`src/generated/battle-catalog.json` の全フォームを対象とする。PokeAPIの `pokemon.csv` と `scripts/artwork-aliases.json` を使って名前を対応付け、例外の出典は `scripts/artwork-supplements.json` に明記する。CSVを事前取得した場合は第1引数にそのパスを渡せる。

既存画像は出典URLとSHA-256が前回の記録に一致すれば再利用する。URL変更・ファイル欠落・チェックサム不一致の場合は再取得する。同じURLの画像を更新したい場合は対象PNGを別場所へ退避してから再実行する。画像が不足している場合は全件の不足を報告し、マニフェストは更新しない。生成JSONとPNGは手編集しない。

全カタログ・すばやさ一覧の画像対応、PNG実体、サイズ、チェックサム、フォーム違いを自動テストする。画像は加工せず、CSSの `object-fit: contain` で枠内に表示し、一覧では遅延読込する。

以前の `public/pokemon/` 直下の画像・アイコンシートは残しているが、現行UIでは使用しない。
