# QA-05：保存・重複警告・バックアップの画面検証

実施日：2026-09-25（日本時間）  
担当：qa_05_persistence / GPT-6 Luna・max  
画面操作：親エージェントがBrowser Useで実施。QA-05 workerは画面を操作せず、受領した操作結果と証跡を確認。

## 結果

パーティの編集保存・再読込、重複持ち物による保存拒否と旧保存値の維持、重複解消後の保存、空枠と複数の「もちものなし」の保存を確認しました。実際のUI書出し原本を読み込み、置換後の復元、不正なバックアップ形式と構文エラーを含むJSONの拒否も確認しました。追加レビューで見つかった保存失敗時の通知境界は小さな関数へ切り出してテストし、成功通知を保存処理の成功後に出すよう修正しました。変更後にパーティ保存、攻守履歴保存、バックアップ読込みの成功通知をBrowser Useで再確認し、QA-05のシナリオは合格です。実ブラウザで`localStorage.setItem`例外を注入する検証だけ未実施です。

## 環境と安全境界

- 対象オリジン：`http://127.0.0.1:5174/`。
- `http://127.0.0.1:5173/`は操作していません。
- テスト用の名前は`QA-05保存確認`です。QAパーティは2枠のみ使用し、4枠を空けています。
- 出力先は`output/qa/`です。保存JSONと画面証跡はQAデータです。

## シナリオと結果

### パーティ保存と再読込

手順：空のパーティ2を選択し、名前を`QA-05保存確認`に変更。1枠目へガブリアス（ID 445、きあいのタスキ）だけを追加して保存し、ページを再読込。

期待：名前、1枠目の個体と持ち物が残り、2〜6枠目は空のまま。

実際：保存完了通知の後、再読込後も名前とガブリアス／きあいのタスキが表示され、1/6体、残り5枠は空でした。親のBrowser Use観測。

判定：合格。

### 重複持ち物の拒否と旧保存値維持

手順：2枠目にカイリュー（ID 149）を追加し、1枠目と同じきあいのタスキを指定して保存。その後ページを再読込。

期待：保存を拒否し、重複した持ち物と該当枠を示す。保存済みの1体だけの値は書き換わらない。

実際：保存時に次の警告が表示されました。

> もちものが重複しています。きあいのタスキ（1枠目のガブリアス・2枠目のカイリュー）。もちものを変更してから保存してください。

再読込後も保存済みの`QA-05保存確認`、ガブリアス／きあいのタスキ、1/6体が維持されました。画面証跡は[party-duplicate.jpg](../../output/qa/party-duplicate.jpg)です（1280×720、SHA-256 `ec705cbab3d9abde347d45bf61e7f88d4aa3191893b4048f036fd3f0ef1bf6e8`）。

判定：合格。

### 重複解消、空枠、複数の「もちものなし」

手順：2枠目のカイリューをラムのみへ変更して保存し、再読込。次に1・2枠目の持ち物を両方「もちものなし」にして保存。

期待：重複警告が消え、2体と残りの空枠を保存できる。「もちものなし」は重複として扱わない。

実際：ラムのみへ変更後に保存・再読込でき、2/6体と2種類の持ち物が表示されました。その後、両方を「もちものなし」に変更した保存も成功しました。後続の実UI書き出しJSONにも2体と4つの`null`枠が記録されています。

判定：合格。

### JSON書き出しと読み込み確認

手順：UIの「書き出す」を押し、実際にダウンロードされたファイルを保存。パーティ名は`QA-05保存確認`、メンバーはガブリアスとカイリュー、持ち物は両方「もちものなし」、残り4枠は空の状態。

期待：保存済みの3パーティと攻守履歴を含む有効なJSONが出力される。読込確認に同じパーティ名・体数が表示される。

