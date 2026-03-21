"""
minkou.jp × gaccom.jp 学校名寄せスクリプト
==========================================
schools テーブルと gaccom_schools テーブルを住所＋学校名の類似度で突き合わせ、
結果を school_links テーブルに格納する。

使い方:
    python scripts/match_schools.py               # 全データ対象
    python scripts/match_schools.py --pref 東京都  # 都道府県を絞り込み
    python scripts/match_schools.py --pref 関東    # 関東7都県
    python scripts/match_schools.py --dry-run      # DBに書き込まず結果を確認

前提:
    .env に SUPABASE_URL と SUPABASE_SERVICE_KEY が設定済みであること
    school_links テーブルが作成済みであること
"""

import os
import re
import sys
import argparse
import csv
from pathlib import Path
from datetime import datetime, timezone

import jaconv
from dotenv import load_dotenv
from rapidfuzz import fuzz
from rich.console import Console
from rich.table import Table
from supabase import create_client

load_dotenv()

SCHEMA = "36_elemental-search"
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

console = Console()

SCORE_HIGH  = 0.85  # 自動確定
SCORE_LOW   = 0.60  # 要レビュー下限

KANTO_PREF_NAMES = ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県"]

PREF_ALIASES = {
    "関東": KANTO_PREF_NAMES,
    "kanto": KANTO_PREF_NAMES,
}


# ─────────────────────────────────────────
# 正規化
# ─────────────────────────────────────────

def normalize_address(text: str) -> str:
    if not text or (isinstance(text, float)):
        return ""
    text = jaconv.z2h(text, kana=False, digit=True, ascii=True)
    # 都道府県除去
    text = re.sub(r'^(東京都|大阪府|京都府|.+?[都道府県])', '', text)
    # 市区町村除去
    text = re.sub(r'^.+?[市区町村郡]', '', text)
    # 表記ゆれ統一
    replacements = [
        (r'丁目?', '丁目'),
        (r'番地?', '番'),
        (r'号$', ''),
        (r'[ーｰ－‐−]', '-'),
        (r'\s+', ''),
        (r'（.*?）', ''),
        (r'\(.*?\)', ''),
    ]
    for pattern, repl in replacements:
        text = re.sub(pattern, repl, text)
    return text


def normalize_school_name(text: str) -> str:
    if not text or (isinstance(text, float)):
        return ""
    text = jaconv.z2h(text, kana=False, digit=True, ascii=True)
    # 設置者プレフィックス除去
    prefixes = [
        r'^.{2,6}[都道府県].{1,6}[市区町村]立',
        r'^.{1,6}[市区町村郡]立',
        r'^[国私公]立',
    ]
    for p in prefixes:
        text = re.sub(p, '', text)
    # 「第○小学校」→核心部だけ残す
    text = re.sub(r'第?\d*小学校$', '', text)
    text = text.replace(' ', '').replace('　', '')
    return text


# ─────────────────────────────────────────
# スコア計算
# ─────────────────────────────────────────

def calc_match_score(s: dict, g: dict) -> dict:
    addr_score = fuzz.token_sort_ratio(
        normalize_address(s.get("address", "")),
        normalize_address(g.get("address", ""))
    ) / 100.0

    name_score = fuzz.ratio(
        normalize_school_name(s.get("school_name", "")),
        normalize_school_name(g.get("school_name", ""))
    ) / 100.0

    total = addr_score * 0.7 + name_score * 0.3

    return {
        "addr_score":  round(addr_score, 3),
        "name_score":  round(name_score, 3),
        "match_score": round(total, 3),
    }


# ─────────────────────────────────────────
# Supabase
# ─────────────────────────────────────────

def get_client():
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError(".env に SUPABASE_URL と SUPABASE_SERVICE_KEY を設定してください")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def fetch_schools(client, pref_names: list[str] | None) -> list[dict]:
    q = client.schema(SCHEMA).table("schools").select(
        "school_id, school_name, address, prefecture, city"
    )
    if pref_names:
        q = q.in_("prefecture", pref_names)
    return q.execute().data


def fetch_gaccom_schools(client, pref_names: list[str] | None) -> list[dict]:
    q = client.schema(SCHEMA).table("gaccom_schools").select(
        "gaccom_id, school_name, address, pref_name"
    )
    if pref_names:
        q = q.in_("pref_name", pref_names)
    return q.execute().data


def upsert_links(client, rows: list[dict]):
    client.schema(SCHEMA).table("school_links").upsert(
        rows, on_conflict="school_id,gaccom_id"
    ).execute()


# ─────────────────────────────────────────
# マッチング
# ─────────────────────────────────────────

