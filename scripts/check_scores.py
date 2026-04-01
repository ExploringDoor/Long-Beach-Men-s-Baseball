"""
LBDC Score Checker - Final Version
Runs hourly on Saturdays via GitHub Actions.
Checks LeagueLineup for new final scores and loads box scores into Supabase.
"""

import os
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
LL_BASE = "https://www.leaguelineup.com"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

TEAMS = ["Tribe", "Dodgers", "Pirates", "Titans", "Brooklyn", "Generals", "Black Sox"]
DIVISION_IDS = ["1064043", "1061488"]


# ── Supabase helpers ──────────────────────────────────────────────────────────

def sb_get(path):
    r = requests.get(f"{SUPABASE_URL}/rest/v1/{path}", headers=HEADERS)
    r.raise_for_status()
    return r.json()

def sb_insert(table, data):
    r = requests.post(f"{SUPABASE_URL}/rest/v1/{table}", headers=HEADERS, json=data)
    if not r.ok:
        print(f"    ❌ {table} error {r.status_code}: {r.text[:300]}")
        return None
    return r.json()


# ── Get known game IDs ────────────────────────────────────────────────────────

def get_known_game_ids():
    data = sb_get("games?select=ll_game_id&ll_game_id=not.is.null&limit=500")
    return {str(row["ll_game_id"]) for row in data}


# ── Get season ID ─────────────────────────────────────────────────────────────

def get_season_id(div_id):
    seasons = sb_get("seasons?select=id,name,ll_division_id&order=id.desc&limit=20")
    for s in seasons:
        if str(s.get("ll_division_id")) == str(div_id):
            return s["id"]
    return seasons[0]["id"] if seasons else 1


# ── Scrape games list for IDs + dates ────────────────────────────────────────

def get_ll_games():
    results = []
    seen = set()

    for div_id in DIVISION_IDS:
        url = f"{LL_BASE}/games.asp?url=lbdc&divisionid={div_id}"
        try:
            r = requests.get(url, timeout=15)
            soup = BeautifulSoup(r.text, "html.parser")

            for row in soup.find_all("tr"):
                cells = row.find_all(["td", "th"])
                if len(cells) < 3:
                    continue

                game_id = None
                for cell in cells:
                    for a in cell.find_all("a", href=True):
                        if "gamesum_baseball.asp" in a["href"]:
                            m = re.search(r"GameID=(\d+)", a["href"])
                            if m:
                                game_id = m.group(1)
                                break
                    if game_id:
                        break

                if not game_id or game_id in seen:
                    continue

                # Date is typically in second cell as "Sat 3/28/2026"
                date_str = None
                for cell in cells[:3]:
                    text = cell.get_text(strip=True)
                    m = re.search(r"(\d{1,2}/\d{1,2}/\d{4})", text)
                    if m:
                        try:
                            date_str = datetime.strptime(m.group(1), "%m/%d/%Y").strftime("%Y-%m-%d")
                        except ValueError:
                            pass
                        break

                seen.add(game_id)
                results.append((game_id, date_str, div_id))

            print(f"  Division {div_id}: {len([x for x in results if x[2] == div_id])} games found")

        except Exception as e:
            print(f"  ⚠️  Error checking division {div_id}: {e}")

    return results


# ── Parse box score ───────────────────────────────────────────────────────────