実際：UIのダウンロードイベントはタイムアウトしましたが、`~/Downloads/battle-note-backup.json`に実ファイルが作成されました。UIのラウンドトリップではこの未整形の実書出しファイルをchooserで読み込みました。versionは1で、QAパーティは2体、残り4枠は`null`、攻守履歴は各0件でした。

UI検証後に原本を[qa-05-export-backup.original.json](../../artifacts/qa/qa-05-export-backup.original.json)へbyte-identicalで保全しました。原本のSHA-256は`6ef35f130b77843ee6df5d7e8d7a99e50526550c72c96601b610df5bcf99bc39`です。その後、出力側の[qa-05-export-backup.json](../../output/qa/qa-05-export-backup.json)をPrettier整形しました。原本と整形コピーはJSONとして同一であることを`assert.deepStrictEqual`で確認しています。整形コピーのSHA-256は`a8b0e3bcb0647893fd7547ce868995852c2556d5bdd1f16cb40d48ff83ade536`です。読込確認モーダルの[backup-confirm.jpg](../../output/qa/backup-confirm.jpg)には、スタンダード6体、QA-05保存確認2体、パーティ3 0体の一覧が表示されています（1435×987、SHA-256 `30c190f05b5f7bcc0b3174ab482a7e5a3816a9ff8d63707f4253ef44dcf497ca`）。

保存済みのパーティ名を`QA-05変更後`へ変更して保存し、再読込後もその名前が残ることを確認してから、原本のJSONをchooserで選択しました。確認モーダルの「置き換えて読み込む」を押すと「バックアップを読み込みました」と通知され、さらに再読込後も`QA-05保存確認`、ガブリアスとカイリューの2体、両方の「もちものなし」、4つの空枠が復元されました。最終画面の[desktop-party-final.jpg](../../output/qa/desktop-party-final.jpg)は1435×987px（SHA-256 `8179eb60a8f3f5055c21fbdf8b919003513c8f64ac319ad99db99ba52d281a03`）です。Browser Useで測った`scrollWidth`も1435pxで、横はみ出しはありません。

判定：合格。

### 不正バックアップの拒否

画面読込用に[qa-05-invalid-backup.json](../../output/qa/qa-05-invalid-backup.json)を作成しました（SHA-256 `4b05a6021d8d518264e43cb798678e4e513c9a2d24ebc27b73f710bd6e9de82c`）。内容は`{"version":2}`で、JSON構文としては有効ですがBATTLE NOTEのバックアップ形式として不正です。

期待：chooser経由の読み込み後に拒否の通知を表示し、現在の保存済み値を維持する。

実際：Browser Useでfixtureを読み込むと「読み込めませんでした。BATTLE NOTEの有効なバックアップを選択してください。」と通知され、確認ダイアログは開きませんでした（dialog count 0）。その後再読込しても`QA-05保存確認`、2/6体、ガブリアスとカイリュー、両方の「もちものなし」が維持されました。

このfixtureはJSON構文としては有効で、`version: 2`の不正なバックアップ形状です。JSON構文エラーを含む別fixtureは[qa-05-malformed.json](../../artifacts/qa/qa-05-malformed.json)に用意し、ローカルの`JSON.parse`が失敗することを確認しました（SHA-256 `d750abad1f71593898231ce763437bdb2f2ed67bcf7237fac88bc38e5c149df8`）。

同じ構文エラーfixtureをBrowser Useで読み込むと、同じ拒否通知が表示され、確認ダイアログは開きませんでした（dialog count 0）。さらにページを再読込してもパーティ2の`QA-05保存確認`、2/6体、ガブリアスとカイリュー、両方の「もちものなし」が維持されました。

判定：不正なバックアップ形式とJSON構文エラーの拒否、保存値維持は合格。

## 自動テストとコード変更

保存処理を[src/persistence.ts](../../src/persistence.ts)の`writeSavedData`へ切り出しました。Appは引き続き`localStorage`の取得を外側の`try`内で行うため、storage getter自体が例外を投げる場合も同じ失敗通知へ収束します。書込みが成功した場合だけ保存成功通知を表示し、失敗時は成功通知を破棄して保存失敗通知を表示します。失敗後の成功ではエラー状態を解除します。

