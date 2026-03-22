"""
都道府県を指定 → 市区町村をDBから選択 → スクレイピング → Supabase格納

使い方:
    python scrapers/minkou/run.py --pref 東京都
    python scrapers/minkou/run.py --pref tokyo
    python scrapers/minkou/run.py --pref 東京都 --force   # 取得済みも再実行

前提:
    fetch_locations.py を先に実行して prefectures/cities テーブルを埋めておくこと
"""

import sys
import os
import time
import argparse
import requests
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeRemainingColumn
from rich.table import Table
from rich import print as rprint

sys.path.insert(0, str(Path(__file__).parent))
from scraper import get_school_links, get_all_reviews, get_soup, parse_school_info
from load_to_supabase import upsert_schools, upsert_reviews

load_dotenv()

SCHEMA = "36_elemental-search"
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

console = Console()


def get_client():
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError(".env に SUPABASE_URL と SUPABASE_SERVICE_KEY を設定してください")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def resolve_pref_slug(pref: str, client) -> tuple[str, str]:
    """都道府県名またはスラッグを (slug, name) に解決する"""
    rows = client.schema(SCHEMA).table("prefectures").select("slug,name").execute().data
    for row in rows:
        if row["slug"] == pref or row["name"] == pref:
            return row["slug"], row["name"]
    raise ValueError(
        f"都道府県が見つかりません: '{pref}'\n"
        "先に fetch_locations.py を実行してDBを埋めてください"
    )


def fetch_cities_from_db(pref_slug: str, client) -> list[dict]:
    """DBから市区町村一覧を取得する（scraped_at含む）"""
    rows = (
        client.schema(SCHEMA).table("cities")
        .select("city_code,name,scraped_at")
        .eq("prefecture_slug", pref_slug)
        .order("city_code")
        .execute()
        .data
    )
    return rows


def select_cities(cities: list[dict], force: bool) -> list[dict]:
    """番号入力で市区町村を複数選択させる"""
    table = Table(show_header=True, header_style="bold")
    table.add_column("No.", width=4, justify="right")
    table.add_column("市区町村", min_width=16)
    table.add_column("状態", min_width=16)

    for i, c in enumerate(cities, 1):
        if c["scraped_at"]:
            dt = c["scraped_at"][:10]
            status = f"[green]取得済 {dt}[/green]"
        else:
            status = "[yellow]未取得[/yellow]"
        table.add_row(str(i), c["name"], status)

    console.print(table)
    console.print("番号をカンマ区切りで入力（例: 1,3,5）、[bold]all[/bold] で全選択、[bold]new[/bold] で未取得のみ")

    while True:
        raw = input("> ").strip()
        if not raw:
            console.print("[yellow]キャンセルしました[/yellow]")
            sys.exit(0)

        if raw.lower() == "all":
            return cities

        if raw.lower() == "new":
            selected = [c for c in cities if not c["scraped_at"]]
            if not selected:
                console.print("[yellow]未取得の市区町村はありません。all または番号で指定してください。[/yellow]")
                continue
            return selected

        try:
            indices = [int(x.strip()) for x in raw.split(",")]
            selected = []
            for idx in indices:
                if not (1 <= idx <= len(cities)):
                    raise ValueError(f"{idx} は範囲外です")
                selected.append(cities[idx - 1])
            return selected
        except ValueError as e:
            console.print(f"[red]入力エラー: {e}。もう一度入力してください。[/red]")


def mark_scraped(city_code: str, client):
    """citiesテーブルの scraped_at を更新する"""
    now = datetime.now(timezone.utc).isoformat()
    client.schema(SCHEMA).table("cities").update({"scraped_at": now}).eq("city_code", city_code).execute()


REVIEW_TEXT_FIELDS = [
    "text_overall", "text_policy", "text_class", "text_facility",
    "text_access", "text_pta", "text_events", "text_commute",
    "text_motivation", "text_exam", "exam_presence",
]

def scrape_one_school(school: dict, delay: float, no_reviews: bool = False, ratings_only: bool = False) -> tuple[dict, list]:
    """1校分の詳細・口コミを取得して返す（スレッドごとに独立したsessionを使用）"""
    session = requests.Session()
    sid = school["school_id"]

    time.sleep(delay)
    soup = get_soup(school["school_url"], session)
    if soup:
        info = parse_school_info(soup, sid, school["school_url"])
    else:
        info = {"school_id": sid}

    if no_reviews:
        return info, []

    time.sleep(delay)
    reviews = get_all_reviews(sid, session, delay)

    if ratings_only:
        for r in reviews:
            for field in REVIEW_TEXT_FIELDS:
                r[field] = ""

    return info, reviews