def parse_game(game_id, season_id, fallback_date=None):
    url = f"{LL_BASE}/gamesum_baseball.asp?url=lbdc&GameID={game_id}"
    r = requests.get(url, timeout=15)
    soup = BeautifulSoup(r.text, "html.parser")
    full_text = soup.get_text(separator="\n")
    lines = [l.strip() for l in full_text.split("\n") if l.strip()]

    game = {
        "ll_game_id": str(game_id),
        "season_id": season_id,
        "game_date": fallback_date,
        "game_time": None,
        "field": None,
        "away_team": None,
        "home_team": None,
        "away_score": None,
        "home_score": None,
        "headline": None,
        "status": "F",
        "batting": [],
        "pitching": [],
    }

    # ── Date / Time / Venue ───────────────────────────────────────────────────
    # Line looks like: "Date: March 28, 2026     Time: 10:00am      Venue: Clark Field-Long Beach"
    for line in lines:
        if "Date:" in line and "Time:" in line:
            # Extract date
            dm = re.search(r"Date:\s*([A-Za-z]+ \d+,\s*\d{4})", line)
            if dm:
                try:
                    game["game_date"] = datetime.strptime(dm.group(1).strip(), "%B %d, %Y").strftime("%Y-%m-%d")
                except ValueError:
                    pass
            # Extract time
            tm = re.search(r"Time:\s*(\d+:\d+(?:am|pm))", line)
            if tm:
                game["game_time"] = tm.group(1)
            # Extract venue
            vm = re.search(r"Venue:\s*(.+?)(?:\s{2,}|$)", line)
            if vm:
                game["field"] = vm.group(1).strip()
            break

    # ── Headline ─────────────────────────────────────────────────────────────
    for line in lines:
        if (15 < len(line) < 200 and
                any(x in line for x in ["!", "Champ", "clinch", "shutout",
                                         "defeats", "wins", "Edges", "Cruises", "Congratulations"])):
            game["headline"] = line
            break

    # ── Scores from BOX SCORE table ──────────────────────────────────────────
    # The box score table has rows like:
    # Generals | 2 | 0 | 1 | 2 | 0 | 2 | 0 | 3 | 0 | 10 | 0 | 0
    # Where last 3 cols are R, H, E (regardless of extra innings)
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        team_rows = []
        for row in rows:
            cells = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
            if cells and cells[0] in TEAMS:
                team_rows.append(cells)

        if len(team_rows) >= 2:
            for cells in team_rows[:2]:  # only first two team rows = away and home
                # Get all numeric values after team name
                nums = []
                for c in cells[1:]:
                    if c.isdigit() or (c == "" ):
                        nums.append(int(c) if c.isdigit() else 0)
                    elif c in ["-", "X", "x"]:
                        nums.append(0)
                    else:
                        break

                if len(nums) >= 3:
                    # Last 3 are R, H, E
                    runs = nums[-3]
                    team = cells[0]
                    if game["away_team"] is None:
                        game["away_team"] = team
                        game["away_score"] = runs
                    elif game["home_team"] is None:
                        game["home_team"] = team
                        game["home_score"] = runs
            break  # found the box score table, stop looking

    # ── Batting + Pitching ────────────────────────────────────────────────────
    # The page has TWO sections with player stats:
    # 1) BOX SCORE (just totals) - we SKIP this
    # 2) Detailed stats section with "Hitters" header - we USE this
    #
    # Strategy: find all tables that have a "Hitters" header row,
    # and only parse those (not the box score inning table).

    batting_done = set()   # track (player_name, team) to avoid duplicates
    pitching_done = set()

    current_team = None
    in_pitching = False
    in_stats_section = False

    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        table_text = table.get_text()

        # Only process tables that contain "Hitters" — these are the stats tables
        if "Hitters" not in table_text and "Pitchers" not in table_text:
            continue

        for row in rows:
            cells = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
            if not cells:
                continue

            # Team name row
            if len(cells) == 1 and cells[0] in TEAMS:
                current_team = cells[0]
                in_pitching = False
                continue

            # Section headers
            if cells[0] == "Hitters":
                in_pitching = False
                continue
            if cells[0] == "Pitchers":
                in_pitching = True
                continue
            if cells[0] in ["Totals", "TOTALS", ""]:
                continue

            if not current_team:
                continue

            # Batting line: Name | AB | R | H | RBI | BB | K
            if not in_pitching and len(cells) >= 7:
                try:
                    name = cells[0]
                    key = (name, current_team)
                    if key in batting_done or not name or name in TEAMS:
                        continue
                    ab  = int(cells[1])
                    r   = int(cells[2])
                    h   = int(cells[3])
                    rbi = int(cells[4])
                    bb  = int(cells[5])
                    k   = int(cells[6])
                    game["batting"].append({
                        "player_name": name,
                        "team": current_team,
                        "ab": ab, "r": r, "h": h,
                        "rbi": rbi, "bb": bb, "k": k,
                    })
                    batting_done.add(key)
                except (ValueError, IndexError):
                    pass

            # Pitching line: Name | IP | H | R | ER | BB | K
            if in_pitching and len(cells) >= 7:
                try:
                    name = cells[0]
                    key = (name, current_team)
                    if key in pitching_done or not name or name in TEAMS:
                        continue
                    ip = float(cells[1])
                    decision = None
                    for dec, letter in [("(W)", "W"), ("(L)", "L"), ("(S)", "S")]:
                        if dec in name:
                            decision = letter
                            name = name.replace(dec, "").strip()
                    game["pitching"].append({
                        "player_name": name,
                        "team": current_team,
                        "ip": ip,
                        "h":  int(cells[2]) if cells[2].isdigit() else 0,
                        "r":  int(cells[3]) if cells[3].isdigit() else 0,
                        "er": int(cells[4]) if cells[4].isdigit() else 0,
                        "bb": int(cells[5]) if cells[5].isdigit() else 0,
                        "k":  int(cells[6]) if cells[6].isdigit() else 0,
                        "decision": decision,
                    })
                    pitching_done.add(key)
                except (ValueError, IndexError):
                    pass

    return game