成功通知を保存完了後に表示する経路は、対戦計算時の攻守履歴保存、パーティ保存、バックアップ読込みの3つです。コード上、以前は永続化の成否を待たず成功通知を表示し、保存失敗の警告と成功通知が併存し得ました。現在は通知文を一時保持し、effectで書込み成功を確認してから表示します。

`tests/persistence.test.mjs`を追加し、許可時の正常保存、容量不足相当の例外時に既存値を維持、失敗後の次回成功、`persistenceAllowed=false`時に書込みしない条件を検証しました。例外テストは`setItem`だけを備えるStorage相当のdoubleを使用します。ブラウザの実`localStorage`へ容量不足を注入する操作は行っていません。

今回の全テスト81件、`npm run typecheck`、`npm run format:check`、`npm run build`はすべて成功しました。ビルドは500 kBを超えるchunkのサイズ警告を出しましたが、正常終了しました。変更後のコードを含む保存関連の対象テスト14件（既存10件と新規4件）も全件成功しました。QA-03では、同じ既存テストファイルを含む関連テスト29件が通過済みです。

親エージェントがコードレビュー後にBrowser Useで3経路を再確認しました。パーティ2を`QA-05最終保存`として保存すると「QA-05最終保存を保存しました」と通知され、alertはなく、再読込後も同じ名前と2/6体を保持しました。ダメージ計算では「ダメージを計算し、攻守の条件を履歴に保存しました」と通知され、alertはありませんでした。UI書出し原本を再度確認・置換で読み込むと「バックアップを読み込みました」と通知され、alertはなく、再読込後に`QA-05保存確認`の2/6体、ガブリアス／カイリュー、両方「もちものなし」の内容が復元されました。

## 変更・証跡ファイル

- QA-05レポート：[qa-05-persistence.md](qa-05-persistence.md)
- QA-05が作成した読込fixture：[qa-05-invalid-backup.json](../../output/qa/qa-05-invalid-backup.json)
- 構文エラー確認用fixture：[qa-05-malformed.json](../../artifacts/qa/qa-05-malformed.json)、SHA-256 `d750abad1f71593898231ce763437bdb2f2ed67bcf7237fac88bc38e5c149df8`
- UI書出し原本：[qa-05-export-backup.original.json](../../artifacts/qa/qa-05-export-backup.original.json)、SHA-256 `6ef35f130b77843ee6df5d7e8d7a99e50526550c72c96601b610df5bcf99bc39`
- 原本と同一内容の整形コピー：[qa-05-export-backup.json](../../output/qa/qa-05-export-backup.json)、SHA-256 `a8b0e3bcb0647893fd7547ce868995852c2556d5bdd1f16cb40d48ff83ade536`
- 重複警告：[party-duplicate.jpg](../../output/qa/party-duplicate.jpg)
- 読込確認モーダル：[backup-confirm.jpg](../../output/qa/backup-confirm.jpg)
- 復元後の最終画面：[desktop-party-final.jpg](../../output/qa/desktop-party-final.jpg)
- 保存書込み境界：[persistence.ts](../../src/persistence.ts)
- Appの書込み結果に応じた通知制御：[App.tsx](../../src/App.tsx)
- 保存境界の回帰テスト：[persistence.test.mjs](../../tests/persistence.test.mjs)

上記のQA-05成果物とコード差分を追加しました。スクリーンショットとダウンロード原本の取得・保存は親エージェントが行い、QA-05 workerは原本のbyte-identicalコピーを`artifacts/qa/`に保存しました。

## 未確認事項

- 実ブラウザの`localStorage.setItem`例外注入は未実施です。`setItem`の例外・旧値維持はStorage doubleでテストしました。ブラウザのquota failure時の次回起動後の旧値保持も未確認です。
