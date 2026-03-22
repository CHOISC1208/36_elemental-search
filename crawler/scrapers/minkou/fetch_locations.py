"""
minkou.jp から全都道府県・市区町村をスクレイピングして Supabase に格納する

使い方:
    python scrapers/minkou/fetch_locations.py              # 全都道府県
    python scrapers/minkou/fetch_locations.py --pref tokyo # 特定都道府県のみ
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
from scraper import fetch_cities

load_dotenv()

SCHEMA = "36_elemental-search"
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

# 正式名称（都道府県） → スラッグ
PREF_SLUGS = {
    "北海道": "hokkaido", "青森県": "aomori", "岩手県": "iwate", "宮城県": "miyagi",
    "秋田県": "akita", "山形県": "yamagata", "福島県": "fukushima", "茨城県": "ibaraki",
    "栃木県": "tochigi", "群馬県": "gunma", "埼玉県": "saitama", "千葉県": "chiba",
    "東京都": "tokyo", "神奈川県": "kanagawa", "新潟県": "niigata", "富山県": "toyama",
    "石川県": "ishikawa", "福井県": "fukui", "山梨県": "yamanashi", "長野県": "nagano",
    "岐阜県": "gifu", "静岡県": "shizuoka", "愛知県": "aichi", "三重県": "mie",
    "滋賀県": "shiga", "京都府": "kyoto", "大阪府": "osaka", "兵庫県": "hyogo",
    "奈良県": "nara", "和歌山県": "wakayama", "鳥取県": "tottori", "島根県": "shimane",
    "岡山県": "okayama", "広島県": "hiroshima", "山口県": "yamaguchi", "徳島県": "tokushima",
    "香川県": "kagawa", "愛媛県": "ehime", "高知県": "kochi", "福岡県": "fukuoka",
    "佐賀県": "saga", "長崎県": "nagasaki", "熊本県": "kumamoto", "大分県": "oita",
    "宮崎県": "miyazaki", "鹿児島県": "kagoshima", "沖縄県": "okinawa",
}

# スラッグ → 正式名称（逆引き）
SLUG_TO_NAME = {v: k for k, v in PREF_SLUGS.items()}


def get_client():
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError(".env に SUPABASE_URL と SUPABASE_SERVICE_KEY を設定してください")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def main():
    parser = argparse.ArgumentParser(description="都道府県・市区町村をスクレイピングしてSupabaseに格納")
    parser.add_argument("--pref", default=None,
                        help="都道府県スラッグのみ処理（例: tokyo）省略時は全都道府県")
    args = parser.parse_args()

    client = get_client()
    db = client.schema(SCHEMA)
    session = requests.Session()

    if args.pref:
        if args.pref not in SLUG_TO_NAME:
            print(f"不明なスラッグ: {args.pref}")
            print("利用可能:", ", ".join(SLUG_TO_NAME.keys()))
            sys.exit(1)
        targets = {args.pref: SLUG_TO_NAME[args.pref]}
    else:
        targets = SLUG_TO_NAME  # slug → name

    all_prefectures = []
    all_cities = []

    for i, (slug, name) in enumerate(targets.items(), 1):
        print(f"[{i:02d}/{len(targets)}] {name} ({slug})...", end=" ", flush=True)
        cities_dict = fetch_cities(slug, session)
        print(f"{len(cities_dict)}市区町村")

        all_prefectures.append({"slug": slug, "name": name})
        for city_name, city_code in cities_dict.items():
            all_cities.append({
                "city_code":       city_code,
                "name":            city_name,
                "prefecture_slug": slug,
            })

        time.sleep(1.2)

    print(f"\n都道府県: {len(all_prefectures)}件 → upsert中...")
    db.table("prefectures").upsert(all_prefectures, on_conflict="slug").execute()
    print("  ✓ 完了")

    print(f"市区町村: {len(all_cities)}件 → upsert中...")
    batch_size = 500
    for i in range(0, len(all_cities), batch_size):
        batch = all_cities[i:i + batch_size]
        db.table("cities").upsert(batch, on_conflict="city_code").execute()
        print(f"  {min(i + batch_size, len(all_cities))}/{len(all_cities)}件完了")

    print("\n✅ 全処理完了")


if __name__ == "__main__":
    main()