# ── Load into Supabase ────────────────────────────────────────────────────────

def load_game(game):
    if not game["away_team"] or not game["home_team"]:
        print(f"  ⚠️  Skipping {game['ll_game_id']} — missing teams")
        return False
    if not game["game_date"]:
        print(f"  ⚠️  Skipping {game['ll_game_id']} — missing date")
        return False

    game_row = {
        "season_id":  game["season_id"],
        "ll_game_id": game["ll_game_id"],
        "game_date":  game["game_date"],
        "game_time":  game["game_time"],
        "field":      game["field"],
        "away_team":  game["away_team"],
        "home_team":  game["home_team"],
        "away_score": game["away_score"],
        "home_score": game["home_score"],
        "headline":   game["headline"],
        "status":     game["status"],
    }

    result = sb_insert("games", game_row)
    if not result:
        return False

    game_db_id = result[0]["id"] if isinstance(result, list) else result["id"]
    print(f"  ✅ {game['away_team']} {game['away_score']}, {game['home_team']} {game['home_score']} ({game['game_date']})")

    if game["batting"]:
        for b in game["batting"]:
            b["game_id"] = game_db_id
        sb_insert("batting_lines", game["batting"])
        print(f"     ✅ {len(game['batting'])} batting lines")

    if game["pitching"]:
        for p in game["pitching"]:
            p["game_id"] = game_db_id
        sb_insert("pitching_lines", game["pitching"])
        print(f"     ✅ {len(game['pitching'])} pitching lines")

    return True


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("🔍 Checking LeagueLineup for new scores...")

    known_ids = get_known_game_ids()
    print(f"  Already in database: {len(known_ids)} games")

    all_games = get_ll_games()
    print(f"  Found on LeagueLineup: {len(all_games)} games total")

    new_games = [(gid, date, div) for gid, date, div in all_games if gid not in known_ids]
    print(f"  New games to load: {len(new_games)}")

    if not new_games:
        print("✅ All caught up — nothing new!")
        return

    loaded = 0
    for gid, date_str, div_id in new_games:
        print(f"\n📋 Loading game {gid}...")
        try:
            season_id = get_season_id(div_id)
            game = parse_game(gid, season_id, fallback_date=date_str)
            if load_game(game):
                loaded += 1
        except Exception as e:
            print(f"  ❌ Error on game {gid}: {e}")

    print(f"\n🎉 Done! Loaded {loaded}/{len(new_games)} new games.")


if __name__ == "__main__":
    main()
