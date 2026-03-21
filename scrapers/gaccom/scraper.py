"""
gaccom.jp 小学校情報スクレイパー
===================================
gaccom.jp は TLS DH 鍵が弱いため、SECLEVEL=0 の custom SSL adapter を使用。

取得データ:
  - 学校基本情報（名称・住所・電話・FAX・種別・最寄駅）
  - 児童数・教職員数
  - 進学先中学校（linked_jhs）
  - 学校レポーター情報テキスト（施設・セキュリティ・部活・行事・給食 等）
"""

import re
import ssl
import sys
import time
import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.ssl_ import create_urllib3_context

BASE_URL = "https://www.gaccom.jp"

# pref_cd (JIS) → 都道府県名
PREF_NAMES = {
    1: "北海道", 2: "青森県", 3: "岩手県", 4: "宮城県", 5: "秋田県",
    6: "山形県", 7: "福島県", 8: "茨城県", 9: "栃木県", 10: "群馬県",
    11: "埼玉県", 12: "千葉県", 13: "東京都", 14: "神奈川県", 15: "新潟県",
    16: "富山県", 17: "石川県", 18: "福井県", 19: "山梨県", 20: "長野県",
    21: "岐阜県", 22: "静岡県", 23: "愛知県", 24: "三重県", 25: "滋賀県",
    26: "京都府", 27: "大阪府", 28: "兵庫県", 29: "奈良県", 30: "和歌山県",
    31: "鳥取県", 32: "島根県", 33: "岡山県", 34: "広島県", 35: "山口県",
    36: "徳島県", 37: "香川県", 38: "愛媛県", 39: "高知県", 40: "福岡県",
    41: "佐賀県", 42: "長崎県", 43: "熊本県", 44: "大分県", 45: "宮崎県",
    46: "鹿児島県", 47: "沖縄県",
}

PREF_NAME_TO_CD = {v: k for k, v in PREF_NAMES.items()}

KANTO_PREF_CDS = [8, 9, 10, 11, 12, 13, 14]  # 茨城・栃木・群馬・埼玉・千葉・東京・神奈川

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
# SSL adapter（DH key too small 回避）
# ─────────────────────────────────────────

class LegacySSLAdapter(HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs):
        ctx = create_urllib3_context()
        ctx.set_ciphers("DEFAULT@SECLEVEL=0")
        ctx.minimum_version = ssl.TLSVersion.TLSv1
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        kwargs["ssl_context"] = ctx
        super().init_poolmanager(*args, **kwargs)

    def proxy_manager_for(self, proxy, **proxy_kwargs):
        ctx = create_urllib3_context()
        ctx.set_ciphers("DEFAULT@SECLEVEL=0")
        ctx.minimum_version = ssl.TLSVersion.TLSv1
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        proxy_kwargs["ssl_context"] = ctx
        return super().proxy_manager_for(proxy, **proxy_kwargs)


def make_session() -> requests.Session:
    session = requests.Session()
    adapter = LegacySSLAdapter()
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def get_soup(url: str, session: requests.Session, retries: int = 3) -> BeautifulSoup | None:
    for attempt in range(retries):
        try:
            if attempt > 0:
                time.sleep(3 * attempt)
            resp = session.get(url, headers=HEADERS, timeout=30)
            resp.raise_for_status()
            resp.encoding = "utf-8"
            return BeautifulSoup(resp.text, "html.parser")
        except requests.RequestException as e:
            if attempt < retries - 1:
                print(f"  [RETRY {attempt+1}] {url} → {e}", file=sys.stderr)
            else:
                print(f"  [ERROR] {url} → {e}", file=sys.stderr)
    return None


# ─────────────────────────────────────────
# 学校一覧取得
# ─────────────────────────────────────────

def _collect_links(soup, seen: set) -> list[str]:
    """soupから schools-{id}.html のURLを重複なしで収集する"""
    urls = []
    for a in soup.find_all("a", href=re.compile(r"/schools-\d+\.html")):
        href = a.get("href", "")
        full = href if href.startswith("http") else BASE_URL + href
        if full not in seen:
            seen.add(full)
            urls.append(full)
    return urls


