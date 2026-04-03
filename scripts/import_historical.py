"""
Historical Box Score Importer
Scrapes every LeagueLineup season and loads missing batting/pitching stats into Supabase.

Usage:
  python scripts/import_historical.py           # dry-run (shows what would be loaded)
  python scripts/import_historical.py --live    # actually inserts into Supabase
  python scripts/import_historical.py --season "2022 Fall/Winter Season" --live
"""

import sys, re, time, argparse
import urllib.request, urllib.parse, json
from datetime import datetime

# ── Config ─────────────────────────────────────────────────────────────────
SB_URL = "https://vhovzpajuyphjatjlodo.supabase.co"
SB_KEY = "sb_publishable_btmQX9enbqeWvKPHLRVVgA_kdObTZxC"
LL_BASE = "https://www.leaguelineup.com"

HEADERS_SB = {
    "apikey": SB_KEY,
    "Authorization": f"Bearer {SB_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

TEAMS = ["Tribe", "Dodgers", "Pirates", "Titans", "Brooklyn", "Generals", "Black Sox"]

# LL division_id → Supabase season name (from the dropdown on LL games page)
LL_SEASONS = [
    ("2021 Fall/Winter Season",          "1009695"),
    ("2021 50+",                          "997284"),
    ("2022 Summer Season",                "1015858"),
    ("2022 Fall/Winter Season",           "1022573"),
    ("2023 Spring/Summer Season",         "1032266"),
    ("2023 Fall/Winter Season",           "1040472"),
    ("NABA World Series-LAS VEGAS 2023",  "1041039"),
    ("2023 Thanksgiving Turkey Bowl",     "1040473"),
    ("2024 Spring/Summer Season",         "1044289"),
    ("2024 MLK-NABA",                     "1041797"),
    ("2024 4th of July-NABA",             "1045846"),
    ("2024 Father/Son NABA",              "1049256"),
    ("2024 NABA LAS VEGAS World Series - 60+", "1042135"),
    ("2024 NABA World Series - 50+",      "1042133"),
    ("2024 NABA World Series - 65+",      "1042134"),
    ("2024 MG Turkey Bowl Tournament",    "1053282"),
    ("2024/2025 Fall Winter Season",      "1049932"),
    ("2025 NABA MLK Tournament",          "1053559"),
    ("2025 Spring/Summer Season",         "1055551"),
    ("2025 NABA AZ World Series 50's",    "1053560"),
    ("2025 4th of July-NABA",             "1055104"),
    ("2025 Memorial Weekend Tournament-Las Vegas", "1056761"),
    ("2025 NABA Great Park Tournament",   "1055186"),
    ("2025 NABA Father/Son",              "1059946"),
    ("2025 NABA Las Vegas World Series 60's", "1053561"),
]

# ── Supabase helpers ────────────────────────────────────────────────────────
def sb_get(path):
    req = urllib.request.Request(
        f"{SB_URL}/rest/v1/{path}",
        headers={k: v for k, v in HEADERS_SB.items() if k != "Content-Type"}
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())

def sb_post(table, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        f"{SB_URL}/rest/v1/{table}",
        data=body,
        headers=HEADERS_SB,
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())

def sb_patch(table, filters, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        f"{SB_URL}/rest/v1/{table}?{filters}",
        data=body,
        headers={**HEADERS_SB, "Prefer": "return=representation"},
        method="PATCH"
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())

# ── LeagueLineup scraper ────────────────────────────────────────────────────
def get_ll_game_ids(div_id):
    """Returns list of (game_id, date_str, is_ppd)"""
    url = f"{LL_BASE}/games.asp?url=lbdc&divisionid={div_id}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            html = r.read().decode("utf-8", "ignore")
    except Exception as e:
        print(f"    ⚠️  Error fetching division {div_id}: {e}")
        return []

    from html.parser import HTMLParser

    class GameParser(HTMLParser):
        def __init__(self):
            super().__init__()
            self.results = []
            self.seen = set()
            self._current_row = []
            self._in_row = False

        def handle_starttag(self, tag, attrs):
            attrs = dict(attrs)
            if tag == "tr":
                self._in_row = True
                self._current_row = []
            if tag in ("td", "th"):
                pass
            if tag == "a":
                href = attrs.get("href", "")
                if "gamesum_baseball.asp" in href:
                    m = re.search(r"GameID=(\d+)", href, re.I)
                    if m:
                        self._current_row.append(("gameid", m.group(1)))

        def handle_endtag(self, tag):
            if tag == "tr" and self._in_row:
                self._in_row = False
                game_id = None
                date_str = None
                status = ""
                texts = []
                for typ, val in self._current_row:
                    if typ == "gameid":
                        game_id = val
                    elif typ == "text":
                        texts.append(val)

                if game_id and game_id not in self.seen:
                    for t in texts:
                        m = re.search(r"(\d{1,2}/\d{1,2}/\d{4})", t)
                        if m:
                            try:
                                date_str = datetime.strptime(m.group(1), "%m/%d/%Y").strftime("%Y-%m-%d")
                            except ValueError:
                                pass
                        if t.startswith("F") or t in ["PPD", "CAN", "FFT", "F*"]:
                            status = t
                    if status not in ["CAN", ""]:
                        self.seen.add(game_id)
                        self.results.append((game_id, date_str, status == "PPD"))

        def handle_data(self, data):
            if self._in_row:
                d = data.strip()
                if d:
                    self._current_row.append(("text", d))

    parser = GameParser()
    parser.feed(html)
    return parser.results


def parse_box_score(game_id):
    """Returns dict with batting/pitching lists, or None on failure."""
    url = f"{LL_BASE}/gamesum_baseball.asp?url=lbdc&GameID={game_id}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            html = r.read().decode("utf-8", "ignore")
    except Exception as e:
        print(f"    ⚠️  Error fetching game {game_id}: {e}")
        return None

    from html.parser import HTMLParser as HP
    from io import StringIO

    # Use BeautifulSoup-like simple parse via html.parser
    # We'll extract text + find score table
    class SimpleParser(HP):
        def __init__(self):
            super().__init__()
            self.tables = []
            self._cur_table = None
            self._cur_row = None
            self._cur_cell = None
            self.full_text_lines = []
            self._in_body = True

        def handle_starttag(self, tag, attrs):
            if tag == "table":
                self._cur_table = []
                self.tables.append(self._cur_table)
            elif tag == "tr":
                if self._cur_table is not None:
                    self._cur_row = []
                    self._cur_table.append(self._cur_row)
            elif tag in ("td", "th"):
                if self._cur_row is not None:
                    self._cur_cell = []
                    self._cur_row.append(self._cur_cell)
            elif tag == "br":
                if self._cur_cell is not None:
                    self._cur_cell.append("\n")
                else:
                    self.full_text_lines.append("\n")

        def handle_endtag(self, tag):
            if tag == "table":
                self._cur_table = None
                self._cur_row = None
                self._cur_cell = None
            elif tag == "tr":
                self._cur_row = None
                self._cur_cell = None
            elif tag in ("td", "th"):
                self._cur_cell = None

        def handle_data(self, data):
            d = data.strip()
            if not d:
                return
            if self._cur_cell is not None:
                self._cur_cell.append(d)
            else:
                self.full_text_lines.append(d)

    p = SimpleParser()
    p.feed(html)

    result = {
        "game_date": None,
        "away_team": None, "away_score": None,
        "home_team": None, "home_score": None,
        "field": None,
        "batting": [],
        "pitching": [],
    }

    # Parse date/field from full text
    all_text = " ".join(p.full_text_lines + [
        t for table in p.tables for row in table for cell in row for t in cell
    ])
    dm = re.search(r"Date:\s*([A-Za-z]+ \d+,\s*\d{4})", all_text)
    if dm:
        try:
            result["game_date"] = datetime.strptime(dm.group(1).strip(), "%B %d, %Y").strftime("%Y-%m-%d")
        except ValueError:
            pass
    vm = re.search(r"Venue:\s*([^\n,]+?)(?:\s{2,}|$|Time:)", all_text)
    if vm:
        result["field"] = vm.group(1).strip()

    # Find score table
    for table in p.tables:
        score_rows = []
        for row in table:
            cells = ["".join(c).strip() for c in row]
            if not cells:
                continue
            if cells[0] in TEAMS:
                vals = []
                for c in cells[1:]:
                    c = c.strip()
                    if c.lstrip("-").isdigit():
                        vals.append(int(c))
                    elif c in ["X", "x", ""]:
                        vals.append(0)
                    else:
                        break
                if len(vals) >= 3:
                    score_rows.append((cells[0], vals[-3]))
        if len(score_rows) >= 2:
            result["away_team"] = score_rows[0][0]
            result["away_score"] = score_rows[0][1]
            result["home_team"] = score_rows[1][0]
            result["home_score"] = score_rows[1][1]
            break

    # Find batting/pitching tables
    batting_seen = set()
    pitching_seen = set()

    for table in p.tables:
        flat = " ".join("".join(c) for row in table for c in row)
        if "Hitters" not in flat:
            continue

        current_team = None
        in_pitching = False

        for row in table:
            cells = ["".join(c).strip() for c in row]
            if not cells or all(c == "" for c in cells):
                continue
            if len(cells) == 1 and cells[0] in TEAMS:
                current_team = cells[0]
                in_pitching = False
                continue
            if cells[0] == "Hitters":
                in_pitching = False
                continue
            if cells[0] == "Pitchers":
                in_pitching = True
                continue
            if not cells[0] or cells[0].upper() in ["TOTALS", "TOTAL", ""]:
                continue
            if not current_team:
                continue

            name = cells[0]
            if name in TEAMS or name.startswith("2B") or name.startswith("3B"):
                continue

            if not in_pitching and len(cells) >= 7:
                key = (name, current_team)
                if key in batting_seen:
                    continue
                try:
                    result["batting"].append({
                        "player_name": name,
                        "team": current_team,
                        "ab":  int(cells[1]),
                        "r":   int(cells[2]),
                        "h":   int(cells[3]),
                        "rbi": int(cells[4]),
                        "bb":  int(cells[5]),
                        "k":   int(cells[6]),
                    })
                    batting_seen.add(key)
                except (ValueError, IndexError):
                    pass

            if in_pitching and len(cells) >= 7:
                key = (name, current_team)
                if key in pitching_seen:
                    continue
                decision = None
                clean = name
                for dec, letter in [("(W)", "W"), ("(L)", "L"), ("(S)", "S")]:
                    if dec in clean:
                        decision = letter
                        clean = clean.replace(dec, "").strip()
                try:
                    result["pitching"].append({
                        "player_name": clean,
                        "team": current_team,
                        "ip":  float(cells[1]) if cells[1].replace(".","").isdigit() else 0.0,
                        "h":   int(cells[2]) if cells[2].isdigit() else 0,
                        "r":   int(cells[3]) if cells[3].isdigit() else 0,
                        "er":  int(cells[4]) if cells[4].isdigit() else 0,
                        "bb":  int(cells[5]) if cells[5].isdigit() else 0,
                        "k":   int(cells[6]) if cells[6].isdigit() else 0,
                        "decision": decision,
                    })
                    pitching_seen.add(key)
                except (ValueError, IndexError):
                    pass

    return result


# ── Main ────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", help="Actually write to Supabase")
    parser.add_argument("--season", help="Only process this season name")
    args = parser.parse_args()

    DRY = not args.live
    if DRY:
        print("🔍 DRY RUN — pass --live to actually insert data\n")
    else:
        print("🚀 LIVE MODE — writing to Supabase\n")

    # Load Supabase season map
    sb_seasons = sb_get("seasons?select=id,name&limit=50")
    season_map = {s["name"]: s["id"] for s in sb_seasons}

    # Load all existing game IDs that already have batting lines
    existing_bat_games = set(
        r["game_id"] for r in sb_get("batting_lines?select=game_id&limit=5000")
    )
    print(f"Games already with batting stats: {len(existing_bat_games)}\n")

    seasons_to_run = [s for s in LL_SEASONS if not args.season or s[0] == args.season]
    total_new = 0

    for season_name, div_id in seasons_to_run:
        sb_season_id = season_map.get(season_name)
        if not sb_season_id:
            print(f"⚠️  Season not in Supabase: {season_name}")
            continue

        print(f"\n{'='*60}")
        print(f"📅 {season_name} (div={div_id}, season_id={sb_season_id})")

        # Load existing games for this season
        sb_games = sb_get(f"games?select=id,game_date,away_team,home_team,ll_game_id&season_id=eq.{sb_season_id}&limit=200")
        # Index by (date, away, home) for matching
        sb_game_index = {}
        for g in sb_games:
            key = (g.get("game_date",""), g.get("away_team",""), g.get("home_team",""))
            sb_game_index[key] = g

        # Get LL game IDs
        ll_games = get_ll_game_ids(div_id)
        print(f"  LL games found: {len(ll_games)}  |  Supabase games: {len(sb_games)}")

        season_new = 0
        for ll_gid, ll_date, is_ppd in ll_games:
            time.sleep(0.3)  # be polite to LL

            # Parse box score
            box = parse_box_score(ll_gid)
            if not box:
                continue

            # Use LL date if we didn't parse one from the box score page
            game_date = box.get("game_date") or ll_date
            away = box.get("away_team")
            home = box.get("home_team")

            if not away or not home:
                print(f"  ⚠️  Game {ll_gid}: could not parse teams")
                continue

            # Try to match to existing Supabase game
            key = (game_date, away, home)
            sb_game = sb_game_index.get(key)

            if sb_game:
                game_db_id = sb_game["id"]

                # Skip if already has batting stats
                if game_db_id in existing_bat_games:
                    continue

                if not box["batting"] and not box["pitching"]:
                    print(f"  ℹ️  Game {ll_gid} ({away} vs {home} {game_date}): no stats on LL")
                    continue

                print(f"  ✅ Match: {away} vs {home} {game_date} → db_id={game_db_id} | {len(box['batting'])} bat / {len(box['pitching'])} pit")

                if not DRY:
                    # Update game with ll_game_id if not set
                    if not sb_game.get("ll_game_id"):
                        try:
                            sb_patch("games", f"id=eq.{game_db_id}", {"ll_game_id": ll_gid})
                        except Exception as e:
                            print(f"    ⚠️  patch ll_game_id failed: {e}")

                    if box["batting"]:
                        bat_rows = [{"game_id": game_db_id, **b} for b in box["batting"]]
                        try:
                            sb_post("batting_lines", bat_rows)
                            print(f"    ✅ {len(bat_rows)} batting lines inserted")
                        except Exception as e:
                            print(f"    ❌ batting insert failed: {e}")

                    if box["pitching"]:
                        pit_rows = [{"game_id": game_db_id, **p} for p in box["pitching"]]
                        try:
                            sb_post("pitching_lines", pit_rows)
                            print(f"    ✅ {len(pit_rows)} pitching lines inserted")
                        except Exception as e:
                            print(f"    ❌ pitching insert failed: {e}")

                    existing_bat_games.add(game_db_id)
                season_new += 1

            else:
                # Game not in Supabase at all — insert fresh
                if not box["batting"] and not box["pitching"]:
                    continue

                print(f"  ➕ New game: {away} {box.get('away_score','?')} vs {home} {box.get('home_score','?')} ({game_date})")

                if not DRY:
                    game_row = {
                        "season_id":  sb_season_id,
                        "ll_game_id": ll_gid,
                        "game_date":  game_date,
                        "away_team":  away,
                        "home_team":  home,
                        "away_score": box.get("away_score"),
                        "home_score": box.get("home_score"),
                        "field":      box.get("field"),
                        "status":     "PPD" if is_ppd else "F",
                    }
                    try:
                        result = sb_post("games", game_row)
                        game_db_id = result[0]["id"] if isinstance(result, list) else result["id"]

                        if box["batting"]:
                            bat_rows = [{"game_id": game_db_id, **b} for b in box["batting"]]
                            sb_post("batting_lines", bat_rows)
                        if box["pitching"]:
                            pit_rows = [{"game_id": game_db_id, **p} for p in box["pitching"]]
                            sb_post("pitching_lines", pit_rows)

                        print(f"    ✅ Inserted game + {len(box['batting'])} bat / {len(box['pitching'])} pit lines")
                        existing_bat_games.add(game_db_id)
                    except Exception as e:
                        print(f"    ❌ Insert failed: {e}")

                season_new += 1

        print(f"  → {season_new} games {'would be' if DRY else 'were'} updated for {season_name}")
        total_new += season_new

    print(f"\n{'='*60}")
    print(f"🎉 Done! {total_new} games {'would be' if DRY else 'were'} updated total.")
    if DRY:
        print("Run with --live to actually write to Supabase.")


if __name__ == "__main__":
    main()
