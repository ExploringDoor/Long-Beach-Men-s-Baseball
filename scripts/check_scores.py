"""
LBDC Score Checker
Runs hourly on Saturdays via GitHub Actions.
Checks LeagueLineup for new final scores and loads box scores into Supabase.
"""

import os
import re
import requests
from bs4 import BeautifulSoup

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


# ── Supabase helpers ──────────────────────────────────────────────────────────

def sb_get(path):
    r = requests.get(f"{SUPABASE_URL}/rest/v1/{path}", headers=HEADERS)
    r.raise_for_status()
    return r.json()

def sb_post(path, data):
    r = requests.post(f"{SUPABASE_URL}/rest/v1/{path}", headers=HEADERS, json=data)
    r.raise_for_status()
    return r.json()

def sb_upsert(table, data):
    h = {**HEADERS, "Prefer": "resolution=merge-duplicates,return=representation"}
    r = requests.post(f"{SUPABASE_URL}/rest/v1/{table}?on_conflict=ll_game_id", headers=h, json=data)
    r.raise_for_status()
    return r.json()


# ── Get already-loaded game IDs from Supabase ─────────────────────────────────

def get_known_game_ids():
    data = sb_get("games?select=ll_game_id&ll_game_id=not.is.null")
    return {row["ll_game_id"] for row in data}


# ── Scrape LeagueLineup games page for final scores ───────────────────────────

def get_ll_finals():
    # Check both divisions: Spring/Summer 2026 (1064043) and Fall/Winter (1061488)
    division_ids = ["1064043", "1061488"]
    all_finals = []
    seen = set()
    for div_id in division_ids:
        url = f"{LL_BASE}/games.asp?url=lbdc&divisionid={div_id}"
        try:
            r = requests.get(url, timeout=15)
            soup = BeautifulSoup(r.text, "html.parser")
            game_links = [(a, a["href"]) for a in soup.find_all("a", href=True) if "gamesum_baseball.asp" in a["href"] and "GameID=" in a["href"]]
            print(f"  Division {div_id}: found {len(game_links)} gamesum links")
            for a, href in game_links:
                match = re.search(r"GameID=(\d+)", href)
                if match:
                    game_id = match.group(1)
                    text = a.get_text(strip=True)
                    print(f"    GameID={game_id} text='{text}'")
                    # Match any link with a score in it
                    if game_id not in seen:
                        all_finals.append(game_id)
                        seen.add(game_id)
        except Exception as e:
            print(f"  ⚠️  Error checking division {div_id}: {e}")
    return all_finals

# ── Parse a single game box score ─────────────────────────────────────────────

