---
name: project_structure
description: ディレクトリ構成の方針とAuth0追加予定
type: project
---

ディレクトリを以下の構成に整理済み（2026-03-22）:
- `frontend/` — Next.js React アプリ
- `crawler/` — スクレイパー・データ処理・Streamlit管理UI（GitHub Actionsのメイン）
- `db/` — DBスキーマ・マイグレーションSQL（共通）
- `data/` — 生データ（共通）

**Why:** frontend と crawler のライフサイクルを分離し、Auth0認証追加を見据えた構成
**How to apply:** 新機能追加時はこの分離を維持する。Auth0はfrontendに追加予定。
