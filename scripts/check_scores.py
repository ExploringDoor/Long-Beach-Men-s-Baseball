"""
LBDC Score Checker
Runs hourly on Saturdays via GitHub Actions.
Checks LeagueLineup for new final scores and loads box scores into Supabase.
"""

import os
import re
import json
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
        print(f"    ❌ {table} insert error {r.status_code}: {r.text[:200]}")
        return None
    return r.json()


# ── Get already-loaded game IDs ───────────────────────────────────────────────

def get_known_game_ids():
    data = sb_get("games?select=ll_game_id&ll_game_id=not.is.null&limit=500")
    return {str(row["ll_game_id"]) for row in data}


# ── Get current season ID ─────────────────────────────────────────────────────

def get_season_id():
    seasons = sb_get("seasons?select=id,name,ll_division_id&order=id.desc&limit=20")
    # Prefer Spring/Summer 2026
    for s in seasons:
        if s.get("ll_division_id") == "1064043":
            return s["id"]
    # Fall back to most recent
    return seasons[0]["id"] if seasons else 1


# ── Scrape LeagueLineup for game IDs ─────────────────────────────────────────

def get_ll_game_ids():
    """Returns list of game IDs AND a dict mapping game_id -> date"""
    found = []
    seen = set()
    date_map = {}  # game_id -> date string

    for div_id in DIVISION_IDS:
        url = f"{LL_BASE}/games.asp?url=lbdc&divisionid={div_id}"
        try:
            r = requests.get(url, timeout=15)
            soup = BeautifulSoup(r.text, "html.parser")

            # Find all table rows - each row has date + game link
            for row in soup.find_all("tr"):
                cells = row.find_all(["td", "th"])
                if not cells:
                    continue
                # Look for rows with a game link
                game_link = None
                for cell in cells:
                    for a in cell.find_all("a", href=True):
                        if "gamesum_baseball.asp" in a["href"] and "GameID=" in a["href"]:
                            game_link = a
                            break

                if game_link:
                    m = re.search(r"GameID=(\d+)", game_link["href"])
                    if m:
                        gid = m.group(1)
                        # Try to get date from first cell of row
                        date_text = cells[0].get_text(strip=True) if cells else ""
                        parsed_date = parse_date(date_text)
                        if parsed_date:
                            date_map[gid] = parsed_date
                        if gid not in seen:
                            found.append(gid)
                            seen.add(gid)

            print(f"  Division {div_id}: {len([g for g in found if g in date_map])} games with dates found")
        except Exception as e:
            print(f"  ⚠️  Error checking division {div_id}: {e}")

    return found, date_map


# ── Parse date from LeagueLineup box score ────────────────────────────────────

def parse_date(raw):
    if not raw:
        return None
    raw = raw.strip()
    for fmt in ["%B %d, %Y", "%b %d, %Y", "%m/%d/%Y", "%Y-%m-%d"]:
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    # Try to extract date from strings like "Saturday, March 28, 2026"
    m = re.search(r"(\w+ \d+, \d{4})", raw)
    if m:
        try:
            return datetime.strptime(m.group(1), "%B %d, %Y").strftime("%Y-%m-%d")
        except ValueError:
            pass
    print(f"    ⚠️  Could not parse date: '{raw}'")
    return None


# ── Parse box score page ──────────────────────────────────────────────────────

