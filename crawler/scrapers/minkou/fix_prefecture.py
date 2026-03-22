"""
schools テーブルの prefecture フィールドを address から正しい値に修正する
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

# minkou の prefecture フィールドは「県」なしで格納されている
PREF_STRIP = re.compile(r"(都|道|府|県)$")


def extract_pref_from_address(address: str) -> str | None:
    if not address:
        return None
    m = PREF_PATTERN.match(address.replace(" ", "").replace("\u3000", ""))
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
        r = client.schema(SCHEMA).table("schools").select("school_id,prefecture,address").range(offset, offset + 999).execute()
        all_rows.extend(r.data)
        if len(r.data) < 1000:
            break
        offset += 1000

    print(f"総件数: {len(all_rows)}件")

    updates = []
    skipped = 0
    for row in all_rows:
        pref = extract_pref_from_address(row.get("address", ""))
        if pref is None:
            skipped += 1
            continue
        if row["prefecture"] != pref:
            updates.append({"school_id": row["school_id"], "prefecture": pref})

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
