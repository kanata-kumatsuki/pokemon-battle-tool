# 無料で使える画像生成手段の比較

調査日：2026-10-04。各提供元の公式サイト、公式サポート、公式モデルカードを確認。アカウント登録、インストール、ダウンロード、生成、APIキー利用、購入はしていない。

## 結論

Macで費用を発生させずに一般的な画像制作を試すなら、第一候補は[Draw Thingsのローカル生成](https://drawthings.ai/pricing/)。公式の無料版は端末内で生成し、モデルも配布元から取得できる。アカウント利用やクラウド生成を使わずに済む。ワークフローを細かく組みたい場合は[ComfyUIのローカル版](https://support.comfy.org/articles/9806306061-about-comfy)も無料だが、モデルの配置など導入作業が多く、Comfyの案内はApple GPU上での速度制約にも触れている。

無料Web版ではAdobe Fireflyが日次の無料生成を提供するが、回数と対象モデルは変動する。Microsoft Designerは無料だが個人・非商用利用の条件が明記されている。Bing Image Creatorは別サービスで、無料の高速生成枠の後も低速生成を無料で使える一方、現行規約から商用利用の許可を明確に確認できなかった。

ここでいう無料はサービス利用料・生成課金がかからないことを指し、ローカル実行では端末の電力とモデル・画像の保存容量が必要。

## 候補

| 候補 | 無料範囲と有料境界 | Macとの相性・Codex連携 |
|---|---|---|
| **[Draw Things](https://drawthings.ai/pricing/)** | 無料版はモデルを取得して端末内で生成する。料金ページには別枠として無料アカウントのCloud Computeと、月額$8.99のDraw Things+（クラウド上限増加、追加ブースト等）が掲載されている。ローカル生成にクレジット課金枠は記載されていない。自動課金へ切り替わる挙動は確認できないため、使うなら無料版のローカル生成に限定する。 | [macOSアプリ](https://apps.apple.com/us/app/draw-things-offline-ai-art/id6444050820)で、端末内・オフライン生成を案内。Mac向け候補。Codexからの操作は未確認。 |
| **[ComfyUI / Comfy Desktop](https://support.comfy.org/articles/9806306061-about-comfy)** | ComfyUI本体のローカル実行は無料。Comfy Cloudは[公式ページ](https://comfy.org/cloud)で月額$20からのプラン、[Comfy MCP案内](https://support.comfy.org/articles/4321955727-agent-tools-mcp-comfy-cloud-mcp)では新規向け5回の試用後に有効なCloud契約が必要と説明。Partner Nodesはクレジットを使う。無料範囲を守るならローカルのみを使う。 | [公式デスクトップ版](https://docs.comfy.org/installation/desktop/macos)はmacOS 13以降・Apple Silicon（M1以降）向け。インストールに約4.85GBを推奨し、モデル容量は別途必要。[Comfy MCP](https://support.comfy.org/articles/4321955727-agent-tools-mcp-comfy-cloud-mcp)はCodex対応を案内しているが、ローカル接続にはComfyUI等の導入が必要。本環境では接続も操作も未確認。公式案内は現在のオープンウェイトモデルがMacのApple GPUで実用速度になりにくい場合があるとしている。 |
| **[Adobe Firefly（Web）](https://helpx.adobe.com/creative-cloud/apps/generative-ai/generative-credits-faq.html)** | 無料利用者には、対象モデルを限定した日次の無料生成枠がある。回数・機能・モデルは変更されると公式FAQに明記され、固定回数は確認できない。追加生成には有料プランへの加入が案内される。上限到達時の自動課金は公式FAQから確認できなかった。 | Webサービス。[商用利用条件](https://helpx.adobe.com/firefly/web/get-started/learn-the-basics/adobe-firefly-faq.html)は機能ごとに確認が必要。Adobeアカウントや課金操作の要否を実地確認していない。Codexからの操作は未確認。 |
| **[Microsoft Designer（Web）](https://support.microsoft.com/en-us/designer/frequently-asked-questions-about-microsoft-designer)** | 無料で利用でき、より頻繁な利用にはサブスクリプションが必要な場合がある。MicrosoftはDesignerを個人・非商用利用向けと案内している。上限や自動課金の詳しい条件は未確認。 | Webサービス。Microsoftアカウントが必要。Codexからの操作は未確認。 |
| **[Bing Image Creator（Web）](https://www.microsoft.com/en-us/bing/features/bing-image-creator/)** | Designerとは別サービス。[個別規約](https://www.bing.com/new/termsofuseimagecreator)で2026年3月更新を確認。Microsoftアカウントで無料利用でき、高速生成は1日15回。使い切ると標準速度へ自動で移り、無料で継続できる。高速生成にMicrosoft Rewardsポイントを使う設定は任意で、設定を有効にするとポイントを消費する。ポイント利用は有効にしない。 | Webサービス。Microsoftアカウントが必要。Codexからの操作は未確認。 |

## 権利と費用の見方

ツールの無料・有料条件と、生成モデルのライセンス、出力画像に含まれる第三者の権利は別に確認する。ローカル生成でもモデルごとの利用条件があり、たとえばStability AIのSDXL BaseモデルカードはCreativeML Open RAIL++-Mを指定している。モデルを選ぶ際は、そのモデルカードとライセンス本文を確認する。

Fireflyはベータ表示のない機能の出力を商用プロジェクトで使えると説明しているが、これは既存IPの許諾を与えるものではない。Bing Image Creatorも、Microsoftが出力の第三者権利非侵害を保証しないと規約に記載している。Designerについては個人・非商用条件がある。いずれの生成サービスも、ポケモン等の既存キャラクターに関する権利を解決しない。本プロジェクトへの掲載可否は、生成ツールの利用条件とは分けて判断する必要がある。

本調査は一般的な無料制作手段の比較に限る。既存の安全性拒否を回避する候補探し、回避用プロンプト、実際の生成確認は行っていない。元画像の品質や全ポケモンの再現性も未検証で、保証はできない。

## 公式情報

- [Draw Things 料金・エディション](https://drawthings.ai/pricing/)、[公式ダウンロード・更新情報](https://drawthings.ai/downloads/)、[App Store掲載ページ](https://apps.apple.com/us/app/draw-things-offline-ai-art/id6444050820)
- [ComfyUIについて：ローカル版と有料サービス](https://support.comfy.org/articles/9806306061-about-comfy)、[macOS要件とインストール容量](https://docs.comfy.org/installation/desktop/macos)、[Comfy Cloud料金](https://comfy.org/cloud)、[Codexを含むComfy MCP接続と料金](https://support.comfy.org/articles/4321955727-agent-tools-mcp-comfy-cloud-mcp)
- [Adobe Firefly生成クレジットFAQ](https://helpx.adobe.com/creative-cloud/apps/generative-ai/generative-credits-faq.html)、[Adobe Firefly FAQ（商用利用）](https://helpx.adobe.com/firefly/web/get-started/learn-the-basics/adobe-firefly-faq.html)
- [Microsoft Designer FAQ](https://support.microsoft.com/en-us/designer/frequently-asked-questions-about-microsoft-designer)、[Designer Web利用規約](https://designer.microsoft.com/termsOfUse.pdf)
- [Bing Image Creatorの無料枠](https://www.microsoft.com/en-us/bing/features/bing-image-creator/)、[Bing Image Creator個別規約（2026年3月更新）](https://www.bing.com/new/termsofuseimagecreator)
- [Stability AI公式SDXL Baseモデルカード](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0)