def parse_game(game_id, season_id):
    url = f"{LL_BASE}/gamesum_baseball.asp?url=lbdc&GameID={game_id}"
    r = requests.get(url, timeout=15)
    soup = BeautifulSoup(r.text, "html.parser")
    lines = [l.strip() for l in soup.get_text(separator="\n").split("\n") if l.strip()]

    game = {
        "ll_game_id": str(game_id),
        "season_id": season_id,
        "game_date": None,
        "game_time": None,
        "field": None,
        "away_team": None,
        "home_team": None,
        "away_score": None,
        "home_score": None,
        "headline": None,
        "status": "F",
        "innings": {},
        "batting": [],
        "pitching": [],
    }

    # Date / Time / Venue from text lines
    for line in lines:
        if line.startswith("Date:"):
            game["game_date"] = parse_date(line.replace("Date:", "").strip())
        elif line.startswith("Time:"):
            game["game_time"] = line.replace("Time:", "").strip()
        elif line.startswith("Venue:"):
            game["field"] = line.replace("Venue:", "").strip()

    # Headline
    for line in lines:
        if (len(line) > 15 and len(line) < 200 and
                any(x in line for x in ["!", "wins", "Wins", "defeats", "clinch",
                                         "shutout", "Edges", "Cruises", "Champs"])):
            game["headline"] = line
            break

    # Parse tables for scores and stats
    current_team = None
    in_pitching = False

    for table in soup.find_all("table"):
        for row in table.find_all("tr"):
            cells = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
            if not cells:
                continue

            # Score line: team name in first cell, score later
            if cells[0] in TEAMS:
                # Check if this is a score row (has numbers after team name)
                nums = [c for c in cells[1:] if c.isdigit()]
                if nums:
                    if game["away_team"] is None:
                        game["away_team"] = cells[0]
                        game["away_score"] = int(nums[0])
                    elif game["home_team"] is None and cells[0] != game["away_team"]:
                        game["home_team"] = cells[0]
                        game["home_score"] = int(nums[0])
                # Track current team for batting/pitching
                current_team = cells[0]
                in_pitching = False

            # Detect pitching section
            if "Pitchers" in cells or (len(cells) > 1 and cells[0] == "Pitchers"):
                in_pitching = True
                continue

            if cells[0] in ["Hitters", "Totals", "TOTALS", ""]:
                if cells[0] == "Hitters":
                    in_pitching = False
                continue

            # Batting line: name + 6 numbers (AB R H RBI BB K)
            if (current_team and not in_pitching and len(cells) >= 7 and
                    cells[0] not in TEAMS and not cells[0].startswith("---")):
                try:
                    ab = int(cells[1])
                    r  = int(cells[2])
                    h  = int(cells[3])
                    rbi = int(cells[4])
                    bb = int(cells[5])
                    k  = int(cells[6])
                    game["batting"].append({
                        "player_name": cells[0],
                        "team": current_team,
                        "ab": ab, "r": r, "h": h,
                        "rbi": rbi, "bb": bb, "k": k,
                    })
                except (ValueError, IndexError):
                    pass

            # Pitching line: name + IP + H R ER BB K
            if (current_team and in_pitching and len(cells) >= 7 and
                    cells[0] not in TEAMS and not cells[0].startswith("---")):
                try:
                    ip = float(cells[1])
                    name = cells[0]
                    decision = None
                    for dec in ["(W)", "(L)", "(S)"]:
                        if dec in name:
                            decision = dec[1]
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
                except (ValueError, IndexError):
                    pass

    return game


# ── Load game into Supabase ───────────────────────────────────────────────────

def load_game(game):
    # Validate required fields
    if not game["away_team"] or not game["home_team"]:
        print(f"  ⚠️  Skipping {game['ll_game_id']} — missing teams")
        return False
    if not game["game_date"]:
        print(f"  ⚠️  Skipping {game['ll_game_id']} — missing date")
        return False

    # Insert game row
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
    print(f"  ✅ Game {game['ll_game_id']} inserted — {game['away_team']} {game['away_score']}, {game['home_team']} {game['home_score']} ({game['game_date']})")

    # Insert batting lines
    if game["batting"]:
        for b in game["batting"]:
            b["game_id"] = game_db_id
        sb_insert("batting_lines", game["batting"])
        print(f"     ✅ {len(game['batting'])} batting lines")

    # Insert pitching lines
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

    all_ids, date_map = get_ll_game_ids()
    print(f"  Found on LeagueLineup: {len(all_ids)} games total")

    new_ids = [gid for gid in all_ids if gid not in known_ids]
    print(f"  New games to load: {len(new_ids)}")

    if not new_ids:
        print("✅ All caught up — nothing new!")
        return

    season_id = get_season_id()
    print(f"  Season ID: {season_id}")

    loaded = 0
    for gid in new_ids:
        print(f"\n📋 Loading game {gid}...")
        try:
            game = parse_game(gid, season_id)
            # Use date from schedule page if box score didn't have it
            if not game["game_date"] and gid in date_map:
                game["game_date"] = date_map[gid]
                print(f"    📅 Date from schedule: {game['game_date']}")
            if load_game(game):
                loaded += 1
        except Exception as e:
            print(f"  ❌ Error on game {gid}: {e}")

    print(f"\n🎉 Done! Loaded {loaded}/{len(new_ids)} new games.")


if __name__ == "__main__":
    main()