def scrape_city(city: dict, pref_slug: str, delay: float, workers: int, client, session: requests.Session, no_reviews: bool = False, ratings_only: bool = False):
    city_code = city["city_code"]
    city_name = city["name"]

    console.rule(f"[bold]{city_name}[/bold]  (code={city_code})")

    # 学校一覧
    with console.status("学校一覧を収集中..."):
        schools = get_school_links(pref_slug, city_code, session)
    console.print(f"  → [cyan]{len(schools)}校[/cyan] 見つかりました  "
                  f"[dim](workers={workers}, delay={delay}s)[/dim]")

    all_schools = []
    all_reviews = []
    lock = threading.Lock()

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("{task.completed}/{task.total} 校"),
        TimeRemainingColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("学校詳細・口コミ収集中", total=len(schools))

        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {
                executor.submit(scrape_one_school, school, delay, no_reviews, ratings_only): school
                for school in schools
            }
            for future in as_completed(futures):
                school = futures[future]
                try:
                    info, reviews = future.result()
                    with lock:
                        all_schools.append(info)
                        all_reviews.extend(reviews)
                except Exception as e:
                    console.print(f"  [red]ERROR {school['school_name']}: {e}[/red]")
                progress.advance(task)

    # Supabase格納
    with console.status("Supabaseに格納中..."):
        n_schools = upsert_schools(client, all_schools)
        n_reviews = upsert_reviews(client, all_reviews)
        mark_scraped(city_code, client)

    console.print(f"  ✓ schools [green]{n_schools}件[/green]  reviews [green]{n_reviews}件[/green]  → 完了")


def process_pref(pref_slug: str, pref_name: str, args, client, session: requests.Session):
    """1都道府県分の処理"""
    console.print(f"\n[bold]都道府県:[/bold] {pref_name} ({pref_slug})")

    cities = fetch_cities_from_db(pref_slug, client)
    if not cities:
        console.print("[red]市区町村がDBにありません。fetch_locations.py を先に実行してください。[/red]")
        return

    done = sum(1 for c in cities if c["scraped_at"])
    console.print(f"市区町村: {len(cities)}件  取得済: [green]{done}件[/green]  未取得: [yellow]{len(cities)-done}件[/yellow]\n")

    if args.auto:
        selected = [c for c in cities if not c["scraped_at"]] if not args.force else cities
        if not selected:
            console.print("[green]未取得の市区町村はありません。スキップ。[/green]")
            return
        console.print(f"[auto] {len(selected)}件の未取得市区町村を自動選択")
    else:
        selected = select_cities(cities, args.force)

    console.print(f"\n[bold]{len(selected)}件[/bold] の市区町村を処理します\n")

    for i, city in enumerate(selected, 1):
        console.print(f"\n[bold][{i}/{len(selected)}][/bold]", end=" ")
        scrape_city(city, pref_slug, args.delay, args.workers, client, session, no_reviews=args.no_reviews, ratings_only=args.ratings_only)


def main():
    parser = argparse.ArgumentParser(description="minkou.jp スクレイピング → Supabase格納")
    parser.add_argument("--pref", required=True,
                        help="都道府県名またはスラッグ（例: 東京都 / tokyo / all）")
    parser.add_argument("--delay", type=float, default=1.5,
                        help="アクセス間隔（秒、デフォルト: 1.5）")
    parser.add_argument("--workers", type=int, default=3,
                        help="並列ワーカー数（デフォルト: 3、上げすぎ注意）")
    parser.add_argument("--force", action="store_true",
                        help="取得済みの市区町村も選択肢に表示する")
    parser.add_argument("--auto", action="store_true",
                        help="対話UIをスキップし、未取得の市区町村を自動選択（CI/CD用）")
    parser.add_argument("--no-reviews", action="store_true",
                        help="口コミを取得しない（学校情報のみ、高速化）")
    parser.add_argument("--ratings-only", action="store_true",
                        help="口コミのカテゴリ評価のみ保存し、テキスト本文は保存しない")
    args = parser.parse_args()

    client = get_client()
    session = requests.Session()

    if args.pref.lower() == "all":
        if not args.auto:
            console.print("[red]--pref all は --auto と組み合わせて使ってください[/red]")
            sys.exit(1)
        pref_rows = client.schema(SCHEMA).table("prefectures").select("slug,name").order("slug").execute().data
        if not pref_rows:
            console.print("[red]都道府県がDBにありません。fetch_locations.py を先に実行してください。[/red]")
            sys.exit(1)
        console.print(f"[bold]全{len(pref_rows)}都道府県[/bold] を順番に処理します\n")
        for i, row in enumerate(pref_rows, 1):
            console.rule(f"[bold][{i}/{len(pref_rows)}] {row['name']}[/bold]")
            process_pref(row["slug"], row["name"], args, client, session)
    else:
        pref_slug, pref_name = resolve_pref_slug(args.pref, client)
        process_pref(pref_slug, pref_name, args, client, session)

    console.print("\n[bold green]✅ 全処理完了[/bold green]")


if __name__ == "__main__":
    main()
