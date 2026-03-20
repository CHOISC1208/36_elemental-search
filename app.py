"""
minkou スクレイピング管理UI
使い方:
    streamlit run app.py
"""

import sys
import os
import time
import queue
import threading
import requests
from datetime import datetime, timezone
from pathlib import Path

import streamlit as st
from dotenv import load_dotenv
from supabase import create_client

sys.path.insert(0, str(Path(__file__).parent / "scrapers" / "minkou"))
from scraper import get_school_links, get_soup, parse_school_info, get_all_reviews
from load_to_supabase import upsert_schools, upsert_reviews

load_dotenv()

SCHEMA = "36_elemental-search"
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

st.set_page_config(page_title="minkou scraper", page_icon="🏫", layout="wide")


# ── Supabase ────────────────────────────────────────────

@st.cache_resource
def get_client():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


@st.cache_data(ttl=300)
def load_prefectures() -> list[dict]:
    return get_client().schema(SCHEMA).table("prefectures").select("slug,name").order("name").execute().data


def load_cities(pref_slug: str) -> list[dict]:
    return (
        get_client().schema(SCHEMA).table("cities")
        .select("city_code,name,scraped_at")
        .eq("prefecture_slug", pref_slug)
        .order("city_code")
        .execute()
        .data
    )


def mark_scraped(city_code: str):
    now = datetime.now(timezone.utc).isoformat()
    get_client().schema(SCHEMA).table("cities").update({"scraped_at": now}).eq("city_code", city_code).execute()


# ── スクレイピング（スレッド内で実行）────────────────────

def scrape_one_school(school: dict, delay: float) -> tuple[dict, list]:
    session = requests.Session()
    sid = school["school_id"]
    time.sleep(delay)
    soup = get_soup(school["school_url"], session)
    info = parse_school_info(soup, sid, school["school_url"]) if soup else {"school_id": sid}
    time.sleep(delay)
    reviews = get_all_reviews(sid, session, delay)
    return info, reviews


def run_scraping(cities: list[dict], pref_slug: str, delay: float, workers: int, log_q: queue.Queue):
    import concurrent.futures

    client = get_client()
    session = requests.Session()
    lock = threading.Lock()

    for i, city in enumerate(cities):
        city_name = city["name"]
        city_code = city["city_code"]
        log_q.put(("info", f"▶ [{i+1}/{len(cities)}] {city_name} 開始"))

        schools = get_school_links(pref_slug, city_code, session)
        log_q.put(("info", f"  {len(schools)}校 見つかりました"))

        all_schools = []
        all_reviews = []
        done = [0]

        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {executor.submit(scrape_one_school, s, delay): s for s in schools}
            for future in concurrent.futures.as_completed(futures):
                school = futures[future]
                try:
                    info, reviews = future.result()
                    with lock:
                        all_schools.append(info)
                        all_reviews.extend(reviews)
                        done[0] += 1
                    log_q.put(("progress", (done[0], len(schools), school["school_name"])))
                except Exception as e:
                    log_q.put(("warn", f"  ⚠ {school['school_name']}: {e}"))

        upsert_schools(client, all_schools)
        upsert_reviews(client, all_reviews)
        mark_scraped(city_code)
        log_q.put(("success", f"  ✓ {city_name} 完了  schools={len(all_schools)}  reviews={len(all_reviews)}"))

    log_q.put(("done", "✅ 全処理完了"))


# ── UI ──────────────────────────────────────────────────

st.title("🏫 minkou スクレイパー")

# サイドバー
with st.sidebar:
    st.header("設定")

    prefs = load_prefectures()
    if not prefs:
        st.error("都道府県がDBにありません。fetch_locations.py を先に実行してください。")
        st.stop()

    pref_options = {p["name"]: p["slug"] for p in prefs}
    pref_name = st.selectbox("都道府県", list(pref_options.keys()))
    pref_slug = pref_options[pref_name]

    st.divider()
    workers = st.slider("並列ワーカー数", min_value=1, max_value=8, value=3)
    delay = st.slider("アクセス間隔（秒）", min_value=0.5, max_value=5.0, value=1.5, step=0.5)

    st.divider()
    if st.button("🔄 データ再読み込み", use_container_width=True):
        st.cache_data.clear()
        st.rerun()

# メイン
cities = load_cities(pref_slug)

if not cities:
    st.warning("市区町村がDBにありません。fetch_locations.py を先に実行してください。")
    st.stop()

done_count = sum(1 for c in cities if c["scraped_at"])
col1, col2, col3 = st.columns(3)
col1.metric("市区町村", f"{len(cities)}件")
col2.metric("取得済み", f"{done_count}件")
col3.metric("未取得", f"{len(cities) - done_count}件")

st.subheader("市区町村を選択")

col_a, col_b = st.columns([1, 1])
with col_a:
    if st.button("未取得を全選択"):
        st.session_state.selected = {c["city_code"] for c in cities if not c["scraped_at"]}
with col_b:
    if st.button("選択解除"):
        st.session_state.selected = set()

if "selected" not in st.session_state:
    st.session_state.selected = set()

selected_codes = set()
for city in cities:
    scraped = city["scraped_at"]
    label = city["name"]
    if scraped:
        label += f"  ✅ {scraped[:10]}"
    else:
        label += "  ⬜ 未取得"

    checked = st.checkbox(label, value=city["city_code"] in st.session_state.selected, key=f"cb_{city['city_code']}")
    if checked:
        selected_codes.add(city["city_code"])

selected_cities = [c for c in cities if c["city_code"] in selected_codes]

st.divider()

if not selected_cities:
    st.info("市区町村を選択してください")
    st.stop()

st.write(f"**{len(selected_cities)}件** を処理します  (workers={workers}, delay={delay}s)")

if st.button("🚀 スクレイピング開始", type="primary", use_container_width=True):
    log_q: queue.Queue = queue.Queue()
    thread = threading.Thread(
        target=run_scraping,
        args=(selected_cities, pref_slug, delay, workers, log_q),
        daemon=True,
    )
    thread.start()

    log_area = st.empty()
    progress_bar = st.progress(0)
    logs = []

    while thread.is_alive() or not log_q.empty():
        try:
            while True:
                kind, msg = log_q.get_nowait()
                if kind == "progress":
                    done, total, name = msg
                    pct = done / total if total else 0
                    progress_bar.progress(pct, text=f"{name[:20]} ({done}/{total})")
                elif kind == "success":
                    logs.append(f"🟢 {msg}")
                    progress_bar.progress(1.0)
                elif kind == "warn":
                    logs.append(f"🟡 {msg}")
                elif kind == "done":
                    logs.append(f"✅ {msg}")
                else:
                    logs.append(msg)
                log_area.text_area("ログ", value="\n".join(logs), height=300)
        except queue.Empty:
            pass
        time.sleep(0.3)

    thread.join()
    st.success("完了しました！")
    st.cache_data.clear()
