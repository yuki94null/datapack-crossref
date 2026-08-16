# Change Log

All notable changes to the "datapack-crossref" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [0.0.1] - 2026-08-16

### Added

- Minecraft データパック内のファイル(`function` / `tags/function` / `advancement` / `dialog` / `enchantment` / `loot_table` / `recipe` / `item_modifier`)を横断的にスキャンし、参照関係を解析する機能
- 解析結果をもとに、`.mcfunction` ファイル先頭へ参照元一覧のヘッダーコメントを自動挿入する機能
- ヘッダー内の参照元パスをクリック可能なドキュメントリンクとして表示する機能
- `datapack-crossref.scanDatapack` / `datapack-crossref.makeCrossRef` / `datapack-crossref.removeCrossRef` コマンドを追加
