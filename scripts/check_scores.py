"""
LBDC Score Checker
Runs hourly on Saturdays via GitHub Actions.
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

def get_known_game_ids():
    data = sb_get("games?select=ll_game_id&ll_game_id=not.is.null&limit=500")
    return {str(row["ll_game_id"]) for row in data}

def get_season_id(div_id):
    seasons = sb_get("seasons?select=id,ll_division_id&order=id.desc&limit=20")
    for s in seasons:
        if str(s.get("ll_division_id")) == str(div_id):
            return s["id"]
    return seasons[0]["id"] if seasons else 1

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
                date_str = None
                for cell in cells[:4]:
                    text = cell.get_text(strip=True)
                    m = re.search(r"(\d{1,2}/\d{1,2}/\d{4})", text)
                    if m:
                        try:
                            date_str = datetime.strptime(m.group(1), "%m/%d/%Y").strftime("%Y-%m-%d")
                        except ValueError:
                            pass
                        break
                # Check status — only load Final games (F or F*)
                status = ""
                for cell in cells:
                    txt = cell.get_text(strip=True)
                    if txt.startswith("F") or txt in ["PPD", "CAN", "FFT"]:
                        status = txt
                        break

                # Skip postponed, cancelled games
                if status in ["PPD", "CAN", "N/R", ""]:
                    continue

                seen.add(game_id)
                results.append((game_id, date_str, div_id))
            print(f"  Division {div_id}: {len([x for x in results if x[2] == div_id])} games found")
        except Exception as e:
            print(f"  ⚠️  Error checking division {div_id}: {e}")
    return results

def parse_game(game_id, season_id, fallback_date=None):
    url = f"{LL_BASE}/gamesum_baseball.asp?url=lbdc&GameID={game_id}"
    r = requests.get(url, timeout=15)
    soup = BeautifulSoup(r.text, "html.parser")
    lines = [l.strip() for l in soup.get_text(separator="\n").split("\n") if l.strip()]

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

    # Date / Time / Venue — all on one line
    for line in lines:
        if "Date:" in line:
            dm = re.search(r"Date:\s*([A-Za-z]+ \d+,\s*\d{4})", line)
            if dm:
                try:
                    game["game_date"] = datetime.strptime(dm.group(1).strip(), "%B %d, %Y").strftime("%Y-%m-%d")
                except ValueError:
                    pass
            tm = re.search(r"Time:\s*(\d+:\d+(?:am|pm))", line)
            if tm:
                game["game_time"] = tm.group(1)
            vm = re.search(r"Venue:\s*(.+?)(?:\s{2,}|$)", line)
            if vm:
                game["field"] = vm.group(1).strip()
            break

    # Headline
    for line in lines:
        if (15 < len(line) < 200 and
                any(x in line for x in ["!", "Champ", "clinch", "shutout",
                                         "defeats", "wins", "Edges", "Cruises",
                                         "Congratulations", "advances"])):
            game["headline"] = line
            break

    # ── SCORES: parse box score table cell by cell ────────────────────────────
    # Each row looks like: [TeamName][inn1][inn2]...[innN][R][H][E]
    # R is always the 3rd from last cell, regardless of innings count
    for table in soup.find_all("table"):
        score_rows = []
        for row in table.find_all("tr"):
            tds = row.find_all(["td", "th"])
            if not tds:
                continue
            first_cell = tds[0].get_text(strip=True)
            if first_cell in TEAMS:
                # Get numeric values from each td individually
                vals = []
                for td in tds[1:]:
                    txt = td.get_text(strip=True)
                    if txt.lstrip("-").isdigit():
                        vals.append(int(txt))
                    elif txt in ["X", "x", ""]:
                        vals.append(0)
                    else:
                        break
                if len(vals) >= 3:
                    # R = third from last (after all innings, before H and E)
                    runs = vals[-3]
                    score_rows.append((first_cell, runs))

        if len(score_rows) >= 2:
            game["away_team"] = score_rows[0][0]
            game["away_score"] = score_rows[0][1]
            game["home_team"] = score_rows[1][0]
            game["home_score"] = score_rows[1][1]
            print(f"    📊 Scores: {game['away_team']} {game['away_score']}, {game['home_team']} {game['home_score']}")
            break

    # ── BATTING + PITCHING: only from tables containing "Hitters" header ─────
    batting_seen = set()
    pitching_seen = set()

    for table in soup.find_all("table"):
        if "Hitters" not in table.get_text():
            continue

        current_team = None
        in_pitching = False

        for row in table.find_all("tr"):
            tds = row.find_all(["td", "th"])
            cells = [td.get_text(strip=True) for td in tds]
            if not cells:
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
            if cells[0] in ["Totals", "TOTALS", ""]:
                continue
            if not current_team:
                continue

            name = cells[0]
            if not name or name in TEAMS or name.startswith("2B") or name.startswith("3B"):
                continue

            if not in_pitching and len(cells) >= 7:
                key = (name, current_team)
                if key in batting_seen:
                    continue
                try:
                    game["batting"].append({
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
                try:
                    decision = None
                    clean_name = name
                    for dec, letter in [("(W)", "W"), ("(L)", "L"), ("(S)", "S")]:
                        if dec in clean_name:
                            decision = letter
                            clean_name = clean_name.replace(dec, "").strip()
                    game["pitching"].append({
                        "player_name": clean_name,
                        "team": current_team,
                        "ip":  float(cells[1]),
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

    return game

def load_game(game):
    if not game["away_team"] or not game["home_team"]:
        print(f"  ⚠️  Skipping {game['ll_game_id']} — missing teams")
        return False
    if not game["game_date"]:
        print(f"  ⚠️  Skipping {game['ll_game_id']} — missing date")
        return False
    if game["away_score"] is None or game["home_score"] is None:
        print(f"  ⚠️  Skipping {game['ll_game_id']} — missing scores")
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
