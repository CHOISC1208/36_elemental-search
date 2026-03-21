"""市区町村単位の公立小学校URLを検証するスクリプト"""
import sys
import re
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from scraper import make_session, get_soup, BASE_URL

session = make_session()

# 1. public_es ページから市区町村URLを抽出
pref_url = f"{BASE_URL}/search/p13/public_es/"
print(f"都道府県ページ: {pref_url}")
soup = get_soup(pref_url, session)

city_urls = []
if soup:
    for a in soup.find_all("a", href=re.compile(r"/search/p\d+/c\d+_public_es/")):
        href = a.get("href", "")
        full = href if href.startswith("http") else BASE_URL + href
        if full not in city_urls:
            city_urls.append(full)
    print(f"市区町村URL数: {len(city_urls)}")
    for u in city_urls[:5]:
        print(f"  {u}")

# 2. 最初の市区町村ページで学校リンク数を確認
print()
for city_url in city_urls[:3]:
    print(f"{'='*60}")
    print(f"URL: {city_url}")
    s = get_soup(city_url, session)
    if s is None:
        print("取得失敗")
        continue
    links = s.find_all("a", href=re.compile(r"/schools-\d+\.html"))
    title = s.find("title")
    print(f"  学校リンク数: {len(links)}")
    print(f"  title: {title.get_text(strip=True)[:80] if title else 'なし'}")
    for a in links[:5]:
        print(f"    → {a.get('href','')}  {a.get_text(strip=True)[:40]}")
