"""
minkou スクレイピングデータを Supabase に投入する
使い方:
    python scripts/load_to_supabase.py data/raw/shinjuku_fixed.json
    python scripts/load_to_supabase.py --all
"""

import json
import sys
import os
import glob
import argparse
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")


def get_client() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError(".env に SUPABASE_URL と SUPABASE_SERVICE_KEY を設定してください")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def clean_numeric(value, digits=2):
    """"-" や "" や None を None に変換し、数値文字列はfloatに変換"""
    if value is None or str(value).strip() in ("", "-", "なし", "N/A"):
        return None
    try:
        return round(float(str(value).strip()), digits)
    except ValueError:
        return None


def clean_int(value):
    if value is None or str(value).strip() in ("", "-"):
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def load_json(filepath: str) -> dict:
    with open(filepath, encoding="utf-8") as f:
        return json.load(f)


def upsert_schools(client: Client, schools: list) -> int:
    if not schools:
        return 0

    rows = []
    for s in schools:
        rows.append({
            "school_id":        s.get("school_id"),
            "school_name":      s.get("school_name"),
            "furigana":         s.get("furigana"),
            "prefecture":       s.get("prefecture"),
            "city":             s.get("city"),
            "address":          s.get("address"),
            "nearest_station":  s.get("nearest_station"),
            "school_type":      s.get("school_type"),
            "uniform":          s.get("uniform"),
            "lunch":            s.get("lunch"),
            "events":           s.get("events"),
            "tuition":          s.get("tuition"),
            "selection":        s.get("selection"),
            "selection_method": s.get("selection_method"),
            "rating_avg":       clean_numeric(s.get("rating_avg")),
            "review_count":     clean_int(s.get("review_count")),
        })

    # Supabaseのupsertはon_conflictでキーを指定する
    resp = (
        client.schema("36_elemental-search").table("schools")
        .upsert(rows, on_conflict="school_id")
        .execute()
    )
    return len(rows)


def upsert_reviews(client: Client, reviews: list, ratings_only: bool = False) -> int:
    if not reviews:
        return 0

    rows = []
    for r in reviews:
        review_url = r.get("review_url", "")
        if not review_url:
            continue  # URLなしはスキップ

        if ratings_only:
            # 評価フィールドのみ（テキストは含めないので既存データを上書きしない）
            rows.append({
                "school_id":       r.get("school_id"),
                "review_url":      review_url,
                "rating_overall":  clean_numeric(r.get("rating_overall"), 1),
                "rating_policy":   clean_numeric(r.get("rating_policy"), 1),
                "rating_class":    clean_numeric(r.get("rating_class"), 1),
                "rating_teacher":  clean_numeric(r.get("rating_teacher"), 1),
                "rating_facility": clean_numeric(r.get("rating_facility"), 1),
                "rating_access":   clean_numeric(r.get("rating_access"), 1),
                "rating_pta":      clean_numeric(r.get("rating_pta"), 1),
                "rating_events":   clean_numeric(r.get("rating_events"), 1),
            })
        else:
            rows.append({
                "school_id":       r.get("school_id"),
                "review_url":      review_url,
                "poster_type":     r.get("poster_type"),
                "enrollment_year": clean_int(r.get("enrollment_year")),
                "post_date":       r.get("post_date"),
                "title":           r.get("title"),
                "rating_overall":  clean_numeric(r.get("rating_overall"), 1),
                "rating_policy":   clean_numeric(r.get("rating_policy"), 1),
                "rating_class":    clean_numeric(r.get("rating_class"), 1),
                "rating_teacher":  clean_numeric(r.get("rating_teacher"), 1),
                "rating_facility": clean_numeric(r.get("rating_facility"), 1),
                "rating_access":   clean_numeric(r.get("rating_access"), 1),
                "rating_pta":      clean_numeric(r.get("rating_pta"), 1),
                "rating_events":   clean_numeric(r.get("rating_events"), 1),
                "text_overall":    r.get("text_overall"),
                "text_policy":     r.get("text_policy"),
                "text_class":      r.get("text_class"),
                "text_facility":   r.get("text_facility"),
                "text_access":     r.get("text_access"),
                "text_pta":        r.get("text_pta"),
                "text_events":     r.get("text_events"),
                "text_commute":    r.get("text_commute"),
                "text_motivation": r.get("text_motivation"),
                "exam_presence":   r.get("exam_presence"),
                "text_exam":       r.get("text_exam"),
            })

    if not rows:
        return 0

    resp = (
        client.schema("36_elemental-search").table("school_reviews")
        .upsert(rows, on_conflict="review_url", ignore_duplicates=not ratings_only)
        .execute()
    )
    return len(rows)


def process_file(filepath: str, client: Client):
    print(f"\n📂 {filepath}")
    data = load_json(filepath)

    schools = data.get("schools", [])
    reviews = data.get("reviews", [])

    print(f"  schools: {len(schools)}件 → Supabase upsert中...")
    n_schools = upsert_schools(client, schools)
    print(f"  ✓ {n_schools}件完了")

    print(f"  reviews: {len(reviews)}件 → Supabase upsert中...")
    n_reviews = upsert_reviews(client, reviews)
    print(f"  ✓ {n_reviews}件完了")


def main():
    parser = argparse.ArgumentParser(description="minkou JSONをSupabaseに投入")
    parser.add_argument("file", nargs="?", help="JSONファイルパス")
    parser.add_argument("--all", action="store_true",
                        help="data/raw/ 以下の全JSONを処理")
    args = parser.parse_args()

    client = get_client()

    if args.all:
        files = sorted(glob.glob("data/raw/*.json"))
        if not files:
            print("data/raw/ にJSONファイルが見つかりません")
            sys.exit(1)
        for f in files:
            process_file(f, client)
    elif args.file:
        process_file(args.file, client)
    else:
        parser.print_help()
        sys.exit(1)

    print("\n✅ 全処理完了")


if __name__ == "__main__":
    main()