def get_school_links(pref_cd: int, session: requests.Session) -> list[str]:
    """都道府県コードから小学校URLリストを返す（私立・国立・公立をまとめて取得）"""
    seen = set()
    all_urls = []

    # 1. 公立小学校: 都道府県ページから市区町村URL一覧を取得し各ページをスクレイプ
    public_pref_url = f"{BASE_URL}/search/p{pref_cd}/public_es/"
    pref_soup = get_soup(public_pref_url, session)
    if pref_soup:
        city_urls = []
        for a in pref_soup.find_all("a", href=re.compile(rf"/search/p{pref_cd}/c\d+_public_es/")):
            href = a.get("href", "")
            full = href if href.startswith("http") else BASE_URL + href
            if full not in city_urls:
                city_urls.append(full)
        for city_url in city_urls:
            time.sleep(2.0)
            city_soup = get_soup(city_url, make_session())
            if city_soup:
                all_urls.extend(_collect_links(city_soup, seen))

    # 2. 私立小学校
    private_soup = get_soup(f"{BASE_URL}/search/p{pref_cd}/private_es/", session)
    if private_soup:
        all_urls.extend(_collect_links(private_soup, seen))

    # 3. 国立小学校
    national_soup = get_soup(f"{BASE_URL}/search/p{pref_cd}/national_es/", session)
    if national_soup:
        all_urls.extend(_collect_links(national_soup, seen))

    return all_urls


# ─────────────────────────────────────────
# 学校詳細ページパース
# ─────────────────────────────────────────

def parse_school(url: str, soup: BeautifulSoup, pref_cd: int) -> dict:
    m = re.search(r"/schools-(\d+)\.html", url)
    gaccom_id = m.group(1) if m else ""

    info = {
        "gaccom_id":       gaccom_id,
        "gaccom_url":      url,
        "school_name":     "",
        "address":         "",
        "phone":           "",
        "fax":             "",
        "school_type":     "",
        "nearest_station": "",
        "pref_cd":         pref_cd,
        "pref_name":       PREF_NAMES.get(pref_cd, ""),
        "student_count":   None,
        "teacher_count":   None,
        "linked_jhs":      "",
        "reporter_text":   "",
    }

    # 学校名（h1）
    h1 = soup.find("h1")
    if h1:
        info["school_name"] = h1.get_text(strip=True)

    # 小学校以外はスキップ（None を返してフィルタリング）
    if "小学校" not in info["school_name"]:
        return None

    # 基本情報テーブル
    for row in soup.select("table tr"):
        cells = row.find_all(["th", "td"])
        if len(cells) < 2:
            continue
        key = cells[0].get_text(strip=True)
        val = cells[1].get_text(" ", strip=True)
        if "設立" in key or "公立" in val or "私立" in val:
            if "公立" in val:
                info["school_type"] = "公立"
            elif "私立" in val:
                info["school_type"] = "私立"
        if "所在地" in key:
            info["address"] = val
        elif "電話番号" in key:
            info["phone"] = val
        elif "FAX" in key:
            info["fax"] = val

    # school_type は設立欄から取ることが多い
    if not info["school_type"]:
        for row in soup.select("table tr"):
            for cell in row.find_all(["th", "td"]):
                t = cell.get_text(strip=True)
                if t in ("公立", "私立"):
                    info["school_type"] = t
                    break

    # 最寄駅
    full_text = soup.get_text()
    m = re.search(r"最寄りの駅[：:\s]*([^\s\n]+駅)", full_text)
    if m:
        info["nearest_station"] = m.group(1)

    # 児童数
    m = re.search(r"児童数は(\d+)人", full_text)
    if m:
        info["student_count"] = int(m.group(1))

    # 教職員数（JS動的ロードのため取得できない場合が多い）
    m = re.search(r"教職員数は(\d+)人", full_text)
    if m:
        info["teacher_count"] = int(m.group(1))

    # 進学先中学校
    jhs_section = soup.find(string=re.compile(r"通学区域が共通している公立中学校"))
    if jhs_section:
        container = jhs_section.find_parent()
        if container:
            jhs_names = []
            for a in container.find_all_next("a", href=re.compile(r"/schools-\d+\.html")):
                name = a.get_text(strip=True)
                if name and "小学校" not in name:
                    jhs_names.append(name)
                if len(jhs_names) >= 5:
                    break
            info["linked_jhs"] = "、".join(jhs_names)

    # 学校レポーター情報テキスト
    reporter = soup.find(string=re.compile(r"学校レポーター情報"))
    if reporter:
        container = reporter.find_parent()
        if container:
            # 次のセクション見出しまでのテキストを取得
            texts = []
            for elem in container.find_next_siblings():
                if elem.name in ("h2", "h3"):
                    break
                t = elem.get_text(" ", strip=True)
                if t and len(t) > 5:
                    texts.append(t)
            info["reporter_text"] = " ".join(texts)

    # reporter_text が短い場合、代替で summary テキストを取得
    if len(info["reporter_text"]) < 50:
        summary = soup.find(string=re.compile(r"1977年|創立|標語|校舎|設備"))
        if summary:
            parent = summary.find_parent()
            if parent:
                info["reporter_text"] = parent.get_text(" ", strip=True)

    return info