def parse_game(game_id):
    url = f"{LL_BASE}/gamesum_baseball.asp?url=lbdc&GameID={game_id}"
    r = requests.get(url, timeout=15)
    soup = BeautifulSoup(r.text, "html.parser")
    text_lines = [l.strip() for l in soup.get_text(separator="\n").split("\n") if l.strip()]

    result = {
        "ll_game_id": game_id,
        "game_date": None,
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

    # Headline
    for line in text_lines:
        if len(line) > 15 and len(line) < 200 and any(x in line for x in [
            "!", "wins", "Wins", "defeats", "clinch", "shutout", "Shutout",
            "Holds", "Stages", "Edges", "Cruises", "Survives", "Bests"
        ]):
            result["headline"] = line
            break

    # Date / Time / Venue
    for line in text_lines:
        if line.startswith("Date:"):
            raw = line.replace("Date:", "").strip()
            # Convert "December 13, 2025" → "2025-12-13"
            try:
                from datetime import datetime
                result["game_date"] = datetime.strptime(raw, "%B %d, %Y").strftime("%Y-%m-%d")
            except Exception:
                result["game_date"] = raw
        if line.startswith("Time:"):
            result["game_time"] = line.replace("Time:", "").strip()
        if line.startswith("Venue:"):
            result["field"] = line.replace("Venue:", "").strip()

    # Scores from BOX SCORE table
    tables = soup.find_all("table")
    current_team = None

    for table in tables:
        rows = table.find_all("tr")
        for row in rows:
            cells = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
            if not cells:
                continue

            # Score line: "TeamName | score | hits | errors"
            if cells[0] in TEAMS and len(cells) >= 2:
                try:
                    score = int(cells[1])
                    if result["away_team"] is None:
                        result["away_team"] = cells[0]
                        result["away_score"] = score
                    elif result["home_team"] is None:
                        result["home_team"] = cells[0]
                        result["home_score"] = score
                except ValueError:
                    pass

            # Team header in batting/pitching section
            if cells[0] in TEAMS and len(cells) == 1:
                current_team = cells[0]

            # Batting line: player | AB | R | H | RBI | BB | K
            if (current_team and len(cells) >= 7 and
                    cells[0] not in ["Hitters", "Pitchers", "Totals", ""] and
                    not cells[0].startswith("---") and
                    cells[1].lstrip("-").isdigit()):
                try:
                    result["batting"].append({
                        "player_name": cells[0],
                        "team": current_team,
                        "ab": int(cells[1]) if cells[1].isdigit() else 0,
                        "r":  int(cells[2]) if cells[2].isdigit() else 0,
                        "h":  int(cells[3]) if cells[3].isdigit() else 0,
                        "rbi": int(cells[4]) if cells[4].isdigit() else 0,
                        "bb": int(cells[5]) if cells[5].isdigit() else 0,
                        "k":  int(cells[6]) if cells[6].isdigit() else 0,
                    })
                except Exception:
                    pass

            # Pitching line: pitcher | IP | H | R | ER | BB | K
            if (current_team and len(cells) >= 8 and
                    cells[0] not in ["Pitchers", "Totals", ""] and
                    not cells[0].startswith("---")):
                try:
                    ip = float(cells[1])
                    decision = None
                    name = cells[0]
                    if "(W)" in name:
                        decision = "W"
                        name = name.replace("(W)", "").strip()
                    elif "(L)" in name:
                        decision = "L"
                        name = name.replace("(L)", "").strip()
                    elif "(S)" in name:
                        decision = "S"
                        name = name.replace("(S)", "").strip()
                    result["pitching"].append({
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
                except Exception:
                    pass

    return result


# ── Get season ID ─────────────────────────────────────────────────────────────

def get_current_season_id():
    seasons = sb_get("seasons?select=id,name&order=id.desc&limit=10")
    # Find Spring/Summer 2026 or most recent regular season
    for s in seasons:
        if "Spring" in s["name"] or "Summer" in s["name"] or "2026" in s["name"]:
            return s["id"]
    return seasons[0]["id"] if seasons else 1


# ── Load game into Supabase ───────────────────────────────────────────────────

def load_game(game, season_id):
    if not game["away_team"] or not game["home_team"]:
        print(f"  ⚠️  Skipping {game['ll_game_id']} — could not parse teams")
        return

    # Insert game
    game_row = {
        "season_id": season_id,
        "ll_game_id": game["ll_game_id"],
        "game_date": game["game_date"],
        "game_time": game["game_time"],
        "field": game["field"],
        "away_team": game["away_team"],
        "home_team": game["home_team"],
        "away_score": game["away_score"],
        "home_score": game["home_score"],
        "headline": game["headline"],
        "status": game["status"],
    }

    inserted = sb_upsert("games", game_row)
    if not inserted:
        print(f"  ⚠️  Game insert failed for {game['ll_game_id']}")
        return

    game_db_id = inserted[0]["id"] if isinstance(inserted, list) else inserted["id"]
    print(f"  ✅ Game inserted: ID {game_db_id} — {game['away_team']} {game['away_score']}, {game['home_team']} {game['home_score']}")

    # Insert batting lines
    for b in game["batting"]:
        b["game_id"] = game_db_id
    if game["batting"]:
        sb_post("batting_lines", game["batting"])
        print(f"  ✅ {len(game['batting'])} batting lines inserted")

    # Insert pitching lines
    for p in game["pitching"]:
        p["game_id"] = game_db_id
    if game["pitching"]:
        sb_post("pitching_lines", game["pitching"])
        print(f"  ✅ {len(game['pitching'])} pitching lines inserted")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("🔍 Checking LeagueLineup for new scores...")

    known_ids = get_known_game_ids()
    print(f"  Already loaded: {len(known_ids)} games")

    finals = get_ll_finals()
    print(f"  Found on LeagueLineup: {len(finals)} final scores")

    new_ids = [gid for gid in finals if gid not in known_ids]
    print(f"  New games to load: {len(new_ids)}")

    if not new_ids:
        print("✅ Nothing new — all caught up!")
        return

    season_id = get_current_season_id()
    print(f"  Season ID: {season_id}")

    for game_id in new_ids:
        print(f"\n📋 Loading game {game_id}...")
        try:
            game = parse_game(game_id)
            load_game(game, season_id)
        except Exception as e:
            print(f"  ❌ Error loading {game_id}: {e}")

    print("\n🎉 Done!")


if __name__ == "__main__":
    main()