def match_pref(pref: str, schools: list[dict], gaccom_schools: list[dict]) -> tuple[list, list]:
    """1都道府県分のマッチングを実行し (links, review_candidates) を返す"""
    links = []
    review = []

    for s in schools:
        best = None
        for g in gaccom_schools:
            # 両方とも名前・住所が空なら skip
            if not s.get("school_name") and not s.get("address"):
                continue
            if not g.get("school_name") and not g.get("address"):
                continue

            scores = calc_match_score(s, g)
            if scores["match_score"] < SCORE_LOW:
                continue

            if best is None or scores["match_score"] > best["match_score"]:
                best = {**scores, "school_id": s["school_id"], "gaccom_id": g["gaccom_id"]}
                best["_s"] = s
                best["_g"] = g

        if best is None:
            continue

        link = {
            "school_id":  best["school_id"],
            "gaccom_id":  best["gaccom_id"],
            "match_score": best["match_score"],
            "addr_score":  best["addr_score"],
            "name_score":  best["name_score"],
            "verified":    False,
            "created_at":  datetime.now(timezone.utc).isoformat(),
        }
        links.append(link)

        if best["match_score"] < SCORE_HIGH:
            review.append({
                "school_id":          best["school_id"],
                "school_name_minkou": best["_s"].get("school_name", ""),
                "address_minkou":     best["_s"].get("address", ""),
                "gaccom_id":          best["gaccom_id"],
                "school_name_gaccom": best["_g"].get("school_name", ""),
                "address_gaccom":     best["_g"].get("address", ""),
                "addr_score":         best["addr_score"],
                "name_score":         best["name_score"],
                "match_score":        best["match_score"],
            })

    return links, review


# ─────────────────────────────────────────
# メイン
# ─────────────────────────────────────────

def resolve_pref_names(pref_arg: str | None) -> list[str] | None:
    if not pref_arg:
        return None
    if pref_arg in PREF_ALIASES:
        return PREF_ALIASES[pref_arg]
    return [pref_arg]


def main():
    parser = argparse.ArgumentParser(description="minkou × gaccom 学校名寄せ")
    parser.add_argument("--pref", default=None,
                        help="都道府県名（例: 東京都 / 関東）。省略時は全件")
    parser.add_argument("--dry-run", action="store_true",
                        help="DBに書き込まず結果をコンソールに表示")
    args = parser.parse_args()

    pref_names = resolve_pref_names(args.pref)

    client = get_client()

    with console.status("schools テーブルを取得中..."):
        schools = fetch_schools(client, pref_names)
    with console.status("gaccom_schools テーブルを取得中..."):
        gaccom = fetch_gaccom_schools(client, pref_names)

    console.print(f"  minkou: [cyan]{len(schools)}校[/cyan]  gaccom: [cyan]{len(gaccom)}校[/cyan]")

    # 都道府県でグルーピング（全件総当たりを防ぐ）
    from collections import defaultdict
    schools_by_pref: dict[str, list] = defaultdict(list)
    for s in schools:
        schools_by_pref[s.get("prefecture", "")].append(s)

    gaccom_by_pref: dict[str, list] = defaultdict(list)
    for g in gaccom:
        gaccom_by_pref[g.get("pref_name", "")].append(g)

    all_links: list[dict] = []
    all_review: list[dict] = []

    target_prefs = sorted(set(schools_by_pref.keys()) & set(gaccom_by_pref.keys()))

    for pref in target_prefs:
        s_list = schools_by_pref[pref]
        g_list = gaccom_by_pref[pref]
        console.print(f"  [bold]{pref}[/bold]  minkou={len(s_list)}  gaccom={len(g_list)}")

        links, review = match_pref(pref, s_list, g_list)
        all_links.extend(links)
        all_review.extend(review)

        high = sum(1 for l in links if l["match_score"] >= SCORE_HIGH)
        low  = len(links) - high
        console.print(f"    → 高信頼: [green]{high}件[/green]  要確認: [yellow]{low}件[/yellow]")

    # 要レビュー CSV 出力
    if all_review:
        csv_path = Path("review_candidates.csv")
        fieldnames = [
            "school_id", "school_name_minkou", "address_minkou",
            "gaccom_id", "school_name_gaccom", "address_gaccom",
            "addr_score", "name_score", "match_score",
        ]
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(all_review)
        console.print(f"\n  要確認リスト → [cyan]{csv_path}[/cyan]  ({len(all_review)}件)")

    # DB書き込み
    if not args.dry_run:
        if all_links:
            with console.status(f"school_links に {len(all_links)} 件を UPSERT 中..."):
                upsert_links(client, all_links)
        console.print(f"\n[bold green]✅ 完了  合計 {len(all_links)} 件を格納[/bold green]  "
                      f"（高信頼: {sum(1 for l in all_links if l['match_score'] >= SCORE_HIGH)}件 / "
                      f"要確認: {len(all_review)}件）")
    else:
        # dry-run: 上位20件をテーブル表示
        console.print("\n[bold yellow]--- dry-run: 上位20件 ---[/bold yellow]")
        table = Table(show_header=True, header_style="bold")
        for col in ["match", "addr", "name", "minkou校名", "gaccom校名"]:
            table.add_column(col)
        for l in sorted(all_links, key=lambda x: -x["match_score"])[:20]:
            s_name = next((s["school_name"] for s in schools if s["school_id"] == l["school_id"]), "")
            g_name = next((g["school_name"] for g in gaccom if g["gaccom_id"] == l["gaccom_id"]), "")
            table.add_row(
                str(l["match_score"]), str(l["addr_score"]), str(l["name_score"]),
                s_name, g_name,
            )
        console.print(table)
        console.print(f"\n[bold yellow]dry-run 完了  {len(all_links)} 件マッチ（DB未書込）[/bold yellow]")


if __name__ == "__main__":
    main()
