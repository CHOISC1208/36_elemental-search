"""
gaccom.jp スクレイピング → Supabase格納

使い方:
    python scrapers/gaccom/run.py --pref 13          # 東京都（pref_cd）
    python scrapers/gaccom/run.py --pref 東京都       # 都道府県名でも可
    python scrapers/gaccom/run.py --pref 関東         # 関東7都県まとめて
    python scrapers/gaccom/run.py --pref 13 --limit 5  # 5校だけ試す
    python scrapers/gaccom/run.py --list-prefs         # pref_cd 一覧

前提:
    Supabase に gaccom_schools テーブルが作成済みであること
"""

import sys
import os
import time
import argparse
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeRemainingColumn
from rich.table import Table

sys.path.insert(0, str(Path(__file__).parent))
from scraper import (
    make_session, get_school_links, get_soup, parse_school,
    PREF_NAMES, PREF_NAME_TO_CD, KANTO_PREF_CDS,
)

load_dotenv()

SCHEMA = "36_elemental-search"
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

console = Console()


def get_client():
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError(".env に SUPABASE_URL と SUPABASE_SERVICE_KEY を設定してください")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def upsert_schools(client, rows: list) -> int:
    if not rows:
        return 0
    client.schema(SCHEMA).table("gaccom_schools").upsert(
        rows, on_conflict="gaccom_id"
    ).execute()
    return len(rows)


def scrape_one(url: str, pref_cd: int, delay: float) -> dict | None:
    session = make_session()
    time.sleep(delay)
    soup = get_soup(url, session)
    if soup is None:
        return None
    return parse_school(url, soup, pref_cd)


def scrape_pref(pref_cd: int, delay: float, workers: int, limit: int | None, client):
    pref_name = PREF_NAMES.get(pref_cd, str(pref_cd))
    console.rule(f"[bold]{pref_name}[/bold]  (pref_cd={pref_cd})")

    session = make_session()
    with console.status("学校一覧を収集中..."):
        urls = get_school_links(pref_cd, session)

    if limit:
        urls = urls[:limit]

    console.print(f"  → [cyan]{len(urls)}校[/cyan]  (workers={workers}, delay={delay}s)")

    results = []
    lock = threading.Lock()

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("{task.completed}/{task.total} 校"),
        TimeRemainingColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("学校情報収集中", total=len(urls))

        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {
                executor.submit(scrape_one, url, pref_cd, delay): url
                for url in urls
            }
            for future in as_completed(futures):
                url = futures[future]
                try:
                    info = future.result()
                    if info:
                        now = datetime.now(timezone.utc).isoformat()
                        info["scraped_at"] = now
                        with lock:
                            results.append(info)
                except Exception as e:
                    console.print(f"  [red]ERROR {url}: {e}[/red]")
                progress.advance(task)

    with console.status("Supabaseに格納中..."):
        n = upsert_schools(client, results)

    console.print(f"  ✓ [green]{n}件[/green] 格納完了")
    return n


def resolve_pref_cds(pref_arg: str) -> list[int]:
    """引数を pref_cd のリストに解決する"""
    pref_lower = pref_arg.strip()

    if pref_lower == "all":
        return list(PREF_NAMES.keys())

    if pref_lower in ("関東", "kanto"):
        return KANTO_PREF_CDS

    # 数値
    if pref_lower.isdigit():
        cd = int(pref_lower)
        if cd in PREF_NAMES:
            return [cd]
        raise ValueError(f"pref_cd {cd} は存在しません（1-47）")

    # 都道府県名
    if pref_lower in PREF_NAME_TO_CD:
        return [PREF_NAME_TO_CD[pref_lower]]

    # 末尾の「都・道・府・県」を除いた名前でも検索
    for name, cd in PREF_NAME_TO_CD.items():
        if name.startswith(pref_lower):
            return [cd]

    raise ValueError(
        f"都道府県が解決できません: '{pref_arg}'\n"
        "--list-prefs で一覧を確認してください"
    )


def main():
    parser = argparse.ArgumentParser(description="gaccom.jp スクレイピング → Supabase格納")
    parser.add_argument("--pref", required=False,
                        help="都道府県（pref_cd数値 / 都道府県名 / 関東 / all）")
    parser.add_argument("--delay", type=float, default=1.5,
                        help="アクセス間隔（秒、デフォルト: 1.5）")
    parser.add_argument("--workers", type=int, default=3,
                        help="並列ワーカー数（デフォルト: 3）")
    parser.add_argument("--limit", type=int, default=None,
                        help="取得校数の上限（テスト用）")
    parser.add_argument("--list-prefs", action="store_true",
                        help="pref_cd 一覧を表示して終了")
    args = parser.parse_args()

    if args.list_prefs:
        table = Table(show_header=True, header_style="bold")
        table.add_column("pref_cd", justify="right")
        table.add_column("都道府県")
        for cd, name in PREF_NAMES.items():
            table.add_row(str(cd), name)
        console.print(table)
        return

    if not args.pref:
        parser.error("--pref が必要です（または --list-prefs）")

    try:
        pref_cds = resolve_pref_cds(args.pref)
    except ValueError as e:
        console.print(f"[red]{e}[/red]")
        sys.exit(1)

    client = get_client()

    total = 0
    for i, pref_cd in enumerate(pref_cds, 1):
        if len(pref_cds) > 1:
            console.print(f"\n[bold][{i}/{len(pref_cds)}][/bold]", end=" ")
        n = scrape_pref(pref_cd, args.delay, args.workers, args.limit, client)
        total += n

    console.print(f"\n[bold green]✅ 完了  合計 {total} 件[/bold green]")


if __name__ == "__main__":
    main()
