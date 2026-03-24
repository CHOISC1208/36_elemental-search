"""
schools テーブルの prefecture / address フィールドをクリーニングする

修正内容:
  1. address から地図UIテキスト（「ここに地図が表示されます」等）を除去
  2. prefecture を address から正しい値（接尾辞なし）に修正
     例: "茨城県の小学校" → "茨城"
"""

import os
import re
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SCHEMA = "36_elemental-search"

PREF_PATTERN = re.compile(
    r"^(北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|"
    r"埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|"
    r"岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|"
    r"鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|"
    r"佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)"
)
PREF_STRIP = re.compile(r"(都|道|府|県)$")

# 住所に混入する地図UIテキスト
_MAP_TEXT_RE = re.compile(r'\s*(ここに地図が表示されます|地図を見る|地図を閉じる).*', re.DOTALL)


def clean_address(address: str) -> str:
    if not address:
        return address
    return _MAP_TEXT_RE.sub("", address).strip()


def extract_pref_from_address(address: str) -> str | None:
    """クリーニング済みのaddressから都道府県名（接尾辞なし）を抽出する"""
    if not address:
        return None
    cleaned = address.replace(" ", "").replace("\u3000", "")
    m = PREF_PATTERN.match(cleaned)
    if not m:
        return None
    return PREF_STRIP.sub("", m.group(1))


def main():
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    client = create_client(url, key)

    # 全件取得（ページング）
    all_rows = []
    offset = 0
    while True:
        r = (
            client.schema(SCHEMA)
            .table("schools")
            .select("school_id,prefecture,address")
            .range(offset, offset + 999)
            .execute()
        )
        all_rows.extend(r.data)
        if len(r.data) < 1000:
            break
        offset += 1000

    print(f"総件数: {len(all_rows)}件")

    updates = []
    skipped = 0

    for row in all_rows:
        raw_address = row.get("address") or ""
        cleaned_addr = clean_address(raw_address)
        pref = extract_pref_from_address(cleaned_addr)

        addr_changed = cleaned_addr != raw_address
        pref_changed = pref is not None and row.get("prefecture") != pref

        if not addr_changed and not pref_changed:
            if pref is None:
                skipped += 1
            continue

        patch: dict = {"school_id": row["school_id"]}
        if addr_changed:
            patch["address"] = cleaned_addr
        if pref_changed:
            patch["prefecture"] = pref
        updates.append(patch)

    print(f"修正対象: {len(updates)}件  スキップ(address不明): {skipped}件")

    if not updates:
        print("修正不要です。")
        return

    # バッチで更新（100件ずつ upsert）
    batch_size = 100
    done = 0
    for i in range(0, len(updates), batch_size):
        batch = updates[i:i + batch_size]
        client.schema(SCHEMA).table("schools").upsert(batch, on_conflict="school_id").execute()
        done += len(batch)
        print(f"  更新済: {done}/{len(updates)}")

    print("✅ 完了")


if __name__ == "__main__":
    main()
