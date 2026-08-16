# datapack-crossref

Minecraft データパック内のファイル間の参照関係(クロスリファレンス)を解析し、`.mcfunction` ファイルの先頭に参照元一覧をヘッダーとして自動挿入する VSCode 拡張機能です。

## Features

- データパック内の `function` / `tags/function` / `advancement` / `dialog` / `enchantment` / `loot_table` / `recipe` / `item_modifier` を横断的にスキャンし、「どのファイルがどの `.mcfunction` を呼び出しているか」を解析します。
- 解析結果をもとに、各 `.mcfunction` ファイルの先頭に参照元一覧のヘッダーコメントを自動挿入します。

  ```.mcfunction
  #|| --- CrossRefs --- ||#
  #|| @minecraft:example/main
  #||
  #||     # function
  #||         @minecraft:example/caller
  #|| ------ End ------ ||#
  ```

- ヘッダー内の参照元パスはドキュメントリンクとして扱われ、クリックすると該当ファイルへジャンプできます。
- 挿入したヘッダーは、専用コマンドで一括削除することもできます。

## Requirements

- 対象ワークスペースのルートに `pack.mcmeta` が存在する、Minecraft データパックのプロジェクト構成であること。
- ワークスペース内に `data/<namespace>/...` の形式でファイルが配置されていること。

追加の外部依存関係はありません。

## Commands

このコマンドはコマンドパレット(`Cmd+Shift+P` / `Ctrl+Shift+P`)から実行できます。

| コマンド | 説明 |
| --- | --- |
| `datapack-crossref: scanDatapack` | データパック内のファイルをスキャンし、パス辞書を再構築します。 |
| `datapack-crossref: makeCrossRef` | 参照関係を解析し、各 `.mcfunction` ファイルにヘッダーを挿入・更新します。 |
| `datapack-crossref: removeCrossRef` | 挿入済みのヘッダーを全ファイルから削除します。 |

> **Note:** ヘッダーの生成・更新は上記コマンドの手動実行によってのみ行われます。ファイル保存時の自動実行には対応していません。

## Extension Settings

現時点で `contributes.configuration` によるユーザー設定はありません。

## Known Issues

- 大規模なデータパックでは、`scanDatapack` / `makeCrossRef` の実行に時間がかかる場合があります。
- JSON ファイルの構造が不正な場合、該当ファイルはエラーメッセージとともにスキップされます。

## Release Notes

### 0.1.0

初回リリース。データパックのスキャン、クロスリファレンスヘッダーの挿入・削除、ドキュメントリンク機能を実装。

---

**Enjoy!**
