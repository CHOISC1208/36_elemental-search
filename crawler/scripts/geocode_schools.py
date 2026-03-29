"""
学校住所のジオコーディングスクリプト
国土地理院ジオコーダー API を使用（無料・APIキー不要）

使い方:
  uv run python crawler/scripts/geocode_schools.py
  uv run python crawler/scripts/geocode_schools.py --limit 100   # 件数を絞ってテスト
  uv run python crawler/scripts/geocode_schools.py --dry-run     # DBに書き込まず確認のみ
"""
import argparse
import time
import urllib.parse
import urllib.request
import json
import os
import sys
from pathlib import Path

# プロジェクトルートを sys.path に追加
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from supabase import create_client

SCHEMA = "36_elemental-search"
GSI_GEOCODE_URL = "https://msearch.gsi.go.jp/address-search/AddressSearch"
SLEEP_SEC = 0.3  # API への負荷を下げるためのウェイト


def geocode_address(address: str) -> tuple[float, float] | None:
    """
    国土地理院ジオコーダーで住所→緯度経度に変換。
    成功時: (latitude, longitude) を返す
    失敗時: None を返す
    """
    params = urllib.parse.urlencode({"q": address})
    url = f"{GSI_GEOCODE_URL}?{params}"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        if not data:
            return None
        # GeoJSON 形式: coordinates は [longitude, latitude]
        coords = data[0]["geometry"]["coordinates"]
        return float(coords[1]), float(coords[0])  # (lat, lng)
    except Exception as e:
        print(f"  [geocode error] {address}: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(description="学校住所のジオコーディング")
    parser.add_argument("--limit", type=int, default=0, help="処理件数上限（0=すべて）")
    parser.add_argument("--dry-run", action="store_true", help="DBに書き込まない")
    args = parser.parse_args()

    def load_env_file(path: Path):
        if path.exists():
            for line in path.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())

    # プロジェクトルートの .env → frontend/.env の順に読み込む
    load_env_file(project_root / ".env")
    load_env_file(project_root / "frontend" / ".env")
    load_env_file(project_root / "frontend" / ".env.local")

    url = (
        os.environ.get("SUPABASE_URL")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    )
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_SERVICE_KEY")
        or os.environ.get("SUPABASE_ANON_KEY")
    )

    if not url or not key:
        print("エラー: SUPABASE_URL / SUPABASE_SERVICE_KEY を .env または環境変数に設定してください")
        sys.exit(1)

    client = create_client(url, key)

    # 緯度経度が未設定の学校を全件取得（ページネーションで1000件上限を回避）
    PAGE_SIZE = 1000
    schools: list = []

    if args.limit > 0:
        resp = (
            client.schema(SCHEMA)
            .from_("schools")
            .select("school_id, school_name, prefecture, city, address")
            .is_("latitude", "null")
            .not_.is_("address", "null")
            .order("school_id")
            .limit(args.limit)
            .execute()
        )
        schools = resp.data or []
    else:
        offset = 0
        while True:
            resp = (
                client.schema(SCHEMA)
                .from_("schools")
                .select("school_id, school_name, prefecture, city, address")
                .is_("latitude", "null")
                .not_.is_("address", "null")
                .order("school_id")
                .range(offset, offset + PAGE_SIZE - 1)
                .execute()
            )
            page = resp.data or []
            schools.extend(page)
            print(f"  取得中: {len(schools)} 件...")
            if len(page) < PAGE_SIZE:
                break
            offset += PAGE_SIZE

    print(f"ジオコーディング対象: {len(schools)} 件")

    ok, ng = 0, 0
    for i, school in enumerate(schools, 1):
        sid = school["school_id"]
        name = school["school_name"]
        # address フィールドがすでに都道府県を含む場合が多いのでそのまま使用
        raw_addr = school.get("address") or ""
        pref = school.get("prefecture") or ""
        # address が都道府県名で始まっていない場合のみ先頭に追加
        if raw_addr and not raw_addr.startswith(pref):
            address = f"{pref}{raw_addr}"
        else:
            address = raw_addr or pref
        print(f"[{i}/{len(schools)}] {name} — {address}")

        result = geocode_address(address)
        if result:
            lat, lng = result
            print(f"  → lat={lat:.6f}, lng={lng:.6f}")
            if not args.dry_run:
                for attempt in range(5):
                    try:
                        client.schema(SCHEMA).from_("schools").update(
                            {"latitude": lat, "longitude": lng}
                        ).eq("school_id", sid).execute()
                        break
                    except Exception as e:
                        wait = 2 ** attempt
                        print(f"  [DB error attempt {attempt+1}/5] {e} — {wait}s後にリトライ")
                        time.sleep(wait)
                else:
                    print("  [DB error] リトライ上限に達しました。スキップします")
                    ng += 1
                    continue
            ok += 1
        else:
            print("  → ジオコーディング失敗")
            ng += 1

        time.sleep(SLEEP_SEC)

    print(f"\n完了: 成功={ok}, 失敗={ng}")
    if args.dry_run:
        print("（--dry-run モードのため DB への書き込みはしていません）")


if __name__ == "__main__":
    main()
