"""
minkou.jp 小学校情報スクレイパー
===================================
使い方:
    # 都道府県スラッグ一覧（--pref不要）
    python minkou_scraper.py --list-prefs

    # 市区町村コード一覧を確認
    python minkou_scraper.py --pref tokyo --list-cities

    # 東京都 新宿区（コード13104）だけテスト
    python minkou_scraper.py --pref tokyo --city 13104 --output shinjuku.json

    # 東京都全体
    python minkou_scraper.py --pref tokyo --output tokyo.json

    # CSV形式
    python minkou_scraper.py --pref tokyo --city 13104 --mode csv --output shinjuku.csv

必要ライブラリ:
    pip install requests beautifulsoup4
"""

import re
import sys
import csv
import json
import time
import argparse
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

BASE_URL = "https://www.minkou.jp"

PREF_SLUGS = {
    "北海道": "hokkaido", "青森": "aomori", "岩手": "iwate", "宮城": "miyagi",
    "秋田": "akita", "山形": "yamagata", "福島": "fukushima", "茨城": "ibaraki",
    "栃木": "tochigi", "群馬": "gunma", "埼玉": "saitama", "千葉": "chiba",
    "東京": "tokyo", "神奈川": "kanagawa", "新潟": "niigata", "富山": "toyama",
    "石川": "ishikawa", "福井": "fukui", "山梨": "yamanashi", "長野": "nagano",
    "岐阜": "gifu", "静岡": "shizuoka", "愛知": "aichi", "三重": "mie",
    "滋賀": "shiga", "京都": "kyoto", "大阪": "osaka", "兵庫": "hyogo",
    "奈良": "nara", "和歌山": "wakayama", "鳥取": "tottori", "島根": "shimane",
    "岡山": "okayama", "広島": "hiroshima", "山口": "yamaguchi", "徳島": "tokushima",
    "香川": "kagawa", "愛媛": "ehime", "高知": "kochi", "福岡": "fukuoka",
    "佐賀": "saga", "長崎": "nagasaki", "熊本": "kumamoto", "大分": "oita",
    "宮崎": "miyazaki", "鹿児島": "kagoshima", "沖縄": "okinawa",
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


# ─────────────────────────────────────────
# ユーティリティ
# ─────────────────────────────────────────

def get_soup(url: str, session: requests.Session) -> BeautifulSoup | None:
    try:
        resp = session.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        resp.encoding = "utf-8"
        return BeautifulSoup(resp.text, "html.parser")
    except requests.RequestException as e:
        print(f"  [ERROR] {url} → {e}", file=sys.stderr)
        return None


# ─────────────────────────────────────────
# 市区町村コード取得
# ─────────────────────────────────────────

def fetch_cities(pref: str, session: requests.Session) -> dict:
    """
    都道府県ページから 市区町村名 → コード数値 の辞書を返す。
    URL例: /primary/search/tokyo/13104/  ← 13104 がコード
    """
    url = f"{BASE_URL}/primary/search/{pref}/"
    soup = get_soup(url, session)
    if soup is None:
        return {}

    cities = {}

    # パターン1: <select> の <option value="13104">新宿区</option>
    for opt in soup.select("option"):
        value = opt.get("value", "").strip()
        name = opt.get_text(strip=True)
        if value.isdigit() and name and name != "市区町村選択":
            cities[name] = value

    # パターン2: <a href="/primary/search/tokyo/13104/"> などのリンク
    if not cities:
        for a in soup.find_all("a", href=re.compile(rf"/primary/search/{pref}/\d+/")):
            m = re.search(rf"/primary/search/{pref}/(\d+)/", a.get("href", ""))
            if m:
                code = m.group(1)
                name = a.get_text(strip=True)
                if name:
                    cities[name] = code

    return cities


# ─────────────────────────────────────────
# 学校一覧収集
# ─────────────────────────────────────────

def get_school_links(pref: str, city_code: str | None, session: requests.Session) -> list:
    if city_code:
        base_url = f"{BASE_URL}/primary/search/{pref}/{city_code}/"
    else:
        base_url = f"{BASE_URL}/primary/search/{pref}/"

    schools = []
    seen_ids = set()
    page = 1

    while True:
        url = base_url if page == 1 else f"{base_url}page={page}"
        print(f"  一覧ページ: {url}")
        soup = get_soup(url, session)
        if soup is None:
            break

        found = 0
        for a_tag in soup.find_all("a", href=re.compile(r"/primary/school/\d+/$")):
            href = a_tag.get("href", "")
            m = re.search(r"/primary/school/(\d+)/$", href)
            if not m:
                continue
            school_id = m.group(1)
            if school_id in seen_ids:
                continue
            seen_ids.add(school_id)

            h3 = a_tag.find("h3")
            name = h3.get_text(strip=True) if h3 else ""
            schools.append({
                "school_id": school_id,
                "school_name": name,
                "school_url": urljoin(BASE_URL, href),
            })
            found += 1

        print(f"    → {found}校追加（累計 {len(schools)}校）")

        next_link = soup.find("a", string=lambda t: t and "次の" in t)
        if not next_link:
            break
        page += 1

    return schools


# ─────────────────────────────────────────
# 学校詳細ページ
# ─────────────────────────────────────────

def parse_school_info(soup: BeautifulSoup, school_id: str, school_url: str) -> dict:
    info = {
        "school_id": school_id,
        "school_url": school_url,
        "school_name": "",
        "furigana": "",
        "prefecture": "",
        "city": "",
        "address": "",
        "nearest_station": "",
        "school_type": "",
        "uniform": "",
        "lunch": "",
        "events": "",
        "tuition": "",
        "selection": "",
        "selection_method": "",
        "rating_avg": "",
        "review_count": 0,
    }

    h1 = soup.find("h1")
    if h1:
        info["school_name"] = h1.get_text(strip=True)

    # ふりがな
    if h1:
        for sib in h1.next_siblings:
            t = sib.get_text(strip=True) if hasattr(sib, "get_text") else str(sib).strip()
            if t and re.search(r"[ぁ-ん]", t):
                info["furigana"] = t.strip("()（）")
                break

    # 都道府県・市区町村・公立私立
    for a in soup.find_all("a", href=re.compile(r"/primary/search/")):
        href = a.get("href", "")
        text = a.get_text(strip=True)
        if not text:
            continue
        if re.search(r"/primary/search/c=", href):
            info["school_type"] = text
        elif re.search(rf"/primary/search/\w+/\d+/", href):
            if not info["city"]:
                info["city"] = text
        elif re.search(rf"/primary/search/\w+/$", href):
            if not info["prefecture"]:
                info["prefecture"] = text

    # 総合評価（数値テキストを探す）
    for node in soup.find_all(string=re.compile(r"^\s*\d\.\d{1,2}\s*$")):
        t = node.strip()
        if re.match(r"^\d\.\d{1,2}$", t):
            info["rating_avg"] = t
            break

    # 口コミ件数
    for a in soup.find_all("a", href=re.compile(r"/primary/school/review/\d+/$")):
        m = re.search(r"(\d+)件", a.get_text())
        if m:
            info["review_count"] = int(m.group(1))
            break

    # 基本情報テーブル
    for row in soup.select("table tr"):
        cells = row.find_all(["th", "td"])
        if len(cells) < 2:
            continue
        key = cells[0].get_text(strip=True)
        val = cells[1].get_text(" ", strip=True)
        if "所在地" in key:     info["address"] = val
        elif "最寄駅" in key:   info["nearest_station"] = val
        elif "制服" in key:     info["uniform"] = val
        elif "給食" in key:     info["lunch"] = val
        elif "行事" in key:     info["events"] = val
        elif "学費" in key:     info["tuition"] = val
        elif "選考の有無" in key: info["selection"] = val
        elif "選考方法" in key:  info["selection_method"] = val

    return info


# ─────────────────────────────────────────
# 口コミ詳細1件パース
# ─────────────────────────────────────────

def parse_single_review(soup: BeautifulSoup, school_id: str, url: str) -> dict | None:
    review = {
        "school_id": school_id,
        "review_url": url,
        "poster_type": "",
        "enrollment_year": "",
        "post_date": "",
        "title": "",
        "rating_overall": "",
        "rating_policy": "",
        "rating_class": "",
        "rating_teacher": "",
        "rating_facility": "",
        "rating_access": "",
        "rating_pta": "",
        "rating_events": "",
        "text_overall": "",
        "text_policy": "",
        "text_class": "",
        "text_facility": "",
        "text_access": "",
        "text_pta": "",
        "text_events": "",
        "text_commute": "",
        "text_motivation": "",
        "exam_presence": "",
        "text_exam": "",
    }

    full_text = soup.get_text()

    # 投稿者タイプ
    for pt in ["保護者", "生徒", "卒業生"]:
        if pt in full_text:
            review["poster_type"] = pt
            break

    # 入学年
    m = re.search(r"(\d{4})年入学", full_text)
    if m:
        review["enrollment_year"] = m.group(1)

    # 投稿日
    m = re.search(r"(\d{4}年\d+月)投稿", full_text)
    if m:
        review["post_date"] = m.group(1)

    # タイトル（h1）
    h1 = soup.find("h1")
    if h1:
        t = h1.get_text(strip=True)
        if t and "小学校" not in t:
            review["title"] = t

    # 総合評価数値
    for node in soup.find_all(string=re.compile(r"^\s*\d+\.\d+\s*$")):
        t = node.strip()
        if re.match(r"^\d+\.\d+$", t):
            review["rating_overall"] = t
            break

    # カテゴリ別スコア（<div class="mod-reviewItem"> 内の <span class="number"> から取得）
    SCORE_FIELDS = ["rating_policy", "rating_class", "rating_teacher", "rating_facility", "rating_access", "rating_pta", "rating_events"]
    item_div = soup.find("div", class_="mod-reviewItem")
    if item_div:
        spans = item_div.find_all("span", class_="number")
        for i, span in enumerate(spans):
            if i < len(SCORE_FIELDS):
                val = span.get_text(strip=True)
                if re.match(r"^\d+$", val):
                    review[SCORE_FIELDS[i]] = val

    # カテゴリ別テキスト本文
    text_map = {
        "総合評価": "text_overall",
        "方針・理念": "text_policy",
        "授業": "text_class",
        "施設・セキュリティ": "text_facility",
        "アクセス・立地": "text_access",
        "保護者関係(PTA)": "text_pta",
        "イベント": "text_events",
        "登下校方法": "text_commute",
        "志望動機": "text_motivation",
        "試験内容": "text_exam",
    }

    # 試験の有無（有り / なし）
    m = re.search(r"試験の有無[：:\s]*(有り|なし|あり|無し)", full_text)
    if m:
        review["exam_presence"] = m.group(1)
    for li in soup.find_all("li"):
        label_tag = li.find(["strong", "h4", "dt"])
        if label_tag:
            label = label_tag.get_text(strip=True)
            for key, field in text_map.items():
                if key in label:
                    label_tag.decompose()
                    body = li.get_text(strip=True).lstrip("：: \u3000")
                    if body:
                        review[field] = body
                    break
        else:
            li_text = li.get_text(strip=True)
            for key, field in text_map.items():
                if li_text.startswith(key):
                    body = li_text[len(key):].lstrip("：: \u3000")
                    if body and len(body) > 3:
                        review[field] = body
                    break

    if not review["poster_type"] and not review["title"]:
        return None
    return review


def get_all_reviews(school_id: str, session: requests.Session, delay: float) -> list:
    reviews = []
    page = 1
    base_url = f"{BASE_URL}/primary/school/review/{school_id}/"

    while True:
        url = base_url if page == 1 else f"{base_url}page={page}"
        soup = get_soup(url, session)
        if soup is None:
            break

        links = soup.find_all("a", href=re.compile(r"/primary/school/review/\d+/rd_\d+/$"))
        if not links:
            break

        page_count = 0
        for link in links:
            rd_url = urljoin(BASE_URL, link.get("href", ""))
            time.sleep(delay * 0.5)
            rd_soup = get_soup(rd_url, session)
            if rd_soup is None:
                continue
            r = parse_single_review(rd_soup, school_id, rd_url)
            if r:
                reviews.append(r)
                page_count += 1

        print(f"    口コミ p{page}: {page_count}件")

        next_link = soup.find("a", string=lambda t: t and "次の" in t)
        if not next_link:
            break
        page += 1
        time.sleep(delay)

    return reviews


# ─────────────────────────────────────────
# メイン
# ─────────────────────────────────────────

def scrape(pref: str, city_code: str | None, delay: float, output: str, mode: str):
    session = requests.Session()
    print(f"\n=== みんなの小学校情報 スクレイパー ===")
    print(f"対象: {pref}" + (f" / city={city_code}" if city_code else "（全体）"))
    print(f"アクセス間隔: {delay}秒\n")

    print("[Step 1] 学校一覧収集...")
    schools = get_school_links(pref, city_code, session)
    print(f"→ {len(schools)} 校\n")

    all_school_data = []
    all_review_data = []

    for i, school in enumerate(schools, 1):
        sid = school["school_id"]
        print(f"[{i}/{len(schools)}] {school['school_name']} (ID:{sid})")

        time.sleep(delay)
        soup = get_soup(school["school_url"], session)
        if soup:
            info = parse_school_info(soup, sid, school["school_url"])
            all_school_data.append(info)
            print(f"  基本情報 ✓  評価:{info['rating_avg']}  口コミ:{info['review_count']}件")
        else:
            all_school_data.append({"school_id": sid, "school_url": school["school_url"]})

        time.sleep(delay)
        reviews = get_all_reviews(sid, session, delay)
        all_review_data.extend(reviews)
        print(f"  口コミ ✓  {len(reviews)}件")

    print(f"\n[完了] 学校:{len(all_school_data)}  口コミ:{len(all_review_data)}")

    if mode == "json" or output.endswith(".json"):
        fname = output if output.endswith(".json") else output + ".json"
        with open(fname, "w", encoding="utf-8") as f:
            json.dump({"schools": all_school_data, "reviews": all_review_data},
                      f, ensure_ascii=False, indent=2)
        print(f"→ {fname}")
    else:
        base = output.replace(".csv", "")
        if all_school_data:
            with open(base + "_schools.csv", "w", encoding="utf-8-sig", newline="") as f:
                w = csv.DictWriter(f, fieldnames=all_school_data[0].keys())
                w.writeheader(); w.writerows(all_school_data)
            print(f"→ {base}_schools.csv")
        if all_review_data:
            with open(base + "_reviews.csv", "w", encoding="utf-8-sig", newline="") as f:
                w = csv.DictWriter(f, fieldnames=all_review_data[0].keys())
                w.writeheader(); w.writerows(all_review_data)
            print(f"→ {base}_reviews.csv")


def main():
    parser = argparse.ArgumentParser(description="minkou.jp 小学校スクレイパー")
    parser.add_argument("--pref", default=None,
                        help="都道府県スラッグ (例: tokyo)")
    parser.add_argument("--city", default=None,
                        help="市区町村コード数値 (例: 13104)。--list-cities で確認")
    parser.add_argument("--delay", type=float, default=1.5)
    parser.add_argument("--output", default="result.json")
    parser.add_argument("--mode", default="json", choices=["json", "csv"])
    parser.add_argument("--list-prefs", action="store_true",
                        help="都道府県スラッグ一覧（--pref不要）")
    parser.add_argument("--list-cities", action="store_true",
                        help="市区町村コード一覧（--prefと併用）")

    args = parser.parse_args()

    # --list-prefs は --pref 不要
    if args.list_prefs:
        print("都道府県スラッグ一覧:")
        for name, slug in PREF_SLUGS.items():
            print(f"  {name}: {slug}")
        return

    if args.pref is None:
        parser.error("--pref が必要です（または --list-prefs）")

    if args.list_cities:
        session = requests.Session()
        print(f"[{args.pref}] 市区町村コード一覧:")
        cities = fetch_cities(args.pref, session)
        if not cities:
            print("  取得できませんでした")
        for name, code in cities.items():
            print(f"  {name}: {code}")
        return

    scrape(args.pref, args.city, args.delay, args.output, args.mode)


if __name__ == "__main__":
    main()