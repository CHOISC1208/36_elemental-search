"""
都道府県名・市区町村名を引数にして minkou.jp をスクレイピングし Supabase に格納する

使い方:
    python scrapers/minkou/run.py --pref 東京都 --city 新宿区
    python scrapers/minkou/run.py --pref 東京都          # 都道府県全体
    python scrapers/minkou/run.py --pref tokyo --city 13104  # slug/codeでも可

前提:
    fetch_locations.py を先に実行して prefectures/cities テーブルを埋めておくこと
"""

import sys
import os
import time
import argparse
import requests
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

sys.path.insert(0, str(Path(__file__).parent))
from scraper import get_school_links, get_all_reviews, get_soup, parse_school_info
from load_to_supabase import upsert_schools, upsert_reviews

load_dotenv()

SCHEMA = "36_elemental-search"
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")


def get_client():
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError(".env に SUPABASE_URL と SUPABASE_SERVICE_KEY を設定してください")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def resolve_pref_slug(pref: str, client) -> str:
    """都道府県名（'東京都'）またはスラッグ（'tokyo'）をスラッグに解決する"""
    rows = client.schema(SCHEMA).table("prefectures").select("slug,name").execute().data
    for row in rows:
        if row["slug"] == pref or row["name"] == pref:
            return row["slug"]
    raise ValueError(
        f"都道府県が見つかりません: '{pref}'\n"
        "先に fetch_locations.py を実行してDBを埋めてください"
    )


def resolve_city_code(city: str, pref_slug: str, client) -> str:
    """市区町村名（'新宿区'）またはコード（'13104'）をコードに解決する"""
    if city.isdigit():
        return city
    rows = (
        client.schema(SCHEMA).table("cities")
        .select("city_code,name")
        .eq("prefecture_slug", pref_slug)
        .execute()
        .data
    )
    for row in rows:
        if row["name"] == city:
            return row["city_code"]
    raise ValueError(
        f"市区町村が見つかりません: '{city}'\n"
        "先に fetch_locations.py を実行してDBを埋めてください"
    )


def main():
    parser = argparse.ArgumentParser(description="minkou.jp スクレイピング → Supabase格納")
    parser.add_argument("--pref", required=True,
                        help="都道府県名またはスラッグ（例: 東京都 / tokyo）")
    parser.add_argument("--city", default=None,
                        help="市区町村名またはコード（例: 新宿区 / 13104）省略時は都道府県全体")
    parser.add_argument("--delay", type=float, default=1.5,
                        help="アクセス間隔（秒、デフォルト: 1.5）")
    args = parser.parse_args()

    client = get_client()
    session = requests.Session()

    pref_slug = resolve_pref_slug(args.pref, client)
    city_code = resolve_city_code(args.city, pref_slug, client) if args.city else None

    label = args.pref + (f" / {args.city}" if args.city else "（全体）")
    print(f"\n=== minkou スクレイパー ===")
    print(f"対象: {label}  (slug={pref_slug}, city_code={city_code})")
    print(f"アクセス間隔: {args.delay}秒\n")

    print("[Step 1] 学校一覧収集...")
    schools = get_school_links(pref_slug, city_code, session)
    print(f"→ {len(schools)} 校\n")

    all_schools = []
    all_reviews = []

    for i, school in enumerate(schools, 1):
        sid = school["school_id"]
        print(f"[{i}/{len(schools)}] {school['school_name']} (ID:{sid})")

        time.sleep(args.delay)
        soup = get_soup(school["school_url"], session)
        if soup:
            info = parse_school_info(soup, sid, school["school_url"])
            all_schools.append(info)
            print(f"  基本情報 ✓  評価:{info['rating_avg']}  口コミ:{info['review_count']}件")
        else:
            all_schools.append({"school_id": sid})

        time.sleep(args.delay)
        reviews = get_all_reviews(sid, session, args.delay)
        all_reviews.extend(reviews)
        print(f"  口コミ ✓  {len(reviews)}件")

    print(f"\n[Step 2] Supabase格納...")
    n_schools = upsert_schools(client, all_schools)
    n_reviews = upsert_reviews(client, all_reviews)
    print(f"  schools: {n_schools}件 ✓")
    print(f"  reviews: {n_reviews}件 ✓")
    print(f"\n✅ 完了")


if __name__ == "__main__":
    main()
