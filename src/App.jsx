import { useState, useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import { HISTORY_DATA } from "./historyData.js";

// ── Sanitize any HTML before passing to dangerouslySetInnerHTML.
//    All admin-edited rich text (lbdc_page_content, lbdc_rules,
//    lbdc_sponsors, lbdc_fields) lives behind public-write Supabase
//    tables, so without sanitization any visitor with the (public)
//    anon key could inject <script> via PATCH and have it execute
//    in every other visitor's browser. Always wrap. Default config
//    strips <script>, on*= handlers, javascript: URLs.
const sanitizeHTML = (html) => ({ __html: DOMPurify.sanitize(html || "") });

const L_LEAGUE = "/hero111.jpg";

const TEAM_LOGOS = {
  "Tribe":    "/tribe.png",
  "Dodgers":  "/dodgers.png",
  "Pirates":  "/pirates.png",
  "Titans":   "/titans.png",
  "Brooklyn": "/brooklyn.png",
  "Generals": "/generals.png",
  "Black Sox": "/blacksox.png",
  "Eddie Murray Mashers '56":   "/20.png",
  "Greg Maddux Magicians '66":  "/21.png",
};

const BOOMERS_TEAMS = new Set(["Eddie Murray Mashers '56", "Greg Maddux Magicians '66"]);

// ── Convert "Apr 11" / "Apr 11, 2026" → "2026-04-11" for Supabase ──
const toISODate = (str) => {
  if(!str) return null;
  if(/^\d{4}-\d{2}-\d{2}$/.test(str)) return str; // already ISO
  const MON = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  const m = str.match(/([A-Za-z]+)\s+(\d{1,2})/);
  if(!m) return null;
  const month = MON[m[1].slice(0,3).toLowerCase()];
  const day   = parseInt(m[2]);
  const yearM = str.match(/(\d{4})/);
  const year  = yearM ? parseInt(yearM[1]) : 2026;
  if(!month || !day) return null;
  return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
};

// ── Normalize player names before any DB write. Pasting from PDFs / Word
//    docs / certain mobile keyboards can introduce non-breaking spaces
//    (U+00A0) and other invisible whitespace, which then split a single
//    player into "two players" across the season's stat tables. Always
//    call this before inserting/upserting `player_name`. Past audit caught
//    70+ NBSP splits across Brooklyn / Titans / Generals rosters.
const cleanName = (n) =>
  String(n || "")
    .replace(/\p{Z}/gu, " ") // \p{Z} = every Unicode separator (NBSP, narrow nbsp, ideographic, etc.)
    .replace(/\s+/g, " ")
    .trim();

// ── Strip internal "[submitted: X]" submission-tracking metadata before
//    rendering a game.headline to the public. Multiple display sites
//    have re-introduced raw `{game.headline}` over time and leaked the
//    bracketed tag onto the public UI; this single helper is the
//    canonical sanitizer. Always call it instead of rendering raw.
const cleanHeadline = (h) =>
  ((h || "").replace(/\s*\[submitted:[^\]]*\]/g, "")).trim();

// Short display names for the ticker
const TICKER_NAME = {
  "Eddie Murray Mashers '56":  "Mashers",
  "Greg Maddux Magicians '66": "Magicians",
};

const DIV = {
  SAT: {
    name: "Spring/Summer 2026", accent: "#002d6e",
    teams: [
      {seed:1,name:"Tribe",full:"Tribe",w:0,l:0,t:0,pct:"---",gp:0,rs:0,ra:0,diff:"---"},
      {seed:2,name:"Pirates",full:"Pirates",w:0,l:0,t:0,pct:"---",gp:0,rs:0,ra:0,diff:"---"},
      {seed:3,name:"Titans",full:"Titans",w:0,l:0,t:0,pct:"---",gp:0,rs:0,ra:0,diff:"---"},
      {seed:4,name:"Brooklyn",full:"Brooklyn",w:0,l:0,t:0,pct:"---",gp:0,rs:0,ra:0,diff:"---"},
      {seed:5,name:"Generals",full:"Generals",w:0,l:0,t:0,pct:"---",gp:0,rs:0,ra:0,diff:"---"},
      {seed:6,name:"Black Sox",full:"Black Sox",w:0,l:0,t:0,pct:"---",gp:0,rs:0,ra:0,diff:"---"},
    ]},
  BOM: {
    name: "Boomers 60/70", accent: "#7c3aed",
    teams: [
      {seed:1,name:"Eddie Murray Mashers '56",full:"Eddie Murray Mashers '56",w:0,l:0,t:0,pct:"---",gp:0,rs:0,ra:0,diff:"---"},
      {seed:2,name:"Greg Maddux Magicians '66",full:"Greg Maddux Magicians '66",w:0,l:0,t:0,pct:"---",gp:0,rs:0,ra:0,diff:"---"},
    ]},
};

const ALL_TEAMS = Object.entries(DIV).flatMap(([dk,div]) =>
  div.teams.map(t => ({...t, divKey:dk, divName:div.name, divAccent:div.accent}))
);

const TEAM_COLORS = {
  "Tribe":"#002d6e","Dodgers":"#005a9c","Pirates":"#1d2d44","Titans":"#4a1d96",
  "Brooklyn":"#b45309","Generals":"#374151","Black Sox":"#111111",
  "Eddie Murray Mashers '56":"#1a5276","Greg Maddux Magicians '66":"#6b21a8",
};

const TEAM_ROSTERS = {
  "Tribe": [],
  "Pirates": [
    {number:"", name:"Ron Arbolida"},
    {number:"", name:"Terrence Herren"},
    {number:"", name:"Kevin Johnson"},
    {number:"", name:"Luis Luna"},
    {number:"", name:"JR Rodriguez"},
    {number:"", name:"Joe Sandoval"},
    {number:"", name:"Dylan Smith"},
  ],
  "Titans": [
    {number:"", name:"Tommy Bennett"},
    {number:"", name:"Cruz Beto"},
    {number:"", name:"John Blanchard"},
    {number:"", name:"Chris Browning"},
    {number:"", name:"Gabreal Carabello"},
    {number:"", name:"Tony Carrillo"},
    {number:"", name:"Troy Christian"},
    {number:"", name:"Gaston Escudero"},
    {number:"", name:"Scott Halprin"},
    {number:"", name:"Fred Hayes"},
    {number:"", name:"Josh Hochgesang"},
    {number:"", name:"Jefferson Hoff"},
    {number:"", name:"David Lieberman"},
    {number:"", name:"Jeff Logan"},
    {number:"", name:"Michael McCann"},
    {number:"", name:"Antony Mitchell"},
    {number:"", name:"Karl Morris"},
    {number:"", name:"Frank Picha"},
    {number:"", name:"John Pretrocelli"},
    {number:"", name:"Matt Schultz"},
    {number:"", name:"Danny Tegran"},
    {number:"", name:"Craig Weinreich"},
    {number:"", name:"Ethan Wolferman"},
  ],
  "Brooklyn": [
    {number:"34", name:"Alan Acosta"},
    {number:"8",  name:"Joe Barrett"},
    {number:"26", name:"JD Campbell"},
    {number:"23", name:"Marty Campbell"},
    {number:"7",  name:"Johnny Fennel"},
    {number:"44", name:"Tony Garcia"},
    {number:"66", name:"Jose Gomez"},
    {number:"22", name:"Daniel Gutierrez"},
    {number:"33", name:"Marshall Landry"},
    {number:"27", name:"Ryan Lieberman"},
    {number:"4",  name:"Mooch Machado"},
    {number:"",   name:"Kurt Mascio"},
    {number:"6",  name:"Craig McKendall"},
    {number:"29", name:"Mark Newman"},
    {number:"",   name:"John Perkins"},
    {number:"21", name:"Eddie Rosas"},
    {number:"3",  name:"John Sosa"},
    {number:"5",  name:"Brian Stoltz"},
  ],
  "Generals": [
    {number:"", name:"Ray Avalos"},
    {number:"", name:"Joe Cervantes"},
    {number:"", name:"Arnold Chavez"},
    {number:"", name:"Dennis Clancy"},
    {number:"", name:"Josh Clapper"},
    {number:"", name:"Greg Ferris"},
    {number:"", name:"Craig Guidron"},
    {number:"", name:"Chris Guzman"},
    {number:"", name:"John Laine"},
    {number:"", name:"Mike Liang"},
    {number:"", name:"Jamie Macek"},
    {number:"", name:"David Maciel"},
    {number:"", name:"Henry Marroquin"},
    {number:"", name:"Billy Morris"},
    {number:"", name:"Richie Pena"},
    {number:"", name:"Jess Whitehill"},
    {number:"", name:"Kyle Yamamoto"},
  ],
  "Black Sox": [
    {number:"", name:"Carlos Benavides"},
    {number:"", name:"Kenny Breding"},
    {number:"", name:"Ruben Casillas"},
    {number:"", name:"Nate Davis"},
    {number:"", name:"Dennis Donnels"},
    {number:"", name:"Lee Frankel"},
    {number:"", name:"Adrian Hasenmayer"},
    {number:"", name:"Marvin Horn"},
    {number:"", name:"Kenny Keidser"},
    {number:"", name:"Pete Pirante"},
    {number:"", name:"JT Torres"},
    {number:"", name:"Jimmy Van Cott"},
    {number:"", name:"Cedric Watson"},
  ],
  "Eddie Murray Mashers '56": [
    {number:"2",  name:"Steve Bunnell"},
    {number:"",   name:"Dennis Clancy"},
    {number:"",   name:"Jose Gomez"},
    {number:"",   name:"Alan Ides"},
    {number:"",   name:"Mike Ockwig"},
    {number:"",   name:"Robbie Robinson"},
  ],
  "Greg Maddux Magicians '66": [
    {number:"",   name:"Miguel Alejandre"},
    {number:"",   name:"Pedro Barajas"},
    {number:"",   name:"Tom Bennett"},
    {number:"",   name:"Scott Page"},
    {number:"",   name:"Dave Snyder"},
  ],
};

// Rosters are now managed in Supabase (lbdc_rosters table).
// getEffectiveRosters() returns hardcoded fallback data only.
function saveStoredRosters(_rosters) { /* no-op: storage moved to Supabase */ }
function getEffectiveRosters() {
  return JSON.parse(JSON.stringify(TEAM_ROSTERS));
}

const TEAM_CAL_LINKS = {
  "Tribe":    "https://calendar.google.com/calendar/r?cid=c595f97c1b49bf9edc22855592ee79225543282bec41c68c18715cb57dd6a109%40group.calendar.google.com",
  "Dodgers":  "https://calendar.google.com/calendar/r?cid=7da402a2fc41e88b5f82a28cc8dc1f1c3424a421e6a8b7227406354079352b17%40group.calendar.google.com",
  "Pirates":  "https://calendar.google.com/calendar/r?cid=9de8fd5874f11ff42f25cf6d92caaee9261c137c8be4c64b0d26083014484010%40group.calendar.google.com",
  "Titans":   "https://calendar.google.com/calendar/r?cid=2a4c0c5588dc9e3b492690304ce6da913ffff3daad4340a83cecafc6111cd6e1%40group.calendar.google.com",
  "Brooklyn": "https://calendar.google.com/calendar/r?cid=0474cdc6fd4e9341b1638d7b458b4a3c498c53a42e489a72c652e0c61a58559d%40group.calendar.google.com",
  "Generals": "https://calendar.google.com/calendar/r?cid=87c7cc1dfa649ad6095d8daaaf95db1f1ecb222aeab8849eb6681b3c62f2a8cc%40group.calendar.google.com",
  "Black Sox":"https://calendar.google.com/calendar/r?cid=72509ee387916b56600af826b8e0fd6c11e4227a7c1eee79dae873650a260b29%40group.calendar.google.com",
  "Eddie Murray Mashers '56":  "https://calendar.google.com/calendar/r?cid=1641f48afa62a1d531486a44b949f194f1dde2eeeb020eb5fb4845b07d70881a%40group.calendar.google.com",
  "Greg Maddux Magicians '66": "https://calendar.google.com/calendar/r?cid=6d97cb2c2833f83718aa1144af4402b990e998dcbeb4dd9a5d233a3781e8bff5%40group.calendar.google.com",
};

// Apple / iPhone Calendar (webcal ICS feed)
const TEAM_CAL_ICS = {
  "Tribe":    "webcal://calendar.google.com/calendar/ical/c595f97c1b49bf9edc22855592ee79225543282bec41c68c18715cb57dd6a109%40group.calendar.google.com/public/basic.ics",
  "Dodgers":  "webcal://calendar.google.com/calendar/ical/7da402a2fc41e88b5f82a28cc8dc1f1c3424a421e6a8b7227406354079352b17%40group.calendar.google.com/public/basic.ics",
  "Pirates":  "webcal://calendar.google.com/calendar/ical/9de8fd5874f11ff42f25cf6d92caaee9261c137c8be4c64b0d26083014484010%40group.calendar.google.com/public/basic.ics",
  "Titans":   "webcal://calendar.google.com/calendar/ical/2a4c0c5588dc9e3b492690304ce6da913ffff3daad4340a83cecafc6111cd6e1%40group.calendar.google.com/public/basic.ics",
  "Brooklyn": "webcal://calendar.google.com/calendar/ical/0474cdc6fd4e9341b1638d7b458b4a3c498c53a42e489a72c652e0c61a58559d%40group.calendar.google.com/public/basic.ics",
  "Generals": "webcal://calendar.google.com/calendar/ical/87c7cc1dfa649ad6095d8daaaf95db1f1ecb222aeab8849eb6681b3c62f2a8cc%40group.calendar.google.com/public/basic.ics",
  "Black Sox":"webcal://calendar.google.com/calendar/ical/72509ee387916b56600af826b8e0fd6c11e4227a7c1eee79dae873650a260b29%40group.calendar.google.com/public/basic.ics",
  "Eddie Murray Mashers '56":  "webcal://calendar.google.com/calendar/ical/1641f48afa62a1d531486a44b949f194f1dde2eeeb020eb5fb4845b07d70881a%40group.calendar.google.com/public/basic.ics",
  "Greg Maddux Magicians '66": "webcal://calendar.google.com/calendar/ical/6d97cb2c2833f83718aa1144af4402b990e998dcbeb4dd9a5d233a3781e8bff5%40group.calendar.google.com/public/basic.ics",
};

const SCORES = [
  {
    season:"Spring/Summer 2026",
    weeks:[
      {week:"Season opens Apr 11, 2026", games:[]},
    ]
  },
  {
    season:"Boomers 60/70",
    weeks:[
      {week:"Season opens Apr 11, 2026", games:[]},
    ]
  },
];

const SCHED = [
  { label:"Apr 11", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Pirates",home:"Brooklyn"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Tribe",home:"Titans"},
      {time:"12:00 PM",away:"Generals",home:"Black Sox",status:"PPD"},
    ]},
  ]},
  { label:"Apr 18", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Brooklyn",home:"Tribe"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Generals",home:"Pirates"},
      {time:"12:00 PM",away:"Titans",home:"Black Sox"},
    ]},
  ]},
  { label:"Apr 25", fields:[
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Pirates",home:"Tribe"},
      {time:"12:00 PM",away:"Generals",home:"Titans"},
    ]},
    {name:"St Pius X — Downey", games:[
      {time:"12:00 PM",away:"Black Sox",home:"Brooklyn"},
    ]},
  ]},
  { label:"May 2", fields:[
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Titans",home:"Pirates"},
      {time:"12:00 PM",away:"Brooklyn",home:"Generals"},
    ]},
    {name:"St Pius X — Downey", games:[
      {time:"9:00 AM",away:"Tribe",home:"Black Sox"},
    ]},
  ]},
  { label:"May 9", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Titans",home:"Brooklyn"},
      {time:"12:00 PM",away:"Generals",home:"Tribe"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Pirates",home:"Black Sox"},
    ]},
  ]},
  { label:"May 16", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Titans",home:"Tribe"},
      {time:"12:00 PM",away:"Generals",home:"Black Sox"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Brooklyn",home:"Pirates"},
    ]},
  ]},
  { label:"May 30", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Tribe",home:"Brooklyn"},
      {time:"12:00 PM",away:"Black Sox",home:"Titans"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Pirates",home:"Generals"},
    ]},
  ]},
  { label:"Jun 6", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Titans",home:"Generals"},
      {time:"12:00 PM",away:"Brooklyn",home:"Black Sox"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Tribe",home:"Pirates"},
    ]},
  ]},
  { label:"Jun 13", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Generals",home:"Brooklyn"},
      {time:"12:00 PM",away:"Titans",home:"Pirates"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Black Sox",home:"Tribe"},
    ]},
  ]},
  { label:"Jun 20", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Brooklyn",home:"Titans"},
      {time:"12:00 PM",away:"Tribe",home:"Generals"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Pirates",home:"Black Sox"},
    ]},
  ]},
  { label:"Jun 27", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Black Sox",home:"Generals"},
      {time:"12:00 PM",away:"Tribe",home:"Titans"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Brooklyn",home:"Pirates"},
    ]},
  ]},
  { label:"Jul 11", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Brooklyn",home:"Tribe"},
      {time:"12:00 PM",away:"Titans",home:"Black Sox"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Generals",home:"Pirates"},
    ]},
  ]},
  { label:"Jul 18", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Pirates",home:"Tribe"},
      {time:"12:00 PM",away:"Generals",home:"Titans"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Black Sox",home:"Brooklyn"},
    ]},
  ]},
  { label:"Jul 25", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Tribe",home:"Black Sox"},
      {time:"12:00 PM",away:"Brooklyn",home:"Generals"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Titans",home:"Pirates"},
    ]},
  ]},
  { label:"Aug 1", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Titans",home:"Brooklyn"},
      {time:"12:00 PM",away:"Pirates",home:"Black Sox"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Generals",home:"Tribe"},
    ]},
  ]},
  { label:"Aug 8", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Generals",home:"Black Sox"},
    ]},
  ]},
];

const BOOMERS_SCHED = [
  {date:"Apr 11",time:"2:00 PM",away:"Eddie Murray Mashers '56",home:"Greg Maddux Magicians '66",field:"St Pius X — Downey"},
  {date:"Apr 25",time:"3:00 PM",away:"Greg Maddux Magicians '66",home:"Eddie Murray Mashers '56",field:"St Pius X — Downey",status:"PPD"},
  {date:"May 9", time:"3:00 PM",away:"Eddie Murray Mashers '56",home:"Greg Maddux Magicians '66",field:"St Pius X — Downey"},
  {date:"Jun 6", time:"3:00 PM",away:"Greg Maddux Magicians '66",home:"Eddie Murray Mashers '56",field:"St Pius X — Downey"},
  {date:"Jun 20",time:"2:00 PM",away:"Eddie Murray Mashers '56",home:"Greg Maddux Magicians '66",field:"St Pius X — Downey"},
  {date:"Jul 11",time:"3:00 PM",away:"Greg Maddux Magicians '66",home:"Eddie Murray Mashers '56",field:"Clark Field — Long Beach"},
  {date:"Jul 25",time:"3:00 PM",away:"Eddie Murray Mashers '56",home:"Greg Maddux Magicians '66",field:"Clark Field — Long Beach"},
  {date:"Aug 8", time:"12:00 PM",away:"Greg Maddux Magicians '66",home:"Eddie Murray Mashers '56",field:"Clark Field — Long Beach"},
  {date:"Aug 22",time:"8:00 AM",away:"Greg Maddux Magicians '66",home:"Eddie Murray Mashers '56",field:"Clark Field — Long Beach"},
];

const RULES_DATA = [
  {section:"Playoff Eligibility",icon:"🏆",items:[
    "To qualify for playoffs, players must participate in a minimum of 4 games (verified by completed box scores). Effective 9/9/22 by league vote.",
    "Playoff format: Best of 3 series.",
  ]},
  {section:"Mercy Rule & Time Limit",icon:"⏱️",items:[
    "Mercy rule: 15 runs after 5 innings, 10 runs after 7 innings.",
    "No new inning after 2 hours and 35 minutes. Unfinished innings revert to the last completed inning.",
    "Field rentals are in 3-hour blocks — hustle in and out.",
    "5 pitch warmups between innings.",
  ]},
  {section:"Courtesy Runners",icon:"🏃",items:[
    "Teams MAY designate up to 3 Courtesy Runners (Non Runners), including the Catcher with 2 outs.",
    "Courtesy Runners must be the LAST RECORDED OUT. If the last recorded out is a Non Runner, then the previous recorded out shall run.",
    "There is no limit to the number of times the last recorded out can run.",
    "Courtesy Runners running for Non Runners MAY NOT STEAL (including for the Catcher).",
    "Courtesy Runners shall not be held on at first base. The runner may take a normal lead but must wait for the ball to: 1) Be hit, 2) Strike the ground, or 3) Be caught by the catcher — BEFORE advancing.",
    "Any attempt to pick off a Courtesy Runner at 1B only will result in the liberation of the runner, making them eligible to now steal bases.",
    "Penalty for a Courtesy Runner otherwise attempting to steal (not advancing on a wild pitch/passed ball) will result in an OUT.",
    "Non Runners designated before the START of the game shall not be thrown out at first base from the outfield on a batted ball. Force plays are in effect.",
  ]},
  {section:"Defensive Shifts",icon:"🧤",items:[
    "Infielders must remain on the infield at the time of the pitch.",
    "Infielders may range into the outfield to make any play they are able to.",
  ]},
  {section:"Rosters & Age",icon:"📋",items:[
    "There is no limit to the number of players a team can roster.",
    "Age limits: Each team is permitted to carry up to 3 players who are 45 years of age and up.",
    "Those 3 players aged 45+ are NOT permitted to pitch.",
  ]},
  {section:"Registration & Playoff Eligibility",icon:"💰",items:[
    "All players must pay a $50 registration fee to be eligible for the season.",
    "Players must pay their $50 registration fee AND appear in a minimum of 4 regular season games to qualify for playoff eligibility.",
    "Game appearances are tracked from official box scores submitted after each game.",
    "It is the responsibility of each player to ensure their fee is paid before the playoff cutoff date.",
    "Players who have not met both requirements (payment + 4 game appearances) will not be eligible for postseason play.",
    "Medical exemptions may be granted at the discretion of the league commissioner.",
    "Contact your team captain or the league commissioner with any questions about eligibility status.",
  ]},
  {section:"St Pius X Ground Rules",icon:"🏟️",items:[
    "The home run line appears deceiving. From left field, the yellow marker is actually behind the screen — balls striking the netting is a HOME RUN.",
    "Please keep the dugout fences closed to keep more balls in play (this applies also to the softball field in center field).",
    "Restrooms are located down the left field line.",
    "Parking is off Consuelo Street (behind the church at the end of the street).",
  ]},
  {section:"Boomers 60/70 — Game Rules",icon:"🟣",items:[
    "2:15 hour time limit — finish by 2:30.",
    "Games are 7 innings, or as many as possible within 2½ hours.",
    "Free substitution on defense.",
    "No stealing.",
    "No advancement on wild pitches.",
    "Batted ball that hits outfield grass: batter CANNOT be thrown out at first base.",
    "Overthrows are ONE base only.",
    "Everyone bats! If someone is injured or must leave, crunch the lineup.",
    "Unlimited Courtesy Runners (please use as necessary) — Courtesy Runner is the last RECORDED OUT.",
    "Must be 60 or older to pitch.",
    "Players 70+ may opt to use aluminum bats.",
  ]},
  {section:"Boomers 60/70 — Age & Eligibility",icon:"🎂",items:[
    "Age is based on Year of Birth: 2026 − YOB = Age.",
    "2026 − 1966 = 60  |  2026 − 1967 = 59  |  2026 − 1968 = 58",
    "Age exemptions: teams may carry up to two (2) players who are 58 or 59 years old.",
    "Exemption players (age 58/59) are NOT permitted to pitch.",
  ]},
  {section:"Boomers 60/70 — Costs",icon:"💵",items:[
    "$25 per player — Registration & Insurance (one-time charge per year).",
    "$20 per player, per game — covers field rental and umpire. Prepaid is preferred.",
  ]},
];

/* ─── SHARED COMPONENTS ─────────────────────────────────────────────────── */
function TLogo({ name, size=80 }) {
  const src = TEAM_LOGOS[name];
  if (src) return (
    <div style={{width:size,height:size,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <img src={src} alt={name} loading="lazy" style={{width:"100%",height:"100%",objectFit:"contain",display:"block",flexShrink:0}} />
    </div>
  );
  const color = TEAM_COLORS[name] || "#002d6e";
  const boxSize = size * 0.75;
  return (
    <div style={{width:size,height:size,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:boxSize,height:boxSize,borderRadius:8,background:`${color}18`,border:`2px solid ${color}50`,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:boxSize*0.28,color,textTransform:"uppercase"}}>{name.slice(0,4)}</span>
      </div>
    </div>
  );
}

function PageHero({ label, title, subtitle, children }) {
  return (
    <div style={{background:"#fff",borderBottom:"3px solid #002d6e",padding:"28px clamp(12px,3vw,40px) 0",overflow:"hidden",width:"100%"}}>
      <div style={{maxWidth:1400,margin:"0 auto",overflow:"hidden"}}>
        {label && <div style={{fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:"#002d6e",marginBottom:4}}>{label}</div>}
        <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:"clamp(36px,7vw,80px)",textTransform:"uppercase",color:"#111",lineHeight:1}}>{title}</h1>
        {subtitle && <div style={{fontSize:12,color:"rgba(0,0,0,0.38)",marginTop:4}}>{subtitle}</div>}
        {children}
      </div>
    </div>
  );
}

function TabBar({ items, active, onChange }) {
  return (
    <div style={{display:"flex",gap:0,marginTop:14,borderTop:"1px solid rgba(0,0,0,0.07)",overflowX:"auto",scrollbarWidth:"none",WebkitOverflowScrolling:"touch"}}>
      {items.map((item,i) => (
        <button key={i} onClick={() => onChange(i)} style={{
          fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:18,
          textTransform:"uppercase",color:active===i?"#111":"rgba(0,0,0,0.38)",
          padding:"14px 0",marginRight:24,background:"none",border:"none",
          borderBottom:active===i?"3px solid #111":"3px solid transparent",
          cursor:"pointer",whiteSpace:"nowrap",transition:"color .15s, border-color .15s",flexShrink:0,
        }}>{item}</button>
      ))}
    </div>
  );
}

function Card({ children, style={}, topBlue=true }) {
  return (
    <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderTop:topBlue?"3px solid #002d6e":"1px solid rgba(0,0,0,0.09)",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.05)",...style}}>
      {children}
    </div>
  );
}

const FAKE_RECAPS = {
  default: (away, aScore, home, hScore) => {
    const winner = aScore > hScore ? away : home;
    const loser = aScore > hScore ? home : away;
    const winScore = Math.max(aScore, hScore);
    const loseScore = Math.min(aScore, hScore);
    const margin = winScore - loseScore;
    const intros = [
      `In a ${margin <= 1 ? "nail-biting finish" : margin >= 6 ? "dominant performance" : "solid outing"}, ${winner} took care of business against ${loser}, ${winScore}–${loseScore}.`,
      `${winner} left no doubt on Saturday, dispatching ${loser} by a score of ${winScore}–${loseScore}.`,
      `It was all ${winner} from the first pitch, as they cruised past ${loser} ${winScore}–${loseScore}.`,
    ];
    const middles = [
      `The offense came alive in the middle innings, stringing together hits and capitalizing on a pair of errors. The pitching staff held firm when it mattered most.`,
      `A big third inning proved to be the difference, as ${winner} sent eight batters to the plate and never looked back. ${loser} mounted a late rally but couldn't close the gap.`,
      `Timely hitting was the story of the day. ${winner} went 6-for-12 with runners in scoring position, while ${loser} left several key opportunities stranded on the bases.`,
    ];
    const outros = [
      `${winner} improves their division record and stays in the hunt for a top playoff seed. ${loser} will look to bounce back next Saturday.`,
      `With the win, ${winner} moves up in the division standings. Both teams are back in action next Saturday.`,
      `A well-earned victory for ${winner}. The manager praised the team's focus and energy throughout the game.`,
    ];
    const pick = (arr) => arr[Math.floor(Math.random()*arr.length)];
    return `${pick(intros)} ${pick(middles)} ${pick(outros)}`;
  }
};

function FinalCard({ g, onTeamClick }) {
  const [showRecap, setShowRecap] = useState(false);
  const aWin = g.aScore > g.hScore, hWin = g.hScore > g.aScore;
  const recap = FAKE_RECAPS.default(g.away, g.aScore, g.home, g.hScore);
  return (
    <>
      {showRecap && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}} onClick={() => setShowRecap(false)}>
          <div style={{background:"#fff",borderRadius:12,maxWidth:500,width:"100%",overflow:"hidden"}} onClick={e => e.stopPropagation()}>
            <div style={{background:"#001a3e",padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{minWidth:0,flex:1}}>
                <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",marginBottom:2}}>RECAP · {g.div}</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,color:"#fff",textTransform:"uppercase",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.away} vs {g.home}</div>
              </div>
              <button onClick={() => setShowRecap(false)} style={{background:"rgba(255,255,255,0.1)",border:"none",color:"#fff",borderRadius:6,width:28,height:28,cursor:"pointer",flexShrink:0,marginLeft:8}}>✕</button>
            </div>
            <div style={{padding:"14px 16px",borderBottom:"1px solid rgba(0,0,0,0.07)"}}>
              {[{name:g.away,score:g.aScore,won:aWin},{name:g.home,score:g.hScore,won:hWin}].map((side,i) => (
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:i===0?8:0}}>
                  <TLogo name={side.name} size={56} />
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:side.won?900:600,fontSize:18,textTransform:"uppercase",color:side.won?"#111":"rgba(0,0,0,0.35)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{side.name}</span>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:side.won?900:400,fontSize:36,color:side.won?"#111":"rgba(0,0,0,0.22)",flexShrink:0}}>{side.score}</span>
                </div>
              ))}
            </div>
            <div style={{padding:"14px 16px"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#002d6e",marginBottom:8,textTransform:"uppercase",letterSpacing:".08em"}}>📰 Game Recap</div>
              <p style={{fontSize:15,color:"#222",lineHeight:1.75,fontWeight:400}}>{recap}</p>
            </div>
          </div>
        </div>
      )}
      <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderTop:"3px solid #002d6e",borderRadius:10,overflow:"hidden",display:"flex",flexDirection:"column",width:"100%"}}>
        <div style={{padding:"8px 10px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:9,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"rgba(0,0,0,0.25)"}}>FINAL</span>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            {g.note && <span style={{fontSize:9,fontWeight:700,color:"#dc2626",textTransform:"uppercase"}}>{g.note}</span>}
            <span style={{fontSize:9,fontWeight:700,color:"rgba(0,0,0,0.2)",textTransform:"uppercase"}}>{g.div}</span>
          </div>
        </div>
        <div style={{padding:"6px 10px 10px"}}>
          {[{name:g.away,score:g.aScore,won:aWin},{name:g.home,score:g.hScore,won:hWin}].map((side,i) => (
            <div key={i} onClick={() => onTeamClick?.(side.name)} style={{display:"flex",alignItems:"center",gap:8,marginBottom:i===0?6:0,cursor:onTeamClick?"pointer":"default",width:"100%"}}>
              <TLogo name={side.name} size={80} />
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:side.won?900:600,fontSize:18,textTransform:"uppercase",color:side.won?"#111":"rgba(0,0,0,0.28)",lineHeight:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,minWidth:0}}>
                {side.name}
              </div>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:side.won?900:400,fontSize:36,lineHeight:1,color:side.won?"#111":"rgba(0,0,0,0.22)",flexShrink:0,minWidth:32,textAlign:"right"}}>{side.score}</span>
            </div>
          ))}
        </div>
        <div style={{height:1,background:"rgba(0,0,0,0.05)"}} />
        <div onClick={() => setShowRecap(true)} style={{padding:"10px",background:"#002d6e",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,letterSpacing:".06em",textTransform:"uppercase",color:"#fff",textAlign:"center",cursor:"pointer"}}>📰 RECAP</div>
      </div>
    </>
  );
}

function UpcomingCard({ away, home, time, date, field, isNext, status, onTeamClick, onPreview }) {
  const isPPD = status === "PPD" || (status||"").toLowerCase().startsWith("postpone");
  const isCAN = status === "CAN" || (status||"").toLowerCase().startsWith("cancel");
  const statusLabel = isCAN ? "CANCELED" : isPPD ? "POSTPONED" : null;
  return (
    <div onClick={() => !statusLabel && onPreview?.({away, home, time, date, field})}
      style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderTop:statusLabel?"3px solid #c8102e":"3px solid #002d6e",borderLeft:isNext&&!statusLabel?"4px solid #c8102e":"1px solid rgba(0,0,0,0.09)",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.04)",cursor:onPreview&&!statusLabel?"pointer":"default",transition:"box-shadow .12s",width:"100%",minWidth:280,opacity:statusLabel?0.72:1,position:"relative"}}
      onMouseEnter={e=>{if(onPreview&&!statusLabel)e.currentTarget.style.boxShadow="0 4px 16px rgba(0,45,110,0.15)";}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)";}}>
      {statusLabel && (
        <div style={{position:"absolute",top:8,right:8,background:"#c8102e",color:"#fff",padding:"3px 10px",borderRadius:4,fontSize:10,fontWeight:900,letterSpacing:".1em",textTransform:"uppercase",zIndex:2}}>{statusLabel}</div>
      )}
      <div style={{display:"flex",alignItems:"center",padding:"12px 14px",gap:60}}>
        <div style={{display:"flex",flexDirection:"column",gap:8,flex:"0 0 auto",minWidth:0}}>
          {isNext && !statusLabel && <div style={{fontSize:10,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"#c8102e",marginBottom:-2}}>▶ NEXT GAME</div>}
          {[away,home].map((t,i) => (
            <div key={i} onClick={e=>{e.stopPropagation();onTeamClick?.(t);}} style={{display:"flex",alignItems:"center",gap:10,cursor:onTeamClick?"pointer":"default"}}>
              <TLogo name={t} size={60} />
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:"clamp(14px,2vw,24px)",textTransform:"uppercase",color:statusLabel?"#777":"#111",lineHeight:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textDecoration:statusLabel?"line-through":"none"}}>{t}</div>
            </div>
          ))}
        </div>
        <div style={{flexShrink:0,borderLeft:"1px solid rgba(0,0,0,0.08)",paddingLeft:14}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:"clamp(20px,3vw,32px)",color:statusLabel?"#888":"#002d6e",lineHeight:1,textDecoration:statusLabel?"line-through":"none"}}>{time}</div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(12px,1.5vw,15px)",color:"rgba(0,0,0,0.55)",fontWeight:700,marginTop:3}}>{date}</div>
          <div style={{fontSize:"clamp(11px,1.2vw,13px)",color:"rgba(0,0,0,0.4)",marginTop:2,fontWeight:500}}>{field}</div>
          {onPreview && !statusLabel && <div style={{fontSize:10,fontWeight:700,color:"rgba(0,45,110,0.45)",marginTop:4,letterSpacing:".05em"}}>⚾ Preview →</div>}
        </div>
      </div>
    </div>
  );
}

/* ─── GAME PREVIEW MODAL ─────────────────────────────────────────────────── */
function GamePreviewModal({ away, home, time, field, date, onClose }) {
  const [loading, setLoading] = useState(true);
  const [awayRec, setAwayRec] = useState(null);
  const [homeRec, setHomeRec] = useState(null);
  const [h2h, setH2H] = useState(null);
  const [playerModal, setPlayerModal] = useState(null);
  const [awayRoster, setAwayRoster] = useState(TEAM_ROSTERS[away]||[]);
  const [homeRoster, setHomeRoster] = useState(TEAM_ROSTERS[home]||[]);

  useEffect(() => {
    // Load rosters from Supabase
    sbFetch(`lbdc_rosters?select=number,name,team&team=in.(${encodeURIComponent(away)},${encodeURIComponent(home)})&order=id.asc`)
      .then(rows => {
        if (rows && rows.length > 0) {
          setAwayRoster(rows.filter(r=>r.team===away).map(r=>({number:r.number||"",name:r.name||""})));
          setHomeRoster(rows.filter(r=>r.team===home).map(r=>({number:r.number||"",name:r.name||""})));
        }
      }).catch(()=>{});
  }, [away, home]);

  useEffect(() => {
    async function load() {
      try {
        const allSeasons = await sbFetch("seasons?select=id,name&limit=50");
        const isBoomers = BOOMERS_TEAMS.has(away) || BOOMERS_TEAMS.has(home);
        const satIds = getSatSeasonFilter(allSeasons);
        const bomSeason = allSeasons.find(x => x.name.toLowerCase().includes("boomers"));
        if (isBoomers && !bomSeason) { setLoading(false); return; }
        if (!isBoomers && !satIds.length) { setLoading(false); return; }
        const seasonFilter = isBoomers ? `season_id=eq.${bomSeason.id}` : `season_id=in.(${satIds.join(",")})`;
        const rawGames = await sbFetch(`games?select=id,game_date,away_team,home_team,away_score,home_score,status&${seasonFilter}&status=eq.Final&limit=200`);
        const games = dedupGames(rawGames || []);
        const rec = {};
        [away, home].forEach(t => { rec[t] = {w:0,l:0,t:0,rs:0,ra:0,gp:0}; });
        let awayW=0, homeW=0, ties=0;
        (games||[]).forEach(g => {
          if (g.status === "PPD" || g.status === "CAN") return;
          const a=g.away_team, h=g.home_team, as=+g.away_score, hs=+g.home_score;
          if(rec[a]){rec[a].rs+=as;rec[a].ra+=hs;rec[a].gp++;if(as>hs)rec[a].w++;else if(hs>as)rec[a].l++;else rec[a].t++;}
          if(rec[h]){rec[h].rs+=hs;rec[h].ra+=as;rec[h].gp++;if(hs>as)rec[h].w++;else if(as>hs)rec[h].l++;else rec[h].t++;}
          const bothMatch = new Set([a,h]);
          if(bothMatch.has(away)&&bothMatch.has(home)){
            const awayScore=a===away?as:hs, homeScore=a===home?as:hs;
            if(awayScore>homeScore)awayW++;else if(homeScore>awayScore)homeW++;else ties++;
          }
        });
        setAwayRec(rec[away]); setHomeRec(rec[home]); setH2H({awayW,homeW,ties});
      } catch(e) {}
      setLoading(false);
    }
    load();
  }, [away, home]);

  const fmtRec = (r) => r ? `${r.w}-${r.l}${r.t>0?`-${r.t}`:""}` : "0-0";
  const fmtPct = (r) => {
    if(!r||r.gp===0) return ".---";
    return Number((r.w*2+r.t)/((r.gp||1)*2)).toFixed(3).replace(/^0/,"");
  };
  const h2hTotal = h2h ? h2h.awayW+h2h.homeW+h2h.ties : 0;
  const h2hLeader = h2h && h2hTotal>0 ? (h2h.awayW>h2h.homeW?away:h2h.homeW>h2h.awayW?home:"Even") : null;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.72)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      {playerModal && <PlayerStatsModal playerName={playerModal} onClose={()=>setPlayerModal(null)} />}
      <div style={{background:"#fff",borderRadius:14,width:"100%",maxWidth:680,maxHeight:"90vh",overflow:"auto",boxShadow:"0 24px 80px rgba(0,0,0,0.5)"}} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{background:"#001a3e",padding:"16px 20px",borderRadius:"14px 14px 0 0",display:"flex",alignItems:"flex-start",justifyContent:"space-between",position:"sticky",top:0,zIndex:1}}>
          <div>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:"#FFD700",marginBottom:6}}>⚾ Game Preview</div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <TLogo name={away} size={36} />
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,color:"#fff",textTransform:"uppercase",lineHeight:1}}>{away}</span>
              <span style={{color:"rgba(255,255,255,0.35)",fontSize:13,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:400}}>vs</span>
              <TLogo name={home} size={36} />
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,color:"#fff",textTransform:"uppercase",lineHeight:1}}>{home}</span>
            </div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",marginTop:5,letterSpacing:".03em"}}>
              {[time, field, date].filter(Boolean).join(" · ")}
            </div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.12)",border:"none",color:"#fff",borderRadius:6,width:30,height:30,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginLeft:12}}>×</button>
        </div>

        {loading ? (
          <div style={{padding:48,textAlign:"center",color:"#999",fontSize:14}}>Loading preview…</div>
        ) : (
          <div style={{padding:"16px 20px 24px"}}>
            {/* Records row */}
            <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,alignItems:"center",background:"#f8fafc",border:"1px solid rgba(0,0,0,0.07)",borderRadius:10,padding:"16px 12px",marginBottom:16}}>
              {/* Away */}
              <div style={{textAlign:"center"}}>
                <TLogo name={away} size={56} />
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:14,textTransform:"uppercase",color:"#111",marginTop:4,lineHeight:1}}>{away}</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:28,color:"#002d6e",lineHeight:1,marginTop:4}}>{fmtRec(awayRec)}</div>
                <div style={{fontSize:11,color:"rgba(0,0,0,0.4)",fontWeight:600,marginTop:2}}>{fmtPct(awayRec)} PCT</div>
                {awayRec&&awayRec.gp>0&&<div style={{fontSize:10,color:"rgba(0,0,0,0.35)",marginTop:2}}>{awayRec.rs} RS · {awayRec.ra} RA · {awayRec.rs-awayRec.ra>=0?"+":""}{awayRec.rs-awayRec.ra} DIFF</div>}
              </div>
              {/* H2H */}
              <div style={{textAlign:"center",padding:"0 10px",borderLeft:"1px solid rgba(0,0,0,0.07)",borderRight:"1px solid rgba(0,0,0,0.07)"}}>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:".12em",color:"rgba(0,0,0,0.35)",textTransform:"uppercase",marginBottom:6}}>Head to Head</div>
                {h2hTotal>0 ? (
                  <>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,color:"#111",lineHeight:1}}>{h2h.awayW}–{h2h.homeW}{h2h.ties>0?`–${h2h.ties}`:""}</div>
                    <div style={{fontSize:10,color:"rgba(0,0,0,0.4)",marginTop:3,lineHeight:1.3,maxWidth:80}}>
                      {h2hLeader==="Even" ? "Series even" : `${h2hLeader} leads`}
                    </div>
                  </>
                ) : (
                  <div style={{fontSize:11,color:"rgba(0,0,0,0.3)",fontStyle:"italic",lineHeight:1.3}}>First<br/>meeting</div>
                )}
              </div>
              {/* Home */}
              <div style={{textAlign:"center"}}>
                <TLogo name={home} size={56} />
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:14,textTransform:"uppercase",color:"#111",marginTop:4,lineHeight:1}}>{home}</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:28,color:"#002d6e",lineHeight:1,marginTop:4}}>{fmtRec(homeRec)}</div>
                <div style={{fontSize:11,color:"rgba(0,0,0,0.4)",fontWeight:600,marginTop:2}}>{fmtPct(homeRec)} PCT</div>
                {homeRec&&homeRec.gp>0&&<div style={{fontSize:10,color:"rgba(0,0,0,0.35)",marginTop:2}}>{homeRec.rs} RS · {homeRec.ra} RA · {homeRec.rs-homeRec.ra>=0?"+":""}{homeRec.rs-homeRec.ra} DIFF</div>}
              </div>
            </div>

            {/* Rosters */}
            <div style={{fontSize:11,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:"rgba(0,0,0,0.35)",marginBottom:10}}>Rosters — click a player for stats</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[[away,awayRoster],[home,homeRoster]].map(([teamName,roster])=>(
                <div key={teamName} style={{background:"#f8fafc",border:"1px solid rgba(0,0,0,0.07)",borderRadius:10,overflow:"hidden"}}>
                  <div style={{background:"#002d6e",padding:"8px 12px",display:"flex",alignItems:"center",gap:8}}>
                    <TLogo name={teamName} size={22} />
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:13,textTransform:"uppercase",color:"#fff",letterSpacing:".06em"}}>{teamName}</span>
                  </div>
                  {roster.length===0 ? (
                    <div style={{padding:"12px 14px",fontSize:12,color:"rgba(0,0,0,0.35)",fontStyle:"italic"}}>Roster not listed</div>
                  ) : (
                    <div>
                      {roster.map((p,i)=>(
                        <div key={i} onClick={()=>setPlayerModal(p.name)}
                          style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px",borderBottom:i<roster.length-1?"1px solid rgba(0,0,0,0.05)":"none",cursor:"pointer",transition:"background .1s"}}
                          onMouseEnter={e=>e.currentTarget.style.background="#e8f0ff"}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          {p.number
                            ? <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,color:"rgba(0,0,0,0.3)",width:22,textAlign:"right",flexShrink:0}}>#{p.number}</span>
                            : <span style={{width:22,flexShrink:0}}/>}
                          <span style={{fontSize:13,fontWeight:600,color:"#002d6e",flex:1}}>{p.name}</span>
                          <span style={{fontSize:10,color:"rgba(0,45,110,0.4)"}}>▸</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── TICKER ─────────────────────────────────────────────────────────────── */
function Ticker({ setTab }) {
  const [preview, setPreview] = useState(null);
  const [boxModal, setBoxModal] = useState(null); // {game, batting, pitching}
  const [liveScores, setLiveScores] = useState({}); // key: "away|home" → {away_score, home_score, status}
  // Live admin-saved schedule (lbdc_schedules). null = not loaded yet → fall back to hardcoded.
  const [liveSat, setLiveSat] = useState(null);
  const [liveBom, setLiveBom] = useState(null);
  const today = new Date(); today.setHours(0,0,0,0);
  const parseLabel = (lbl) => { const d = new Date(lbl + " 2026"); return isNaN(d) ? new Date(0) : d; };

  // Build [{label, games:[{away,home,time,field,date,status,notes}]}] from saved data,
  // else from hardcoded SCHED. Saved data already has status/notes/venue baked in, so
  // separate "overrides" merging is no longer needed.
  const satWeeks = liveSat
    ? (() => {
        const byDate = {};
        liveSat.forEach(g => { if(!byDate[g.date]) byDate[g.date]=[]; byDate[g.date].push(g); });
        return Object.entries(byDate)
          .sort((a,b)=> parseLabel(a[0]) - parseLabel(b[0]))
          .map(([label, gs]) => ({ label, games: gs }));
      })()
    : SCHED.map(w => ({
        label: w.label,
        games: w.fields.flatMap(f => f.games.map(g => ({...g, field:f.name, date:w.label}))),
      }));

  // Find the most recently played week (latest date <= today), fallback to next upcoming
  let weekIdx = -1;
  for (let i = satWeeks.length - 1; i >= 0; i--) { if (parseLabel(satWeeks[i].label) <= today) { weekIdx = i; break; } }
  if (weekIdx < 0) { weekIdx = satWeeks.findIndex(w => parseLabel(w.label) >= today); }
  if (weekIdx < 0) weekIdx = 0;
  const week = satWeeks[weekIdx] || { label: "", games: [] };

  const satGames = week.games || [];
  const boomerList = liveBom || BOOMERS_SCHED;
  const boomerGame = boomerList.find(g => g.date === week.label);
  const games = boomerGame ? [...satGames, boomerGame] : satGames;

  useEffect(() => {
    // Pull the FULL admin-saved schedule (sat + bom). Status, venue, time, and added/
    // deleted games all come through here — not just the PPD/CAN overrides previously
    // grafted on top of the hardcoded SCHED.
    Promise.all([
      sbFetch("lbdc_schedules?id=eq.sat&select=data"),
      sbFetch("lbdc_schedules?id=eq.bom&select=data"),
    ]).then(([sr, br]) => {
      if (sr && sr[0] && Array.isArray(sr[0].data)) setLiveSat(sr[0].data);
      if (br && br[0] && Array.isArray(br[0].data)) setLiveBom(br[0].data);
    }).catch(()=>{});
  }, []);

  useEffect(() => {
    // Compute this week's ISO date (e.g., "2026-04-18") so we only fetch games for THIS week.
    const _weekDate = (() => {
      const d = new Date(week.label + " 2026");
      if (isNaN(d)) return null;
      const y = d.getFullYear(), mm = String(d.getMonth()+1).padStart(2,"0"), dd = String(d.getDate()).padStart(2,"0");
      return `${y}-${mm}-${dd}`;
    })();
    const dateFilter = _weekDate ? `&game_date=eq.${_weekDate}` : "";
    // Fetch scores for this week's games (filtered by date so dupes across weeks don't leak in)
    const pairs = games.map(g=>`and(away_team.eq.${encodeURIComponent(g.away)},home_team.eq.${encodeURIComponent(g.home)})`).join(",");
    sbFetch(`games?select=id,game_date,away_team,home_team,away_score,home_score,status,headline&or=(${pairs})&away_score=not.is.null${dateFilter}&order=id.desc&limit=40`)
      .then(rows => {
        const deduped = dedupGames(rows || []);
        const m = {};
        deduped.forEach(r => {
          const k = `${r.away_team}|${r.home_team}`;
          m[k] = r;
        });
        setLiveScores(m);
      }).catch(()=>{});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week.label]);

  const openFinalBox = async (sc) => {
    const [bat, pit] = await Promise.all([
      // Try fetching with new columns; fall back to old set if columns don't exist in DB yet
      sbFetch(`batting_lines?select=player_name,team,ab,r,h,rbi,bb,k,doubles,triples,hr,sb,sf,sac,fc,roe,cs&game_id=eq.${sc.id}&order=id.asc&limit=100`)
        .catch(() => sbFetch(`batting_lines?select=player_name,team,ab,r,h,rbi,bb,k,doubles,triples,hr,sb&game_id=eq.${sc.id}&order=id.asc&limit=100`)),
      sbFetch(`pitching_lines?select=player_name,team,ip,h,r,er,bb,k,decision&game_id=eq.${sc.id}&order=id.asc&limit=50`),
    ]).catch(()=>[[], []]);
    setBoxModal({game:sc, batting:bat, pitching:pit});
  };

  return (
    <>
      {preview && <GamePreviewModal {...preview} onClose={()=>setPreview(null)} />}
      {boxModal && <BoxScoreModal game={boxModal.game} batting={boxModal.batting} pitching={boxModal.pitching} onClose={()=>setBoxModal(null)} />}
      <div className="ticker-outer" style={{background:"#001a3e",borderBottom:"2px solid #002d6e",display:"flex",alignItems:"stretch",overflow:"hidden",width:"100%"}}>
        <div style={{display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",padding:"6px 10px",borderRight:"1px solid rgba(255,255,255,0.15)",flexShrink:0,gap:2}}>
          <span className="ticker-lbdc-text" style={{fontSize:18,lineHeight:1}}>⚾</span>
          <span className="ticker-lbdc-text" style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:11,letterSpacing:".1em",textTransform:"uppercase",color:"#FFD700",lineHeight:1}}>Diamond Classics</span>
          <span className="ticker-lbdc-date" style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:13,color:"#fff",lineHeight:1,whiteSpace:"nowrap"}}>{week.label}</span>
        </div>
        <div className="ticker-scroll" style={{display:"flex",alignItems:"stretch",overflowX:"auto",overflowY:"hidden",scrollbarWidth:"none",msOverflowStyle:"none",flex:"1 1 0",minWidth:0,WebkitOverflowScrolling:"touch"}}>
          {games.map((g,i) => {
            const sc = liveScores[`${g.away}|${g.home}`];
            const isFinal = sc && (sc.status==="Final"||sc.status==="final");
            const awayWin = isFinal && sc.away_score > sc.home_score;
            const homeWin = isFinal && sc.home_score > sc.away_score;
            const isPPD = !isFinal && (g.status==="PPD" || (g.status||"").toLowerCase().startsWith("postpone"));
            const isCAN = !isFinal && (g.status==="CAN" || (g.status||"").toLowerCase().startsWith("cancel"));
            const statusTag = isCAN ? "CAN" : isPPD ? "PPD" : null;
            const muted = !!statusTag;
            return (
              <div key={i} onClick={()=>{ if (isFinal) return openFinalBox(sc); if (statusTag) return; setPreview({away:g.away,home:g.home,time:g.time,field:g.field,date:week.label+" 2026"}); }}
                className="ticker-game-item"
                style={{display:"flex",flexDirection:"column",justifyContent:"center",padding:"6px 16px",borderRight:"1px solid rgba(255,255,255,0.1)",minWidth:160,gap:3,cursor:statusTag?"default":"pointer",transition:"background .12s",flexShrink:0,opacity:muted?0.6:1}}
                onMouseEnter={e=>{ if(!statusTag) e.currentTarget.style.background="rgba(255,255,255,0.07)"; }}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <span className="ticker-time" style={{fontSize:11,color:isFinal?"#4ade80":statusTag?"#FFD700":"#ff6b6b",fontWeight:700,whiteSpace:"nowrap",lineHeight:1}}>
                  {statusTag ? statusTag : (isFinal?"FINAL":g.time)}
                </span>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <TLogo name={g.away} size={22} />
                  <span className="ticker-team-name" style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:15,color:isFinal?(awayWin?"#fff":"rgba(255,255,255,0.45)"):"#fff",textTransform:"uppercase",whiteSpace:"nowrap",lineHeight:1,textDecoration:statusTag?"line-through":"none"}}>{TICKER_NAME[g.away]||g.away}</span>
                  {isFinal&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,color:awayWin?"#FFD700":"rgba(255,215,0,0.45)",marginLeft:"auto"}}>{sc.away_score}</span>}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <TLogo name={g.home} size={22} />
                  <span className="ticker-team-name" style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:15,color:isFinal?(homeWin?"#fff":"rgba(255,255,255,0.45)"):"rgba(255,255,255,0.7)",textTransform:"uppercase",whiteSpace:"nowrap",lineHeight:1,textDecoration:statusTag?"line-through":"none"}}>{TICKER_NAME[g.home]||g.home}</span>
                  {isFinal&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,color:homeWin?"#FFD700":"rgba(255,215,0,0.45)",marginLeft:"auto"}}>{sc.home_score}</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{display:"flex",alignItems:"center",padding:"0 14px",flexShrink:0,borderLeft:"1px solid rgba(255,255,255,0.1)",cursor:"pointer"}} onClick={() => setTab("schedule")}>
          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,color:"#FFD700",whiteSpace:"nowrap"}}>Schedule »</span>
        </div>
      </div>
    </>
  );
}

/* ─── NAVBAR ─────────────────────────────────────────────────────────────── */
function Navbar({ tab, setTab }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const mainLinks = [["home","Home"],["scores","Scores"],["schedule","Schedule"],["tournaments","Tournaments"],["standings","Standings"],["teams","Teams"],["stats","Stats"],["payments","💳 Payments"],["admin","⚙ Admin"]];
  const moreLinks = [["history","History"],["rules","Rules"],["directions","🏟️ Field Directions"],["sponsors","🤝 Sponsors"],["photos","📸 Photos & Videos"],["signup","📋 Player Sign Up"],["graphics","📅 Schedule Graphics"],["availability","📅 My Availability"],["contact","📞 Contact"]];
  const handleNav = (id) => { setTab(id); setMenuOpen(false); setMoreOpen(false); window.scrollTo(0,0); };
  const moreActive = moreLinks.some(([id]) => id === tab);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);
  // Close more dropdown on outside click
  useEffect(() => {
    if (!moreOpen) return;
    const close = () => setMoreOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [moreOpen]);
  return (
    <>
      <nav style={{background:"#fff",borderBottom:"3px solid #002d6e",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",height:62,display:"flex",alignItems:"center",padding:"0 clamp(12px,3vw,32px)",position:"relative",zIndex:400}}>
        <div style={{maxWidth:1400,margin:"0 auto",width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",flexShrink:0}} onClick={() => handleNav("home")}>
            <div style={{width:38,height:38,borderRadius:"50%",background:"#002d6e",border:"2px solid #002d6e",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <span style={{fontSize:20,lineHeight:1}}>⚾</span>
            </div>
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,letterSpacing:".08em",textTransform:"uppercase",color:"#002d6e",lineHeight:1}}>Diamond Classics</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"rgba(0,0,0,0.4)",letterSpacing:".04em",lineHeight:1}}>Long Beach Men's 50+ Baseball</div>
            </div>
          </div>
          <ul style={{display:"flex",gap:0,listStyle:"none",margin:"0 auto",padding:0,flexShrink:1,minWidth:0}} className="desktop-nav">
            {mainLinks.map(([id,label]) => (
              <li key={id}>
                <button onClick={() => handleNav(id)} className="nav-btn" style={{
                  fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,
                  letterSpacing:".06em",textTransform:"uppercase",
                  color:tab===id?"#002d6e":"#555",background:"none",border:"none",
                  cursor:"pointer",padding:"7px 12px",borderRadius:6,
                  borderBottom:tab===id?"2px solid #002d6e":"2px solid transparent",
                  whiteSpace:"nowrap",
                }}>{label}</button>
              </li>
            ))}
            {/* More dropdown */}
            <li style={{position:"relative"}}>
              <button onClick={e=>{e.stopPropagation();setMoreOpen(o=>!o);}} className="nav-btn" style={{
                fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,
                letterSpacing:".06em",textTransform:"uppercase",
                color:moreActive||moreOpen?"#002d6e":"#555",background:"none",border:"none",
                cursor:"pointer",padding:"7px 12px",borderRadius:6,
                borderBottom:moreActive||moreOpen?"2px solid #002d6e":"2px solid transparent",
                whiteSpace:"nowrap",
              }}>More {moreOpen?"▴":"▾"}</button>
              {moreOpen && (
                <div onClick={e=>e.stopPropagation()} style={{position:"absolute",top:"100%",right:0,background:"#fff",border:"1px solid rgba(0,0,0,0.1)",borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,0.12)",minWidth:200,zIndex:9999,overflow:"hidden",marginTop:2}}>
                  {moreLinks.map(([id,label]) => (
                    <button key={id} onClick={()=>handleNav(id)} style={{
                      display:"block",width:"100%",textAlign:"left",padding:"12px 18px",
                      fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,
                      letterSpacing:".04em",textTransform:"uppercase",
                      color:tab===id?"#002d6e":"#333",background:tab===id?"#f0f4ff":"transparent",
                      border:"none",borderBottom:"1px solid rgba(0,0,0,0.06)",cursor:"pointer",
                    }}>{label}</button>
                  ))}
                </div>
              )}
            </li>
          </ul>
          <button onClick={() => setMenuOpen(!menuOpen)} className="hamburger" style={{
            display:"none",background:"none",border:"none",cursor:"pointer",
            padding:"8px",flexDirection:"column",gap:5,alignItems:"center",justifyContent:"center",
          }}>
            <span style={{display:"block",width:24,height:2,background:menuOpen?"#002d6e":"#111",borderRadius:2,transition:"all .2s",transform:menuOpen?"rotate(45deg) translate(5px,5px)":"none"}} />
            <span style={{display:"block",width:24,height:2,background:"#111",borderRadius:2,transition:"all .2s",opacity:menuOpen?0:1}} />
            <span style={{display:"block",width:24,height:2,background:menuOpen?"#002d6e":"#111",borderRadius:2,transition:"all .2s",transform:menuOpen?"rotate(-45deg) translate(5px,-5px)":"none"}} />
          </button>
        </div>
      </nav>
      {menuOpen && (
        <div style={{position:"fixed",top:62,left:0,right:0,bottom:0,zIndex:9999,display:"flex",flexDirection:"column"}}>
          <div style={{background:"#fff",borderBottom:"3px solid #002d6e",boxShadow:"0 8px 24px rgba(0,0,0,0.2)",overflowY:"auto",maxHeight:"calc(100vh - 62px)"}}>
          <button onClick={() => handleNav("home")} style={{
            display:"flex",alignItems:"center",gap:12,width:"100%",textAlign:"left",
            fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,
            letterSpacing:".06em",textTransform:"uppercase",
            color:"#002d6e",background:"rgba(0,45,110,0.06)",
            border:"none",borderBottom:"2px solid #002d6e",
            cursor:"pointer",padding:"18px 20px",
          }}>⚾ Home</button>
          {mainLinks.filter(([id])=>id!=="home").map(([id,label]) => (
            <button key={id} onClick={() => handleNav(id)} style={{
              display:"block",width:"100%",textAlign:"left",
              fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:22,
              letterSpacing:".06em",textTransform:"uppercase",
              color:tab===id?"#002d6e":"#111",background:tab===id?"rgba(0,45,110,0.04)":"none",
              border:"none",borderBottom:"1px solid rgba(0,0,0,0.06)",
              cursor:"pointer",padding:"18px 20px",
            }}>{label}</button>
          ))}
          <div style={{padding:"8px 20px 4px",fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:"rgba(0,0,0,0.3)"}}>More</div>
          {moreLinks.map(([id,label]) => (
            <button key={id} onClick={() => handleNav(id)} style={{
              display:"block",width:"100%",textAlign:"left",
              fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:20,
              letterSpacing:".06em",textTransform:"uppercase",
              color:tab===id?"#002d6e":"#555",background:tab===id?"rgba(0,45,110,0.04)":"none",
              border:"none",borderBottom:"1px solid rgba(0,0,0,0.06)",
              cursor:"pointer",padding:"15px 20px",
            }}>{label}</button>
          ))}
          </div>
          <div style={{flex:1,background:"rgba(0,0,0,0.3)"}} onClick={() => setMenuOpen(false)} />
        </div>
      )}
    </>
  );
}

/* ─── HOME PAGE ──────────────────────────────────────────────────────────── */
function HomePage({ setTab, setTeamDetail }) {
  const [topTeams, setTopTeams] = useState([...ALL_TEAMS].filter(t=>t.divKey==="SAT").sort((a,b) => b.w!==a.w?b.w-a.w:a.l-b.l).slice(0,8));
  const [boomersTeams, setBoomersTeams] = useState([...ALL_TEAMS].filter(t=>t.divKey==="BOM").sort((a,b) => b.w!==a.w?b.w-a.w:a.l-b.l));
  const today = new Date(); today.setHours(0,0,0,0);
  const parseSchedLabel = (lbl) => { const d = new Date(lbl + " 2026"); return isNaN(d) ? new Date(0) : d; };
  // Live admin-saved Saturday schedule (lbdc_schedules id=sat). null = not yet loaded; falls back to hardcoded SCHED.
  const [liveSat, setLiveSat] = useState(null);
  const SCHED_FALLBACK_FLAT = SCHED.flatMap(w =>
    w.fields.flatMap(f => f.games.map(g => ({...g, field:f.name, date:w.label})))
  );
  const allUpcomingGames = liveSat || SCHED_FALLBACK_FLAT;
  const upcomingByDate = {};
  allUpcomingGames.forEach(g => { if(!upcomingByDate[g.date]) upcomingByDate[g.date] = []; upcomingByDate[g.date].push(g); });
  const upcomingDates = Object.keys(upcomingByDate).sort((a,b) => parseSchedLabel(a) - parseSchedLabel(b));
  // ">= today" so today's games (e.g. a Saturday morning) appear in "This Week" — not skipped to next week.
  const nextDate = upcomingDates.find(d => parseSchedLabel(d) >= today) || upcomingDates[upcomingDates.length - 1] || "";
  const nextWeekLabel = nextDate;
  const nextGames = (upcomingByDate[nextDate] || []).slice(0,5);
  const [recentGames, setRecentGames] = useState([]);
  const [newsItems, setNewsItems] = useState([]);
  const [standingsDiv, setStandingsDiv] = useState("SAT");
  const [previewGame, setPreviewGame] = useState(null);
  const goTeam = (name) => { setTeamDetail(name); };

  // Live standings fetch
  useEffect(() => {
    const calcRows = (rawGames, divTeams) => {
      const games = dedupGames(rawGames);
      const tm = {};
      divTeams.forEach(t => { tm[t.name] = {w:0,l:0,t:0,rs:0,ra:0,gp:0}; });
      games.forEach(g => {
        if (!g.away_score && g.away_score !== 0) return;
        if (g.status === "PPD" || g.status === "CAN") return;
        const a=g.away_team, h=g.home_team, as=+g.away_score, hs=+g.home_score;
        if(!tm[a]||!tm[h]) return;
        tm[a].rs+=as; tm[a].ra+=hs; tm[a].gp++;
        tm[h].rs+=hs; tm[h].ra+=as; tm[h].gp++;
        if(as>hs){tm[a].w++;tm[h].l++;} else if(hs>as){tm[h].w++;tm[a].l++;} else{tm[a].t++;tm[h].t++;}
      });
      return Object.entries(tm).map(([name,s]) => {
        const pts=s.w*2+s.t, max=(s.gp||1)*2;
        const pct=s.gp===0?"---":Number(pts/max).toFixed(3).replace(/^0/,"");
        return {name,w:s.w,l:s.l,t:s.t,pct,gp:s.gp,rs:s.rs,ra:s.ra};
      }).sort((a,b) => {
        if(b.w!==a.w) return b.w-a.w;
        if(b.l!==a.l) return a.l-b.l;
        return (b.rs-b.ra)-(a.rs-a.ra);
      });
    };
    sbFetch("seasons?select=id,name&limit=50").then(seasons => {
      const satIds = getSatSeasonFilter(seasons);
      const bomSeason = seasons.find(x => x.name.toLowerCase().includes("boomers"));
      return Promise.all([
        satIds.length ? sbFetch(`games?select=id,game_date,away_team,home_team,away_score,home_score,status&season_id=in.(${satIds.join(",")})&status=eq.Final&limit=200`) : [],
        bomSeason ? sbFetch(`games?select=id,game_date,away_team,home_team,away_score,home_score,status&season_id=eq.${bomSeason.id}&status=eq.Final&limit=200`) : [],
      ]);
    }).then(([satGames, bomGames]) => {
      if (satGames.length) setTopTeams(calcRows(satGames, DIV.SAT.teams).slice(0,8));
      if (bomGames.length) setBoomersTeams(calcRows(bomGames, DIV.BOM.teams));
    }).catch(()=>{});
  }, []);

  useEffect(() => {
    // Filter by known Saturday team names — avoids season record confusion
    const satTeams = ["Tribe","Pirates","Titans","Brooklyn","Generals","Black Sox"];
    const tf = satTeams.map(t=>`away_team.eq.${encodeURIComponent(t)}`).join(",");
    const bomTeamList = [...BOOMERS_TEAMS];
    const bf = bomTeamList.map(t=>`away_team.eq.${encodeURIComponent(t)}`).join(",");
    Promise.all([
      sbFetch(`games?select=id,game_date,game_time,home_team,away_team,home_score,away_score,field,status,headline&or=(${tf})&status=not.in.(PPD,CAN)&away_score=not.is.null&game_date=gte.2026-04-01&order=game_date.desc,id.desc&limit=30`)
        .then(data => data.filter(g => satTeams.includes(g.home_team))),
      sbFetch(`games?select=id,game_date,game_time,home_team,away_team,home_score,away_score,field,status,headline&or=(${bf})&status=eq.Final&away_score=not.is.null&game_date=gte.2026-04-01&order=game_date.desc,id.desc&limit=10`)
        .then(data => data.filter(g => BOOMERS_TEAMS.has(g.home_team))),
    ]).then(([satData, bomData]) => {
        const bomDeduped = dedupGames(bomData || []);
        const p1 = dedupGames(satData || []);
        // Merge Boomers + Saturday, sort by date desc then id desc, cap at 6
        const combined = [...p1, ...bomDeduped].sort((a,b) => {
          if (a.game_date && b.game_date) return a.game_date < b.game_date ? 1 : a.game_date > b.game_date ? -1 : b.id - a.id;
          if (a.game_date) return -1; if (b.game_date) return 1;
          return b.id - a.id;
        });
        setRecentGames(combined.slice(0, 6));
      })
      .catch(() => {});
    sbFetch("news?select=id,title,body,event_date,pinned,style,created_at&order=pinned.desc,created_at.desc&limit=10")
      .then(data => setNewsItems(data || []))
      .catch(() => {});
    // Live Saturday schedule (so admin venue/time/status edits flow through to Home)
    sbFetch("lbdc_schedules?id=eq.sat&select=data")
      .then(rows => { if (rows && rows[0] && Array.isArray(rows[0].data)) setLiveSat(rows[0].data); })
      .catch(() => {});
  }, []);
  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",overflowX:"hidden",width:"100%"}}>
      {previewGame && <GamePreviewModal {...previewGame} onClose={()=>setPreviewGame(null)} />}
      {/* HERO */}
      <div style={{width:"100%",borderBottom:"4px solid #002d6e",lineHeight:0,overflow:"hidden"}}>
        <img src="/hero111.jpg" alt="Long Beach Diamond Classics" className="hero-img" fetchpriority="high" loading="eager" style={{display:"block"}} />
      </div>
      {getPageContent("home_announcement") && <div style={{maxWidth:900,margin:"0 auto",padding:"0 clamp(12px,3vw,40px)"}} dangerouslySetInnerHTML={sanitizeHTML(getPageContent("home_announcement"))} />}

      <div style={{maxWidth:1400,margin:"0 auto",padding:"28px clamp(12px,3vw,40px) 60px",width:"100%",boxSizing:"border-box"}}>
        <div className="home-two-col" style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:32,alignItems:"start",minWidth:0}}>
          <div style={{minWidth:0,overflow:"hidden"}}>
            {newsItems.length > 0 && (
              <div style={{marginBottom:32}}>
                <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:14}}>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:"#b45309",marginBottom:4}}>From the Commissioner</div>
                    <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:34,textTransform:"uppercase",color:"#111",lineHeight:1}}>News & Events</h2>
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {newsItems.map((item,i) => (
                    <div key={item.id||i} style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderLeft:`4px solid ${item.pinned?"#b45309":"#002d6e"}`,borderRadius:10,padding:"16px 20px",boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
                      <div style={{display:"flex",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                        {item.pinned && <span style={{background:"#b45309",color:"#fff",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,textTransform:"uppercase",letterSpacing:".05em",flexShrink:0,marginTop:2}}>📌 Pinned</span>}
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,color:"#111",textTransform:"uppercase",lineHeight:1.1}}>{item.title}</div>
                          {item.event_date && <div style={{fontSize:11,color:"#b45309",fontWeight:700,marginTop:3,textTransform:"uppercase",letterSpacing:".05em"}}>📅 {new Date(item.event_date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"long",day:"numeric",year:"numeric"})}</div>}
                          {item.body && (() => { let s={}; try{s=item.style?JSON.parse(item.style):{};}catch(e){} return <div style={{fontSize:Number(s.fontSize||14),fontFamily:s.fontFamily||"inherit",fontWeight:Number(s.fontWeight||400),fontStyle:s.fontStyle||"normal",color:s.color||"#444",textAlign:s.textAlign||"left",marginTop:8,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{item.body}</div>; })()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {nextGames.length > 0 && (
              <div style={{marginBottom:32}}>
                <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:14}}>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:"#002d6e",marginBottom:4}}>{(() => { const d = parseSchedLabel(nextDate); if (!d || isNaN(d)) return "On Deck"; return d.getTime() === today.getTime() ? "Today" : "This Week"; })()}</div>
                    <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:34,textTransform:"uppercase",color:"#111",lineHeight:1}}>Upcoming Matchups</h2>
                  </div>
                  <span onClick={() => setTab("schedule")} style={{color:"#002d6e",fontWeight:700,fontSize:13,cursor:"pointer"}}>Full Schedule →</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(380px,100%),1fr))",gap:10}}>
                  {nextGames.map((g,i) => <UpcomingCard key={i} away={g.away} home={g.home} time={g.time} date={nextWeekLabel ? `${nextWeekLabel}, 2026` : ""} onTeamClick={goTeam} field={g.field} isNext={i===0} status={g.status} onPreview={setPreviewGame} />)}
                </div>
              </div>
            )}
            <div style={{marginBottom:32}}>
              <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:14}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:"#002d6e",marginBottom:4}}>2026 Season</div>
                  <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:34,textTransform:"uppercase",color:"#111",lineHeight:1}}>{recentGames.length > 0 ? "Recent Results" : "Season Preview"}</h2>
                </div>
                {recentGames.length > 0 && <span onClick={() => setTab("scores")} style={{color:"#002d6e",fontWeight:700,fontSize:13,cursor:"pointer"}}>All Scores →</span>}
              </div>
              {recentGames.length > 0
                ? <div className="scores-grid" style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,gridAutoRows:"1fr"}}>
                    {recentGames.map((g,i) => <LiveBoxScoreFinalCard key={i} game={g} onTeamClick={goTeam} />)}
                  </div>
                : <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.08)",borderRadius:14,padding:"32px 24px",textAlign:"center"}}>
                    <div style={{fontSize:36,marginBottom:12}}>⚾</div>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,color:"#002d6e",textTransform:"uppercase",marginBottom:6}}>Season Starting April 11th</div>
                    <div style={{fontSize:14,color:"rgba(0,0,0,0.5)"}}>Check back after opening day for live scores and results.</div>
                  </div>
              }
            </div>
          </div>

          {/* Standings sidebar */}
          <div style={{position:"sticky",top:72}} className="sidebar-standings">
            <Card style={{boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
              <div style={{padding:"14px 20px",borderBottom:"1px solid rgba(0,0,0,0.07)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,textTransform:"uppercase",color:"#111"}}>Standings</span>
                <span onClick={() => setTab("standings")} style={{color:"#002d6e",fontSize:13,fontWeight:700,cursor:"pointer"}}>Full →</span>
              </div>
              <div style={{display:"flex",borderBottom:"1px solid rgba(0,0,0,0.07)"}}>
                {[["SAT","Saturday"],["BOM","Boomers"]].map(([key,label]) => (
                  <div key={key} onClick={() => setStandingsDiv(key)}
                    style={{flex:1,padding:"8px 0",textAlign:"center",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:13,textTransform:"uppercase",letterSpacing:".06em",
                      color: standingsDiv===key ? (key==="BOM"?"#7c3aed":"#002d6e") : "rgba(0,0,0,0.4)",
                      borderBottom: standingsDiv===key ? `2px solid ${key==="BOM"?"#7c3aed":"#002d6e"}` : "2px solid transparent",
                      transition:"color .15s"}}>
                    {label}
                  </div>
                ))}
              </div>
              {(standingsDiv==="SAT" ? topTeams : boomersTeams).map((t,i) => (
                <div key={t.name+t.divKey} onClick={() => goTeam(t.name)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:"1px solid rgba(0,0,0,0.04)",transition:"background .15s",cursor:"pointer"}}
                  onMouseEnter={e => e.currentTarget.style.background="rgba(0,45,110,0.03)"}
                  onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,color: standingsDiv==="BOM"?"#7c3aed":"#002d6e",width:22,textAlign:"center",flexShrink:0}}>{i+1}</span>
                  <TLogo name={t.name} size={110} />
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:16,color:"#111",fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontFamily:"'Barlow Condensed',sans-serif",textTransform:"uppercase"}}>{t.name}</div>
                    <div style={{fontSize:11,color:"rgba(0,0,0,0.38)"}}>{t.divName}</div>
                  </div>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:700,color:"#111",flexShrink:0}}>{t.w}-{t.l}</span>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── SCORES PAGE ─────────────────────────────────────────────────────────  */
function BoxScoreModal({ game, batting, pitching, onClose }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const awayBat = batting.filter(b => b.team === game.away_team);
  const homeBat = batting.filter(b => b.team === game.home_team);
  const awayPit = pitching.filter(p => p.team === game.away_team);
  const homePit = pitching.filter(p => p.team === game.home_team);
  const BatTable = ({ rows: rawRows, team }) => {
    const rows = rawRows.filter(r => !/^totals?$/i.test(r.player_name));
    if (rows.length === 0) return (
      <div style={{marginBottom:16}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,textTransform:"uppercase",color:"#002d6e",marginBottom:6,padding:"6px 10px",background:"#f0f4ff",borderRadius:6}}>{team} — Batting</div>
        <div style={{padding:"12px 10px",color:"#aaa",fontSize:12,fontStyle:"italic"}}>No stats entered for this game.</div>
      </div>
    );
    const note2B = rows.filter(r=>r.doubles>0).map(r=>`${r.player_name}${r.doubles>1?` (${r.doubles})`:""}`).join(", ");
    const note3B = rows.filter(r=>r.triples>0).map(r=>`${r.player_name}${r.triples>1?` (${r.triples})`:""}`).join(", ");
    const noteHR = rows.filter(r=>r.hr>0).map(r=>`${r.player_name}${r.hr>1?` (${r.hr})`:""}`).join(", ");
    // TB = 1B×1 + 2B×2 + 3B×3 + HR×4
    const tbPlayers = rows.filter(r=>r.h>0).map(r=>{
      const singles = Math.max(0,(r.h||0)-(r.doubles||0)-(r.triples||0)-(r.hr||0));
      const tb = singles+(r.doubles||0)*2+(r.triples||0)*3+(r.hr||0)*4;
      return {name:r.player_name, tb};
    }).sort((a,b)=>b.tb-a.tb);
    const noteTB = tbPlayers.map(p=>`${p.name}${p.tb>1?` ${p.tb}`:""}`).join(", ");
    const xbhNotes = [note2B&&`2B: ${note2B}`, note3B&&`3B: ${note3B}`, noteHR&&`HR: ${noteHR}`].filter(Boolean);
    return (
      <div style={{marginBottom:16}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,textTransform:"uppercase",color:"#002d6e",marginBottom:6,padding:"6px 10px",background:"#f0f4ff",borderRadius:6}}>{team} — Batting</div>
        <div style={{overflowX:"auto"}}>
          <table style={{borderCollapse:"collapse",fontSize:12,width:"100%"}}>
            <thead><tr style={{background:"#f8f9fb"}}>
              {["Player","AB","R","H","HR","RBI","BB","SO","SB","SF","SAC","FC","ROE","CS"].map(c=>(
                <th key={c} style={{
                  padding:"5px 6px",
                  textAlign:c==="Player"?"left":"center",
                  fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,
                  textTransform:"uppercase",color:"rgba(0,0,0,0.45)",
                  borderBottom:"1px solid rgba(0,0,0,0.08)",
                  ...(c==="Player" ? {width:120,maxWidth:120} : {width:32,whiteSpace:"nowrap"}),
                }}>{c}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={i} style={{borderBottom:"1px solid rgba(0,0,0,0.05)",background:i%2===0?"#fff":"#fafafa"}}>
                  <td style={{padding:"5px 6px",maxWidth:120,overflow:"hidden"}}>
                    <button type="button" onClick={()=>setSelectedPlayer(r.player_name)} style={{background:"none",border:"none",padding:0,fontWeight:600,cursor:"pointer",color:"#002d6e",textDecoration:"underline",textDecorationStyle:"dotted",fontSize:"inherit",fontFamily:"inherit",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:110,display:"block"}}>{r.player_name}</button>
                  </td>
                  {[r.ab,r.r,r.h,r.hr||0,r.rbi,r.bb,r.k,r.sb||0,r.sf||0,r.sac||0,r.fc||0,r.roe||0,r.cs||0].map((v,j)=>(
                    <td key={j} style={{padding:"5px 6px",textAlign:"center",
                      fontWeight:v>0&&[1,2,4].includes(j)?700:400,
                      color:j===3&&v>0?"#c8102e":"inherit"}}>{v||0}</td>
                  ))}
                </tr>
              ))}
              <tr style={{borderTop:"2px solid rgba(0,0,0,0.1)",background:"#f8f9fb",fontWeight:700}}>
                <td style={{padding:"5px 6px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,textTransform:"uppercase",fontSize:11}}>Totals</td>
                {["ab","r","h","hr","rbi","bb","k","sb","sf","sac","fc","roe","cs"].map(f=>(
                  <td key={f} style={{padding:"5px 6px",textAlign:"center",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900}}>{rows.reduce((s,r)=>s+(r[f]||0),0)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        {(xbhNotes.length > 0 || noteTB) && (
          <div style={{marginTop:6,padding:"7px 10px",background:"#f8f9fb",borderRadius:6,fontSize:11,color:"#444",lineHeight:1.8}}>
            {xbhNotes.map((n,i)=>(
              <span key={i} style={{marginRight:14}}>
                <strong>{n.split(":")[0]}:</strong>{n.slice(n.indexOf(":")+1)}
              </span>
            ))}
            {noteTB && <span><strong>TB:</strong> {noteTB}</span>}
          </div>
        )}
      </div>
    );
  };
  const PitTable = ({ rows: rawPitRows, team }) => {
    const rows = rawPitRows.filter(r => !/^totals?$/i.test(r.player_name));
    if(rows.length === 0) return null;
    const winner = rows.find(r=>r.decision==="W");
    const loser  = rows.find(r=>r.decision==="L");
    const saver  = rows.find(r=>r.decision==="S");
    const decNotes = [
      winner&&`W: ${winner.player_name}`,
      loser&&`L: ${loser.player_name}`,
      saver&&`S: ${saver.player_name}`,
    ].filter(Boolean).join(", ");
    return (
      <div style={{marginBottom:12}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,textTransform:"uppercase",color:"#374151",marginBottom:6,padding:"6px 10px",background:"#f8f9fb",borderRadius:6}}>{team} — Pitching</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{background:"#f8f9fb"}}>
              {["Pitcher","IP","H","R","ER","BB","SO","HR"].map(c=><th key={c} style={{padding:"5px 8px",textAlign:c==="Pitcher"?"left":"center",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,textTransform:"uppercase",color:"rgba(0,0,0,0.45)",borderBottom:"1px solid rgba(0,0,0,0.08)"}}>{c}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={i} style={{borderBottom:"1px solid rgba(0,0,0,0.05)",background:i%2===0?"#fff":"#fafafa"}}>
                  <td style={{padding:"5px 8px",fontWeight:600,whiteSpace:"nowrap"}}>
                    <button type="button" onClick={()=>setSelectedPlayer(r.player_name)} style={{background:"none",border:"none",padding:0,fontWeight:600,cursor:"pointer",color:"#002d6e",textDecoration:"underline",textDecorationStyle:"dotted",fontSize:"inherit",fontFamily:"inherit",whiteSpace:"nowrap"}}>{r.player_name}</button>
                  </td>
                  <td style={{padding:"5px 8px",textAlign:"center"}}>{r.ip}</td>
                  {[r.h,r.r,r.er,r.bb,r.k,r.hr||0].map((v,j)=><td key={j} style={{padding:"5px 8px",textAlign:"center"}}>{v||0}</td>)}
                </tr>
              ))}
              <tr style={{borderTop:"2px solid rgba(0,0,0,0.1)",background:"#f8f9fb"}}>
                <td style={{padding:"5px 8px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,textTransform:"uppercase",fontSize:11}}>Totals</td>
                <td style={{padding:"5px 8px",textAlign:"center",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900}}>—</td>
                {["h","r","er","bb","k","hr"].map(f=>(
                  <td key={f} style={{padding:"5px 8px",textAlign:"center",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900}}>{rows.reduce((s,r)=>s+(r[f]||0),0)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        {decNotes && (
          <div style={{marginTop:6,padding:"7px 10px",background:"#f8f9fb",borderRadius:6,fontSize:11,color:"#444",lineHeight:1.8}}>
            {decNotes.split(", ").map((n,i)=>(
              <span key={i} style={{marginRight:14}}>
                <strong>{n.split(":")[0]}:</strong>{n.slice(n.indexOf(":")+1)}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };
  return (
    <>
    {selectedPlayer && <PlayerStatsModal playerName={selectedPlayer} onClose={()=>setSelectedPlayer(null)} />}
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:1200,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"16px",overflowY:"auto"}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:14,maxWidth:680,width:"100%",overflow:"hidden",marginTop:20,marginBottom:20}} onClick={e=>e.stopPropagation()}>
        <div style={{background:"#002d6e",padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,color:"#fff",textTransform:"uppercase"}}>{game.away_team} vs {game.home_team}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:2}}>{game.game_date ? new Date(game.game_date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"}) : ""} · {game.field || ""}</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:8,width:34,height:34,cursor:"pointer",fontSize:18,flexShrink:0}}>✕</button>
        </div>
        {/* Scoreline */}
        <div style={{padding:"14px 18px",borderBottom:"2px solid rgba(0,0,0,0.08)"}}>
          {[{name:game.away_team,score:game.away_score},{name:game.home_team,score:game.home_score}].map((s,i)=>{
            const won = s.score > (i===0?game.home_score:game.away_score);
            return (
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:i===0?8:0}}>
                <TLogo name={s.name} size={56} />
                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:won?900:500,fontSize:20,textTransform:"uppercase",color:won?"#111":"rgba(0,0,0,0.35)",flex:1}}>{s.name}</span>
                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:won?900:400,fontSize:42,color:won?"#111":"rgba(0,0,0,0.22)"}}>{s.score}</span>
              </div>
            );
          })}
        </div>
        <div style={{padding:"14px 18px"}}>
          {batting.length > 0 && <POTGBadge batting={batting} pitching={pitching} awayTeam={game.away_team} homeTeam={game.home_team} />}
          <BatTable rows={awayBat} team={game.away_team} />
          <BatTable rows={homeBat} team={game.home_team} />
          <PitTable rows={awayPit} team={game.away_team} />
          <PitTable rows={homePit} team={game.home_team} />
        </div>
      </div>
    </div>
    </>
  );
}

/* ─── PLAYER OF THE GAME ─────────────────────────────────────────────────── */
function calcPOTG(batting, pitching, awayTeam, homeTeam) {
  // Score each batter: H×3 + HR×4 + RBI×2 + R×1 + BB×0.5 - K×0.3
  const batScores = batting
    .filter(b => !/^totals?$/i.test(b.player_name))
    .map(b => {
      const score = (b.h||0)*3 + (b.hr||0)*4 + (b.rbi||0)*2 + (b.r||0)*1 + (b.bb||0)*0.5 - (b.k||0)*0.3;
      return { name: b.player_name, team: b.team, score, h: b.h||0, hr: b.hr||0, rbi: b.rbi||0, r: b.r||0, bb: b.bb||0, k: b.k||0, type: "batting" };
    });
  // Score each pitcher: K×1 + (IP×0.5) + W×3 - ER×1.5
  const pitScores = pitching
    .filter(p => !/^totals?$/i.test(p.player_name))
    .map(p => {
      const ip = parseFloat(p.ip)||0;
      const score = (p.k||0)*1 + ip*0.5 + (p.decision==="W"?3:0) - (p.er||0)*1.5;
      return { name: p.player_name, team: p.team, score, ip: p.ip, k: p.k||0, er: p.er||0, decision: p.decision, type: "pitching" };
    });
  const all = [...batScores, ...pitScores].sort((a,b) => b.score - a.score);
  return all[0] || null;
}

function POTGBadge({ batting, pitching, awayTeam, homeTeam }) {
  const potg = calcPOTG(batting, pitching, awayTeam, homeTeam);
  if (!potg || potg.score < 1) return null;
  const isBat = potg.type === "batting";
  const stats = isBat
    ? [potg.h&&`${potg.h}H`, potg.hr&&`${potg.hr} HR`, potg.rbi&&`${potg.rbi} RBI`, potg.r&&`${potg.r} R`].filter(Boolean).join(", ")
    : [`${potg.ip} IP`, potg.k&&`${potg.k}K`, potg.decision==="W"&&"W"].filter(Boolean).join(", ");
  return (
    <div style={{background:"linear-gradient(135deg,#FFD700 0%,#f59e0b 100%)",borderRadius:10,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:12,boxShadow:"0 2px 8px rgba(245,158,11,0.3)"}}>
      <span style={{fontSize:28,flexShrink:0}}>⭐</span>
      <div>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:"rgba(0,0,0,0.5)",marginBottom:2}}>Player of the Game</div>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,color:"#111",lineHeight:1}}>{potg.name}</div>
        <div style={{fontSize:12,color:"rgba(0,0,0,0.6)",marginTop:2}}>{potg.team} · {isBat?"Batting":"Pitching"}{stats?` · ${stats}`:""}</div>
      </div>
    </div>
  );
}

function buildRealRecap(game, batting, pitching) {
  if (game.status === "PPD") return "This game was postponed.";
  if (game.away_score == null || game.home_score == null) return "Score not yet available.";
  if (game.away_score === 0 && game.home_score === 0) return "Final score: 0–0. No runs were scored in this game.";
  const winner = game.away_score > game.home_score ? game.away_team : game.home_team;
  const loser = game.away_score > game.home_score ? game.home_team : game.away_team;
  const winScore = Math.max(game.away_score, game.home_score);
  const loseScore = Math.min(game.away_score, game.home_score);
  const margin = winScore - loseScore;
  const winBat = batting.filter(b => b.team === winner);
  const loseBat = batting.filter(b => b.team === loser);
  const winPit = pitching.filter(p => p.team === winner);
  const losePit = pitching.filter(p => p.team === loser);
  const wp = winPit.find(p => p.decision === "W");
  const lp = losePit.find(p => p.decision === "L");
  // Top hitter by hits, then RBI
  const topHitters = [...winBat].sort((a,b) => (b.h||0)-(a.h||0)||(b.rbi||0)-(a.rbi||0)).slice(0,3).filter(p=>p.h>=2);
  const hrs = winBat.filter(p => p.hr > 0);
  let recap = "";
  if (margin >= 8) recap += `${winner} put on an offensive clinic, hammering ${loser} ${winScore}–${loseScore}. `;
  else if (margin <= 1) recap += `${winner} edged ${loser} in a nail-biter, ${winScore}–${loseScore}. `;
  else recap += `${winner} topped ${loser} ${winScore}–${loseScore}. `;
  if (topHitters.length) {
    const names = topHitters.map(p => {
      const extra = [];
      if (p.hr > 0) extra.push(`${p.hr} HR`);
      if (p.doubles > 0) extra.push(`${p.doubles} 2B`);
      return `${p.player_name} (${p.h}-for-${p.ab}${extra.length?", "+extra.join(", "):""}, ${p.rbi} RBI)`;
    });
    recap += `Leading the way offensively: ${names.join("; ")}. `;
  }
  if (hrs.length && !topHitters.some(h=>h.hr>0)) {
    recap += `${hrs.map(p=>`${p.player_name}`).join(" and ")} went deep for ${winner}. `;
  }
  if (wp) recap += `${wp.player_name} got the win on the mound. `;
  if (lp) recap += `${lp.player_name} took the loss for ${loser}. `;
  const winTot = winBat.reduce((s,r)=>({h:s.h+(r.h||0),ab:s.ab+(r.ab||0)}),{h:0,ab:0});
  if (winTot.ab > 0) recap += `${winner} finished with ${winTot.h} hits on the day.`;
  return recap || `${winner} defeated ${loser} ${winScore}–${loseScore}.`;
}

function LiveBoxScoreFinalCard({ game, onTeamClick }) {
  const [showBox, setShowBox] = useState(false);
  const [batting, setBatting] = useState([]);
  const [pitching, setPitching] = useState([]);
  const [boxLoaded, setBoxLoaded] = useState(false);
  const aWin = game.away_score > game.home_score, hWin = game.home_score > game.away_score;
  // Fetch box score, falling back to sibling game records if a team's rows are missing
  const loadBoxData = async () => {
    const enc = s => encodeURIComponent(s);
    let [bat, pit] = await Promise.all([
      sbFetch(`batting_lines?select=player_name,team,ab,r,h,rbi,bb,k,doubles,triples,hr,sb&game_id=eq.${game.id}&order=id.asc&limit=100`),
      sbFetch(`pitching_lines?select=player_name,team,ip,h,r,er,bb,k,decision&game_id=eq.${game.id}&order=id.asc&limit=50`),
    ]);
    const hasAway = bat.some(b => b.team === game.away_team);
    const hasHome = bat.some(b => b.team === game.home_team);
    if (!hasAway || !hasHome) {
      // Only look up SIBLING records for the SAME game_date. Without this date
      // scope we'd pull stats from a totally different past matchup of the
      // same two teams (e.g. a January game's box score appearing under an
      // April game), which made the box score look completely wrong.
      const sameDateSibs = game.game_date
        ? await sbFetch(`games?select=id&away_team=eq.${enc(game.away_team)}&home_team=eq.${enc(game.home_team)}&id=neq.${game.id}&away_score=not.is.null&game_date=eq.${game.game_date}&limit=10`)
        : [];
      const sibIds = sameDateSibs.map(s => s.id);
      if (sibIds.length) {
        const ids = sibIds.join(',');
        const [moreBat, morePit] = await Promise.all([
          sbFetch(`batting_lines?select=player_name,team,ab,r,h,rbi,bb,k,doubles,triples,hr,sb&game_id=in.(${ids})&order=id.asc&limit=200`),
          sbFetch(`pitching_lines?select=player_name,team,ip,h,r,er,bb,k,decision&game_id=in.(${ids})&order=id.asc&limit=100`),
        ]);
        if (!hasAway) bat = [...bat, ...moreBat.filter(b => b.team === game.away_team)];
        if (!hasHome) bat = [...bat, ...moreBat.filter(b => b.team === game.home_team)];
        if (!pit.some(p => p.team === game.away_team)) pit = [...pit, ...morePit.filter(p => p.team === game.away_team)];
        if (!pit.some(p => p.team === game.home_team)) pit = [...pit, ...morePit.filter(p => p.team === game.home_team)];
      }
    }
    // Deduplicate: if same player+team appears multiple times, keep the row with most ABs
    const dedupBat = (rows) => {
      const best = {};
      rows.forEach(r => {
        const k = `${r.team}|${r.player_name}`;
        if (!best[k] || (r.ab||0) > (best[k].ab||0)) best[k] = r;
      });
      return Object.values(best);
    };
    return [dedupBat(bat), pit];
  };
  const handleBoxScore = () => {
    if (!boxLoaded) {
      loadBoxData().then(([bat, pit]) => { setBatting(bat); setPitching(pit); setBoxLoaded(true); setShowBox(true); });
    } else setShowBox(true);
  };
  const recap = boxLoaded ? buildRealRecap(game, batting, pitching) : null;
  const [showRecap, setShowRecap] = useState(false);
  const handleRecap = () => {
    if (!boxLoaded) {
      loadBoxData().then(([bat, pit]) => { setBatting(bat); setPitching(pit); setBoxLoaded(true); setShowRecap(true); });
    } else setShowRecap(true);
  };
  return (
    <>
      {showBox && <BoxScoreModal game={game} batting={batting} pitching={pitching} onClose={() => setShowBox(false)} />}
      {showRecap && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>setShowRecap(false)}>
          <div style={{background:"#fff",borderRadius:12,maxWidth:500,width:"100%",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
            <div style={{background:"#001a3e",padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,color:"#fff",textTransform:"uppercase"}}>{game.away_team} vs {game.home_team}</div>
              <button onClick={()=>setShowRecap(false)} style={{background:"rgba(255,255,255,0.1)",border:"none",color:"#fff",borderRadius:6,width:28,height:28,cursor:"pointer"}}>✕</button>
            </div>
            <div style={{padding:"14px 16px",borderBottom:"1px solid rgba(0,0,0,0.07)"}}>
              {[{name:game.away_team,score:game.away_score,won:aWin},{name:game.home_team,score:game.home_score,won:hWin}].map((s,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:i===0?8:0}}>
                  <TLogo name={s.name} size={56} />
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:s.won?900:600,fontSize:18,textTransform:"uppercase",color:s.won?"#111":"rgba(0,0,0,0.35)",flex:1}}>{s.name}</span>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:s.won?900:400,fontSize:36,color:s.won?"#111":"rgba(0,0,0,0.22)"}}>{s.score}</span>
                </div>
              ))}
            </div>
            <div style={{padding:"14px 16px"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#002d6e",marginBottom:8,textTransform:"uppercase",letterSpacing:".08em"}}>📰 Game Recap</div>
              <p style={{fontSize:15,color:"#222",lineHeight:1.75,fontWeight:400}}>{recap}</p>
            </div>
          </div>
        </div>
      )}
      {(game.status === "PPD" || game.status === "CAN" || (game.status||"").toLowerCase().startsWith("postpone") || (game.status||"").toLowerCase().startsWith("cancel")) ? (
        <div style={{background:"#f5f5f5",border:"1px solid rgba(0,0,0,0.09)",borderTop:"3px solid #999",borderRadius:10,overflow:"hidden",display:"flex",flexDirection:"column",width:"100%",opacity:0.7}}>
          <div style={{padding:"8px 10px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontSize:9,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"rgba(0,0,0,0.4)"}}>POSTPONED</span>
          </div>
          <div style={{padding:"6px 10px 10px"}}>
            {[game.away_team, game.home_team].map((name,i)=>(
              <div key={i} onClick={()=>onTeamClick?.(name)} style={{display:"flex",alignItems:"center",gap:8,marginBottom:i===0?6:0,cursor:"pointer",width:"100%"}}>
                <TLogo name={name} size={80} />
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600,fontSize:18,textTransform:"uppercase",color:"rgba(0,0,0,0.35)",lineHeight:1,flex:1}}>{name}</div>
                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,color:"rgba(0,0,0,0.35)",letterSpacing:".1em"}}>PPD</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderTop:"3px solid #002d6e",borderRadius:10,overflow:"hidden",display:"flex",flexDirection:"column",width:"100%"}}>
          <div style={{padding:"8px 10px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:9,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"rgba(0,0,0,0.25)"}}>FINAL</span>
              {game.game_date && <span style={{fontSize:9,fontWeight:600,color:"rgba(0,0,0,0.35)",letterSpacing:".04em"}}>{new Date(game.game_date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              {cleanHeadline(game.headline) && <span style={{fontSize:9,fontWeight:700,color:"#dc2626",textTransform:"uppercase"}}>{cleanHeadline(game.headline)}</span>}
            </div>
          </div>
          <div style={{padding:"6px 10px 10px"}}>
            {[{name:game.away_team,score:game.away_score,won:aWin},{name:game.home_team,score:game.home_score,won:hWin}].map((s,i)=>(
              <div key={i} onClick={()=>onTeamClick?.(s.name)} style={{display:"flex",alignItems:"center",gap:8,marginBottom:i===0?6:0,cursor:"pointer",width:"100%"}}>
                <TLogo name={s.name} size={80} />
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:s.won?900:600,fontSize:18,textTransform:"uppercase",color:s.won?"#111":"rgba(0,0,0,0.28)",lineHeight:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,minWidth:0}}>{s.name}</div>
                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:s.won?900:400,fontSize:36,lineHeight:1,color:s.won?"#111":"rgba(0,0,0,0.22)",flexShrink:0,minWidth:32,textAlign:"right"}}>{s.score}</span>
              </div>
            ))}
          </div>
          <div style={{height:1,background:"rgba(0,0,0,0.05)"}} />
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr"}}>
            <div onClick={handleRecap} style={{padding:"10px",background:"#002d6e",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,letterSpacing:".06em",textTransform:"uppercase",color:"#fff",textAlign:"center",cursor:"pointer",borderRight:"1px solid rgba(255,255,255,0.15)"}}>📰 RECAP</div>
            <div onClick={handleBoxScore} style={{padding:"10px",background:"#002d6e",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,letterSpacing:".06em",textTransform:"uppercase",color:"#FFD700",textAlign:"center",cursor:"pointer"}}>📊 BOX SCORE</div>
          </div>
        </div>
      )}
    </>
  );
}

function ScoresPage({ setTab, setTeamDetail }) {
  // Tab indices: 0=Spring/Summer 2026, 1=Boomers 60/70
  const [seasonIdx, setSeasonIdx] = useState(0);
  const [weekIdx, setWeekIdx] = useState(0);
  const [fwWeeks, setFwWeeks] = useState([]);
  const [fwLoading, setFwLoading] = useState(false);
  const [fwError, setFwError] = useState(null);
  const goTeam = (name) => { setTeamDetail(name); setTab("teams"); window.scrollTo(0,0); };
  const season = SCORES[seasonIdx];
  const week = season?.weeks?.[weekIdx];
  const isLive = seasonIdx === 0 || seasonIdx === 1; // Spring/Summer (0) and Boomers (1) load from Supabase
  const isFW = false;

  // Load live data whenever we switch to a live tab
  useEffect(() => {
    if (!isLive) return;
    setFwLoading(true);
    setFwError(null);
    setFwWeeks([]);
    // Filter by known team names instead of season lookup — avoids season record confusion
    const satTeams = ["Tribe","Pirates","Titans","Brooklyn","Generals","Black Sox"];
    const bomTeams = [...BOOMERS_TEAMS];
    const teams = seasonIdx === 0 ? satTeams : bomTeams;
    const teamFilter = teams.map(t => `away_team.eq.${encodeURIComponent(t)}`).join(",");
    Promise.resolve(
      sbFetch(`games?select=id,game_date,game_time,home_team,away_team,home_score,away_score,field,status,headline&or=(${teamFilter})&away_score=not.is.null&game_date=gte.2026-04-01&order=game_date.desc,id.desc&limit=200`)
        .then(rows => rows.filter(g => {
          const inLeague = seasonIdx === 0
            ? (satTeams.includes(g.away_team) && satTeams.includes(g.home_team))
            : (BOOMERS_TEAMS.has(g.away_team) && BOOMERS_TEAMS.has(g.home_team));
          return inLeague;
        }))
    )
      .then(games => {
        const deduped = dedupGames(games);
        const weekMap = {};
        deduped.forEach(g => {
          const d = g.game_date || "Unknown";
          if (!weekMap[d]) weekMap[d] = [];
          weekMap[d].push(g);
        });
        const weeks = Object.entries(weekMap)
          .sort(([a],[b]) => b.localeCompare(a))
          .map(([date, gs]) => ({
            date,
            label: date === "Unknown" ? "Unknown Date" : new Date(date + "T12:00:00").toLocaleDateString("en-US", {month:"short", day:"numeric", year:"numeric"}),
            games: gs,
          }));
        setFwWeeks(weeks);
        setFwLoading(false);
      })
      .catch(e => { if(e.message !== "no_games_yet") setFwError(e.message); setFwLoading(false); });
  }, [seasonIdx]);

  const handleSeasonChange = (i) => { setSeasonIdx(i); setWeekIdx(0); };
  const fwWeek = fwWeeks[weekIdx];

  const WeekPills = ({ items, active, onChange }) => (
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
      {items.map((w,i) => (
        <button key={i} onClick={() => onChange(i)} style={{
          padding:"6px 14px", borderRadius:20, cursor:"pointer",
          fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:13,
          letterSpacing:".04em", textTransform:"uppercase",
          background:active===i?"#002d6e":"#fff",
          color:active===i?"#fff":"#555",
          border:`1px solid ${active===i?"#002d6e":"rgba(0,0,0,0.15)"}`,
          transition:"all .15s",
        }}>{w}</button>
      ))}
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",overflowX:"hidden",width:"100%"}}>
      <PageHero label="Results" title="Scores">
        <TabBar items={SCORES.map(s=>s.season)} active={seasonIdx} onChange={handleSeasonChange} />
      </PageHero>
      <div style={{maxWidth:1400,margin:"0 auto",padding:"24px clamp(12px,3vw,40px) 60px"}}>

        {/* LIVE: Box scores from Supabase */}
        {isLive && (
          <>
            {fwLoading && (
              <div style={{textAlign:"center",padding:60,color:"rgba(0,0,0,0.4)"}}>
                <div style={{fontSize:32,marginBottom:12}}>⚾</div>
                Loading box scores from database…
              </div>
            )}
            {fwError && (
              <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"16px 20px",color:"#991b1b",fontSize:14}}>
                ⚠️ {fwError}
              </div>
            )}
            {!fwLoading && !fwError && fwWeeks.length === 0 && (
              <div style={{background:"#fff",borderRadius:12,padding:"48px",textAlign:"center",border:"1px solid rgba(0,0,0,0.09)"}}>
                <div style={{fontSize:40,marginBottom:12}}>⚾</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:24,color:"#111",textTransform:"uppercase"}}>
                  {seasonIdx===0 ? "Season starts April 11" : "No games found"}
                </div>
                <div style={{fontSize:13,color:"rgba(0,0,0,0.45)",marginTop:8}}>
                  {seasonIdx===0 ? "Box scores will appear here after games are entered." : "No game data was returned from the database."}
                </div>
              </div>
            )}
            {!fwLoading && fwWeeks.length > 0 && (
              <>
                <WeekPills items={fwWeeks.map(w=>w.label)} active={weekIdx} onChange={setWeekIdx} />
                {fwWeek && (
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(300px,100%),1fr))",gap:12}}>
                    {fwWeek.games.map((g,i) => (
                      <LiveBoxScoreFinalCard key={i} game={g} onTeamClick={goTeam} />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* SPRING/SUMMER + NABA: static hardcoded data */}
        {!isLive && (
          <>
            {season.weeks.length > 1 && (
              <WeekPills items={season.weeks.map(w=>w.week)} active={weekIdx} onChange={setWeekIdx} />
            )}
            {week && week.games.length === 0 ? (
              <div style={{background:"#fff",borderRadius:12,padding:"48px",textAlign:"center",border:"1px solid rgba(0,0,0,0.09)"}}>
                <div style={{fontSize:40,marginBottom:12}}>⚾</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:28,color:"#111",textTransform:"uppercase"}}>Season Opens April 11th</div>
                <div style={{fontSize:14,color:"rgba(0,0,0,0.45)",marginTop:8}}>Check back after the first games are played!</div>
              </div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(300px,100%),1fr))",gap:12}}>
                {week && week.games.map((g,i) => <FinalCard key={i} g={g} onTeamClick={goTeam} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── SCHEDULE PAGE ───────────────────────────────────────────────────────── */
// Build flat game list from static SCHED for a given week index
const buildStaticSatWeeks = () => SCHED.map(week => ({
  label: week.label,
  games: week.fields.flatMap(f => f.games.map(g => ({...g, field: f.name}))),
}));
const buildStaticBomWeeks = () => BOOMERS_SCHED.map(g => ({
  label: g.date,
  games: [g],
}));

function SchedulePage({ setTab, setTeamDetail }) {
  const parseLabel = (lbl) => { const d = new Date(lbl + " 2026"); return isNaN(d) ? new Date(0) : d; };
  const todayMidnight = () => { const t = new Date(); t.setHours(0,0,0,0); return t; };
  const currentSatIdx = () => {
    const t = todayMidnight();
    const weeks = buildStaticSatWeeks();
    const idx = weeks.findIndex(w => parseLabel(w.label) >= t);
    return idx >= 0 ? idx : weeks.length - 1;
  };
  const currentBomIdx = () => {
    const t = todayMidnight();
    const weeks = buildStaticBomWeeks();
    const idx = weeks.findIndex(w => parseLabel(w.label) >= t);
    return idx >= 0 ? idx : weeks.length - 1;
  };

  const [league, setLeague] = useState(0); // 0=Saturday, 1=Boomers, 2=Tournaments
  const [wk,setWk] = useState(currentSatIdx);
  const [boomerWk, setBoomerWk] = useState(currentBomIdx);
  const [tournGames, setTournGames] = useState([]);
  const [previewGame, setPreviewGame] = useState(null);
  const [schedScores, setSchedScores] = useState({});
  const [boomerScore, setBoomerScore] = useState(null);
  const [satSeasonId, setSatSeasonId] = useState(null);
  const [bomSeasonId, setBomSeasonId] = useState(null);
  const [satWeeks, setSatWeeks] = useState(buildStaticSatWeeks);
  const [bomWeeks, setBomWeeks] = useState(buildStaticBomWeeks);
  const [rsvpGame, setRsvpGame] = useState(null);

  const week = satWeeks[wk] || satWeeks[0];
  const games = week ? week.games : [];
  const dateStr = week ? week.label : "";
  const boomerWeek = bomWeeks[boomerWk] || bomWeeks[0];
  const goTeam = (name) => { setTeamDetail(name); setTab("teams"); window.scrollTo(0,0); };
  const allTeams = ["Tribe","Pirates","Titans","Brooklyn","Generals","Black Sox"];
  const playingTeams = new Set(games.flatMap(g => [g.away, g.home]));
  const byeTeams = allTeams.filter(t => !playingTeams.has(t));

  useEffect(() => {
    sbFetch("tournament_games?select=id,tournament_name,game_date,game_time,field,away_team,home_team,notes&order=tournament_name.asc,game_date.asc,game_time.asc")
      .then(data => setTournGames(data || []))
      .catch(() => {});
    sbFetch("seasons?select=id,name&limit=50").then(seasons => {
      const sat = seasons.find(x => x.name.includes("Diamond Classics Saturdays")) || seasons.find(x => x.name.includes("Spring") && x.name.includes("2026"));
      const bom = seasons.find(x => x.name.toLowerCase().includes("boomers"));
      if (sat) setSatSeasonId(sat.id);
      if (bom) setBomSeasonId(bom.id);
    }).catch(() => {});
    // Load live schedule overrides from lbdc_schedules
    sbFetch("lbdc_schedules?id=in.(sat,bom)&select=id,data").then(rows => {
      rows.forEach(r => {
        if (!r.data || !r.data.length) return;
        const byDate = {};
        r.data.forEach(g => { if(!byDate[g.date]) byDate[g.date]=[]; byDate[g.date].push(g); });
        const weeks = Object.entries(byDate)
          .sort((a,b)=>(toISODate(a[0])||a[0])<(toISODate(b[0])||b[0])?-1:1)
          .map(([label,gs])=>({label,games:gs}));
        if (r.id === "sat") setSatWeeks(weeks);
        if (r.id === "bom") setBomWeeks(weeks);
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (games.length === 0 || !satSeasonId) return;
    const pairs = games.map(g=>`and(away_team.eq.${encodeURIComponent(g.away)},home_team.eq.${encodeURIComponent(g.home)})`).join(",");
    sbFetch(`games?select=id,game_date,away_team,home_team,away_score,home_score,status,headline&season_id=eq.${satSeasonId}&game_date=eq.${toISODate(dateStr)}&or=(${pairs})&away_score=not.is.null&order=id.desc&limit=40`)
      .then(rows => {
        const deduped = dedupGames(rows || []);
        const m = {};
        deduped.forEach(r => { m[`${r.away_team}|${r.home_team}`] = r; });
        setSchedScores(m);
      }).catch(()=>{});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wk, satSeasonId]);

  useEffect(() => {
    const bg = boomerWeek ? boomerWeek.games[0] : null;
    if (!bg || !bomSeasonId) return;
    sbFetch(`games?select=id,game_date,away_team,home_team,away_score,home_score,status,headline&season_id=eq.${bomSeasonId}&game_date=eq.${toISODate(boomerWeek.label)}&away_team=eq.${encodeURIComponent(bg.away)}&home_team=eq.${encodeURIComponent(bg.home)}&away_score=not.is.null&order=id.desc&limit=10`)
      .then(rows => {
        const best = dedupGames(rows || [])[0] || null;
        setBoomerScore(best);
      }).catch(()=>{});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boomerWk, bomSeasonId, bomWeeks]);

  const byTournament = {};
  tournGames.forEach(g => { if (!byTournament[g.tournament_name]) byTournament[g.tournament_name] = []; byTournament[g.tournament_name].push(g); });

  const handleLeagueChange = (i) => { setLeague(i); if(i===0) setWk(currentSatIdx()); else if(i===1) setBoomerWk(currentBomIdx()); };

  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",overflowX:"hidden",width:"100%"}}>
      {previewGame && <GamePreviewModal {...previewGame} onClose={()=>setPreviewGame(null)} />}
      <PageHero label="2026 Season" title="Schedule" subtitle="Away team listed first · Home team listed second">
        <TabBar items={["Saturday Division","Boomers 60/70"]} active={league} onChange={handleLeagueChange} />
      </PageHero>

      {league === 0 && <>
        <div style={{borderBottom:"1px solid rgba(0,0,0,0.07)",background:"#fff",padding:"0 clamp(12px,3vw,40px)"}}>
          <div style={{maxWidth:1400,margin:"0 auto",overflowX:"auto",display:"flex",gap:0,scrollbarWidth:"none"}}>
            {satWeeks.map((s,i) => {
              const isPast = parseLabel(s.label) < todayMidnight();
              return (
              <button key={i} onClick={() => setWk(i)} style={{
                fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,
                textTransform:"uppercase",
                color:wk===i?"#111":isPast?"rgba(0,0,0,0.22)":"rgba(0,0,0,0.38)",
                padding:"12px 16px",background:"none",border:"none",
                borderBottom:wk===i?"3px solid #111":"3px solid transparent",
                cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,
                textDecoration:isPast&&wk!==i?"line-through":"none",
              }}>{s.label}</button>
              );
            })}
          </div>
        </div>
        <div style={{maxWidth:1400,margin:"0 auto",padding:"24px clamp(12px,3vw,40px) 60px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(380px,100%),1fr))",gap:10}}>
            {games.map((g,i) => {
              const sc = schedScores[`${g.away}|${g.home}`];
              if (sc && sc.status === 'Final') {
                return <LiveBoxScoreFinalCard key={i} game={sc} onTeamClick={goTeam} />;
              }
              return <div key={i} style={{width:"100%"}}><UpcomingCard away={g.away} home={g.home} time={g.time} date={dateStr} onTeamClick={goTeam} field={g.field} isNext={i===0} status={g.status} onPreview={setPreviewGame} /></div>;
            })}
          </div>
          {byeTeams.length > 0 && (
            <div style={{display:"flex",alignItems:"center",gap:12,background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderLeft:"3px solid #c8102e",borderRadius:8,padding:"12px 18px",marginTop:16}}>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:12,letterSpacing:"1px",textTransform:"uppercase",color:"#c8102e",flexShrink:0}}>BYE WEEK</span>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                {byeTeams.map(t => (
                  <div key={t} style={{display:"flex",alignItems:"center",gap:6}}>
                    <TLogo name={t} size={40} />
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:"#111",textTransform:"uppercase"}}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </>}

      {league === 1 && <>
        {/* Boomers date tab bar */}
        <div style={{borderBottom:"1px solid rgba(0,0,0,0.07)",background:"#fff",padding:"0 clamp(12px,3vw,40px)"}}>
          <div style={{maxWidth:1400,margin:"0 auto",overflowX:"auto",display:"flex",gap:0,scrollbarWidth:"none"}}>
            {bomWeeks.map((w,i) => {
              const isPast = parseLabel(w.label) < todayMidnight();
              return (
              <button key={i} onClick={()=>setBoomerWk(i)} style={{
                fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,
                textTransform:"uppercase",
                color:boomerWk===i?"#111":isPast?"rgba(0,0,0,0.22)":"rgba(0,0,0,0.38)",
                padding:"12px 16px",background:"none",border:"none",
                borderBottom:boomerWk===i?"3px solid #111":"3px solid transparent",
                cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,
                textDecoration:isPast&&boomerWk!==i?"line-through":"none",
              }}>{w.label}</button>
              );
            })}
          </div>
        </div>
        <div style={{maxWidth:1400,margin:"0 auto",padding:"24px clamp(12px,3vw,40px) 60px"}}>
          {(() => {
            const g = boomerWeek ? boomerWeek.games[0] : null;
            if (!g) return null;
            return (
              <div>
                {boomerScore && boomerScore.status === 'Final'
                  ? <LiveBoxScoreFinalCard game={boomerScore} onTeamClick={goTeam} />
                  : <UpcomingCard away={g.away} home={g.home} time={g.time} date={boomerWeek.label} field={g.field} isNext={false} status={g.status} onTeamClick={goTeam} onPreview={p=>setPreviewGame(p)} />
                }
                {rsvpGame && <BoomersRSVPModal game={rsvpGame} onClose={()=>setRsvpGame(null)} />}
                {!(g.status === "PPD" || g.status === "CAN" || (g.status||"").toLowerCase().startsWith("postpone") || (g.status||"").toLowerCase().startsWith("cancel")) && (
                  <button onClick={()=>setRsvpGame(g)}
                    style={{marginTop:12,width:"100%",padding:"12px",background:"#7c3aed",border:"none",borderRadius:10,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,textTransform:"uppercase",letterSpacing:".06em",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                    👥 Who's Playing This Week?
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      </>}

      {league === 99 && (
        <div style={{maxWidth:1400,margin:"0 auto",padding:"24px clamp(12px,3vw,40px) 60px"}}>
          {Object.keys(byTournament).length === 0 ? (
            <div style={{textAlign:"center",padding:"60px 20px",color:"#aaa",fontSize:16}}>No tournaments scheduled yet.</div>
          ) : Object.entries(byTournament).map(([tname, allTGames]) => {
            const visibleGames = allTGames.filter(g=>g.notes!=="__placeholder__");
            const isPlaceholder = visibleGames.length === 0;
            const locationField = allTGames.find(g=>g.field)?.field;
            return (
            <div key={tname} style={{marginBottom:32}}>
              <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:"#b45309",marginBottom:4}}>Tournament</div>
                  <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:34,textTransform:"uppercase",color:"#111",lineHeight:1}}>🏆 {tname}</h2>
                  {locationField && <div style={{fontSize:13,color:"#888",marginTop:4}}>📍 {locationField}</div>}
                </div>
                <span style={{fontSize:13,color:"#888"}}>{isPlaceholder ? "Schedule coming soon" : `${visibleGames.length} game${visibleGames.length!==1?"s":""}`}</span>
              </div>
              {isPlaceholder ? (
                <div style={{background:"#fff8e1",border:"1px solid #f59e0b",borderRadius:12,padding:"20px 24px",display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:28}}>⏳</span>
                  <div>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,textTransform:"uppercase",color:"#92400e"}}>Schedule Coming Soon</div>
                    <div style={{fontSize:13,color:"#78350f",marginTop:2}}>Game schedule will be posted here when released. Check back soon!</div>
                  </div>
                </div>
              ) : (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {visibleGames.map((g,i) => (
                  <div key={g.id} style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderLeft:"4px solid #b45309",borderRadius:12,padding:"14px 20px",boxShadow:"0 1px 4px rgba(0,0,0,0.04)",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:180}}>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,textTransform:"uppercase",color:"#111"}}>
                        <span style={{cursor:"pointer",color:"#002d6e"}} onClick={()=>goTeam(g.away_team)}>{g.away_team}</span>
                        <span style={{color:"#ccc",fontWeight:400,margin:"0 8px"}}>@</span>
                        <span style={{cursor:"pointer",color:"#002d6e"}} onClick={()=>goTeam(g.home_team)}>{g.home_team}</span>
                      </div>
                      {g.notes && <div style={{fontSize:12,color:"#b45309",fontWeight:700,marginTop:2,textTransform:"uppercase",letterSpacing:".04em"}}>{g.notes}</div>}
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      {g.game_time && <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,color:"#002d6e",lineHeight:1}}>{g.game_time}</div>}
                      {g.game_date && <div style={{fontSize:13,color:"rgba(0,0,0,0.5)",fontWeight:600,marginTop:2}}>{new Date(g.game_date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</div>}
                      {g.field && <div style={{fontSize:12,color:"rgba(0,0,0,0.38)",marginTop:1}}>{g.field}</div>}
                    </div>
                  </div>
                ))}
              </div>
              )}
            </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

/* ─── TOURNAMENTS PAGE ───────────────────────────────────────────────────── */
function TournamentsPage({ setTab, setTeamDetail }) {
  const [tournGames, setTournGames] = useState([]);
  const [tournMeta, setTournMeta] = useState([]);
  const [loading, setLoading] = useState(true);
  const goTeam = (name) => { setTeamDetail(name); setTab("teams"); window.scrollTo(0,0); };

  useEffect(() => {
    Promise.all([
      sbFetch("tournament_games?select=id,tournament_name,game_date,game_time,field,away_team,home_team,notes&order=game_date.asc,game_time.asc"),
      sbFetch("lbdc_tournament_meta?id=eq.main&select=data"),
    ]).then(([data, metaRows]) => {
      setTournGames(data || []);
      if (metaRows && metaRows[0] && Array.isArray(metaRows[0].data)) setTournMeta(metaRows[0].data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Group by tournament name (games already sorted by date within each group)
  const byTournament = {};
  tournGames.forEach(g => { if (!byTournament[g.tournament_name]) byTournament[g.tournament_name] = []; byTournament[g.tournament_name].push(g); });

  // Use admin-defined order from tournMeta if available; fall back to earliest-game-date sort
  const metaOrder = tournMeta.map(m => m.name);
  const allNames = [...new Set([...metaOrder, ...Object.keys(byTournament)])];
  const sortedTournaments = metaOrder.length > 0
    ? allNames.map(name => [name, byTournament[name] || []]).filter(([,g]) => g.length > 0 || metaOrder.includes(name.toString()))
    : Object.entries(byTournament).sort(([,aGames],[,bGames]) => {
        const aDate = aGames.map(g=>g.game_date).filter(Boolean).sort()[0] || "9999";
        const bDate = bGames.map(g=>g.game_date).filter(Boolean).sort()[0] || "9999";
        return aDate.localeCompare(bDate);
      });

  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",overflowX:"hidden",width:"100%"}}>
      <PageHero label="Diamond Classics" title="Tournaments" subtitle="LBDC tournament schedules & brackets" />
      <div style={{maxWidth:1400,margin:"0 auto",padding:"28px clamp(12px,3vw,40px) 60px"}}>
        {loading ? (
          <div style={{textAlign:"center",padding:"60px 20px",color:"#aaa",fontSize:16}}>Loading tournaments…</div>
        ) : Object.keys(byTournament).length === 0 ? (
          <div style={{background:"#fff",borderRadius:14,padding:"60px 24px",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
            <div style={{fontSize:52,marginBottom:16}}>🏆</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:28,color:"#002d6e",textTransform:"uppercase",marginBottom:10}}>Tournaments Coming Soon</div>
            <div style={{fontSize:14,color:"rgba(0,0,0,0.5)",lineHeight:1.6,maxWidth:400,margin:"0 auto"}}>Tournament schedules and brackets will be posted here. Check back soon!</div>
          </div>
        ) : sortedTournaments.map(([tname, allTGames]) => {
          const visibleGames = allTGames.filter(g=>g.notes!=="__placeholder__");
          const isPlaceholder = visibleGames.length === 0;
          const locationField = allTGames.find(g=>g.field)?.field;
          return (
            <div key={tname} style={{marginBottom:32}}>
              <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:"#b45309",marginBottom:4}}>Tournament</div>
                  <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:34,textTransform:"uppercase",color:"#111",lineHeight:1}}>🏆 {tname}</h2>
                  {locationField && <div style={{fontSize:13,color:"#888",marginTop:4}}>📍 {locationField}</div>}
                </div>
                <span style={{fontSize:13,color:"#888"}}>{isPlaceholder ? "Schedule coming soon" : `${visibleGames.length} game${visibleGames.length!==1?"s":""}`}</span>
              </div>
              {isPlaceholder ? (
                <div style={{background:"#fff8e1",border:"1px solid #f59e0b",borderRadius:12,padding:"20px 24px",display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:28}}>⏳</span>
                  <div>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,textTransform:"uppercase",color:"#92400e"}}>Schedule Coming Soon</div>
                    <div style={{fontSize:13,color:"#78350f",marginTop:2}}>Game schedule will be posted here when released. Check back soon!</div>
                  </div>
                </div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {visibleGames.map((g) => (
                    <div key={g.id} style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderLeft:"4px solid #b45309",borderRadius:12,padding:"14px 20px",boxShadow:"0 1px 4px rgba(0,0,0,0.04)",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                      <div style={{flex:1,minWidth:180}}>
                        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,textTransform:"uppercase",color:"#111"}}>
                          <span style={{cursor:"pointer",color:"#002d6e"}} onClick={()=>goTeam(g.away_team)}>{g.away_team}</span>
                          <span style={{color:"#ccc",fontWeight:400,margin:"0 8px"}}>@</span>
                          <span style={{cursor:"pointer",color:"#002d6e"}} onClick={()=>goTeam(g.home_team)}>{g.home_team}</span>
                        </div>
                        {g.notes && <div style={{fontSize:12,color:"#b45309",fontWeight:700,marginTop:2,textTransform:"uppercase",letterSpacing:".04em"}}>{g.notes}</div>}
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        {g.game_time && <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,color:"#002d6e",lineHeight:1}}>{g.game_time}</div>}
                        {g.game_date && <div style={{fontSize:13,color:"rgba(0,0,0,0.5)",fontWeight:600,marginTop:2}}>{new Date(g.game_date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</div>}
                        {g.field && <div style={{fontSize:12,color:"rgba(0,0,0,0.38)",marginTop:1}}>{g.field}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── STANDINGS PAGE ──────────────────────────────────────────────────────── */
const STANDINGS_HISTORY = [
  {
    season:"Fall/Winter 2025-26", champion:"Brooklyn",
    note:"Brooklyn won the regular season. Dodgers won the Championship Game.",
    teams:[
      {seed:1,name:"Brooklyn",  w:8,l:2,t:1,pct:".773",gp:11,rs:97, ra:55, diff:"+42"},
      {seed:2,name:"Dodgers",   w:7,l:4,t:0,pct:".636",gp:11,rs:98, ra:61, diff:"+37"},
      {seed:3,name:"Tribe",     w:6,l:5,t:0,pct:".545",gp:11,rs:118,ra:81, diff:"+37"},
      {seed:4,name:"Generals",  w:5,l:5,t:0,pct:".500",gp:10,rs:68, ra:77, diff:"-9"},
      {seed:5,name:"Titans",    w:3,l:7,t:0,pct:".300",gp:10,rs:60, ra:109,diff:"-49"},
      {seed:6,name:"Pirates",   w:1,l:7,t:1,pct:".167",gp:9, rs:51, ra:109,diff:"-58"},
    ]
  },
];

function StandingsPage({ setTab, setTeamDetail }) {
  const [league, setLeague] = useState(0); // 0=Saturday, 1=Boomers
  const [view, setView] = useState("current"); // "current" | "history"
  const [histIdx, setHistIdx] = useState(0);
  const [liveTeams, setLiveTeams] = useState(null);
  const [boomersTeams, setBoomersTeams] = useState(null);
  const [loadingSat, setLoadingSat] = useState(true);
  const [loadingBom, setLoadingBom] = useState(true);
  const div = DIV["SAT"];
  const goTeam = (name) => { if(setTeamDetail){ setTeamDetail(name); } };
  const hist = STANDINGS_HISTORY[histIdx];

  // Load Saturday standings
  useEffect(() => {
    sbFetch("seasons?select=id,name&limit=50")
      .then(allSeasons => {
        const satIds = getSatSeasonFilter(allSeasons);
        if (!satIds.length) return null;
        return sbFetch(`games?select=id,game_date,away_team,home_team,away_score,home_score,status&season_id=in.(${satIds.join(",")})&status=eq.Final&limit=200`);
      })
      .then(rawGames => {
        if (!rawGames || !rawGames.length) return;
        const games = dedupGames(rawGames);
        const tm = {};
        DIV.SAT.teams.forEach(t => { tm[t.name] = {w:0,l:0,t:0,rs:0,ra:0,gp:0}; });
        games.forEach(g => {
          if (!g.away_score && g.away_score !== 0) return;
          if (g.status === "PPD" || g.status === "CAN") return;
          const a=g.away_team, h=g.home_team, as=+g.away_score, hs=+g.home_score;
          if(!tm[a]||!tm[h]) return;
          tm[a].rs+=as; tm[a].ra+=hs; tm[a].gp++;
          tm[h].rs+=hs; tm[h].ra+=as; tm[h].gp++;
          if(as>hs){tm[a].w++;tm[h].l++;}
          else if(hs>as){tm[h].w++;tm[a].l++;}
          else{tm[a].t++;tm[h].t++;}
        });
        const rows = Object.entries(tm).map(([name,s]) => {
          const pts=s.w*2+s.t, max=(s.gp||1)*2;
          const pct=s.gp===0?"---":Number(pts/max).toFixed(3).replace(/^0/,"");
          const d=s.rs-s.ra;
          return {name,full:name,w:s.w,l:s.l,t:s.t,pct,gp:s.gp,rs:s.rs,ra:s.ra,diff:d>=0?`+${d}`:`${d}`,seed:0};
        }).sort((a,b)=>{
          if(b.w!==a.w) return b.w-a.w;
          if(b.l!==a.l) return a.l-b.l;
          return (b.rs-b.ra)-(a.rs-a.ra);
        }).map((t,i)=>({...t,seed:i+1}));
        setLiveTeams(rows);
      })
      .catch(()=>{})
      .finally(() => setLoadingSat(false));
  }, []);

  // Load Boomers standings
  useEffect(() => {
    sbFetch("seasons?select=id,name&limit=50")
      .then(allSeasons => {
        const s = allSeasons.find(x => x.name.toLowerCase().includes("boomers"));
        if (!s) return null;
        return sbFetch(`games?select=id,game_date,away_team,home_team,away_score,home_score,status&season_id=eq.${s.id}&status=eq.Final&limit=200`);
      })
      .then(rawGames => {
        if (!rawGames || !rawGames.length) return;
        const games = dedupGames(rawGames);
        const tm = {};
        DIV.BOM.teams.forEach(t => { tm[t.name] = {w:0,l:0,t:0,rs:0,ra:0,gp:0}; });
        games.forEach(g => {
          if (!g.away_score && g.away_score !== 0) return;
          if (g.status === "PPD" || g.status === "CAN") return;
          const a=g.away_team, h=g.home_team, as=+g.away_score, hs=+g.home_score;
          if(!tm[a]||!tm[h]) return;
          tm[a].rs+=as; tm[a].ra+=hs; tm[a].gp++;
          tm[h].rs+=hs; tm[h].ra+=as; tm[h].gp++;
          if(as>hs){tm[a].w++;tm[h].l++;}
          else if(hs>as){tm[h].w++;tm[a].l++;}
          else{tm[a].t++;tm[h].t++;}
        });
        const rows = Object.entries(tm).map(([name,s]) => {
          const pts=s.w*2+s.t, max=(s.gp||1)*2;
          const pct=s.gp===0?"---":Number(pts/max).toFixed(3).replace(/^0/,"");
          const d=s.rs-s.ra;
          return {name,full:name,w:s.w,l:s.l,t:s.t,pct,gp:s.gp,rs:s.rs,ra:s.ra,diff:d>=0?`+${d}`:`${d}`,seed:0};
        }).sort((a,b)=>{
          if(b.w!==a.w) return b.w-a.w;
          if(b.l!==a.l) return a.l-b.l;
          return (b.rs-b.ra)-(a.rs-a.ra);
        }).map((t,i)=>({...t,seed:i+1}));
        setBoomersTeams(rows);
      })
      .catch(()=>{})
      .finally(() => setLoadingBom(false));
  }, []);

  const StandingsTable = ({ teams, accent="#002d6e" }) => {
    const leader = teams[0];
    const gb = (t) => {
      if(!leader || t.seed===1) return "—";
      const val = ((leader.w - t.w) + (t.l - leader.l)) / 2;
      return val <= 0 ? "—" : (val % 1 === 0 ? String(val) : val.toFixed(1));
    };
    return (<>
    <div className="mobile-standings" style={{display:"none",padding:"16px 12px"}}>
      {teams.map((t,i) => (
        <div key={t.name} onClick={() => goTeam(t.name)} style={{background:"#fff",borderRadius:10,marginBottom:8,padding:"12px 14px",display:"flex",alignItems:"center",gap:10,border:"1px solid rgba(0,0,0,0.08)",borderLeft:`3px solid ${i===0?"#002d6e":accent}`,cursor:"pointer"}}>
          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,color:i===0?"#002d6e":"rgba(0,0,0,0.25)",width:24,flexShrink:0}}>{t.seed}</span>
          <TLogo name={t.name} size={80} />
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,textTransform:"uppercase",color:"#111",lineHeight:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</div>
            <div style={{fontSize:11,color:"rgba(0,0,0,0.4)",marginTop:2}}>{t.gp} GP · {i>0?`${gb(t)} GB`:"—"}</div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:28,color:"#111",lineHeight:1}}>{t.w}-{t.l}{t.t>0?`-${t.t}`:""}</div>
          </div>
        </div>
      ))}
    </div>
    <div className="desktop-standings standings-table">
      <Card style={{boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
        <div style={{display:"grid",gridTemplateColumns:"50px minmax(260px,1fr) 60px 60px 60px 70px",padding:"10px 20px",background:"#f8f9fb",borderBottom:"1px solid rgba(0,0,0,0.07)"}}>
          {["#","Team","W","L","T","GB"].map((h,hi) => (
            <span key={h} style={{fontSize:11,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:"rgba(0,0,0,0.3)",textAlign:hi>1?"center":"left"}}>{h}</span>
          ))}
        </div>
        {teams.map((t,i) => (
          <div key={t.name} onClick={() => goTeam(t.name)} style={{display:"grid",gridTemplateColumns:"50px minmax(260px,1fr) 60px 60px 60px 70px",padding:"14px 20px",borderBottom:"1px solid rgba(0,0,0,0.04)",alignItems:"center",transition:"background .15s",cursor:"pointer",background:i===0?"rgba(0,45,110,0.02)":"transparent"}}
            onMouseEnter={e => e.currentTarget.style.background="rgba(0,45,110,0.04)"}
            onMouseLeave={e => e.currentTarget.style.background=i===0?"rgba(0,45,110,0.02)":"transparent"}>
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:30,color:i===0?"#002d6e":"rgba(0,0,0,0.22)"}}>{t.seed}</span>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <TLogo name={t.name} size={130} />
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:38,textTransform:"uppercase",color:"#111",lineHeight:1}}>{t.name}</div>
            </div>
            {[t.w,t.l,t.t].map((v,vi) => (
              <span key={vi} style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:vi===0?900:400,color:vi===0?"#111":"rgba(0,0,0,0.55)",textAlign:"center",display:"block"}}>{v}</span>
            ))}
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:700,textAlign:"center",display:"block",color:"rgba(0,0,0,0.45)"}}>{gb(t)}</span>
          </div>
        ))}
      </Card>
    </div>
  </>);
  };

  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",overflowX:"hidden",width:"100%"}}>
      <PageHero label="Diamond Classics" title="Standings">
        <TabBar items={["Saturday Division","Boomers 60/70"]} active={league} onChange={i=>{setLeague(i);setView("current");}} />
      </PageHero>

      {/* ── SATURDAY DIVISION ── */}
      {league === 0 && (
        <div style={{maxWidth:1400,margin:"0 auto",padding:"28px clamp(12px,3vw,40px) 60px"}}>
          <div style={{display:"flex",gap:8,marginBottom:20}}>
            {["Current Season","Season History"].map((label,i) => (
              <button key={i} onClick={()=>setView(i===0?"current":"history")} style={{
                padding:"7px 18px",borderRadius:20,cursor:"pointer",
                fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,
                letterSpacing:".04em",textTransform:"uppercase",
                background:view===(i===0?"current":"history")?"#002d6e":"#fff",
                color:view===(i===0?"current":"history")?"#fff":"#555",
                border:`1px solid ${view===(i===0?"current":"history")?"#002d6e":"rgba(0,0,0,0.15)"}`,
              }}>{label}</button>
            ))}
          </div>

          {view==="current" && <>
            {loadingSat ? (
              <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.07)",borderRadius:10,padding:"40px 20px",textAlign:"center",color:"#888",fontSize:14}}>
                <span style={{fontSize:24,display:"block",marginBottom:8}}>⚾</span>
                Loading standings…
              </div>
            ) : (<>
              {!liveTeams && (
                <div style={{background:"#fff3cd",border:"1px solid #ffc107",borderRadius:8,padding:"12px 18px",marginBottom:20,fontSize:14,color:"#856404"}}>
                  ⚾ <strong>Season opens April 11, 2026</strong> — standings will update after each week's games.
                </div>
              )}
              {liveTeams && (
                <div style={{background:"#e8f5e9",border:"1px solid #a5d6a7",borderRadius:8,padding:"10px 18px",marginBottom:16,fontSize:13,color:"#2e7d32",display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:16}}>✅</span> <strong>Live standings</strong> — updated from the database after each box score entry.
                </div>
              )}
              <StandingsTable teams={liveTeams || div.teams} />
            </>)}
          </>}

          {view==="history" && <>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:24}}>
              {STANDINGS_HISTORY.map((s,i) => (
                <button key={i} onClick={() => setHistIdx(i)} style={{
                  padding:"8px 18px",borderRadius:20,cursor:"pointer",
                  fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,
                  letterSpacing:".04em",textTransform:"uppercase",
                  background:histIdx===i?"#002d6e":"#fff",
                  color:histIdx===i?"#fff":"#555",
                  border:`1px solid ${histIdx===i?"#002d6e":"rgba(0,0,0,0.15)"}`,
                }}>{s.season}</button>
              ))}
            </div>
            <div style={{background:"#002d6e",borderRadius:10,padding:"16px 24px",marginBottom:20,display:"flex",alignItems:"center",gap:16}}>
              <span style={{fontSize:32}}>🏆</span>
              <div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,color:"#FFD700",textTransform:"uppercase"}}>{hist.season} — Final Standings</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,0.6)",marginTop:2}}>{hist.note}</div>
              </div>
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
                <TLogo name={hist.champion} size={80} />
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,color:"#FFD700",textTransform:"uppercase"}}>{hist.champion}</div>
              </div>
            </div>
            <StandingsTable teams={hist.teams} />
          </>}
        </div>
      )}

      {/* ── BOOMERS 60/70 ── */}
      {league === 1 && (
        <div style={{maxWidth:1400,margin:"0 auto",padding:"28px clamp(12px,3vw,40px) 60px"}}>
          <div style={{background:"#f3e8ff",border:"1px solid #d8b4fe",borderRadius:8,padding:"12px 18px",marginBottom:20,fontSize:14,color:"#6b21a8",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>👴</span>
            <span><strong>Boomers 60/70 Division</strong> — Eddie Murray Mashers '56 vs Greg Maddux Magicians '66 · 2026 season</span>
          </div>
          {loadingBom ? (
            <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.07)",borderRadius:10,padding:"40px 20px",textAlign:"center",color:"#888",fontSize:14}}>
              <span style={{fontSize:24,display:"block",marginBottom:8}}>⚾</span>
              Loading standings…
            </div>
          ) : (<>
            {!boomersTeams && (
              <div style={{background:"#fff3cd",border:"1px solid #ffc107",borderRadius:8,padding:"12px 18px",marginBottom:20,fontSize:14,color:"#856404"}}>
                ⚾ <strong>Season underway</strong> — standings will update after each game is entered.
              </div>
            )}
            <StandingsTable teams={boomersTeams || DIV.BOM.teams} accent="#7c3aed" />
          </>)}
        </div>
      )}
    </div>
  );
}

/* ─── TEAM DETAIL PAGE ────────────────────────────────────────────────────── */
/* ─── PLAYER STATS MODAL ──────────────────────────────────────────────── */
function PlayerStatsModal({ playerName, onClose }) {
  const [allSeasons, setAllSeasons] = useState(null);
  const [gameLog, setGameLog] = useState([]);
  const [curSeasonSid, setCurSeasonSid] = useState(null);
  const [pitSeasons, setPitSeasons] = useState(null);
  const [showAllSeasons, setShowAllSeasons] = useState(false);
  const [showAllGames, setShowAllGames] = useState(false);

  const SEASON_GAMES = 15;

  useEffect(() => {
    async function load() {
      try {
        const enc = encodeURIComponent(`*${playerName}*`);
        const lines = await sbFetch(`batting_lines?player_name=ilike.${enc}&select=game_id,team,ab,r,h,doubles,triples,hr,rbi,bb,k,hbp,sf,sb&order=game_id.asc&limit=1000`);
        if (!Array.isArray(lines) || lines.length === 0) { setAllSeasons([]); return; }

        const gameIds = [...new Set(lines.map(l => l.game_id))];
        const games = await sbFetch(`games?id=in.(${gameIds.join(",")})&select=id,season_id,game_date,away_team,home_team,away_score,home_score,status&order=game_date.desc`);
        // Dedupe duplicate game records (same date + teams) from captains double-submitting box scores
        const dedupedGames = dedupGames(games);
        const validGameIds = new Set(dedupedGames.map(g => g.id));
        const dedupedLines = lines.filter(l => validGameIds.has(l.game_id));
        const seasonIds = [...new Set(dedupedGames.map(g => g.season_id))];
        const seasonList = await sbFetch(`seasons?id=in.(${seasonIds.join(",")})&select=id,name,year&order=year.asc`);

        // All sat season IDs (same logic as getSatSeasonFilter)
        const satSidSet = new Set(seasonList.filter(s => s.name.includes("Diamond Classics Saturdays") || (s.name.includes("Spring") && s.name.includes("2026"))).map(s => s.id));
        const curSat = seasonList.find(s => s.name.includes("Diamond Classics Saturdays")) || seasonList.find(s => s.name.includes("Spring") && s.name.includes("2026")) || seasonList[seasonList.length - 1];
        if (curSat) setCurSeasonSid(curSat.id);

        const seasonNameMap = Object.fromEntries(seasonList.map(s => [s.id, s.name]));
        const gameMap = Object.fromEntries(dedupedGames.map(g => [g.id, g]));

        // Group lines by season — merge all sat season IDs into one "current season" bucket
        const bySeasonId = {};
        for (const l of dedupedLines) {
          const g = gameMap[l.game_id];
          if (!g) continue;
          // Normalize: treat all sat season IDs as the same bucket
          const sid = (satSidSet.size > 0 && satSidSet.has(g.season_id)) ? (curSat?.id || g.season_id) : g.season_id;
          const name = satSidSet.has(g.season_id) ? (seasonList.find(s => s.name.includes("Diamond Classics Saturdays"))?.name || seasonList.find(s => s.name.includes("Spring") && s.name.includes("2026"))?.name || "Spring/Summer 2026") : (seasonNameMap[g.season_id]||"?");
          if (!bySeasonId[sid]) bySeasonId[sid] = { sid, name, games: new Set(), ab:0,r:0,h:0,d:0,t:0,hr:0,rbi:0,bb:0,k:0,hbp:0,sf:0,sb:0 };
          const s = bySeasonId[sid];
          s.games.add(l.game_id);
          s.ab+=(l.ab||0); s.r+=(l.r||0); s.h+=(l.h||0); s.d+=(l.doubles||0);
          s.t+=(l.triples||0); s.hr+=(l.hr||0); s.rbi+=(l.rbi||0); s.bb+=(l.bb||0);
          s.k+=(l.k||0); s.hbp+=(l.hbp||0); s.sf+=(l.sf||0); s.sb+=(l.sb||0);
        }

        const result = Object.values(bySeasonId).map(s => ({
          sid: s.sid, name: s.name, gp: s.games.size,
          ab:s.ab, r:s.r, h:s.h, d:s.d, t:s.t, hr:s.hr, rbi:s.rbi, bb:s.bb, k:s.k, hbp:s.hbp, sf:s.sf, sb:s.sb,
        }));
        setAllSeasons(result);

        // Build game log for current season (all sat season IDs)
        const linesByGameId = {};
        for (const l of dedupedLines) {
          if (!linesByGameId[l.game_id]) linesByGameId[l.game_id] = l;
        }
        const log = dedupedGames
          .filter(g => (satSidSet.size > 0 ? satSidSet.has(g.season_id) : curSat && g.season_id === curSat.id) && g.status === "Final")
          .map(g => {
            const l = linesByGameId[g.id];
            if (!l) return null;
            const isAway = l.team === g.away_team;
            const myScore = isAway ? +g.away_score : +g.home_score;
            const oppScore = isAway ? +g.home_score : +g.away_score;
            const opp = isAway ? g.home_team : g.away_team;
            return {
              date: g.game_date,
              opp,
              isHome: !isAway,
              myScore,
              oppScore,
              won: myScore > oppScore,
              ab: l.ab||0, r: l.r||0, h: l.h||0, d: l.doubles||0,
              t: l.triples||0, hr: l.hr||0, rbi: l.rbi||0, bb: l.bb||0, k: l.k||0, sb: l.sb||0,
            };
          })
          .filter(Boolean);
        setGameLog(log);

        // Fetch pitching
        try {
          const pitEnc = encodeURIComponent(`*${playerName}*`);
          const pitLines = await sbFetch(`pitching_lines?player_name=ilike.${pitEnc}&select=game_id,ip,h,r,er,bb,k,hr,decision&order=game_id.asc&limit=500`);
          if (Array.isArray(pitLines) && pitLines.length > 0) {
            const pitGameIds = [...new Set(pitLines.map(l => l.game_id))];
            const pitGames = await sbFetch(`games?id=in.(${pitGameIds.join(",")})&select=id,season_id,game_date,away_team,home_team,away_score,home_score&order=id.asc`);
            // Dedupe duplicate game records — keep only one record per real game
            const pitDedupedGames = dedupGames(pitGames);
            const pitValidIds = new Set(pitDedupedGames.map(g => g.id));
            const dedupedPitLines = pitLines.filter(l => pitValidIds.has(l.game_id));
            const pitSeasonIds = [...new Set(pitDedupedGames.map(g => g.season_id))];
            const pitSeasonList = await sbFetch(`seasons?id=in.(${pitSeasonIds.join(",")})&select=id,name&order=id.asc`);
            const pitSeasonNameMap = Object.fromEntries(pitSeasonList.map(s=>[s.id,s.name]));
            const pitGameSeasonMap = Object.fromEntries(pitDedupedGames.map(g=>[g.id,g.season_id]));
            const pitBySeason = {};
            for (const l of dedupedPitLines) {
              const sid = pitGameSeasonMap[l.game_id];
              if (!sid) continue;
              if (!pitBySeason[sid]) pitBySeason[sid] = {name:pitSeasonNameMap[sid]||"?",app:0,ip:0,h:0,r:0,er:0,bb:0,k:0,hr:0,w:0,l:0,sv:0};
              const s = pitBySeason[sid];
              s.app++; s.ip+=parseFloat(l.ip)||0; s.h+=l.h||0; s.r+=l.r||0; s.er+=l.er||0;
              s.bb+=l.bb||0; s.k+=l.k||0; s.hr+=l.hr||0;
              if(l.decision==="W") s.w++; if(l.decision==="L") s.l++; if(l.decision==="S") s.sv++;
            }
            const pitResult = Object.entries(pitBySeason).map(([sid,s])=>({
              ...s, sid,
              ipDisplay:`${Math.floor(s.ip)}.${Math.round((s.ip%1)*3)}`,
              era: s.ip>0?((s.er/s.ip)*9).toFixed(2):"---",
              whip: s.ip>0?((s.h+s.bb)/s.ip).toFixed(2):"---",
            }));
            setPitSeasons(pitResult);
          } else {
            setPitSeasons([]);
          }
        } catch(e) { setPitSeasons([]); }
      } catch(e) { console.error(e); setAllSeasons([]); setPitSeasons([]); }
    }
    load();
  }, [playerName]);

  const fmtAvg = (h,ab) => ab>0 ? (h/ab).toFixed(3).replace(/^0/,"") : ".---";
  const fmtObp = (h,bb,hbp,ab,sf) => { const d=ab+bb+hbp+sf; return d>0?((h+bb+hbp)/d).toFixed(3).replace(/^0/,""):".---"; };
  const fmtSlg = (h,d,t,hr,ab) => ab>0?((h+d+2*t+3*hr)/ab).toFixed(3).replace(/^0/,""):".---";

  const curSeason = allSeasons && allSeasons.find(s => s.sid === curSeasonSid);
  const careerTot = allSeasons && allSeasons.length > 0 ? allSeasons.reduce((a,s) => ({
    gp:a.gp+s.gp, ab:a.ab+s.ab, r:a.r+s.r, h:a.h+s.h, d:a.d+s.d, t:a.t+s.t,
    hr:a.hr+s.hr, rbi:a.rbi+s.rbi, bb:a.bb+s.bb, k:a.k+s.k, hbp:a.hbp+s.hbp, sf:a.sf+s.sf, sb:a.sb+s.sb,
  }), {gp:0,ab:0,r:0,h:0,d:0,t:0,hr:0,rbi:0,bb:0,k:0,hbp:0,sf:0,sb:0}) : null;

  const proj = curSeason && curSeason.gp > 0 ? (() => {
    const f = SEASON_GAMES / curSeason.gp;
    const rnd = v => Math.round(v * f);
    return { gp:SEASON_GAMES, ab:rnd(curSeason.ab), r:rnd(curSeason.r), h:rnd(curSeason.h),
      d:rnd(curSeason.d), t:rnd(curSeason.t), hr:rnd(curSeason.hr), rbi:rnd(curSeason.rbi),
      bb:rnd(curSeason.bb), k:rnd(curSeason.k), hbp:curSeason.hbp, sf:curSeason.sf, sb:rnd(curSeason.sb) };
  })() : null;

  // Extract year label from current season name
  const yearLabel = curSeason ? (curSeason.name.match(/\d{4}/)||[""])[0] : (allSeasons && allSeasons.length ? (allSeasons[allSeasons.length-1].name.match(/\d{4}/)||[""])[0] : "");

  const statCols = ["GP","AB","R","H","2B","3B","HR","RBI","BB","SO","SB","AVG"];
  const statVals = (s) => s ? [s.gp,s.ab,s.r,s.h,s.d,s.t,s.hr,s.rbi,s.bb,s.k,s.sb||0,fmtAvg(s.h,s.ab)] : Array(12).fill("—");

  const fmtDate = (d) => {
    if (!d) return "";
    const dt = new Date(d + "T12:00:00");
    return dt.toLocaleDateString("en-US",{month:"short",day:"numeric"});
  };

  const visibleGames = showAllGames ? gameLog : gameLog.slice(0, 5);

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:12,width:"100%",maxWidth:720,maxHeight:"92vh",overflow:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{position:"sticky",top:0,background:"#002d6e",padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",borderRadius:"12px 12px 0 0",zIndex:1}}>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:26,textTransform:"uppercase",color:"#fff",lineHeight:1}}>{playerName}</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:6,color:"#fff",fontSize:22,width:34,height:34,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>

        {allSeasons === null ? (
          <div style={{padding:60,textAlign:"center",color:"#999",fontSize:14}}>Loading stats…</div>
        ) : allSeasons.length === 0 ? (
          <div style={{padding:60,textAlign:"center",color:"#aaa",fontSize:14,fontStyle:"italic"}}>No recorded stats found for {playerName}.<br/><span style={{fontSize:12,marginTop:8,display:"block"}}>Stats may be listed under a slightly different name in the system.</span></div>
        ) : (
          <div style={{padding:"0 0 20px"}}>

            {/* ── Batting Summary ── */}
            <div style={{padding:"16px 20px 8px",display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
              <div style={{fontWeight:700,fontSize:17,color:"#111"}}>{yearLabel} Batting</div>
              <button onClick={()=>setShowAllSeasons(v=>!v)} style={{background:"none",border:"none",color:"#2563eb",fontSize:13,fontWeight:600,cursor:"pointer",padding:0}}>
                {showAllSeasons ? "Hide" : "See All"}
              </button>
            </div>
            <div style={{overflowX:"auto",borderTop:"1px solid #e5e7eb",borderBottom:"1px solid #e5e7eb"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead>
                  <tr style={{background:"#f9fafb"}}>
                    <th style={{padding:"8px 16px 8px 20px",textAlign:"left",fontWeight:700,fontSize:11,color:"#6b7280",letterSpacing:".07em",whiteSpace:"nowrap",borderBottom:"1px solid #e5e7eb"}}>STATS</th>
                    {statCols.map(c=>(
                      <th key={c} style={{padding:"8px 10px",textAlign:"center",fontWeight:700,fontSize:11,color:"#6b7280",letterSpacing:".07em",whiteSpace:"nowrap",borderBottom:"1px solid #e5e7eb"}}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Regular Season */}
                  <tr style={{borderBottom:"1px solid #f0f0f0"}}>
                    <td style={{padding:"10px 16px 10px 20px",fontWeight:600,color:"#111",whiteSpace:"nowrap"}}>Regular Season</td>
                    {statVals(curSeason).map((v,i)=>(
                      <td key={i} style={{padding:"10px",textAlign:"center",color:i===10?"#111":"#333",fontWeight:i===10?700:400}}>{v}</td>
                    ))}
                  </tr>
                  {/* Projected */}
                  {proj && (
                    <tr style={{borderBottom:"1px solid #f0f0f0",background:"#fafafa"}}>
                      <td style={{padding:"10px 16px 10px 20px",fontWeight:600,color:"#555",whiteSpace:"nowrap",fontStyle:"italic"}}>Projected</td>
                      {statVals(proj).map((v,i)=>(
                        <td key={i} style={{padding:"10px",textAlign:"center",color:i===10?"#555":"#888",fontStyle:"italic"}}>{v}</td>
                      ))}
                    </tr>
                  )}
                  {/* Career */}
                  <tr style={{borderTop:"2px solid #002d6e",background:"#fff"}}>
                    <td style={{padding:"10px 16px 10px 20px",fontWeight:700,color:"#111",whiteSpace:"nowrap"}}>Career</td>
                    {statVals(careerTot).map((v,i)=>(
                      <td key={i} style={{padding:"10px",textAlign:"center",color:i===10?"#002d6e":"#333",fontWeight:700}}>{v}</td>
                    ))}
                  </tr>
                  {/* Season-by-season breakdown (See All) */}
                  {showAllSeasons && allSeasons.map((s,i)=>(
                    <tr key={i} style={{borderTop:"1px solid #e5e7eb",background:i%2===0?"#f9fafb":"#fff"}}>
                      <td style={{padding:"8px 16px 8px 20px",color:"#555",fontSize:12,whiteSpace:"nowrap"}}>{s.name}</td>
                      {statVals(s).map((v,j)=>(
                        <td key={j} style={{padding:"8px 10px",textAlign:"center",color:j===11?"#002d6e":"#666",fontSize:12,fontWeight:j===11?600:400}}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Recent Games ── */}
            {gameLog.length > 0 && (
              <>
                <div style={{padding:"16px 20px 8px",display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                  <div style={{fontWeight:700,fontSize:17,color:"#111"}}>Recent Games</div>
                  {gameLog.length > 5 && (
                    <button onClick={()=>setShowAllGames(v=>!v)} style={{background:"none",border:"none",color:"#2563eb",fontSize:13,fontWeight:600,cursor:"pointer",padding:0}}>
                      {showAllGames ? "Show Less" : "See All"}
                    </button>
                  )}
                </div>
                <div style={{overflowX:"auto",borderTop:"1px solid #e5e7eb",borderBottom:"1px solid #e5e7eb"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                    <thead>
                      <tr style={{background:"#f9fafb"}}>
                        {["DATE","OPP","RESULT","AB","R","H","2B","3B","HR","RBI","BB","SO","SB"].map(c=>(
                          <th key={c} style={{padding:"8px 8px",textAlign:c==="DATE"||c==="OPP"?"left":"center",fontWeight:700,fontSize:11,color:"#6b7280",letterSpacing:".07em",whiteSpace:"nowrap",borderBottom:"1px solid #e5e7eb",paddingLeft:c==="DATE"?"20px":"8px"}}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleGames.map((g,i)=>(
                        <tr key={i} style={{borderBottom:"1px solid #f0f0f0",background:i%2===0?"#fff":"#fafafa"}}>
                          <td style={{padding:"9px 8px 9px 20px",color:"#555",whiteSpace:"nowrap",fontSize:12}}>{fmtDate(g.date)}</td>
                          <td style={{padding:"9px 8px",color:"#111",whiteSpace:"nowrap",maxWidth:130,overflow:"hidden",textOverflow:"ellipsis"}}>
                            <span style={{color:"#888",marginRight:3}}>{g.isHome?"vs":"@"}</span>{g.opp}
                          </td>
                          <td style={{padding:"9px 8px",textAlign:"center",fontWeight:700,whiteSpace:"nowrap",color:g.won?"#16a34a":"#dc2626"}}>
                            {g.won?"W":"L"} {g.myScore}-{g.oppScore}
                          </td>
                          <td style={{padding:"9px 8px",textAlign:"center"}}>{g.ab}</td>
                          <td style={{padding:"9px 8px",textAlign:"center"}}>{g.r}</td>
                          <td style={{padding:"9px 8px",textAlign:"center",fontWeight:g.h>0?600:400,color:g.h>0?"#111":"#aaa"}}>{g.h}</td>
                          <td style={{padding:"9px 8px",textAlign:"center"}}>{g.d||0}</td>
                          <td style={{padding:"9px 8px",textAlign:"center"}}>{g.t||0}</td>
                          <td style={{padding:"9px 8px",textAlign:"center",color:g.hr>0?"#c8102e":"inherit",fontWeight:g.hr>0?700:400}}>{g.hr||0}</td>
                          <td style={{padding:"9px 8px",textAlign:"center"}}>{g.rbi||0}</td>
                          <td style={{padding:"9px 8px",textAlign:"center"}}>{g.bb||0}</td>
                          <td style={{padding:"9px 8px",textAlign:"center",color:g.k>2?"#dc2626":"inherit"}}>{g.k||0}</td>
                          <td style={{padding:"9px 8px",textAlign:"center",color:g.sb>0?"#002d6e":"inherit",fontWeight:g.sb>0?700:400}}>{g.sb||0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ── Career Pitching ── */}
            {pitSeasons && pitSeasons.length > 0 && (() => {
              const pitCareer = pitSeasons.reduce((a,s)=>({
                app:a.app+s.app, ip:a.ip+s.ip, h:a.h+s.h, r:a.r+s.r, er:a.er+s.er,
                bb:a.bb+s.bb, k:a.k+s.k, hr:a.hr+s.hr, w:a.w+s.w, l:a.l+s.l, sv:a.sv+s.sv,
              }),{app:0,ip:0,h:0,r:0,er:0,bb:0,k:0,hr:0,w:0,l:0,sv:0});
              const fmtIp = ip=>`${Math.floor(ip)}.${Math.round((ip%1)*3)}`;
              const fmtEra = (er,ip)=>ip>0?((er/ip)*9).toFixed(2):"---";
              const fmtWhip = (h,bb,ip)=>ip>0?((h+bb)/ip).toFixed(2):"---";
              const pitCols=["SEASON","APP","IP","W","L","SV","ERA","WHIP","H","R","ER","BB","K","HR"];
              return (
                <div>
                  <div style={{padding:"16px 20px 8px",fontWeight:700,fontSize:17,color:"#111"}}>Career Pitching</div>
                  <div style={{overflowX:"auto",borderTop:"1px solid #e5e7eb",borderBottom:"1px solid #e5e7eb"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                      <thead>
                        <tr style={{background:"#f9fafb"}}>
                          {pitCols.map(c=>(
                            <th key={c} style={{padding:"8px 8px",textAlign:c==="SEASON"?"left":"center",fontWeight:700,fontSize:11,color:"#6b7280",letterSpacing:".07em",whiteSpace:"nowrap",borderBottom:"1px solid #e5e7eb",paddingLeft:c==="SEASON"?"20px":"8px"}}>{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pitSeasons.map((s,i)=>(
                          <tr key={i} style={{borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                            <td style={{padding:"9px 8px 9px 20px",fontWeight:600,whiteSpace:"nowrap",fontSize:12}}>{s.name}</td>
                            <td style={{padding:"9px 8px",textAlign:"center"}}>{s.app}</td>
                            <td style={{padding:"9px 8px",textAlign:"center"}}>{s.ipDisplay}</td>
                            <td style={{padding:"9px 8px",textAlign:"center",color:s.w>0?"#16a34a":"inherit",fontWeight:s.w>0?700:400}}>{s.w}</td>
                            <td style={{padding:"9px 8px",textAlign:"center",color:s.l>0?"#dc2626":"inherit"}}>{s.l}</td>
                            <td style={{padding:"9px 8px",textAlign:"center"}}>{s.sv}</td>
                            <td style={{padding:"9px 8px",textAlign:"center",fontWeight:700,color:"#002d6e"}}>{s.era}</td>
                            <td style={{padding:"9px 8px",textAlign:"center",fontWeight:600}}>{s.whip}</td>
                            <td style={{padding:"9px 8px",textAlign:"center"}}>{s.h}</td>
                            <td style={{padding:"9px 8px",textAlign:"center"}}>{s.r}</td>
                            <td style={{padding:"9px 8px",textAlign:"center"}}>{s.er}</td>
                            <td style={{padding:"9px 8px",textAlign:"center"}}>{s.bb}</td>
                            <td style={{padding:"9px 8px",textAlign:"center"}}>{s.k}</td>
                            <td style={{padding:"9px 8px",textAlign:"center",color:s.hr>0?"#c8102e":"inherit"}}>{s.hr}</td>
                          </tr>
                        ))}
                        <tr style={{borderTop:"2px solid #002d6e",background:"#fff",fontWeight:700}}>
                          <td style={{padding:"9px 8px 9px 20px",color:"#111"}}>Career</td>
                          <td style={{padding:"9px 8px",textAlign:"center"}}>{pitCareer.app}</td>
                          <td style={{padding:"9px 8px",textAlign:"center"}}>{fmtIp(pitCareer.ip)}</td>
                          <td style={{padding:"9px 8px",textAlign:"center",color:"#16a34a"}}>{pitCareer.w}</td>
                          <td style={{padding:"9px 8px",textAlign:"center",color:"#dc2626"}}>{pitCareer.l}</td>
                          <td style={{padding:"9px 8px",textAlign:"center"}}>{pitCareer.sv}</td>
                          <td style={{padding:"9px 8px",textAlign:"center",color:"#002d6e"}}>{fmtEra(pitCareer.er,pitCareer.ip)}</td>
                          <td style={{padding:"9px 8px",textAlign:"center",color:"#002d6e"}}>{fmtWhip(pitCareer.h,pitCareer.bb,pitCareer.ip)}</td>
                          <td style={{padding:"9px 8px",textAlign:"center"}}>{pitCareer.h}</td>
                          <td style={{padding:"9px 8px",textAlign:"center"}}>{pitCareer.r}</td>
                          <td style={{padding:"9px 8px",textAlign:"center"}}>{pitCareer.er}</td>
                          <td style={{padding:"9px 8px",textAlign:"center"}}>{pitCareer.bb}</td>
                          <td style={{padding:"9px 8px",textAlign:"center"}}>{pitCareer.k}</td>
                          <td style={{padding:"9px 8px",textAlign:"center",color:"#c8102e"}}>{pitCareer.hr}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            <div style={{padding:"10px 20px 4px",fontSize:11,color:"#9ca3af"}}>Stats sourced from recorded box scores only. Games without entered stats are not reflected.</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── STAT LEGEND ─────────────────────────────────────────────────────────── */
function StatLegend() {
  const BATTING = [
    ["GP","Games played"],["PA","Plate appearances"],["AB","At bats"],
    ["H","Hits"],["1B","Singles"],["2B","Doubles"],["3B","Triples"],["HR","Home runs"],
    ["R","Runs scored"],["RBI","Runs batted in"],["BB","Walks (base on balls)"],
    ["SO","Strikeouts (swinging)"],["K-L","Strikeouts looking"],["HBP","Hit by pitch"],
    ["SAC","Sacrifice hits & bunts"],["SF","Sacrifice flies"],
    ["FC","Hit into fielder's choice"],["ROE","Reached on error"],
    ["SB","Stolen bases"],["CS","Caught stealing"],["SB%","Stolen base percentage"],
    ["AVG","Batting average"],["OBP","On-base percentage"],
    ["SLG","Slugging percentage"],["OPS","OBP + SLG"],
  ];
  const PITCHING = [
    ["IP","Innings pitched"],["W","Win"],["L","Loss"],["S","Save"],
    ["H","Hits allowed"],["R","Runs allowed"],["ER","Earned runs"],
    ["BB","Walks allowed"],["SO","Strikeouts"],["HR","Home runs allowed"],
    ["ERA","Earned run average"],["WHIP","Walks + hits per inning"],
  ];
  const half = Math.ceil(BATTING.length / 2);
  const col1 = BATTING.slice(0, half);
  const col2 = BATTING.slice(half);
  return (
    <div style={{marginTop:32,borderTop:"1px solid rgba(0,0,0,0.07)",paddingTop:24}}>
      <div style={{maxWidth:900,margin:"0 auto",padding:"0 4px"}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,textTransform:"uppercase",color:"rgba(0,0,0,0.35)",letterSpacing:".1em",marginBottom:16}}>📖 Stat Glossary</div>
        <div style={{marginBottom:20}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:13,textTransform:"uppercase",color:"#002d6e",letterSpacing:".08em",marginBottom:10}}>Batting</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 24px"}}>
            {[col1,col2].map((col,ci) => (
              <div key={ci} style={{display:"flex",flexDirection:"column",gap:6}}>
                {col.map(([abbr,desc]) => (
                  <div key={abbr} style={{display:"flex",gap:8,alignItems:"baseline"}}>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:13,color:"#111",minWidth:36,flexShrink:0}}>{abbr}</span>
                    <span style={{fontSize:12,color:"rgba(0,0,0,0.55)",lineHeight:1.3}}>{desc}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:13,textTransform:"uppercase",color:"#374151",letterSpacing:".08em",marginBottom:10}}>Pitching</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 24px"}}>
            {[PITCHING.slice(0,6),PITCHING.slice(6)].map((col,ci) => (
              <div key={ci} style={{display:"flex",flexDirection:"column",gap:6}}>
                {col.map(([abbr,desc]) => (
                  <div key={abbr} style={{display:"flex",gap:8,alignItems:"baseline"}}>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:13,color:"#111",minWidth:36,flexShrink:0}}>{abbr}</span>
                    <span style={{fontSize:12,color:"rgba(0,0,0,0.55)",lineHeight:1.3}}>{desc}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamDetailPage({ teamName, onBack, prevTab, setTab, setTeamDetail }) {
  const team = ALL_TEAMS.find(t => t.name === teamName);
  const [roster, setRoster] = useState(TEAM_ROSTERS[teamName] || []);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [liveRecord, setLiveRecord] = useState(null);
  const [teamStats, setTeamStats] = useState({});   // player_name → aggregated batting stats
  const [recentGames, setRecentGames] = useState([]); // last 5 final games from Supabase
  const [boxGame, setBoxGame] = useState(null);
  const [boxBatting, setBoxBatting] = useState([]);
  const [boxPitching, setBoxPitching] = useState([]);
  const [rosterSort, setRosterSort] = useState({col:"avgN", dir:"desc"});

  const openBoxScore = async (g) => {
    setBoxGame(g);
    setBoxBatting([]); setBoxPitching([]);
    const enc = encodeURIComponent;
    let [bat, pit] = await Promise.all([
      sbFetch(`batting_lines?select=player_name,team,ab,r,h,rbi,bb,k,doubles,triples,hr,sb&game_id=eq.${g.id}&order=id.asc&limit=100`),
      sbFetch(`pitching_lines?select=player_name,team,ip,h,r,er,bb,k,decision&game_id=eq.${g.id}&order=id.asc&limit=50`),
    ]);
    const hasAway = bat.some(b => b.team === g.away_team);
    const hasHome = bat.some(b => b.team === g.home_team);
    if (!hasAway || !hasHome) {
      // Same-date siblings only — without a date scope this would pull stats
      // from past matchups of the same two teams (e.g. a January game's box
      // score appearing under an April game). See cleanHeadline / earlier
      // fix in LiveBoxScoreFinalCard for the same bug class.
      const sameDateSibs = g.game_date
        ? await sbFetch(`games?select=id&away_team=eq.${enc(g.away_team)}&home_team=eq.${enc(g.home_team)}&id=neq.${g.id}&away_score=not.is.null&game_date=eq.${g.game_date}&limit=10`)
        : [];
      const sibIds = sameDateSibs.map(s => s.id);
      if (sibIds.length) {
        const ids = sibIds.join(',');
        const [mb, mp] = await Promise.all([
          sbFetch(`batting_lines?select=player_name,team,ab,r,h,rbi,bb,k,doubles,triples,hr,sb&game_id=in.(${ids})&order=id.asc&limit=200`),
          sbFetch(`pitching_lines?select=player_name,team,ip,h,r,er,bb,k,decision&game_id=in.(${ids})&order=id.asc&limit=100`),
        ]);
        if (!hasAway) bat = [...bat, ...mb.filter(b => b.team === g.away_team)];
        if (!hasHome) bat = [...bat, ...mb.filter(b => b.team === g.home_team)];
        if (!pit.some(p => p.team === g.away_team)) pit = [...pit, ...mp.filter(p => p.team === g.away_team)];
        if (!pit.some(p => p.team === g.home_team)) pit = [...pit, ...mp.filter(p => p.team === g.home_team)];
      }
    }
    // Deduplicate: keep best row per player+team by most ABs
    const dedup = (rows) => {
      const best = {};
      rows.forEach(r => { const k=`${r.team}|${r.player_name}`; if(!best[k]||(r.ab||0)>(best[k].ab||0)) best[k]=r; });
      return Object.values(best);
    };
    bat = dedup(bat);
    setBoxBatting(bat); setBoxPitching(pit);
  };
  useEffect(() => {
    sbFetch(`lbdc_rosters?select=*&team=eq.${encodeURIComponent(teamName)}&order=id.asc`)
      .then(rows => {
        if (!rows || !rows.length) return;
        // Dedup by normalized name. If the same player appears twice (e.g. once
        // from the original roster import + once from a later sign-up auto-add),
        // prefer the entry with a number set so we don't lose jersey info.
        const byName = {};
        rows.forEach(r => {
          const key = cleanName(r.name).toLowerCase();
          if (!key) return;
          const existing = byName[key];
          if (!existing) { byName[key] = r; return; }
          // Keep whichever has a number; if both or neither, keep the older id.
          const existingHasNum = !!(existing.number && String(existing.number).trim());
          const incomingHasNum = !!(r.number && String(r.number).trim());
          if (incomingHasNum && !existingHasNum) byName[key] = r;
        });
        const deduped = Object.values(byName).map(r => ({
          number: r.number || "",
          name: cleanName(r.name) || r.name || "",
          status: r.status || "Active",
        }));
        setRoster(deduped);
      })
      .catch(() => {});
  }, [teamName]);
  // Fetch inline batting stats + recent results for this team
  useEffect(() => {
    const isBoomers = BOOMERS_TEAMS.has(teamName);
    const enc = encodeURIComponent;
    sbFetch("seasons?select=id,name&limit=50").then(async seasons => {
      const satIds = getSatSeasonFilter(seasons);
      const s = isBoomers
        ? seasons.find(x => x.name.toLowerCase().includes("boomers"))
        : null;
      const seasonFilter = isBoomers ? `season_id=eq.${s?.id}` : `season_id=in.(${satIds.join(",")})`;
      if (isBoomers && !s) return;
      if (!isBoomers && !satIds.length) return;
      const [games, recentRaw] = await Promise.all([
        sbFetch(`games?select=id,game_date,away_team,home_team,away_score,home_score&${seasonFilter}&limit=200`),
        sbFetch(`games?select=id,away_team,home_team,away_score,home_score,game_date,status&${seasonFilter}&or=(away_team.eq.${enc(teamName)},home_team.eq.${enc(teamName)})&status=eq.Final&order=game_date.desc&limit=20`),
      ]);
      setRecentGames(dedupGames(recentRaw || []).slice(0,5));
      if (!games || !games.length) return;
      // Line-level dedup by gameKey — handles duplicate game rows with scattered batting_lines
      const gameKeyById = {};
      games.forEach(g => { gameKeyById[g.id] = `${g.game_date||"null"}|${g.away_team}|${g.home_team}`; });
      const allIds = games.map(g => g.id).join(",");
      const rawLines = await sbFetch(`batting_lines?select=game_id,player_name,ab,r,h,doubles,triples,hr,rbi,bb,k,hbp,sf,sb&team=eq.${enc(teamName)}&game_id=in.(${allIds})&limit=5000`);
      const linesBest = {};
      (rawLines || []).forEach(r => {
        if (!r.player_name) return;
        const gk = gameKeyById[r.game_id]; if (!gk) return;
        const k = `${r.player_name}||${gk}`;
        const pa = (r.ab||0)+(r.bb||0)+(r.hbp||0)+(r.sf||0);
        const sc = pa*100 + (r.h||0) + (r.rbi||0);
        if (!linesBest[k] || sc > linesBest[k].__s) linesBest[k] = { ...r, __s: sc };
      });
      const lines = Object.values(linesBest);
      const map = {};
      lines.forEach(l => {
        if (!map[l.player_name]) map[l.player_name] = {ab:0,r:0,h:0,doubles:0,triples:0,hr:0,rbi:0,bb:0,k:0,hbp:0,sf:0,sb:0,gp:0};
        const p = map[l.player_name];
        p.gp++; p.ab+=l.ab||0; p.r+=l.r||0; p.h+=l.h||0;
        p.doubles+=l.doubles||0; p.triples+=l.triples||0; p.hr+=l.hr||0;
        p.rbi+=l.rbi||0; p.bb+=l.bb||0; p.k+=l.k||0;
        p.hbp+=l.hbp||0; p.sf+=l.sf||0; p.sb+=l.sb||0;
      });
      Object.values(map).forEach(p => {
        p.tb = (p.h-p.doubles-p.triples-p.hr)+p.doubles*2+p.triples*3+p.hr*4;
        p.avg = p.ab > 0 ? (p.h/p.ab).toFixed(3).replace(/^0/,"") : "—";
        const obpN = (p.ab+p.bb+p.hbp) > 0 ? (p.h+p.bb+p.hbp)/(p.ab+p.bb+p.hbp+p.sf) : 0;
        const slgN = p.ab > 0 ? p.tb/p.ab : 0;
        p.obp = obpN > 0 ? obpN.toFixed(3).replace(/^0/,"") : "—";
        p.ops = (obpN+slgN) > 0 ? (obpN+slgN).toFixed(3).replace(/^0/,"") : "—";
        p.avgN = p.ab > 0 ? p.h/p.ab : 0;
        p.obpN = obpN;
        p.opsN = obpN+slgN;
      });
      setTeamStats(map);
    }).catch(() => {});
  }, [teamName]);
  useEffect(() => {
    const isBoomers = BOOMERS_TEAMS.has(teamName);
    sbFetch("seasons?select=id,name&limit=50").then(seasons => {
      const satIds = getSatSeasonFilter(seasons);
      const bomS = seasons.find(x => x.name.toLowerCase().includes("boomers"));
      if (isBoomers && !bomS) return null;
      if (!isBoomers && !satIds.length) return null;
      const filter = isBoomers ? `season_id=eq.${bomS.id}` : `season_id=in.(${satIds.join(",")})`;
      return sbFetch(`games?select=id,game_date,away_team,home_team,away_score,home_score,status&${filter}&status=eq.Final&limit=200`);
    }).then(rawGames => {
      if (!rawGames) return;
      const games = dedupGames(rawGames);
      let w=0,l=0,t=0,gp=0,rs=0,ra=0;
      games.forEach(g => {
        const isAway = g.away_team === teamName, isHome = g.home_team === teamName;
        if (!isAway && !isHome) return;
        const myScore = isAway ? +g.away_score : +g.home_score;
        const oppScore = isAway ? +g.home_score : +g.away_score;
        gp++; rs+=myScore; ra+=oppScore;
        if(myScore>oppScore) w++; else if(oppScore>myScore) l++; else t++;
      });
      const pts=w*2+t, max=(gp||1)*2;
      const pct = gp===0?"---":Number(pts/max).toFixed(3).replace(/^0/,"");
      setLiveRecord({w,l,t,gp,rs,ra,pct});
    }).catch(()=>{});
  }, [teamName]);
  const [liveSchedule, setLiveSchedule] = useState(null); // null = not loaded yet
  useEffect(() => {
    const schedId = BOOMERS_TEAMS.has(teamName) ? "bom" : "sat";
    sbFetch(`lbdc_schedules?id=eq.${schedId}&select=data`)
      .then(rows => { if (rows?.[0]?.data?.length) setLiveSchedule(rows[0].data); })
      .catch(() => {});
  }, [teamName]);

  const isTournamentTeam = !team;
  const color = TEAM_COLORS[teamName] || "#b45309";
  const goTeam = (name) => { if(setTeamDetail){ setTeamDetail(name); setTab("teams"); window.scrollTo(0,0); } };

  // ── Tournament team page ──────────────────────────────────────────────────
  if (isTournamentTeam) {
    return (
      <div style={{minHeight:"100vh",background:"#f2f4f8",overflowX:"hidden",width:"100%"}}>
        {selectedPlayer && <PlayerStatsModal playerName={selectedPlayer} onClose={()=>setSelectedPlayer(null)} />}
        <div style={{background:`linear-gradient(135deg, ${color}15 0%, #fff 60%)`,borderBottom:"3px solid #b45309",padding:"32px clamp(12px,3vw,40px) 24px"}}>
          <div style={{maxWidth:1400,margin:"0 auto"}}>
            <button onClick={onBack} style={{background:"rgba(0,0,0,0.07)",border:"1px solid rgba(0,0,0,0.12)",borderRadius:6,cursor:"pointer",color:"#333",fontSize:13,fontWeight:700,marginBottom:16,padding:"6px 14px",display:"inline-flex",alignItems:"center",gap:6}}>
              ← {prevTab && prevTab !== "teams" ? `Back to ${prevTab.charAt(0).toUpperCase()+prevTab.slice(1)}` : "All Teams"}
            </button>
            <div style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
              <div style={{width:80,height:80,borderRadius:"50%",background:"#b45309",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:36,fontWeight:900,flexShrink:0}}>
                {teamName.charAt(0)}
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:"#b45309",marginBottom:4}}>Tournament Team</div>
                <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:"clamp(36px,5vw,60px)",textTransform:"uppercase",color:"#111",lineHeight:1}}>{teamName}</h1>
              </div>
            </div>
          </div>
        </div>
        <div style={{maxWidth:900,margin:"0 auto",padding:"28px clamp(12px,3vw,40px) 60px"}}>
          <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:26,textTransform:"uppercase",color:"#111",marginBottom:14}}>Roster</h2>
          <Card>
            {roster.length === 0 ? (
              <div style={{padding:"32px 20px",textAlign:"center",color:"#aaa",fontSize:14,fontStyle:"italic"}}>No players on roster yet. Add them in Admin → Manage Rosters.</div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))"}}>
                {roster.map((player, i) => {
                  const name = typeof player === "string" ? player : player.name;
                  const num  = typeof player === "string" ? "" : player.number;
                  return (
                    <button key={i} onClick={() => setSelectedPlayer(name)}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderBottom:"1px solid rgba(0,0,0,0.04)",background:"transparent",border:"none",cursor:"pointer",textAlign:"left",width:"100%",transition:"background .12s"}}
                      onMouseEnter={e=>e.currentTarget.style.background="rgba(180,83,9,0.05)"}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <div style={{width:30,height:30,borderRadius:"50%",background:"rgba(180,83,9,0.12)",border:"2px solid rgba(180,83,9,0.3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:11,color:"#b45309"}}>{num||"—"}</span>
                      </div>
                      <div>
                        <span style={{fontSize:14,fontWeight:600,color:"#111"}}>{name}</span>
                        <div style={{fontSize:10,color:"#b45309",fontWeight:700,letterSpacing:".05em",marginTop:1}}>View Stats →</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // ── Regular season team page ───────────────────────────────────────────────
  const rec = liveRecord || {w:team.w,l:team.l,t:team.t,pct:team.pct,rs:team.rs,ra:team.ra};

  // Build full season schedule for this team — prefer live Supabase data over static SCHED
  const fullSchedule = BOOMERS_TEAMS.has(teamName)
    ? (liveSchedule || BOOMERS_SCHED.map(g => ({...g, away:g.away, home:g.home})))
        .filter(g => g.away===teamName || g.home===teamName)
        .map(g => ({date:g.date, time:g.time, isHome:g.home===teamName, opponent:g.home===teamName?g.away:g.home, field:g.field, status:g.status||"", notes:g.notes||""}))
    : liveSchedule
      ? liveSchedule
          .filter(g => g.away===teamName || g.home===teamName)
          .map(g => ({date:g.date, time:g.time, isHome:g.home===teamName, opponent:g.home===teamName?g.away:g.home, field:g.field, status:g.status||"", notes:g.notes||""}))
      : SCHED.flatMap(week =>
          week.fields.flatMap(f =>
            f.games
              .filter(g => g.away===teamName || g.home===teamName)
              .map(g => ({date:week.label, time:g.time, isHome:g.home===teamName, opponent:g.home===teamName?g.away:g.home, field:f.name, status:g.status||"", notes:g.notes||""}))
          )
        );
  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",overflowX:"hidden",width:"100%"}}>
      {selectedPlayer && <PlayerStatsModal playerName={selectedPlayer} onClose={()=>setSelectedPlayer(null)} />}
      <div style={{background:`linear-gradient(135deg, ${color}15 0%, #fff 60%)`,borderBottom:"3px solid #002d6e",padding:"32px clamp(12px,3vw,40px) 0"}}>
        <div style={{maxWidth:1400,margin:"0 auto"}}>
          <button onClick={onBack} style={{background:"rgba(0,0,0,0.07)",border:"1px solid rgba(0,0,0,0.12)",borderRadius:6,cursor:"pointer",color:"#333",fontSize:13,fontWeight:700,marginBottom:16,padding:"6px 14px",display:"inline-flex",alignItems:"center",gap:6}}>← {prevTab && prevTab !== "teams" ? `Back to ${prevTab.charAt(0).toUpperCase()+prevTab.slice(1)}` : "All Teams"}</button>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:24,marginBottom:24}}>
            <div style={{display:"flex",alignItems:"center",gap:20}}>
              <TLogo name={teamName} size={120} />
              <div>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color,marginBottom:4}}>{team.divName}</div>
                <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:"clamp(36px,5vw,60px)",textTransform:"uppercase",color:"#111",lineHeight:1}}>{teamName}</h1>
                <div style={{fontSize:13,color:"rgba(0,0,0,0.45)",marginTop:4}}>#{team.seed} seed · {team.divName}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
              <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderTop:`3px solid ${color}`,borderRadius:10,padding:"16px 24px",textAlign:"center"}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:44,color,lineHeight:1}}>{rec.w}-{rec.l}</div>
                <div style={{fontSize:12,color:"rgba(0,0,0,0.4)",marginTop:4,fontFamily:"'Barlow Condensed',sans-serif"}}>{rec.pct} PCT</div>
                <div style={{fontSize:11,color:"rgba(0,0,0,0.35)",marginTop:2}}>{rec.rs} RF · {rec.ra} RA</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <div style={{fontSize:11,fontWeight:700,color:"rgba(0,0,0,0.4)",textTransform:"uppercase",letterSpacing:".08em"}}>Subscribe to Schedule</div>
                <a
                  href={`webcal://${typeof window!=="undefined"?window.location.host:"lbdcbaseball.com"}/api/schedule.ics?team=${encodeURIComponent(teamName)}`}
                  style={{display:"inline-flex",alignItems:"center",gap:8,background:"#002d6e",borderRadius:8,padding:"10px 18px",
                    textDecoration:"none",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,
                    letterSpacing:".04em",textTransform:"uppercase",color:"#FFD700",whiteSpace:"nowrap",alignSelf:"flex-start"}}>
                  <span style={{fontSize:16}}>📅</span> Subscribe to Calendar
                </a>
                <div style={{fontSize:11,color:"rgba(0,0,0,0.35)",lineHeight:1.4}}>
                  iPhone / Mac: tap to subscribe · Android: open Google Calendar → Other calendars → From URL
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="team-detail-grid" style={{maxWidth:1400,margin:"0 auto",padding:"28px clamp(12px,3vw,40px) 60px",display:"grid",gridTemplateColumns:"1fr 300px",gap:28,alignItems:"start"}}>
        <div>
          <div style={{marginBottom:28}}>
            <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:26,textTransform:"uppercase",color:"#111",marginBottom:14}}>Roster</h2>
            <Card style={{padding:0}}>
              {roster.length === 0 ? (
                <div style={{padding:"24px 20px",textAlign:"center",color:"#aaa",fontSize:14,fontStyle:"italic"}}>Roster not yet submitted — check back soon.</div>
              ) : (() => {
                  const COLS = [
                    {label:"GP",  key:"gp"},
                    {label:"AB",  key:"ab"},
                    {label:"R",   key:"r"},
                    {label:"H",   key:"h"},
                    {label:"2B",  key:"doubles"},
                    {label:"3B",  key:"triples"},
                    {label:"HR",  key:"hr"},
                    {label:"RBI", key:"rbi"},
                    {label:"BB",  key:"bb"},
                    {label:"K",   key:"k"},
                    {label:"SB",  key:"sb"},
                    {label:"TB",  key:"tb"},
                    {label:"AVG", key:"avgN", display:"avg", rate:true},
                    {label:"OBP", key:"obpN", display:"obp", rate:true},
                    {label:"OPS", key:"opsN", display:"ops", rate:true},
                  ];
                  const handleSort = (key) => {
                    setRosterSort(s => ({col:key, dir: s.col===key&&s.dir==="desc" ? "asc" : "desc"}));
                  };
                  const sorted = [...roster].sort((a,b) => {
                    const na = typeof a==="string"?a:a.name;
                    const nb = typeof b==="string"?b:b.name;
                    if (rosterSort.col==="name") return rosterSort.dir==="asc" ? na.localeCompare(nb) : nb.localeCompare(na);
                    const sa = teamStats[na], sb2 = teamStats[nb];
                    const av = (sa && sa[rosterSort.col] != null) ? sa[rosterSort.col] : -1;
                    const bv = (sb2 && sb2[rosterSort.col] != null) ? sb2[rosterSort.col] : -1;
                    return rosterSort.dir==="desc" ? bv-av : av-bv;
                  });
                  return (
                    <div style={{overflowX:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                        <thead>
                          <tr style={{background:"#f8f9fb",borderBottom:"2px solid rgba(0,0,0,0.08)"}}>
                            <th style={{padding:"9px 10px 9px 16px",textAlign:"left",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,textTransform:"uppercase",color:"rgba(0,0,0,0.4)",width:36}}>#</th>
                            <th style={{padding:"9px 10px",textAlign:"left",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,textTransform:"uppercase",color:"rgba(0,0,0,0.4)",cursor:"pointer"}} onClick={()=>setRosterSort(s=>({col:"name",dir:s.col==="name"&&s.dir==="asc"?"desc":"asc"}))}>Player</th>
                            {COLS.map(c=>{
                              const active = rosterSort.col===c.key;
                              return (
                                <th key={c.key} onClick={()=>handleSort(c.key)} style={{padding:"9px 8px",textAlign:"center",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,textTransform:"uppercase",whiteSpace:"nowrap",cursor:"pointer",userSelect:"none",color:active?color:c.rate?"rgba(0,45,110,0.6)":"rgba(0,0,0,0.4)",background:active?`${color}12`:"transparent",transition:"background .1s"}}>
                                  {c.label}{active?(rosterSort.dir==="desc"?" ▼":" ▲"):""}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {sorted.map((player,i) => {
                            const name   = typeof player === "string" ? player : player.name;
                            const num    = typeof player === "string" ? "" : player.number;
                            const status = typeof player === "string" ? "Active" : (player.status || "Active");
                            const st = teamStats[name];
                            return (
                              <tr key={name} style={{borderBottom:"1px solid rgba(0,0,0,0.05)",background:i%2===0?"#fff":"#fafafa",opacity:status==="Released"?0.45:1,cursor:"pointer",transition:"background .1s"}}
                                onClick={()=>setSelectedPlayer(name)}
                                onMouseEnter={e=>e.currentTarget.style.background=`${color}0d`}
                                onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"#fff":"#fafafa"}>
                                <td style={{padding:"9px 10px 9px 16px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,color:"rgba(0,0,0,0.35)",textAlign:"center"}}>{num||"—"}</td>
                                <td style={{padding:"9px 10px",fontWeight:600,whiteSpace:"nowrap"}}>
                                  <span style={{color:color,textDecoration:"underline",textDecorationStyle:"dotted"}}>{name}</span>
                                  {status!=="Active"&&<span style={{fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:8,background:status==="DL"?"#fef3c7":"#f3f4f6",color:status==="DL"?"#92400e":"#6b7280",marginLeft:6}}>{status}</span>}
                                </td>
                                {COLS.map((c,j) => {
                                  const val = st ? (c.display ? st[c.display] : st[c.key]) : "—";
                                  const active = rosterSort.col===c.key;
                                  return <td key={c.key} style={{padding:"9px 8px",textAlign:"center",fontWeight:c.rate?700:400,color:c.rate?color:active?"#111":"inherit",background:active?`${color}08`:"transparent"}}>{val??0}</td>;
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
              })()}
            </Card>
          </div>
          {boxGame && <BoxScoreModal game={{...boxGame, away_team:boxGame.away_team, home_team:boxGame.home_team}} batting={boxBatting} pitching={boxPitching} onClose={()=>setBoxGame(null)} />}
          {recentGames.length > 0 && (
            <div>
              <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:26,textTransform:"uppercase",color:"#111",marginBottom:14}}>Recent Results</h2>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {recentGames.map((g,i) => {
                  const isAway = g.away_team===teamName;
                  const myScore = isAway ? g.away_score : g.home_score;
                  const oppScore = isAway ? g.home_score : g.away_score;
                  // Three-way result. Previously this was just `won = myScore > oppScore`,
                  // so any tie quietly rendered as a loss (red L) on the team page even
                  // though standings counted it correctly. Treat ties explicitly.
                  const result = myScore > oppScore ? "W" : myScore < oppScore ? "L" : "T";
                  const resultColor = result === "W" ? "#16a34a" : result === "L" ? "#dc2626" : "#b45309"; // green / red / amber
                  const opp = isAway ? g.home_team : g.away_team;
                  const dateStr = g.game_date ? new Date(g.game_date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}) : "";
                  return (
                    <div key={i} onClick={()=>openBoxScore(g)} style={{background:"#fff",border:"1px solid rgba(0,0,0,0.08)",borderLeft:`4px solid ${resultColor}`,borderRadius:8,padding:"12px 16px",display:"flex",alignItems:"center",gap:14,cursor:"pointer"}}
                      onMouseEnter={e=>e.currentTarget.style.background="#f8f9fb"}
                      onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,color:resultColor,width:22,textAlign:"center"}}>{result}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,textTransform:"uppercase",color:"#111"}}>{isAway?"@":""} {opp}</div>
                        <div style={{fontSize:11,color:"rgba(0,0,0,0.4)",marginTop:1}}>{dateStr} · {isAway?"Away":"Home"}</div>
                      </div>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:26,color:"#111",whiteSpace:"nowrap"}}>{myScore} – {oppScore}</div>
                      <div style={{fontSize:11,color:"rgba(0,0,0,0.3)",flexShrink:0}}>📊</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:16,position:"sticky",top:72}}>
          <Card>
            <div style={{padding:"14px 16px",borderBottom:"1px solid rgba(0,0,0,0.07)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,textTransform:"uppercase",color:"#111"}}>2026 Schedule</span>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,color:color,fontWeight:700}}>{fullSchedule.length} Games</span>
            </div>
            {fullSchedule.length === 0 && (
              <div style={{padding:"32px 18px",textAlign:"center",color:"#888",fontSize:13,lineHeight:1.5}}>
                <span style={{fontSize:28,display:"block",marginBottom:8,opacity:0.4}}>⚾</span>
                No games scheduled yet.
                <div style={{fontSize:11,color:"rgba(0,0,0,0.35)",marginTop:6}}>Schedule will appear here once games are posted.</div>
              </div>
            )}
            {fullSchedule.map((g,i) => {
              const isPPD = g.status==="PPD" || (g.status||"").toLowerCase().startsWith("postpone");
              const isCAN = g.status==="CAN" || (g.status||"").toLowerCase().startsWith("cancel");
              const badge = isCAN ? "CANCELED" : isPPD ? "POSTPONED" : null;
              return (
              <div key={i} style={{display:"grid",gridTemplateColumns:"52px 48px 1fr",alignItems:"center",gap:8,padding:"10px 16px",borderBottom:"1px solid rgba(0,0,0,0.05)",background:badge?"rgba(200,16,46,0.04)":(i%2===0?"transparent":"rgba(0,0,0,0.01)"),opacity:badge?0.72:1}}>
                <div>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:15,color:"#111",lineHeight:1,textDecoration:badge?"line-through":"none"}}>{g.date}</div>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:"rgba(0,0,0,0.4)",marginTop:2,textDecoration:badge?"line-through":"none"}}>{g.time}</div>
                </div>
                <div style={{
                  fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,
                  letterSpacing:".08em",textTransform:"uppercase",
                  color:badge?"#fff":(g.isHome?"#fff":"#002d6e"),
                  background:badge?"#c8102e":(g.isHome?"#002d6e":"rgba(0,45,110,0.08)"),
                  border:`1px solid ${badge?"#c8102e":(g.isHome?"#002d6e":"rgba(0,45,110,0.2)")}`,
                  borderRadius:4,padding:"2px 6px",textAlign:"center",
                }}>
                  {badge ? (isCAN?"CAN":"PPD") : (g.isHome?"HOME":"AWAY")}
                </div>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <TLogo name={g.opponent} size={44} />
                    <div>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,color:badge?"#888":"#111",textTransform:"uppercase",lineHeight:1,textDecoration:badge?"line-through":"none"}}>{g.isHome?"vs":"@"} {g.opponent}</div>
                      <div style={{fontSize:11,color:"rgba(0,0,0,0.4)",marginTop:2}}>{g.field.replace("Clark Field — Long Beach","Clark Field").replace("Fromhold Field — San Pedro","Fromhold Field").replace("St Pius X — Downey","St Pius X")}</div>
                      {g.notes && <div style={{fontSize:10,color:"#c8102e",marginTop:2,fontWeight:700}}>📝 {g.notes}</div>}
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </Card>
        </div>
      </div>
      <StatLegend />
    </div>
  );
}

/* ─── TEAMS PAGE ─────────────────────────────────────────────────────────── */
function TeamsPage({ setTab, setTeamDetail }) {
  const [liveRecords, setLiveRecords] = useState({}); // keyed by team name
  const [extraTeams, setExtraTeams] = useState([]); // tournament teams from Supabase

  useEffect(() => {
    sbFetch("lbdc_schedules?id=eq.teams&select=data")
      .then(rows => {
        if (rows && rows[0] && Array.isArray(rows[0].data)) setExtraTeams(rows[0].data);
      }).catch(() => {});
  }, []);

  useEffect(() => {
    const calcRows = (rawGames, divTeams) => {
      // Collapse duplicate game records (same date + teams) that exist because
      // both captains submit their own box scores.
      const games = dedupGames(rawGames || []);
      const tm = {};
      divTeams.forEach(t => { tm[t.name] = {w:0,l:0,t:0,rs:0,ra:0,gp:0}; });
      games.forEach(g => {
        if (!g.away_score && g.away_score !== 0) return;
        const a=g.away_team, h=g.home_team, as=+g.away_score, hs=+g.home_score;
        if(!tm[a]||!tm[h]) return;
        tm[a].rs+=as; tm[a].ra+=hs; tm[a].gp++;
        tm[h].rs+=hs; tm[h].ra+=as; tm[h].gp++;
        if(as>hs){tm[a].w++;tm[h].l++;} else if(hs>as){tm[h].w++;tm[a].l++;} else{tm[a].t++;tm[h].t++;}
      });
      return tm;
    };
    sbFetch("seasons?select=id,name&limit=50").then(seasons => {
      const satIds = getSatSeasonFilter(seasons);
      const bomS = seasons.find(x => x.name.toLowerCase().includes("boomers"));
      return Promise.all([
        satIds.length ? sbFetch(`games?select=id,game_date,away_team,home_team,away_score,home_score&season_id=in.(${satIds.join(",")})&status=eq.Final&limit=200`) : [],
        bomS ? sbFetch(`games?select=id,game_date,away_team,home_team,away_score,home_score&season_id=eq.${bomS.id}&status=eq.Final&limit=200`) : [],
      ]);
    }).then(([satGames, bomGames]) => {
      const recs = {};
      const satRecs = calcRows(satGames, DIV.SAT.teams);
      const bomRecs = calcRows(bomGames, DIV.BOM.teams);
      Object.assign(recs, satRecs, bomRecs);
      Object.entries(recs).forEach(([name, s]) => {
        const pts=s.w*2+s.t, max=(s.gp||1)*2;
        recs[name] = {...s, pct: s.gp===0?"---":Number(pts/max).toFixed(3).replace(/^0/,"")};
      });
      setLiveRecords(recs);
    }).catch(()=>{});
  }, []);

  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",overflowX:"hidden",width:"100%"}}>
      <PageHero label="2026 Season" title="Team Directory">
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:16,paddingBottom:2}}>
          {[...ALL_TEAMS].sort((a,b)=>{const ar=liveRecords[a.name],br=liveRecords[b.name];const ap=ar?ar.w/(ar.gp||1):0,bp=br?br.w/(br.gp||1):0;return bp-ap;}).map(t => {
            const color = TEAM_COLORS[t.name]||"#002d6e";
            return (
              <button key={t.name} onClick={() => setTeamDetail(t.name)} style={{
                display:"flex",alignItems:"center",gap:8,
                background:"#fff",border:`1px solid ${color}40`,
                borderRadius:8,padding:"7px 14px",cursor:"pointer",
                transition:"all .15s",fontFamily:"'Barlow Condensed',sans-serif",
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor=color}
              onMouseLeave={e => e.currentTarget.style.borderColor=`${color}40`}>
                <TLogo name={t.name} size={80} />
                <span style={{fontWeight:700,fontSize:15,color:"#111",textTransform:"uppercase"}}>{t.name}</span>
              </button>
            );
          })}
        </div>
      </PageHero>
      <div style={{maxWidth:1400,margin:"0 auto",padding:"28px clamp(12px,3vw,40px) 60px"}}>
        {Object.entries(DIV).map(([dk,div]) => (
          <div key={dk} style={{marginBottom:36}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
              <div style={{width:4,height:28,background:div.accent,borderRadius:2}} />
              <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:28,textTransform:"uppercase",color:"#111"}}>{div.name}</h2>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
              {div.teams.map((t,i) => {
                const color = TEAM_COLORS[t.name]||div.accent;
                const rec = liveRecords[t.name] || {w:t.w,l:t.l,t:t.t,pct:t.pct,rs:t.rs,ra:t.ra};
                return (
                  <button key={t.name} onClick={() => setTeamDetail(t.name)} style={{
                    background:"#fff",border:"1px solid rgba(0,0,0,0.09)",
                    borderLeft:`3px solid ${color}`,borderTop:"3px solid #002d6e",
                    borderRadius:12,padding:"18px 20px",cursor:"pointer",
                    textAlign:"left",transition:"all .15s",
                    boxShadow:"0 1px 4px rgba(0,0,0,0.05)",display:"block",width:"100%",
                  }}
                  onMouseEnter={e => {e.currentTarget.style.boxShadow=`0 4px 16px ${color}25`;e.currentTarget.style.borderColor=color;}}
                  onMouseLeave={e => {e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.05)";e.currentTarget.style.borderColor="rgba(0,0,0,0.09)";e.currentTarget.style.borderLeftColor=color;}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                      <div style={{display:"flex",alignItems:"center",gap:14}}>
                        <TLogo name={t.name} size={100} />
                        <div>
                          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,textTransform:"uppercase",color:"#111",lineHeight:1}}>{t.name}</div>
                          <div style={{fontSize:12,color:"rgba(0,0,0,0.4)",marginTop:3}}>#{t.seed} seed · {div.name}</div>
                        </div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:30,color,lineHeight:1}}>{rec.w}-{rec.l}</div>
                        <div style={{fontSize:12,color:"rgba(0,0,0,0.4)",fontFamily:"'Barlow Condensed',sans-serif"}}>{rec.pct}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:16,paddingTop:10,borderTop:"1px solid rgba(0,0,0,0.05)"}}>
                      <div style={{textAlign:"center"}}>
                        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:18,color:"#111"}}>{rec.rs}</div>
                        <div style={{fontSize:10,color:"rgba(0,0,0,0.35)",textTransform:"uppercase",letterSpacing:".08em"}}>Runs For</div>
                      </div>
                      <div style={{textAlign:"center"}}>
                        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:18,color:"#111"}}>{rec.ra}</div>
                        <div style={{fontSize:10,color:"rgba(0,0,0,0.35)",textTransform:"uppercase",letterSpacing:".08em"}}>Runs Against</div>
                      </div>
                      <div style={{textAlign:"center"}}>
                        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:18,color:t.diff.startsWith("+")?div.accent:t.diff==="0"?"#111":"#dc2626"}}>{t.diff}</div>
                        <div style={{fontSize:10,color:"rgba(0,0,0,0.35)",textTransform:"uppercase",letterSpacing:".08em"}}>Differential</div>
                      </div>
                      <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:12}}>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Tournament / extra teams */}
        {extraTeams.length > 0 && (
          <div style={{marginBottom:36}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
              <div style={{width:4,height:28,background:"#b45309",borderRadius:2}} />
              <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:28,textTransform:"uppercase",color:"#111"}}>Tournament Teams</h2>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
              {extraTeams.map(name => (
                <button key={name} onClick={() => setTeamDetail(name)} style={{
                  background:"#fff",border:"1px solid rgba(0,0,0,0.09)",
                  borderLeft:"3px solid #b45309",borderTop:"3px solid #b45309",
                  borderRadius:12,padding:"18px 20px",cursor:"pointer",
                  textAlign:"left",transition:"all .15s",
                  boxShadow:"0 1px 4px rgba(0,0,0,0.05)",display:"block",width:"100%",
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow="0 4px 16px rgba(180,83,9,0.15)"}
                onMouseLeave={e => e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.05)"}>
                  <div style={{display:"flex",alignItems:"center",gap:14}}>
                    <div style={{width:44,height:44,borderRadius:"50%",background:"#b45309",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:20,fontWeight:900,flexShrink:0}}>{name.charAt(0)}</div>
                    <div>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,textTransform:"uppercase",color:"#111",lineHeight:1}}>{name}</div>
                      <div style={{fontSize:12,color:"rgba(0,0,0,0.4)",marginTop:3}}>Tournament Team</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── FIELD DIRECTIONS PAGE ──────────────────────────────────────────────── */
const FIELDS_INFO = [
  {
    name: "Clark Field",
    location: "Long Beach, CA",
    address: "4832 Clark Ave, Long Beach, CA 90808",
    mapsUrl: "https://maps.google.com/?q=4832+Clark+Ave,+Long+Beach,+CA+90808",
    appleMapsUrl: "https://maps.apple.com/?q=4832+Clark+Ave+Long+Beach+CA+90808",
    notes: [
      "Located at the St. Anthony High School Athletic Complex.",
      "Free parking available in the lot adjacent to the field.",
      "Home team uses the first base dugout.",
    ],
    color: "#002d6e",
  },
  {
    name: "Fromhold Field",
    location: "San Pedro, CA",
    address: "1600 W Paseo Del Mar, San Pedro, CA 90731",
    mapsUrl: "https://maps.google.com/?q=1600+W+Paseo+Del+Mar,+San+Pedro,+CA+90731",
    appleMapsUrl: "https://maps.apple.com/?q=1600+W+Paseo+Del+Mar+San+Pedro+CA+90731",
    notes: [
      "When exiting the 110 South at Gaffey, take 1st Street to Western, continue South to Paseo Del Mar, then right.",
      "Park on Paseo Del Mar next to the field — it's not necessary to pay for the parking lot.",
    ],
    color: "#1d4ed8",
  },
  {
    name: "St Pius X",
    location: "Downey, CA",
    address: "7851 Gardendale St, Downey, CA 90242",
    mapsUrl: "https://maps.google.com/?q=7851+Gardendale+St,+Downey,+CA+90242",
    appleMapsUrl: "https://maps.apple.com/?q=7851+Gardendale+St+Downey+CA+90242",
    notes: [
      "Enter and park off of Consuelo Street.",
    ],
    color: "#7c3aed",
  },
];

const SPONSORS_DATA = [
  { name:"Daniel Gutierrez", role:"Diamond Classics Founder", description:"Thank you to Daniel Gutierrez for founding and building the Long Beach Diamond Classics into the league it is today. Your dedication to men's 50+ baseball in Southern California keeps the love of the game alive.", email:"dgutierrez22@yahoo.com", website:"", featured:true },
  { name:"Adam — Mainline Design", role:"Website Design & Development", description:"A huge thank you to Adam for building this amazing website and bringing the Diamond Classics experience online. 🙌", email:"adam.mainlinewebdesign@gmail.com", website:"" },
];
function getSponsorsData() {
  return SPONSORS_DATA;
}

/* ─── CONTACT INFO ───────────────────────────────────────────────────────── */
// Single source of truth for league/site contact info. Editable by admin via
// AdminContactEditor → upserted into Supabase `lbdc_contact` (id="main").
const CONTACT_INFO = {
  commissionerTitle: "League Commissioner",
  commissionerName: "Daniel Gutierrez",
  commissionerEmail: "dgutierrez22@yahoo.com",
  commissionerPhone: "(626) 722-2938",
  zelleNote: "Send to cell number above",
  venmoHandle: "@Titans-baseball",
  venmoQrUrl: "/qr-code.png",
  designerName: "Adam — Mainline Web Design",
  designerEmail: "adam.mainlinewebdesign@gmail.com",
  designerWebsite: "https://mainline-webdesign.com/",
};
// Strip non-digits for tel: links
const phoneToTel = (p) => "+1" + (p||"").replace(/[^0-9]/g, "");
// Module-level cache so any page render can read contact info synchronously
// after the first fetch resolves. Components also subscribe via useContactInfo.
let _CONTACT_CACHE = { ...CONTACT_INFO };
const _CONTACT_LISTENERS = new Set();
function _setContactCache(next) {
  _CONTACT_CACHE = { ...CONTACT_INFO, ...(next||{}) };
  _CONTACT_LISTENERS.forEach(fn => { try { fn(_CONTACT_CACHE); } catch(e){} });
}
function useContactInfo() {
  const [info, setInfo] = useState(_CONTACT_CACHE);
  useEffect(() => {
    _CONTACT_LISTENERS.add(setInfo);
    sbFetch("lbdc_contact?id=eq.main&select=data")
      .then(rows => {
        if (rows && rows[0] && rows[0].data) _setContactCache(rows[0].data);
      }).catch(()=>{});
    return () => { _CONTACT_LISTENERS.delete(setInfo); };
  }, []);
  return info;
}

function FieldDirectionsPage() {
  const [fields, setFields] = useState(FIELDS_INFO);
  const c = useContactInfo();
  useEffect(() => {
    sbFetch("lbdc_fields?id=eq.main&select=data")
      .then(rows => { if (rows && rows[0] && rows[0].data) setFields(rows[0].data); })
      .catch(() => {});
  }, []);
  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",overflowX:"hidden",width:"100%"}}>
      <PageHero label="Diamond Classics Baseball" title="Field Directions" subtitle="Locations & directions for all Diamond Classics fields" />
      <div style={{maxWidth:900,margin:"0 auto",padding:"28px clamp(12px,3vw,40px) 60px"}}>
        <div style={{display:"flex",flexDirection:"column",gap:20}}>
          {fields.map(field => (
            <div key={field.name} style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderTop:`3px solid ${field.color}`,borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
              <div style={{padding:"20px 24px",borderBottom:"1px solid rgba(0,0,0,0.07)"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <span style={{fontSize:22}}>🏟️</span>
                      <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:28,color:"#111",textTransform:"uppercase",lineHeight:1}}>{field.name}</h2>
                    </div>
                    <div style={{fontSize:13,color:"rgba(0,0,0,0.5)",marginBottom:6}} dangerouslySetInnerHTML={sanitizeHTML(field.address)} />
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    <a href={field.mapsUrl} target="_blank" rel="noopener noreferrer"
                      style={{display:"inline-flex",alignItems:"center",gap:6,background:"#4285f4",color:"#fff",borderRadius:8,padding:"9px 16px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,letterSpacing:".04em",textDecoration:"none",transition:"opacity .15s"}}
                      onMouseEnter={e=>e.currentTarget.style.opacity=".85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                      📍 Google Maps
                    </a>
                    <a href={field.appleMapsUrl} target="_blank" rel="noopener noreferrer"
                      style={{display:"inline-flex",alignItems:"center",gap:6,background:"#111",color:"#fff",borderRadius:8,padding:"9px 16px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,letterSpacing:".04em",textDecoration:"none",transition:"opacity .15s"}}
                      onMouseEnter={e=>e.currentTarget.style.opacity=".85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                      🍎 Apple Maps
                    </a>
                  </div>
                </div>
              </div>
              <div style={{padding:"16px 24px"}}>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"rgba(0,0,0,0.35)",marginBottom:10}}>Field Notes & Parking</div>
                <ul style={{listStyle:"none",padding:0,margin:0,display:"flex",flexDirection:"column",gap:8}}>
                  {field.notes.map((note,i) => (
                    <li key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                      <span style={{color:field.color,fontWeight:900,fontSize:13,marginTop:1,flexShrink:0}}>→</span>
                      <span style={{fontSize:14,color:"rgba(0,0,0,0.65)",lineHeight:1.5}} dangerouslySetInnerHTML={sanitizeHTML(note)} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
        <div style={{marginTop:24,background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:10,padding:"16px 20px",textAlign:"center"}}>
          <div style={{fontSize:13,color:"rgba(0,0,0,0.5)"}}>Questions about field locations? Contact <strong>{c.commissionerName}</strong>{c.commissionerEmail && <> at <a href={`mailto:${c.commissionerEmail}`} style={{color:"#002d6e"}}>{c.commissionerEmail}</a></>}</div>
        </div>
      </div>
    </div>
  );
}

/* ─── SPONSORS PAGE ──────────────────────────────────────────────────────── */
function SponsorsPage() {
  const [sponsors, setSponsors] = useState(SPONSORS_DATA);
  useEffect(() => {
    sbFetch("lbdc_sponsors?id=eq.main&select=data")
      .then(rows => { if (rows && rows[0] && rows[0].data) setSponsors(rows[0].data); })
      .catch(() => {});
  }, []);
  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",overflowX:"hidden",width:"100%"}}>
      <PageHero label="Diamond Classics Baseball" title="Sponsors & Contributors" subtitle="With gratitude to those who support Long Beach Diamond Classics" />
      {getPageContent("sponsors_intro") && <div style={{maxWidth:900,margin:"0 auto",padding:"16px clamp(12px,3vw,40px) 0"}} dangerouslySetInnerHTML={sanitizeHTML(getPageContent("sponsors_intro"))} />}
      <div style={{maxWidth:900,margin:"0 auto",padding:"28px clamp(12px,3vw,40px) 60px"}}>
        {sponsors.map((sp,i)=> sp.featured ? (
          <div key={i} style={{background:"linear-gradient(135deg,#001a3e 0%,#002d6e 100%)",borderRadius:16,padding:"32px",marginBottom:28,color:"#fff",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",right:-20,top:-20,fontSize:120,opacity:.06,lineHeight:1}}>⚾</div>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:"#FFD700",marginBottom:8}}>{sp.role}</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:36,textTransform:"uppercase",lineHeight:1,marginBottom:8}}>{sp.name}</div>
            <div style={{fontSize:14,color:"rgba(255,255,255,0.7)",lineHeight:1.6,maxWidth:600}} dangerouslySetInnerHTML={sanitizeHTML(sp.description||"")} />
          </div>
        ) : (
          <div key={i} style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderTop:`3px solid ${i===1?"#f59e0b":"#002d6e"}`,borderRadius:12,padding:"24px",marginBottom:16,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
            <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
              {i===1 && <div style={{width:52,height:52,borderRadius:"50%",background:"rgba(245,158,11,0.1)",border:"2px solid rgba(245,158,11,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>💻</div>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,textTransform:"uppercase",color:"#111"}}>{sp.name}</div>
                {sp.role && <div style={{fontSize:12,fontWeight:700,color:i===1?"rgba(245,158,11,0.85)":"#002d6e",textTransform:"uppercase",letterSpacing:".06em",marginTop:2}}>{sp.role}</div>}
                {sp.description && <div style={{fontSize:13,color:"rgba(0,0,0,0.55)",marginTop:4,lineHeight:1.5}} dangerouslySetInnerHTML={sanitizeHTML(sp.description)} />}
                {!sp.description && sp.email && <div style={{marginTop:6}}><a href={`mailto:${sp.email}`} style={{fontSize:13,color:"#002d6e"}}>{sp.email}</a></div>}
                {sp.website && <div style={{marginTop:4}}><a href={sp.website} target="_blank" rel="noopener noreferrer" style={{fontSize:13,color:"#002d6e"}}>{sp.website}</a></div>}
              </div>
            </div>
          </div>
        ))}
        {/* Become a Sponsor CTA */}
        <div style={{background:"#fff",border:"2px dashed rgba(0,45,110,0.2)",borderRadius:12,padding:"28px 24px",textAlign:"center",marginTop:24}}>
          <div style={{fontSize:32,marginBottom:10}}>🤝</div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:24,color:"#002d6e",textTransform:"uppercase",marginBottom:8}}>Interested in Sponsoring?</div>
          <div style={{fontSize:14,color:"rgba(0,0,0,0.55)",lineHeight:1.6,marginBottom:18,maxWidth:480,margin:"0 auto 18px"}}>
            Support Long Beach Diamond Classics and get your business in front of 100+ active players and their families. Contact us to learn about sponsorship opportunities.
          </div>
          <a href="mailto:dgutierrez22@yahoo.com?subject=LBDC Sponsorship Inquiry"
            style={{display:"inline-block",background:"#002d6e",color:"#fff",borderRadius:10,padding:"12px 28px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,letterSpacing:".06em",textDecoration:"none",textTransform:"uppercase"}}>
            Contact Us
          </a>
        </div>
      </div>
    </div>
  );
}

/* ─── PHOTOS PAGE ────────────────────────────────────────────────────────── */
function PhotosPage() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    sbLoadGallery().then(items => { setPhotos(items || []); setLoading(false); });
  }, []);

  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",overflowX:"hidden",width:"100%"}}>
      {lightbox !== null && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>setLightbox(null)}>
          <img src={photos[lightbox]?.url} alt={photos[lightbox]?.caption||""} style={{maxWidth:"90vw",maxHeight:"85vh",objectFit:"contain",borderRadius:8}} onClick={e=>e.stopPropagation()} />
          <button onClick={()=>setLightbox(null)} style={{position:"fixed",top:20,right:20,background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:8,width:40,height:40,fontSize:20,cursor:"pointer"}}>✕</button>
          {photos[lightbox]?.caption && <div style={{position:"fixed",bottom:24,left:0,right:0,textAlign:"center",color:"rgba(255,255,255,0.7)",fontSize:14,padding:"0 20px"}}>{photos[lightbox].caption}</div>}
        </div>
      )}
      <PageHero label="Diamond Classics Baseball" title="Photos & Videos" subtitle="Memories from the field" />
      <div style={{maxWidth:1200,margin:"0 auto",padding:"28px clamp(12px,3vw,40px) 60px"}}>
        {loading ? (
          <div style={{textAlign:"center",padding:"60px 0",color:"rgba(0,0,0,0.4)",fontSize:15}}>Loading gallery…</div>
        ) : photos.length === 0 ? (
          <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:14,padding:"60px 24px",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
            <div style={{fontSize:56,marginBottom:16}}>📸</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:28,color:"#002d6e",textTransform:"uppercase",marginBottom:10}}>Photos Coming Soon</div>
            <div style={{fontSize:14,color:"rgba(0,0,0,0.5)",lineHeight:1.6,maxWidth:400,margin:"0 auto"}}>
              Game photos, team shots, and highlight videos from the 2026 Spring/Summer season will be posted here. Check back after opening day on April 11th!
            </div>
          </div>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:16}}>
            {photos.map((p, i) => (
              p.type === "video" ? (
                <div key={p.id||i} style={{background:"#fff",borderRadius:10,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.08)"}}>
                  <div style={{position:"relative",paddingBottom:"56.25%",background:"#111"}}>
                    <iframe
                      src={ytEmbedUrl(p.url)}
                      style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none"}}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen title={p.caption||"Video"} />
                  </div>
                  {p.caption && <div style={{padding:"10px 12px",fontSize:13,color:"rgba(0,0,0,0.6)"}}>{p.caption}</div>}
                </div>
              ) : (
                <div key={p.id||i} onClick={()=>setLightbox(i)} style={{background:"#fff",borderRadius:10,overflow:"hidden",cursor:"pointer",boxShadow:"0 1px 4px rgba(0,0,0,0.08)",transition:"box-shadow .15s"}}
                  onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.15)"}
                  onMouseLeave={e=>e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.08)"}>
                  <img src={p.url} alt={p.caption||""} style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",display:"block"}} />
                  {p.caption && <div style={{padding:"10px 12px",fontSize:13,color:"rgba(0,0,0,0.6)"}}>{p.caption}</div>}
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── CAPTAIN ROSTER EDITOR ──────────────────────────────────────────────── */
function CaptainRosterEditor({ teamName }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null); // Supabase id or -1 for new
  const [editForm, setEditForm] = useState({number:"",name:"",status:"Active"});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Load this team's players from Supabase on mount
  useEffect(() => {
    setLoading(true);
    sbFetch(`lbdc_rosters?select=*&team=eq.${encodeURIComponent(teamName)}&order=id.asc`)
      .then(rows => {
        setPlayers((rows || []).map(r => ({id: r.id, number: r.number || "", name: r.name || "", status: r.status || "Active"})));
        setLoading(false);
      })
      .catch(() => {
        setPlayers([...(TEAM_ROSTERS[teamName] || []).map(p=>({...p,status:"Active"}))]);
        setError("Could not load roster from server. Showing local fallback.");
        setLoading(false);
      });
  }, [teamName]);

  const startEdit = (idx) => {
    const p = players[idx];
    setEditId(p.id);
    setEditForm({number: p.number || "", name: p.name || "", status: p.status || "Active"});
  };
  const cancelEdit = () => { setEditId(null); setEditForm({number:"",name:"",status:"Active"}); };

  const savePlayer = async () => {
    if (!editForm.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      if (editId === -1) {
        const rows = await sbPost("lbdc_rosters", {team: teamName, number: editForm.number.trim(), name: editForm.name.trim(), status: editForm.status});
        setPlayers(p => [...p, {id: rows[0].id, number: editForm.number.trim(), name: editForm.name.trim(), status: editForm.status}]);
      } else {
        await sbPatch(`lbdc_rosters?id=eq.${editId}`, {number: editForm.number.trim(), name: editForm.name.trim(), status: editForm.status});
        setPlayers(p => p.map(pl => pl.id === editId ? {...pl, number: editForm.number.trim(), name: editForm.name.trim(), status: editForm.status} : pl));
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      cancelEdit();
    } catch(e) {
      setError("Failed to save player. Please try again.");
    }
    setSaving(false);
  };

  const deletePlayer = async (idx) => {
    const p = players[idx];
    if (!window.confirm(`Remove ${p?.name}?`)) return;
    setSaving(true);
    setError("");
    try {
      await sbDelete(`lbdc_rosters?id=eq.${p.id}`);
      setPlayers(pl => pl.filter((_,i) => i !== idx));
    } catch(e) {
      setError("Failed to delete player. Please try again.");
    }
    setSaving(false);
  };

  if (loading) return <div style={{textAlign:"center",padding:"24px",color:"rgba(0,0,0,0.4)",fontSize:14}}>Loading roster…</div>;

  return (
    <div>
      {error && <div style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:6,padding:"8px 12px",marginBottom:10,color:"#dc2626",fontWeight:600,fontSize:13}}>{error}</div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:13,color:"rgba(0,0,0,0.45)"}}>{players.length} players</div>
        <button onClick={()=>{ setEditId(-1); setEditForm({number:"",name:""}); }} style={{padding:"7px 16px",background:"#2d6a4f",border:"none",borderRadius:8,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>+ Add Player</button>
      </div>

      {editId !== null && (
        <div style={{background:"#f0fff4",border:"1px solid rgba(22,163,74,0.2)",borderRadius:8,padding:"14px 16px",marginBottom:14}}>
          <div style={{fontWeight:900,fontFamily:"'Barlow Condensed',sans-serif",textTransform:"uppercase",fontSize:14,color:"#2d6a4f",marginBottom:10}}>{editId===-1?"Add Player":"Edit Player"}</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end"}}>
            <input value={editForm.number} onChange={e=>setEditForm(f=>({...f,number:e.target.value}))}
              placeholder="#" style={{width:60,padding:"8px 10px",border:"1px solid rgba(0,0,0,0.15)",borderRadius:6,fontSize:15}} />
            <input value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))}
              placeholder="Player name" style={{flex:1,minWidth:160,padding:"8px 12px",border:"1px solid rgba(0,0,0,0.15)",borderRadius:6,fontSize:15}} />
            <select value={editForm.status} onChange={e=>setEditForm(f=>({...f,status:e.target.value}))}
              style={{padding:"8px 10px",border:"1px solid rgba(0,0,0,0.15)",borderRadius:6,fontSize:14,background:"#fff"}}>
              <option value="Active">Active</option>
              <option value="DL">DL</option>
              <option value="Released">Released</option>
            </select>
            <button onClick={savePlayer} disabled={saving} style={{padding:"8px 16px",background:"#16a34a",border:"none",borderRadius:6,color:"#fff",fontWeight:700,cursor:"pointer",opacity:saving?.6:1}}>
              {saving?"Saving…":"Save"}
            </button>
            <button onClick={cancelEdit} disabled={saving} style={{padding:"8px 16px",background:"rgba(0,0,0,0.1)",border:"none",borderRadius:6,fontWeight:700,cursor:"pointer"}}>Cancel</button>
          </div>
        </div>
      )}

      {players.length === 0 ? (
        <div style={{textAlign:"center",padding:"24px",color:"rgba(0,0,0,0.4)",fontStyle:"italic"}}>No players yet — click "+ Add Player" to add your first.</div>
      ) : (
        players.map((p,i) => (
          <div key={p.id ?? i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderBottom:"1px solid rgba(0,0,0,0.06)",background:i%2===0?"#fff":"#fafafa",opacity:p.status==="Released"?0.5:1}}>
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:12,color:"rgba(0,0,0,0.3)",width:28,textAlign:"right",flexShrink:0}}>#{p.number||"—"}</span>
            <span style={{flex:1,fontWeight:600,color:p.status==="Released"?"#9ca3af":"#111"}}>{p.name}</span>
            {p.status && p.status !== "Active" && (
              <span style={{fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:10,
                background: p.status==="DL"?"#fef3c7":p.status==="Released"?"#f3f4f6":"#dcfce7",
                color: p.status==="DL"?"#92400e":p.status==="Released"?"#6b7280":"#166534",
                whiteSpace:"nowrap"}}>
                {p.status}
              </span>
            )}
            <button onClick={()=>startEdit(i)} style={{padding:"3px 10px",background:"rgba(0,45,110,0.08)",border:"none",borderRadius:4,color:"#002d6e",fontWeight:700,fontSize:12,cursor:"pointer"}}>Edit</button>
            <button onClick={()=>deletePlayer(i)} disabled={saving} style={{padding:"3px 10px",background:"rgba(220,38,38,0.08)",border:"none",borderRadius:4,color:"#dc2626",fontWeight:700,fontSize:12,cursor:"pointer"}}>✕</button>
          </div>
        ))
      )}
      {saved && <div style={{marginTop:10,color:"#16a34a",fontWeight:700,fontSize:13}}>✓ Roster saved!</div>}
    </div>
  );
}

/* ─── PHOTO UPLOAD / SUPABASE STORAGE ───────────────────────────────────── */
function compressImageToBlob(file, maxWidth = 1400, quality = 0.82) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => resolve(blob), "image/jpeg", quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
// Converts any YouTube URL format to a clean embed URL
function ytEmbedUrl(url) {
  if (!url) return "";
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
}

async function sbUploadPhotoFile(file, caption) {
  const blob = await compressImageToBlob(file);
  const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const uploadRes = await fetch(`${SB_URL}/storage/v1/object/photos/${filename}`, {
    method: "POST",
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "image/jpeg" },
    body: blob,
  });
  if (!uploadRes.ok) { const t = await uploadRes.text(); throw new Error(`Storage upload failed: ${t}`); }
  const publicUrl = `${SB_URL}/storage/v1/object/public/photos/${filename}`;
  const rows = await sbPost("lbdc_gallery", { url: publicUrl, caption: caption || "", type: "photo" });
  return rows[0];
}
async function sbAddVideoLink(url, caption) {
  const rows = await sbPost("lbdc_gallery", { url, caption: caption || "", type: "video" });
  return rows[0];
}
async function sbLoadGallery() {
  try { return await sbFetch("lbdc_gallery?order=created_at.desc&select=*"); } catch(e) { return []; }
}
async function sbDeleteGalleryItem(id, url) {
  await fetch(`${SB_URL}/rest/v1/lbdc_gallery?id=eq.${id}`, {
    method: "DELETE",
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (url && url.includes("/storage/v1/object/public/photos/")) {
    const filename = url.split("/storage/v1/object/public/photos/")[1];
    await fetch(`${SB_URL}/storage/v1/object/photos/${filename}`, {
      method: "DELETE",
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
  }
}
async function sbUpdateGalleryCaption(id, caption) {
  await fetch(`${SB_URL}/rest/v1/lbdc_gallery?id=eq.${id}`, {
    method: "PATCH",
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ caption }),
  });
}

/* ─── RICH TEXT EDITOR ───────────────────────────────────────────────────── */
const PAGE_CONTENT_BLOCKS = [
  { pageId:"home",      pageLabel:"🏠 Home Page",           blocks:[
    { id:"home_announcement", label:"Announcement / Welcome Text", placeholder:"Add a welcome message or league announcement that appears on the home page..." },
  ]},
  { pageId:"signup",    pageLabel:"📋 Player Sign Up Page",  blocks:[
    { id:"signup_intro", label:"Sign Up Introduction", placeholder:"Describe how to sign up, what to expect, or any important notes for new players..." },
  ]},
  { pageId:"sponsors",  pageLabel:"🤝 Sponsors Page",        blocks:[
    { id:"sponsors_intro", label:"Sponsors Introduction", placeholder:"Add an intro paragraph for the sponsors page..." },
  ]},
  { pageId:"directions",pageLabel:"🏟️ Field Directions Page",blocks:[
    { id:"directions_intro", label:"Field Directions Introduction", placeholder:"Add notes or intro text for the field directions page..." },
  ]},
  { pageId:"rules",     pageLabel:"📜 Rules Page",           blocks:[
    { id:"rules_intro", label:"Rules Page Note", placeholder:"Add a note or intro that appears above the rules..." },
  ]},
  { pageId:"graphics",  pageLabel:"📅 Schedule Graphics",    blocks:[
    { id:"graphics_intro", label:"Schedule Graphics Note", placeholder:"Add a note about the schedule graphics..." },
  ]},
];

// Module-level cache — populated from Supabase on app startup
const _pageContentMap = {};
const _savePageDebounce = {};

function getPageContent(id) {
  return _pageContentMap[id] || "";
}
function savePageContent(id, html) {
  _pageContentMap[id] = html;
  clearTimeout(_savePageDebounce[id]);
  _savePageDebounce[id] = setTimeout(() => {
    safeSave(`Page content (${id})`, () => sbUpsert("lbdc_page_content", {id, content: html}));
  }, 1000);
}

function RichTextInput({ defaultValue, onChange, placeholder, minHeight=80 }) {
  const editorRef = useRef();
  const [showToolbar, setShowToolbar] = useState(false);
  const exec = (cmd, val) => { editorRef.current?.focus(); document.execCommand(cmd, false, val || null); };
  useEffect(() => { if (editorRef.current) editorRef.current.innerHTML = defaultValue || ""; }, []);
  const tbtn = (label, cmd, val, title) => (
    <button title={title||label} onMouseDown={e=>{e.preventDefault();exec(cmd,val);}}
      style={{padding:"3px 7px",border:"1px solid #ddd",borderRadius:4,background:"#fff",color:"#333",cursor:"pointer",fontSize:12,fontWeight:700,lineHeight:1,flexShrink:0}}>
      {label}
    </button>
  );
  return (
    <div style={{border:"1px solid #ddd",borderRadius:6,overflow:"hidden",background:"#fff"}} onFocus={()=>setShowToolbar(true)}>
      {showToolbar && (
        <div style={{display:"flex",flexWrap:"wrap",gap:3,padding:"5px 7px",borderBottom:"1px solid #eee",background:"#f9f9f9",alignItems:"center"}}>
          {tbtn("B","bold",null,"Bold")}
          {tbtn("I","italic",null,"Italic")}
          {tbtn("U","underline",null,"Underline")}
          <select onMouseDown={e=>e.stopPropagation()} onChange={e=>{exec("fontSize",e.target.value);e.target.value="0";}} defaultValue="0"
            style={{padding:"2px 4px",border:"1px solid #ddd",borderRadius:4,fontSize:11,height:24,cursor:"pointer"}}>
            <option value="0">Size</option>
            <option value="1">XS</option><option value="2">S</option><option value="3">M</option>
            <option value="4">L</option><option value="5">XL</option><option value="6">XXL</option><option value="7">Huge</option>
          </select>
          <input type="color" title="Text color" defaultValue="#111111" onMouseDown={e=>e.stopPropagation()} onChange={e=>exec("foreColor",e.target.value)}
            style={{width:24,height:24,border:"1px solid #ddd",borderRadius:4,cursor:"pointer",padding:1,flexShrink:0}} />
          {tbtn("≡L","justifyLeft",null,"Left")}
          {tbtn("≡C","justifyCenter",null,"Center")}
          {tbtn("≡R","justifyRight",null,"Right")}
        </div>
      )}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={e=>onChange&&onChange(e.currentTarget.innerHTML)}
        data-placeholder={placeholder}
        style={{minHeight,padding:"7px 10px",fontSize:14,lineHeight:1.6,outline:"none",color:"#222"}}
      />
    </div>
  );
}

function RichTextEditor({ contentId, placeholder }) {
  const editorRef = useRef();
  const [active, setActive] = useState({});
  const exec = (cmd, val) => { editorRef.current?.focus(); document.execCommand(cmd, false, val || null); updateActive(); };
  const updateActive = () => {
    setActive({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      justifyLeft: document.queryCommandState("justifyLeft"),
      justifyCenter: document.queryCommandState("justifyCenter"),
      justifyRight: document.queryCommandState("justifyRight"),
    });
  };
  const onInput = (e) => { savePageContent(contentId, e.currentTarget.innerHTML); updateActive(); };
  const saved = getPageContent(contentId);

  const tbBtn = (label, cmd, val, activeKey, title) => (
    <button title={title||label} onMouseDown={e=>{e.preventDefault();exec(cmd,val);}}
      style={{padding:"5px 9px",border:"1px solid #ddd",borderRadius:5,background:active[activeKey||cmd]?"#002d6e":"#fff",
        color:active[activeKey||cmd]?"#fff":"#333",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600,lineHeight:1}}>
      {label}
    </button>
  );

  return (
    <div style={{border:"1px solid #ddd",borderRadius:8,overflow:"hidden",background:"#fff"}}>
      {/* Toolbar */}
      <div style={{display:"flex",flexWrap:"wrap",gap:4,padding:"8px 10px",borderBottom:"1px solid #eee",background:"#fafafa",alignItems:"center"}}>
        {tbBtn("B","bold",null,"bold","Bold")}
        {tbBtn("I","italic",null,"italic","Italic")}
        {tbBtn("U","underline",null,"underline","Underline")}
        <div style={{width:1,height:22,background:"#ddd",margin:"0 2px"}} />
        <select defaultValue="3" onMouseDown={e=>e.stopPropagation()} onChange={e=>{exec("fontSize",e.target.value);e.target.value="3";}}
          style={{padding:"4px 6px",border:"1px solid #ddd",borderRadius:5,fontSize:12,cursor:"pointer",height:30}}>
          <option value="3">Font Size</option>
          <option value="1">Tiny</option>
          <option value="2">Small</option>
          <option value="3">Normal</option>
          <option value="4">Large</option>
          <option value="5">X-Large</option>
          <option value="6">XX-Large</option>
          <option value="7">Huge</option>
        </select>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{fontSize:12,color:"#666"}}>Color:</span>
          <input type="color" defaultValue="#111111" onMouseDown={e=>e.stopPropagation()} onChange={e=>exec("foreColor",e.target.value)}
            style={{width:28,height:28,border:"1px solid #ddd",borderRadius:4,cursor:"pointer",padding:1}} />
        </div>
        <div style={{width:1,height:22,background:"#ddd",margin:"0 2px"}} />
        {tbBtn("≡L","justifyLeft",null,"justifyLeft","Align Left")}
        {tbBtn("≡C","justifyCenter",null,"justifyCenter","Center")}
        {tbBtn("≡R","justifyRight",null,"justifyRight","Align Right")}
        <div style={{width:1,height:22,background:"#ddd",margin:"0 2px"}} />
        {tbBtn("• List","insertUnorderedList",null,null,"Bullet List")}
        {tbBtn("1. List","insertOrderedList",null,null,"Numbered List")}
        <div style={{width:1,height:22,background:"#ddd",margin:"0 2px"}} />
        <button onMouseDown={e=>{e.preventDefault();if(window.confirm("Clear all content in this block?"))editorRef.current.innerHTML="";savePageContent(contentId,"");}}
          style={{padding:"5px 9px",border:"1px solid #fca5a5",borderRadius:5,background:"#fff",color:"#dc2626",cursor:"pointer",fontSize:12,fontWeight:600}}>
          Clear
        </button>
      </div>
      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={onInput}
        onKeyUp={updateActive}
        onMouseUp={updateActive}
        dangerouslySetInnerHTML={sanitizeHTML(saved)}
        data-placeholder={placeholder}
        style={{minHeight:100,padding:"12px 14px",fontSize:14,lineHeight:1.7,outline:"none",color:"#222"}}
      />
    </div>
  );
}

function getRulesData() {
  return RULES_DATA;
}

function getFieldsData() {
  return FIELDS_INFO;
}

/* ─── RULES PAGE ─────────────────────────────────────────────────────────── */
function RulesPage() {
  const [allRules, setAllRules] = useState(RULES_DATA);
  const [division, setDivision] = useState("saturday");
  useEffect(() => {
    sbFetch("lbdc_rules?id=eq.main&select=data")
      .then(rows => { if (rows && rows[0] && rows[0].data) setAllRules(rows[0].data); })
      .catch(() => {});
  }, []);

  const saturdayRules = allRules.filter(r => !r.section.toLowerCase().startsWith("boomers"));
  const boomersRules  = allRules.filter(r => r.section.toLowerCase().startsWith("boomers"));
  const rules = division === "saturday" ? saturdayRules : boomersRules;

  const tabBtn = (key, label, icon) => (
    <button key={key} onClick={() => setDivision(key)} style={{
      flex:1, padding:"16px 10px", border:"none", cursor:"pointer",
      background: division===key ? "#002d6e" : "#fff",
      color: division===key ? "#fff" : "#002d6e",
      fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900,
      fontSize:"clamp(16px,4vw,22px)", textTransform:"uppercase", letterSpacing:".04em",
      borderRadius: key==="saturday" ? "12px 0 0 12px" : "0 12px 12px 0",
      borderTop: division===key ? "none" : "2px solid rgba(0,45,110,0.2)",
      borderBottom: division===key ? "none" : "2px solid rgba(0,45,110,0.2)",
      borderLeft: key==="saturday" ? (division===key ? "none" : "2px solid rgba(0,45,110,0.2)") : "1px solid rgba(0,45,110,0.15)",
      borderRight: key==="boomers"  ? (division===key ? "none" : "2px solid rgba(0,45,110,0.2)") : "1px solid rgba(0,45,110,0.15)",
      transition:"all .2s", display:"flex", alignItems:"center", justifyContent:"center", gap:8,
      boxShadow: division===key ? "0 4px 18px rgba(0,45,110,0.25)" : "none",
    }}>
      <span style={{fontSize:"clamp(18px,5vw,28px)"}}>{icon}</span>
      <div style={{textAlign:"left"}}>
        <div>{label}</div>
        <div style={{fontSize:"clamp(10px,2.5vw,13px)",fontWeight:600,opacity:.7,letterSpacing:".02em",textTransform:"none"}}>
          {key==="saturday" ? "Saturday League" : "60/70 Division"}
        </div>
      </div>
    </button>
  );

  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",overflowX:"hidden",width:"100%"}}>
      <PageHero label="Diamond Classics Baseball" title="Field Guide" subtitle="Official rules and guidelines for the 2026 season" />
      {getPageContent("rules_intro") && <div style={{maxWidth:900,margin:"0 auto",padding:"16px clamp(12px,3vw,40px) 0"}} dangerouslySetInnerHTML={sanitizeHTML(getPageContent("rules_intro"))} />}
      <div style={{maxWidth:900,margin:"0 auto",padding:"28px clamp(12px,3vw,40px) 60px"}}>

        {/* Division picker */}
        <div style={{display:"flex",marginBottom:24,boxShadow:"0 2px 12px rgba(0,0,0,0.1)",borderRadius:12,overflow:"hidden"}}>
          {tabBtn("saturday","Saturday Division","⚾")}
          {tabBtn("boomers","Boomers Rules","🟣")}
        </div>

        {/* Jump-to nav */}
        <Card style={{marginBottom:24}}>
          <div style={{padding:"14px 20px",borderBottom:"1px solid rgba(0,0,0,0.07)"}}>
            <span style={{fontSize:11,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:"rgba(0,0,0,0.4)"}}>Jump To</span>
          </div>
          <div style={{padding:"14px 20px",display:"flex",flexWrap:"wrap",gap:8}}>
            {rules.map(r => (
              <button key={r.section} type="button"
                onClick={()=>document.getElementById(`rule-${r.section.replace(/\s+/g,"-").toLowerCase()}`)?.scrollIntoView({behavior:"smooth",block:"start"})}
                style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(0,45,110,0.06)",border:"1px solid rgba(0,45,110,0.15)",borderRadius:20,padding:"5px 14px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,color:"#002d6e",cursor:"pointer"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(0,45,110,0.12)"}
                onMouseLeave={e=>e.currentTarget.style.background="rgba(0,45,110,0.06)"}>
                {r.icon} {r.section}
              </button>
            ))}
          </div>
        </Card>

        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {rules.map(r => (
            <div key={r.section} id={`rule-${r.section.replace(/\s+/g,"-").toLowerCase()}`} style={{scrollMarginTop:72}}>
              <Card style={{padding:0}}>
                <div style={{padding:"16px 24px",borderBottom:"1px solid rgba(0,0,0,0.07)",display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:22}}>{r.icon}</span>
                  <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:24,color:"#111",textTransform:"uppercase"}}>{r.section}</h2>
                </div>
                <div style={{padding:"16px 24px"}}>
                  <ol style={{listStyle:"none",display:"flex",flexDirection:"column",gap:10}}>
                    {r.items.map((item,i) => (
                      <li key={i} style={{display:"flex",gap:14}}>
                        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:12,color:"#002d6e",minWidth:24,paddingTop:1,flexShrink:0}}>{String(i+1).padStart(2,"0")}</span>
                        <span style={{fontSize:14,color:"rgba(0,0,0,0.65)",lineHeight:1.6}} dangerouslySetInnerHTML={sanitizeHTML(item)} />
                      </li>
                    ))}
                  </ol>
                </div>
              </Card>
            </div>
          ))}
        </div>
        <div style={{marginTop:20,background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:10,padding:"14px 20px",textAlign:"center",fontSize:13,color:"rgba(0,0,0,0.4)"}}>
          Questions? Contact Daniel Gutierrez, Diamond Classics Founder · Rules subject to change by league vote.
        </div>
      </div>
    </div>
  );
}

/* ─── HISTORY PAGE ──────────────────────────────────────────────────────── */
// Seasons that have box score data in Supabase (scraped or entered manually)
const SEASONS_WITH_BOX_SCORES = new Set([
  "2025 Spring/Summer Season",
  "2025 NABA AZ World Series 50's",
  "2025 NABA Father/Son",
  "2025 NABA Las Vegas World Series 60's",
  "2025 4th of July-NABA",
  "2025 Memorial Weekend Tournament-Las Vegas",
  "2025 NABA Great Park Tournament",
  "2025 NABA MLK Tournament",
  "2024/2025 Fall Winter Season",
  "2024 Spring/Summer Season",
  "2024 4th of July-NABA",
  "2024 Father/Son NABA",
  "2024 MG Turkey Bowl Tournament",
  "2024 MLK-NABA",
  "2024 NABA LAS VEGAS World Series - 60+",
  "2024 NABA World Series - 65+",
  "2023 Thanksgiving Turkey Bowl",
  "2026 Fall/Winter Season (Season #10)",
  "2023 Fall/Winter Season",
  "NABA World Series-LAS VEGAS 2023",
  "2023 Spring/Summer Season",
  "2022 Fall/Winter Season",
  "2022 Summer Season",
  "2021 Fall/Winter Season",
  "2021 50+",
  "Summer 2019",
  "2026 NABA MLK 55+ Division",
]);

function HistoryPage() {
  // Group seasons by category
  const LBDC_REGULAR = [
    "Spring/Summer 2026 Diamond Classics Saturdays",
    "2026 Fall/Winter Season (Season #10)",
    "2025 Spring/Summer Season",
    "2024/2025 Fall Winter Season",
    "2024 Spring/Summer Season",
    "2023 Fall/Winter Season",
    "2023 Spring/Summer Season",
    "2022 Fall/Winter Season",
    "2022 Summer Season",
    "2021 Fall/Winter Season",
    "Summer 2019",
  ];

  const CATEGORIES = [
    { key: "regular", label: "Regular Seasons", filter: s => LBDC_REGULAR.includes(s.name) },
    { key: "tournament", label: "Tournaments & Special Events", filter: s => !LBDC_REGULAR.includes(s.name) },
  ];

  const [activeCategory, setActiveCategory] = useState("regular");
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [gameFilter, setGameFilter] = useState("all"); // "all" | "Final" | "Playoff"
  const [search, setSearch] = useState("");
  const [boxModal, setBoxModal] = useState(null); // {game, batting, pitching} or "loading"
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 700);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 700);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const openBoxScore = async (seasonName, g) => {
    setBoxModal("loading");
    try {
      // Find season in Supabase by name
      const seasons = await sbFetch(`seasons?select=id,name&limit=50`);
      const sb = seasons.find(s => s.name === seasonName);
      if (!sb) { setBoxModal(null); alert("Box score data not found for this season."); return; }
      // Find game by date + teams
      const isoDate = g.date.split("/").reduce((acc,p,i)=>i===2?`${p}-${acc}`:i===0?p.padStart(2,"0"):`${acc}-${p.padStart(2,"0")}`,"");
      // Convert M/D/YYYY → YYYY-MM-DD
      const [mo,dy,yr] = g.date.split("/");
      const gameDate = `${yr}-${mo.padStart(2,"0")}-${dy.padStart(2,"0")}`;
      const gamesRaw = await sbFetch(`games?select=id,game_date,away_team,home_team,away_score,home_score,field,status,headline&season_id=eq.${sb.id}&game_date=eq.${gameDate}&away_team=eq.${encodeURIComponent(g.away_team)}&limit=5`);
      const game = dedupGames(gamesRaw || [])[0];
      if (!game) { setBoxModal(null); alert("No box score found for this game."); return; }
      const [batting, pitching] = await Promise.all([
        sbFetch(`batting_lines?select=*&game_id=eq.${game.id}&limit=100`),
        sbFetch(`pitching_lines?select=*&game_id=eq.${game.id}&limit=50`),
      ]);
      if (batting.length === 0 && pitching.length === 0) { setBoxModal(null); alert("No player stats available for this game."); return; }
      setBoxModal({ game, batting, pitching });
    } catch(e) { setBoxModal(null); alert("Error loading box score: " + e.message); }
  };

  const categorySeasons = HISTORY_DATA.filter(
    CATEGORIES.find(c => c.key === activeCategory).filter
  ).filter(s => s.games.length > 0 || s.standings.length > 0);

  // Auto-select first season when category changes
  useEffect(() => {
    if (categorySeasons.length > 0) setSelectedSeason(categorySeasons[0]);
  }, [activeCategory]);

  const season = selectedSeason || categorySeasons[0];

  const filteredGames = (season?.games || []).filter(g => {
    if (gameFilter !== "all" && g.status !== gameFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return g.away_team.toLowerCase().includes(q) || g.home_team.toLowerCase().includes(q) || (g.headline||"").toLowerCase().includes(q);
    }
    return true;
  });

  const totalGames = HISTORY_DATA.reduce((s,d) => s + d.games.length, 0);
  const hasBoxScores = season && SEASONS_WITH_BOX_SCORES.has(season.name);

  return (
    <div style={{maxWidth:1200,margin:"0 auto",padding:"32px clamp(8px,3vw,32px)",overflowX:"hidden"}}>
      {/* Box score loading overlay */}
      {boxModal === "loading" && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:12,padding:"32px 48px",fontSize:16,fontWeight:600,color:"#002d6e"}}>Loading box score…</div>
        </div>
      )}
      {/* Box score modal */}
      {boxModal && boxModal !== "loading" && (
        <BoxScoreModal game={boxModal.game} batting={boxModal.batting} pitching={boxModal.pitching} onClose={()=>setBoxModal(null)} />
      )}
      {/* Header */}
      <div style={{marginBottom:28}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:38,
          textTransform:"uppercase",color:"#002d6e",letterSpacing:".04em",lineHeight:1}}>
          League History
        </div>
        <div style={{fontSize:13,color:"#888",marginTop:6}}>
          {HISTORY_DATA.length} seasons · {totalGames} games · going back to 2019
        </div>
      </div>

      {/* Category tabs */}
      <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setActiveCategory(c.key)}
            style={{padding:"8px 18px",borderRadius:20,border:"none",cursor:"pointer",
              fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,
              textTransform:"uppercase",letterSpacing:".04em",
              background:activeCategory===c.key?"#002d6e":"rgba(0,45,110,0.07)",
              color:activeCategory===c.key?"#fff":"#555",transition:"all .15s"}}>
            {c.label}
          </button>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"clamp(180px,22vw,220px) 1fr",gap:isMobile?12:20,alignItems:"start"}}>

        {/* Season list sidebar — desktop only; mobile uses dropdown */}
        {isMobile ? (
          <select
            value={season?.name || ""}
            onChange={e => setSelectedSeason(categorySeasons.find(s => s.name === e.target.value) || null)}
            style={{width:"100%",padding:"11px 14px",fontSize:15,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,
              border:"1px solid rgba(0,45,110,0.25)",borderRadius:10,background:"#fff",color:"#002d6e",
              appearance:"auto",gridColumn:"1/-1",marginBottom:4}}>
            {categorySeasons.map((s,i) => (
              <option key={i} value={s.name}>{s.name} — {s.games.length} games</option>
            ))}
          </select>
        ) : (
          <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:12,overflow:"hidden",
            position:"sticky",top:80,maxHeight:"80vh",overflowY:"auto"}}>
            {categorySeasons.map((s,i) => (
              <button key={i} onClick={() => setSelectedSeason(s)}
                style={{display:"block",width:"100%",textAlign:"left",padding:"12px 14px",
                  border:"none",borderBottom:"1px solid rgba(0,0,0,0.06)",cursor:"pointer",
                  background:season?.name===s.name?"rgba(0,45,110,0.07)":"#fff",
                  borderLeft:season?.name===s.name?"3px solid #002d6e":"3px solid transparent",
                  transition:"background .1s"}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,
                  color:season?.name===s.name?"#002d6e":"#222",lineHeight:1.3}}>
                  {s.name}
                </div>
                <div style={{fontSize:11,color:"#999",marginTop:3}}>
                  {s.games.length} games · {s.standings.length} teams
                </div>
              </button>
            ))}
            {categorySeasons.length === 0 && (
              <div style={{padding:20,textAlign:"center",color:"#aaa",fontSize:13}}>No seasons</div>
            )}
          </div>
        )}

        {/* Main content */}
        {season ? (
          <div>
            {/* Season header */}
            <div style={{background:"#002d6e",borderRadius:12,padding:"16px 20px",marginBottom:16,
              display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
              <div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:"clamp(16px,5vw,26px)",
                  color:"#FFD700",textTransform:"uppercase",letterSpacing:".04em",lineHeight:1.2}}>
                  {season.name}
                </div>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginTop:3,display:"flex",flexWrap:"wrap",alignItems:"center",gap:6}}>
                  {season.games.length} games played · {season.standings.length} teams
                  {hasBoxScores && <span style={{background:"rgba(255,215,0,0.2)",color:"#FFD700",borderRadius:4,padding:"2px 7px",fontSize:11,fontWeight:700,letterSpacing:".04em"}}>📊 Tap any game for box score</span>}
                </div>
              </div>
            </div>

            {/* Standings */}
            {season.standings.length > 0 && (
              <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:12,
                padding:"16px 20px",marginBottom:16}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,
                  textTransform:"uppercase",color:"#002d6e",marginBottom:12,letterSpacing:".04em"}}>
                  Standings
                </div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                    <thead>
                      <tr style={{background:"#001a3e"}}>
                        {["#","Team","W","L","T","Pts","GB"].map(h => (
                          <th key={h} style={{padding:"8px 10px",textAlign:h==="Team"||h==="#"?"left":"center",
                            fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,
                            textTransform:"uppercase",color:"rgba(255,255,255,0.6)",letterSpacing:".06em"}}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {season.standings.map((row,i) => (
                        <tr key={i} style={{borderBottom:"1px solid rgba(0,0,0,0.06)",
                          background:i===0?"rgba(255,215,0,0.06)":i%2===0?"#fff":"#fafafa"}}>
                          <td style={{padding:"8px 10px",fontWeight:700,color:"#aaa",fontSize:12}}>{i+1}</td>
                          <td style={{padding:"8px 10px",fontWeight:i===0?700:400,
                            fontFamily:i===0?"'Barlow Condensed',sans-serif":"inherit",
                            fontSize:i===0?15:13,color:i===0?"#002d6e":"#222"}}>
                            {i===0 && <span style={{marginRight:6}}>🏆</span>}
                            {row.team}
                          </td>
                          <td style={{padding:"8px 10px",textAlign:"center",fontWeight:700,color:"#15803d"}}>{row.w}</td>
                          <td style={{padding:"8px 10px",textAlign:"center",color:"#888"}}>{row.l}</td>
                          <td style={{padding:"8px 10px",textAlign:"center",color:"#888"}}>{row.t}</td>
                          <td style={{padding:"8px 10px",textAlign:"center",fontWeight:600}}>{row.pts}</td>
                          <td style={{padding:"8px 10px",textAlign:"center",color:"#888"}}>{row.gb}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Rosters */}
            {season.rosters && season.rosters.length > 0 && (
              <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:12,
                padding:"16px 20px",marginBottom:16}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,
                  textTransform:"uppercase",color:"#002d6e",marginBottom:14,letterSpacing:".04em"}}>
                  Rosters
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:14}}>
                  {season.rosters.map((roster,ri) => (
                    <div key={ri} style={{border:"1px solid rgba(0,45,110,0.12)",borderRadius:10,overflow:"hidden"}}>
                      <div style={{background:"#002d6e",padding:"8px 14px",
                        fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:15,
                        color:"#FFD700",textTransform:"uppercase",letterSpacing:".04em"}}>
                        {roster.team}
                        <span style={{float:"right",color:"rgba(255,255,255,0.4)",fontWeight:400,fontSize:12}}>
                          {roster.players.length} players
                        </span>
                      </div>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                        <thead>
                          <tr style={{background:"#f0f4fa"}}>
                            <th style={{padding:"5px 10px",textAlign:"center",width:36,
                              fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,
                              color:"#888",textTransform:"uppercase",letterSpacing:".04em"}}>#</th>
                            <th style={{padding:"5px 10px",textAlign:"left",
                              fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,
                              color:"#888",textTransform:"uppercase",letterSpacing:".04em"}}>Name</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roster.players.map((p,pi) => (
                            <tr key={pi} style={{borderTop:"1px solid rgba(0,0,0,0.05)",
                              background:pi%2===0?"#fff":"#fafafa"}}>
                              <td style={{padding:"7px 10px",textAlign:"center",
                                fontWeight:700,color:"#aaa",fontSize:12}}>{p.number||"—"}</td>
                              <td style={{padding:"7px 10px",color:"#222"}}>{p.name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Games */}
            {season.games.length > 0 && (
              <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:12,padding:"16px 20px"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                  flexWrap:"wrap",gap:10,marginBottom:14}}>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,
                    textTransform:"uppercase",color:"#002d6e",letterSpacing:".04em"}}>
                    Game Results
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                    {/* Search */}
                    <input value={search} onChange={e=>setSearch(e.target.value)}
                      placeholder="Search team / headline..."
                      style={{padding:"6px 10px",border:"1px solid #ddd",borderRadius:6,fontSize:12,
                        fontFamily:"inherit",width:180}}/>
                    {/* Filter buttons */}
                    {["all","Final","Playoff"].map(f => (
                      <button key={f} onClick={()=>setGameFilter(f)}
                        style={{padding:"5px 12px",borderRadius:16,border:"none",cursor:"pointer",
                          fontSize:12,fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif",
                          textTransform:"uppercase",
                          background:gameFilter===f?"#002d6e":"rgba(0,45,110,0.07)",
                          color:gameFilter===f?"#fff":"#555"}}>
                        {f==="all"?"All":f}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{fontSize:12,color:"#999",marginBottom:10}}>
                  Showing {filteredGames.length} of {season.games.length} games
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {filteredGames.map((g,i) => {
                    const awayWin = g.away_score > g.home_score;
                    const homeWin = g.home_score > g.away_score;
                    return (
                      <div key={i} style={{display:"flex",alignItems:"center",gap:10,
                        padding:"10px 12px",borderRadius:8,
                        background:g.status==="Playoff"?"rgba(255,215,0,0.06)":"#f8f9fb",
                        border:`1px solid ${g.status==="Playoff"?"rgba(255,215,0,0.3)":"rgba(0,0,0,0.06)"}`,
                        flexWrap:"wrap",cursor:hasBoxScores?"pointer":"default"}}
                        onClick={hasBoxScores ? ()=>openBoxScore(season.name, g) : undefined}>
                        <div style={{fontSize:11,color:"#999",minWidth:75,fontWeight:500}}>{g.date}</div>
                        {g.status==="Playoff" && (
                          <span style={{fontSize:10,fontWeight:700,color:"#b45309",background:"rgba(255,215,0,0.2)",
                            padding:"2px 6px",borderRadius:4,textTransform:"uppercase",letterSpacing:".04em"}}>
                            Playoff
                          </span>
                        )}
                        <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:200,flexWrap:"wrap"}}>
                          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:awayWin?900:400,
                            fontSize:15,textTransform:"uppercase",color:awayWin?"#002d6e":"#888",
                            minWidth:120,flex:1}}>
                            {g.away_team}
                          </span>
                          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,
                            fontSize:22,color:awayWin?"#002d6e":"rgba(0,0,0,0.2)",minWidth:28,textAlign:"right"}}>
                            {g.away_score}
                          </span>
                          <span style={{color:"#ccc",fontSize:14,margin:"0 2px"}}>–</span>
                          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,
                            fontSize:22,color:homeWin?"#002d6e":"rgba(0,0,0,0.2)",minWidth:28,textAlign:"left"}}>
                            {g.home_score}
                          </span>
                          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:homeWin?900:400,
                            fontSize:15,textTransform:"uppercase",color:homeWin?"#002d6e":"#888",
                            minWidth:120,flex:1}}>
                            {g.home_team}
                          </span>
                        </div>
                        {cleanHeadline(g.headline) && (
                          <div style={{fontSize:11,color:"#666",fontStyle:"italic",
                            flex:"0 0 100%",marginTop:2,paddingLeft:85}}>
                            {cleanHeadline(g.headline)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {season.games.length === 0 && season.standings.length === 0 && (
              <div style={{textAlign:"center",padding:"48px 0",color:"#aaa",fontSize:14}}>
                No data available for this season yet.
              </div>
            )}
          </div>
        ) : (
          <div style={{textAlign:"center",padding:"48px 0",color:"#aaa",fontSize:14}}>
            Select a season to view results.
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── PLAYER SIGN UP PAGE ────────────────────────────────────────────────── */
function PlayerSignUpPage() {
  const [form, setForm] = useState({name:"",team:"",email:"",phone:"",notes:""});
  const [prefs, setPrefs] = useState({reminders:false,scores:false,playoffs:false,rainouts:false});
  const [status, setStatus] = useState(null); // null | "saving" | "done" | "error"
  const ci = useContactInfo(); // commissioner email/phone — drives where signup notifications go
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const togglePref = (k) => setPrefs(p=>({...p,[k]:!p[k]}));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.team || !form.email || !form.phone) { alert("Please fill in all required fields."); return; }
    setStatus("saving");
    try {
      // Save to Supabase
      await sbPost("lbdc_signups", {
        name: form.name,
        team: form.team,
        email: form.email,
        phone: form.phone,
        notes: form.notes || "",
        reminders: prefs.reminders,
        scores: prefs.scores,
        playoffs: prefs.playoffs,
        rainouts: prefs.rainouts,
      });
      // Auto-add to roster so they appear in availability, box scores & live
      // scoring — but ONLY if no row already exists for this name+team
      // (prevents the duplicate-Daniel-Gutierrez bug where re-signing up
      // created a second roster row alongside the original).
      try {
        const cleanedName = cleanName(form.name);
        const existing = await sbFetch(`lbdc_rosters?select=id&team=eq.${encodeURIComponent(form.team)}&name=eq.${encodeURIComponent(cleanedName)}&limit=1`);
        if (!existing || existing.length === 0) {
          await sbPost("lbdc_rosters", { name: cleanedName, team: form.team, number: "" });
        }
      } catch(e) { /* signup still succeeds even if roster sync fails */ }
      // Also email a notification to the commissioner (pulled live from
      // Contact Info admin — change there to re-route, no code edit needed).
      // Falls back to the contact-info default (Daniel Gutierrez) if the
      // editable field hasn't been set.
      const notifyEmail = (ci && ci.commissionerEmail) || "dgutierrez22@yahoo.com";
      fetch(`https://formsubmit.co/ajax/${encodeURIComponent(notifyEmail)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          _subject: `New Player Sign-Up: ${form.name} (${form.team})`,
          Name: form.name,
          Team: form.team,
          Email: form.email,
          Phone: form.phone,
          "Reminders": prefs.reminders ? "Yes" : "No",
          "Score Alerts": prefs.scores ? "Yes" : "No",
          "Playoff Updates": prefs.playoffs ? "Yes" : "No",
          "Rainout Notices": prefs.rainouts ? "Yes" : "No",
          Notes: form.notes || "",
        }),
      }).catch(()=>{});
      setStatus("done");
    } catch(e) { console.error("Sign-up error:", e); setStatus("error"); }
  };

  const inputStyle = {width:"100%",padding:"13px 16px",border:"1px solid rgba(0,0,0,0.15)",borderRadius:10,fontSize:15,boxSizing:"border-box",outline:"none",background:"#fff"};
  const labelStyle = {fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:13,textTransform:"uppercase",letterSpacing:".1em",color:"#111",display:"block",marginBottom:6};

  if (status === "done") return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#fff",borderRadius:16,padding:"40px 32px",maxWidth:480,width:"100%",textAlign:"center",boxShadow:"0 4px 20px rgba(0,0,0,0.08)"}}>
        <div style={{fontSize:56,marginBottom:16}}>⚾</div>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:28,textTransform:"uppercase",color:"#002d6e",marginBottom:10}}>You're on the list!</div>
        <div style={{fontSize:15,color:"rgba(0,0,0,0.55)",lineHeight:1.6}}>Thanks {form.name.split(" ")[0]}! You'll start receiving updates for the Spring/Summer 2026 season. See you on the field.</div>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8"}}>
      <PageHero label="Spring/Summer 2026" title="Player Sign Up" subtitle="Get game reminders, score alerts & rainout notices straight to your phone or email" />
      {getPageContent("signup_intro") && <div style={{maxWidth:700,margin:"0 auto",padding:"16px clamp(12px,3vw,40px) 0"}} dangerouslySetInnerHTML={sanitizeHTML(getPageContent("signup_intro"))} />}
      <div style={{maxWidth:560,margin:"0 auto",padding:"28px clamp(12px,3vw,40px) 60px"}}>
        <div style={{background:"#fff",borderRadius:14,padding:"28px 24px",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
          {/* Registration fee & payment info */}
          <div style={{background:"#f0f4ff",border:"1px solid rgba(0,45,110,0.2)",borderLeft:"4px solid #002d6e",borderRadius:8,padding:"14px 16px",marginBottom:20}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,color:"#002d6e",textTransform:"uppercase",marginBottom:6}}>💰 Registration Fee: $50</div>
            <div style={{fontSize:13,color:"rgba(0,0,0,0.65)",lineHeight:1.6,marginBottom:10}}>
              All players must pay the $50 seasonal registration fee to be eligible for the season and playoffs. Pay via:
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:10,background:"#fff",borderRadius:8,padding:"10px 14px",border:"1px solid rgba(0,0,0,0.1)"}}>
                <span style={{fontSize:20}}>💸</span>
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:"#111"}}>Zelle</div>
                  <div style={{fontSize:13,color:"rgba(0,0,0,0.5)"}}>Send to Daniel Gutierrez's cell number</div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,background:"#fff",borderRadius:8,padding:"10px 14px",border:"1px solid rgba(0,0,0,0.1)"}}>
                <span style={{fontSize:20}}>📱</span>
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:"#111"}}>Venmo</div>
                  <div style={{fontSize:13,color:"rgba(0,0,0,0.5)"}}>@Titans-baseball · Daniel Gutierrez</div>
                </div>
              </div>
            </div>
          </div>
          <p style={{fontSize:14,color:"rgba(0,0,0,0.5)",marginTop:0,marginBottom:24,lineHeight:1.6}}>
            Fill out this form to register for the Spring/Summer 2026 season and receive game reminders, score alerts & rainout notices. Your info will only be used for Diamond Classics league communications.
          </p>
          <form onSubmit={submit}>
            <div style={{marginBottom:18}}>
              <label style={labelStyle}>Full Name <span style={{color:"#dc2626"}}>*</span></label>
              <input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="John Smith" style={inputStyle} />
            </div>
            <div style={{marginBottom:18}}>
              <label style={labelStyle}>Team Name <span style={{color:"#dc2626"}}>*</span></label>
              <select value={form.team} onChange={e=>set("team",e.target.value)} style={inputStyle}>
                <option value="">— Select your team —</option>
                {Object.keys(TEAM_ROSTERS).map(t=><option key={t} value={t}>{t}</option>)}
                <option disabled style={{color:"#ccc"}}>──────────────</option>
                <option value="Free Agent">Free Agent</option>
              </select>
            </div>
            <div style={{marginBottom:18}}>
              <label style={labelStyle}>Email Address <span style={{color:"#dc2626"}}>*</span></label>
              <input type="email" value={form.email} onChange={e=>set("email",e.target.value)} placeholder="you@email.com" style={inputStyle} />
            </div>
            <div style={{marginBottom:24}}>
              <label style={labelStyle}>Cell Phone Number <span style={{color:"#dc2626"}}>*</span></label>
              <input type="tel" value={form.phone} onChange={e=>set("phone",e.target.value)} placeholder="(310) 555-1234" style={inputStyle} />
            </div>

            <div style={{marginBottom:24}}>
              <label style={{...labelStyle,marginBottom:12}}>What would you like to receive?</label>
              {[
                ["reminders","📲 Game day reminders (text)"],
                ["scores","📊 Score & standings updates (email)"],
                ["playoffs","🏆 Playoff bracket updates (email)"],
                ["rainouts","🌧️ Rainout alerts (text)"],
              ].map(([k,label])=>(
                <label key={k} onClick={()=>togglePref(k)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",border:`1.5px solid ${prefs[k]?"#002d6e":"rgba(0,0,0,0.1)"}`,borderRadius:8,marginBottom:8,cursor:"pointer",background:prefs[k]?"#f0f4ff":"#fff",transition:"all .1s"}}>
                  <div style={{width:20,height:20,border:`2px solid ${prefs[k]?"#002d6e":"rgba(0,0,0,0.2)"}`,borderRadius:4,background:prefs[k]?"#002d6e":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .1s"}}>
                    {prefs[k] && <span style={{color:"#fff",fontSize:13,fontWeight:900}}>✓</span>}
                  </div>
                  <span style={{fontSize:14,color:"#111"}}>{label}</span>
                </label>
              ))}
            </div>

            <div style={{marginBottom:24}}>
              <label style={labelStyle}>Anything else? <span style={{fontSize:11,color:"rgba(0,0,0,0.35)",fontWeight:400,textTransform:"none",letterSpacing:0}}>(optional)</span></label>
              <textarea value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Questions, comments, or anything you'd like us to know..." rows={3}
                style={{...inputStyle,resize:"vertical",lineHeight:1.5}} />
            </div>

            <button type="submit" disabled={status==="saving"}
              style={{width:"100%",padding:"16px",background:status==="saving"?"#9ca3af":"#002d6e",border:"none",borderRadius:10,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,color:"#fff",cursor:status==="saving"?"not-allowed":"pointer",textTransform:"uppercase",letterSpacing:".06em"}}>
              {status==="saving" ? "Signing Up…" : "Sign Me Up ⚾"}
            </button>
            {status==="error" && <div style={{marginTop:10,fontSize:13,color:"#dc2626",textAlign:"center"}}>Something went wrong. Please try again.</div>}
          </form>
        </div>
      </div>
    </div>
  );
}

/* ─── FOOTER ─────────────────────────────────────────────────────────────── */
function Footer({ setTab }) {
  const links = [["home","Home"],["scores","Scores"],["schedule","Schedule"],["standings","Standings"],["teams","Teams"],["stats","Stats"],["directions","Directions"],["rules","Rules"],["sponsors","Sponsors"],["signup","Sign Up"]];
  return (
    <div style={{background:"#001a3e",borderTop:"3px solid #002d6e",padding:"32px clamp(12px,3vw,40px)"}}>
      <div style={{maxWidth:1400,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:44,height:44,borderRadius:"50%",background:"rgba(0,45,110,0.5)",border:"2px solid rgba(200,16,46,0.5)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>⚾</div>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,color:"#FFD700",letterSpacing:".06em",textTransform:"uppercase"}}>Long Beach Diamond Classics</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,color:"rgba(255,255,255,0.4)"}}>Men's 50+ Baseball · Baldwin Park, CA · NABA Affiliated</div>
          </div>
        </div>
        <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
          {links.map(([id,label]) => (
            <span key={id} onClick={() => setTab(id)} style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,color:"rgba(255,255,255,0.45)",cursor:"pointer",textTransform:"uppercase",letterSpacing:".06em"}}
              onMouseEnter={e => e.currentTarget.style.color="#fff"}
              onMouseLeave={e => e.currentTarget.style.color="rgba(255,255,255,0.45)"}>
              {label}
            </span>
          ))}
        </div>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,color:"rgba(255,255,255,0.25)"}}>© 2026 Long Beach Diamond Classics &nbsp;·&nbsp; Powered by <a href="https://mainline-webdesign.com/" target="_blank" rel="noopener noreferrer" style={{color:"rgba(255,255,255,0.35)",textDecoration:"none"}}>Mainline Web Design</a></div>
      </div>
    </div>
  );
}

/* ─── SUB BOARD PAGE ─────────────────────────────────────────────────────── */
function SubBoardPage() {
  const [view, setView] = useState("board");
  const [posted, setPosted] = useState(false);
  const [form, setForm] = useState({name:"",team:"",playing:"9:00 AM",available:"11:30 AM",field:"Clark Field — Long Beach",contact:""});

  const sampleAvail = [
    {initials:"RC",name:"Ray Castro",team:"Tribe",playing:"9:00 AM",available:"11:30 AM",field:"Clark Field — Long Beach",contact:"562-555-1234",color:"#002d6e"},
    {initials:"MH",name:"Mike Herrera",team:"Pirates",playing:"9:00 AM",available:"Any game",field:"Any field",contact:"562-555-5678",color:"#1d2d44"},
    {initials:"DL",name:"Dan Lozano",team:"Dodgers",playing:"11:30 AM",available:"1:30 PM",field:"Fromhold Field — San Pedro",contact:"562-555-9012",color:"#005a9c"},
  ];

  const sampleSubs = [
    {initials:"GV",name:"Gary Vargas",team:"Brooklyn",field:"Any field",times:"Any time",div:"Any division",contact:"562-555-1111",color:"#b45309"},
    {initials:"AL",name:"Art Lopez",team:"Titans",field:"Any field",times:"Morning games",div:"Any division",contact:"562-555-2222",color:"#4a1d96"},
    {initials:"BM",name:"Bill Morales",team:"Generals",field:"Any field",times:"9am or 11:30am",div:"Any division",contact:"562-555-3333",color:"#374151"},
  ];

  const fields = ["Clark Field — Long Beach","Fromhold Field — San Pedro"];
  const times = ["9:00 AM","11:30 AM","1:30 PM"];

  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",overflowX:"hidden",width:"100%"}}>
      <PageHero label="LBDC 2026" title="Sub Board" subtitle="Need a player? Playing and want a second game? Post here.">
        <TabBar items={["Game Day Board","Season Sub List"]} active={view==="board"?0:1} onChange={i => setView(i===0?"board":"season")} />
      </PageHero>

      <div style={{maxWidth:900,margin:"0 auto",padding:"24px clamp(12px,3vw,40px) 60px"}}>
        {view==="board" && <>
          <Card style={{marginBottom:20}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid rgba(0,0,0,0.07)"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,textTransform:"uppercase",color:"#111"}}>List yourself as available today</div>
              <div style={{fontSize:13,color:"rgba(0,0,0,0.45)",marginTop:2}}>Playing this morning and want a second game? Post yourself here.</div>
            </div>
            {posted ? (
              <div style={{padding:"24px 20px",textAlign:"center"}}>
                <div style={{fontSize:32,marginBottom:8}}>✅</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,color:"#111"}}>You're on the board!</div>
                <div style={{fontSize:13,color:"rgba(0,0,0,0.45)",marginTop:4}}>Managers can see you and will contact you directly.</div>
                <button onClick={() => setPosted(false)} style={{marginTop:16,padding:"8px 20px",background:"none",border:"1px solid rgba(0,0,0,0.2)",borderRadius:8,cursor:"pointer",fontSize:13,color:"rgba(0,0,0,0.5)"}}>Post again</button>
              </div>
            ) : (
              <div style={{padding:"16px 20px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {[["name","Your name","e.g. Ray Castro"],["team","Your team","e.g. Tribe"],["contact","Phone or email","e.g. 562-555-1234"]].map(([k,label,ph]) => (
                  <div key={k} style={{display:"flex",flexDirection:"column",gap:4,gridColumn:k==="contact"?"1 / -1":"auto"}}>
                    <label style={{fontSize:12,color:"rgba(0,0,0,0.4)",fontWeight:600}}>{label}</label>
                    <input placeholder={ph} value={form[k]} onChange={e => setForm({...form,[k]:e.target.value})} style={{padding:"9px 12px",borderRadius:8,border:"1px solid rgba(0,0,0,0.15)",fontSize:14,background:"#f8f9fb"}} />
                  </div>
                ))}
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  <label style={{fontSize:12,color:"rgba(0,0,0,0.4)",fontWeight:600}}>Already playing at</label>
                  <select value={form.playing} onChange={e => setForm({...form,playing:e.target.value})} style={{padding:"9px 12px",borderRadius:8,border:"1px solid rgba(0,0,0,0.15)",fontSize:14,background:"#f8f9fb"}}>
                    {times.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  <label style={{fontSize:12,color:"rgba(0,0,0,0.4)",fontWeight:600}}>Available for</label>
                  <select value={form.available} onChange={e => setForm({...form,available:e.target.value})} style={{padding:"9px 12px",borderRadius:8,border:"1px solid rgba(0,0,0,0.15)",fontSize:14,background:"#f8f9fb"}}>
                    <option>11:30 AM</option><option>1:30 PM</option><option>Any game</option>
                  </select>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:4,gridColumn:"1 / -1"}}>
                  <label style={{fontSize:12,color:"rgba(0,0,0,0.4)",fontWeight:600}}>Field</label>
                  <select value={form.field} onChange={e => setForm({...form,field:e.target.value})} style={{padding:"9px 12px",borderRadius:8,border:"1px solid rgba(0,0,0,0.15)",fontSize:14,background:"#f8f9fb"}}>
                    {fields.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div style={{gridColumn:"1 / -1"}}>
                  <button onClick={() => setPosted(true)} style={{width:"100%",padding:"12px",background:"#002d6e",border:"none",borderRadius:8,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,textTransform:"uppercase",cursor:"pointer",letterSpacing:".06em"}}>Post my availability</button>
                </div>
              </div>
            )}
          </Card>
          <div style={{marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,textTransform:"uppercase",color:"#111"}}>Available this Saturday — Mar 22</div>
            <span style={{fontSize:13,color:"rgba(0,0,0,0.4)"}}>{sampleAvail.length} players</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {sampleAvail.map((p,i) => (
              <Card key={i} style={{padding:0}}>
                <div style={{padding:"14px 18px",display:"flex",alignItems:"center",gap:14}}>
                  <div style={{width:44,height:44,borderRadius:"50%",background:`${p.color}18`,border:`2px solid ${p.color}50`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:14,color:p.color}}>{p.initials}</span>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,color:"#111"}}>{p.name} <span style={{fontWeight:500,fontSize:15,color:"rgba(0,0,0,0.4)"}}>· {p.team}</span></div>
                    <div style={{fontSize:13,color:"rgba(0,0,0,0.45)",marginTop:2}}>Playing {p.playing} · Available {p.available} · {p.field}</div>
                  </div>
                  <a href={`tel:${p.contact}`} style={{padding:"8px 16px",background:"#002d6e",borderRadius:8,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,textDecoration:"none",flexShrink:0}}>{p.contact}</a>
                </div>
              </Card>
            ))}
            <div style={{fontSize:12,color:"rgba(0,0,0,0.35)",textAlign:"center",marginTop:4}}>Board clears automatically every Saturday night · Contact players directly</div>
          </div>
        </>}

        {view==="season" && <>
          <div style={{marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,textTransform:"uppercase",color:"#111"}}>2026 Season subs</div>
            <span style={{fontSize:13,color:"rgba(0,0,0,0.4)"}}>{sampleSubs.length} players registered</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:24}}>
            {sampleSubs.map((p,i) => (
              <Card key={i} style={{padding:0}}>
                <div style={{padding:"14px 18px",display:"flex",alignItems:"center",gap:14,borderLeft:`3px solid ${p.color}`}}>
                  <div style={{width:44,height:44,borderRadius:"50%",background:`${p.color}18`,border:`2px solid ${p.color}50`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:14,color:p.color}}>{p.initials}</span>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,color:"#111"}}>{p.name} <span style={{fontWeight:500,fontSize:15,color:"rgba(0,0,0,0.4)"}}>· {p.team}</span></div>
                    <div style={{fontSize:13,color:"rgba(0,0,0,0.45)",marginTop:2}}>{p.field} · {p.times} · {p.div}</div>
                  </div>
                  <a href={`tel:${p.contact}`} style={{padding:"8px 16px",background:"#002d6e",borderRadius:8,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,textDecoration:"none",flexShrink:0}}>{p.contact}</a>
                </div>
              </Card>
            ))}
          </div>
          <Card>
            <div style={{padding:"16px 20px",borderBottom:"1px solid rgba(0,0,0,0.07)"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,textTransform:"uppercase",color:"#111"}}>Add yourself to the season sub list</div>
              <div style={{fontSize:13,color:"rgba(0,0,0,0.45)",marginTop:2}}>Set it once. Stays all season.</div>
            </div>
            <div style={{padding:"16px 20px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[["name","Your name","e.g. Gary Vargas"],["team","Your team","e.g. Brooklyn"],["contact","Phone or email","e.g. 562-555-1234"]].map(([k,label,ph]) => (
                <div key={k} style={{display:"flex",flexDirection:"column",gap:4,gridColumn:k==="contact"?"1 / -1":"auto"}}>
                  <label style={{fontSize:12,color:"rgba(0,0,0,0.4)",fontWeight:600}}>{label}</label>
                  <input placeholder={ph} style={{padding:"9px 12px",borderRadius:8,border:"1px solid rgba(0,0,0,0.15)",fontSize:14,background:"#f8f9fb"}} />
                </div>
              ))}
              {[["field","Preferred fields",["Any field","Field 1 only","Field 2 only"]],["times","Preferred times",["Any time","9:00 AM only","11:30 AM only","1:30 PM only"]],["div","Division preference",["Any division","My division only"]]].map(([k,label,opts]) => (
                <div key={k} style={{display:"flex",flexDirection:"column",gap:4}}>
                  <label style={{fontSize:12,color:"rgba(0,0,0,0.4)",fontWeight:600}}>{label}</label>
                  <select style={{padding:"9px 12px",borderRadius:8,border:"1px solid rgba(0,0,0,0.15)",fontSize:14,background:"#f8f9fb"}}>
                    {opts.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div style={{gridColumn:"1 / -1"}}>
                <button style={{width:"100%",padding:"12px",background:"#002d6e",border:"none",borderRadius:8,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,textTransform:"uppercase",cursor:"pointer",letterSpacing:".06em"}}>Add me to the sub list</button>
              </div>
            </div>
          </Card>
        </>}
      </div>
    </div>
  );
}

/* ─── CONTACT PAGE ───────────────────────────────────────────────────────── */
function ContactPage() {
  const c = useContactInfo();
  const designerHost = (c.designerWebsite||"").replace(/^https?:\/\//,"").replace(/\/$/,"");
  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",overflowX:"hidden",width:"100%"}}>
      <PageHero label="Diamond Classics" title="Contact Us" subtitle="Reach out to the league commissioner with questions or concerns" />
      <div style={{maxWidth:560,margin:"0 auto",padding:"28px clamp(12px,3vw,40px) 60px"}}>
        <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderTop:"4px solid #002d6e",borderRadius:14,overflow:"hidden",boxShadow:"0 2px 12px rgba(0,45,110,0.07)"}}>
          <div style={{background:"#002d6e",padding:"20px 24px",display:"flex",alignItems:"center",gap:16}}>
            <div style={{width:52,height:52,borderRadius:"50%",background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>⚾</div>
            <div>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".12em",color:"rgba(255,255,255,0.6)",marginBottom:2}}>{c.commissionerTitle||"League Commissioner"}</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:26,color:"#fff",textTransform:"uppercase",lineHeight:1}}>{c.commissionerName}</div>
            </div>
          </div>
          <div style={{padding:"8px 0"}}>
            {c.commissionerPhone && (
            <a href={`tel:${phoneToTel(c.commissionerPhone)}`} style={{display:"flex",alignItems:"center",gap:16,padding:"18px 24px",borderBottom:"1px solid rgba(0,0,0,0.06)",textDecoration:"none",transition:"background .12s"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(0,45,110,0.03)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{width:44,height:44,borderRadius:10,background:"rgba(0,45,110,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>📞</div>
              <div>
                <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:"rgba(0,0,0,0.4)",marginBottom:2}}>Phone / Cell</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,color:"#002d6e"}}>{c.commissionerPhone}</div>
                <div style={{fontSize:12,color:"rgba(0,0,0,0.4)",marginTop:1}}>Tap to call</div>
              </div>
            </a>
            )}
            {c.commissionerEmail && (
            <a href={`mailto:${c.commissionerEmail}`} style={{display:"flex",alignItems:"center",gap:16,padding:"18px 24px",borderBottom:"1px solid rgba(0,0,0,0.06)",textDecoration:"none",transition:"background .12s"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(0,45,110,0.03)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{width:44,height:44,borderRadius:10,background:"rgba(0,45,110,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>✉️</div>
              <div>
                <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:"rgba(0,0,0,0.4)",marginBottom:2}}>Email</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,color:"#002d6e"}}>{c.commissionerEmail}</div>
                <div style={{fontSize:12,color:"rgba(0,0,0,0.4)",marginTop:1}}>Tap to email</div>
              </div>
            </a>
            )}
            {c.zelleNote && (
            <div style={{display:"flex",alignItems:"center",gap:16,padding:"18px 24px",borderBottom:"1px solid rgba(0,0,0,0.06)"}}>
              <div style={{width:44,height:44,borderRadius:10,background:"rgba(0,45,110,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>💸</div>
              <div>
                <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:"rgba(0,0,0,0.4)",marginBottom:2}}>Zelle</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,color:"#111"}}>{c.zelleNote}</div>
              </div>
            </div>
            )}
            {c.venmoHandle && (
            <div style={{display:"flex",alignItems:"center",gap:16,padding:"18px 24px"}}>
              <div style={{width:44,height:44,borderRadius:10,background:"rgba(0,45,110,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>📱</div>
              <div>
                <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:"rgba(0,0,0,0.4)",marginBottom:2}}>Venmo</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,color:"#111"}}>{c.venmoHandle}</div>
              </div>
            </div>
            )}
          </div>
        </div>

        {/* Built by Mainline Web Design */}
        {(c.designerName || c.designerEmail || c.designerWebsite) && (
        <div style={{marginTop:28,background:"linear-gradient(135deg,#001a4d 0%,#002d6e 60%,#003d99 100%)",borderRadius:14,padding:"24px 24px 20px",boxShadow:"0 4px 20px rgba(0,45,110,0.18)",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",right:-18,top:-18,fontSize:80,opacity:0.06,lineHeight:1}}>💻</div>
          <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".14em",color:"rgba(255,255,255,0.5)",marginBottom:6}}>Love This Site?</div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,color:"#FFD700",textTransform:"uppercase",lineHeight:1.1,marginBottom:8}}>Get a Custom Website Built for Your League</div>
          <div style={{fontSize:14,color:"rgba(255,255,255,0.75)",lineHeight:1.6,marginBottom:18}}>
            This site was built specifically for Long Beach Diamond Classics — every feature, every page, exactly how the league needs it. If your organization wants a fully custom website tailored to your team, league, or club, reach out to {(c.designerName||"the designer").split("—")[0].trim()}!
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {c.designerWebsite && (
            <a href={c.designerWebsite} target="_blank" rel="noopener noreferrer"
              style={{display:"flex",alignItems:"center",gap:12,background:"rgba(255,255,255,0.1)",borderRadius:10,padding:"12px 16px",textDecoration:"none",transition:"background .15s",border:"1px solid rgba(255,255,255,0.12)"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.18)"}
              onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"}>
              <span style={{fontSize:20}}>🌐</span>
              <div>
                <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:"rgba(255,255,255,0.5)",marginBottom:1}}>Website</div>
                <div style={{fontFamily:"Arial,sans-serif",fontWeight:700,fontSize:15,color:"#FFD700",letterSpacing:".01em"}}>{designerHost}</div>
              </div>
            </a>
            )}
            {c.designerEmail && (
            <a href={`mailto:${c.designerEmail}`}
              style={{display:"flex",alignItems:"center",gap:12,background:"rgba(255,255,255,0.1)",borderRadius:10,padding:"12px 16px",textDecoration:"none",transition:"background .15s",border:"1px solid rgba(255,255,255,0.12)"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.18)"}
              onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"}>
              <span style={{fontSize:20}}>✉️</span>
              <div>
                <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:"rgba(255,255,255,0.5)",marginBottom:1}}>Email</div>
                <div style={{fontFamily:"Arial,sans-serif",fontWeight:700,fontSize:15,color:"#FFD700",letterSpacing:".01em"}}>{c.designerEmail}</div>
              </div>
            </a>
            )}
          </div>
        </div>
        )}

      </div>
    </div>
  );
}

/* ─── PAYMENTS PAGE ──────────────────────────────────────────────────────── */
const PAYMENT_CATEGORIES = [
  { id: "seasonal_ins",  label: "Seasonal Insurance (50's)",  amount: "$50", note: "Required for all 50's division players each season." },
  { id: "annual_ins",    label: "Annual Insurance (Boomers)", amount: "$25", note: "Required for all Boomers 60/70 division players annually." },
  { id: "game_fee_bom",  label: "Game Fee — Boomers",         amount: "$20", note: "Per-game fee for Boomers 60/70 division players." },
  { id: "game_fee_co",   label: "Game Fee — Crossover",       amount: "$10", note: "Per-game fee when playing a crossover game." },
  { id: "tourn_regional",label: "Regional Tournament",        amount: "$125",note: "Entry fee per player for regional tournament participation." },
  { id: "tourn_national",label: "National Tournament",        amount: "$175",note: "Entry fee per player for national tournament participation." },
];

function PaymentsPage() {
  const [selected, setSelected] = useState(null);
  const cat = PAYMENT_CATEGORIES.find(c => c.id === selected);
  const ci = useContactInfo();

  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",overflowX:"hidden",width:"100%"}}>
      <PageHero label="Diamond Classics" title="Payment Info" subtitle="Select a fee type to see the amount and how to pay" />
      <div style={{maxWidth:640,margin:"0 auto",padding:"28px clamp(12px,3vw,40px) 60px"}}>

        {/* Category selector */}
        <div style={{marginBottom:24}}>
          <label style={{display:"block",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:"rgba(0,0,0,0.45)",marginBottom:8}}>Select a Fee Type</label>
          <div style={{position:"relative"}}>
            <select
              value={selected||""}
              onChange={e => setSelected(e.target.value || null)}
              style={{width:"100%",padding:"14px 44px 14px 16px",border:"2px solid #002d6e",borderRadius:10,fontSize:16,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,textTransform:"uppercase",color:selected?"#002d6e":"rgba(0,0,0,0.4)",background:"#fff",appearance:"none",cursor:"pointer",outline:"none",boxSizing:"border-box"}}>
              <option value="">— Choose a fee category —</option>
              {PAYMENT_CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>{c.label}{c.amount ? `  ·  ${c.amount}` : ""}</option>
              ))}
            </select>
            <div style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",fontSize:18,color:"#002d6e"}}>▾</div>
          </div>
        </div>

        {/* Selected fee detail card */}
        {cat && (
          <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderTop:"4px solid #002d6e",borderRadius:12,padding:"22px 24px",marginBottom:24,boxShadow:"0 2px 12px rgba(0,45,110,0.07)"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:12}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:"rgba(0,0,0,0.4)",marginBottom:4}}>Selected Fee</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:26,textTransform:"uppercase",color:"#111",lineHeight:1}}>{cat.label}</div>
              </div>
              {cat.amount && (
                <div style={{background:"#002d6e",color:"#FFD700",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:36,padding:"8px 22px",borderRadius:10,lineHeight:1,flexShrink:0}}>
                  {cat.amount}
                </div>
              )}
            </div>
            <div style={{fontSize:14,color:"rgba(0,0,0,0.55)",lineHeight:1.6}}>{cat.note}</div>
          </div>
        )}

        {/* Payment methods — always visible */}
        <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
          <div style={{background:"#002d6e",padding:"14px 20px"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,textTransform:"uppercase",color:"#fff",letterSpacing:".04em"}}>💰 How to Pay</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.65)",marginTop:2}}>Send payment to {ci.commissionerName} using either method below</div>
          </div>
          <div style={{padding:"6px 0"}}>
            <div style={{display:"flex",alignItems:"center",gap:14,padding:"16px 20px",borderBottom:"1px solid rgba(0,0,0,0.06)"}}>
              <div style={{width:44,height:44,borderRadius:10,background:"#6c3de0",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <span style={{fontSize:22}}>💸</span>
              </div>
              <div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,textTransform:"uppercase",color:"#111"}}>Zelle</div>
                <div style={{fontSize:14,color:"rgba(0,0,0,0.5)",marginTop:1}}>Send to {ci.commissionerName} · <a href={`tel:${phoneToTel(ci.commissionerPhone)}`} style={{color:"#002d6e",textDecoration:"none",fontWeight:700}}>{ci.commissionerPhone}</a></div>
              </div>
            </div>
            <div style={{padding:"16px 20px"}}>
              <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
                <div style={{width:44,height:44,borderRadius:10,background:"#008aff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:22}}>📱</span>
                </div>
                <div>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,textTransform:"uppercase",color:"#111"}}>Venmo</div>
                  <div style={{fontSize:14,color:"rgba(0,0,0,0.5)",marginTop:1}}>{ci.venmoHandle} · {ci.commissionerName}</div>
                </div>
              </div>
              {ci.venmoQrUrl && (
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",background:"rgba(0,138,255,0.05)",border:"1px solid rgba(0,138,255,0.15)",borderRadius:10,padding:"14px 12px",gap:8}}>
                <img src={ci.venmoQrUrl} alt="Venmo QR Code" onError={e=>{e.currentTarget.style.display="none";}} style={{width:180,height:180,borderRadius:8,objectFit:"contain",display:"block",background:"#fff"}} />
                <div style={{fontSize:12,color:"rgba(0,0,0,0.4)",textAlign:"center"}}>Scan with your camera or Venmo app to pay instantly</div>
              </div>
              )}
            </div>
          </div>
        </div>

        <div style={{marginTop:16,padding:"12px 16px",background:"rgba(0,45,110,0.04)",border:"1px solid rgba(0,45,110,0.1)",borderRadius:8,fontSize:13,color:"rgba(0,0,0,0.5)",lineHeight:1.6}}>
          ⚾ Questions about fees or payments? Contact {ci.commissionerName} at <a href={`tel:${phoneToTel(ci.commissionerPhone)}`} style={{color:"#002d6e",fontWeight:700,textDecoration:"none"}}>{ci.commissionerPhone}</a> or your team captain.
        </div>
      </div>
    </div>
  );
}

/* ─── ADMIN PAGE ─────────────────────────────────────────────────────────── */
function PlayerEligibilityPage({ onBack }) {
  const SEASON = "Spring/Summer 2026";
  // Saturday teams. Hardcoded list — same as Object.keys(TEAM_ROSTERS) minus
  // the Boomers entries, but kept explicit so it doesn't depend on roster
  // data. Live rosters come from lbdc_rosters below; the hardcoded
  // TEAM_ROSTERS constant is only a fallback when the DB is unreachable.
  const SAT_TEAMS = ["Tribe","Pirates","Titans","Brooklyn","Generals","Black Sox"];
  const TEAMS = SAT_TEAMS;
  const [payments, setPayments] = useState([]); // [{player_name, team_name, paid}]
  const [appearances, setAppearances] = useState({}); // {player_name: count}
  // Live Saturday rosters from lbdc_rosters (same source the admin's roster
  // editor writes to). Without this the page used stale hardcoded data —
  // Tribe was empty in source so its full 17-player roster never showed up.
  const [satRosters, setSatRosters] = useState(null); // {team: [{name, number}]}
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterTeam, setFilterTeam] = useState("All");
  const [activeDiv, setActiveDiv] = useState("SAT"); // "SAT" | "BOM"
  const [bomPayments, setBomPayments] = useState([]);
  const [bomRosters, setBomRosters] = useState({}); // {teamName: [playerName,...]}
  const [bomSaving, setBomSaving] = useState(false);
  const BOM_SEASON = "Boomers 2026";
  const BOM_TEAMS = ["Eddie Murray Mashers '56", "Greg Maddux Magicians '66"];

  const load = async () => {
    setLoading(true);
    try {
      const [payData, seasons, ...rosterArrays] = await Promise.all([
        sbFetch(`player_payments?select=id,player_name,team_name,paid,notes&season=eq.${encodeURIComponent(SEASON)}&order=team_name.asc,player_name.asc`),
        sbFetch("seasons?select=id,name&limit=50"),
        ...SAT_TEAMS.map(t => sbFetch(`lbdc_rosters?select=name,number&team=eq.${encodeURIComponent(t)}&order=name.asc`)),
      ]);
      setPayments(payData || []);
      // Stitch the live rosters into a {team: [{name,number}]} map. Falls
      // back to hardcoded TEAM_ROSTERS for any team whose DB returned empty.
      const rosters = {};
      SAT_TEAMS.forEach((t, i) => {
        const live = rosterArrays[i] || [];
        rosters[t] = live.length
          ? live.map(p => ({ name: p.name, number: p.number || "" }))
          : (TEAM_ROSTERS[t] || []);
      });
      setSatRosters(rosters);
      // Count distinct game appearances per player — current season only
      const counts = {};
      const satIds = getSatSeasonFilter(seasons || []);
      if (satIds.length) {
        // Fetch ALL games (including duplicates) and ALL batting_lines, then dedup at the line level
        // by gameKey (date|away|home). This handles the case where duplicate game rows have
        // scattered batting_lines — a player who appeared in one real game counts exactly once.
        const gameRows = await sbFetch(`games?select=id,away_team,home_team,game_date,away_score,home_score&season_id=in.(${satIds.join(",")})&away_score=not.is.null&limit=500`);
        if (gameRows && gameRows.length > 0) {
          const gameKeyById = {};
          gameRows.forEach(g => {
            gameKeyById[g.id] = `${g.game_date||"null"}|${g.away_team}|${g.home_team}`;
          });
          const allIds = gameRows.map(g => g.id).join(",");
          const apData = await sbFetch(`batting_lines?select=player_name,game_id&game_id=in.(${allIds})&player_name=not.is.null&limit=10000`);
          (apData || []).forEach(row => {
            if (!row.player_name) return;
            const gk = gameKeyById[row.game_id];
            if (!gk) return;
            if (!counts[row.player_name]) counts[row.player_name] = new Set();
            counts[row.player_name].add(gk);
          });
        }
      }
      const flat = {};
      Object.entries(counts).forEach(([name, games]) => { flat[name] = games.size; });
      setAppearances(flat);
    } catch(e) {}
    setLoading(false);
  };

  const loadBoomers = async () => {
    setLoading(true);
    try {
      const [payData, ...rosterArrays] = await Promise.all([
        sbFetch(`player_payments?select=id,player_name,team_name,paid,notes&season=eq.${encodeURIComponent(BOM_SEASON)}&order=team_name.asc,player_name.asc`),
        ...BOM_TEAMS.map(t => sbFetch(`lbdc_rosters?select=name&team=eq.${encodeURIComponent(t)}&order=id.asc`)),
      ]);
      setBomPayments(payData || []);
      const ros = {};
      BOM_TEAMS.forEach((t,i) => { ros[t] = (rosterArrays[i]||[]).map(r=>r.name); });
      setBomRosters(ros);
    } catch(e) {}
    setLoading(false);
  };

  useEffect(() => { load(); loadBoomers(); }, []);

  const toggleBomInsurance = async (playerName, teamName) => {
    setBomSaving(true);
    const rec = bomPayments.find(r => r.player_name===playerName && r.team_name===teamName);
    const newPaid = !(rec?.paid||false);
    try {
      if (rec?.id) {
        await sbPatch(`player_payments?id=eq.${rec.id}`, {paid: newPaid});
      } else {
        await sbPost("player_payments", {player_name:playerName, team_name:teamName, season:BOM_SEASON, paid:newPaid, notes:"0"});
      }
      await loadBoomers();
    } catch(e) { alert("Save failed: "+e.message); }
    setBomSaving(false);
  };

  const setBomGamesPaid = async (playerName, teamName, count) => {
    setBomSaving(true);
    const rec = bomPayments.find(r => r.player_name===playerName && r.team_name===teamName);
    const c = Math.max(0, count);
    try {
      if (rec?.id) {
        await sbPatch(`player_payments?id=eq.${rec.id}`, {notes: String(c)});
      } else {
        await sbPost("player_payments", {player_name:playerName, team_name:teamName, season:BOM_SEASON, paid:false, notes:String(c)});
      }
      await loadBoomers();
    } catch(e) { alert("Save failed: "+e.message); }
    setBomSaving(false);
  };

  // Build roster rows merging rosters + any saved payment records
  const buildRows = () => {
    const rows = [];
    TEAMS.forEach(team => {
      // Prefer live roster from lbdc_rosters (admin's edits); fall back to
      // the hardcoded TEAM_ROSTERS constant if Supabase fetch hasn't returned.
      const roster = (satRosters && satRosters[team]) || TEAM_ROSTERS[team] || [];
      roster.forEach(p => {
        const rec = payments.find(r => r.player_name === p.name && r.team_name === team);
        rows.push({
          id: rec?.id || null,
          player_name: p.name,
          team_name: team,
          paid: rec?.paid || false,
          notes: rec?.notes || "",
          games: appearances[p.name] || 0,
        });
      });
    });
    return rows;
  };

  const rows = buildRows();
  const filtered = filterTeam === "All" ? rows : rows.filter(r => r.team_name === filterTeam);

  const togglePaid = async (row) => {
    setSaving(true);
    const newPaid = !row.paid;
    try {
      if (row.id) {
        await sbPatch(`player_payments?id=eq.${row.id}`, {paid: newPaid});
      } else {
        await sbPost("player_payments", {
          player_name: row.player_name,
          team_name: row.team_name,
          season: SEASON,
          paid: newPaid,
          notes: "",
        });
      }
      await load();
    } catch(e) { alert("Save failed: " + e.message); }
    setSaving(false);
  };

  const byTeam = {};
  filtered.forEach(r => { if (!byTeam[r.team_name]) byTeam[r.team_name] = []; byTeam[r.team_name].push(r); });

  const totalPaid = rows.filter(r => r.paid).length;
  const totalEligible = rows.filter(r => r.paid && r.games >= 4).length;
  const totalPlayers = rows.length;

  return (
    <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:12,overflow:"hidden"}}>
      <div style={{padding:"16px 20px",borderBottom:"1px solid rgba(0,0,0,0.07)",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <button type="button" onClick={onBack} style={{padding:"5px 12px",background:"rgba(0,0,0,0.07)",border:"none",borderRadius:6,fontWeight:700,fontSize:13,cursor:"pointer"}}>← Back</button>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,textTransform:"uppercase",color:"#111"}}>🏅 Player Eligibility</div>
        <button type="button" onClick={()=>{load();loadBoomers();}} style={{marginLeft:"auto",padding:"5px 12px",background:"rgba(0,45,110,0.07)",border:"1px solid rgba(0,45,110,0.2)",borderRadius:6,fontWeight:700,fontSize:12,color:"#002d6e",cursor:"pointer"}}>↻ Refresh</button>
      </div>

      {/* Division tabs */}
      <div style={{display:"flex",borderBottom:"1px solid rgba(0,0,0,0.07)",background:"#fafbfc"}}>
        {[
          {k:"SAT",label:"Saturday League",color:"#002d6e"},
          {k:"BOM",label:"Boomers",color:"#7c3aed"},
        ].map(t => (
          <button key={t.k} type="button" onClick={()=>setActiveDiv(t.k)}
            style={{
              flex:1,padding:"12px 14px",border:"none",background:activeDiv===t.k?"#fff":"transparent",
              fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:15,textTransform:"uppercase",
              color:activeDiv===t.k?t.color:"rgba(0,0,0,0.4)",
              borderBottom:activeDiv===t.k?`3px solid ${t.color}`:"3px solid transparent",
              cursor:"pointer",letterSpacing:".06em",
            }}>{t.label}</button>
        ))}
      </div>

      {activeDiv === "SAT" && (
      <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:16}}>

        {/* Summary bar */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
          {[
            {label:"Total Players",value:totalPlayers,color:"#002d6e"},
            {label:"Fees Paid",value:`${totalPaid} / ${totalPlayers}`,color:"#16a34a"},
            {label:"Playoff Eligible",value:`${totalEligible} / ${totalPlayers}`,color:"#b45309"},
          ].map(s => (
            <div key={s.label} style={{background:"#f8f9fb",border:`2px solid ${s.color}22`,borderRadius:10,padding:"12px 16px",textAlign:"center"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:28,color:s.color,lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:11,color:"rgba(0,0,0,0.45)",fontWeight:700,textTransform:"uppercase",letterSpacing:".05em",marginTop:3}}>{s.label}</div>
            </div>
          ))}
          <div style={{background:"#f8f9fb",border:"2px solid rgba(0,0,0,0.08)",borderRadius:10,padding:"12px 16px",textAlign:"center"}}>
            <div style={{fontSize:11,color:"rgba(0,0,0,0.45)",fontWeight:700,textTransform:"uppercase",letterSpacing:".05em",marginBottom:6}}>Eligibility Requires</div>
            <div style={{fontSize:12,color:"#333",lineHeight:1.5}}>✅ $50 fee paid<br/>✅ 4+ game appearances</div>
          </div>
        </div>

        {/* Team filter */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:12,fontWeight:700,color:"rgba(0,0,0,0.4)",textTransform:"uppercase"}}>Filter:</span>
          {["All", ...TEAMS].map(t => (
            <button key={t} type="button" onClick={()=>setFilterTeam(t)}
              style={{padding:"4px 12px",borderRadius:20,border:`1px solid ${filterTeam===t?"#002d6e":"rgba(0,0,0,0.15)"}`,background:filterTeam===t?"#002d6e":"#fff",color:filterTeam===t?"#fff":"#333",fontWeight:700,fontSize:12,cursor:"pointer"}}>
              {t}
            </button>
          ))}
        </div>

        {loading && <div style={{textAlign:"center",padding:30,color:"#888"}}>Loading…</div>}

        {!loading && Object.entries(byTeam).map(([team, teamRows]) => (
          <div key={team} style={{border:"1px solid rgba(0,0,0,0.09)",borderRadius:10,overflow:"hidden"}}>
            <div style={{background:"#001a3e",padding:"10px 18px",display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,color:"#FFD700",textTransform:"uppercase"}}>{team}</span>
              <span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>
                {teamRows.filter(r=>r.paid).length} paid · {teamRows.filter(r=>r.paid&&r.games>=4).length} eligible
              </span>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{background:"#f8f9fb"}}>
                  <th style={{padding:"8px 16px",textAlign:"left",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,textTransform:"uppercase",color:"rgba(0,0,0,0.4)",borderBottom:"1px solid rgba(0,0,0,0.07)"}}>Player</th>
                  <th style={{padding:"8px 12px",textAlign:"center",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,textTransform:"uppercase",color:"rgba(0,0,0,0.4)",borderBottom:"1px solid rgba(0,0,0,0.07)"}}>$50 Paid</th>
                  <th style={{padding:"8px 12px",textAlign:"center",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,textTransform:"uppercase",color:"rgba(0,0,0,0.4)",borderBottom:"1px solid rgba(0,0,0,0.07)"}}>Games</th>
                  <th style={{padding:"8px 12px",textAlign:"center",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,textTransform:"uppercase",color:"rgba(0,0,0,0.4)",borderBottom:"1px solid rgba(0,0,0,0.07)"}}>Eligible</th>
                </tr>
              </thead>
              <tbody>
                {teamRows.map((r,i) => {
                  const eligible = r.paid && r.games >= 4;
                  return (
                    <tr key={r.player_name} style={{borderBottom:"1px solid rgba(0,0,0,0.05)",background:i%2===0?"#fff":"#fafafa"}}>
                      <td style={{padding:"10px 16px",fontWeight:600,color:"#111"}}>{r.player_name}</td>
                      <td style={{padding:"10px 12px",textAlign:"center"}}>
                        <input type="checkbox" checked={r.paid} onChange={()=>!saving&&togglePaid(r)}
                          style={{width:18,height:18,cursor:saving?"wait":"pointer",accentColor:"#16a34a"}}/>
                      </td>
                      <td style={{padding:"10px 12px",textAlign:"center"}}>
                        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,color:r.games>=4?"#16a34a":r.games>0?"#b45309":"#ccc"}}>{r.games}</span>
                        <span style={{fontSize:10,color:"rgba(0,0,0,0.3)",marginLeft:2}}>/4</span>
                      </td>
                      <td style={{padding:"10px 12px",textAlign:"center",fontSize:18}}>
                        {eligible ? "✅" : r.paid && r.games < 4 ? "⏳" : r.games >= 4 && !r.paid ? "💳" : "❌"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

        {!loading && rows.length === 0 && (
          <div style={{textAlign:"center",padding:30,color:"#aaa",fontSize:13}}>No roster data found. Add players to team rosters to track eligibility.</div>
        )}

        <div style={{background:"#f8f9fb",border:"1px solid rgba(0,0,0,0.09)",borderRadius:8,padding:"12px 16px",fontSize:12,color:"rgba(0,0,0,0.45)",lineHeight:1.8}}>
          <strong style={{color:"#333"}}>Legend:</strong> ✅ Fully eligible &nbsp;·&nbsp; ⏳ Paid but needs more games &nbsp;·&nbsp; 💳 4+ games but fee not paid &nbsp;·&nbsp; ❌ Not eligible
          <br/>Game appearances are automatically pulled from submitted box scores.
        </div>
      </div>
      )}

      {activeDiv === "BOM" && (() => {
        const allBomPlayers = BOM_TEAMS.flatMap(t => (bomRosters[t]||[]).map(p => ({player_name:p, team_name:t})));
        const getRec = (p, t) => bomPayments.find(r => r.player_name===p && r.team_name===t);
        const getCount = (p, t) => {
          const rec = getRec(p, t);
          const n = parseInt(rec?.notes || "0", 10);
          return isNaN(n) ? 0 : n;
        };
        const totalPlayers = allBomPlayers.length;
        const insuredCount = allBomPlayers.filter(x => getRec(x.player_name, x.team_name)?.paid).length;
        const totalGamesPaid = allBomPlayers.reduce((s,x) => s + getCount(x.player_name, x.team_name), 0);
        const totalRevenue = insuredCount*25 + totalGamesPaid*20;
        return (
          <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:16}}>
            {/* Summary bar */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
              {[
                {label:"Players",value:totalPlayers,color:"#7c3aed"},
                {label:"Insurance Paid",value:`${insuredCount} / ${totalPlayers}`,color:"#16a34a"},
                {label:"Game Fees Prepaid",value:totalGamesPaid,color:"#b45309"},
                {label:"Collected",value:`$${totalRevenue}`,color:"#065f46"},
              ].map(s => (
                <div key={s.label} style={{background:"#f8f9fb",border:`2px solid ${s.color}22`,borderRadius:10,padding:"12px 16px",textAlign:"center"}}>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:26,color:s.color,lineHeight:1}}>{s.value}</div>
                  <div style={{fontSize:11,color:"rgba(0,0,0,0.45)",fontWeight:700,textTransform:"uppercase",letterSpacing:".05em",marginTop:3}}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{background:"#f3f0ff",border:"1px solid #ddd6fe",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#5b21b6",lineHeight:1.7}}>
              <strong>Boomers prepay model:</strong> $25 annual insurance (one-time) + $20 per-game fee. Boomers pay ahead of each game — use the +/− buttons to bank paid game credits as players hand over cash/Venmo.
            </div>

            {loading && <div style={{textAlign:"center",padding:30,color:"#888"}}>Loading…</div>}

            {!loading && BOM_TEAMS.map(team => {
              const roster = bomRosters[team] || [];
              return (
                <div key={team} style={{border:"1px solid rgba(0,0,0,0.09)",borderRadius:10,overflow:"hidden"}}>
                  <div style={{background:"#3b1d6e",padding:"10px 18px",display:"flex",alignItems:"center",gap:12}}>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,color:"#fff",textTransform:"uppercase"}}>{team}</span>
                    <span style={{fontSize:12,color:"rgba(255,255,255,0.55)"}}>
                      {roster.filter(p => getRec(p, team)?.paid).length} insured · {roster.reduce((s,p)=>s+getCount(p,team),0)} game credits
                    </span>
                  </div>
                  {roster.length === 0 ? (
                    <div style={{padding:"20px",textAlign:"center",color:"#aaa",fontSize:13}}>No roster found for {team}.</div>
                  ) : (
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                    <thead>
                      <tr style={{background:"#f8f9fb"}}>
                        <th style={{padding:"8px 16px",textAlign:"left",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,textTransform:"uppercase",color:"rgba(0,0,0,0.4)",borderBottom:"1px solid rgba(0,0,0,0.07)"}}>Player</th>
                        <th style={{padding:"8px 12px",textAlign:"center",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,textTransform:"uppercase",color:"rgba(0,0,0,0.4)",borderBottom:"1px solid rgba(0,0,0,0.07)"}}>Insurance $25</th>
                        <th style={{padding:"8px 12px",textAlign:"center",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,textTransform:"uppercase",color:"rgba(0,0,0,0.4)",borderBottom:"1px solid rgba(0,0,0,0.07)"}}>Games Prepaid ($20 each)</th>
                        <th style={{padding:"8px 12px",textAlign:"center",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,textTransform:"uppercase",color:"rgba(0,0,0,0.4)",borderBottom:"1px solid rgba(0,0,0,0.07)"}}>Total Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster.map((p, i) => {
                        const rec = getRec(p, team);
                        const insured = !!rec?.paid;
                        const gCount = getCount(p, team);
                        const total = (insured?25:0) + gCount*20;
                        return (
                          <tr key={p} style={{borderBottom:"1px solid rgba(0,0,0,0.05)",background:i%2===0?"#fff":"#fafafa"}}>
                            <td style={{padding:"10px 16px",fontWeight:600,color:"#111"}}>{p}</td>
                            <td style={{padding:"10px 12px",textAlign:"center"}}>
                              <input type="checkbox" checked={insured} disabled={bomSaving} onChange={()=>toggleBomInsurance(p, team)}
                                style={{width:18,height:18,cursor:bomSaving?"wait":"pointer",accentColor:"#7c3aed"}}/>
                            </td>
                            <td style={{padding:"10px 12px",textAlign:"center"}}>
                              <div style={{display:"inline-flex",alignItems:"center",gap:8}}>
                                <button type="button" disabled={bomSaving||gCount<=0} onClick={()=>setBomGamesPaid(p, team, gCount-1)}
                                  style={{width:26,height:26,borderRadius:6,border:"1px solid rgba(0,0,0,0.15)",background:gCount<=0?"#f3f4f6":"#fff",color:gCount<=0?"#ccc":"#111",fontWeight:900,fontSize:14,cursor:gCount<=0||bomSaving?"not-allowed":"pointer"}}>−</button>
                                <span style={{display:"inline-block",minWidth:30,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,color:gCount>0?"#7c3aed":"#ccc"}}>{gCount}</span>
                                <button type="button" disabled={bomSaving} onClick={()=>setBomGamesPaid(p, team, gCount+1)}
                                  style={{width:26,height:26,borderRadius:6,border:"1px solid #7c3aed",background:"#7c3aed",color:"#fff",fontWeight:900,fontSize:14,cursor:bomSaving?"wait":"pointer"}}>+</button>
                              </div>
                            </td>
                            <td style={{padding:"10px 12px",textAlign:"center"}}>
                              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,color:total>0?"#065f46":"#ccc"}}>${total}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  )}
                </div>
              );
            })}

            <div style={{background:"#f8f9fb",border:"1px solid rgba(0,0,0,0.09)",borderRadius:8,padding:"12px 16px",fontSize:12,color:"rgba(0,0,0,0.45)",lineHeight:1.8}}>
              <strong style={{color:"#333"}}>Tip:</strong> Toggle the <span style={{color:"#7c3aed",fontWeight:700}}>insurance checkbox</span> once per player per year. Use <span style={{color:"#7c3aed",fontWeight:700}}>+ / −</span> to add or remove prepaid game credits as players pay.
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function TournamentManagerPage({ onBack }) {
  const TEAMS = Object.keys(TEAM_ROSTERS);

  const saveTournMeta = async (list) => { await safeSave("Tournaments", () => sbUpsert("lbdc_tournament_meta", {id:"main", data:list})); };

  const moveTournament = async (idx, dir) => {
    const next = idx + dir;
    if (next < 0 || next >= tournMeta.length) return;
    const updated = [...tournMeta];
    [updated[idx], updated[next]] = [updated[next], updated[idx]];
    setTournMeta(updated);
    await saveTournMeta(updated);
  };

  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({tournament_name:"", game_date:"", game_time:"9:00 AM", field:"", away_team:"", home_team:"", notes:""});
  const [newTournForm, setNewTournForm] = useState({name:"", location:""});
  const [showNewTourn, setShowNewTourn] = useState(false);
  const [tournMeta, setTournMeta] = useState([]);
  const [reorderMode, setReorderMode] = useState(false);

  const load = () => {
    setLoading(true);
    sbFetch("tournament_games?select=id,tournament_name,game_date,game_time,field,away_team,home_team,notes&order=tournament_name.asc,game_date.asc,game_time.asc")
      .then(data => { setGames(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    sbFetch("lbdc_tournament_meta?id=eq.main&select=data")
      .then(rows => { if (rows && rows[0] && rows[0].data) setTournMeta(rows[0].data); })
      .catch(() => {});
  }, []);

  const tournamentNames = [...new Set([...tournMeta.map(m=>m.name), ...games.map(g => g.tournament_name)])];

  const createTournament = async () => {
    const name = newTournForm.name.trim();
    const location = newTournForm.location.trim();
    if (!name) return;
    setSaving(true);
    try {
      await sbPost("tournament_games", {
        tournament_name: name, game_date: null, game_time: null,
        field: location || null, away_team: "TBD", home_team: "TBD", notes: "__placeholder__",
      });
      const updated = [...tournMeta.filter(m=>m.name!==name), {name, location}];
      saveTournMeta(updated); setTournMeta(updated);
      setNewTournForm({name:"", location:""});
      setShowNewTourn(false);
      load();
    } catch(e) { alert("Save failed: " + e.message); }
    setSaving(false);
  };

  const createAndAddGame = async () => {
    const name = newTournForm.name.trim();
    const location = newTournForm.location.trim();
    if (!name) return;
    setSaving(true);
    try {
      await sbPost("tournament_games", {
        tournament_name: name, game_date: null, game_time: null,
        field: location || null, away_team: "TBD", home_team: "TBD", notes: "__placeholder__",
      });
      const updated = [...tournMeta.filter(m=>m.name!==name), {name, location}];
      saveTournMeta(updated); setTournMeta(updated);
      setAddForm(f=>({...f, tournament_name:name, field: location}));
      setNewTournForm({name:"", location:""});
      setShowNewTourn(false);
      setShowAdd(true);
      load();
    } catch(e) { alert("Save failed: " + e.message); }
    setSaving(false);
  };

  const addGame = async () => {
    if (!addForm.tournament_name || !addForm.away_team || !addForm.home_team) return;
    setSaving(true);
    try {
      await sbPost("tournament_games", {
        tournament_name: addForm.tournament_name,
        game_date: addForm.game_date || null,
        game_time: addForm.game_time || null,
        field: addForm.field || null,
        away_team: addForm.away_team,
        home_team: addForm.home_team,
        notes: addForm.notes || null,
      });
      // Remove placeholder row now that a real game exists
      const pids = placeholderIds(addForm.tournament_name);
      for (const pid of pids) { try { await sbDelete(`tournament_games?id=eq.${pid}`); } catch(e) {} }
      setAddForm(f=>({...f, game_date:"", game_time:"9:00 AM", away_team:"", home_team:"", notes:""}));
      setShowAdd(false);
      load();
    } catch(e) { alert("Save failed: " + e.message); }
    setSaving(false);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await sbPatch(`tournament_games?id=eq.${editId}`, {
        tournament_name: editForm.tournament_name,
        game_date: editForm.game_date || null,
        game_time: editForm.game_time || null,
        field: editForm.field || null,
        away_team: editForm.away_team,
        home_team: editForm.home_team,
        notes: editForm.notes || null,
      });
      setEditId(null);
      load();
    } catch(e) { alert("Save failed: " + e.message); }
    setSaving(false);
  };

  const deleteGame = async (id) => {
    if (!window.confirm("Delete this game?")) return;
    try {
      await sbDelete(`tournament_games?id=eq.${id}`);
      setGames(prev => prev.filter(g => g.id !== id));
    } catch(e) { alert("Delete failed: " + e.message); }
  };

  const byTournament = {};
  games.forEach(g => { if (!byTournament[g.tournament_name]) byTournament[g.tournament_name] = []; byTournament[g.tournament_name].push(g); });
  // Real games only (exclude __placeholder__ rows from display/counts)
  const realGames = (tname) => (byTournament[tname]||[]).filter(g=>g.notes!=="__placeholder__");
  const placeholderIds = (tname) => (byTournament[tname]||[]).filter(g=>g.notes==="__placeholder__").map(g=>g.id);

  const inputStyle = {padding:"7px 10px",border:"1px solid #ddd",borderRadius:6,fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"};

  return (
    <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:12,overflow:"hidden"}}>
      <div style={{padding:"16px 20px",borderBottom:"1px solid rgba(0,0,0,0.07)",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <button type="button" onClick={onBack} style={{padding:"5px 12px",background:"rgba(0,0,0,0.07)",border:"none",borderRadius:6,fontWeight:700,fontSize:13,cursor:"pointer"}}>← Back</button>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,textTransform:"uppercase",color:"#111"}}>🏆 Manage Tournaments</div>
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <button type="button" onClick={load} style={{padding:"6px 12px",background:"rgba(0,45,110,0.07)",border:"1px solid rgba(0,45,110,0.2)",borderRadius:6,fontWeight:700,fontSize:12,color:"#002d6e",cursor:"pointer"}}>↻ Refresh</button>
          <button type="button" onClick={()=>{setReorderMode(s=>!s);setShowAdd(false);setShowNewTourn(false);}}
            style={{padding:"7px 14px",background:reorderMode?"#16a34a":"rgba(0,0,0,0.07)",border:`1px solid ${reorderMode?"#16a34a":"rgba(0,0,0,0.15)"}`,borderRadius:7,color:reorderMode?"#fff":"#333",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer"}}>
            ⇅ {reorderMode ? "Done" : "Reorder"}
          </button>
          <button type="button" onClick={()=>{setShowNewTourn(s=>!s);setShowAdd(false);}}
            style={{padding:"7px 14px",background:"rgba(180,83,9,0.1)",border:"1px solid rgba(180,83,9,0.3)",borderRadius:7,color:"#b45309",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer"}}>
            + New Tournament
          </button>
          <button type="button" onClick={()=>{setShowAdd(s=>!s);setShowNewTourn(false);}}
            style={{padding:"7px 14px",background:"#002d6e",border:"none",borderRadius:7,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer"}}>
            + Add Game
          </button>
        </div>
      </div>

      <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:16}}>
        <div style={{fontSize:13,color:"rgba(0,0,0,0.5)"}}>Tournament games appear on a dedicated <strong>Tournaments</strong> tab on the public Schedule page.</div>

        {/* New Tournament form */}
        {showNewTourn && (
          <div style={{background:"#fff8e1",border:"2px solid #b45309",borderRadius:10,padding:"16px 18px",display:"flex",flexDirection:"column",gap:10}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:15,textTransform:"uppercase",color:"#b45309"}}>🏆 Create New Tournament</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",display:"block",marginBottom:3}}>Tournament Name</label>
                <input type="text" placeholder="e.g. Memorial Day Classic" value={newTournForm.name} onChange={e=>setNewTournForm(f=>({...f,name:e.target.value}))} style={inputStyle}/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",display:"block",marginBottom:3}}>Location</label>
                <input type="text" placeholder="e.g. Clark Field — Long Beach" value={newTournForm.location} onChange={e=>setNewTournForm(f=>({...f,location:e.target.value}))} style={inputStyle}/>
              </div>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button type="button" onClick={createTournament} disabled={!newTournForm.name.trim()}
                style={{padding:"9px 20px",background:newTournForm.name.trim()?"#b45309":"#ccc",border:"none",borderRadius:7,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,cursor:newTournForm.name.trim()?"pointer":"default"}}>
                Create Tournament
              </button>
              <button type="button" onClick={createAndAddGame} disabled={!newTournForm.name.trim()}
                style={{padding:"9px 20px",background:newTournForm.name.trim()?"#002d6e":"#ccc",border:"none",borderRadius:7,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,cursor:newTournForm.name.trim()?"pointer":"default"}}>
                Create & Add First Game
              </button>
              <button type="button" onClick={()=>setShowNewTourn(false)} style={{padding:"9px 14px",background:"rgba(0,0,0,0.07)",border:"none",borderRadius:7,fontWeight:700,fontSize:13,cursor:"pointer"}}>Cancel</button>
            </div>
          </div>
        )}

        {/* Add Game form */}
        {showAdd && (
          <div style={{background:"#f0f4ff",border:"2px solid #002d6e",borderRadius:10,padding:"16px 18px",display:"flex",flexDirection:"column",gap:10}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:15,textTransform:"uppercase",color:"#002d6e"}}>➕ Add Game</div>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",display:"block",marginBottom:3}}>Tournament</label>
              <input type="text" list="tourn-names" placeholder="Tournament name" value={addForm.tournament_name} onChange={e=>{
                const name = e.target.value;
                const meta = tournMeta.find(m=>m.name===name);
                setAddForm(f=>({...f, tournament_name:name, field: meta ? (meta.location || f.field) : f.field}));
              }} style={inputStyle}/>
              <datalist id="tourn-names">{tournamentNames.map(n=><option key={n} value={n}/>)}</datalist>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {[["Date","game_date","type","date"],["Time","game_time","placeholder","9:00 AM"],["Location / Field","field","placeholder","e.g. Clark Field — Long Beach"]].map(([l,k,pt,pv])=>(
                <div key={k}><label style={{fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",display:"block",marginBottom:3}}>{l}</label>
                  <input type={pt==="type"?pv:"text"} placeholder={pt==="placeholder"?pv:""} value={addForm[k]} onChange={e=>setAddForm(f=>({...f,[k]:e.target.value}))} style={inputStyle}/></div>
              ))}
            </div>
            <datalist id="tourn-teams">
              {TEAMS.map(t=><option key={t} value={t}/>)}
            </datalist>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {[["Away Team","away_team"],["Home Team","home_team"]].map(([l,k])=>(
                <div key={k}><label style={{fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",display:"block",marginBottom:3}}>{l}</label>
                  <input type="text" list="tourn-teams" placeholder="Team name or enter new" value={addForm[k]} onChange={e=>setAddForm(f=>({...f,[k]:e.target.value}))} style={inputStyle}/>
                </div>
              ))}
            </div>
            <div><label style={{fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",display:"block",marginBottom:3}}>Notes (optional)</label>
              <input type="text" placeholder="e.g. Pool play, Bracket Game 1" value={addForm.notes} onChange={e=>setAddForm(f=>({...f,notes:e.target.value}))} style={inputStyle}/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button type="button" onClick={addGame} disabled={!addForm.tournament_name||!addForm.away_team||!addForm.home_team||saving}
                style={{padding:"9px 22px",background:(addForm.tournament_name&&addForm.away_team&&addForm.home_team)?"#002d6e":"#ccc",border:"none",borderRadius:7,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,cursor:(addForm.tournament_name&&addForm.away_team&&addForm.home_team)?"pointer":"default"}}>
                {saving ? "Saving…" : "Save Game"}
              </button>
              <button type="button" onClick={()=>setShowAdd(false)} style={{padding:"9px 14px",background:"rgba(0,0,0,0.07)",border:"none",borderRadius:7,fontWeight:700,fontSize:13,cursor:"pointer"}}>Cancel</button>
            </div>
          </div>
        )}

        {loading && <div style={{textAlign:"center",padding:30,color:"#888"}}>Loading…</div>}
        {!loading && games.length === 0 && tournMeta.length === 0 && (
          <div style={{textAlign:"center",padding:30,color:"#aaa",fontSize:13}}>No tournaments yet. Click <strong>+ New Tournament</strong> to get started.</div>
        )}

        {/* Reorder panel */}
        {reorderMode && tournMeta.length > 0 && (
          <div style={{background:"#f0fdf4",border:"2px solid #16a34a",borderRadius:10,padding:"16px 18px"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:15,textTransform:"uppercase",color:"#16a34a",marginBottom:12}}>⇅ Drag to reorder — use arrows to move tournaments up or down</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {tournMeta.map((m, idx) => (
                <div key={m.name} style={{display:"flex",alignItems:"center",gap:8,background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderLeft:"4px solid #16a34a",borderRadius:8,padding:"10px 14px"}}>
                  <span style={{fontSize:13,color:"rgba(0,0,0,0.3)",fontWeight:700,width:20,textAlign:"center",flexShrink:0}}>{idx+1}</span>
                  <span style={{flex:1,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,textTransform:"uppercase"}}>{m.name}</span>
                  {m.location && <span style={{fontSize:12,color:"rgba(0,0,0,0.4)"}}>{m.location}</span>}
                  <div style={{display:"flex",gap:4,flexShrink:0}}>
                    <button type="button" onClick={()=>moveTournament(idx,-1)} disabled={idx===0}
                      style={{width:30,height:30,border:"1px solid rgba(0,0,0,0.15)",borderRadius:6,background:idx===0?"#f3f4f6":"#fff",cursor:idx===0?"not-allowed":"pointer",fontSize:16,opacity:idx===0?0.35:1,display:"flex",alignItems:"center",justifyContent:"center"}}>↑</button>
                    <button type="button" onClick={()=>moveTournament(idx,1)} disabled={idx===tournMeta.length-1}
                      style={{width:30,height:30,border:"1px solid rgba(0,0,0,0.15)",borderRadius:6,background:idx===tournMeta.length-1?"#f3f4f6":"#fff",cursor:idx===tournMeta.length-1?"not-allowed":"pointer",fontSize:16,opacity:idx===tournMeta.length-1?0.35:1,display:"flex",alignItems:"center",justifyContent:"center"}}>↓</button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{fontSize:12,color:"rgba(0,0,0,0.4)",marginTop:10}}>Order saves automatically. Click <strong>Done</strong> when finished.</div>
          </div>
        )}

        {/* Games grouped by tournament — includes meta-only tournaments (no games yet) */}
        {tournamentNames.map(tname => {
          const tgamesReal = realGames(tname);
          const meta = tournMeta.find(m=>m.name===tname);
          return (
          <div key={tname} style={{border:"1px solid rgba(0,0,0,0.09)",borderRadius:10,overflow:"hidden"}}>
            <div style={{background:"#002d6e",padding:"10px 18px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <div>
                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,color:"#FFD700",textTransform:"uppercase"}}>🏆 {tname}</span>
                {meta?.location && <span style={{fontSize:12,color:"rgba(255,255,255,0.65)",marginLeft:10}}>📍 {meta.location}</span>}
              </div>
              <span style={{marginLeft:"auto",fontSize:12,color:"rgba(255,255,255,0.5)"}}>{tgamesReal.length > 0 ? `${tgamesReal.length} game${tgamesReal.length!==1?"s":""}` : "No games yet"}</span>
              <button type="button" onClick={()=>{setAddForm(f=>({...f,tournament_name:tname,field:meta?.location||""}));setShowAdd(true);setShowNewTourn(false);}}
                style={{padding:"4px 10px",background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:5,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                + Add Game
              </button>
              <button type="button" onClick={async ()=>{
                  const allTGames = byTournament[tname] || [];
                  const msg = tgamesReal.length > 0
                    ? `Delete "${tname}" and all ${tgamesReal.length} game${tgamesReal.length!==1?"s":""}?`
                    : `Delete "${tname}"?`;
                  if (!window.confirm(msg)) return;
                  try {
                    if (allTGames.length > 0) await sbDelete(`tournament_games?tournament_name=eq.${encodeURIComponent(tname)}`);
                    const updated = tournMeta.filter(m=>m.name!==tname);
                    saveTournMeta(updated);
                    setTournMeta(updated);
                    setGames(prev => prev.filter(g=>g.tournament_name!==tname));
                  } catch(e) { alert("Delete failed: "+e.message); }
                }}
                style={{padding:"4px 10px",background:"rgba(220,38,38,0.25)",border:"1px solid rgba(220,38,38,0.4)",borderRadius:5,color:"#fca5a5",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                🗑 Delete
              </button>
            </div>
            {tgamesReal.map(g => (
              <div key={g.id}>
                {editId === g.id ? (
                  <div style={{padding:"14px 18px",background:"#eff6ff",borderBottom:"1px solid rgba(0,0,0,0.06)"}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
                      {[["Date","game_date"],["Time","game_time"],["Field","field"]].map(([l,k])=>(
                        <div key={k}><label style={{fontSize:10,fontWeight:700,color:"#888",textTransform:"uppercase",display:"block",marginBottom:2}}>{l}</label>
                          <input value={editForm[k]||""} onChange={e=>setEditForm(f=>({...f,[k]:e.target.value}))} style={inputStyle}/></div>
                      ))}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                      {[["Away Team","away_team"],["Home Team","home_team"]].map(([l,k])=>(
                        <div key={k}><label style={{fontSize:10,fontWeight:700,color:"#888",textTransform:"uppercase",display:"block",marginBottom:2}}>{l}</label>
                          <input type="text" list="tourn-teams" placeholder="Team name or enter new" value={editForm[k]||""} onChange={e=>setEditForm(f=>({...f,[k]:e.target.value}))} style={inputStyle}/>
                        </div>
                      ))}
                    </div>
                    <div style={{marginBottom:10}}>
                      <label style={{fontSize:10,fontWeight:700,color:"#888",textTransform:"uppercase",display:"block",marginBottom:2}}>Notes</label>
                      <input value={editForm.notes||""} onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))} placeholder="e.g. Pool play, Bracket Game 1" style={inputStyle}/>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button type="button" onClick={saveEdit} disabled={saving} style={{padding:"7px 18px",background:"#002d6e",border:"none",borderRadius:6,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer"}}>{saving?"Saving…":"Save"}</button>
                      <button type="button" onClick={()=>setEditId(null)} style={{padding:"7px 12px",background:"rgba(0,0,0,0.07)",border:"none",borderRadius:6,fontWeight:700,fontSize:13,cursor:"pointer"}}>Cancel</button>
                      <button type="button" onClick={()=>deleteGame(g.id)} style={{marginLeft:"auto",padding:"7px 12px",background:"rgba(220,38,38,0.1)",border:"1px solid rgba(220,38,38,0.2)",borderRadius:6,color:"#dc2626",fontWeight:700,fontSize:12,cursor:"pointer"}}>Delete</button>
                    </div>
                  </div>
                ) : (
                  <div onClick={()=>{setEditId(g.id);setEditForm({tournament_name:g.tournament_name,game_date:g.game_date||"",game_time:g.game_time||"",field:g.field||"",away_team:g.away_team,home_team:g.home_team,notes:g.notes||""});}}
                    style={{display:"flex",alignItems:"center",padding:"10px 18px",borderBottom:"1px solid rgba(0,0,0,0.05)",cursor:"pointer",transition:"background .1s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#f0f4ff"}
                    onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,textTransform:"uppercase"}}>{g.away_team} <span style={{color:"#ccc",fontWeight:400}}>@</span> {g.home_team}</div>
                      <div style={{fontSize:11,color:"#888",marginTop:1}}>
                        {g.game_date && <span>{g.game_date}</span>}
                        {g.game_time && <span> · {g.game_time}</span>}
                        {g.field && <span> · {g.field}</span>}
                        {g.notes && <span style={{color:"#b45309",fontWeight:600}}> · {g.notes}</span>}
                      </div>
                    </div>
                    <div style={{fontSize:11,color:"#002d6e",fontWeight:700,flexShrink:0}}>✏️ Edit</div>
                  </div>
                )}
              </div>
            ))}
            {tgamesReal.length === 0 && (
              <div style={{padding:"14px 18px",color:"#999",fontSize:13,display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:16}}>⏳</span>
                <span>Game schedule not yet released — showing on public schedule as "Coming Soon".</span>
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}

const SCHEDULE_FIELDS = [
  "Clark Field — Long Beach",
  "Fromhold Field — San Pedro",
  "St Pius X — Downey",
];

function ManageSchedulePage({ onBack }) {
  const TEAMS = Object.keys(TEAM_ROSTERS);
  const [league, setLeague] = useState(0); // 0=Saturday, 1=Boomers

  const buildDefaultSat = () => SCHED.flatMap(week =>
    week.fields.flatMap(f =>
      f.games.map(g => ({ id: Math.random().toString(36).slice(2), date: week.label, time: g.time, field: f.name, away: g.away, home: g.home, status: g.status||"", source: "sched" }))
    )
  );
  const buildDefaultBom = () => BOOMERS_SCHED.map(g => ({ id: Math.random().toString(36).slice(2), date: g.date, time: g.time, field: g.field, away: g.away, home: g.home, status: g.status||"", source: "sched" }));

  const [satGames, setSatGames] = useState([]);
  const [bomGames, setBomGames] = useState([]);
  const [schedLoading, setSchedLoading] = useState(true);
  const [fieldOptions, setFieldOptions] = useState(SCHEDULE_FIELDS);
  const games = league === 1 ? bomGames : satGames;

  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ date:"", time:"9:00 AM", field:SCHEDULE_FIELDS[0], away:TEAMS[0], home:TEAMS[1] });
  // Disable Save/Delete buttons while a write is in flight so a double-click
  // doesn't fire two racey writes against the same row.
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      sbFetch("lbdc_schedules?id=eq.sat&select=data"),
      sbFetch("lbdc_schedules?id=eq.bom&select=data"),
      sbFetch("lbdc_fields?id=eq.main&select=data"),
    ]).then(([sr, br, fr]) => {
      setSatGames(sr && sr[0] ? sr[0].data : buildDefaultSat());
      setBomGames(br && br[0] ? br[0].data : buildDefaultBom());
      const fdata = fr && fr[0] && Array.isArray(fr[0].data) ? fr[0].data : FIELDS_INFO;
      const opts = fdata.map(f => f.location ? `${f.name} — ${f.location.split(",")[0].trim()}` : f.name);
      setFieldOptions(opts.length ? opts : SCHEDULE_FIELDS);
      setAddForm(prev => ({...prev, field: prev.field || opts[0] || SCHEDULE_FIELDS[0]}));
      setSchedLoading(false);
    }).catch(() => {
      setSatGames(buildDefaultSat());
      setBomGames(buildDefaultBom());
      setSchedLoading(false);
    });
  }, []);

  const persist = async (list) => {
    const key = league === 1 ? "bom" : "sat";
    const prev = league === 1 ? bomGames : satGames;
    if (league === 1) setBomGames(list); else setSatGames(list);
    setSaving(true);
    const r = await safeSave("Schedule", () => sbUpsert("lbdc_schedules", {id:key, data:list}));
    setSaving(false);
    // Roll local state back if the DB write failed so the UI doesn't lie about success.
    if (!r.ok) { if (league === 1) setBomGames(prev); else setSatGames(prev); }
  };

  const startEdit = (g) => { setEditId(g.id); setEditForm({date:g.date,time:g.time,field:g.field,away:g.away,home:g.home,status:g.status||"",notes:g.notes||""}); };
  const saveEdit = () => {
    persist(games.map(g => g.id===editId ? {...g,...editForm} : g));
    setEditId(null);
  };
  const setStatus = (id, status) => persist(games.map(g => g.id===id ? {...g, status} : g));
  const deleteGame = (id) => persist(games.filter(g=>g.id!==id));
  const addGame = () => {
    if(!addForm.date) return;
    persist([...games, {...addForm, id:Math.random().toString(36).slice(2), source:"custom"}]);
    setAddForm({ date:"", time:"9:00 AM", field:"Clark Field", away:TEAMS[0], home:TEAMS[1] });
    setShowAdd(false);
  };

  // Group by date for display
  const byDate = {};
  games.forEach(g => { if(!byDate[g.date]) byDate[g.date]=[]; byDate[g.date].push(g); });

  const inputStyle = {padding:"6px 8px",border:"1px solid #ddd",borderRadius:6,fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"};
  const selStyle = {...inputStyle};

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
        <button type="button" onClick={onBack} style={{padding:"6px 14px",background:"rgba(0,0,0,0.07)",border:"none",borderRadius:6,cursor:"pointer",fontWeight:700,fontSize:13}}>← Back</button>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,textTransform:"uppercase",color:"#111"}}>Manage Schedule</div>
        <div style={{display:"flex",gap:6,marginLeft:8}}>
          {["Saturday","Boomers 60/70"].map((label,i) => (
            <button key={i} type="button" onClick={()=>{setLeague(i);setEditId(null);setShowAdd(false);}} style={{
              padding:"4px 12px",borderRadius:12,cursor:"pointer",border:"1px solid",fontWeight:700,fontSize:12,
              background:league===i?"#002d6e":"#fff",color:league===i?"#fff":"#555",
              borderColor:league===i?"#002d6e":"rgba(0,0,0,0.15)",
            }}>{label}</button>
          ))}
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <button type="button" disabled={saving} onClick={async()=>{ if(window.confirm("Reset schedule back to original?")){ const prev = league===1?bomGames:satGames; const d=league===1?buildDefaultBom():buildDefaultSat(); if(league===1)setBomGames(d);else setSatGames(d); setSaving(true); const r=await safeSave("Schedule reset",()=>sbUpsert("lbdc_schedules",{id:league===1?"bom":"sat",data:d})); setSaving(false); if(!r.ok){ if(league===1)setBomGames(prev);else setSatGames(prev); } }}}
            style={{padding:"7px 14px",background:"rgba(220,38,38,0.1)",border:"1px solid rgba(220,38,38,0.25)",borderRadius:6,color:"#dc2626",fontWeight:700,fontSize:12,cursor:saving?"wait":"pointer"}}>Reset</button>
          <button type="button" onClick={()=>setShowAdd(s=>!s)}
            style={{padding:"8px 18px",background:"#002d6e",border:"none",borderRadius:8,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer"}}>+ Add Game</button>
        </div>
      </div>

      {showAdd && (
        <div style={{background:"#fff",border:"2px solid #002d6e",borderRadius:12,padding:"18px",marginBottom:16}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,textTransform:"uppercase",marginBottom:12,color:"#002d6e"}}>New Game</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
            {[["Date","date","Apr 19, 2026"],["Time","time","9:00 AM"]].map(([l,k,ph])=>(
              <div key={k}><label style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase",display:"block",marginBottom:3}}>{l}</label>
                <input value={addForm[k]} onChange={e=>setAddForm(f=>({...f,[k]:e.target.value}))} placeholder={ph} style={inputStyle}/></div>
            ))}
            <div><label style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase",display:"block",marginBottom:3}}>Field</label>
              <select value={addForm.field} onChange={e=>setAddForm(f=>({...f,field:e.target.value}))} style={selStyle}>
                {(fieldOptions.includes(addForm.field) || !addForm.field ? fieldOptions : [addForm.field, ...fieldOptions]).map(f=><option key={f}>{f}</option>)}
              </select>
              <div style={{fontSize:10,color:"#888",marginTop:3}}>Need a new field? Add it in <strong>Admin → Field Directions</strong>.</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            {[["Away","away"],["Home","home"]].map(([l,k])=>(
              <div key={k}><label style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase",display:"block",marginBottom:3}}>{l}</label>
                <select value={addForm[k]} onChange={e=>setAddForm(f=>({...f,[k]:e.target.value}))} style={selStyle}>
                  {TEAMS.map(t=><option key={t}>{t}</option>)}
                </select></div>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button type="button" onClick={addGame} disabled={saving} style={{padding:"9px 22px",background:saving?"#94a3b8":"#002d6e",border:"none",borderRadius:7,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,cursor:saving?"wait":"pointer"}}>{saving?"Saving…":"Save"}</button>
            <button type="button" onClick={()=>setShowAdd(false)} disabled={saving} style={{padding:"9px 14px",background:"rgba(0,0,0,0.07)",border:"none",borderRadius:7,fontWeight:700,fontSize:13,cursor:saving?"wait":"pointer"}}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:12,overflow:"hidden"}}>
        <div style={{background:"#001a3e",padding:"12px 18px"}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:15,color:"#FFD700",textTransform:"uppercase",letterSpacing:".06em"}}>
            {league===1 ? "Boomers 60/70" : "Spring/Summer 2026"} — {games.length} Games · Click any game to edit
          </div>
        </div>
        {Object.entries(byDate).map(([date, dateGames]) => (
          <div key={date} style={{borderBottom:"1px solid rgba(0,0,0,0.06)"}}>
            <div style={{padding:"8px 18px",background:"#f8f9fb",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:12,textTransform:"uppercase",color:"#555",letterSpacing:".06em"}}>{date}</div>
            {dateGames.map(g => (
              <div key={g.id}>
                {editId === g.id ? (
                  <div style={{padding:"14px 18px",background:"#eff6ff",borderBottom:"1px solid rgba(0,0,0,0.06)"}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
                      {[["Date","date"],["Time","time"]].map(([l,k])=>(
                        <div key={k}><label style={{fontSize:10,fontWeight:700,color:"#888",textTransform:"uppercase",display:"block",marginBottom:2}}>{l}</label>
                          <input value={editForm[k]||""} onChange={e=>setEditForm(f=>({...f,[k]:e.target.value}))} style={inputStyle}/></div>
                      ))}
                      <div><label style={{fontSize:10,fontWeight:700,color:"#888",textTransform:"uppercase",display:"block",marginBottom:2}}>Field</label>
                        <select value={editForm.field||""} onChange={e=>setEditForm(f=>({...f,field:e.target.value}))} style={selStyle}>
                          {(editForm.field && !fieldOptions.includes(editForm.field) ? [editForm.field, ...fieldOptions] : fieldOptions).map(f=><option key={f}>{f}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                      {[["Away Team","away"],["Home Team","home"]].map(([l,k])=>(
                        <div key={k}><label style={{fontSize:10,fontWeight:700,color:"#888",textTransform:"uppercase",display:"block",marginBottom:2}}>{l}</label>
                          <select value={editForm[k]||""} onChange={e=>setEditForm(f=>({...f,[k]:e.target.value}))} style={selStyle}>
                            {TEAMS.map(t=><option key={t}>{t}</option>)}
                          </select></div>
                      ))}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:8,marginBottom:10}}>
                      <div><label style={{fontSize:10,fontWeight:700,color:"#888",textTransform:"uppercase",display:"block",marginBottom:2}}>Status</label>
                        <select value={editForm.status||""} onChange={e=>setEditForm(f=>({...f,status:e.target.value}))} style={selStyle}>
                          <option value="">Scheduled</option>
                          <option value="PPD">Postponed</option>
                          <option value="CAN">Canceled</option>
                        </select></div>
                      <div><label style={{fontSize:10,fontWeight:700,color:"#888",textTransform:"uppercase",display:"block",marginBottom:2}}>Notes (e.g. "Makeup: May 9, 2026")</label>
                        <input value={editForm.notes||""} onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))} placeholder="Optional note shown with this game" style={inputStyle}/></div>
                    </div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",background:"rgba(0,45,110,0.04)",padding:"8px 10px",borderRadius:6,marginBottom:10}}>
                      <div style={{fontSize:10,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:".04em"}}>Quick:</div>
                      <button type="button" onClick={()=>setEditForm(f=>({...f,status:"PPD"}))} style={{padding:"4px 10px",background:"#fff",border:"1px solid rgba(200,16,46,0.3)",borderRadius:6,color:"#c8102e",fontWeight:700,fontSize:11,cursor:"pointer"}}>Mark Postponed</button>
                      <button type="button" onClick={()=>setEditForm(f=>({...f,status:"CAN"}))} style={{padding:"4px 10px",background:"#fff",border:"1px solid rgba(200,16,46,0.3)",borderRadius:6,color:"#c8102e",fontWeight:700,fontSize:11,cursor:"pointer"}}>Mark Canceled</button>
                      <button type="button" onClick={()=>setEditForm(f=>({...f,status:""}))} style={{padding:"4px 10px",background:"#fff",border:"1px solid rgba(0,0,0,0.15)",borderRadius:6,color:"#444",fontWeight:700,fontSize:11,cursor:"pointer"}}>Clear</button>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button type="button" onClick={saveEdit} disabled={saving} style={{padding:"7px 18px",background:saving?"#94a3b8":"#002d6e",border:"none",borderRadius:6,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,cursor:saving?"wait":"pointer"}}>{saving?"Saving…":"Save"}</button>
                      <button type="button" onClick={()=>setEditId(null)} disabled={saving} style={{padding:"7px 12px",background:"rgba(0,0,0,0.07)",border:"none",borderRadius:6,fontWeight:700,fontSize:13,cursor:saving?"wait":"pointer"}}>Cancel</button>
                      <button type="button" onClick={()=>deleteGame(g.id)} disabled={saving} style={{marginLeft:"auto",padding:"7px 12px",background:"rgba(220,38,38,0.1)",border:"1px solid rgba(220,38,38,0.2)",borderRadius:6,color:"#dc2626",fontWeight:700,fontSize:12,cursor:saving?"wait":"pointer"}}>Delete</button>
                    </div>
                  </div>
                ) : (() => {
                  const isPPD = g.status === "PPD" || (g.status||"").toLowerCase().startsWith("postpone");
                  const isCAN = g.status === "CAN" || (g.status||"").toLowerCase().startsWith("cancel");
                  const badge = isCAN ? "CANCELED" : isPPD ? "POSTPONED" : null;
                  return (
                  <div onClick={()=>startEdit(g)}
                    style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 20px",borderBottom:"1px solid rgba(0,0,0,0.04)",cursor:"pointer",transition:"background .1s",background:badge?"rgba(200,16,46,0.04)":""}}
                    onMouseEnter={e=>e.currentTarget.style.background=badge?"rgba(200,16,46,0.08)":"#f0f4ff"}
                    onMouseLeave={e=>e.currentTarget.style.background=badge?"rgba(200,16,46,0.04)":""}>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        {badge && <span style={{background:"#c8102e",color:"#fff",padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:900,letterSpacing:".1em"}}>{badge}</span>}
                        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,textTransform:"uppercase",textDecoration:badge?"line-through":"none",color:badge?"#888":"#111"}}>{g.away} <span style={{color:"#ccc",fontWeight:400}}>@</span> {g.home}</div>
                      </div>
                      <div style={{fontSize:11,color:"#888",marginTop:1}}>{g.time} · {g.field}</div>
                      {g.notes && <div style={{fontSize:11,color:"#c8102e",marginTop:2,fontWeight:700}}>📝 {g.notes}</div>}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                      {!badge && <button type="button" onClick={e=>{e.stopPropagation();setStatus(g.id,"PPD");}} style={{padding:"4px 8px",background:"#fff",border:"1px solid rgba(200,16,46,0.3)",borderRadius:5,color:"#c8102e",fontWeight:700,fontSize:10,cursor:"pointer"}}>PPD</button>}
                      {!badge && <button type="button" onClick={e=>{e.stopPropagation();setStatus(g.id,"CAN");}} style={{padding:"4px 8px",background:"#fff",border:"1px solid rgba(200,16,46,0.3)",borderRadius:5,color:"#c8102e",fontWeight:700,fontSize:10,cursor:"pointer"}}>CAN</button>}
                      {badge && <button type="button" onClick={e=>{e.stopPropagation();setStatus(g.id,"");}} style={{padding:"4px 8px",background:"#fff",border:"1px solid rgba(0,0,0,0.15)",borderRadius:5,color:"#444",fontWeight:700,fontSize:10,cursor:"pointer"}}>Clear</button>}
                      <div style={{fontSize:11,color:"#002d6e",fontWeight:700}}>✏️ Edit</div>
                    </div>
                  </div>
                  );
                })()}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function WeeklyEmailPage({ onBack }) {
  const [copied, setCopied] = useState(false);
  const [season, setSeason] = useState("Spring/Summer 2026");
  const [liveGames, setLiveGames] = useState([]);
  const [liveStandings, setLiveStandings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      sbFetch("seasons?select=id,name&limit=50"),
    ]).then(([seasons]) => {
      const satIds = getSatSeasonFilter(seasons);
      if(!satIds.length) { setLoading(false); return; }
      setSeason("Spring/Summer 2026");
      return sbFetch(`games?select=id,game_date,home_team,away_team,home_score,away_score,status,headline&season_id=in.(${satIds.join(",")})&away_score=not.is.null&order=game_date.desc&limit=50`);
    }).then(rawGames => {
      if(!rawGames) return;
      const games = dedupGames(rawGames);
      setLiveGames(games);
      // compute standings
      const tm = {};
      Object.keys(TEAM_ROSTERS).forEach(t=>{tm[t]={w:0,l:0,t:0,rs:0,ra:0,gp:0,streak:0,lastResult:null};});
      [...games].reverse().forEach(g=>{
        const a=g.away_team,h=g.home_team,as=+g.away_score,hs=+g.home_score;
        if(!tm[a]||!tm[h]) return;
        tm[a].rs+=as;tm[a].ra+=hs;tm[a].gp++;
        tm[h].rs+=hs;tm[h].ra+=as;tm[h].gp++;
        if(as>hs){
          tm[a].w++;tm[h].l++;
          tm[a].streak=tm[a].lastResult==="W"?tm[a].streak+1:1; tm[a].lastResult="W";
          tm[h].streak=tm[h].lastResult==="L"?tm[h].streak+1:1; tm[h].lastResult="L";
        } else if(hs>as){
          tm[h].w++;tm[a].l++;
          tm[h].streak=tm[h].lastResult==="W"?tm[h].streak+1:1; tm[h].lastResult="W";
          tm[a].streak=tm[a].lastResult==="L"?tm[a].streak+1:1; tm[a].lastResult="L";
        } else {
          tm[a].t++;tm[h].t++;tm[a].lastResult="T";tm[h].lastResult="T";tm[a].streak=0;tm[h].streak=0;
        }
      });
      const rows=Object.entries(tm).map(([name,s])=>{
        const pts=s.w*2+s.t,max=(s.gp||1)*2;
        const pct=s.gp===0?"---":Number(pts/max).toFixed(3).replace(/^0/,"");
        const d=s.rs-s.ra;
        const streakStr=s.gp===0?"—":s.lastResult==="W"?`W${s.streak}`:s.lastResult==="L"?`L${s.streak}`:"T";
        return {name,w:s.w,l:s.l,t:s.t,pct,gp:s.gp,rs:s.rs,ra:s.ra,diff:d>=0?`+${d}`:`${d}`,streak:streakStr,seed:0};
      }).sort((a,b)=>{
        const ag=a.gp||1,bg=b.gp||1;
        const ar=(a.w*2+a.t)/ag,br=(b.w*2+b.t)/bg;
        return br!==ar?br-ar:(b.rs-b.ra)-(a.rs-a.ra);
      }).map((t,i)=>({...t,seed:i+1}));
      setLiveStandings(rows);
      setLoading(false);
    }).catch(()=>setLoading(false));
  },[]);

  // Group games by date, take the most recent date
  const byDate = {};
  liveGames.forEach(g=>{ if(!byDate[g.game_date]) byDate[g.game_date]=[]; byDate[g.game_date].push(g); });
  const dates = Object.keys(byDate).sort((a,b)=>b.localeCompare(a));
  const latestDate = dates[0];
  const latestGames = byDate[latestDate] || [];

  const fmtDate = (d) => d ? new Date(d+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"}) : "";

  const autoRecap = (g) => {
    const as=+g.away_score, hs=+g.home_score;
    const winner=as>hs?g.away_team:g.home_team, loser=as>hs?g.home_team:g.away_team;
    const ws=as>hs?as:hs, ls=as>hs?hs:as, margin=ws-ls;
    if(cleanHeadline(g.headline)) return cleanHeadline(g.headline);
    if(margin===0) return `${g.away_team} and ${g.home_team} played to a ${as}–${hs} tie in a hard-fought contest.`;
    if(margin>=10) return `${winner} dominated ${loser}, cruising to a ${ws}–${ls} victory.`;
    if(margin<=2) return `${winner} edged ${loser} in a nail-biter, ${ws}–${ls}.`;
    return `${winner} topped ${loser} by a score of ${ws}–${ls}.`;
  };

  const emailText = loading ? "Loading..." : [
    `LONG BEACH DIAMOND CLASSICS — WEEK IN REVIEW`,
    `${fmtDate(latestDate)}`,
    ``,
    `═══════════════════════════════════════════`,
    `  GAME RESULTS`,
    `═══════════════════════════════════════════`,
    ...latestGames.map(g=>[
      ``,
      `  ${g.away_team.toUpperCase()}  ${g.away_score}  —  ${g.home_team.toUpperCase()}  ${g.home_score}  (${g.status||"Final"})`,
      `  ${autoRecap(g)}`,
    ].join("\n")),
    ``,
    `═══════════════════════════════════════════`,
    `  STANDINGS`,
    `═══════════════════════════════════════════`,
    ``,
    `  #   TEAM              W    L    T    PCT   STREAK`,
    `  ${"─".repeat(52)}`,
    ...liveStandings.map(t=>`  ${String(t.seed).padEnd(4)}${t.name.padEnd(18)}${String(t.w).padEnd(5)}${String(t.l).padEnd(5)}${String(t.t).padEnd(5)}${t.pct.padEnd(7)}${t.streak}`),
    ``,
    liveStandings.filter(t=>t.streak.startsWith("W")&&parseInt(t.streak.slice(1))>=2).length>0
      ? `🔥 WIN STREAKS: ${liveStandings.filter(t=>t.streak.startsWith("W")&&parseInt(t.streak.slice(1))>=2).map(t=>`${t.name} (${t.streak})`).join(", ")}`
      : ``,
    ``,
    `═══════════════════════════════════════════`,
    `View full box scores & stats: https://long-beach-men-s-baseball.vercel.app`,
    `Long Beach Diamond Classics Baseball — Spring/Summer 2026`,
  ].join("\n");

  const copy = () => { navigator.clipboard.writeText(emailText).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500);}); };

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
        <button type="button" onClick={onBack} style={{padding:"6px 14px",background:"rgba(0,0,0,0.07)",border:"none",borderRadius:6,cursor:"pointer",fontWeight:700,fontSize:13}}>← Back</button>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,textTransform:"uppercase",color:"#111"}}>Weekly Email</div>
      </div>
      <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:12,padding:"20px"}}>
        {loading ? (
          <div style={{textAlign:"center",padding:40,color:"#888"}}>Loading latest results from database…</div>
        ) : latestGames.length===0 ? (
          <div style={{textAlign:"center",padding:40,color:"#888"}}>No games recorded yet. Enter box scores first.</div>
        ) : (
          <>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{fontSize:13,color:"#555"}}>Auto-generated from latest results — <strong>{fmtDate(latestDate)}</strong> · {latestGames.length} game{latestGames.length!==1?"s":""}</div>
              <button type="button" onClick={copy} style={{padding:"10px 22px",background:copied?"#22c55e":"#002d6e",border:"none",borderRadius:8,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,textTransform:"uppercase",cursor:"pointer",transition:"background .2s",flexShrink:0}}>
                {copied?"✓ Copied!":"Copy to Clipboard"}
              </button>
            </div>
            <pre style={{background:"#f8f9fb",border:"1px solid rgba(0,0,0,0.1)",borderRadius:8,padding:"16px",fontSize:12,fontFamily:"'Courier New',monospace",whiteSpace:"pre-wrap",lineHeight:1.8,maxHeight:500,overflowY:"auto"}}>{emailText}</pre>
          </>
        )}
      </div>
    </div>
  );
}

function AdminContentEditor({ onBack }) {
  const [activePage, setActivePage] = useState(PAGE_CONTENT_BLOCKS[0].pageId);
  const [saved, setSaved] = useState(false);
  const flashSaved = () => { setSaved(true); setTimeout(()=>setSaved(false),1500); };
  const page = PAGE_CONTENT_BLOCKS.find(p=>p.pageId===activePage);
  const btn=(bg,color="#fff",extra={})=>({background:bg,color,border:"none",borderRadius:8,padding:"9px 18px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer",...extra});
  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8"}}>
      <PageHero label="Admin" title="Edit Page Content" subtitle="Add formatted text blocks to any page on the site" />
      <div style={{maxWidth:780,margin:"0 auto",padding:"24px clamp(12px,3vw,32px) 80px"}}>
        <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
          <button onClick={onBack} style={btn("rgba(0,0,0,0.08)","#333")}>← Back</button>
          {saved && <span style={{color:"#16a34a",fontWeight:700,fontSize:14}}>✓ Auto-saved!</span>}
          <span style={{fontSize:12,color:"rgba(0,0,0,0.4)",marginLeft:"auto"}}>Changes save automatically as you type.</span>
        </div>

        {/* Page tabs */}
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:20}}>
          {PAGE_CONTENT_BLOCKS.map(p=>(
            <button key={p.pageId} onClick={()=>setActivePage(p.pageId)}
              style={{padding:"7px 14px",borderRadius:20,border:"none",cursor:"pointer",
                fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,
                background:activePage===p.pageId?"#002d6e":"rgba(0,45,110,0.08)",
                color:activePage===p.pageId?"#fff":"#444",transition:"all .15s"}}>
              {p.pageLabel}
            </button>
          ))}
        </div>

        {/* Content blocks for active page */}
        {page && page.blocks.map(block=>(
          <div key={block.id} style={{marginBottom:24}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,textTransform:"uppercase",color:"#111",marginBottom:8,letterSpacing:".04em"}}>
              {block.label}
            </div>
            <RichTextEditor contentId={block.id} placeholder={block.placeholder} />
            <div style={{fontSize:11,color:"rgba(0,0,0,0.35)",marginTop:5}}>
              Saved as: <code style={{fontSize:11}}>lbdc_content_{block.id}</code> · Clears on "Reset Site Data"
            </div>
          </div>
        ))}

        <div style={{background:"rgba(0,45,110,0.05)",borderRadius:10,padding:"14px 16px",fontSize:13,color:"rgba(0,0,0,0.5)",lineHeight:1.6}}>
          💡 <strong>How it works:</strong> Text you add here appears as a formatted block on that page. Leave it empty to hide it. Changes are saved instantly as you type and show immediately on the public site.
        </div>
      </div>
    </div>
  );
}

/* ─── ADMIN SUB-SCREENS ──────────────────────────────────────────────────── */
function AdminRulesEditor({ onBack }) {
  const [rules, setRules] = useState(RULES_DATA);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    sbFetch("lbdc_rules?id=eq.main&select=data")
      .then(rows => { if (rows && rows[0] && rows[0].data) setRules(rows[0].data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);
  const save = async () => { setSaving(true); const r = await safeSave("Rules", () => sbUpsert("lbdc_rules", {id:"main", data:rules})); setSaving(false); if (r.ok) { setSaved(true); setTimeout(()=>setSaved(false),2500); } };
  const reset = async () => { if(!window.confirm("Reset to original default rules? All edits will be lost.")) return; const prev = rules; setRules(RULES_DATA); const r = await safeSave("Rules reset", () => sbUpsert("lbdc_rules", {id:"main", data:RULES_DATA})); if (!r.ok) setRules(prev); };
  const updSection=(si,f,v)=>setRules(p=>p.map((s,i)=>i!==si?s:{...s,[f]:v}));
  const updItem=(si,ii,v)=>setRules(p=>p.map((s,i)=>i!==si?s:{...s,items:s.items.map((x,j)=>j!==ii?x:v)}));
  const delItem=(si,ii)=>setRules(p=>p.map((s,i)=>i!==si?s:{...s,items:s.items.filter((_,j)=>j!==ii)}));
  const addItem=(si)=>setRules(p=>p.map((s,i)=>i!==si?s:{...s,items:[...s.items,"New rule — click to edit"]}));
  const delSection=(si)=>{if(!window.confirm(`Delete section "${rules[si].section}"?`))return;setRules(p=>p.filter((_,i)=>i!==si));};
  const addSection=()=>setRules(p=>[...p,{section:"New Section",icon:"📋",items:["New rule — click to edit"]}]);
  const moveSection=(si,dir)=>{const n=si+dir;if(n<0||n>=rules.length)return;setRules(p=>{const r=[...p];[r[si],r[n]]=[r[n],r[si]];return r;});};
  const btn=(bg,color="#fff",extra={})=>({background:bg,color,border:"none",borderRadius:8,padding:"9px 18px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer",whiteSpace:"nowrap",...extra});
  const inp={fontFamily:"inherit",fontSize:14,border:"1px solid #ddd",borderRadius:6,padding:"6px 10px",width:"100%",boxSizing:"border-box"};
  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8"}}>
      <PageHero label="Admin" title="Edit Rules" subtitle="Update the Field Guide rules page" />
      <div style={{maxWidth:740,margin:"0 auto",padding:"24px clamp(12px,3vw,32px) 80px"}}>
        <div style={{display:"flex",gap:10,marginBottom:24,flexWrap:"wrap",alignItems:"center"}}>
          <button onClick={onBack} style={btn("rgba(0,0,0,0.08)","#333")}>← Back</button>
          <button onClick={save} style={btn(saving?"#6b7280":saved?"#16a34a":"#002d6e")} disabled={saving}>{saving?"Saving…":saved?"✓ Saved!":"💾 Save Changes"}</button>
          <button onClick={reset} style={btn("rgba(220,38,38,0.09)","#dc2626")}>Reset to Default</button>
        </div>
        {loading ? <div style={{textAlign:"center",padding:"40px 0",color:"rgba(0,0,0,0.4)"}}>Loading…</div> : rules.map((sec,si)=>(
          <div key={si} style={{background:"#fff",borderRadius:12,marginBottom:16,border:"1px solid rgba(0,0,0,0.08)",overflow:"hidden"}}>
            <div style={{background:"rgba(0,45,110,0.04)",padding:"12px 16px",borderBottom:"1px solid rgba(0,0,0,0.07)",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <input value={sec.icon} onChange={e=>updSection(si,"icon",e.target.value)} style={{...inp,width:48,textAlign:"center",fontSize:18,padding:"4px 6px"}} />
              <input value={sec.section} onChange={e=>updSection(si,"section",e.target.value)} style={{...inp,flex:1,fontWeight:700,fontSize:16}} placeholder="Section name" />
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <button onClick={()=>moveSection(si,-1)} disabled={si===0} style={btn("rgba(0,0,0,0.07)","#333",{padding:"9px 12px"})}>↑</button>
                <button onClick={()=>moveSection(si,1)} disabled={si===rules.length-1} style={btn("rgba(0,0,0,0.07)","#333",{padding:"9px 12px"})}>↓</button>
                <button onClick={()=>delSection(si)} style={btn("rgba(220,38,38,0.09)","#dc2626",{padding:"9px 12px"})}>🗑️</button>
              </div>
            </div>
            {sec.items.map((item,ii)=>(
              <div key={ii} style={{display:"flex",gap:8,padding:"10px 16px",borderBottom:"1px solid rgba(0,0,0,0.05)",alignItems:"flex-start"}}>
                <span style={{color:"rgba(0,0,0,0.3)",fontSize:12,paddingTop:8,minWidth:20}}>{ii+1}.</span>
                <div style={{flex:1}}><RichTextInput key={`${si}-${ii}`} defaultValue={item} onChange={v=>updItem(si,ii,v)} placeholder="Rule text…" minHeight={50} /></div>
                <button onClick={()=>delItem(si,ii)} style={{background:"none",border:"none",color:"#dc2626",fontSize:18,cursor:"pointer",padding:"6px",flexShrink:0}}>✕</button>
              </div>
            ))}
            <div style={{padding:"10px 16px"}}>
              <button onClick={()=>addItem(si)} style={{background:"none",border:"1px dashed #aaa",borderRadius:6,padding:"6px 14px",fontSize:13,color:"#555",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600}}>+ Add Rule</button>
            </div>
          </div>
        ))}
        <button onClick={addSection} style={{width:"100%",padding:"14px",background:"none",border:"2px dashed #aaa",borderRadius:12,fontSize:15,color:"#555",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700}}>+ Add New Section</button>
        <div style={{position:"sticky",bottom:20,marginTop:24,textAlign:"center"}}>
          <button onClick={save} disabled={saving} style={{...btn(saving?"#6b7280":saved?"#16a34a":"#002d6e"),padding:"13px 40px",fontSize:17,boxShadow:"0 4px 20px rgba(0,45,110,0.35)"}}>
            {saving?"Saving…":saved?"✓ Saved!":"💾 Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminPhotosEditor({ onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoCaption, setVideoCaption] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [captionDrafts, setCaptionDrafts] = useState({}); // id → current input value
  const fileInputRef = useRef();

  const reload = () => sbLoadGallery().then(rows => {
    setItems(rows || []);
    // Seed caption drafts from loaded data
    const drafts = {};
    (rows || []).forEach(r => { drafts[r.id] = r.caption || ""; });
    setCaptionDrafts(drafts);
    setLoading(false);
  });
  useEffect(() => { reload(); }, []);

  const flash = () => { setSaved(true); setTimeout(()=>setSaved(false),2000); };

  const processFiles = async (files) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (!imageFiles.length) { setError("Please select image files (JPG, PNG, HEIC, etc.)"); return; }
    setError(""); setUploading(true);
    setUploadProgress(imageFiles.map(f => ({name:f.name, status:"uploading"})));
    for (let i = 0; i < imageFiles.length; i++) {
      const f = imageFiles[i];
      try {
        const defaultCaption = f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
        await sbUploadPhotoFile(f, defaultCaption);
        setUploadProgress(p => p.map((x,j) => j===i ? {...x,status:"done"} : x));
      } catch(e) {
        setUploadProgress(p => p.map((x,j) => j===i ? {...x,status:"error",msg:e.message} : x));
      }
    }
    await reload();
    setUploading(false);
    flash();
    setTimeout(() => setUploadProgress([]), 3000);
  };

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); processFiles(e.dataTransfer.files); };
  const onDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);
  const onFileInput = (e) => { if (e.target.files?.length) processFiles(e.target.files); e.target.value = ""; };

  const addVideo = async () => {
    if (!videoUrl.trim()) { setError("Please enter a YouTube URL."); return; }
    setError("");
    try { await sbAddVideoLink(videoUrl.trim(), videoCaption.trim()); setVideoUrl(""); setVideoCaption(""); await reload(); flash(); }
    catch(e) { setError("Failed to add video: " + e.message); }
  };

  const delItem = async (item) => {
    if (!window.confirm(`Remove "${item.caption || item.url.slice(0,40)}"?`)) return;
    try { await sbDeleteGalleryItem(item.id, item.url); await reload(); flash(); }
    catch(e) { setError("Delete failed: " + e.message); }
  };

  const updateCaption = async (item, caption) => {
    try {
      // Use upsert (INSERT + ON CONFLICT UPDATE) because the anon key has
      // INSERT but not UPDATE permission on lbdc_gallery (RLS).
      await sbUpsert("lbdc_gallery", { id: item.id, url: item.url, type: item.type, caption });
      setItems(prev => prev.map(x => x.id===item.id ? {...x,caption} : x));
      setCaptionDrafts(prev => ({...prev, [item.id]: caption}));
      flash();
    }
    catch(e) { setError("Caption save failed: " + e.message); }
  };

  const btn=(bg,color="#fff",extra={})=>({background:bg,color,border:"none",borderRadius:8,padding:"9px 18px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer",...extra});
  const inp={fontFamily:"inherit",fontSize:14,border:"1px solid #ddd",borderRadius:6,padding:"8px 12px",width:"100%",boxSizing:"border-box"};

  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8"}}>
      <PageHero label="Admin" title="Manage Photos & Videos" subtitle="Photos are stored in the cloud — visible to all visitors" />
      <div style={{maxWidth:740,margin:"0 auto",padding:"24px clamp(12px,3vw,32px) 80px"}}>
        <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
          <button onClick={onBack} style={btn("rgba(0,0,0,0.08)","#333")}>← Back</button>
          {saved && <span style={{color:"#16a34a",fontWeight:700,fontSize:14}}>✓ Saved!</span>}
        </div>
        {error && <div style={{background:"rgba(220,38,38,0.08)",border:"1px solid rgba(220,38,38,0.2)",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#dc2626"}}>{error}</div>}

        {/* Drag & Drop */}
        <div
          onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
          onClick={()=>!uploading && fileInputRef.current?.click()}
          style={{background:dragOver?"rgba(0,45,110,0.07)":"#fff",border:`2px dashed ${dragOver?"#002d6e":"#bbb"}`,borderRadius:14,padding:"36px 24px",textAlign:"center",cursor:uploading?"default":"pointer",marginBottom:20,transition:"all .15s"}}>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={onFileInput} style={{display:"none"}} />
          {uploading ? (
            <div>
              <div style={{fontSize:28,marginBottom:8}}>⏳</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,color:"#002d6e",marginBottom:12}}>Uploading to cloud…</div>
              {uploadProgress.map((p,i)=>(
                <div key={i} style={{fontSize:13,color:p.status==="done"?"#16a34a":p.status==="error"?"#dc2626":"#888",marginBottom:4}}>
                  {p.status==="done"?"✓ ":p.status==="error"?"✗ ":"⏳ "}{p.name}{p.msg?" — "+p.msg:""}
                </div>
              ))}
            </div>
          ) : (
            <>
              <div style={{fontSize:40,marginBottom:10}}>📸</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,color:"#002d6e",textTransform:"uppercase",marginBottom:6}}>
                {dragOver?"Drop to Upload!":"Drag & Drop Photos Here"}
              </div>
              <div style={{fontSize:13,color:"rgba(0,0,0,0.45)",marginBottom:14}}>or click to browse · JPG, PNG, HEIC · multiple files OK · auto-compressed before upload</div>
              <div style={{display:"inline-block",background:"#002d6e",color:"#fff",borderRadius:8,padding:"10px 24px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15}}>Choose Photos</div>
            </>
          )}
        </div>

        {/* Add Video */}
        <div style={{background:"#fff",borderRadius:12,padding:"18px",marginBottom:24,border:"1px solid rgba(0,0,0,0.08)"}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,textTransform:"uppercase",marginBottom:12}}>🎥 Add YouTube Video</div>
          <div style={{display:"flex",flexDirection:"column",gap:9}}>
            <input value={videoUrl} onChange={e=>setVideoUrl(e.target.value)} placeholder="YouTube URL (e.g. https://youtu.be/...)" style={inp} />
            <input value={videoCaption} onChange={e=>setVideoCaption(e.target.value)} placeholder="Caption (optional)" style={inp} />
            <button onClick={addVideo} style={{...btn("#002d6e"),padding:"10px 22px",alignSelf:"flex-start"}}>+ Add Video</button>
          </div>
        </div>

        {/* Gallery items */}
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,textTransform:"uppercase",color:"rgba(0,0,0,0.4)",letterSpacing:".06em",marginBottom:12}}>
          Gallery ({items.length} item{items.length!==1?"s":""})
        </div>
        {loading ? (
          <div style={{textAlign:"center",padding:"30px",color:"rgba(0,0,0,0.4)"}}>Loading…</div>
        ) : items.length === 0 ? (
          <div style={{textAlign:"center",color:"rgba(0,0,0,0.35)",padding:"32px 0",fontSize:14}}>No photos or videos yet. Upload some above!</div>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}}>
            {items.map((p)=>(
              <div key={p.id} style={{background:"#fff",borderRadius:10,overflow:"hidden",border:"1px solid rgba(0,0,0,0.08)",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
                <div style={{position:"relative"}}>
                  {p.type==="video"
                    ? <div style={{width:"100%",aspectRatio:"4/3",background:"#111",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32}}>▶</div>
                    : <img src={p.url} alt={p.caption||""} style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",display:"block"}} />}
                  <button onClick={()=>delItem(p)} style={{position:"absolute",top:6,right:6,background:"rgba(220,38,38,0.85)",border:"none",color:"#fff",borderRadius:6,width:28,height:28,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                </div>
                <div style={{padding:"8px 10px",display:"flex",gap:5}}>
                  <input
                    value={captionDrafts[p.id] ?? (p.caption||"")}
                    onChange={e => setCaptionDrafts(prev => ({...prev, [p.id]: e.target.value}))}
                    onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();updateCaption(p, captionDrafts[p.id]??"");}}}
                    placeholder="Add caption…"
                    style={{...inp,fontSize:12,padding:"5px 8px",flex:1}} />
                  <button
                    onClick={()=>updateCaption(p, captionDrafts[p.id]??"")}
                    style={{padding:"5px 9px",background:"#002d6e",border:"none",borderRadius:6,color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
                    Save
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminSponsorsEditor({ onBack }) {
  const [sponsors, setSponsors] = useState(SPONSORS_DATA);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({name:"",role:"",description:"",email:"",website:"",featured:false});
  useEffect(() => {
    sbFetch("lbdc_sponsors?id=eq.main&select=data")
      .then(rows => { if (rows && rows[0] && rows[0].data) setSponsors(rows[0].data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);
  const [saveError, setSaveError] = useState("");
  const save = async (arr) => {
    setSaving(true); setSaveError("");
    try { await sbUpsert("lbdc_sponsors", {id:"main", data:arr}); setSaved(true); setTimeout(()=>setSaved(false),2500); }
    catch(e) { setSaveError(e.message || "Save failed"); }
    setSaving(false);
  };
  const reset = async () => { if(!window.confirm("Reset sponsors to default? All edits will be lost.")) return; const prev = sponsors; setSponsors(SPONSORS_DATA); const r = await safeSave("Sponsors reset", () => sbUpsert("lbdc_sponsors", {id:"main", data:SPONSORS_DATA})); if (!r.ok) setSponsors(prev); };
  const upd = (i,f,v) => setSponsors(p=>p.map((s,j)=>j!==i?s:{...s,[f]:v}));
  const del = (i) => { if(!window.confirm(`Remove "${sponsors[i].name}"?`)) return; const u=sponsors.filter((_,j)=>j!==i); setSponsors(u); save(u); };
  const addSponsor = () => {
    if(!form.name.trim()){alert("Name required.");return;}
    const u=[...sponsors,{...form}]; setSponsors(u); save(u);
    setForm({name:"",role:"",description:"",email:"",website:"",featured:false}); setAdding(false);
  };
  const move = (i,dir) => { const n=i+dir; if(n<0||n>=sponsors.length)return; setSponsors(p=>{const r=[...p];[r[i],r[n]]=[r[n],r[i]];return r;}); };
  const btn=(bg,color="#fff",extra={})=>({background:bg,color,border:"none",borderRadius:8,padding:"9px 18px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer",...extra});
  const inp={fontFamily:"inherit",fontSize:14,border:"1px solid #ddd",borderRadius:6,padding:"8px 12px",width:"100%",boxSizing:"border-box"};
  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8"}}>
      <PageHero label="Admin" title="Manage Sponsors" subtitle="Edit all sponsor cards on the Sponsors page" />
      <div style={{maxWidth:740,margin:"0 auto",padding:"24px clamp(12px,3vw,32px) 80px"}}>
        <div style={{display:"flex",gap:10,marginBottom:24,flexWrap:"wrap",alignItems:"center"}}>
          <button onClick={onBack} style={btn("rgba(0,0,0,0.08)","#333")}>← Back</button>
          <button onClick={()=>save(sponsors)} disabled={saving} style={btn(saving?"#6b7280":saved?"#16a34a":"#002d6e")}>{saving?"Saving…":saved?"✓ Saved!":"💾 Save Changes"}</button>
          <button onClick={reset} style={btn("rgba(220,38,38,0.09)","#dc2626")}>Reset to Default</button>
        </div>
        {saveError && <div style={{background:"#fef2f2",border:"1px solid #fecaca",color:"#991b1b",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:14}}><strong>Save failed:</strong> {saveError}</div>}
        {loading ? <div style={{textAlign:"center",padding:"40px 0",color:"rgba(0,0,0,0.4)"}}>Loading…</div> : sponsors.map((sp,i)=>(
          <div key={i} style={{background:"#fff",borderRadius:12,marginBottom:16,border:"1px solid rgba(0,0,0,0.08)",overflow:"hidden",borderTop:`3px solid ${sp.featured?"#FFD700":"#002d6e"}`}}>
            <div style={{background:"rgba(0,0,0,0.02)",padding:"10px 16px",borderBottom:"1px solid rgba(0,0,0,0.07)",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:15,color:"#111",flex:1}}>{sp.name||"Untitled Sponsor"}</span>
              {sp.featured && <span style={{fontSize:11,background:"#FFD700",color:"#111",borderRadius:4,padding:"2px 8px",fontWeight:700}}>FEATURED</span>}
              <label style={{fontSize:12,color:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",gap:4,cursor:"pointer"}}>
                <input type="checkbox" checked={!!sp.featured} onChange={e=>upd(i,"featured",e.target.checked)} /> Featured (dark card)
              </label>
              <button onClick={()=>move(i,-1)} disabled={i===0} style={btn("rgba(0,0,0,0.07)","#333",{padding:"7px 11px"})}>↑</button>
              <button onClick={()=>move(i,1)} disabled={i===sponsors.length-1} style={btn("rgba(0,0,0,0.07)","#333",{padding:"7px 11px"})}>↓</button>
              <button onClick={()=>del(i)} style={btn("rgba(220,38,38,0.08)","#dc2626",{padding:"7px 11px"})}>🗑️</button>
            </div>
            <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:9}}>
              <input value={sp.name} onChange={e=>upd(i,"name",e.target.value)} placeholder="Name *" style={{...inp,fontWeight:700,fontSize:16}} />
              <input value={sp.role||""} onChange={e=>upd(i,"role",e.target.value)} placeholder="Role / title (e.g. Gold Sponsor)" style={inp} />
              <RichTextInput key={`sp-desc-${i}`} defaultValue={sp.description||""} onChange={v=>upd(i,"description",v)} placeholder="Description" minHeight={60} />
              <input value={sp.email||""} onChange={e=>upd(i,"email",e.target.value)} placeholder="Email (optional)" style={inp} />
              <input value={sp.website||""} onChange={e=>upd(i,"website",e.target.value)} placeholder="Website URL (optional)" style={inp} />
            </div>
          </div>
        ))}
        {adding ? (
          <div style={{background:"#fff",borderRadius:12,border:"2px solid #002d6e",padding:"18px 16px",marginBottom:16}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,textTransform:"uppercase",marginBottom:12}}>New Sponsor</div>
            <div style={{display:"flex",flexDirection:"column",gap:9}}>
              <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Name *" style={{...inp,fontWeight:700}} />
              <input value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} placeholder="Role / title" style={inp} />
              <RichTextInput key="new-sp-desc" defaultValue={form.description} onChange={v=>setForm(f=>({...f,description:v}))} placeholder="Description" minHeight={60} />
              <input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="Email (optional)" style={inp} />
              <input value={form.website} onChange={e=>setForm(f=>({...f,website:e.target.value}))} placeholder="Website URL (optional)" style={inp} />
              <label style={{fontSize:13,display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                <input type="checkbox" checked={form.featured} onChange={e=>setForm(f=>({...f,featured:e.target.checked}))} /> Featured card (dark blue style)
              </label>
              <div style={{display:"flex",gap:8}}>
                <button onClick={addSponsor} style={btn("#002d6e")}>+ Add Sponsor</button>
                <button onClick={()=>setAdding(false)} style={btn("rgba(0,0,0,0.08)","#333")}>Cancel</button>
              </div>
            </div>
          </div>
        ) : (
          <button onClick={()=>setAdding(true)} style={{width:"100%",padding:"14px",background:"none",border:"2px dashed #aaa",borderRadius:12,fontSize:15,color:"#555",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700}}>+ Add New Sponsor</button>
        )}
        <div style={{position:"sticky",bottom:20,marginTop:24,textAlign:"center"}}>
          <button onClick={()=>save(sponsors)} disabled={saving} style={{...btn(saving?"#6b7280":saved?"#16a34a":"#002d6e"),padding:"13px 40px",fontSize:17,boxShadow:"0 4px 20px rgba(0,45,110,0.35)"}}>
            {saving?"Saving…":saved?"✓ Saved!":"💾 Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminFieldsEditor({ onBack }) {
  const [fields, setFields] = useState(FIELDS_INFO);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  useEffect(() => {
    sbFetch("lbdc_fields?id=eq.main&select=data")
      .then(rows => { if (rows && rows[0] && rows[0].data) setFields(rows[0].data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);
  const save = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await sbUpsert("lbdc_fields", {id:"main", data:fields});
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError(err.message || "Save failed");
    }
    setSaving(false);
  };
  const reset = async () => {
    if (!window.confirm("Reset to original field info?")) return;
    const prev = fields;
    setFields(FIELDS_INFO);
    const r = await safeSave("Fields reset", () => sbUpsert("lbdc_fields", {id:"main", data:FIELDS_INFO}));
    if (!r.ok) setFields(prev);
  };
  const updField=(fi,f,v)=>setFields(p=>p.map((x,i)=>i!==fi?x:{...x,[f]:v}));
  const updNote=(fi,ni,v)=>setFields(p=>p.map((x,i)=>i!==fi?x:{...x,notes:x.notes.map((n,j)=>j!==ni?n:v)}));
  const delNote=(fi,ni)=>setFields(p=>p.map((x,i)=>i!==fi?x:{...x,notes:x.notes.filter((_,j)=>j!==ni)}));
  const addNote=(fi)=>setFields(p=>p.map((x,i)=>i!==fi?x:{...x,notes:[...x.notes,"New note — click to edit"]}));
  const addField=()=>setFields(p=>[...p,{name:"New Field",location:"City, ST",address:"",mapsUrl:"",appleMapsUrl:"",notes:[],color:"#002d6e"}]);
  const delField=(fi)=>{ if(!window.confirm(`Delete field "${fields[fi].name}"?`)) return; setFields(p=>p.filter((_,i)=>i!==fi)); };
  const moveField=(fi,dir)=>setFields(p=>{ const n=[...p]; const j=fi+dir; if(j<0||j>=n.length) return p; [n[fi],n[j]]=[n[j],n[fi]]; return n; });
  const btn=(bg,color="#fff")=>({background:bg,color,border:"none",borderRadius:8,padding:"9px 18px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer"});
  const inp={fontFamily:"inherit",fontSize:14,border:"1px solid #ddd",borderRadius:6,padding:"8px 12px",width:"100%",boxSizing:"border-box"};
  const COLOR_CHOICES = ["#002d6e","#1d4ed8","#7c3aed","#c8102e","#b45309","#16a34a","#0891b2","#db2777","#111"];
  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8"}}>
      <PageHero label="Admin" title="Edit Field Directions" subtitle="Update field notes, addresses, and directions" />
      <div style={{maxWidth:740,margin:"0 auto",padding:"24px clamp(12px,3vw,32px) 80px"}}>
        <div style={{display:"flex",gap:10,marginBottom:24,flexWrap:"wrap",alignItems:"center"}}>
          <button onClick={onBack} style={btn("rgba(0,0,0,0.08)","#333")}>← Back</button>
          <button onClick={save} disabled={saving} style={btn(saving?"#6b7280":saved?"#16a34a":"#002d6e")}>{saving?"Saving…":saved?"✓ Saved!":"💾 Save Changes"}</button>
          <button onClick={reset} style={btn("rgba(220,38,38,0.09)","#dc2626")}>Reset to Default</button>
        </div>
        {saveError && (
          <div style={{background:"#fef2f2",border:"1px solid #fecaca",color:"#991b1b",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:14}}>
            <strong>Save failed:</strong> {saveError}
          </div>
        )}
        {loading ? <div style={{textAlign:"center",padding:"40px 0",color:"rgba(0,0,0,0.4)"}}>Loading…</div> : fields.map((field,fi)=>(
          <div key={fi} style={{background:"#fff",borderRadius:12,marginBottom:20,border:"1px solid rgba(0,0,0,0.08)",overflow:"hidden",borderTop:`3px solid ${field.color}`}}>
            <div style={{padding:"14px 18px",borderBottom:"1px solid rgba(0,0,0,0.07)",background:"rgba(0,0,0,0.02)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <button type="button" onClick={()=>moveField(fi,-1)} disabled={fi===0} style={{padding:"4px 8px",background:"rgba(0,0,0,0.05)",border:"1px solid rgba(0,0,0,0.1)",borderRadius:5,cursor:fi===0?"default":"pointer",fontSize:12,opacity:fi===0?0.3:1}}>↑</button>
                  <button type="button" onClick={()=>moveField(fi,1)} disabled={fi===fields.length-1} style={{padding:"4px 8px",background:"rgba(0,0,0,0.05)",border:"1px solid rgba(0,0,0,0.1)",borderRadius:5,cursor:fi===fields.length-1?"default":"pointer",fontSize:12,opacity:fi===fields.length-1?0.3:1}}>↓</button>
                </div>
                <button type="button" onClick={()=>delField(fi)} style={{padding:"5px 12px",background:"rgba(220,38,38,0.08)",border:"1px solid rgba(220,38,38,0.2)",borderRadius:6,color:"#dc2626",fontWeight:700,fontSize:12,cursor:"pointer"}}>Delete Field</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:8,marginBottom:8}}>
                <div>
                  <label style={{fontSize:10,fontWeight:700,color:"#888",textTransform:"uppercase",display:"block",marginBottom:2}}>Field Name</label>
                  <input value={field.name||""} onChange={e=>updField(fi,"name",e.target.value)} placeholder="e.g. Clark Field" style={{...inp,fontWeight:700,fontSize:16}} />
                </div>
                <div>
                  <label style={{fontSize:10,fontWeight:700,color:"#888",textTransform:"uppercase",display:"block",marginBottom:2}}>City</label>
                  <input value={field.location||""} onChange={e=>updField(fi,"location",e.target.value)} placeholder="e.g. Long Beach, CA" style={inp} />
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <div>
                  <label style={{fontSize:10,fontWeight:700,color:"#888",textTransform:"uppercase",display:"block",marginBottom:2}}>Address</label>
                  <RichTextInput key={`addr-${fi}`} defaultValue={field.address} onChange={v=>updField(fi,"address",v)} placeholder="Street address" minHeight={38} />
                </div>
                <div>
                  <label style={{fontSize:10,fontWeight:700,color:"#888",textTransform:"uppercase",display:"block",marginBottom:2}}>Google Maps URL</label>
                  <input value={field.mapsUrl||""} onChange={e=>updField(fi,"mapsUrl",e.target.value)} placeholder="https://maps.google.com/..." style={inp} />
                </div>
                <div>
                  <label style={{fontSize:10,fontWeight:700,color:"#888",textTransform:"uppercase",display:"block",marginBottom:2}}>Apple Maps URL</label>
                  <input value={field.appleMapsUrl||""} onChange={e=>updField(fi,"appleMapsUrl",e.target.value)} placeholder="https://maps.apple.com/..." style={inp} />
                </div>
                <div>
                  <label style={{fontSize:10,fontWeight:700,color:"#888",textTransform:"uppercase",display:"block",marginBottom:4}}>Accent Color</label>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                    {COLOR_CHOICES.map(c=>(
                      <button key={c} type="button" onClick={()=>updField(fi,"color",c)} title={c} style={{width:26,height:26,borderRadius:"50%",background:c,border:field.color===c?"3px solid #111":"2px solid rgba(0,0,0,0.1)",cursor:"pointer",padding:0}} />
                    ))}
                    <input value={field.color||""} onChange={e=>updField(fi,"color",e.target.value)} placeholder="#rrggbb" style={{...inp,width:110,padding:"6px 8px",fontSize:12}} />
                  </div>
                </div>
              </div>
            </div>
            <div style={{padding:"14px 18px"}}>
              <div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:"rgba(0,0,0,0.4)",marginBottom:10}}>Field Notes & Parking</div>
              {(field.notes||[]).map((note,ni)=>(
                <div key={ni} style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-start"}}>
                  <div style={{flex:1}}><RichTextInput key={`field-${fi}-${ni}`} defaultValue={note} onChange={v=>updNote(fi,ni,v)} placeholder="Field note…" minHeight={50} /></div>
                  <button onClick={()=>delNote(fi,ni)} style={{background:"none",border:"none",color:"#dc2626",fontSize:18,cursor:"pointer",padding:"6px",flexShrink:0}}>✕</button>
                </div>
              ))}
              <button onClick={()=>addNote(fi)} style={{background:"none",border:"1px dashed #aaa",borderRadius:6,padding:"6px 14px",fontSize:13,color:"#555",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600}}>+ Add Note</button>
            </div>
          </div>
        ))}
        {!loading && (
          <button type="button" onClick={addField} style={{width:"100%",background:"#fff",border:"2px dashed #002d6e",borderRadius:12,padding:"18px",color:"#002d6e",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,textTransform:"uppercase",letterSpacing:".06em",cursor:"pointer",marginBottom:16}}>
            + Add New Field
          </button>
        )}
        <div style={{position:"sticky",bottom:20,marginTop:8,textAlign:"center"}}>
          <button onClick={save} disabled={saving} style={{...btn(saving?"#6b7280":saved?"#16a34a":"#002d6e"),padding:"13px 40px",fontSize:17,boxShadow:"0 4px 20px rgba(0,45,110,0.35)"}}>
            {saving?"Saving…":saved?"✓ Saved!":"💾 Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── ADMIN CONTACT EDITOR ───────────────────────────────────────────────── */
function AdminContactEditor({ onBack }) {
  const [info, setInfo] = useState(CONTACT_INFO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    sbFetch("lbdc_contact?id=eq.main&select=data")
      .then(rows => {
        if (rows && rows[0] && rows[0].data) setInfo({...CONTACT_INFO, ...rows[0].data});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const upd = (k, v) => setInfo(p => ({...p, [k]: v}));

  const save = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await sbUpsert("lbdc_contact", {id:"main", data: info});
      _setContactCache(info);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError(err.message || "Save failed");
    }
    setSaving(false);
  };

  const reset = async () => {
    if (!window.confirm("Reset contact info to defaults?")) return;
    try {
      await sbUpsert("lbdc_contact", {id:"main", data: CONTACT_INFO});
      _setContactCache(CONTACT_INFO);
      setInfo(CONTACT_INFO);
    } catch(e) {}
  };

  const inp = {fontFamily:"inherit",fontSize:14,border:"1px solid #ddd",borderRadius:6,padding:"9px 12px",width:"100%",boxSizing:"border-box"};
  const lbl = {fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase",display:"block",marginBottom:4,letterSpacing:".04em"};
  const btn = (bg,color="#fff") => ({background:bg,color,border:"none",borderRadius:8,padding:"9px 18px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer"});
  const sectionWrap = {background:"#fff",borderRadius:12,marginBottom:18,border:"1px solid rgba(0,0,0,0.08)",overflow:"hidden"};
  const sectionHead = (title,sub) => (
    <div style={{padding:"14px 18px",borderBottom:"1px solid rgba(0,0,0,0.07)",background:"rgba(0,45,110,0.04)"}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,color:"#002d6e",textTransform:"uppercase",letterSpacing:".04em"}}>{title}</div>
      {sub && <div style={{fontSize:12,color:"rgba(0,0,0,0.5)",marginTop:2}}>{sub}</div>}
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8"}}>
      <PageHero label="Admin" title="Contact Information" subtitle="Email, phone, Venmo, and credits — used across the public site" />
      <div style={{maxWidth:740,margin:"0 auto",padding:"24px clamp(12px,3vw,32px) 80px"}}>
        <div style={{display:"flex",gap:10,marginBottom:24,flexWrap:"wrap",alignItems:"center"}}>
          <button type="button" onClick={onBack} style={btn("rgba(0,0,0,0.08)","#333")}>← Back</button>
          <button type="button" onClick={save} disabled={saving} style={btn(saving?"#6b7280":saved?"#16a34a":"#002d6e")}>{saving?"Saving…":saved?"✓ Saved!":"💾 Save Changes"}</button>
          <button type="button" onClick={reset} style={btn("rgba(220,38,38,0.09)","#dc2626")}>Reset to Default</button>
        </div>
        {saveError && (
          <div style={{background:"#fef2f2",border:"1px solid #fecaca",color:"#991b1b",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:14}}>
            <strong>Save failed:</strong> {saveError}
          </div>
        )}
        {loading ? <div style={{textAlign:"center",padding:"40px 0",color:"rgba(0,0,0,0.4)"}}>Loading…</div> : (
          <>
            {/* Commissioner */}
            <div style={sectionWrap}>
              {sectionHead("League Commissioner","Shown on Contact page, Payments page, Field Directions footer.")}
              <div style={{padding:"16px 18px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div style={{gridColumn:"1 / -1"}}>
                  <label style={lbl}>Title</label>
                  <input value={info.commissionerTitle||""} onChange={e=>upd("commissionerTitle",e.target.value)} placeholder="League Commissioner" style={inp} />
                </div>
                <div style={{gridColumn:"1 / -1"}}>
                  <label style={lbl}>Name</label>
                  <input value={info.commissionerName||""} onChange={e=>upd("commissionerName",e.target.value)} placeholder="Daniel Gutierrez" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Email</label>
                  <input value={info.commissionerEmail||""} onChange={e=>upd("commissionerEmail",e.target.value)} placeholder="dgutierrez22@yahoo.com" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Phone / Cell</label>
                  <input value={info.commissionerPhone||""} onChange={e=>upd("commissionerPhone",e.target.value)} placeholder="(626) 722-2938" style={inp} />
                  <div style={{fontSize:11,color:"#888",marginTop:3}}>Format anything — digits are auto-extracted for tap-to-call.</div>
                </div>
              </div>
            </div>

            {/* Payments */}
            <div style={sectionWrap}>
              {sectionHead("Payment Handles","Used on Payments page and Contact page.")}
              <div style={{padding:"16px 18px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div>
                  <label style={lbl}>Venmo Handle</label>
                  <input value={info.venmoHandle||""} onChange={e=>upd("venmoHandle",e.target.value)} placeholder="@Titans-baseball" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Zelle Note</label>
                  <input value={info.zelleNote||""} onChange={e=>upd("zelleNote",e.target.value)} placeholder="Send to cell number above" style={inp} />
                </div>
                <div style={{gridColumn:"1 / -1"}}>
                  <label style={lbl}>Venmo QR Image URL</label>
                  <input value={info.venmoQrUrl||""} onChange={e=>upd("venmoQrUrl",e.target.value)} placeholder="/qr-code.png or https://..." style={inp} />
                  <div style={{fontSize:11,color:"#888",marginTop:3}}>Path to the QR image. Default: <code>/qr-code.png</code> (place file in <code>public/</code>). Leave blank to hide the QR.</div>
                  {info.venmoQrUrl && (
                    <div style={{marginTop:10,padding:"10px",background:"rgba(0,138,255,0.05)",border:"1px solid rgba(0,138,255,0.15)",borderRadius:8,display:"inline-block"}}>
                      <img src={info.venmoQrUrl} alt="Venmo QR preview" onError={e=>{e.currentTarget.style.opacity=0.2;e.currentTarget.title="Image not found";}} style={{width:120,height:120,objectFit:"contain",display:"block",background:"#fff",borderRadius:6}} />
                      <div style={{fontSize:10,color:"#888",marginTop:4,textAlign:"center"}}>Preview</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Designer / credits */}
            <div style={sectionWrap}>
              {sectionHead("Site Credit","Shown in the blue \"Love this site?\" card on the Contact page.")}
              <div style={{padding:"16px 18px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div style={{gridColumn:"1 / -1"}}>
                  <label style={lbl}>Designer Name</label>
                  <input value={info.designerName||""} onChange={e=>upd("designerName",e.target.value)} placeholder="Adam — Mainline Web Design" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Designer Email</label>
                  <input value={info.designerEmail||""} onChange={e=>upd("designerEmail",e.target.value)} placeholder="adam.mainlinewebdesign@gmail.com" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Designer Website</label>
                  <input value={info.designerWebsite||""} onChange={e=>upd("designerWebsite",e.target.value)} placeholder="https://mainline-webdesign.com/" style={inp} />
                </div>
              </div>
            </div>
          </>
        )}
        <div style={{position:"sticky",bottom:20,marginTop:8,textAlign:"center"}}>
          <button type="button" onClick={save} disabled={saving} style={{...btn(saving?"#6b7280":saved?"#16a34a":"#002d6e"),padding:"13px 40px",fontSize:17,boxShadow:"0 4px 20px rgba(0,45,110,0.35)"}}>
            {saving?"Saving…":saved?"✓ Saved!":"💾 Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── MANAGE TEAMS PAGE ──────────────────────────────────────────────────── */
function ManageTeamsPage({ onBack }) {
  const builtIn = Object.keys(TEAM_ROSTERS);
  const [extraTeams, setExtraTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  const loadExtra = async () => {
    setLoading(true);
    try {
      const rows = await sbFetch("lbdc_schedules?id=eq.teams&select=data");
      setExtraTeams(rows && rows[0] && Array.isArray(rows[0].data) ? rows[0].data : []);
    } catch(e) { setExtraTeams([]); }
    setLoading(false);
  };

  const saveExtra = async (list) => {
    await sbUpsert("lbdc_schedules", { id: "teams", data: list });
  };

  useEffect(() => { loadExtra(); }, []);

  const addTeam = async () => {
    const name = newName.trim();
    if (!name) return;
    if (builtIn.includes(name) || extraTeams.includes(name)) {
      setError(`"${name}" already exists.`); return;
    }
    setSaving(true); setError(null); setMsg(null);
    try {
      const updated = [...extraTeams, name];
      await saveExtra(updated);
      setExtraTeams(updated);
      setNewName("");
      setMsg(`"${name}" added! You can now add players in Manage Rosters.`);
    } catch(e) { setError("Save failed: " + e.message); }
    setSaving(false);
  };

  const removeTeam = async (name) => {
    if (!window.confirm(`Remove team "${name}"? This won't delete their players — just the team from dropdowns.`)) return;
    setSaving(true); setMsg(null); setError(null);
    try {
      const updated = extraTeams.filter(t => t !== name);
      await saveExtra(updated);
      setExtraTeams(updated);
    } catch(e) { setError("Save failed: " + e.message); }
    setSaving(false);
  };

  return (
    <div style={{background:"#f4f6fb",minHeight:"100vh"}}>
      <div style={{background:"#002d6e",padding:"16px 24px",display:"flex",alignItems:"center",gap:14}}>
        <button onClick={onBack} style={{padding:"6px 14px",background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:6,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>← Back</button>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,color:"#fff",textTransform:"uppercase",letterSpacing:".04em"}}>⚾ Manage Teams</div>
      </div>
      <div style={{maxWidth:700,margin:"0 auto",padding:"24px clamp(12px,3vw,32px)"}}>
        {/* Add new team */}
        <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderTop:"3px solid #002d6e",borderRadius:12,padding:"20px",marginBottom:20}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,textTransform:"uppercase",marginBottom:4}}>Add a New Team</div>
          <div style={{fontSize:13,color:"rgba(0,0,0,0.45)",marginBottom:14}}>Use this to add tournament teams or any team not in the built-in list. Once added, you can manage their roster and use them in box scores.</div>
          {error && <div style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:8,padding:"10px 14px",marginBottom:12,color:"#dc2626",fontWeight:600,fontSize:13}}>{error}</div>}
          {msg && <div style={{background:"#dcfce7",border:"1px solid #86efac",borderRadius:8,padding:"10px 14px",marginBottom:12,color:"#16a34a",fontWeight:600,fontSize:13}}>{msg}</div>}
          <div style={{display:"flex",gap:8}}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addTeam()}
              placeholder="e.g. Tournament Team A"
              style={{flex:1,padding:"10px 14px",border:"1px solid #ddd",borderRadius:8,fontSize:15,fontFamily:"inherit",outline:"none"}}
            />
            <button onClick={addTeam} disabled={saving || !newName.trim()}
              style={{padding:"10px 22px",background:"#002d6e",border:"none",borderRadius:8,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,cursor:"pointer",opacity:saving||!newName.trim()?0.5:1}}>
              {saving ? "Saving…" : "+ Add Team"}
            </button>
          </div>
        </div>

        {/* Team list */}
        <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:12,overflow:"hidden"}}>
          <div style={{padding:"14px 20px",borderBottom:"1px solid rgba(0,0,0,0.07)",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,textTransform:"uppercase",color:"#111"}}>
            All Teams ({builtIn.length + extraTeams.length})
          </div>
          {loading ? (
            <div style={{padding:"32px",textAlign:"center",color:"rgba(0,0,0,0.4)"}}>Loading…</div>
          ) : (
            <div>
              {/* Built-in */}
              {builtIn.map(t => (
                <div key={t} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 20px",borderBottom:"1px solid rgba(0,0,0,0.05)"}}>
                  <TLogo name={t} size={28}/>
                  <span style={{flex:1,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,textTransform:"uppercase"}}>{t}</span>
                  <span style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"rgba(0,0,0,0.3)",background:"rgba(0,0,0,0.06)",padding:"2px 8px",borderRadius:10}}>Built-in</span>
                </div>
              ))}
              {/* Extra / tournament teams */}
              {extraTeams.map(t => (
                <div key={t} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 20px",borderBottom:"1px solid rgba(0,0,0,0.05)"}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:"#002d6e",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12,fontWeight:900,flexShrink:0}}>{t.charAt(0)}</div>
                  <span style={{flex:1,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,textTransform:"uppercase"}}>{t}</span>
                  <span style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#b45309",background:"rgba(180,83,9,0.08)",padding:"2px 8px",borderRadius:10}}>Tournament</span>
                  <button onClick={() => removeTeam(t)} disabled={saving}
                    style={{padding:"5px 12px",background:"rgba(220,38,38,0.08)",border:"1px solid rgba(220,38,38,0.2)",borderRadius:6,color:"#dc2626",fontWeight:700,fontSize:12,cursor:"pointer"}}>
                    Remove
                  </button>
                </div>
              ))}
              {extraTeams.length === 0 && (
                <div style={{padding:"20px",textAlign:"center",color:"rgba(0,0,0,0.35)",fontStyle:"italic",fontSize:13}}>No tournament teams yet. Use the form above to add one.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── ADMIN ROSTERS EDITOR ───────────────────────────────────────────────── */
function AdminRostersEditor({ onBack }) {
  const builtInKeys = Object.keys(TEAM_ROSTERS);
  const [allTeamKeys, setAllTeamKeys] = useState(builtInKeys);
  const [rosters, setRosters] = useState({});
  const [loading, setLoading] = useState(true);
  const [editTeam, setEditTeam] = useState(builtInKeys[0] || "");
  const [editId, setEditId] = useState(null); // Supabase id of the player being edited, or -1 for new
  const [editForm, setEditForm] = useState({number:"",name:""});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Load all players from Supabase on mount (also loads extra/tournament teams)
  useEffect(() => {
    setLoading(true);
    Promise.all([
      sbFetch("lbdc_rosters?select=*&order=team.asc,id.asc"),
      sbFetch("lbdc_schedules?id=eq.teams&select=data"),
    ]).then(([rows, schedRows]) => {
      // Merge extra tournament teams with built-in list
      const extra = schedRows && schedRows[0] && Array.isArray(schedRows[0].data) ? schedRows[0].data : [];
      const combinedKeys = [...builtInKeys, ...extra.filter(t => !builtInKeys.includes(t))];
      setAllTeamKeys(combinedKeys);
      // Build rosters object keyed by team
      const built = {};
      combinedKeys.forEach(t => { built[t] = []; });
      (rows || []).forEach(r => {
        if (!built[r.team]) built[r.team] = [];
        built[r.team].push({id: r.id, number: r.number || "", name: r.name || ""});
      });
      setRosters(built);
      setLoading(false);
    }).catch(() => {
      // Fall back to hardcoded on error
      setRosters(getEffectiveRosters());
      setError("Could not load rosters from server. Showing local fallback.");
      setLoading(false);
    });
  }, []);

  const teamPlayers = rosters[editTeam] || [];

  const startEdit = (idx) => {
    const p = teamPlayers[idx];
    setEditId(p.id);
    setEditForm({number: p.number || "", name: p.name || ""});
  };
  const startNew = () => { setEditId(-1); setEditForm({number:"",name:""}); };
  const cancelEdit = () => { setEditId(null); setEditForm({number:"",name:""}); };

  const savePlayer = async () => {
    if (!editForm.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      if (editId === -1) {
        // New player
        const rows = await sbPost("lbdc_rosters", {team: editTeam, number: editForm.number.trim(), name: editForm.name.trim()});
        const newPlayer = {id: rows[0].id, number: editForm.number.trim(), name: editForm.name.trim()};
        setRosters(r => ({...r, [editTeam]: [...(r[editTeam]||[]), newPlayer]}));
      } else {
        // Update existing
        await sbPatch(`lbdc_rosters?id=eq.${editId}`, {number: editForm.number.trim(), name: editForm.name.trim()});
        setRosters(r => ({
          ...r,
          [editTeam]: (r[editTeam]||[]).map(p => p.id === editId ? {...p, number: editForm.number.trim(), name: editForm.name.trim()} : p)
        }));
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      cancelEdit();
    } catch(e) {
      setError("Failed to save player. Please try again.");
    }
    setSaving(false);
  };

  const deletePlayer = async (idx) => {
    const p = teamPlayers[idx];
    if (!window.confirm(`Remove ${p?.name}?`)) return;
    setSaving(true);
    setError("");
    try {
      await sbDelete(`lbdc_rosters?id=eq.${p.id}`);
      setRosters(r => ({...r, [editTeam]: (r[editTeam]||[]).filter((_,i)=>i!==idx)}));
    } catch(e) {
      setError("Failed to delete player. Please try again.");
    }
    setSaving(false);
  };

  const movePlayer = (idx, dir) => {
    const players = [...(rosters[editTeam]||[])];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= players.length) return;
    [players[idx], players[newIdx]] = [players[newIdx], players[idx]];
    setRosters(r => ({...r, [editTeam]: players}));
  };

  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8"}}>
      <div style={{background:"#001a3e",borderBottom:"3px solid #002d6e",padding:"16px clamp(12px,3vw,32px)"}}>
        <div style={{maxWidth:1000,margin:"0 auto",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <button onClick={onBack} style={{padding:"8px 16px",background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:8,color:"#fff",fontSize:14,cursor:"pointer",fontWeight:700}}>← Back</button>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:"clamp(16px,4vw,22px)",color:"#fff",textTransform:"uppercase"}}>⚾ Manage Team Rosters</div>
        </div>
      </div>
      <div style={{maxWidth:1000,margin:"0 auto",padding:"24px clamp(12px,3vw,32px) 60px"}}>
        {error && <div style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:8,padding:"10px 16px",marginBottom:16,color:"#dc2626",fontWeight:600,fontSize:13}}>{error}</div>}
        {loading ? (
          <div style={{textAlign:"center",padding:"48px",color:"rgba(0,0,0,0.4)",fontSize:15}}>Loading rosters…</div>
        ) : (
          <>
            <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:10,padding:"12px 14px",marginBottom:20,display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,textTransform:"uppercase",color:"rgba(0,0,0,0.45)",marginRight:4}}>Team:</span>
              {allTeamKeys.map(t => (
                <button key={t} onClick={()=>{setEditTeam(t);setEditId(null);}}
                  style={{padding:"6px 14px",borderRadius:20,border:`1.5px solid ${editTeam===t?"#002d6e":"rgba(0,0,0,0.15)"}`,background:editTeam===t?"#002d6e":"#fff",color:editTeam===t?"#fff":"#333",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",transition:"all .15s"}}>
                  {t}
                </button>
              ))}
            </div>
            <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderTop:"3px solid #002d6e",borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"14px 20px",borderBottom:"1px solid rgba(0,0,0,0.07)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,textTransform:"uppercase"}}>{editTeam} — {teamPlayers.length} players</div>
                <button onClick={startNew} style={{padding:"8px 18px",background:"#002d6e",border:"none",borderRadius:8,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer"}}>+ Add Player</button>
              </div>
              {editId !== null && (
                <div style={{padding:"16px 20px",background:"#f0f4ff",borderBottom:"1px solid rgba(0,0,0,0.07)"}}>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,textTransform:"uppercase",marginBottom:12,color:"#002d6e"}}>{editId===-1?"Add New Player":"Edit Player"}</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end"}}>
                    <div>
                      <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"rgba(0,0,0,0.4)",marginBottom:4}}>Jersey #</div>
                      <input value={editForm.number} onChange={e=>setEditForm(f=>({...f,number:e.target.value}))} placeholder="#" style={{width:70,padding:"9px 12px",border:"1px solid rgba(0,0,0,0.15)",borderRadius:8,fontSize:15,outline:"none"}} />
                    </div>
                    <div style={{flex:1,minWidth:200}}>
                      <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"rgba(0,0,0,0.4)",marginBottom:4}}>Player Name *</div>
                      <input value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))} placeholder="First Last" style={{width:"100%",padding:"9px 12px",border:"1px solid rgba(0,0,0,0.15)",borderRadius:8,fontSize:15,outline:"none",boxSizing:"border-box"}} />
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={savePlayer} disabled={saving} style={{padding:"9px 20px",background:"#16a34a",border:"none",borderRadius:8,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",opacity:saving?.6:1}}>
                        {saving?"Saving…":"Save"}
                      </button>
                      <button onClick={cancelEdit} disabled={saving} style={{padding:"9px 20px",background:"rgba(0,0,0,0.1)",border:"none",borderRadius:8,fontWeight:700,fontSize:14,cursor:"pointer"}}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
              {teamPlayers.length === 0 ? (
                <div style={{padding:"32px",textAlign:"center",color:"rgba(0,0,0,0.4)",fontStyle:"italic"}}>No players yet. Click "+ Add Player" to get started.</div>
              ) : (
                <div>
                  {teamPlayers.map((p,i) => (
                    <div key={p.id ?? i} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderBottom:"1px solid rgba(0,0,0,0.05)",background:editId===p.id?"#f0f4ff":"transparent",flexWrap:"wrap"}}>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,color:"rgba(0,0,0,0.3)",width:28,textAlign:"right",flexShrink:0}}>#{p.number||"—"}</span>
                      <span style={{flex:1,minWidth:120,fontWeight:600,fontSize:15}}>{p.name}</span>
                      <div style={{display:"flex",gap:5,flexShrink:0,flexWrap:"wrap"}}>
                        <button onClick={()=>movePlayer(i,-1)} disabled={i===0} style={{padding:"6px 10px",background:"rgba(0,0,0,0.07)",border:"none",borderRadius:6,cursor:i===0?"not-allowed":"pointer",opacity:i===0?.3:1,fontSize:14}}>↑</button>
                        <button onClick={()=>movePlayer(i,1)} disabled={i===teamPlayers.length-1} style={{padding:"6px 10px",background:"rgba(0,0,0,0.07)",border:"none",borderRadius:6,cursor:i===teamPlayers.length-1?"not-allowed":"pointer",opacity:i===teamPlayers.length-1?.3:1,fontSize:14}}>↓</button>
                        <button onClick={()=>startEdit(i)} style={{padding:"6px 14px",background:"rgba(0,45,110,0.08)",border:"1px solid rgba(0,45,110,0.2)",borderRadius:6,color:"#002d6e",fontWeight:700,fontSize:13,cursor:"pointer"}}>Edit</button>
                        <button onClick={()=>deletePlayer(i)} disabled={saving} style={{padding:"6px 14px",background:"rgba(220,38,38,0.08)",border:"1px solid rgba(220,38,38,0.2)",borderRadius:6,color:"#dc2626",fontWeight:700,fontSize:13,cursor:"pointer"}}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{padding:"14px 20px",borderTop:"1px solid rgba(0,0,0,0.07)",display:"flex",justifyContent:"flex-end"}}>
                {saved && <span style={{color:"#16a34a",fontWeight:700,fontSize:13,marginRight:12}}>✓ Saved!</span>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── ADMIN SIGNUPS VIEWER ───────────────────────────────────────────────── */
function AdminSignupsViewer({ onBack }) {
  const [signups, setSignups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTeam, setActiveTeam] = useState("All");
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    sbFetch("lbdc_signups?select=*&order=created_at.desc")
      .then(data => { setSignups(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const deleteSignup = async (s) => {
    if (!window.confirm(`Delete sign-up for ${s.name}? This will also remove them from the roster.`)) return;
    setDeleting(s.id);
    try {
      await sbDelete(`lbdc_signups?id=eq.${s.id}`);
      // Also remove from roster (match by name + team)
      const enc = encodeURIComponent(s.name);
      const encTeam = encodeURIComponent(s.team);
      await sbDelete(`lbdc_rosters?name=ilike.${enc}&team=eq.${encTeam}`);
      setSignups(prev => prev.filter(x => x.id !== s.id));
    } catch(e) { alert("Error deleting."); }
    setDeleting(null);
  };

  const teams = ["All", ...Array.from(new Set(signups.map(s=>s.team).filter(Boolean))).sort()];
  const filtered = activeTeam === "All" ? signups : signups.filter(s => s.team === activeTeam);

  const badge = (label, val) => val ? (
    <span style={{background:"#e0f2fe",color:"#0369a1",fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:20,whiteSpace:"nowrap"}}>{label}</span>
  ) : null;

  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8"}}>
      <PageHero label="Admin" title="Player Sign-Ups" subtitle={`${signups.length} total submission${signups.length!==1?"s":""}`} />
      <div style={{maxWidth:860,margin:"0 auto",padding:"24px clamp(12px,3vw,32px) 80px"}}>
        <div style={{marginBottom:20}}>
          <button onClick={onBack} style={{background:"rgba(0,0,0,0.08)",border:"none",borderRadius:8,padding:"9px 18px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer",color:"#333",marginBottom:16}}>← Back</button>
          {/* Team tabs */}
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {teams.map(team => {
              const count = team === "All" ? signups.length : signups.filter(s=>s.team===team).length;
              const active = activeTeam === team;
              return (
                <button key={team} onClick={()=>setActiveTeam(team)} style={{
                  padding:"7px 14px",border:"none",borderRadius:20,cursor:"pointer",
                  fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,
                  background: active ? "#002d6e" : "#fff",
                  color: active ? "#fff" : "#444",
                  boxShadow: active ? "0 2px 8px rgba(0,45,110,0.25)" : "0 1px 3px rgba(0,0,0,0.1)",
                  transition:"all .15s"
                }}>
                  {team} <span style={{opacity:.7,fontWeight:400}}>({count})</span>
                </button>
              );
            })}
          </div>
        </div>
        {loading ? (
          <div style={{textAlign:"center",padding:40,color:"#aaa"}}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{textAlign:"center",padding:40,color:"#aaa",fontSize:15}}>No sign-ups yet.</div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {filtered.map((s,i) => (
              <div key={s.id||i} style={{background:"#fff",borderRadius:12,border:"1px solid rgba(0,0,0,0.08)",borderLeft:"4px solid #002d6e",padding:"16px 20px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:8}}>
                  <div>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,color:"#111",textTransform:"uppercase"}}>{s.name}</div>
                    <div style={{fontSize:13,color:"rgba(0,0,0,0.45)",marginTop:1}}>{s.team}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{fontSize:11,color:"rgba(0,0,0,0.3)",whiteSpace:"nowrap"}}>
                      {s.created_at ? new Date(s.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}) : ""}
                    </div>
                    <button onClick={()=>deleteSignup(s)} disabled={deleting===s.id}
                      style={{background:"#fee2e2",border:"none",borderRadius:6,color:"#dc2626",fontWeight:700,fontSize:12,padding:"4px 10px",cursor:"pointer",whiteSpace:"nowrap"}}>
                      {deleting===s.id ? "…" : "✕ Remove"}
                    </button>
                  </div>
                </div>
                <div style={{display:"flex",gap:16,flexWrap:"wrap",fontSize:13,color:"rgba(0,0,0,0.6)",marginBottom:8}}>
                  <span>📧 <a href={`mailto:${s.email}`} style={{color:"#002d6e",textDecoration:"none"}}>{s.email}</a></span>
                  <span>📱 <a href={`tel:${s.phone}`} style={{color:"#002d6e",textDecoration:"none"}}>{s.phone}</a></span>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom: s.notes ? 8 : 0}}>
                  {badge("Reminders", s.reminders)}
                  {badge("Score Alerts", s.scores)}
                  {badge("Playoff Updates", s.playoffs)}
                  {badge("Rainout Notices", s.rainouts)}
                </div>
                {s.notes && <div style={{fontSize:13,color:"rgba(0,0,0,0.55)",fontStyle:"italic",borderTop:"1px solid rgba(0,0,0,0.06)",paddingTop:8,marginTop:4}}>"{s.notes}"</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── LOCAL STORAGE MIGRATION HELPER ─────────────────────────────────────── */
function LocalStorageMigrationButton() {
  const [status, setStatus] = useState(null); // null | "checking" | "found" | "migrating" | "done" | "empty"
  const [found, setFound] = useState([]);

  const check = () => {
    setStatus("checking");
    const keys = [
      {key:"lbdc_rules",      label:"Rules",            table:"lbdc_rules",      id:"main", field:"data"},
      {key:"lbdc_fields",     label:"Field Directions", table:"lbdc_fields",     id:"main", field:"data"},
      {key:"lbdc_sponsors",   label:"Sponsors",         table:"lbdc_sponsors",   id:"main", field:"data"},
      {key:"lbdc_full_schedule",    label:"Saturday Schedule", table:"lbdc_schedules", id:"sat", field:"data"},
      {key:"lbdc_boomers_schedule", label:"Boomers Schedule",  table:"lbdc_schedules", id:"bom", field:"data"},
      {key:"lbdc_alert",      label:"Alert Text",       table:"lbdc_alert",      id:"main", field:"text", raw:true},
    ];
    const contentKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("lbdc_content_")) {
        const id = k.replace("lbdc_content_", "");
        contentKeys.push({key:k, label:`Page Content (${id})`, table:"lbdc_page_content", id, field:"content", raw:true});
      }
    }
    const all = [...keys, ...contentKeys].filter(({key}) => {
      const v = localStorage.getItem(key);
      return v && v !== "null" && v !== "[]" && v !== "{}";
    });
    setFound(all);
    setStatus(all.length > 0 ? "found" : "empty");
  };

  const migrate = async () => {
    setStatus("migrating");
    for (const item of found) {
      try {
        const raw = localStorage.getItem(item.key);
        let val;
        if (item.raw) { val = raw; }
        else { try { val = JSON.parse(raw); } catch(e) { val = raw; } }
        const payload = {id: item.id, [item.field]: val};
        await sbUpsert(item.table, payload);
      } catch(e) { /* skip failed items */ }
    }
    setStatus("done");
  };

  if (status === null) return (
    <button onClick={check} style={{background:"#fff",border:"2px dashed #f59e0b",borderRadius:12,padding:"20px",textAlign:"left",cursor:"pointer",gridColumn:"1/-1"}}>
      <div style={{fontSize:28,marginBottom:8}}>🔄</div>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,color:"#b45309",textTransform:"uppercase",marginBottom:4}}>Recover Old Data</div>
      <div style={{fontSize:12,color:"rgba(0,0,0,0.45)"}}>If you edited rules, fields, sponsors, or schedule on this device before the update — tap here to migrate that data to the server.</div>
    </button>
  );

  if (status === "checking") return (
    <div style={{background:"#fffbeb",border:"2px dashed #f59e0b",borderRadius:12,padding:"20px",gridColumn:"1/-1",textAlign:"center",color:"#b45309",fontWeight:700}}>Checking for local data…</div>
  );

  if (status === "empty") return (
    <div style={{background:"#f0fdf4",border:"2px dashed #16a34a",borderRadius:12,padding:"20px",gridColumn:"1/-1",textAlign:"center",color:"#16a34a",fontWeight:700}}>✅ No old local data found — you're all good!</div>
  );

  if (status === "done") return (
    <div style={{background:"#f0fdf4",border:"2px dashed #16a34a",borderRadius:12,padding:"20px",gridColumn:"1/-1",textAlign:"center",color:"#16a34a",fontWeight:700}}>✅ All data migrated to server successfully!</div>
  );

  if (status === "migrating") return (
    <div style={{background:"#fffbeb",border:"2px dashed #f59e0b",borderRadius:12,padding:"20px",gridColumn:"1/-1",textAlign:"center",color:"#b45309",fontWeight:700}}>Migrating {found.length} item{found.length!==1?"s":""}…</div>
  );

  // status === "found"
  return (
    <div style={{background:"#fffbeb",border:"2px solid #f59e0b",borderRadius:12,padding:"20px",gridColumn:"1/-1"}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,color:"#b45309",textTransform:"uppercase",marginBottom:12}}>🔄 Found {found.length} item{found.length!==1?"s":""}  to migrate:</div>
      <ul style={{margin:"0 0 14px 16px",padding:0,fontSize:13,color:"rgba(0,0,0,0.6)",lineHeight:2}}>
        {found.map(f => <li key={f.key}>{f.label}</li>)}
      </ul>
      <button onClick={migrate} style={{background:"#f59e0b",border:"none",borderRadius:8,padding:"10px 24px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,color:"#fff",cursor:"pointer",textTransform:"uppercase"}}>
        ✅ Migrate All to Server
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
//  PLAYER AVAILABILITY PAGE
// ─────────────────────────────────────────────
function PlayerAvailabilityPage({ setTab }) {
  const TODAY = new Date().toISOString().slice(0,10);
  const teamNames = ALL_TEAMS.map(t => t.name).sort();

  const [selectedTeam, setSelectedTeam] = useState(() => localStorage.getItem("avail_team") || "");
  const [selectedPlayer, setSelectedPlayer] = useState(() => localStorage.getItem("avail_player") || "");
  const [roster, setRoster] = useState([]);
  const [games, setGames] = useState([]);
  const [availability, setAvailability] = useState({}); // key: game_id → status
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState({});

  // Load roster when team changes
  useEffect(() => {
    if (!selectedTeam) { setRoster([]); setSelectedPlayer(""); return; }
    localStorage.setItem("avail_team", selectedTeam);
    sbFetch(`lbdc_rosters?select=name&team=eq.${encodeURIComponent(selectedTeam)}&order=id.asc`)
      .then(rows => setRoster(rows.map(r => r.name)))
      .catch(() => setRoster([]));
  }, [selectedTeam]);

  // Validate saved player against new roster
  useEffect(() => {
    if (roster.length && !roster.includes(selectedPlayer)) setSelectedPlayer("");
  }, [roster]);

  // Load upcoming games + existing availability when player selected
  useEffect(() => {
    if (!selectedTeam || !selectedPlayer) { setGames([]); setAvailability({}); return; }
    localStorage.setItem("avail_player", selectedPlayer);
    setLoading(true);
    const isBoomers = BOOMERS_TEAMS.has(selectedTeam);
    const schedKey = isBoomers ? "bom" : "sat";
    sbFetch(`lbdc_schedules?id=eq.${schedKey}&select=data`).then(rows => {
      const data = rows && rows[0] ? rows[0].data : [];
      // Filter to this team's upcoming games
      const upcoming = data
        .filter(g => {
          const iso = toISODate(g.date);
          if (!iso || iso < TODAY) return false;
          return g.away === selectedTeam || g.home === selectedTeam;
        })
        .sort((a, b) => (toISODate(a.date) || "") < (toISODate(b.date) || "") ? -1 : 1)
        .slice(0, 20);
      setGames(upcoming);
      if (!upcoming.length) { setLoading(false); return; }
      // Load existing availability responses keyed by schedule game id
      const ids = upcoming.map(g => g.id).join(",");
      return sbFetch(`availability?select=game_id,status&player_name=eq.${encodeURIComponent(selectedPlayer)}&team=eq.${encodeURIComponent(selectedTeam)}&game_id=in.(${ids})`);
    }).then(rows => {
      if (!rows) { setLoading(false); return; }
      const map = {};
      rows.forEach(r => { map[r.game_id] = r.status; });
      setAvailability(map);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [selectedTeam, selectedPlayer]);

  const setStatus = async (gameId, status) => {
    const current = availability[gameId];
    const newStatus = current === status ? null : status; // toggle off if same
    setSaving(s => ({...s, [gameId]: true}));
    try {
      if (!newStatus) {
        await sbDelete(`availability?player_name=eq.${encodeURIComponent(selectedPlayer)}&team=eq.${encodeURIComponent(selectedTeam)}&game_id=eq.${gameId}`);
        setAvailability(a => { const n = {...a}; delete n[gameId]; return n; });
      } else {
        await sbUpsert(`availability`, { game_id: gameId, player_name: selectedPlayer, team: selectedTeam, status: newStatus });
        setAvailability(a => ({...a, [gameId]: newStatus}));
      }
    } catch(e) { console.error(e); }
    setSaving(s => ({...s, [gameId]: false}));
  };

  const fmtDate = (d) => {
    if (!d) return "";
    const dt = new Date(d + "T12:00:00");
    return dt.toLocaleDateString("en-US", {weekday:"short", month:"short", day:"numeric"});
  };

  const btnStyle = (gameId, type) => {
    const active = availability[gameId] === type;
    const colors = { yes: ["#16a34a","#dcfce7","#166534"], no: ["#dc2626","#fee2e2","#991b1b"] };
    const [bg, lightBg, darkText] = colors[type];
    return {
      padding:"7px 22px", border:`2px solid ${active ? bg : "#e5e7eb"}`,
      borderRadius:8, background: active ? lightBg : "#f9fafb",
      color: active ? darkText : "#6b7280",
      fontWeight: active ? 700 : 500, fontSize:14, cursor:"pointer",
      transition:"all .15s",
    };
  };

  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",paddingBottom:60}}>
      <div style={{background:"#002d6e",padding:"clamp(20px,4vw,40px) clamp(16px,4vw,40px) 28px"}}>
        <div style={{maxWidth:600,margin:"0 auto"}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:32,textTransform:"uppercase",color:"#fff",letterSpacing:".04em",lineHeight:1}}>My Availability</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.6)",marginTop:6}}>Let your team know if you can make the game</div>
        </div>
      </div>

      <div style={{maxWidth:600,margin:"0 auto",padding:"24px clamp(12px,3vw,24px)"}}>
        {/* Team + player selectors */}
        <div style={{background:"#fff",borderRadius:12,padding:"20px",marginBottom:20,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontWeight:700,fontSize:12,textTransform:"uppercase",letterSpacing:".07em",color:"#6b7280",marginBottom:6}}>Your Team</label>
            <select value={selectedTeam} onChange={e=>{ setSelectedTeam(e.target.value); setSelectedPlayer(""); }}
              style={{width:"100%",padding:"10px 12px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:15,background:"#fff"}}>
              <option value="">— Select your team —</option>
              {teamNames.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {selectedTeam && (
            <div>
              <label style={{display:"block",fontWeight:700,fontSize:12,textTransform:"uppercase",letterSpacing:".07em",color:"#6b7280",marginBottom:6}}>Your Name</label>
              <select value={selectedPlayer} onChange={e=>setSelectedPlayer(e.target.value)}
                style={{width:"100%",padding:"10px 12px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:15,background:"#fff"}}>
                <option value="">— Select your name —</option>
                {roster.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Games list */}
        {selectedTeam && selectedPlayer && (
          loading ? (
            <div style={{textAlign:"center",padding:40,color:"#9ca3af",fontSize:14}}>Loading games…</div>
          ) : games.length === 0 ? (
            <div style={{textAlign:"center",padding:40,color:"#9ca3af",fontSize:14}}>No upcoming games found.</div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {games.map(g => {
                const isHome = g.home === selectedTeam;
                const opp = isHome ? g.away : g.home;
                const status = availability[g.id];
                return (
                  <div key={g.id} style={{background:"#fff",borderRadius:12,padding:"16px 18px",boxShadow:"0 1px 4px rgba(0,0,0,0.07)",borderLeft:`4px solid ${status==="yes"?"#16a34a":status==="no"?"#dc2626":"#e5e7eb"}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:16,color:"#111"}}>{g.date}</div>
                        <div style={{fontSize:13,color:"#555",marginTop:2}}>
                          {isHome ? "vs" : "@"} <strong>{opp}</strong>
                          {g.time && <span style={{color:"#9ca3af"}}> · {g.time}</span>}
                        </div>
                        {g.field && <div style={{fontSize:12,color:"#9ca3af",marginTop:2}}>{g.field}</div>}
                      </div>
                      {status && (
                        <div style={{fontSize:11,fontWeight:700,padding:"3px 8px",borderRadius:6,
                          background:status==="yes"?"#dcfce7":"#fee2e2",
                          color:status==="yes"?"#166534":"#991b1b",
                          textTransform:"uppercase",letterSpacing:".06em"}}>
                          {status==="yes"?"✓ In":"✗ Out"}
                        </div>
                      )}
                    </div>
                    <div style={{display:"flex",gap:10}}>
                      {["yes","no"].map(s => (
                        <button key={s} onClick={()=>setStatus(g.id, s)} disabled={!!saving[g.id]}
                          style={btnStyle(g.id, s)}>
                          {s==="yes"?"✓ Yes":"✗ No"}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
        {(!selectedTeam || !selectedPlayer) && (
          <div style={{textAlign:"center",padding:40,color:"#9ca3af",fontSize:14}}>
            Select your team and name above to get started.
          </div>
        )}

        {/* Don't see your name note */}
        <div style={{marginTop:24,textAlign:"center",fontSize:13,color:"#9ca3af"}}>
          Don't see your name?{" "}
          <span onClick={() => setTab && setTab("signup")}
            style={{color:"#2563eb",fontWeight:700,cursor:"pointer",textDecoration:"underline"}}>
            Register here
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  BOOMERS RSVP MODAL
// ─────────────────────────────────────────────
function BoomersRSVPModal({ game, onClose }) {
  const [awayRoster, setAwayRoster] = useState([]);
  const [homeRoster, setHomeRoster] = useState([]);
  const [avail, setAvail] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const enc = encodeURIComponent;
    Promise.all([
      sbFetch(`lbdc_rosters?select=name&team=eq.${enc(game.away)}&order=id.asc`),
      sbFetch(`lbdc_rosters?select=name&team=eq.${enc(game.home)}&order=id.asc`),
      sbFetch(`availability?select=player_name,team,status&game_id=eq.${enc(game.id)}`),
    ]).then(([ar, hr, av]) => {
      setAwayRoster((ar||[]).map(r => r.name));
      setHomeRoster((hr||[]).map(r => r.name));
      const map = {};
      (av||[]).forEach(r => { map[`${r.team}||${r.player_name}`] = r.status; });
      setAvail(map);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [game.id]);

  const st = (team, name) => avail[`${team}||${name}`] || null;

  const TeamBlock = ({ team, roster }) => {
    const inP = roster.filter(p => st(team,p)==="yes");
    const outP = roster.filter(p => st(team,p)==="no");
    const unk = roster.filter(p => !st(team,p));
    return (
      <div>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,textTransform:"uppercase",color:"#7c3aed",marginBottom:8,borderBottom:"2px solid #7c3aed",paddingBottom:4}}>{team.split(" ").slice(-2).join(" ")}</div>
        {inP.length>0&&<div style={{marginBottom:8}}><div style={{fontSize:11,fontWeight:700,color:"#16a34a",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>✅ In ({inP.length})</div>{inP.map(p=><div key={p} style={{fontSize:14,color:"#111",padding:"2px 0",fontWeight:500}}>{p}</div>)}</div>}
        {outP.length>0&&<div style={{marginBottom:8}}><div style={{fontSize:11,fontWeight:700,color:"#dc2626",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>❌ Out ({outP.length})</div>{outP.map(p=><div key={p} style={{fontSize:14,color:"rgba(0,0,0,0.4)",textDecoration:"line-through",padding:"2px 0"}}>{p}</div>)}</div>}
        {unk.length>0&&<div><div style={{fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>❓ No response ({unk.length})</div>{unk.map(p=><div key={p} style={{fontSize:14,color:"rgba(0,0,0,0.3)",padding:"2px 0"}}>{p}</div>)}</div>}
      </div>
    );
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:14,maxWidth:580,width:"100%",overflow:"hidden",maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{background:"#7c3aed",padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,color:"#fff",textTransform:"uppercase"}}>👥 Who's Playing?</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.75)",marginTop:2}}>{game.away.split(" ").slice(-2).join(" ")} vs {game.home.split(" ").slice(-2).join(" ")} · {game.date}</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:6,width:30,height:30,cursor:"pointer",fontSize:16}}>✕</button>
        </div>
        <div style={{padding:"16px"}}>
          {loading
            ? <div style={{textAlign:"center",padding:40,color:"#9ca3af"}}>Loading…</div>
            : <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}><TeamBlock team={game.away} roster={awayRoster}/><TeamBlock team={game.home} roster={homeRoster}/></div>
          }
          <div style={{marginTop:14,padding:"8px 12px",background:"#f3f0ff",borderRadius:8,fontSize:12,color:"#7c3aed",fontWeight:600}}>
            Availability set by captains in their admin portal. Contact your captain to update your status.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  CAPTAIN AVAILABILITY VIEW (inside captain dashboard)
// ─────────────────────────────────────────────
function CaptainAvailabilityView({ teamName }) {
  const TODAY = new Date().toISOString().slice(0,10);
  const [roster, setRoster] = useState([]);
  const [games, setGames] = useState([]);
  const [availability, setAvailability] = useState({}); // key: `${gameId}_${playerName}` → status
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});

  useEffect(() => {
    if (!teamName) return;
    const isBoomers = BOOMERS_TEAMS.has(teamName);
    const schedKey = isBoomers ? "bom" : "sat";
    Promise.all([
      sbFetch(`lbdc_rosters?select=name&team=eq.${encodeURIComponent(teamName)}&order=id.asc`),
      sbFetch(`lbdc_schedules?id=eq.${schedKey}&select=data`),
    ]).then(([rosterRows, schedRows]) => {
      const players = rosterRows.map(r => r.name);
      setRoster(players);
      const data = schedRows && schedRows[0] ? schedRows[0].data : [];
      const upcoming = data
        .filter(g => {
          const iso = toISODate(g.date);
          if (!iso || iso < TODAY) return false;
          return g.away === teamName || g.home === teamName;
        })
        .sort((a, b) => (toISODate(a.date)||"") < (toISODate(b.date)||"") ? -1 : 1)
        .slice(0, 20);
      setGames(upcoming);
      if (!upcoming.length) { setLoading(false); return; }
      const ids = upcoming.map(g => g.id).join(",");
      return sbFetch(`availability?select=game_id,player_name,status&team=eq.${encodeURIComponent(teamName)}&game_id=in.(${ids})`);
    }).then(rows => {
      const map = {};
      (rows||[]).forEach(r => { map[`${r.game_id}_${r.player_name}`] = r.status; });
      setAvailability(map);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [teamName]);

  const setStatus = async (gameId, playerName, status) => {
    const key = `${gameId}_${playerName}`;
    const current = availability[key];
    const newStatus = current === status ? null : status;
    setSaving(s => ({...s, [key]: true}));
    try {
      if (!newStatus) {
        await sbDelete(`availability?player_name=eq.${encodeURIComponent(playerName)}&team=eq.${encodeURIComponent(teamName)}&game_id=eq.${gameId}`);
        setAvailability(a => { const n = {...a}; delete n[key]; return n; });
      } else {
        await sbUpsert(`availability`, { game_id: gameId, player_name: playerName, team: teamName, status: newStatus });
        setAvailability(a => ({...a, [key]: newStatus}));
      }
    } catch(e) { console.error(e); }
    setSaving(s => ({...s, [key]: false}));
  };

  const fmtDate = (d) => {
    if (!d) return "";
    const dt = new Date(d + "T12:00:00");
    return dt.toLocaleDateString("en-US", {month:"short", day:"numeric"});
  };

  const statusColor = { yes:"#16a34a", no:"#dc2626" };
  const statusBg = { yes:"#dcfce7", no:"#fee2e2" };
  const statusLabel = { yes:"✓", no:"✗" };

  if (loading) return <div style={{textAlign:"center",padding:40,color:"#9ca3af"}}>Loading…</div>;
  if (games.length === 0) return <div style={{textAlign:"center",padding:40,color:"#9ca3af",fontSize:14}}>No upcoming games scheduled.</div>;
  if (roster.length === 0) return <div style={{textAlign:"center",padding:40,color:"#9ca3af",fontSize:14}}>No roster found for this team.</div>;

  // Count responses per game
  const countFor = (gameId, s) => roster.filter(p => availability[`${gameId}_${p}`] === s).length;

  return (
    <div>
      {/* Game columns header + summary row */}
      <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        <table style={{borderCollapse:"collapse",fontSize:13,minWidth:500,width:"100%"}}>
          <thead>
            <tr>
              <th style={{padding:"8px 12px",textAlign:"left",fontWeight:700,fontSize:11,color:"#6b7280",textTransform:"uppercase",letterSpacing:".06em",whiteSpace:"nowrap",borderBottom:"2px solid #e5e7eb",minWidth:130}}>Player</th>
              {games.map(g => (
                <th key={g.id} style={{padding:"8px 8px",textAlign:"center",fontWeight:700,fontSize:11,color:"#6b7280",textTransform:"uppercase",letterSpacing:".05em",whiteSpace:"nowrap",borderBottom:"2px solid #e5e7eb",minWidth:80}}>
                  <div>{g.date}</div>
                  <div style={{fontSize:10,fontWeight:500,color:"#9ca3af",textTransform:"none"}}>
                    {g.away === teamName ? `@ ${g.home.split(" ")[0]}` : `vs ${g.away.split(" ")[0]}`}
                  </div>
                </th>
              ))}
            </tr>
            {/* Summary row */}
            <tr style={{background:"#f0fdf4"}}>
              <td style={{padding:"6px 12px",fontWeight:700,fontSize:12,color:"#166534"}}>✓ In</td>
              {games.map(g => <td key={g.id} style={{padding:"6px 8px",textAlign:"center",fontWeight:700,fontSize:13,color:"#16a34a"}}>{countFor(g.id,"yes") || "—"}</td>)}
            </tr>
            <tr style={{background:"#fef2f2",borderBottom:"2px solid #e5e7eb"}}>
              <td style={{padding:"6px 12px",fontWeight:700,fontSize:12,color:"#991b1b"}}>✗ Out</td>
              {games.map(g => <td key={g.id} style={{padding:"6px 8px",textAlign:"center",fontWeight:700,fontSize:13,color:"#dc2626"}}>{countFor(g.id,"no") || "—"}</td>)}
            </tr>
          </thead>
          <tbody>
            {roster.map((player, pi) => (
              <tr key={player} style={{borderBottom:"1px solid #f3f4f6",background:pi%2===0?"#fff":"#fafafa"}}>
                <td style={{padding:"8px 12px",fontWeight:500,color:"#111",whiteSpace:"nowrap"}}>{player}</td>
                {games.map(g => {
                  const key = `${g.id}_${player}`;
                  const s = availability[key];
                  const isSaving = saving[key];
                  return (
                    <td key={g.id} style={{padding:"6px 8px",textAlign:"center"}}>
                      <div style={{display:"flex",gap:4,justifyContent:"center"}}>
                        {["yes","no"].map(opt => (
                          <button key={opt} onClick={()=>setStatus(g.id, player, opt)} disabled={!!isSaving}
                            style={{width:26,height:26,border:`1.5px solid ${s===opt?statusColor[opt]:"#e5e7eb"}`,
                              borderRadius:6,background:s===opt?statusBg[opt]:"#f9fafb",
                              color:s===opt?statusColor[opt]:"#d1d5db",
                              fontWeight:700,fontSize:12,cursor:"pointer",padding:0,lineHeight:1}}>
                            {statusLabel[opt]}
                          </button>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{marginTop:12,fontSize:11,color:"#9ca3af"}}>Tap any button to set a player's availability. Tap again to clear.</div>
    </div>
  );
}

function AdminPage({ onAlertChange }) {
  const [screen, setScreen] = useState("login"); // "login" | "admin" | "captain"
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);
  const [captainTeam, setCaptainTeam] = useState("");
  const [captainView, setCaptainView] = useState("menu"); // "menu" | "live" | "boxscore"
  const [alertText, setAlertText] = useState("");
  const [alertStyle, setAlertStyle] = useState({});
  const [alertExpire, setAlertExpire] = useState("");
  const [alertSchedule, setAlertSchedule] = useState("");
  const [alertHistory, setAlertHistory] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showBoxScore, setShowBoxScore] = useState(false);
  const [quickView, setQuickView] = useState(null); // null | "alert" | "news" | "schedule" | "email" | "games" | "tournaments" | "eligibility"
  const [preloadGame, setPreloadGame] = useState(null); // game object to preload into BoxScoreEntry
  const [adminGames, setAdminGames] = useState([]);
  const [adminGamesLoading, setAdminGamesLoading] = useState(false);
  const [adminGamesLeague, setAdminGamesLeague] = useState(0); // 0=Saturday, 1=Boomers
  const [scoreEditId, setScoreEditId] = useState(null); // game id being inline-score-edited
  const [scoreEditAway, setScoreEditAway] = useState(""); const [scoreEditHome, setScoreEditHome] = useState("");

  // News & Events
  const [newsItems, setNewsItems] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsForm, setNewsForm] = useState({title:"", body:"", event_date:"", pinned:false});
  const [newsEditId, setNewsEditId] = useState(null);
  const [newsSaving, setNewsSaving] = useState(false);
  const [newsStyle, setNewsStyle] = useState({});
  const updateNewsStyle = (key, val) => setNewsStyle(s => ({...s, [key]: val}));
  const [newsSchedule, setNewsSchedule] = useState("");
  const [newsExpire, setNewsExpire] = useState("");

  const loadNews = () => {
    setNewsLoading(true);
    sbFetch("news?select=id,title,body,event_date,pinned,style,created_at&order=pinned.desc,created_at.desc&limit=20")
      .then(data => { setNewsItems(data || []); setNewsLoading(false); })
      .catch(() => setNewsLoading(false));
  };

  const saveNewsPost = async () => {
    if (!newsForm.title.trim()) return;
    setNewsSaving(true);
    try {
      const payload = {
        title: newsForm.title.trim(),
        body: newsForm.body.trim() || null,
        event_date: newsForm.event_date || null,
        pinned: newsForm.pinned,
        style: Object.keys(newsStyle).length ? JSON.stringify(newsStyle) : null,
        go_live_at: newsSchedule || null,
        expire_at: newsExpire || null,
      };
      if (newsEditId) {
        await sbPatch(`news?id=eq.${newsEditId}`, payload);
      } else {
        await sbPost("news", payload);
      }
      setNewsForm({title:"", body:"", event_date:"", pinned:false});
      setNewsStyle({});
      setNewsSchedule("");
      setNewsExpire("");
      setNewsEditId(null);
      loadNews();
    } catch(e) { alert("Save failed: " + e.message); }
    setNewsSaving(false);
  };

  const deleteNewsPost = async (id) => {
    if (!window.confirm("Delete this post?")) return;
    try {
      await sbDelete(`news?id=eq.${id}`);
      setNewsItems(prev => prev.filter(x => x.id !== id));
    } catch(e) { alert("Delete failed: " + e.message); }
  };

  const startEditNews = (item) => {
    setNewsEditId(item.id);
    setNewsForm({title:item.title||"", body:item.body||"", event_date:item.event_date||"", pinned:!!item.pinned});
    try { setNewsStyle(item.style ? JSON.parse(item.style) : {}); } catch(e) { setNewsStyle({}); }
    setNewsSchedule(item.go_live_at ? item.go_live_at.slice(0,16) : "");
    setNewsExpire(item.expire_at ? item.expire_at.slice(0,16) : "");
  };

  useEffect(() => {
    if (screen === "admin") loadNews();
  }, [screen]);

  const loadAdminGames = (leagueIdx = adminGamesLeague) => {
    setAdminGamesLoading(true);
    sbFetch("seasons?select=id,name&limit=50")
      .then(async seasons => {
        if (leagueIdx === 1) {
          const s = seasons.find(x => x.name.toLowerCase().includes("boomers"));
          if (!s) return [];
          return sbFetch(`games?select=id,game_date,game_time,away_team,home_team,away_score,home_score,field,status,headline&season_id=eq.${s.id}&away_score=not.is.null&order=game_date.desc&limit=100`);
        } else {
          // Saturday league: collect all matching season IDs (both "Diamond Classics Saturdays" and "Spring/Summer 2026")
          const satIds = seasons
            .filter(x => x.name.includes("Diamond Classics Saturdays") || (x.name.includes("Spring") && x.name.includes("2026")))
            .map(x => x.id);
          if (!satIds.length) return [];
          return sbFetch(`games?select=id,game_date,game_time,away_team,home_team,away_score,home_score,field,status,headline&season_id=in.(${satIds.join(",")})&away_score=not.is.null&order=game_date.desc&limit=100`);
        }
      })
      .then(games => { setAdminGames(games || []); setAdminGamesLoading(false); })
      .catch(() => setAdminGamesLoading(false));
  };

  const postAlert = async () => {
    const trimmed = alertText.trim();
    if (!trimmed) return;
    const newHistory = [
      {text: trimmed, style: alertStyle, ts: Date.now()},
      ...alertHistory.filter(h => h.text !== trimmed),
    ].slice(0, 5);
    setAlertHistory(newHistory);
    const r = await safeSave("Alert", () => sbUpsert("lbdc_alert", {
      id: "main",
      text: trimmed,
      style: alertStyle,
      expire_at: alertExpire || null,
      go_live_at: alertSchedule || null,
      history: newHistory,
    }));
    if (!r.ok) return; // don't flip the on-screen alert if persistence failed
    if (alertSchedule && new Date(alertSchedule) > new Date()) { onAlertChange(null, {}); return; }
    onAlertChange(trimmed, alertStyle);
  };
  const clearAlert = async () => {
    const r = await safeSave("Alert clear", () => sbUpsert("lbdc_alert", {id:"main", text:null, expire_at:null, go_live_at:null}));
    if (!r.ok) return;
    setAlertText("");
    setAlertExpire("");
    setAlertSchedule("");
    onAlertChange(null, {});
  };
  const hasAlert = !!alertText.trim();
  const updateAlertStyle = (key, val) => setAlertStyle(s => ({...s, [key]: val}));

  // Load alert state from Supabase on mount
  useEffect(() => {
    sbFetch("lbdc_alert?id=eq.main&select=text,style,expire_at,go_live_at,history")
      .then(rows => {
        if (!rows || !rows[0]) return;
        const row = rows[0];
        if (row.text) setAlertText(row.text);
        if (row.style && Object.keys(row.style).length) setAlertStyle(row.style);
        if (row.expire_at) setAlertExpire(row.expire_at.slice(0,16));
        if (row.go_live_at) setAlertSchedule(row.go_live_at.slice(0,16));
        if (row.history) setAlertHistory(row.history);
      })
      .catch(() => {});
  }, []);

  // Check schedule/expire every minute
  useEffect(() => {
    const check = async () => {
      const rows = await sbFetch("lbdc_alert?id=eq.main&select=text,style,expire_at,go_live_at").catch(() => null);
      if (!rows || !rows[0]) return;
      const {text, style, expire_at, go_live_at} = rows[0];
      if (go_live_at && new Date(go_live_at) <= new Date() && text) {
        // Background poll — log but don't toast (would spam every 60s on persistent failure)
        await sbUpsert("lbdc_alert", {id:"main", go_live_at:null}).catch(e => console.warn("Alert auto go-live save failed:", e.message));
        setAlertSchedule("");
        onAlertChange(text, style || {});
      }
      if (expire_at && new Date(expire_at) <= new Date()) {
        await sbUpsert("lbdc_alert", {id:"main", text:null, expire_at:null}).catch(e => console.warn("Alert auto expire save failed:", e.message));
        onAlertChange(null, {});
      }
    };
    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, []);

  // ── LOGIN SCREEN ──
  if (screen === "login") return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{maxWidth:420,width:"100%"}}>
        <div style={{background:"#001a3e",padding:"24px 28px",borderRadius:"12px 12px 0 0",display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:32}}>⚾</div>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,color:"#FFD700",textTransform:"uppercase"}}>LBDC Portal</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.45)"}}>League management</div>
          </div>
        </div>
        <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:"0 0 12px 12px",padding:"28px"}}>
          {/* Admin login */}
          <div style={{marginBottom:24}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,textTransform:"uppercase",color:"#111",marginBottom:12,paddingBottom:8,borderBottom:"2px solid #002d6e"}}>
              🔐 Admin Login
            </div>
            <input type="password" placeholder="Admin password" value={pw}
              onChange={e=>{setPw(e.target.value);setPwError(false);}}
              onKeyDown={e=>e.key==="Enter"&&(pw==="lbdc2026"?setScreen("admin"):setPwError(true))}
              style={{width:"100%",padding:"10px 14px",borderRadius:8,border:`1px solid ${pwError?"#dc2626":"rgba(0,0,0,0.15)"}`,fontSize:15,marginBottom:8,background:"#f8f9fb",boxSizing:"border-box"}}/>
            {pwError && <div style={{fontSize:12,color:"#dc2626",marginBottom:8}}>Incorrect password.</div>}
            <button type="button" onClick={()=>pw==="lbdc2026"?setScreen("admin"):setPwError(true)}
              style={{width:"100%",padding:"11px",background:"#002d6e",border:"none",borderRadius:8,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,textTransform:"uppercase",cursor:"pointer"}}>
              Log In as Admin
            </button>
          </div>
          {/* Captain login */}
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,textTransform:"uppercase",color:"#111",marginBottom:12,paddingBottom:8,borderBottom:"2px solid #4a7c3f"}}>
              ⚾ Captain Login
            </div>
            <div style={{fontSize:13,color:"rgba(0,0,0,0.5)",marginBottom:10}}>Select your team to enter today's box score:</div>
            <select value={captainTeam} onChange={e=>setCaptainTeam(e.target.value)}
              style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid rgba(0,0,0,0.15)",fontSize:15,marginBottom:12,background:"#f8f9fb",boxSizing:"border-box"}}>
              <option value="">— Select your team —</option>
              {Object.keys(TEAM_ROSTERS).map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <button type="button" onClick={()=>captainTeam&&setScreen("captain")} disabled={!captainTeam}
              style={{width:"100%",padding:"11px",background:captainTeam?"#2d6a4f":"#ccc",border:"none",borderRadius:8,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,textTransform:"uppercase",cursor:captainTeam?"pointer":"default"}}>
              Log In as {captainTeam||"Captain"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (screen === "admin_rosters") return <AdminRostersEditor onBack={() => setScreen("admin")} />;
  if (screen === "admin_content") return <AdminContentEditor onBack={() => setScreen("admin")} />;
  if (screen === "admin_rules")   return <AdminRulesEditor onBack={() => setScreen("admin")} />;
  if (screen === "admin_photos")  return <AdminPhotosEditor onBack={() => setScreen("admin")} />;
  if (screen === "admin_sponsors") return <AdminSponsorsEditor onBack={() => setScreen("admin")} />;
  if (screen === "admin_fields")  return <AdminFieldsEditor onBack={() => setScreen("admin")} />;
  if (screen === "admin_contact") return <AdminContactEditor onBack={() => setScreen("admin")} />;
  if (screen === "admin_signups") return <AdminSignupsViewer onBack={() => setScreen("admin")} />;

  // ── ADMIN ROSTERS SCREEN ──
  if (screen === "admin_rosters") return <AdminRostersEditor onBack={() => setScreen("admin")} />;

  // ── CAPTAIN SCREEN ──
  if (screen === "captain") {
    if (captainView === "live") return <LiveScorerPage teamFilter={captainTeam} onExit={()=>setCaptainView("menu")} />;
    return (
      <div style={{minHeight:"100vh",background:"#f2f4f8",overflowX:"hidden"}}>
        <div style={{background:"#2d6a4f",borderBottom:"3px solid #1b4332",padding:"16px clamp(12px,3vw,40px)"}}>
          <div style={{maxWidth:900,margin:"0 auto",display:"flex",alignItems:"center",gap:14}}>
            <div style={{fontSize:28}}>⚾</div>
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,color:"#FFD700",textTransform:"uppercase"}}>Captain Portal — {captainTeam}</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>Logged in as {captainTeam} captain</div>
            </div>
            <button type="button" onClick={()=>{setScreen("login");setCaptainTeam("");setCaptainView("menu");}} style={{marginLeft:"auto",padding:"6px 14px",background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:6,color:"rgba(255,255,255,0.7)",fontSize:13,cursor:"pointer"}}>Log out</button>
          </div>
        </div>
        <div style={{maxWidth:1400,margin:"0 auto",padding:"24px clamp(12px,3vw,40px) 60px"}}>
          {captainView === "menu" && (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <button onClick={()=>setCaptainView("live")}
                style={{background:"#002d6e",border:"none",borderRadius:14,padding:"28px 24px",textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:18}}>
                <div style={{fontSize:40}}>⚡</div>
                <div>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,color:"#FFD700",textTransform:"uppercase",marginBottom:4}}>Score Live</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,0.6)"}}>Score pitch-by-pitch in real time — shows only your team's games</div>
                </div>
              </button>
              <button onClick={()=>setCaptainView("boxscore")}
                style={{background:"#374151",border:"none",borderRadius:14,padding:"28px 24px",textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:18}}>
                <div style={{fontSize:40}}>📋</div>
                <div>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,color:"#fff",textTransform:"uppercase",marginBottom:4}}>Submit Box Score</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>Enter final stats after the game</div>
                </div>
              </button>
              <button onClick={()=>setCaptainView("roster")}
                style={{background:"#1a4332",border:"none",borderRadius:14,padding:"28px 24px",textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:18}}>
                <div style={{fontSize:40}}>👥</div>
                <div>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,color:"#fff",textTransform:"uppercase",marginBottom:4}}>Manage Roster</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>Add, edit, or remove players from your team</div>
                </div>
              </button>
              <button onClick={()=>setCaptainView("availability")}
                style={{background:"#065f46",border:"none",borderRadius:14,padding:"28px 24px",textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:18}}>
                <div style={{fontSize:40}}>📅</div>
                <div>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,color:"#fff",textTransform:"uppercase",marginBottom:4}}>Player Availability</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>See who's in for upcoming games</div>
                </div>
              </button>
              <button onClick={()=>setCaptainView("instructions")}
                style={{background:"#7c3aed",border:"none",borderRadius:14,padding:"28px 24px",textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:18}}>
                <div style={{fontSize:40}}>📖</div>
                <div>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,color:"#fff",textTransform:"uppercase",marginBottom:4}}>Captain Instructions</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,0.6)"}}>How to submit scores, manage your roster & use the site</div>
                </div>
              </button>
            </div>
          )}
          {captainView === "boxscore" && (
            <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"14px 20px",borderBottom:"1px solid rgba(0,0,0,0.07)",display:"flex",alignItems:"center",gap:10}}>
                <button onClick={()=>setCaptainView("menu")} style={{padding:"5px 12px",background:"rgba(0,0,0,0.07)",border:"none",borderRadius:6,fontWeight:700,fontSize:13,cursor:"pointer"}}>← Back</button>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,textTransform:"uppercase",color:"#111"}}>📋 Submit Box Score</div>
              </div>
              <div style={{padding:"20px"}}>
                <BoxScoreEntry onClose={()=>setCaptainView("menu")} captainTeam={captainTeam} />
              </div>
            </div>
          )}
          {captainView === "roster" && (
            <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"14px 20px",borderBottom:"1px solid rgba(0,0,0,0.07)",display:"flex",alignItems:"center",gap:10}}>
                <button onClick={()=>setCaptainView("menu")} style={{padding:"5px 12px",background:"rgba(0,0,0,0.07)",border:"none",borderRadius:6,fontWeight:700,fontSize:13,cursor:"pointer"}}>← Back</button>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,textTransform:"uppercase",color:"#111"}}>👥 {captainTeam} — Roster</div>
              </div>
              <div style={{padding:"20px"}}>
                <CaptainRosterEditor teamName={captainTeam} />
              </div>
            </div>
          )}
          {captainView === "availability" && (
            <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"14px 20px",borderBottom:"1px solid rgba(0,0,0,0.07)",display:"flex",alignItems:"center",gap:10}}>
                <button onClick={()=>setCaptainView("menu")} style={{padding:"5px 12px",background:"rgba(0,0,0,0.07)",border:"none",borderRadius:6,fontWeight:700,fontSize:13,cursor:"pointer"}}>← Back</button>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,textTransform:"uppercase",color:"#111"}}>📅 Player Availability</div>
              </div>
              <div style={{padding:"20px"}}>
                <CaptainAvailabilityView teamName={captainTeam} />
              </div>
            </div>
          )}
          {captainView === "instructions" && (
            <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"14px 20px",borderBottom:"1px solid rgba(0,0,0,0.07)",display:"flex",alignItems:"center",gap:10}}>
                <button onClick={()=>setCaptainView("menu")} style={{padding:"5px 12px",background:"rgba(0,0,0,0.07)",border:"none",borderRadius:6,fontWeight:700,fontSize:13,cursor:"pointer"}}>← Back</button>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,textTransform:"uppercase",color:"#111"}}>📖 Captain Instructions</div>
              </div>
              <div style={{padding:"24px 20px",display:"flex",flexDirection:"column",gap:24}}>
                {[
                  {icon:"📋", title:"How to Submit a Box Score", steps:[
                    "After the game ends, log into the Captain Portal and tap Submit Box Score.",
                    "Select the game from the dropdown — it will show today's games for your team.",
                    "Enter the final score and each player's stats (AB, H, HR, RBI, BB, K for batters; IP, H, ER, BB, K for pitchers).",
                    "Only players who appeared in the game need to be entered.",
                    "Hit Submit when done. Stats will appear on the site immediately.",
                    "Box scores must be submitted within 24 hours of the game.",
                  ]},
                  {icon:"👤", title:"Adding a Player to Your Lineup", steps:[
                    "If a player shows up who isn't on your roster yet, go to Manage Roster first and add them.",
                    "Once added to the roster, they'll appear in the player dropdowns when submitting a box score.",
                    "You can add players on game day — just make sure to do it before submitting the box score.",
                  ]},
                  {icon:"👥", title:"Managing Your Roster", steps:[
                    "Go to Manage Roster in the Captain Portal.",
                    "Tap + Add Player, enter their name and jersey number, then save.",
                    "To edit a player (name or number), tap their row and update the info.",
                    "To remove a player, tap the ✕ next to their name.",
                    "Changes save immediately — no need to hit a separate save button.",
                  ]},
                  {icon:"🌐", title:"Using the Website", steps:[
                    "Scores & standings update automatically after box scores are submitted.",
                    "Tap any team name or logo on the Standings or Schedule page to view their full roster and stats.",
                    "The Scores page shows recent results with full recaps — updated after each game.",
                    "The Schedule page shows upcoming games by date — tap any game for a preview.",
                    "The ⚡ Live tab shows live scoring during games in progress.",
                  ]},
                  {icon:"📅", title:"Adding the Schedule to Your Phone Calendar", steps:[
                    "On the Schedule page, look for the Add to Calendar button on any game.",
                    "On iPhone: Open Safari, go to lbdc.vercel.app, tap the Share button (box with arrow), then tap Add to Home Screen for quick access.",
                    "For Google Calendar on Android: Open the game, tap the date/time, and choose Add to Calendar.",
                    "You can also manually add game dates from the Schedule page to your phone calendar.",
                  ]},
                ].map((section, si) => (
                  <div key={si}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                      <span style={{fontSize:22}}>{section.icon}</span>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,textTransform:"uppercase",color:"#002d6e"}}>{section.title}</div>
                    </div>
                    <ol style={{margin:0,paddingLeft:20,display:"flex",flexDirection:"column",gap:6}}>
                      {section.steps.map((step, i) => (
                        <li key={i} style={{fontSize:14,color:"rgba(0,0,0,0.7)",lineHeight:1.6}}>{step}</li>
                      ))}
                    </ol>
                    {si < 4 && <div style={{height:1,background:"rgba(0,0,0,0.06)",marginTop:20}} />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── ADMIN SCREEN ──
  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",overflowX:"hidden",width:"100%"}}>
      <div style={{background:"#001a3e",borderBottom:"3px solid #002d6e",padding:"16px clamp(12px,3vw,40px)"}}>
        <div style={{maxWidth:900,margin:"0 auto",display:"flex",alignItems:"center",gap:14}}>
          <div style={{fontSize:32}}>⚾</div>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,color:"#FFD700",textTransform:"uppercase"}}>LBDC Admin</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>Logged in as League Admin</div>
          </div>
          <button type="button" onClick={()=>setScreen("login")} style={{marginLeft:"auto",padding:"6px 14px",background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:6,color:"rgba(255,255,255,0.6)",fontSize:13,cursor:"pointer"}}>Log out</button>
        </div>
      </div>
      <div style={{maxWidth:900,margin:"0 auto",padding:"24px clamp(12px,3vw,40px) 60px",display:"flex",flexDirection:"column",gap:20}}>

        {/* League Alert — shown inline when quickView==="alert" */}
        {quickView==="alert" && <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:12,overflow:"hidden"}}>
          <div style={{padding:"14px 20px",borderBottom:"1px solid rgba(0,0,0,0.07)",display:"flex",alignItems:"center",gap:10}}>
            <button type="button" onClick={()=>setQuickView(null)} style={{padding:"5px 12px",background:"rgba(0,0,0,0.07)",border:"none",borderRadius:6,fontWeight:700,fontSize:13,cursor:"pointer"}}>← Back</button>
            <div style={{width:10,height:10,borderRadius:"50%",background:hasAlert?"#dc2626":"#22c55e",flexShrink:0,boxShadow:`0 0 6px ${hasAlert?"#dc2626":"#22c55e"}`}} />
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,textTransform:"uppercase",color:"#111"}}>🚨 League Alert Banner</div>
          </div>
          <div style={{padding:"20px",display:"flex",flexDirection:"column",gap:14}}>
            <div style={{fontSize:13,color:"rgba(0,0,0,0.5)"}}>
              When active, a <strong style={{color:"#dc2626"}}>big red blocking popup</strong> appears on the site — visitors must click OK to continue. Leave blank to clear.
            </div>
            {/* Emoji picker */}
            <div style={{position:"relative"}}>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:6}}>
                <span style={{fontSize:11,fontWeight:700,color:"rgba(0,0,0,0.4)",textTransform:"uppercase"}}>Quick insert:</span>
                {["⚠️","🚨","❌","🌧️","☔","📢","⛔","✅","🔴","⚾","📅","🏟️"].map(e=>(
                  <button key={e} type="button" onClick={()=>setAlertText(t=>t+e)}
                    style={{fontSize:18,background:"none",border:"1px solid rgba(0,0,0,0.1)",borderRadius:6,padding:"2px 6px",cursor:"pointer",lineHeight:1.4}}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <textarea value={alertText} onChange={e=>setAlertText(e.target.value)} rows={3}
              placeholder="e.g. ⚠️ RAINOUT — All Saturday April 19 games are CANCELLED due to rain. Makeup dates TBD."
              style={{padding:"12px",border:"1px solid #ddd",borderRadius:8,fontSize:14,fontFamily:"inherit",resize:"vertical",width:"100%",boxSizing:"border-box"}}/>

            {/* Formatting toolbar */}
            <div style={{background:"#f8f9fb",border:"1px solid rgba(0,0,0,0.12)",borderRadius:8,overflow:"hidden"}}>
              {/* Toolbar row */}
              <div style={{display:"flex",alignItems:"center",gap:2,padding:"6px 8px",borderBottom:"1px solid rgba(0,0,0,0.09)",flexWrap:"wrap",background:"#fff"}}>
                {/* Font family */}
                <div style={{marginRight:6,borderRight:"1px solid rgba(0,0,0,0.1)",paddingRight:8}}>
                  <select value={alertStyle.fontFamily||"inherit"} onChange={e=>updateAlertStyle("fontFamily",e.target.value)}
                    style={{padding:"4px 6px",border:"1px solid rgba(0,0,0,0.15)",borderRadius:4,fontSize:13,fontFamily:alertStyle.fontFamily||"inherit",background:"#fff",cursor:"pointer",height:28}}>
                    {[
                      ["Default (Barlow)","inherit"],
                      ["Arial","Arial, sans-serif"],
                      ["Georgia","Georgia, serif"],
                      ["Times New Roman","'Times New Roman', serif"],
                      ["Courier","'Courier New', monospace"],
                      ["Verdana","Verdana, sans-serif"],
                      ["Trebuchet","'Trebuchet MS', sans-serif"],
                      ["Impact","Impact, sans-serif"],
                    ].map(([label, val]) => (
                      <option key={val} value={val} style={{fontFamily:val}}>{label}</option>
                    ))}
                  </select>
                </div>
                {/* Font size */}
                <div style={{display:"flex",alignItems:"center",gap:2,marginRight:6,borderRight:"1px solid rgba(0,0,0,0.1)",paddingRight:8}}>
                  <button type="button" onClick={()=>updateAlertStyle("fontSize",String(Math.max(10,Number(alertStyle.fontSize||16)-2)))}
                    style={{width:24,height:28,border:"1px solid rgba(0,0,0,0.12)",borderRadius:4,background:"#fff",cursor:"pointer",fontSize:14,fontWeight:700,color:"#333",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                  <input type="number" min="10" max="72" value={alertStyle.fontSize||16}
                    onChange={e=>updateAlertStyle("fontSize",e.target.value)}
                    style={{width:44,padding:"4px 6px",border:"1px solid rgba(0,0,0,0.15)",borderRadius:4,fontSize:13,textAlign:"center",fontFamily:"inherit"}}/>
                  <button type="button" onClick={()=>updateAlertStyle("fontSize",String(Math.min(72,Number(alertStyle.fontSize||16)+2)))}
                    style={{width:24,height:28,border:"1px solid rgba(0,0,0,0.12)",borderRadius:4,background:"#fff",cursor:"pointer",fontSize:14,fontWeight:700,color:"#333",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                </div>

                {/* Bold / Italic */}
                <div style={{display:"flex",gap:2,marginRight:6,borderRight:"1px solid rgba(0,0,0,0.1)",paddingRight:8}}>
                  {[["B","fontWeight","700","400",{fontWeight:700}],["I","fontStyle","italic","normal",{fontStyle:"italic"}]].map(([lbl,key,on,off,s])=>(
                    <button key={lbl} type="button" onClick={()=>updateAlertStyle(key,(alertStyle[key]||off)===on?off:on)}
                      style={{width:28,height:28,border:`1px solid ${(alertStyle[key]||off)===on?"#002d6e":"rgba(0,0,0,0.12)"}`,borderRadius:4,background:(alertStyle[key]||off)===on?"#002d6e":"#fff",color:(alertStyle[key]||off)===on?"#fff":"#333",cursor:"pointer",...s,fontSize:14}}>
                      {lbl}
                    </button>
                  ))}
                </div>

                {/* Alignment */}
                <div style={{display:"flex",gap:2,marginRight:6,borderRight:"1px solid rgba(0,0,0,0.1)",paddingRight:8}}>
                  {[["≡\u2190","left"],["≡","center"],["≡\u2192","right"]].map(([icon,val])=>(
                    <button key={val} type="button" onClick={()=>updateAlertStyle("textAlign",val)}
                      style={{width:28,height:28,border:`1px solid ${(alertStyle.textAlign||"center")===val?"#002d6e":"rgba(0,0,0,0.12)"}`,borderRadius:4,background:(alertStyle.textAlign||"center")===val?"#002d6e":"#fff",color:(alertStyle.textAlign||"center")===val?"#fff":"#555",cursor:"pointer",fontSize:12,fontWeight:700}}>
                      {icon}
                    </button>
                  ))}
                </div>

                {/* Text color picker */}
                <div style={{display:"flex",alignItems:"center",gap:6,marginRight:6,borderRight:"1px solid rgba(0,0,0,0.1)",paddingRight:8}}>
                  <span style={{fontSize:11,fontWeight:700,color:"rgba(0,0,0,0.45)",textTransform:"uppercase",whiteSpace:"nowrap"}}>Text</span>
                  <div style={{position:"relative",width:28,height:28}}>
                    <div style={{position:"absolute",inset:0,borderRadius:4,border:"2px solid rgba(0,0,0,0.15)",background:alertStyle.color||"#ffffff",pointerEvents:"none"}}/>
                    <input type="color" value={alertStyle.color||"#ffffff"} onChange={e=>updateAlertStyle("color",e.target.value)}
                      style={{opacity:0,position:"absolute",inset:0,width:"100%",height:"100%",cursor:"pointer",border:"none",padding:0}}/>
                  </div>
                </div>

                {/* Background color picker */}
                <div style={{display:"flex",alignItems:"center",gap:6,marginRight:6,borderRight:"1px solid rgba(0,0,0,0.1)",paddingRight:8}}>
                  <span style={{fontSize:11,fontWeight:700,color:"rgba(0,0,0,0.45)",textTransform:"uppercase",whiteSpace:"nowrap"}}>Background</span>
                  <div style={{position:"relative",width:28,height:28}}>
                    <div style={{position:"absolute",inset:0,borderRadius:4,border:"2px solid rgba(0,0,0,0.15)",background:alertStyle.bgColor||"#dc2626",pointerEvents:"none"}}/>
                    <input type="color" value={alertStyle.bgColor||"#dc2626"} onChange={e=>updateAlertStyle("bgColor",e.target.value)}
                      style={{opacity:0,position:"absolute",inset:0,width:"100%",height:"100%",cursor:"pointer",border:"none",padding:0}}/>
                  </div>
                </div>

                {/* Border style */}
                <div style={{display:"flex",alignItems:"center",gap:4,marginRight:6,borderRight:"1px solid rgba(0,0,0,0.1)",paddingRight:8}}>
                  <span style={{fontSize:11,fontWeight:700,color:"rgba(0,0,0,0.45)",textTransform:"uppercase",whiteSpace:"nowrap"}}>Border</span>
                  {[["None","none"],["Solid","solid"],["Dashed","dashed"],["Glow","glow"]].map(([lbl,val])=>(
                    <button key={val} type="button" onClick={()=>updateAlertStyle("border",val)}
                      style={{padding:"3px 7px",borderRadius:4,border:`1px solid ${(alertStyle.border||"solid")===val?"#002d6e":"rgba(0,0,0,0.12)"}`,background:(alertStyle.border||"solid")===val?"#002d6e":"#fff",color:(alertStyle.border||"solid")===val?"#fff":"#333",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                      {lbl}
                    </button>
                  ))}
                </div>

                {/* Blink toggle */}
                <button type="button" onClick={()=>updateAlertStyle("blink",!alertStyle.blink)}
                  style={{padding:"3px 10px",borderRadius:4,border:`1px solid ${alertStyle.blink?"#002d6e":"rgba(0,0,0,0.12)"}`,background:alertStyle.blink?"#002d6e":"#fff",color:alertStyle.blink?"#fff":"#333",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
                  ✨ Blink
                </button>
              </div>

              {/* Live preview */}
              <div style={{
                background:alertStyle.bgColor||"#dc2626",
                padding:"20px 24px",minHeight:60,
                textAlign:alertStyle.textAlign||"center",
                border: alertStyle.border==="none" ? "none" : alertStyle.border==="dashed" ? "3px dashed rgba(255,255,255,0.6)" : alertStyle.border==="glow" ? "none" : "3px solid rgba(255,255,255,0.4)",
                boxShadow: alertStyle.border==="glow" ? "0 0 20px 6px rgba(255,200,0,0.7), inset 0 0 20px rgba(255,200,0,0.2)" : "none",
              }}>
                <div style={{
                  fontFamily:alertStyle.fontFamily||"inherit",
                  fontSize:Number(alertStyle.fontSize||16),
                  fontWeight:Number(alertStyle.fontWeight||400),
                  fontStyle:alertStyle.fontStyle||"normal",
                  color:alertStyle.color||"#ffffff",
                  lineHeight:1.6,whiteSpace:"pre-wrap",
                  animation: alertStyle.blink ? "alertBlink 1s step-start infinite" : "none",
                }}>
                  {alertText.trim() ? alertText : <span style={{opacity:.4,fontStyle:"italic"}}>Preview will appear here as you type…</span>}
                </div>
              </div>
            </div>

            {/* Schedule & Auto-Expire */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"rgba(0,0,0,0.45)",textTransform:"uppercase",marginBottom:4}}>📅 Go Live At (optional)</div>
                <input type="datetime-local" value={alertSchedule} onChange={e=>setAlertSchedule(e.target.value)}
                  style={{width:"100%",padding:"7px 10px",border:"1px solid #ddd",borderRadius:7,fontSize:13,fontFamily:"inherit",boxSizing:"border-box"}}/>
                <div style={{fontSize:11,color:"rgba(0,0,0,0.35)",marginTop:3}}>Leave blank to post immediately</div>
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"rgba(0,0,0,0.45)",textTransform:"uppercase",marginBottom:4}}>⏰ Auto-Expire At (optional)</div>
                <input type="datetime-local" value={alertExpire} onChange={e=>setAlertExpire(e.target.value)}
                  style={{width:"100%",padding:"7px 10px",border:"1px solid #ddd",borderRadius:7,fontSize:13,fontFamily:"inherit",boxSizing:"border-box"}}/>
                <div style={{fontSize:11,color:"rgba(0,0,0,0.35)",marginTop:3}}>Alert clears itself automatically</div>
              </div>
            </div>

            {hasAlert && (
              <div style={{background:"#fef2f2",border:"2px solid #dc2626",borderRadius:8,padding:"12px 16px",fontSize:14,color:"#991b1b",fontWeight:600}}>
                🔴 ACTIVE: "{alertText.slice(0,80)}{alertText.length>80?"...":""}"
                {alertExpire && <span style={{marginLeft:8,fontWeight:400,fontSize:12}}>· expires {new Date(alertExpire).toLocaleString()}</span>}
              </div>
            )}
            {alertSchedule && !hasAlert && (
              <div style={{background:"#fff8e1",border:"2px solid #f0a500",borderRadius:8,padding:"12px 16px",fontSize:14,color:"#7c4e00",fontWeight:600}}>
                ⏳ SCHEDULED: Goes live {new Date(alertSchedule).toLocaleString()}
              </div>
            )}

            <div style={{display:"flex",gap:10}}>
              <button type="button" onClick={postAlert} disabled={!alertText.trim()}
                style={{flex:1,padding:"12px",background:alertText.trim()?"#dc2626":"#ccc",border:"none",borderRadius:8,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,textTransform:"uppercase",cursor:alertText.trim()?"pointer":"default"}}>
                {alertSchedule && new Date(alertSchedule) > new Date() ? "⏰ Schedule Alert" : hasAlert ? "Update Alert" : "Post Alert to Site"}
              </button>
              {hasAlert && <button type="button" onClick={clearAlert}
                style={{padding:"12px 20px",background:"rgba(0,0,0,0.07)",border:"1px solid rgba(0,0,0,0.15)",borderRadius:8,fontWeight:700,fontSize:14,cursor:"pointer",color:"#555"}}>
                Clear
              </button>}
            </div>

            {/* Alert History */}
            {alertHistory.length > 0 && (
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"rgba(0,0,0,0.4)",textTransform:"uppercase",marginBottom:6}}>🕘 Recent Alerts — click to reuse</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {alertHistory.map((h,i)=>(
                    <div key={i} onClick={()=>{setAlertText(h.text);setAlertStyle(h.style||{});}}
                      style={{background:"#f8f9fb",border:"1px solid rgba(0,0,0,0.09)",borderRadius:7,padding:"8px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,transition:"background .1s"}}
                      onMouseEnter={e=>e.currentTarget.style.background="#f0f4ff"}
                      onMouseLeave={e=>e.currentTarget.style.background="#f8f9fb"}>
                      <div style={{flex:1,fontSize:13,color:"#333",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.text}</div>
                      <div style={{fontSize:11,color:"rgba(0,0,0,0.3)",flexShrink:0}}>{new Date(h.ts).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>}

        {/* News & Events — shown inline when quickView==="news" */}
        {quickView==="news" && <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:12,overflow:"hidden"}}>
          <div style={{padding:"14px 20px",borderBottom:"1px solid rgba(0,0,0,0.07)",display:"flex",alignItems:"center",gap:10}}>
            <button type="button" onClick={()=>setQuickView(null)} style={{padding:"5px 12px",background:"rgba(0,0,0,0.07)",border:"none",borderRadius:6,fontWeight:700,fontSize:13,cursor:"pointer"}}>← Back</button>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,textTransform:"uppercase",color:"#111"}}>📰 News & Events</div>
            <button type="button" onClick={loadNews} style={{marginLeft:"auto",padding:"4px 12px",background:"rgba(0,45,110,0.07)",border:"1px solid rgba(0,45,110,0.2)",borderRadius:6,fontWeight:700,fontSize:12,color:"#002d6e",cursor:"pointer"}}>↻ Refresh</button>
          </div>
          <div style={{padding:"20px",display:"flex",flexDirection:"column",gap:16}}>
            <div style={{fontSize:13,color:"rgba(0,0,0,0.5)"}}>Post announcements, upcoming events, or league news. These appear at the top of the Home page for all visitors.</div>

            {/* Form */}
            <div style={{background:"#f8f9fb",border:"1px solid rgba(0,0,0,0.09)",borderRadius:10,padding:"16px 18px",display:"flex",flexDirection:"column",gap:10}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:15,textTransform:"uppercase",color:"#002d6e"}}>{newsEditId ? "✏️ Editing Post" : "➕ New Post"}</div>
              {/* Emoji bar */}
              <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
                <span style={{fontSize:11,fontWeight:700,color:"rgba(0,0,0,0.4)",textTransform:"uppercase"}}>Insert:</span>
                {["⚾","🏆","📅","⚠️","🌧️","📢","✅","🔴","⭐","🎉","📌","🏟️"].map(e=>(
                  <button key={e} type="button" onClick={()=>setNewsForm(f=>({...f,body:(f.body||"")+e}))}
                    style={{fontSize:16,background:"none",border:"1px solid rgba(0,0,0,0.1)",borderRadius:5,padding:"2px 5px",cursor:"pointer",lineHeight:1.4}}>{e}</button>
                ))}
              </div>
              <input type="text" placeholder="Title (required)" value={newsForm.title} onChange={e=>setNewsForm(f=>({...f,title:e.target.value}))}
                style={{padding:"10px 12px",border:"1px solid #ddd",borderRadius:8,fontSize:14,fontFamily:"inherit",width:"100%",boxSizing:"border-box"}}/>

              {/* Body + formatting toolbar */}
              <div style={{border:"1px solid rgba(0,0,0,0.12)",borderRadius:8,overflow:"hidden"}}>
                {/* Toolbar */}
                <div style={{display:"flex",alignItems:"center",gap:2,padding:"5px 7px",background:"#fff",borderBottom:"1px solid rgba(0,0,0,0.09)",flexWrap:"wrap"}}>
                  <div style={{marginRight:5,borderRight:"1px solid rgba(0,0,0,0.1)",paddingRight:7}}>
                    <select value={newsStyle.fontFamily||"inherit"} onChange={e=>updateNewsStyle("fontFamily",e.target.value)}
                      style={{padding:"3px 5px",border:"1px solid rgba(0,0,0,0.15)",borderRadius:4,fontSize:12,fontFamily:newsStyle.fontFamily||"inherit",background:"#fff",cursor:"pointer",height:26}}>
                      {[["Default","inherit"],["Arial","Arial, sans-serif"],["Georgia","Georgia, serif"],["Times New Roman","'Times New Roman', serif"],["Verdana","Verdana, sans-serif"],["Impact","Impact, sans-serif"]].map(([l,v])=>(
                        <option key={v} value={v} style={{fontFamily:v}}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:2,marginRight:5,borderRight:"1px solid rgba(0,0,0,0.1)",paddingRight:7}}>
                    <button type="button" onClick={()=>updateNewsStyle("fontSize",String(Math.max(10,Number(newsStyle.fontSize||14)-2)))}
                      style={{width:22,height:26,border:"1px solid rgba(0,0,0,0.12)",borderRadius:4,background:"#fff",cursor:"pointer",fontSize:13,fontWeight:700,color:"#333"}}>−</button>
                    <input type="number" min="10" max="72" value={newsStyle.fontSize||14} onChange={e=>updateNewsStyle("fontSize",e.target.value)}
                      style={{width:40,padding:"3px 4px",border:"1px solid rgba(0,0,0,0.15)",borderRadius:4,fontSize:12,textAlign:"center"}}/>
                    <button type="button" onClick={()=>updateNewsStyle("fontSize",String(Math.min(72,Number(newsStyle.fontSize||14)+2)))}
                      style={{width:22,height:26,border:"1px solid rgba(0,0,0,0.12)",borderRadius:4,background:"#fff",cursor:"pointer",fontSize:13,fontWeight:700,color:"#333"}}>+</button>
                  </div>
                  <div style={{display:"flex",gap:2,marginRight:5,borderRight:"1px solid rgba(0,0,0,0.1)",paddingRight:7}}>
                    {[["B","fontWeight","700","400",{fontWeight:700}],["I","fontStyle","italic","normal",{fontStyle:"italic"}]].map(([lbl,key,on,off,s])=>(
                      <button key={lbl} type="button" onClick={()=>updateNewsStyle(key,(newsStyle[key]||off)===on?off:on)}
                        style={{width:26,height:26,border:`1px solid ${(newsStyle[key]||off)===on?"#002d6e":"rgba(0,0,0,0.12)"}`,borderRadius:4,background:(newsStyle[key]||off)===on?"#002d6e":"#fff",color:(newsStyle[key]||off)===on?"#fff":"#333",cursor:"pointer",...s,fontSize:13}}>{lbl}</button>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:2,marginRight:5,borderRight:"1px solid rgba(0,0,0,0.1)",paddingRight:7}}>
                    {[["≡←","left"],["≡","center"],["≡→","right"]].map(([icon,val])=>(
                      <button key={val} type="button" onClick={()=>updateNewsStyle("textAlign",val)}
                        style={{width:26,height:26,border:`1px solid ${(newsStyle.textAlign||"left")===val?"#002d6e":"rgba(0,0,0,0.12)"}`,borderRadius:4,background:(newsStyle.textAlign||"left")===val?"#002d6e":"#fff",color:(newsStyle.textAlign||"left")===val?"#fff":"#555",cursor:"pointer",fontSize:11,fontWeight:700}}>{icon}</button>
                    ))}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <span style={{fontSize:10,fontWeight:700,color:"rgba(0,0,0,0.4)",textTransform:"uppercase"}}>Color</span>
                    <div style={{position:"relative",width:24,height:26}}>
                      <div style={{position:"absolute",inset:0,borderRadius:4,border:"2px solid rgba(0,0,0,0.15)",background:newsStyle.color||"#333",pointerEvents:"none"}}/>
                      <input type="color" value={newsStyle.color||"#333333"} onChange={e=>updateNewsStyle("color",e.target.value)}
                        style={{opacity:0,position:"absolute",inset:0,width:"100%",height:"100%",cursor:"pointer",border:"none",padding:0}}/>
                    </div>
                  </div>
                </div>
                <textarea placeholder="Body / details (optional)" value={newsForm.body} onChange={e=>setNewsForm(f=>({...f,body:e.target.value}))} rows={3}
                  style={{padding:"10px 12px",border:"none",fontSize:Number(newsStyle.fontSize||14),fontFamily:newsStyle.fontFamily||"inherit",fontWeight:Number(newsStyle.fontWeight||400),fontStyle:newsStyle.fontStyle||"normal",color:newsStyle.color||"#333",textAlign:newsStyle.textAlign||"left",resize:"vertical",width:"100%",boxSizing:"border-box",outline:"none",display:"block"}}/>
              </div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                <div style={{flex:1,minWidth:140}}>
                  <div style={{fontSize:11,fontWeight:700,color:"rgba(0,0,0,0.45)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:4}}>Event Date (optional)</div>
                  <input type="date" value={newsForm.event_date} onChange={e=>setNewsForm(f=>({...f,event_date:e.target.value}))}
                    style={{padding:"8px 10px",border:"1px solid #ddd",borderRadius:8,fontSize:14,fontFamily:"inherit",width:"100%",boxSizing:"border-box"}}/>
                </div>
                <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",paddingTop:18,fontSize:14,fontWeight:600,color:"#333",flexShrink:0}}>
                  <input type="checkbox" checked={newsForm.pinned} onChange={e=>setNewsForm(f=>({...f,pinned:e.target.checked}))} style={{width:16,height:16,cursor:"pointer"}}/>
                  📌 Pin to top
                </label>
              </div>
              {/* Schedule & Expire */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"rgba(0,0,0,0.45)",textTransform:"uppercase",marginBottom:4}}>📅 Go Live At (optional)</div>
                  <input type="datetime-local" value={newsSchedule} onChange={e=>setNewsSchedule(e.target.value)}
                    style={{width:"100%",padding:"7px 10px",border:"1px solid #ddd",borderRadius:7,fontSize:13,fontFamily:"inherit",boxSizing:"border-box"}}/>
                  <div style={{fontSize:11,color:"rgba(0,0,0,0.35)",marginTop:2}}>Leave blank to post immediately</div>
                </div>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"rgba(0,0,0,0.45)",textTransform:"uppercase",marginBottom:4}}>⏰ Auto-Expire At (optional)</div>
                  <input type="datetime-local" value={newsExpire} onChange={e=>setNewsExpire(e.target.value)}
                    style={{width:"100%",padding:"7px 10px",border:"1px solid #ddd",borderRadius:7,fontSize:13,fontFamily:"inherit",boxSizing:"border-box"}}/>
                  <div style={{fontSize:11,color:"rgba(0,0,0,0.35)",marginTop:2}}>Post removes itself automatically</div>
                </div>
              </div>

              <div style={{display:"flex",gap:8}}>
                <button type="button" onClick={saveNewsPost} disabled={!newsForm.title.trim()||newsSaving}
                  style={{flex:1,padding:"11px",background:newsForm.title.trim()?"#002d6e":"#ccc",border:"none",borderRadius:8,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,textTransform:"uppercase",cursor:newsForm.title.trim()?"pointer":"default"}}>
                  {newsSaving ? "Saving…" : newsEditId ? "Save Changes" : newsSchedule && new Date(newsSchedule) > new Date() ? "⏰ Schedule Post" : "Post to Site"}
                </button>
                {newsEditId && (
                  <button type="button" onClick={()=>{setNewsEditId(null);setNewsForm({title:"",body:"",event_date:"",pinned:false});setNewsSchedule("");setNewsExpire("");}}
                    style={{padding:"11px 18px",background:"rgba(0,0,0,0.07)",border:"1px solid rgba(0,0,0,0.15)",borderRadius:8,fontWeight:700,fontSize:14,cursor:"pointer",color:"#555"}}>
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Existing posts */}
            {newsLoading && <div style={{textAlign:"center",padding:20,color:"#888"}}>Loading…</div>}
            {!newsLoading && newsItems.length === 0 && (
              <div style={{textAlign:"center",padding:20,color:"#aaa",fontSize:13}}>No posts yet. Add your first announcement above.</div>
            )}
            {newsItems.map((item,i) => (
              <div key={item.id||i} style={{background:"#f8f9fb",border:"1px solid rgba(0,0,0,0.09)",borderLeft:`4px solid ${item.pinned?"#b45309":"#002d6e"}`,borderRadius:8,padding:"12px 16px",display:"flex",gap:12,alignItems:"flex-start"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:2}}>
                    {item.pinned && <span style={{background:"#b45309",color:"#fff",fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:10,textTransform:"uppercase"}}>📌 Pinned</span>}
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,textTransform:"uppercase",color:"#111"}}>{item.title}</div>
                  </div>
                  {item.event_date && <div style={{fontSize:11,color:"#b45309",fontWeight:700,marginBottom:2}}>📅 {item.event_date}</div>}
                  {item.body && <div style={{fontSize:13,color:"#555",lineHeight:1.5,whiteSpace:"pre-wrap"}}>{item.body}</div>}
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <button type="button" onClick={()=>startEditNews(item)}
                    style={{padding:"5px 10px",background:"#002d6e",border:"none",borderRadius:6,color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>✏️</button>
                  <button type="button" onClick={()=>deleteNewsPost(item.id)}
                    style={{padding:"5px 10px",background:"rgba(220,38,38,0.09)",border:"1px solid rgba(220,38,38,0.25)",borderRadius:6,color:"#dc2626",fontWeight:700,fontSize:12,cursor:"pointer"}}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>}

        {/* Quick Actions */}
        {quickView==="schedule"     ? <ManageSchedulePage onBack={()=>setQuickView(null)}/> :
         quickView==="tournaments"  ? <TournamentManagerPage onBack={()=>setQuickView(null)}/> :
         quickView==="eligibility"  ? <PlayerEligibilityPage onBack={()=>setQuickView(null)}/> :
         quickView==="email"        ? <WeeklyEmailPage onBack={()=>setQuickView(null)}/> :
         quickView==="live"         ? <LiveScorerPage onExit={()=>setQuickView(null)}/> :
         quickView==="teams"        ? <ManageTeamsPage onBack={()=>setQuickView(null)}/> :
         quickView==="games"    ? (
          <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid rgba(0,0,0,0.07)",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <button type="button" onClick={()=>setQuickView(null)} style={{padding:"5px 12px",background:"rgba(0,0,0,0.07)",border:"none",borderRadius:6,fontWeight:700,fontSize:13,cursor:"pointer"}}>← Back</button>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,textTransform:"uppercase",color:"#111"}}>🗂️ Manage Saved Games</div>
              <div style={{display:"flex",gap:6,marginLeft:8}}>
                {["Saturday","Boomers 60/70"].map((label,i) => (
                  <button key={i} type="button" onClick={()=>{setAdminGamesLeague(i);loadAdminGames(i);}} style={{
                    padding:"4px 12px",borderRadius:12,cursor:"pointer",border:"1px solid",fontWeight:700,fontSize:12,
                    background:adminGamesLeague===i?"#002d6e":"#fff",
                    color:adminGamesLeague===i?"#fff":"#555",
                    borderColor:adminGamesLeague===i?"#002d6e":"rgba(0,0,0,0.15)",
                  }}>{label}</button>
                ))}
              </div>
              <button type="button" onClick={()=>loadAdminGames(adminGamesLeague)} style={{marginLeft:"auto",padding:"5px 12px",background:"rgba(0,45,110,0.07)",border:"1px solid rgba(0,45,110,0.2)",borderRadius:6,fontWeight:700,fontSize:12,color:"#002d6e",cursor:"pointer"}}>↻ Refresh</button>
            </div>
            <div style={{padding:"16px 20px"}}>
              {adminGamesLoading && <div style={{textAlign:"center",padding:30,color:"#888"}}>Loading…</div>}
              {!adminGamesLoading && adminGames.length===0 && <div style={{textAlign:"center",padding:30,color:"#888"}}>No saved games found.</div>}
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {adminGames.map((g,i)=>(
                  <div key={i} style={{background:"#f8f9fb",border:"1px solid rgba(0,0,0,0.09)",borderLeft:"4px solid #002d6e",borderRadius:8,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,textTransform:"uppercase"}}>
                        {g.away_team} <span style={{color:"#aaa",fontWeight:400}}>@</span> {g.home_team}
                      </div>
                      <div style={{fontSize:11,color:"#888",marginTop:2}}>
                        {g.game_date} · <strong style={{color:"#002d6e"}}>{g.away_score ?? "?"} – {g.home_score ?? "?"}</strong> · {g.status||"Final"}
                        {cleanHeadline(g.headline) && <span style={{marginLeft:6,color:"#444"}}>· {cleanHeadline(g.headline)}</span>}
                      </div>
                    </div>
                    {scoreEditId===g.id && (
                      <div style={{width:"100%",display:"flex",alignItems:"center",gap:8,background:"#fffbe6",border:"1px solid #fcd34d",borderRadius:6,padding:"6px 10px",marginTop:6}}>
                        <span style={{fontSize:12,fontWeight:700,color:"#92400e"}}>Fix Score:</span>
                        <input type="number" value={scoreEditAway} onChange={e=>setScoreEditAway(e.target.value)} placeholder="Away" style={{width:52,padding:"3px 6px",border:"1px solid #ccc",borderRadius:4,fontSize:13,textAlign:"center"}} />
                        <span style={{fontWeight:700,color:"#555"}}>–</span>
                        <input type="number" value={scoreEditHome} onChange={e=>setScoreEditHome(e.target.value)} placeholder="Home" style={{width:52,padding:"3px 6px",border:"1px solid #ccc",borderRadius:4,fontSize:13,textAlign:"center"}} />
                        <button type="button" onClick={async()=>{
                          try{
                            await sbPatch(`games?id=eq.${g.id}`,{away_score:parseInt(scoreEditAway)||0,home_score:parseInt(scoreEditHome)||0});
                            setAdminGames(prev=>prev.map(x=>x.id===g.id?{...x,away_score:parseInt(scoreEditAway)||0,home_score:parseInt(scoreEditHome)||0}:x));
                            setScoreEditId(null);
                          }catch(err){alert("Score update failed: "+err.message);}
                        }} style={{padding:"3px 12px",background:"#002d6e",border:"none",borderRadius:4,color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>Save</button>
                        <button type="button" onClick={()=>setScoreEditId(null)} style={{padding:"3px 10px",background:"rgba(0,0,0,0.07)",border:"none",borderRadius:4,fontWeight:700,fontSize:12,cursor:"pointer"}}>✕</button>
                      </div>
                    )}
                    <div style={{display:"flex",gap:8,flexShrink:0}}>
                      <button type="button" onClick={()=>{setScoreEditId(g.id);setScoreEditAway(String(g.away_score??""));setScoreEditHome(String(g.home_score??""));}} style={{padding:"6px 12px",background:"rgba(234,179,8,0.12)",border:"1px solid rgba(234,179,8,0.5)",borderRadius:6,color:"#92400e",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                        🔢 Score
                      </button>
                      <button type="button" onClick={()=>{
                        setPreloadGame(g);
                        setQuickView(null);
                        setShowBoxScore(true);
                      }} style={{padding:"6px 14px",background:"#002d6e",border:"none",borderRadius:6,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                        ✏️ Edit
                      </button>
                      <button type="button" onClick={async()=>{
                        if(!window.confirm(`Reset ${g.away_team} vs ${g.home_team} (${g.game_date}) to 0–0?\n\nThis will erase ALL stats and scores for this game. Cannot be undone.`)) return;
                        try{
                          await sbDelete(`batting_lines?game_id=eq.${g.id}`);
                          await sbDelete(`pitching_lines?game_id=eq.${g.id}`);
                          await sbPatch(`games?id=eq.${g.id}`, {away_score:null,home_score:null,status:"Scheduled",headline:null});
                          setAdminGames(prev=>prev.map(x=>x.id===g.id?{...x,away_score:null,home_score:null,status:"Scheduled",headline:null}:x));
                          alert("Game reset successfully.");
                        }catch(err){alert("Reset failed: "+err.message);}
                      }} style={{padding:"6px 12px",background:"rgba(234,179,8,0.1)",border:"1px solid rgba(234,179,8,0.4)",borderRadius:6,color:"#b45309",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                        🔄 Reset
                      </button>
                      <button type="button" onClick={async()=>{
                        if(!window.confirm(`Delete ${g.away_team} vs ${g.home_team} (${g.game_date})?\nThis cannot be undone.`)) return;
                        try{
                          await sbDelete(`batting_lines?game_id=eq.${g.id}`);
                          await sbDelete(`pitching_lines?game_id=eq.${g.id}`);
                          await sbDelete(`games?id=eq.${g.id}`);
                          setAdminGames(prev=>prev.filter(x=>x.id!==g.id));
                        }catch(err){alert("Delete failed: "+err.message);}
                      }} style={{padding:"6px 12px",background:"rgba(220,38,38,0.09)",border:"1px solid rgba(220,38,38,0.25)",borderRadius:6,color:"#dc2626",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
         ) : (
          <>
            {showBoxScore ? (
              <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:12,overflow:"hidden"}}>
                <div style={{padding:"16px 20px",borderBottom:"1px solid rgba(0,0,0,0.07)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,textTransform:"uppercase",color:"#111"}}>⚾ Box Score Entry</div>
                  <button type="button" onClick={()=>{setShowBoxScore(false);setPreloadGame(null);}} style={{padding:"5px 12px",background:"rgba(0,0,0,0.07)",border:"none",borderRadius:6,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",textTransform:"uppercase"}}>✕ Close</button>
                </div>
                <div style={{padding:"20px"}}>
                  <BoxScoreEntry key={preloadGame?.id || "new"} onClose={()=>{setShowBoxScore(false);setPreloadGame(null);}} preloadGame={preloadGame} />
                </div>
              </div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}}>
                {[
                  {icon:"⚡",title:"Score Live",desc:"Score a game in real time",accent:"#16a34a",action:()=>setQuickView("live")},
                  {icon:"🚨",title:"League Alert Banner",desc:"Post urgent site-wide notices",accent:hasAlert?"#dc2626":"#002d6e",badge:hasAlert?"ACTIVE":null,action:()=>setQuickView("alert")},
                  {icon:"📰",title:"News & Events",desc:"Post announcements to the Home page",accent:"#b45309",action:()=>{setQuickView("news");loadNews();}},
                  {icon:"📊",title:"Enter Box Score",desc:"Enter this week's results",accent:"#002d6e",action:()=>{setPreloadGame(null);setShowBoxScore(true);}},
                  {icon:"🗂️",title:"Manage Games",desc:"Edit or delete saved games",accent:"#dc2626",action:()=>{setQuickView("games");loadAdminGames();}},
                  {icon:"🏆",title:"Tournaments",desc:"Add tournament games to schedule",accent:"#002d6e",action:()=>setQuickView("tournaments")},
                  {icon:"🏅",title:"Player Eligibility",desc:"Track fees paid & game appearances",accent:"#002d6e",action:()=>setQuickView("eligibility")},
                  {icon:"📧",title:"Send Weekly Email",desc:"Copy results to clipboard",accent:"#002d6e",action:()=>setQuickView("email")},
                  {icon:"📅",title:"Manage Schedule",desc:"View season schedule",accent:"#002d6e",action:()=>setQuickView("schedule")},
                  {icon:"📜",title:"Edit Rules",desc:"Update Field Guide rules & sections",accent:"#002d6e",action:()=>setScreen("admin_rules")},
                  {icon:"📸",title:"Photos & Videos",desc:"Add or remove gallery items",accent:"#002d6e",action:()=>setScreen("admin_photos")},
                  {icon:"⚾",title:"Manage Teams",desc:"Add tournament or custom teams",accent:"#b45309",action:()=>setQuickView("teams")},
                  {icon:"🤝",title:"Edit Sponsors",desc:"Add or remove sponsor cards",accent:"#002d6e",action:()=>setScreen("admin_sponsors")},
                  {icon:"🏟️",title:"Field Directions",desc:"Edit field notes and addresses",accent:"#002d6e",action:()=>setScreen("admin_fields")},
                  {icon:"📞",title:"Contact Info",desc:"Email, phone, Venmo, QR, credits",accent:"#002d6e",action:()=>setScreen("admin_contact")},
                  {icon:"📋",title:"Player Sign-Ups",desc:"View all sign-up submissions",accent:"#16a34a",action:()=>setScreen("admin_signups")},
                ].map((a,i)=>(
                  <div key={i} onClick={a.action} style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderTop:`3px solid ${a.accent}`,borderRadius:10,padding:"16px 18px",cursor:"pointer",transition:"box-shadow .15s",position:"relative"}}
                    onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(0,45,110,0.15)"}
                    onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
                    {a.badge && <div style={{position:"absolute",top:10,right:10,background:a.accent,color:"#fff",fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,textTransform:"uppercase",letterSpacing:".06em"}}>{a.badge}</div>}
                    <div style={{fontSize:24,marginBottom:8}}>{a.icon}</div>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,color:"#111",textTransform:"uppercase"}}>{a.title}</div>
                    <div style={{fontSize:12,color:"rgba(0,0,0,0.4)",marginTop:3}}>{a.desc}</div>
                  </div>
                ))}
                <button onClick={()=>setScreen("admin_rosters")} style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderTop:"3px solid #002d6e",borderRadius:12,padding:"20px",textAlign:"left",cursor:"pointer",transition:"box-shadow .15s"}}
                  onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.1)"}
                  onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
                  <div style={{fontSize:28,marginBottom:8}}>👥</div>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,color:"#111",textTransform:"uppercase",marginBottom:4}}>Manage Rosters</div>
                  <div style={{fontSize:12,color:"rgba(0,0,0,0.45)"}}>Add, edit, reorder players on any team</div>
                </button>
                <LocalStorageMigrationButton />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── SUPABASE CONFIG ───────────────────────────────────────────────────── */
const SB_URL = "https://vhovzpajuyphjatjlodo.supabase.co";
const SB_KEY = "sb_publishable_btmQX9enbqeWvKPHLRVVgA_kdObTZxC";

// Returns a Supabase filter string that matches ALL Saturday league season IDs
// (games may live in "Spring/Summer 2026" OR "Spring/Summer 2026 Diamond Classics Saturdays")
const getSatSeasonFilter = (seasons) => {
  const ids = seasons
    .filter(x => x.name.includes("Diamond Classics Saturdays") || (x.name.includes("Spring") && x.name.includes("2026")))
    .map(x => x.id);
  return ids;
};
const getSatSeason = (seasons) => {
  // Prefer the more specific "Diamond Classics Saturdays" season for NEW inserts,
  // but for reads always use getSatSeasonFilter to cover both
  return seasons.find(x => x.name.includes("Diamond Classics Saturdays")) || seasons.find(x => x.name.includes("Spring") && x.name.includes("2026"));
};

// Deduplicate game records: same away+home+date → keep highest run total (or highest id)
const dedupGames = (games) => {
  const seen = {};
  (games || []).forEach(g => {
    const key = `${g.game_date||"null"}|${g.away_team}|${g.home_team}`;
    const score = (g.away_score||0) + (g.home_score||0);
    const cur = seen[key];
    const hasHl = !!g.headline;
    if (!cur
      || score > cur.score
      || (score === cur.score && hasHl && !cur.hasHl)
      || (score === cur.score && hasHl === cur.hasHl && (g.id||0) > (cur.id||0))) {
      seen[key] = { ...g, score, hasHl };
    }
  });
  const pass1 = Object.values(seen).map(({score, hasHl, ...rest}) => rest);
  const dated = pass1.filter(g => g.game_date);
  const nullDates = pass1.filter(g => !g.game_date);
  if (!nullDates.length) return pass1;
  const result = [...dated];
  nullDates.forEach(ng => {
    const ngTot = (ng.away_score||0)+(ng.home_score||0);
    const ngHl = !!ng.headline;
    const match = result.find(dg => dg.away_team===ng.away_team && dg.home_team===ng.home_team);
    if (match) {
      const mTot = (match.away_score||0)+(match.home_score||0);
      const mHl = !!match.headline;
      const ngWins = ngTot > mTot || (ngTot===mTot && ngHl && !mHl);
      if (ngWins) result[result.indexOf(match)] = {...ng, game_date:match.game_date};
    } else {
      result.push(ng);
    }
  });
  return result;
};

// Translate raw Supabase / network errors into plain-English messages for end users
function friendlyError(e) {
  const msg = (e?.message || "").toLowerCase();
  if (/409|duplicate|unique.constraint/.test(msg))   return "This game has already been saved — use Edit to update it.";
  if (/42501|row.level.security|permission denied/.test(msg)) return "Permission denied — please contact your admin.";
  if (/23503|foreign key/.test(msg))                 return "A referenced record wasn't found — refresh and try again.";
  if (/failed to fetch|networkerror|load failed/.test(msg))  return "Connection error — check your internet and try again.";
  // Pass through our own clear messages unchanged
  if (/could not (find|create)|was not created|select a game/i.test(e?.message || "")) return e.message;
  return "Something went wrong — please try again.";
}

async function sbFetch(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      Accept: "application/json",
      Prefer: "return=representation",
    }
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`Supabase error ${r.status}: ${body}`);
  }
  return r.json();
}

async function sbPost(path, body) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`Supabase ${r.status}: ${text}`);
  }
  return r.json();
}

async function sbPatch(path, body) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const text = await r.text().catch(()=>""); throw new Error(`Supabase ${r.status}: ${text}`); }
  return r.json();
}

async function sbDelete(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: "DELETE",
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Accept: "application/json" },
  });
  if (!r.ok) { const text = await r.text().catch(()=>""); throw new Error(`Supabase ${r.status}: ${text}`); }
}

async function sbUpsert(path, body) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      Prefer: "return=representation,resolution=merge-duplicates",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const text = await r.text().catch(()=>""); throw new Error(`Supabase ${r.status}: ${text}`); }
  return r.json();
}

// ── Save-status toast ──────────────────────────────────────────────────────
//
// Many admin save paths historically used `.catch(()=>{})` to swallow errors,
// so the user got no feedback when a save failed (RLS denial, network drop,
// schema mismatch, missing table). That caused the "I clicked save and
// nothing happened" complaints.
//
// safeSave(label, fn) wraps the save call. On success it shows a green toast.
// On failure it shows a red toast that the user must dismiss. Always returns
// { ok, data?, err? } so callers can also branch locally if they want.
//
// Mount <SaveStatusToast/> once at App root.
let _SAVE_STATUS = null;            // { type: "success"|"error", msg, ts }
const _SAVE_LISTENERS = new Set();
function _setSaveStatus(s) {
  _SAVE_STATUS = s;
  _SAVE_LISTENERS.forEach(fn => { try { fn(s); } catch(e){} });
}
function flashSaveOk(msg = "Saved") {
  const ts = Date.now();
  _setSaveStatus({ type: "success", msg, ts });
  setTimeout(() => {
    if (_SAVE_STATUS && _SAVE_STATUS.ts === ts) _setSaveStatus(null);
  }, 2400);
}
function flashSaveErr(msg) {
  _setSaveStatus({ type: "error", msg, ts: Date.now() });
}
function useSaveStatus() {
  const [s, set] = useState(_SAVE_STATUS);
  useEffect(() => { _SAVE_LISTENERS.add(set); return () => { _SAVE_LISTENERS.delete(set); }; }, []);
  return s;
}
function SaveStatusToast() {
  const s = useSaveStatus();
  if (!s) return null;
  const isErr = s.type === "error";
  return (
    <div onClick={() => _setSaveStatus(null)} style={{
      position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)",
      zIndex: 9999, padding: "10px 16px", borderRadius: 8,
      background: isErr ? "#dc2626" : "#16a34a", color: "#fff",
      fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 14,
      boxShadow: "0 4px 14px rgba(0,0,0,0.25)", cursor: "pointer",
      maxWidth: "calc(100vw - 24px)", textAlign: "center", lineHeight: 1.3,
    }}>
      {isErr ? "⚠ " : "✓ "}{s.msg}
      {isErr && <span style={{marginLeft: 10, opacity: 0.85, fontSize: 11, fontWeight: 400}}>(tap to dismiss)</span>}
    </div>
  );
}
async function safeSave(label, fn) {
  try {
    const data = await fn();
    flashSaveOk(`${label} saved`);
    return { ok: true, data };
  } catch (e) {
    const msg = (e && e.message) || String(e);
    flashSaveErr(`${label} save failed — ${msg.slice(0, 160)}`);
    return { ok: false, err: msg };
  }
}

// Fetch batting/pitching lines for a list of game IDs in batches of 100
// More reliable than offset pagination — avoids PostgreSQL ordering issues
async function sbFetchLinesByGameIds(table, selectCols, gameIds) {
  if (!gameIds || gameIds.length === 0) return [];
  const BATCH = 100;
  const results = [];
  for (let i = 0; i < gameIds.length; i += BATCH) {
    const chunk = gameIds.slice(i, i + BATCH);
    const rows = await sbFetch(`${table}?select=${selectCols}&game_id=in.(${chunk.join(",")})&limit=1000`);
    results.push(...rows);
  }
  return results;
}

// Paginated fetch — bypasses Supabase's 1000-row cap (with ordering for consistency)
async function sbFetchAll(path) {
  const allRows = [];
  const PAGE = 1000;
  let offset = 0;
  const base = path.includes("?") ? path + "&" : path + "?";
  while (true) {
    const rows = await sbFetch(`${base}limit=${PAGE}&offset=${offset}&order=id.asc`);
    allRows.push(...rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return allRows;
}

function parseIP(str) {
  const s = String(str || "0");
  const [whole, frac] = s.split(".");
  return (parseInt(whole) || 0) + (parseInt(frac) || 0) / 3;
}

/* ─── BOX SCORE ENTRY ────────────────────────────────────────────────────── */
// These MUST be module-level (not defined inside BoxScoreEntry) so React
// never remounts them on state changes — which caused scroll-to-top.
function BSH2({n,title,sub}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
      <div style={{width:26,height:26,borderRadius:"50%",background:"#FFD700",color:"#001a3e",
        fontSize:12,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{n}</div>
      <div>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,
          textTransform:"uppercase",color:"#111",lineHeight:1}}>{title}</div>
        {sub&&<div style={{fontSize:11,color:"#888",marginTop:1}}>{sub}</div>}
      </div>
    </div>
  );
}
function BSCrd({children,style={}}) {
  return (
    <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:12,
      padding:"16px",marginBottom:14,...style}}>{children}</div>
  );
}

function BoxScoreEntry({ onClose, captainTeam="", preloadGame=null }) {
  const BASE_TEAMS = Object.keys(TEAM_ROSTERS);
  const [extraTeams, setExtraTeams] = useState([]);
  const TEAMS = [...BASE_TEAMS, ...extraTeams];
  const POSITIONS = ["","P","C","1B","2B","3B","SS","LF","CF","RF","DH","PH","PR"];
  const BAT_STATS = ["ab","r","singles","doubles","triples","hr","rbi","bb","k","sb","sf","sac","fc","roe","cs","e"];
  const BAT_LBLS  = ["AB","R","1B","2B","3B","HR","RBI","BB","K","SB","SF","SAC","FC","ROE","CS","E"];

  const blankBatter = (name="") => ({ _id:Math.random(), name, on:true, ab:0,r:0,singles:0,doubles:0,triples:0,hr:0,rbi:0,bb:0,k:0,sb:0,sf:0,sac:0,fc:0,roe:0,cs:0,e:0, pos:"" });
  const blankPitcher = (name="") => ({ name, ip:"", h:0,r:0,er:0,bb:0,k:0,hr:0, decision:"ND" });
  const initBatters = (team) => (TEAM_ROSTERS[team]||[]).map(p => typeof p === "string" ? p : p.name).filter(p=>p!=="TBD").map(blankBatter);

  // ── Game selection ──
  const allGames = [
    ...SCHED.flatMap(w => w.fields.flatMap(f => f.games.map(g => ({ date:w.label, field:f.name, time:g.time, away:g.away, home:g.home })))),
    ...BOOMERS_SCHED.map(g => ({ date:g.date, field:g.field, time:g.time, away:g.away, home:g.home })),
  ].filter(g => !captainTeam || g.away===captainTeam || g.home===captainTeam);
  const [game, setGame] = useState(null);
  const [customMode, setCustomMode] = useState(false);
  const [custom, setCustom] = useState({ date:"", time:"", field:"", away:TEAMS[0], home:TEAMS[1] });

  // ── Score & info ──
  const [awayScore, setAwayScore] = useState("");
  const [homeScore, setHomeScore] = useState("");
  const [headline, setHeadline] = useState("");
  const [gameStatus, setGameStatus] = useState("Final");

  // ── Linescore (9 innings) ──
  const emptyInnings = () => Array(9).fill(0).map(()=>({r:""}));
  const [awayInn, setAwayInn] = useState(emptyInnings());
  const [homeInn, setHomeInn] = useState(emptyInnings());
  const [awayH, setAwayH] = useState(""); const [awayE, setAwayE] = useState("");
  const [homeH, setHomeH] = useState(""); const [homeE, setHomeE] = useState("");

  // ── Batting ──
  const [awayBat, setAwayBat] = useState([]);
  const [homeBat, setHomeBat] = useState([]);
  const [addAwayName, setAddAwayName] = useState(""); const [addHomeName, setAddHomeName] = useState("");
  const [awayStatMode, setAwayStatMode] = useState("simple"); // "simple" | "full"
  const [homeStatMode, setHomeStatMode] = useState("simple");

  // ── Pitching ──
  const [awayPit, setAwayPit] = useState([blankPitcher()]);
  const [homePit, setHomePit] = useState([blankPitcher()]);

  // ── Recap ──
  const [recap, setRecap] = useState("");

  // ── Lineup order phase (captain portal only) ──
  // "entry" = show full form immediately (admin / edit mode)
  // "lineup" = show batting order setup first, then go to "entry"
  const [bsePhase, setBsePhase] = useState("entry");
  const [scoreOnlyMode, setScoreOnlyMode] = useState(false);
  const [lineupOrder, setLineupOrder] = useState([]); // player names in tap order
  const [lineupNameInput, setLineupNameInput] = useState("");
  const [rosterFetched, setRosterFetched] = useState(false); // true once Supabase roster merge is done

  // ── Drag & drop batting order ──
  const dragRef = useRef({idx:null, side:null});
  const [dragVisual, setDragVisual] = useState({idx:null, side:null}); // for visual feedback only

  // ── Tap-to-order mode ──
  const [awayOrderMode, setAwayOrderMode] = useState(false);
  const [homeOrderMode, setHomeOrderMode] = useState(false);
  const [awayOrderQueue, setAwayOrderQueue] = useState([]); // _ids in tap order
  const [homeOrderQueue, setHomeOrderQueue] = useState([]);

  // ── Load extra (tournament) teams from Supabase ──
  useEffect(() => {
    sbFetch("lbdc_schedules?id=eq.teams&select=data")
      .then(rows => {
        if (rows && rows[0] && Array.isArray(rows[0].data)) {
          setExtraTeams(rows[0].data.filter(t => !BASE_TEAMS.includes(t)));
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-load a game when opened from "Manage Games" → Edit ──
  useEffect(() => {
    if (preloadGame) selectSavedGame(preloadGame);
    if (captainTeam) loadSavedGames(); // load so we can hide already-submitted games from schedule
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── localStorage draft persistence ──
  const bseDraftKey = (g) => g ? `bse_draft_${g.away}_${g.home}_${g.date}`.replace(/[\s/]/g,"_") : null;
  // Auto-save draft whenever key fields change (only when a game is selected and not in edit mode)
  useEffect(() => {
    if (!game || editGameId) return;
    const key = bseDraftKey(game);
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify({
        awayBat, homeBat, awayPit, homePit,
        awayScore, homeScore, headline,
        awayStatMode, homeStatMode,
        awayInn, homeInn, awayH, awayE, homeH, homeE,
        gameStatus,
      }));
    } catch(e) { /* ignore quota errors */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awayBat, homeBat, awayPit, homePit, awayScore, homeScore, headline, awayStatMode, homeStatMode, awayInn, homeInn, awayH, awayE, homeH, homeE, gameStatus]);

  // ── Save ──
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  // ── Auto-calculate score / H / E from batting stats (only in "full" mode) ──
  const totalH = (rows) => rows.reduce((s,p)=>s+(+p.singles||0)+(+p.doubles||0)+(+p.triples||0)+(+p.hr||0),0);
  useEffect(() => {
    if(awayStatMode !== "full") return;
    if(editGameId) return; // don't overwrite loaded score during edit
    const active = awayBat.filter(p=>p.on);
    if(!active.length) return;
    setAwayScore(String(active.reduce((s,p)=>s+(+p.r||0),0)));
    setAwayH(String(totalH(active)));
    setAwayE(String(active.reduce((s,p)=>s+(+p.e||0),0)));
  }, [awayBat, awayStatMode]);
  useEffect(() => {
    if(homeStatMode !== "full") return;
    if(editGameId) return; // don't overwrite loaded score during edit
    const active = homeBat.filter(p=>p.on);
    if(!active.length) return;
    setHomeScore(String(active.reduce((s,p)=>s+(+p.r||0),0)));
    setHomeH(String(totalH(active)));
    setHomeE(String(active.reduce((s,p)=>s+(+p.e||0),0)));
  }, [homeBat, homeStatMode]);

  // ── Edit mode (loading a previously saved game) ──
  const [editGameId, setEditGameId] = useState(null);
  const [editSubmittedTag, setEditSubmittedTag] = useState(""); // preserves "[submitted: X]" through re-saves
  const [savedGames, setSavedGames] = useState([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [editMode, setEditMode] = useState(false); // true = showing saved games list

  // Convert stored decimal IP back to "6.2" format for display
  const fromIP = (val) => {
    if(!val && val!==0) return "";
    const v=+val; if(isNaN(v)) return "";
    const whole=Math.floor(v), outs=Math.round((v-whole)*3);
    return outs===0?`${whole}.0`:`${whole}.${outs}`;
  };

  const loadSavedGames = () => {
    setSavedLoading(true);
    sbFetch("seasons?select=id,name&limit=50")
      .then(async seasons => {
        const satIds = getSatSeasonFilter(seasons);
        const bom = seasons.find(x=>x.name.toLowerCase().includes("boomers"));
        const fetches = [];
        if (satIds.length) fetches.push(sbFetch(`games?select=id,game_date,game_time,away_team,home_team,away_score,home_score,field,status,headline&season_id=in.(${satIds.join(",")})&away_score=not.is.null&order=game_date.desc&limit=50`));
        if (bom) fetches.push(sbFetch(`games?select=id,game_date,game_time,away_team,home_team,away_score,home_score,field,status,headline&season_id=eq.${bom.id}&away_score=not.is.null&order=game_date.desc&limit=50`));
        const results = await Promise.all(fetches);
        return results.flat().sort((a,b)=>b.game_date?.localeCompare(a.game_date||"")||0);
      })
      .then(games=>{
        const filtered = (games||[]).filter(g => !captainTeam || g.away_team===captainTeam || g.home_team===captainTeam);
        setSavedGames(filtered); setSavedLoading(false);
      })
      .catch(()=>setSavedLoading(false));
  };

  const selectSavedGame = async (g) => {
    setSavedLoading(true);
    try {
      const [batLines, pitLines] = await Promise.all([
        sbFetch(`batting_lines?select=*&game_id=eq.${g.id}&limit=100`),
        sbFetch(`pitching_lines?select=*&game_id=eq.${g.id}&limit=50`),
      ]);
      const toB = (b,bid=Math.random()) => {
        const d=+b.doubles||0, t=+b.triples||0, hr=+b.hr||0;
        return {
          _id:bid, name:b.player_name, on:true,
          ab:+b.ab||0, r:+b.r||0,
          singles:Math.max(0,(+b.h||0)-d-t-hr), doubles:d, triples:t, hr,
          rbi:+b.rbi||0, bb:+b.bb||0, k:+b.k||0, sb:+b.sb||0, e:0, pos:"",
        };
      };
      const toP = (p) => ({
        name:p.player_name, ip:fromIP(p.ip),
        h:+p.h||0, r:+p.r||0, er:+p.er||0, bb:+p.bb||0, k:+p.k||0, hr:+p.hr||0,
        decision:p.decision||"ND",
      });
      const awayB=batLines.filter(b=>b.team===g.away_team);
      const homeB=batLines.filter(b=>b.team===g.home_team);
      const awayP=pitLines.filter(p=>p.team===g.away_team);
      const homeP=pitLines.filter(p=>p.team===g.home_team);
      setEditGameId(g.id);
      setGame({date:g.game_date, time:g.game_time||"", field:g.field||"", away:g.away_team, home:g.home_team});
      setAwayScore(String(g.away_score??"")); setHomeScore(String(g.home_score??""));
      // Strip "[submitted: X]" from the displayed headline but save it so re-saving doesn't wipe it
      const submittedMatch = (g.headline||"").match(/\s*\[submitted:[^\]]*\]/);
      setEditSubmittedTag(submittedMatch ? submittedMatch[0] : "");
      setHeadline((g.headline||"").replace(/\s*\[submitted:[^\]]*\]/,"").trim());
      setGameStatus(g.status||"Final");
      setAwayBat(awayB.length?awayB.map(toB):initBatters(g.away_team));
      setHomeBat(homeB.length?homeB.map(toB):initBatters(g.home_team));
      setAwayPit(awayP.length?awayP.map(toP):[blankPitcher()]);
      setHomePit(homeP.length?homeP.map(toP):[blankPitcher()]);
      setAwayStatMode(awayB.length ? "full" : "simple");
      setHomeStatMode(homeB.length ? "full" : "simple");
      setAwayInn(emptyInnings()); setHomeInn(emptyInnings());
      setAwayH(""); setAwayE(""); setHomeH(""); setHomeE("");
      setSaveMsg(null); setEditMode(false);
    } catch(err){ setSaveMsg({ok:false,text:`❌ ${friendlyError(err)}`}); }
    setSavedLoading(false);
  };

  const selectGame = (g) => {
    setGame(g);
    // Restore from localStorage draft if one exists for this game
    const draftKey = bseDraftKey(g);
    let draft = null;
    if (draftKey) {
      try { draft = JSON.parse(localStorage.getItem(draftKey)); } catch(e) { draft = null; }
    }
    if (draft) {
      const freshIds = (arr) => (arr||[]).map(b => ({...b, _id: Math.random()}));
      setAwayBat(freshIds(draft.awayBat || initBatters(g.away)));
      setHomeBat(freshIds(draft.homeBat || initBatters(g.home)));
      setAwayPit(draft.awayPit || [blankPitcher()]);
      setHomePit(draft.homePit || [blankPitcher()]);
      setAwayScore(draft.awayScore ?? "");
      setHomeScore(draft.homeScore ?? "");
      setHeadline(draft.headline ?? "");
      setAwayStatMode(draft.awayStatMode || "simple");
      setHomeStatMode(draft.homeStatMode || "simple");
      setAwayInn(draft.awayInn || emptyInnings());
      setHomeInn(draft.homeInn || emptyInnings());
      setAwayH(draft.awayH ?? ""); setAwayE(draft.awayE ?? "");
      setHomeH(draft.homeH ?? ""); setHomeE(draft.homeE ?? "");
      setGameStatus(draft.gameStatus || "Final");
    } else {
      setAwayBat(initBatters(g.away));
      setHomeBat(initBatters(g.home));
      setAwayPit([blankPitcher()]); setHomePit([blankPitcher()]);
      setAwayScore(""); setHomeScore(""); setHeadline(""); setRecap("");
      setAwayInn(emptyInnings()); setHomeInn(emptyInnings());
      setAwayH(""); setAwayE(""); setHomeH(""); setHomeE("");
      setAwayStatMode("simple"); setHomeStatMode("simple");
    }
    setSaveMsg(null);
    // Captain portal: go to lineup order step first (unless a draft already exists)
    if (captainTeam) {
      setLineupOrder([]);
      setLineupNameInput("");
      setRosterFetched(false);
      setBsePhase(draft ? "entry" : "lineup");
    }
  };

  // ── Merge Supabase roster players that aren't in the hardcoded list ──
  useEffect(() => {
    if (!game || editGameId) return;
    const away = game.away || game.away_team;
    const home = game.home || game.home_team;
    if (!away || !home) return;
    const teamsToFetch = [...new Set([away, home])];
    Promise.all(
      teamsToFetch.map(t =>
        sbFetch(`lbdc_rosters?select=name,number&team=eq.${encodeURIComponent(t)}&order=name.asc&limit=100`)
          .then(rows => ({ team: t, rows }))
          .catch(() => ({ team: t, rows: [] }))
      )
    ).then(results => {
      results.forEach(({ team, rows }) => {
        const names = rows.map(r => (r.name||"").trim()).filter(Boolean);
        if (!names.length) return;
        const setter = team === away ? setAwayBat : setHomeBat;
        setter(prev => {
          const existing = new Set(prev.map(p => p.name.trim().toLowerCase()));
          const toAdd = names.filter(n => !existing.has(n.toLowerCase()));
          if (!toAdd.length) return prev;
          return [...prev, ...toAdd.map(blankBatter)];
        });
      });
      setRosterFetched(true);
    }).catch(() => setRosterFetched(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  // ── Helpers ──
  const updBat = (setter,i,f,v) => setter(p=>p.map((r,j)=>{
    if(j!==i) return r;
    // pos and name are strings — skip numeric coercion
    if(f==="pos" || f==="name") return {...r,[f]:v};
    const vn = Math.max(0, +v||0);
    const u = {...r, [f]:vn};

    // ── HR changes → delta-track R and RBI in BOTH directions ──
    // Each HR = 1 R (batter scores) + 1 RBI (at minimum). Works for adds AND removes.
    if(f==="hr"){
      const delta = vn - (+r.hr||0);
      u.r   = Math.max(0, (+r.r||0)   + delta);
      u.rbi = Math.max(0, (+r.rbi||0) + delta);
    }

    return u;
  }));
  const updPit = (setter,i,f,v) => setter(p=>p.map((r,j)=>j===i?{...r,[f]:v}:r));
  const moveBat = (setter, i, dir) => setter(prev => {
    const arr = [...prev]; const to = i+dir;
    if(to<0||to>=arr.length) return arr;
    [arr[i],arr[to]]=[arr[to],arr[i]]; return arr;
  });
  const updInn = (setter, i, v) => setter(prev => prev.map((inn,j)=>j===i?{r:v}:inn));

  // ── Stat input ──
  // onWheel blur prevents the page from scrolling when mouse wheel hits a focused number input
  const N = (val, onChange, opts={}) => {
    const cls = opts.className || "";
    const btnStyle = {
      width:28,height:32,border:"1px solid rgba(0,0,0,0.18)",borderRadius:4,
      background:"#eef1f7",cursor:"pointer",fontSize:16,fontWeight:700,
      color:"#002d6e",display:"flex",alignItems:"center",justifyContent:"center",
      flexShrink:0,lineHeight:1,userSelect:"none",WebkitUserSelect:"none",
    };
    return (
      <div className={cls} style={{display:"flex",alignItems:"center",gap:2}}>
        <button type="button" onPointerDown={e=>{e.preventDefault();onChange(Math.max(0,val-1));}} style={btnStyle}>−</button>
        <input type="number" min="0" inputMode="numeric" pattern="[0-9]*" value={val}
          onChange={e=>onChange(Math.max(0,parseInt(e.target.value)||0))}
          onFocus={e=>e.target.select()}
          onWheel={e=>e.target.blur()}
          style={{width:32,padding:"3px 1px",textAlign:"center",border:"1px solid rgba(0,0,0,0.15)",
            borderRadius:4,fontSize:13,background:"#f8f9fb",fontFamily:"inherit",flexShrink:0}}/>
        <button type="button" onPointerDown={e=>{e.preventDefault();onChange(val+1);}} style={btnStyle}>+</button>
      </div>
    );
  };

  // ── Save handler ──
  const handleSave = async () => {
    if(!game){setSaveMsg({ok:false,text:"Select a game first."});return;}
    setSaving(true); setSaveMsg(null);
    try {
      // For captains submitting fresh: tag with team name.
      // For admin editing a previously-captain-submitted game: preserve the original tag.
      // For admin creating new: no tag.
      const submitterTag = captainTeam ? ` [submitted: ${captainTeam}]` : (editGameId ? editSubmittedTag : "");
      const displayHeadline = (headline||"").trim();
      const headlineVal = displayHeadline + submitterTag || null;
      let gid;
      if(editGameId) {
        // UPDATE existing game — also stamp season_id so it's visible to season-filtered queries
        const allSeasonsE = await sbFetch("seasons?select=id,name&limit=50");
        const isBoomerE = BOOMERS_TEAMS.has(game.away) && BOOMERS_TEAMS.has(game.home);
        let seasonE = isBoomerE
          ? (allSeasonsE.find(s=>s.name.includes("Boomers"))||allSeasonsE.find(s=>s.name.toLowerCase().includes("boomers")))
          : (allSeasonsE.find(s=>s.name.includes("Spring")&&s.name.includes("2026"))||allSeasonsE.find(s=>s.name.includes("Diamond Classics")));
        if (!seasonE && !isBoomerE) { const r=await sbFetch(`seasons?select=id,name&name=eq.${encodeURIComponent("Spring/Summer 2026 Diamond Classics Saturdays")}&limit=1`); seasonE=r[0]; }
        const patchData = {
          game_date:toISODate(game.date), game_time:game.time, field:game.field,
          away_team:game.away, home_team:game.home,
          away_score:parseInt(awayScore)||0, home_score:parseInt(homeScore)||0,
          headline:headlineVal, status:gameStatus,
        };
        if (seasonE) patchData.season_id = seasonE.id;
        await sbPatch(`games?id=eq.${editGameId}`, patchData);
        // Delete old lines then reinsert fresh
        await sbDelete(`batting_lines?game_id=eq.${editGameId}`);
        await sbDelete(`pitching_lines?game_id=eq.${editGameId}`);
        gid = editGameId;
      } else {
        // INSERT new game — detect which season based on teams
        const allSeasons = await sbFetch("seasons?select=id,name&limit=50");
        const isBoomerGame = BOOMERS_TEAMS.has(game.away) && BOOMERS_TEAMS.has(game.home);
        let season;
        if (isBoomerGame) {
          season = allSeasons.find(s=>s.name.toLowerCase().includes("boomers"));
          if(!season){const res=await sbPost("seasons",[{name:"2026 BOOMERS 60/70 Division"}]);season=res?.[0];}
        } else {
          season = allSeasons.find(s=>s.name.includes("Diamond Classics Saturdays")||( s.name.includes("Spring")&&s.name.includes("2026")));
          if(!season){const res=await sbPost("seasons",[{name:"Spring/Summer 2026"}]);season=res?.[0];}
        }
        if(!season) throw new Error("Could not find or create a season record — please try again.");
        // Before inserting, check if a game already exists for the same date+teams+season
        // (prevents duplicate rows when captains resubmit)
        const _hsISODate = toISODate(game.date) || null;
        const _hsDateFilter = _hsISODate ? `&game_date=eq.${_hsISODate}` : "";
        const existingHS = await sbFetch(`games?select=id&away_team=eq.${encodeURIComponent(game.away)}&home_team=eq.${encodeURIComponent(game.home)}&season_id=eq.${season.id}${_hsDateFilter}&order=id.desc&limit=1`);
        if (existingHS && existingHS.length) {
          gid = existingHS[0].id;
          await sbPatch(`games?id=eq.${gid}`, {
            season_id:season.id, game_date:_hsISODate, game_time:game.time, field:game.field,
            away_team:game.away, home_team:game.home,
            away_score:parseInt(awayScore)||0, home_score:parseInt(homeScore)||0,
            headline:headlineVal, status:gameStatus,
          });
          // Clear old lines — they'll be reinserted fresh below
          await sbDelete(`batting_lines?game_id=eq.${gid}`);
          await sbDelete(`pitching_lines?game_id=eq.${gid}`);
        } else {
          const gameRes = await sbPost("games",[{
            season_id:season.id, game_date:_hsISODate, game_time:game.time, field:game.field,
            away_team:game.away, home_team:game.home,
            away_score:parseInt(awayScore)||0, home_score:parseInt(homeScore)||0,
            headline:headlineVal, status:gameStatus,
          }]);
          if(!gameRes?.[0]?.id) throw new Error("Game record was not created — please try again.");
          gid = gameRes[0].id;
        }
      }
      const batRows = [
        ...(awayStatMode==="full" ? awayBat.filter(p=>p.on&&p.name).map(p=>({...p,_t:game.away})) : []),
        ...(homeStatMode==="full" ? homeBat.filter(p=>p.on&&p.name).map(p=>({...p,_t:game.home})) : []),
      ].map(({name,_t,ab,r,singles,doubles,triples,hr,rbi,bb,k,sb,sf,sac,fc,roe,cs,e})=>({
        game_id:gid,player_name:cleanName(name),team:_t,
        ab:+ab||0,r:+r||0,
        h:(+singles||0)+(+doubles||0)+(+triples||0)+(+hr||0),
        doubles:+doubles||0,triples:+triples||0,
        hr:+hr||0,rbi:+rbi||0,bb:+bb||0,k:+k||0,sb:+sb||0,hbp:0,
        sf:+sf||0,sac:+sac||0,fc:+fc||0,roe:+roe||0,cs:+cs||0,
      }));
      let statsWarning = "";
      try {
        if(batRows.length) await sbPost("batting_lines",batRows);
        const pitRows = [
          ...awayPit.filter(p=>p.name).map(p=>({...p,_t:game.away})),
          ...homePit.filter(p=>p.name).map(p=>({...p,_t:game.home})),
        ].map(({name,_t,ip,h,r,er,bb,k,decision})=>({
          game_id:gid,player_name:cleanName(name),team:_t,
          ip:parseIP(ip),h:+h||0,r:+r||0,er:+er||0,bb:+bb||0,k:+k||0,
          decision:decision==="ND"?null:decision,
        }));
        if(pitRows.length) await sbPost("pitching_lines",pitRows);
      } catch(statsErr) {
        statsWarning = " (game saved but player stats failed — re-open and save again to retry)";
      }
      setSaveMsg({ok:true,text:`✅ Box score ${editGameId?"updated":"saved"} for ${game.away} vs ${game.home}!${statsWarning}`});
      // Clear localStorage draft after successful submit
      const draftKey = bseDraftKey(game);
      if (draftKey) { try { localStorage.removeItem(draftKey); } catch(e) {} }
    } catch(err){setSaveMsg({ok:false,text:`❌ ${friendlyError(err)}`});}
    setSaving(false);
  };

  // ── Drag helpers ──
  // We store drag info in dataTransfer so it works even across React re-renders.
  // The row div is NOT draggable (that causes every click to scroll to top).
  // Only the ⠿ handle is draggable.
  const handleDragStart = (e, side, i) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({side, i}));
    e.dataTransfer.effectAllowed = "move";
    dragRef.current = {idx:i, side};
    setDragVisual({idx:i, side});
  };
  const handleDragEnd = () => {
    dragRef.current = {idx:null, side:null};
    setDragVisual({idx:null, side:null});
  };
  const handleDrop = (e, side, setter, toIdx) => {
    e.preventDefault();
    let fromIdx = dragRef.current.idx;
    let fromSide = dragRef.current.side;
    // Fallback: read from dataTransfer in case ref was stale
    try {
      const d = JSON.parse(e.dataTransfer.getData("text/plain"));
      if(d.side) { fromIdx = d.i; fromSide = d.side; }
    } catch(_) {}
    dragRef.current = {idx:null, side:null};
    setDragVisual({idx:null, side:null});
    if(fromSide !== side || fromIdx === null || fromIdx === toIdx) return;
    setter(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr;
    });
  };
  const moveTo = (setter, batters, fromIdx, newPos) => {
    const toIdx = Math.max(0, Math.min(batters.length-1, newPos-1));
    if(toIdx === fromIdx) return;
    setter(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr;
    });
  };

  // ── Batting section — called as a function, NOT as <BatSection/>, so React never
  //    unmounts/remounts it on re-render (which caused scroll-to-top + broken drag) ──
  const renderBats = (label,side,batters,setter,addName,setAddName,statMode,setStatMode) => {
    const orderMode  = side==="away" ? awayOrderMode  : homeOrderMode;
    const setOrderMode = side==="away" ? setAwayOrderMode : setHomeOrderMode;
    const orderQueue = side==="away" ? awayOrderQueue : homeOrderQueue;
    const setOrderQueue = side==="away" ? setAwayOrderQueue : setHomeOrderQueue;

    const activeBatters = batters.filter(p=>p.on);

    const startOrderMode = () => {
      setOrderQueue([]);
      setOrderMode(true);
    };
    const tapPlayer = (id) => {
      // If already placed, remove it (tap again to deselect)
      if (orderQueue.includes(id)) {
        setOrderQueue(q => q.filter(qid => qid !== id));
        return;
      }
      const newQueue = [...orderQueue, id];
      setOrderQueue(newQueue);
      // Once all active batters tapped, apply order and exit
      if (newQueue.length === activeBatters.length) {
        setter(prev => {
          const ordered = newQueue.map(qid => prev.find(p=>p._id===qid)).filter(Boolean);
          const inactive = prev.filter(p=>!p.on);
          return [...ordered, ...inactive];
        });
        setOrderMode(false);
        setOrderQueue([]);
      }
    };
    const undoLast = () => setOrderQueue(q=>q.slice(0,-1));
    const cancelOrder = () => { setOrderMode(false); setOrderQueue([]); };

    // ── Tap-to-order overlay ──
    if (orderMode) return (
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:15,
          textTransform:"uppercase",color:"#002d6e",marginBottom:8,borderBottom:"2px solid #002d6e",paddingBottom:4}}>{label}</div>
        <div style={{background:"#002d6e",borderRadius:10,padding:"12px 14px",marginBottom:12}}>
          <div style={{color:"#FFD700",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,marginBottom:4}}>
            Edit Lineup &amp; Batting Order
          </div>
          <div style={{color:"rgba(255,255,255,0.85)",fontSize:12,marginBottom:6,lineHeight:1.5}}>
            Tap each player in batting order — #1 first, then #2, and so on. Skip anyone who didn't play. Use "Add to lineup" below to add players not yet listed.
          </div>
          <div style={{color:"#FFD700",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,marginBottom:10}}>
            {orderQueue.length < activeBatters.length
              ? `👆 Tap your #${orderQueue.length+1} batter…`
              : "✅ All set!"}
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button type="button" onClick={undoLast} disabled={orderQueue.length===0}
              style={{padding:"8px 14px",background:"rgba(255,255,255,0.15)",border:"none",borderRadius:7,
                color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",opacity:orderQueue.length===0?0.4:1}}>
              ↩ Undo
            </button>
            <button type="button" onClick={()=>{
              if(orderQueue.length===0){cancelOrder();return;}
              // Apply whatever has been tapped so far, toggle off the rest
              setter(prev => {
                const tapped = orderQueue.map(qid => prev.find(p=>p._id===qid)).filter(Boolean);
                const untapped = prev.filter(p=>p.on && !orderQueue.includes(p._id)).map(p=>({...p,on:false}));
                const inactive = prev.filter(p=>!p.on);
                return [...tapped,...untapped,...inactive];
              });
              setOrderMode(false); setOrderQueue([]);
            }} disabled={orderQueue.length===0}
              style={{padding:"8px 14px",background:"#22c55e",border:"none",borderRadius:7,
                color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",opacity:orderQueue.length===0?0.4:1}}>
              ✓ Done — {orderQueue.length} player{orderQueue.length!==1?"s":""}
            </button>
            <button type="button" onClick={cancelOrder}
              style={{padding:"8px 14px",background:"rgba(255,255,255,0.1)",border:"none",borderRadius:7,
                color:"rgba(255,255,255,0.6)",fontWeight:700,fontSize:13,cursor:"pointer"}}>
              Cancel
            </button>
          </div>
        </div>
        {/* Player tap grid */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8}}>
          {activeBatters.map(p => {
            const pos = orderQueue.indexOf(p._id);
            const tapped = pos !== -1;
            return (
              <button key={p._id} type="button" onClick={()=>tapPlayer(p._id)}
                style={{
                  padding:"14px 10px",borderRadius:10,cursor:"pointer",
                  background: tapped ? "#e8f5e9" : "#f0f4ff",
                  border: tapped ? "2px solid #22c55e" : "2px solid #002d6e",
                  position:"relative",transition:"all .1s",
                  opacity: 1,
                }}>
                {tapped && (
                  <div style={{
                    position:"absolute",top:6,right:8,
                    fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,
                    fontSize:22,color:"#22c55e",lineHeight:1
                  }}>{pos+1}</div>
                )}
                <div style={{
                  fontWeight:700,fontSize:14,color: tapped?"#166534":"#002d6e",
                  textAlign:"left",lineHeight:1.2,paddingRight:tapped?20:0
                }}>{p.name||"—"}</div>
                <div style={{fontSize:11,color:tapped?"#166534":"#888",marginTop:3}}>{tapped?"Tap to remove":"Tap to set order"}</div>
              </button>
            );
          })}
        </div>

        {/* Add players not yet in the lineup */}
        {(() => {
          // In BoxScoreEntry, all roster players are already in batters (just inactive).
          // Simply surface inactive ones so the user can tap them into the order.
          const addable = batters
            .filter(p=>!p.on && p.name)
            .map(p=>({name:p.name,_id:p._id,type:"inactive"}));
          if (addable.length === 0) return null;
          return (
            <div style={{marginTop:18}}>
              <div style={{fontSize:11,fontWeight:700,color:"rgba(0,0,0,0.35)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>Add to lineup</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8}}>
                {addable.map(item => (
                  <button key={item._id||item.name} type="button"
                    onClick={()=>{
                      if(item.type==="inactive"){
                        setter(prev=>prev.map(b=>b._id===item._id?{...b,on:true}:b));
                        setOrderQueue(q=>[...q,item._id]);
                      } else {
                        const nb = blankBatter(item.name);
                        setter(prev=>[...prev,nb]);
                        setOrderQueue(q=>[...q,nb._id]);
                      }
                    }}
                    style={{padding:"14px 10px",borderRadius:10,cursor:"pointer",textAlign:"left",
                      background:"#fffbeb",border:"2px dashed #f59e0b",transition:"all .1s"}}>
                    <div style={{fontWeight:700,fontSize:14,color:"#92400e",lineHeight:1.2}}>{item.name}</div>
                    <div style={{fontSize:11,color:"#b45309",marginTop:3}}>+ Add to order</div>
                  </button>
                ))}
              </div>
              {/* Manual entry for players not on roster */}
              {(() => {
                const addOrderName = side==="away" ? addAwayName : addHomeName;
                const setAddOrderName = side==="away" ? setAddAwayName : setAddHomeName;
                const doAdd = () => {
                  if(!addOrderName.trim()) return;
                  const nb = blankBatter(addOrderName.trim());
                  setter(prev=>[...prev,nb]);
                  setOrderQueue(q=>[...q,nb._id]);
                  setAddOrderName("");
                };
                return (
                  <div style={{display:"flex",gap:6,marginTop:8}}>
                    <input type="text" value={addOrderName} onChange={e=>setAddOrderName(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&doAdd()}
                      placeholder="Type name to add..."
                      style={{flex:1,padding:"7px 10px",border:"1px solid #ddd",borderRadius:6,fontSize:13,fontFamily:"inherit"}}/>
                    <button type="button" onClick={doAdd}
                      style={{padding:"7px 12px",background:"#002d6e",border:"none",borderRadius:6,color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>+ Add</button>
                  </div>
                );
              })()}
            </div>
          );
        })()}
      </div>
    );

    return (
    <div style={{flex:1,minWidth:0}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:15,
        textTransform:"uppercase",color:"#002d6e",marginBottom:8,borderBottom:"2px solid #002d6e",paddingBottom:4}}>{label}</div>
      {/* Mode toggle */}
      <div style={{display:"flex",gap:4,marginBottom:10,background:"rgba(0,45,110,0.05)",borderRadius:8,padding:4}}>
        {[["simple","Score Only"],["full","Full Stats"]].map(([m,lbl])=>(
          <button key={m} type="button" onClick={()=>{
            setStatMode(m);
            if (m==="full" && activeBatters.length>0) { setOrderQueue([]); setOrderMode(true); }
          }}
            style={{flex:1,padding:"6px 8px",borderRadius:6,border:"none",cursor:"pointer",
              fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,
              textTransform:"uppercase",transition:"background .15s, color .15s",
              background:statMode===m?"#002d6e":"transparent",
              color:statMode===m?"#fff":"#666"}}>
            {lbl}
          </button>
        ))}
      </div>
      {statMode==="full" && activeBatters.length>0 && (
        <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",marginBottom:6}}>
          <button type="button" onClick={startOrderMode}
            style={{padding:"4px 10px",background:"transparent",border:"1px solid rgba(0,45,110,0.25)",
              borderRadius:6,color:"#002d6e",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,
              fontSize:11,cursor:"pointer",textTransform:"uppercase",letterSpacing:".04em",
              whiteSpace:"nowrap"}}>
            ✏️ Edit Lineup
          </button>
        </div>
      )}
      {statMode==="full" && (
        <div style={{overflowX:"auto",marginBottom:4}}>
          <table style={{borderCollapse:"collapse",fontSize:13,minWidth:"100%"}}>
            <thead>
              <tr style={{background:"#001a3e"}}>
                <th style={{padding:"4px 2px",width:16}}/>
                <th style={{padding:"4px 2px",width:32,textAlign:"center",color:"rgba(255,255,255,0.5)",fontSize:11,fontWeight:700}}>#</th>
                <th style={{padding:"4px 8px",textAlign:"left",color:"rgba(255,255,255,0.5)",fontSize:11,fontWeight:700,minWidth:120}}>PLAYER</th>
                <th style={{padding:"4px 2px",width:46,textAlign:"center",color:"rgba(255,255,255,0.5)",fontSize:11,fontWeight:700}}>POS</th>
                {BAT_LBLS.map(lbl=>(
                  <th key={lbl} style={{padding:"4px 2px",width:38,textAlign:"center",color:"rgba(255,255,255,0.6)",fontSize:11,fontWeight:700}}>{lbl}</th>
                ))}
                <th style={{padding:"4px 2px",width:30}}/>
              </tr>
            </thead>
            <tbody>
              {batters.map((p,i)=>{
                if(!p.on) return null; // only show players in the lineup
                return (
                <tr key={p._id||i}
                  onDragOver={e=>e.preventDefault()}
                  onDrop={e=>handleDrop(e,side,setter,i)}
                  style={{background:i%2===0?"#fff":"#f8f9fb",
                    outline:(dragVisual.idx===i&&dragVisual.side===side)?"2px solid #002d6e":"none"}}>
                  {/* drag handle */}
                  <td style={{padding:"2px 1px",textAlign:"center"}}>
                    <div draggable onDragStart={e=>handleDragStart(e,side,i)} onDragEnd={handleDragEnd}
                      style={{fontSize:13,color:"#ccc",cursor:"grab",userSelect:"none",touchAction:"none",padding:"0 2px"}}>⠿</div>
                  </td>
                  {/* order # inline with ▲▼ */}
                  <td style={{padding:"2px 1px",textAlign:"center",whiteSpace:"nowrap"}}>
                    <div style={{display:"flex",alignItems:"center",gap:2,justifyContent:"center"}}>
                      <button type="button" onPointerDown={e=>{e.preventDefault();moveBat(setter,i,-1);}}
                        className="bs-order-btn"
                        style={{border:"none",background:"rgba(0,45,110,0.10)",borderRadius:3,cursor:"pointer",fontSize:8,color:"#002d6e",padding:"2px 4px",fontWeight:900,lineHeight:1}}>▲</button>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:12,color:"#002d6e",minWidth:14,textAlign:"center"}}>{i+1}</div>
                      <button type="button" onPointerDown={e=>{e.preventDefault();moveBat(setter,i,1);}}
                        className="bs-order-btn"
                        style={{border:"none",background:"rgba(0,45,110,0.10)",borderRadius:3,cursor:"pointer",fontSize:8,color:"#002d6e",padding:"2px 4px",fontWeight:900,lineHeight:1}}>▼</button>
                    </div>
                  </td>
                  {/* name */}
                  <td style={{padding:"2px 4px"}}>
                    <input type="text" value={p.name} onChange={e=>updBat(setter,i,"name",e.target.value)}
                      onDragStart={e=>e.stopPropagation()} className="bs-name-input"
                      style={{width:"100%",minWidth:110,padding:"4px 6px",border:"1px solid #ddd",borderRadius:5,fontSize:13,fontFamily:"inherit"}}/>
                  </td>
                  {/* position */}
                  <td style={{padding:"2px 1px",textAlign:"center"}}>
                    <select value={p.pos||""} onChange={e=>updBat(setter,i,"pos",e.target.value)}
                      style={{width:46,padding:"4px 1px",border:"1px solid #ddd",borderRadius:5,fontSize:12,fontFamily:"inherit"}}>
                      {POSITIONS.map(pos=><option key={pos} value={pos}>{pos||"Pos"}</option>)}
                    </select>
                  </td>
                  {/* stats */}
                  {BAT_STATS.map((f)=>(
                    <td key={f} style={{padding:"2px 1px",textAlign:"center"}}>
                      <input type="number" min="0" inputMode="numeric" value={p[f]}
                        onChange={e=>updBat(setter,i,f,Math.max(0,parseInt(e.target.value)||0))}
                        onWheel={e=>e.target.blur()}
                        style={{width:36,padding:"4px 1px",textAlign:"center",border:"1px solid #ddd",
                          borderRadius:4,fontSize:13,background:"#fff",fontFamily:"inherit"}}/>
                    </td>
                  ))}
                  {/* remove from lineup */}
                  <td style={{padding:"3px 6px",textAlign:"center"}}>
                    <button type="button" onClick={()=>setter(prev=>prev.map(b=>b._id===p._id?{...b,on:false}:b))}
                      title="Remove from lineup"
                      style={{background:"none",border:"none",color:"#dc2626",cursor:"pointer",fontSize:16,lineHeight:1,padding:"2px 4px",fontWeight:700}}>✕</button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{display:"flex",gap:6,marginTop:6}}>
        <input type="text" value={addName} onChange={e=>setAddName(e.target.value)}
          placeholder="Add player..." onKeyDown={e=>{if(e.key==="Enter"&&addName.trim()){setter(p=>[...p,blankBatter(addName.trim())]);setAddName("");}}}
          style={{flex:1,padding:"6px 10px",border:"1px solid #ddd",borderRadius:6,fontSize:13,fontFamily:"inherit"}}/>
        <button onClick={()=>{if(addName.trim()){setter(p=>[...p,blankBatter(addName.trim())]);setAddName("");}}}
          style={{padding:"6px 12px",background:"rgba(0,45,110,0.08)",border:"1px solid rgba(0,45,110,0.2)",
            borderRadius:6,color:"#002d6e",fontWeight:700,fontSize:12,cursor:"pointer"}}>+ Add</button>
      </div>
    </div>
    );
  };

  // ── Pitching section — table layout ──
  const renderPit = (label,pit,setter,availablePlayers=[]) => (
    <div style={{minWidth:0}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:15,
        textTransform:"uppercase",color:"#002d6e",marginBottom:8,borderBottom:"2px solid #002d6e",paddingBottom:4}}>{label}</div>
      <div style={{overflowX:"auto"}}>
        <table style={{borderCollapse:"collapse",fontSize:13,minWidth:"100%"}}>
          <thead>
            <tr style={{background:"#001a3e"}}>
              <th style={{padding:"6px 10px",textAlign:"left",color:"rgba(255,255,255,0.5)",fontSize:11,fontWeight:700,minWidth:140}}>PITCHER</th>
              {[["IP","ip"],["H","h"],["R","r"],["ER","er"],["BB","bb"],["SO","k"],["HR","hr"],["DEC.","decision"]].map(([lbl])=>(
                <th key={lbl} style={{padding:"6px 4px",width:50,textAlign:"center",color:"rgba(255,255,255,0.6)",fontSize:11,fontWeight:700}}>{lbl}</th>
              ))}
              <th style={{width:30}}/>
            </tr>
          </thead>
          <tbody>
            {pit.map((p,i)=>(
              <tr key={i} style={{background:i%2===0?"#fff":"#f8f9fb"}}>
                <td style={{padding:"4px 6px"}}>
                  {availablePlayers.length > 0 ? (
                    <select value={p.name||""} onChange={e=>updPit(setter,i,"name",e.target.value)}
                      style={{width:"100%",minWidth:130,padding:"4px 6px",border:"1px solid #ddd",borderRadius:5,fontSize:13,background:"#fff",fontFamily:"inherit"}}>
                      <option value="">— Select pitcher —</option>
                      {availablePlayers.map(name=><option key={name} value={name}>{name}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={p.name} onChange={e=>updPit(setter,i,"name",e.target.value)}
                      placeholder="Pitcher name"
                      style={{width:"100%",minWidth:130,padding:"4px 6px",border:"1px solid #ddd",borderRadius:5,fontSize:13,background:"#fff",fontFamily:"inherit"}}/>
                  )}
                </td>
                <td style={{padding:"3px 2px",textAlign:"center"}}>
                  <input type="text" value={p.ip} placeholder="6.0" onChange={e=>updPit(setter,i,"ip",e.target.value)}
                    style={{width:46,padding:"4px 2px",textAlign:"center",border:"1px solid rgba(96,165,250,0.4)",
                      borderRadius:4,fontSize:13,background:"#fff",fontFamily:"inherit"}}/>
                </td>
                {[["h"],["r"],["er"],["bb"],["k"],["hr"]].map(([f])=>(
                  <td key={f} style={{padding:"3px 2px",textAlign:"center"}}>
                    <input type="number" min="0" inputMode="numeric" value={p[f]}
                      onChange={e=>updPit(setter,i,f,Math.max(0,parseInt(e.target.value)||0))}
                      onWheel={e=>e.target.blur()}
                      style={{width:42,padding:"4px 2px",textAlign:"center",border:"1px solid #ddd",
                        borderRadius:4,fontSize:13,background:"#fff",fontFamily:"inherit"}}/>
                  </td>
                ))}
                <td style={{padding:"3px 2px",textAlign:"center"}}>
                  <select value={p.decision} onChange={e=>updPit(setter,i,"decision",e.target.value)}
                    style={{width:54,padding:"4px 2px",textAlign:"center",border:"1px solid #ddd",
                      borderRadius:4,fontSize:12,background:"#fff",fontFamily:"inherit"}}>
                    {["ND","W","L","S"].map(d=><option key={d}>{d}</option>)}
                  </select>
                </td>
                <td style={{padding:"3px 4px",textAlign:"center"}}>
                  {pit.length>1 && (
                    <button type="button" onClick={()=>setter(p=>p.filter((_,j)=>j!==i))}
                      style={{background:"none",border:"none",color:"#dc2626",fontSize:16,cursor:"pointer",padding:"2px 4px",lineHeight:1}}>×</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={()=>setter(p=>[...p,blankPitcher()])}
        style={{padding:"6px 12px",background:"rgba(0,45,110,0.08)",border:"1px solid rgba(0,45,110,0.2)",
          borderRadius:6,color:"#002d6e",fontWeight:700,fontSize:12,cursor:"pointer",marginTop:8}}>+ Add Pitcher</button>
    </div>
  );

  // ── GAME NOT SELECTED YET ──
  if(!game) return (
    <div>
      {onClose && (
        <button onClick={onClose} style={{marginBottom:12,padding:"6px 14px",background:"rgba(0,0,0,0.07)",border:"1px solid rgba(0,0,0,0.15)",borderRadius:6,fontWeight:700,fontSize:13,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6}}>← Back to Portal</button>
      )}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        <button type="button" onClick={()=>{setCustomMode(false);setEditMode(false);}}
          style={{padding:"7px 16px",borderRadius:6,border:"none",cursor:"pointer",fontWeight:700,
            fontSize:13,background:(!customMode&&!editMode)?"#002d6e":"rgba(0,0,0,0.07)",
            color:(!customMode&&!editMode)?"#fff":"#555",fontFamily:"'Barlow Condensed',sans-serif",
            textTransform:"uppercase"}}>From Schedule</button>
        <button type="button" onClick={()=>{setEditMode(true);setCustomMode(false);loadSavedGames();}}
          style={{padding:"7px 16px",borderRadius:6,border:"none",cursor:"pointer",fontWeight:700,
            fontSize:13,background:editMode?"#2d6a4f":"rgba(0,0,0,0.07)",
            color:editMode?"#fff":"#555",fontFamily:"'Barlow Condensed',sans-serif",
            textTransform:"uppercase"}}>✏️ Edit Saved Game</button>
        <button type="button" onClick={()=>{setCustomMode(true);setEditMode(false);}}
          style={{padding:"7px 16px",borderRadius:6,border:"none",cursor:"pointer",fontWeight:700,
            fontSize:13,background:customMode?"#002d6e":"rgba(0,0,0,0.07)",
            color:customMode?"#fff":"#555",fontFamily:"'Barlow Condensed',sans-serif",
            textTransform:"uppercase"}}>Custom Game</button>
      </div>
      {editMode ? (
        <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:420,overflowY:"auto"}}>
          {savedLoading && <div style={{textAlign:"center",padding:30,color:"#888"}}>Loading saved games…</div>}
          {!savedLoading && savedGames.length===0 && <div style={{textAlign:"center",padding:30,color:"#888"}}>No saved games found.</div>}
          {savedGames.map((g,i)=>(
            <div key={i}
              style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:9,
                padding:"12px 16px",display:"flex",alignItems:"center",
                justifyContent:"space-between",borderLeft:"3px solid #2d6a4f"}}>
              <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>selectSavedGame(g)}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,
                  textTransform:"uppercase"}}>{g.away_team} <span style={{color:"#ccc"}}>@</span> {g.home_team}</div>
                <div style={{fontSize:11,color:"#888",marginTop:2}}>
                  {g.game_date} · <strong style={{color:"#2d6a4f"}}>{g.away_score} – {g.home_score}</strong> · {g.status||"Final"}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,marginLeft:10}}>
                <div style={{fontSize:12,color:"#2d6a4f",fontWeight:700,cursor:"pointer"}} onClick={()=>selectSavedGame(g)}>Edit →</div>
                <button type="button" onClick={async(e)=>{
                  e.stopPropagation();
                  if(!window.confirm(`Delete ${g.away_team} vs ${g.home_team} (${g.game_date})? This cannot be undone.`)) return;
                  try{
                    await sbDelete(`batting_lines?game_id=eq.${g.id}`);
                    await sbDelete(`pitching_lines?game_id=eq.${g.id}`);
                    await sbDelete(`games?id=eq.${g.id}`);
                    setSavedGames(prev=>prev.filter(x=>x.id!==g.id));
                  }catch(err){alert("Delete failed: "+err.message);}
                }} style={{background:"rgba(220,38,38,0.08)",border:"1px solid rgba(220,38,38,0.25)",
                  borderRadius:6,color:"#dc2626",fontSize:13,padding:"4px 8px",cursor:"pointer",fontWeight:700}}>
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : !customMode ? (
        <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:420,overflowY:"auto"}}>
          {allGames.filter(g => !captainTeam || !savedGames.some(s => s.away_team===g.away && s.home_team===g.home)).map((g,i)=>(
            <div key={i} onClick={()=>selectGame(g)}
              style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:9,
                padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",
                justifyContent:"space-between"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor="#002d6e"}
              onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(0,0,0,0.09)"}>
              <div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,
                  textTransform:"uppercase"}}>{g.away} <span style={{color:"#ccc"}}>@</span> {g.home}</div>
                <div style={{fontSize:11,color:"#888",marginTop:2}}>{g.date} · {g.time} · {g.field}</div>
              </div>
              <div style={{fontSize:12,color:"#002d6e",fontWeight:700}}>Select →</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            {[["Date","date","Apr 11"],["Time","time","9:00 AM"],["Field","field","Clark Field"]].map(([l,k,ph])=>(
              <div key={k} style={{display:"flex",flexDirection:"column",gap:4}}>
                <label style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase"}}>{l}</label>
                <input value={custom[k]} onChange={e=>setCustom(c=>({...c,[k]:e.target.value}))}
                  placeholder={ph} style={{padding:"8px 10px",border:"1px solid #ddd",borderRadius:6,
                    fontSize:13,fontFamily:"inherit"}}/>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[["Away Team","away"],["Home Team","home"]].map(([l,k])=>(
              <div key={k} style={{display:"flex",flexDirection:"column",gap:4}}>
                <label style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase"}}>{l}</label>
                <select value={custom[k]} onChange={e=>setCustom(c=>({...c,[k]:e.target.value}))}
                  style={{padding:"8px 10px",border:"1px solid #ddd",borderRadius:6,fontSize:13,fontFamily:"inherit"}}>
                  {TEAMS.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
            ))}
          </div>
          <button onClick={()=>selectGame(custom)} disabled={!custom.date}
            style={{padding:"11px",background:"#002d6e",border:"none",borderRadius:8,color:"#fff",
              fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,
              textTransform:"uppercase",cursor:"pointer",opacity:!custom.date?0.4:1}}>
            Load Rosters & Continue →
          </button>
        </div>
      )}
    </div>
  );

  // ── LINEUP ORDER PHASE (captain portal only) ──
  if (game && bsePhase === "lineup" && captainTeam) {
    const isAway = game.away === captainTeam;
    const teamBat   = isAway ? awayBat   : homeBat;
    const setTeamBat = isAway ? setAwayBat : setHomeBat;
    const setTeamMode = isAway ? setAwayStatMode : setHomeStatMode;

    const addToOrder = (name) => {
      if (!name.trim() || lineupOrder.includes(name.trim())) return;
      setLineupOrder(prev => [...prev, name.trim()]);
      setLineupNameInput("");
    };
    const removeFromOrder = (i) => setLineupOrder(prev => prev.filter((_,j) => j !== i));

    const confirmLineup = () => {
      if (!lineupOrder.length) { alert("Add at least 1 player to the lineup."); return; }
      const ordered = lineupOrder.map(name => teamBat.find(p => p.name === name) || blankBatter(name));
      const rest = teamBat.filter(p => !lineupOrder.includes(p.name)).map(p => ({...p, on:false}));
      setTeamBat([...ordered, ...rest]);
      setTeamMode("full");
      setBsePhase("entry");
    };

    const available = teamBat.map(p => p.name).filter(n => n && !lineupOrder.includes(n));

    return (
      <div>
        {/* Back to game select */}
        <button onClick={()=>{ setGame(null); setBsePhase("entry"); setLineupOrder([]); setScoreOnlyMode(false); }}
          style={{marginBottom:14,padding:"6px 14px",background:"rgba(0,0,0,0.07)",border:"1px solid rgba(0,0,0,0.15)",borderRadius:6,fontWeight:700,fontSize:13,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6}}>
          ← Change Game
        </button>

        {/* Game banner */}
        <div style={{background:"#001a3e",borderRadius:10,padding:"12px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,color:"#FFD700",textTransform:"uppercase",letterSpacing:".04em"}}>
              {game.away} <span style={{color:"rgba(255,255,255,0.3)"}}>@</span> {game.home}
            </div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",marginTop:2}}>{game.date} · {game.time} · {game.field}</div>
          </div>
        </div>

        {/* Step indicator */}
        <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:16}}>
          {[["1","Select Game","done"],["2","Set Batting Order","active"],["3","Enter Stats","upcoming"]].map(([n,lbl,st],idx)=>(
            <div key={n} style={{display:"contents"}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:26,height:26,borderRadius:"50%",
                  background:st==="done"?"#22c55e":st==="active"?"#002d6e":"#e5e7eb",
                  color:st==="upcoming"?"#9ca3af":"#fff",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:13,flexShrink:0}}>
                  {st==="done"?"✓":n}
                </div>
                <span style={{fontSize:12,fontWeight:700,color:st==="active"?"#002d6e":st==="done"?"#22c55e":"#9ca3af",
                  whiteSpace:"nowrap"}}>{lbl}</span>
              </div>
              {idx<2 && <div style={{flex:1,height:2,background:"#e5e7eb",margin:"0 8px",minWidth:16}}/>}
            </div>
          ))}
        </div>

        {/* Lineup card */}
        <div style={{background:"#fff",borderRadius:12,border:"1px solid rgba(0,0,0,0.09)",padding:"20px",marginBottom:14,boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,textTransform:"uppercase",color:"#002d6e",marginBottom:4}}>
            ⚾ {captainTeam} Batting Order
          </div>
          <div style={{fontSize:13,color:"#888",marginBottom:16,lineHeight:1.5}}>
            Tap players in batting order — #1 first. Players not added will be marked as not playing.
          </div>

          {/* Already ordered list */}
          {lineupOrder.length > 0 && (
            <div style={{marginBottom:14}}>
              {lineupOrder.map((name, i) => (
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid rgba(0,0,0,0.06)"}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:"#002d6e",color:"#FFD700",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:14,flexShrink:0}}>{i+1}</div>
                  <span style={{flex:1,fontSize:15,fontWeight:600}}>{name}</span>
                  <button onClick={()=>removeFromOrder(i)}
                    style={{padding:"3px 8px",background:"rgba(220,38,38,0.1)",border:"none",borderRadius:5,color:"#dc2626",fontWeight:700,cursor:"pointer",fontSize:13}}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Available players */}
          {!rosterFetched && (
            <div style={{textAlign:"center",padding:"18px",color:"#888",fontSize:13}}>⏳ Loading roster…</div>
          )}
          {rosterFetched && available.length > 0 && (
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"#888",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>
                {lineupOrder.length === 0 ? "Tap to add to lineup:" : `👆 Tap your #${lineupOrder.length+1} batter:`}
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {available.map(name => (
                  <button key={name} onClick={()=>addToOrder(name)}
                    style={{padding:"6px 12px",background:"rgba(0,45,110,0.07)",border:"1px solid rgba(0,45,110,0.2)",
                      borderRadius:8,fontSize:13,fontWeight:600,color:"#002d6e",cursor:"pointer",
                      fontFamily:"inherit",transition:"background .1s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(0,45,110,0.14)"}
                    onMouseLeave={e=>e.currentTarget.style.background="rgba(0,45,110,0.07)"}>
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom player input */}
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <input type="text" value={lineupNameInput} onChange={e=>setLineupNameInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter") addToOrder(lineupNameInput);}}
              placeholder="Add player not on roster…"
              style={{flex:1,padding:"8px 12px",border:"1px solid #ddd",borderRadius:8,fontSize:13,fontFamily:"inherit"}}/>
            <button onClick={()=>addToOrder(lineupNameInput)}
              style={{padding:"8px 14px",background:"#002d6e",border:"none",borderRadius:8,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
              Add
            </button>
          </div>
        </div>

        {/* Skip / Confirm buttons */}
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>{ setTeamMode("simple"); setBsePhase("entry"); setScoreOnlyMode(true); }}
            style={{padding:"12px 20px",background:"rgba(0,0,0,0.06)",border:"1px solid rgba(0,0,0,0.15)",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer",color:"#555"}}>
            Skip — Enter Score Only
          </button>
          <button onClick={confirmLineup} disabled={lineupOrder.length===0}
            style={{flex:1,padding:"13px",background:lineupOrder.length?"#002d6e":"#e5e7eb",border:"none",borderRadius:10,
              color:lineupOrder.length?"#FFD700":"#9ca3af",fontFamily:"'Barlow Condensed',sans-serif",
              fontWeight:900,fontSize:18,textTransform:"uppercase",cursor:lineupOrder.length?"pointer":"default",
              letterSpacing:".04em",transition:"background .15s"}}>
            {lineupOrder.length ? `✅ Confirm ${lineupOrder.length}-Man Lineup → Enter Stats` : "Tap players above to set order"}
          </button>
        </div>
      </div>
    );
  }

  // ── FULL BOX SCORE FORM ──
  return (
    <div>
      {/* Editing banner */}
      {editGameId && (
        <div style={{background:"#1b4332",borderRadius:8,padding:"8px 16px",marginBottom:10,fontSize:13,color:"#d1fae5",display:"flex",alignItems:"center",gap:8}}>
          ✏️ <strong>Edit Mode</strong> — changes will overwrite the saved box score for this game.
          <button type="button" onClick={()=>{setEditGameId(null);setEditSubmittedTag("");setGame(null);}} style={{marginLeft:"auto",padding:"3px 10px",background:"rgba(255,255,255,0.15)",border:"none",borderRadius:5,color:"#fff",fontSize:12,cursor:"pointer"}}>Cancel Edit</button>
        </div>
      )}
      {/* Game banner */}
      <div style={{background:"#001a3e",borderRadius:10,padding:"12px 18px",marginBottom:14,
        display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,
            color:"#FFD700",textTransform:"uppercase",letterSpacing:".04em"}}>
            {game.away} <span style={{color:"rgba(255,255,255,0.3)"}}>@</span> {game.home}
          </div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",marginTop:2}}>{game.date} · {game.time} · {game.field}</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
          <button onClick={()=>setGame(null)}
            style={{padding:"5px 12px",background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",
              borderRadius:6,color:"rgba(255,255,255,0.6)",fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>← Change Game</button>
          {onClose && (
            <button onClick={onClose}
              style={{padding:"5px 12px",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",
                borderRadius:6,color:"rgba(255,255,255,0.5)",fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>✕ Exit</button>
          )}
        </div>
      </div>

      {/* Score */}
      <BSCrd>
        <BSH2 n="1" title="Score & Game Info"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:16,alignItems:"center",marginBottom:14}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,
              textTransform:"uppercase",color:"#888",marginBottom:6,letterSpacing:".06em"}}>
              {game.away} <span style={{fontSize:9,color:"#bbb",fontWeight:400}}>{awayStatMode==="full"?"auto from R":"enter score"}</span>
            </div>
            {awayStatMode==="simple" ? (
              <input type="number" min="0" inputMode="numeric" pattern="[0-9]*" value={awayScore} onChange={e=>setAwayScore(e.target.value)}
                placeholder="0" className="bs-score-input"
                style={{width:80,padding:"10px 6px",textAlign:"center",border:"2px solid #002d6e",
                  borderRadius:10,fontSize:36,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,
                  color:"#002d6e",background:"#fff",display:"block",margin:"0 auto",boxSizing:"border-box"}}/>
            ) : (
              <div style={{width:80,margin:"0 auto",padding:"10px 6px",textAlign:"center",border:"2px solid #002d6e",
                borderRadius:10,fontSize:36,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,
                color:"#002d6e",background:"rgba(0,45,110,0.04)"}}>
                {awayScore||0}
              </div>
            )}
          </div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,color:"#ccc",textAlign:"center"}}>vs</div>
          <div style={{textAlign:"center"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,
              textTransform:"uppercase",color:"#888",marginBottom:6,letterSpacing:".06em"}}>
              {game.home} <span style={{fontSize:9,color:"#bbb",fontWeight:400}}>{homeStatMode==="full"?"auto from R":"enter score"}</span>
            </div>
            {homeStatMode==="simple" ? (
              <input type="number" min="0" inputMode="numeric" pattern="[0-9]*" value={homeScore} onChange={e=>setHomeScore(e.target.value)}
                placeholder="0" className="bs-score-input"
                style={{width:80,padding:"10px 6px",textAlign:"center",border:"2px solid #002d6e",
                  borderRadius:10,fontSize:36,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,
                  color:"#002d6e",background:"#fff",display:"block",margin:"0 auto",boxSizing:"border-box"}}/>
            ) : (
              <div style={{width:80,margin:"0 auto",padding:"10px 6px",textAlign:"center",border:"2px solid #002d6e",
                borderRadius:10,fontSize:36,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,
                color:"#002d6e",background:"rgba(0,45,110,0.04)"}}>
                {homeScore||0}
              </div>
            )}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10}}>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <label style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase"}}>Headline (optional)</label>
            <input value={headline} onChange={e=>setHeadline(e.target.value)} placeholder="e.g. Tribe Walk Off in 9th!"
              style={{padding:"8px 10px",border:"1px solid #ddd",borderRadius:6,fontSize:13,fontFamily:"inherit"}}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <label style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase"}}>Status</label>
            <select value={gameStatus} onChange={e=>setGameStatus(e.target.value)}
              style={{padding:"8px 10px",border:"1px solid #ddd",borderRadius:6,fontSize:13,fontFamily:"inherit"}}>
              {["Final","Forfeit","Tie","Postponed"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </BSCrd>

      {/* Score-only fast save — shown when captain skipped batting entry */}
      {scoreOnlyMode && (
        <div style={{background:"#f0fdf4",border:"2px solid #86efac",borderRadius:12,padding:"18px 20px",marginBottom:14}}>
          <div style={{fontSize:13,color:"#166534",fontWeight:700,marginBottom:12}}>
            ✅ Score entered — tap Save to submit, or <button onClick={()=>setScoreOnlyMode(false)} style={{background:"none",border:"none",color:"#15803d",textDecoration:"underline",cursor:"pointer",fontWeight:700,fontSize:13,padding:0}}>add full stats</button>
          </div>
          {saveMsg && (
            <div style={{padding:"10px 14px",borderRadius:8,marginBottom:10,fontWeight:600,
              background:saveMsg.ok?"#dcfce7":"#fef2f2",
              border:`1px solid ${saveMsg.ok?"#86efac":"#fecaca"}`,
              color:saveMsg.ok?"#166534":"#991b1b"}}>{saveMsg.text}</div>
          )}
          {!saveMsg?.ok && (
            <button onClick={handleSave} disabled={saving}
              style={{width:"100%",padding:"16px",background:saving?"#888":"#16a34a",border:"none",borderRadius:10,
                color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,
                textTransform:"uppercase",letterSpacing:".06em",cursor:saving?"wait":"pointer"}}>
              {saving?"Saving...":"⚾ Save Score"}
            </button>
          )}
          {saveMsg?.ok && (
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{setGame(null);setSaveMsg(null);setScoreOnlyMode(false);}}
                style={{padding:"14px 20px",background:"rgba(0,0,0,0.07)",border:"none",borderRadius:10,
                  fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,
                  textTransform:"uppercase",cursor:"pointer"}}>+ Enter Another</button>
              <button onClick={onClose}
                style={{flex:1,padding:"14px",background:"#15803d",border:"none",borderRadius:10,
                  color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,
                  textTransform:"uppercase",cursor:"pointer"}}>✓ Done</button>
            </div>
          )}
        </div>
      )}

      {!scoreOnlyMode && <>
      {/* Linescore */}
      <BSCrd>
        <BSH2 n="2" title="Linescore" sub="Inning-by-inning runs · R = total · H = hits · E = errors"/>
        <div style={{overflowX:"auto"}}>
          <table style={{borderCollapse:"collapse",fontSize:13,minWidth:"100%"}}>
            <thead>
              <tr style={{background:"#001a3e"}}>
                <th style={{padding:"6px 10px",textAlign:"left",color:"rgba(255,255,255,0.5)",fontSize:11,minWidth:70}}></th>
                {awayInn.map((_,i)=>(
                  <th key={i} style={{padding:"6px 5px",color:"rgba(255,255,255,0.6)",fontSize:11,
                    fontWeight:700,textAlign:"center",width:36}}>{i+1}</th>
                ))}
                <th style={{padding:"6px 5px",color:"#FFD700",fontSize:11,fontWeight:700,textAlign:"center",width:36}}>R</th>
                <th style={{padding:"6px 5px",color:"rgba(255,255,255,0.6)",fontSize:11,fontWeight:700,textAlign:"center",width:36}}>H</th>
                <th style={{padding:"6px 5px",color:"rgba(239,68,68,0.8)",fontSize:11,fontWeight:700,textAlign:"center",width:36}}>E</th>
              </tr>
            </thead>
            <tbody>
              {[[game.away,awayInn,setAwayInn,awayScore,awayH,setAwayH,awayE,setAwayE],
                [game.home,homeInn,setHomeInn,homeScore,homeH,setHomeH,homeE,setHomeE]].map(([name,inn,setInn,tot,h,setH,e,setE])=>(
                <tr key={name} style={{background:"#f8f9fb"}}>
                  <td style={{padding:"4px 10px",fontWeight:700,fontSize:13,fontFamily:"'Barlow Condensed',sans-serif",
                    textTransform:"uppercase",letterSpacing:".04em"}}>{name}</td>
                  {inn.map((x,i)=>(
                    <td key={i} style={{padding:"3px 2px",textAlign:"center"}}>
                      <input type="number" min="0" inputMode="numeric" pattern="[0-9]*" value={x.r} onChange={e=>updInn(setInn,i,e.target.value)}
                        className="bs-inn-input"
                        style={{width:32,padding:"3px 1px",textAlign:"center",border:"1px solid #ddd",
                          borderRadius:4,fontSize:13,fontWeight:700,background:"#fff",fontFamily:"inherit"}}/>
                    </td>
                  ))}
                  <td style={{padding:"3px 2px",textAlign:"center"}}>
                    <input type="number" min="0" value={tot} readOnly
                      style={{width:34,padding:"3px 1px",textAlign:"center",border:"1px solid rgba(255,200,0,0.4)",
                        borderRadius:4,fontSize:13,fontWeight:900,background:"rgba(255,200,0,0.07)",
                        color:"#b45309",fontFamily:"inherit"}}/>
                  </td>
                  <td style={{padding:"3px 2px",textAlign:"center"}}>
                    <input type="number" min="0" value={h} onChange={e=>setH(e.target.value)}
                      style={{width:32,padding:"3px 1px",textAlign:"center",border:"1px solid #ddd",
                        borderRadius:4,fontSize:13,fontWeight:700,background:"#fff",fontFamily:"inherit"}}/>
                  </td>
                  <td style={{padding:"3px 2px",textAlign:"center"}}>
                    <input type="number" min="0" value={e} onChange={e=>setE(e.target.value)}
                      style={{width:32,padding:"3px 1px",textAlign:"center",border:"1px solid rgba(239,68,68,0.3)",
                        borderRadius:4,fontSize:13,fontWeight:700,background:"rgba(239,68,68,0.04)",
                        color:"#dc2626",fontFamily:"inherit"}}/>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{marginTop:8,display:"flex",gap:8}}>
          <button type="button" onClick={()=>{setAwayInn(p=>[...p,{r:""}]);setHomeInn(p=>[...p,{r:""}]);}}
            style={{padding:"5px 12px",background:"rgba(0,45,110,0.08)",border:"1px solid rgba(0,45,110,0.2)",
              borderRadius:6,color:"#002d6e",fontWeight:700,fontSize:12,cursor:"pointer"}}>
            + Extra Inning
          </button>
          {awayInn.length > 9 && (
            <button type="button" onClick={()=>{setAwayInn(p=>p.slice(0,-1));setHomeInn(p=>p.slice(0,-1));}}
              style={{padding:"5px 12px",background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.2)",
                borderRadius:6,color:"#dc2626",fontWeight:700,fontSize:12,cursor:"pointer"}}>
              − Remove
            </button>
          )}
        </div>
      </BSCrd>

      {/* Batting */}
      <BSCrd>
        <BSH2 n="3" title="Batting Lineups" sub="Drag ⠿ handle to reorder · edit # to jump position · toggle off players not playing"/>
        {(() => {
          const isAwayTeam = captainTeam && game.away === captainTeam;
          const isHomeTeam = captainTeam && game.home === captainTeam;
          const lockedBox = (teamName) => (
            <div style={{border:"1px dashed #ccc",borderRadius:10,padding:"28px 16px",textAlign:"center",color:"rgba(0,0,0,0.3)",fontSize:13}}>
              🔒 {teamName} stats — to be submitted by that team's captain
            </div>
          );
          return (
            <div style={{display:"flex",flexDirection:"column",gap:24}}>
              {(!captainTeam || isAwayTeam) ? renderBats(`${game.away} Batting`,"away",awayBat,setAwayBat,addAwayName,setAddAwayName,awayStatMode,setAwayStatMode) : lockedBox(game.away)}
              {(!captainTeam || isHomeTeam) ? renderBats(`${game.home} Batting`,"home",homeBat,setHomeBat,addHomeName,setAddHomeName,homeStatMode,setHomeStatMode) : lockedBox(game.home)}
            </div>
          );
        })()}
      </BSCrd>

      {/* Pitching */}
      <BSCrd>
        <BSH2 n="4" title="Pitching" sub="Enter IP as innings.outs (e.g. 6.2 = 6 innings 2 outs)"/>
        {(() => {
          const isAwayTeam = captainTeam && game.away === captainTeam;
          const isHomeTeam = captainTeam && game.home === captainTeam;
          const lockedBox = (teamName) => (
            <div style={{border:"1px dashed #ccc",borderRadius:10,padding:"28px 16px",textAlign:"center",color:"rgba(0,0,0,0.3)",fontSize:13}}>
              🔒 {teamName} pitching — to be submitted by that team's captain
            </div>
          );
          return (
            <div style={{display:"flex",flexDirection:"column",gap:20}}>
              {(!captainTeam || isAwayTeam) ? renderPit(`${game.away} Pitching`,awayPit,setAwayPit,awayBat.map(p=>p.name).filter(Boolean)) : lockedBox(game.away)}
              {(!captainTeam || isHomeTeam) ? renderPit(`${game.home} Pitching`,homePit,setHomePit,homeBat.map(p=>p.name).filter(Boolean)) : lockedBox(game.home)}
            </div>
          );
        })()}
      </BSCrd>

      {/* Recap */}
      <BSCrd>
        <BSH2 n="5" title="Game Recap" sub="Optional · shown on game cards"/>
        <textarea value={recap} onChange={e=>setRecap(e.target.value)} rows={4}
          placeholder="Will be auto generated if you don't do a personalized one..."
          style={{width:"100%",padding:"10px 12px",border:"1px solid #ddd",borderRadius:8,fontSize:13,
            fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/>
      </BSCrd>

      {/* Save */}
      {saveMsg && (
        <div style={{padding:"12px 16px",borderRadius:8,marginBottom:12,fontWeight:600,
          background:saveMsg.ok?"#f0fdf4":"#fef2f2",
          border:`1px solid ${saveMsg.ok?"#bbf7d0":"#fecaca"}`,
          color:saveMsg.ok?"#166534":"#991b1b"}}>{saveMsg.text}</div>
      )}
      <div style={{display:"flex",gap:10}}>
        {!saveMsg?.ok && (
          <button onClick={handleSave} disabled={saving}
            style={{flex:1,padding:"14px",background:saving?"#888":"#002d6e",border:"none",borderRadius:10,
              color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:17,
              textTransform:"uppercase",letterSpacing:".06em",cursor:saving?"wait":"pointer"}}>
            {saving?"Saving...":"⚾ Save Box Score to Database"}
          </button>
        )}
        {saveMsg?.ok && (
          <>
            <button onClick={()=>{setGame(null);setSaveMsg(null);}}
              style={{padding:"14px 20px",background:"rgba(0,0,0,0.07)",border:"none",borderRadius:10,
                fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,
                textTransform:"uppercase",cursor:"pointer"}}>+ Enter Another</button>
            <button onClick={onClose}
              style={{flex:1,padding:"14px",background:"#15803d",border:"none",borderRadius:10,
                color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:17,
                textTransform:"uppercase",cursor:"pointer"}}>✓ Done</button>
          </>
        )}
      </div>
      </>}
    </div>
  );
}

/* ─── STATS PAGE ─────────────────────────────────────────────────────────── */
const ALL_SEASONS_KEY = "__all__";

// Extract year from a season name for sorting (returns e.g. 2026, 2025, etc.)
function seasonSortYear(name) {
  const m = name.match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : 0;
}

function StatsPage() {
  const [tab, setTab] = useState(0);
  const [season, setSeason] = useState(null); // null = waiting for default to load
  const [seasons, setSeasons] = useState([]);
  const [seasonsWithData, setSeasonsWithData] = useState(new Set());
  const [batting, setBatting] = useState([]);
  const [pitching, setPitching] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [playerGames, setPlayerGames] = useState([]);
  const [playerGameLog, setPlayerGameLog] = useState([]);
  const [playerCurSid, setPlayerCurSid] = useState(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [showAllSeasons, setShowAllSeasons] = useState(false);
  const [showAllGames, setShowAllGames] = useState(false);
  const [batSort, setBatSort] = useState({ col: "gp", dir: "desc" });
  const [pitSort, setPitSort] = useState({ col: "era", dir: "asc" });

  // Load seasons list + figure out which have data
  useEffect(() => {
    // Paginate through batting_lines since Supabase caps at 1000 rows/request
    const getAllBatGameIds = async () => {
      const ids = new Set();
      let offset = 0;
      const PAGE = 1000;
      while (true) {
        const rows = await sbFetch(`batting_lines?select=game_id&limit=${PAGE}&offset=${offset}`);
        rows.forEach(r => ids.add(r.game_id));
        if (rows.length < PAGE) break;
        offset += PAGE;
      }
      return ids;
    };

    Promise.all([
      sbFetch("seasons?select=id,name&limit=100"),
      sbFetch("games?select=id,season_id&limit=1000"),
      getAllBatGameIds(),
    ]).then(([allSeasons, allGames, gameIdsWithData]) => {
      // Sort seasons by year desc, then by id desc within same year
      const sorted = [...allSeasons].sort((a, b) => {
        const ya = seasonSortYear(a.name), yb = seasonSortYear(b.name);
        if (ya !== yb) return yb - ya;
        return b.id - a.id;
      });
      setSeasons(sorted.map(s => s.name));

      // Build set of season IDs that have batting lines
      const seasonIdsWithData = new Set(allGames.filter(g => gameIdsWithData.has(g.id)).map(g => g.season_id));
      const namesWithData = new Set(allSeasons.filter(s => seasonIdsWithData.has(s.id)).map(s => s.name));
      setSeasonsWithData(namesWithData);

      // Default to "Spring/Summer 2026" (the simple-named season). The
      // leaderboard fetch widens to both sat season IDs anyway, so picking
      // the friendlier label here is safe.
      const curSat = allSeasons.find(s => s.name === "Spring/Summer 2026")
        || allSeasons.find(s => s.name.includes("Spring") && s.name.includes("2026") && !s.name.includes("Diamond"))
        || allSeasons.find(s => s.name.includes("Diamond Classics Saturdays"));
      setSeason(curSat ? curSat.name : ALL_SEASONS_KEY);
    }).catch(() => {});
  }, []);

  // Load batting/pitching leaderboards when season changes
  useEffect(() => {
    if (season === null) return; // still loading default season, don't fetch yet
    setLoading(true); setError(null);

    const isAll = season === ALL_SEASONS_KEY;

    const BAT_COLS_SEL = "game_id,player_name,team,ab,r,h,rbi,bb,k,doubles,triples,hr,sb,hbp,sf";
    const PIT_COLS_SEL = "game_id,player_name,team,ip,h,r,er,bb,k,decision";

    const GAME_COLS_SEL = "id,game_date,away_team,home_team,away_score,home_score";
    // Fetch ALL game records (duplicates included), then later dedup lines by
    // (player, team, gameKey) — where gameKey collapses duplicate game rows into
    // one real game. This keeps whichever duplicate has the most complete line data.
    const fetchLines = isAll
      ? sbFetch(`games?select=${GAME_COLS_SEL}&limit=1000`)
          .then(allGames => {
            const ids = allGames.map(g => g.id);
            return Promise.all([
              sbFetchLinesByGameIds("batting_lines", BAT_COLS_SEL, ids),
              sbFetchLinesByGameIds("pitching_lines", PIT_COLS_SEL, ids),
              Promise.resolve(allGames),
            ]);
          })
      : sbFetch(`seasons?select=id,name&limit=100`)
          .then(allSeasons => {
            // Accept both "Diamond Classics Saturdays" and "Spring/Summer 2026"
            // as the current Saturday season — games may live under either sid.
            const sel = allSeasons.find(s => s.name === season);
            let seasonIds = [];
            if (sel) seasonIds = [sel.id];
            const isCurSat = sel && (sel.name.includes("Diamond Classics Saturdays") || (sel.name.includes("Spring") && sel.name.includes("2026")));
            if (isCurSat) {
              const companion = allSeasons.find(s => s.id !== sel.id && (s.name.includes("Diamond Classics Saturdays") || (s.name.includes("Spring") && s.name.includes("2026"))));
              if (companion) seasonIds.push(companion.id);
            }
            if (!seasonIds.length) {
              const fallback = allSeasons.find(s => s.name.includes("Diamond Classics Saturdays")) || allSeasons.find(s => s.name.includes("Spring") && s.name.includes("2026"));
              if (!fallback) throw new Error(`Season not found: ${season}`);
              seasonIds = [fallback.id];
            }
            return sbFetch(`games?select=${GAME_COLS_SEL}&season_id=in.(${seasonIds.join(",")})&limit=500`)
              .then(gs => {
                if (!gs.length) return [[],[],[]];
                const ids = gs.map(g => g.id);
                return Promise.all([
                  sbFetchLinesByGameIds("batting_lines", BAT_COLS_SEL, ids),
                  sbFetchLinesByGameIds("pitching_lines", PIT_COLS_SEL, ids),
                  Promise.resolve(gs),
                ]);
              });
          });

    fetchLines.then(([bat, pit, gamesRaw]) => {
      // Build map: game_id → gameKey (date|away|home). Duplicate game records
      // collapse to the same key, so we can dedupe lines across duplicates.
      const gameKeyById = {};
      (gamesRaw || []).forEach(g => {
        gameKeyById[g.id] = `${g.game_date||"null"}|${g.away_team}|${g.home_team}`;
      });
      // Dedup batting lines: one row per (player, team, gameKey). Keep the line
      // with the most plate appearances (AB+BB+HBP+SF) so partial submissions
      // lose to the most complete one — regardless of which duplicate game id it lives on.
      const batBest = {};
      (bat || []).forEach(r => {
        if (!r.player_name) return;
        const gk = gameKeyById[r.game_id] || `gid${r.game_id}`;
        const k = `${r.player_name}||${r.team}||${gk}`;
        const pa = (r.ab||0) + (r.bb||0) + (r.hbp||0) + (r.sf||0);
        const score = pa * 100 + (r.h||0) + (r.rbi||0);
        if (!batBest[k] || score > batBest[k].__s) batBest[k] = { ...r, __s: score };
      });
      const batDedup = Object.values(batBest);
      // Aggregate batting
      const batMap = {};
      batDedup.forEach(row => {
        const key = `${row.player_name}||${row.team}`;
        if (!batMap[key]) batMap[key] = { player_name: row.player_name, team: row.team, ab:0,r:0,h:0,rbi:0,bb:0,k:0,doubles:0,triples:0,hr:0,sb:0,hbp:0,sf:0,gp:0 };
        const p = batMap[key];
        p.gp++; p.ab+=row.ab||0; p.r+=row.r||0; p.h+=row.h||0; p.rbi+=row.rbi||0;
        p.bb+=row.bb||0; p.k+=row.k||0; p.doubles+=row.doubles||0;
        p.triples+=row.triples||0; p.hr+=row.hr||0; p.sb+=row.sb||0;
        p.hbp+=row.hbp||0; p.sf+=row.sf||0;
      });
      const batArr = Object.values(batMap).map(p => ({
        ...p,
        avg: p.ab > 0 ? (p.h / p.ab).toFixed(3).replace(/^0/,"") : ".000",
        avgNum: p.ab > 0 ? p.h / p.ab : 0,
        obp: (p.ab+p.bb+p.hbp) > 0 ? ((p.h+p.bb+p.hbp)/(p.ab+p.bb+p.hbp+p.sf)).toFixed(3).replace(/^0/,"") : ".000",
        obpNum: (p.ab+p.bb+p.hbp) > 0 ? (p.h+p.bb+p.hbp)/(p.ab+p.bb+p.hbp+p.sf) : 0,
        slg: p.ab > 0 ? ((p.h - p.doubles - p.triples - p.hr + p.doubles*2 + p.triples*3 + p.hr*4)/p.ab).toFixed(3).replace(/^0/,"") : ".000",
        slgNum: p.ab > 0 ? (p.h - p.doubles - p.triples - p.hr + p.doubles*2 + p.triples*3 + p.hr*4)/p.ab : 0,
        tb: (p.h - p.doubles - p.triples - p.hr) + p.doubles*2 + p.triples*3 + p.hr*4,
      }));
      // Dedup pitching rows: one row per (player, team, gameKey). Keep the row
      // with the most IP (partial submissions lose to complete ones).
      const pitBest = {};
      (pit || []).forEach(r => {
        if (!r.player_name) return;
        const gk = gameKeyById[r.game_id] || `gid${r.game_id}`;
        const k = `${r.player_name}||${r.team}||${gk}`;
        const ipNum = parseFloat(r.ip)||0;
        if (!pitBest[k] || ipNum > pitBest[k].__ip) pitBest[k] = { ...r, __ip: ipNum };
      });
      const pitDedup = Object.values(pitBest);
      // Aggregate pitching
      const pitMap = {};
      pitDedup.forEach(row => {
        const key = `${row.player_name}||${row.team}`;
        if (!pitMap[key]) pitMap[key] = { player_name: row.player_name, team: row.team, ip:0,h:0,r:0,er:0,bb:0,k:0,w:0,l:0,sv:0,app:0 };
        const p = pitMap[key];
        p.app++; p.ip+=parseFloat(row.ip)||0; p.h+=row.h||0; p.r+=row.r||0;
        p.er+=row.er||0; p.bb+=row.bb||0; p.k+=row.k||0;
        if (row.decision==="W") p.w++;
        if (row.decision==="L") p.l++;
        if (row.decision==="S") p.sv++;
      });
      const pitArr = Object.values(pitMap).map(p => ({
        ...p,
        ipDisplay: `${Math.floor(p.ip)}.${Math.round((p.ip % 1)*3)}`,
        eraNum: p.ip > 0 ? (p.er / p.ip) * 9 : 999,
        era: p.ip > 0 ? ((p.er / p.ip) * 9).toFixed(2) : "---",
        whipNum: p.ip > 0 ? (p.h + p.bb) / p.ip : 999,
        whip: p.ip > 0 ? ((p.h + p.bb) / p.ip).toFixed(2) : "---",
      }));
      setBatting(batArr);
      setPitching(pitArr);
      setLoading(false);
    }).catch(e => { setError(e.message); setLoading(false); });
  }, [season]);

  // Sorting helpers
  const sortData = (data, col, dir) => {
    const numCols = { avg:"avgNum", obp:"obpNum", slg:"slgNum", era:"eraNum", whip:"whipNum" };
    const key = numCols[col] || col;
    return [...data].sort((a, b) => {
      const av = a[key] ?? (typeof a[key]==="string" ? "" : -Infinity);
      const bv = b[key] ?? (typeof b[key]==="string" ? "" : -Infinity);
      if (typeof av === "string") return dir==="asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return dir==="asc" ? av - bv : bv - av;
    });
  };

  const handleBatSort = col => {
    setBatSort(s => ({ col, dir: s.col===col && s.dir==="desc" ? "asc" : "desc" }));
  };
  const handlePitSort = col => {
    setPitSort(s => ({ col, dir: s.col===col && s.dir==="asc" ? "desc" : "asc" }));
  };

  // Load player career stats grouped by season + game log for current season
  const loadPlayer = (playerName, team) => {
    setSelectedPlayer({ playerName, team });
    setPlayerLoading(true);
    setShowAllSeasons(false);
    setShowAllGames(false);

    async function fetchSeasonStats() {
      const enc = encodeURIComponent(`*${playerName}*`);
      const lines = await sbFetch(`batting_lines?select=game_id,team,ab,r,h,doubles,triples,hr,rbi,bb,k,hbp,sf,sb&player_name=ilike.${enc}&limit=1000`);
      if (!Array.isArray(lines) || lines.length === 0) return { seasons: [], gameLog: [], curSatSid: null };
      const gameIds = [...new Set(lines.map(l => l.game_id))];
      const games = await sbFetch(`games?id=in.(${gameIds.join(",")})&select=id,season_id,game_date,away_team,home_team,away_score,home_score,status&order=game_date.desc&limit=500`);
      // Dedupe duplicate game records (same date + teams) created when both captains submit their own box scores
      const dedupedGames = dedupGames(games);
      const validGameIds = new Set(dedupedGames.map(g => g.id));
      const dedupedLines = lines.filter(l => validGameIds.has(l.game_id));
      const seasonIds = [...new Set(dedupedGames.map(g => g.season_id).filter(Boolean))];
      if (!seasonIds.length) return { seasons: [], gameLog: [], curSatSid: null };
      const seasonList = await sbFetch(`seasons?id=in.(${seasonIds.join(",")})&select=id,name,year&order=year.desc`);
      const seasonNameMap = Object.fromEntries(seasonList.map(s => [s.id, s.name||s.year]));
      const seasonYearMap = Object.fromEntries(seasonList.map(s => [s.id, s.year||0]));
      const gameMap = Object.fromEntries(dedupedGames.map(g => [g.id, g]));
      const curSat = seasonList.find(s => s.name && s.name.includes("Diamond Classics Saturdays"));
      // Group lines by season
      const bySeasonId = {};
      const linesByGameId = {};
      for (const l of dedupedLines) {
        linesByGameId[l.game_id] = l;
        const g = gameMap[l.game_id];
        if (!g) continue;
        const sid = g.season_id;
        if (!bySeasonId[sid]) bySeasonId[sid] = { sid, name: seasonNameMap[sid]||"?", year: seasonYearMap[sid]||0, games: new Set(), ab:0,r:0,h:0,d:0,t:0,hr:0,rbi:0,bb:0,k:0,hbp:0,sf:0,sb:0 };
        const s = bySeasonId[sid];
        s.games.add(l.game_id);
        s.ab+=(l.ab||0); s.r+=(l.r||0); s.h+=(l.h||0); s.d+=(l.doubles||0);
        s.t+=(l.triples||0); s.hr+=(l.hr||0); s.rbi+=(l.rbi||0); s.bb+=(l.bb||0);
        s.k+=(l.k||0); s.hbp+=(l.hbp||0); s.sf+=(l.sf||0); s.sb+=(l.sb||0);
      }
      const seasons = Object.entries(bySeasonId)
        .map(([, s]) => ({ sid: s.sid, name: s.name, year: s.year, gp: s.games.size, ab:s.ab, r:s.r, h:s.h, d:s.d, t:s.t, hr:s.hr, rbi:s.rbi, bb:s.bb, k:s.k, hbp:s.hbp, sf:s.sf, sb:s.sb }))
        .sort((a, b) => b.year - a.year);
      // Build game log for current season (most recent first, already sorted by game_date desc)
      const gameLog = games
        .filter(g => curSat && g.season_id === curSat.id && g.status === "Final")
        .map(g => {
          const l = linesByGameId[g.id];
          if (!l) return null;
          const isAway = l.team === g.away_team;
          const myScore = isAway ? +g.away_score : +g.home_score;
          const oppScore = isAway ? +g.home_score : +g.away_score;
          return { date: g.game_date, opp: isAway ? g.home_team : g.away_team,
            isHome: !isAway, myScore, oppScore, won: myScore > oppScore,
            ab: l.ab||0, r: l.r||0, h: l.h||0, d: l.doubles||0,
            t: l.triples||0, hr: l.hr||0, rbi: l.rbi||0, bb: l.bb||0, k: l.k||0 };
        })
        .filter(Boolean);
      return { seasons, gameLog, curSatSid: curSat?.id };
    }

    fetchSeasonStats()
      .then(({ seasons, gameLog, curSatSid }) => {
        setPlayerGames(seasons);
        setPlayerGameLog(gameLog || []);
        setPlayerCurSid(curSatSid || null);
        setPlayerLoading(false);
      })
      .catch(() => setPlayerLoading(false));
  };

  const TEAM_COLOR = name => TEAM_COLORS[name] || "#002d6e";

  // Sorted + filtered data
  const sortedBat = sortData(batting, batSort.col, batSort.dir).filter(p =>
    p.player_name.toLowerCase().includes(playerSearch.toLowerCase()) ||
    p.team.toLowerCase().includes(playerSearch.toLowerCase())
  );
  const sortedPit = sortData(pitching, pitSort.col, pitSort.dir).filter(p =>
    p.player_name.toLowerCase().includes(playerSearch.toLowerCase()) ||
    p.team.toLowerCase().includes(playerSearch.toLowerCase())
  );

  // Column header with sort indicator
  const SortTh = ({ label, col, sortState, onSort, highlight=false, align="center", minWidth }) => {
    const active = sortState.col === col;
    const arrow = active ? (sortState.dir === "desc" ? " ▼" : " ▲") : " ↕";
    return (
      <th onClick={() => onSort(col)} style={{
        padding:"10px 8px", textAlign:align,
        fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:12,
        textTransform:"uppercase", whiteSpace:"nowrap", cursor:"pointer", userSelect:"none",
        borderBottom:"2px solid rgba(0,0,0,0.08)",
        color: active ? "#111" : (highlight ? "#002d6e" : "rgba(0,0,0,0.45)"),
        background: active ? "#f0f4ff" : "transparent",
        minWidth: minWidth || "auto",
        transition:"background .1s",
      }}>
        {label}<span style={{fontSize:9,opacity:active?1:0.4}}>{arrow}</span>
      </th>
    );
  };

  const BAT_COLS = [
    {label:"GP",col:"gp"},{label:"AB",col:"ab"},{label:"H",col:"h"},
    {label:"AVG",col:"avg",highlight:true},{label:"OBP",col:"obp",highlight:true},{label:"SLG",col:"slg",highlight:true},
    {label:"R",col:"r"},{label:"RBI",col:"rbi"},
    {label:"2B",col:"doubles"},{label:"3B",col:"triples"},
    {label:"HR",col:"hr"},{label:"TB",col:"tb"},{label:"BB",col:"bb"},{label:"K",col:"k"},{label:"SB",col:"sb"},
  ];
  const PIT_COLS = [
    {label:"APP",col:"app"},{label:"IP",col:"ip"},
    {label:"W",col:"w"},{label:"L",col:"l"},{label:"SV",col:"sv"},
    {label:"ERA",col:"era",highlight:true},{label:"WHIP",col:"whip",highlight:true},
    {label:"H",col:"h"},{label:"R",col:"r"},{label:"ER",col:"er"},
    {label:"BB",col:"bb"},{label:"K",col:"k"},
  ];

  const batValMap = p => {
    const singles = Math.max(0,(p.h||0)-(p.doubles||0)-(p.triples||0)-(p.hr||0));
    const tb = singles + (p.doubles||0)*2 + (p.triples||0)*3 + (p.hr||0)*4;
    return {
      gp:p.gp, ab:p.ab, h:p.h, avg:p.avg, obp:p.obp, slg:p.slg,
      r:p.r, rbi:p.rbi, doubles:p.doubles||0, triples:p.triples||0,
      hr:p.hr||0, tb, bb:p.bb||0, k:p.k||0, sb:p.sb||0,
    };
  };
  const pitValMap = p => ({
    app:p.app, ip:p.ipDisplay, w:p.w, l:p.l, sv:p.sv||0,
    era:p.era, whip:p.whip, h:p.h, r:p.r, er:p.er, bb:p.bb, k:p.k,
  });

  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8"}}>
      <PageHero label="League Statistics" title="Stats" subtitle={`${season === ALL_SEASONS_KEY ? "All Seasons Combined" : season} · Click any column header to sort`}>
        <TabBar items={["Batting","Pitching"]} active={tab} onChange={setTab} />
      </PageHero>

      <div style={{maxWidth:1400,margin:"0 auto",padding:"24px clamp(12px,3vw,40px) 60px"}}>
        {/* Controls */}
        <div style={{display:"flex",flexWrap:"wrap",gap:12,marginBottom:20,alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,background:"#fff",border:"1px solid rgba(0,0,0,0.12)",borderRadius:8,padding:"8px 14px",flex:"1 1 200px",maxWidth:340}}>
            <span style={{fontSize:16}}>🔍</span>
            <input value={playerSearch} onChange={e => setPlayerSearch(e.target.value)}
              placeholder="Search player or team…"
              style={{border:"none",outline:"none",fontSize:14,width:"100%",background:"transparent"}} />
            {playerSearch && <button onClick={() => setPlayerSearch("")} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(0,0,0,0.3)",fontSize:16,padding:0}}>✕</button>}
          </div>
          <select value={season} onChange={e => setSeason(e.target.value)}
            style={{padding:"9px 14px",borderRadius:8,border:"1px solid rgba(0,0,0,0.12)",fontSize:14,background:"#fff",cursor:"pointer"}}>
            <option value={ALL_SEASONS_KEY}>⭐ All Seasons Combined</option>
            <option disabled>──────────────</option>
            {seasons.filter(s => seasonsWithData.has(s)).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
            {seasons.some(s => !seasonsWithData.has(s)) && <option disabled>──────────────</option>}
            {seasons.filter(s => !seasonsWithData.has(s)).map(s => (
              <option key={s} value={s} disabled style={{color:"#aaa"}}>{s} (no stats)</option>
            ))}
          </select>
          {loading && <span style={{fontSize:13,color:"rgba(0,0,0,0.4)"}}>Loading…</span>}
        </div>

        {error && (
          <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"14px 18px",marginBottom:20,color:"#991b1b",fontSize:14}}>
            ⚠️ Could not load stats: {error}
          </div>
        )}

        {/* Player stats modal */}
        {selectedPlayer && (() => {
          const fmtAvg = (h,ab) => ab>0?(h/ab).toFixed(3).replace(/^0/,""):".---";
          const fmtObp = (h,bb,hbp,ab,sf) => { const d=ab+bb+hbp+sf; return d>0?((h+bb+hbp)/d).toFixed(3).replace(/^0/,""):".---"; };
          const fmtSlg = (h,d,t,hr,ab) => ab>0?((h+d+2*t+3*hr)/ab).toFixed(3).replace(/^0/,""):".---";
          const fmtDate = (dt) => { if(!dt) return ""; const d=new Date(dt+"T12:00:00"); return d.toLocaleDateString("en-US",{month:"short",day:"numeric"}); };
          const SEASON_GAMES = 15;
          const curSeason = playerGames.find(s => s.sid === playerCurSid);
          const careerTot = playerGames.reduce((a,s) => ({
            gp:a.gp+s.gp, ab:a.ab+s.ab, r:a.r+s.r, h:a.h+s.h, d:a.d+s.d, t:a.t+s.t,
            hr:a.hr+s.hr, rbi:a.rbi+s.rbi, bb:a.bb+s.bb, k:a.k+s.k, hbp:a.hbp+(s.hbp||0), sf:a.sf+(s.sf||0), sb:a.sb+s.sb,
          }), {gp:0,ab:0,r:0,h:0,d:0,t:0,hr:0,rbi:0,bb:0,k:0,hbp:0,sf:0,sb:0});
          const proj = curSeason && curSeason.gp > 0 ? (() => {
            const f = SEASON_GAMES / curSeason.gp;
            const rnd = v => Math.round(v*f);
            return { gp:SEASON_GAMES, ab:rnd(curSeason.ab), r:rnd(curSeason.r), h:rnd(curSeason.h),
              d:rnd(curSeason.d), t:rnd(curSeason.t), hr:rnd(curSeason.hr), rbi:rnd(curSeason.rbi),
              bb:rnd(curSeason.bb), k:rnd(curSeason.k), hbp:curSeason.hbp, sf:curSeason.sf, sb:rnd(curSeason.sb) };
          })() : null;
          const yearLabel = curSeason ? (curSeason.name.match(/\d{4}/)||[""])[0] : "";
          const statCols = ["GP","AB","R","H","2B","3B","HR","RBI","BB","SO","SB","AVG"];
          const statVals = (s) => s ? [s.gp,s.ab,s.r,s.h,s.d,s.t,s.hr,s.rbi,s.bb,s.k,s.sb||0,fmtAvg(s.h,s.ab)] : Array(12).fill("—");
          const visibleGames = showAllGames ? playerGameLog : playerGameLog.slice(0,5);
          return (
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={() => setSelectedPlayer(null)}>
              <div style={{background:"#fff",borderRadius:14,maxWidth:720,width:"100%",maxHeight:"92vh",overflow:"auto"}} onClick={e => e.stopPropagation()}>
                <div style={{position:"sticky",top:0,background:"#002d6e",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderRadius:"14px 14px 0 0",zIndex:1}}>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:24,color:"#fff",textTransform:"uppercase"}}>{selectedPlayer.playerName}</div>
                  <button onClick={() => setSelectedPlayer(null)} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:8,width:32,height:32,cursor:"pointer",fontSize:16}}>✕</button>
                </div>
                {playerLoading ? (
                  <div style={{textAlign:"center",padding:60,color:"rgba(0,0,0,0.4)"}}>Loading stats…</div>
                ) : playerGames.length === 0 ? (
                  <div style={{textAlign:"center",padding:60,color:"rgba(0,0,0,0.4)"}}>No stats found.</div>
                ) : (
                  <div style={{padding:"0 0 20px"}}>
                    {/* ── Batting Summary ── */}
                    <div style={{padding:"14px 20px 8px",display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                      <div style={{fontWeight:700,fontSize:17,color:"#111"}}>{yearLabel} Batting</div>
                      <button onClick={()=>setShowAllSeasons(v=>!v)} style={{background:"none",border:"none",color:"#2563eb",fontSize:13,fontWeight:600,cursor:"pointer",padding:0}}>
                        {showAllSeasons?"Hide":"See All"}
                      </button>
                    </div>
                    <div style={{overflowX:"auto",borderTop:"1px solid #e5e7eb",borderBottom:"1px solid #e5e7eb"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                        <thead>
                          <tr style={{background:"#f9fafb"}}>
                            <th style={{padding:"8px 16px 8px 20px",textAlign:"left",fontWeight:700,fontSize:11,color:"#6b7280",letterSpacing:".07em",whiteSpace:"nowrap",borderBottom:"1px solid #e5e7eb"}}>STATS</th>
                            {statCols.map(c=><th key={c} style={{padding:"8px 10px",textAlign:"center",fontWeight:700,fontSize:11,color:"#6b7280",letterSpacing:".07em",whiteSpace:"nowrap",borderBottom:"1px solid #e5e7eb"}}>{c}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{borderBottom:"1px solid #f0f0f0"}}>
                            <td style={{padding:"10px 16px 10px 20px",fontWeight:600,color:"#111",whiteSpace:"nowrap"}}>Regular Season</td>
                            {statVals(curSeason).map((v,i)=><td key={i} style={{padding:"10px",textAlign:"center",color:i===11?"#111":"#333",fontWeight:i===11?700:400}}>{v}</td>)}
                          </tr>
                          {proj && (
                            <tr style={{borderBottom:"1px solid #f0f0f0",background:"#fafafa"}}>
                              <td style={{padding:"10px 16px 10px 20px",fontWeight:600,color:"#555",whiteSpace:"nowrap",fontStyle:"italic"}}>Projected</td>
                              {statVals(proj).map((v,i)=><td key={i} style={{padding:"10px",textAlign:"center",color:i===11?"#555":"#888",fontStyle:"italic"}}>{v}</td>)}
                            </tr>
                          )}
                          <tr style={{borderTop:"2px solid #002d6e"}}>
                            <td style={{padding:"10px 16px 10px 20px",fontWeight:700,color:"#111",whiteSpace:"nowrap"}}>Career</td>
                            {statVals(careerTot).map((v,i)=><td key={i} style={{padding:"10px",textAlign:"center",color:i===11?"#002d6e":"#333",fontWeight:700}}>{v}</td>)}
                          </tr>
                          {showAllSeasons && playerGames.map((s,i)=>(
                            <tr key={i} style={{borderTop:"1px solid #e5e7eb",background:i%2===0?"#f9fafb":"#fff"}}>
                              <td style={{padding:"8px 16px 8px 20px",color:"#555",fontSize:12,whiteSpace:"nowrap"}}>{s.name}</td>
                              {statVals(s).map((v,j)=><td key={j} style={{padding:"8px 10px",textAlign:"center",color:j===11?"#002d6e":"#666",fontSize:12,fontWeight:j===11?600:400}}>{v}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* ── Recent Games ── */}
                    {playerGameLog.length > 0 && (
                      <>
                        <div style={{padding:"14px 20px 8px",display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                          <div style={{fontWeight:700,fontSize:17,color:"#111"}}>Recent Games</div>
                          {playerGameLog.length > 5 && (
                            <button onClick={()=>setShowAllGames(v=>!v)} style={{background:"none",border:"none",color:"#2563eb",fontSize:13,fontWeight:600,cursor:"pointer",padding:0}}>
                              {showAllGames?"Show Less":"See All"}
                            </button>
                          )}
                        </div>
                        <div style={{overflowX:"auto",borderTop:"1px solid #e5e7eb",borderBottom:"1px solid #e5e7eb"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                            <thead>
                              <tr style={{background:"#f9fafb"}}>
                                {["DATE","OPP","RESULT","AB","R","H","2B","3B","HR","RBI","BB","SO","SB"].map(c=>(
                                  <th key={c} style={{padding:"8px 8px",textAlign:c==="DATE"||c==="OPP"?"left":"center",fontWeight:700,fontSize:11,color:"#6b7280",letterSpacing:".07em",whiteSpace:"nowrap",borderBottom:"1px solid #e5e7eb",paddingLeft:c==="DATE"?"20px":"8px"}}>{c}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {visibleGames.map((g,i)=>(
                                <tr key={i} style={{borderBottom:"1px solid #f0f0f0",background:i%2===0?"#fff":"#fafafa"}}>
                                  <td style={{padding:"9px 8px 9px 20px",color:"#555",whiteSpace:"nowrap",fontSize:12}}>{fmtDate(g.date)}</td>
                                  <td style={{padding:"9px 8px",color:"#111",whiteSpace:"nowrap",maxWidth:130,overflow:"hidden",textOverflow:"ellipsis"}}>
                                    <span style={{color:"#888",marginRight:3}}>{g.isHome?"vs":"@"}</span>{g.opp}
                                  </td>
                                  <td style={{padding:"9px 8px",textAlign:"center",fontWeight:700,whiteSpace:"nowrap",color:g.won?"#16a34a":"#dc2626"}}>
                                    {g.won?"W":"L"} {g.myScore}-{g.oppScore}
                                  </td>
                                  <td style={{padding:"9px 8px",textAlign:"center"}}>{g.ab}</td>
                                  <td style={{padding:"9px 8px",textAlign:"center"}}>{g.r}</td>
                                  <td style={{padding:"9px 8px",textAlign:"center",fontWeight:g.h>0?600:400,color:g.h>0?"#111":"#aaa"}}>{g.h}</td>
                                  <td style={{padding:"9px 8px",textAlign:"center"}}>{g.d||0}</td>
                                  <td style={{padding:"9px 8px",textAlign:"center"}}>{g.t||0}</td>
                                  <td style={{padding:"9px 8px",textAlign:"center",color:g.hr>0?"#c8102e":"inherit",fontWeight:g.hr>0?700:400}}>{g.hr||0}</td>
                                  <td style={{padding:"9px 8px",textAlign:"center"}}>{g.rbi||0}</td>
                                  <td style={{padding:"9px 8px",textAlign:"center"}}>{g.bb||0}</td>
                                  <td style={{padding:"9px 8px",textAlign:"center",color:g.k>2?"#dc2626":"inherit"}}>{g.k||0}</td>
                                  <td style={{padding:"9px 8px",textAlign:"center",color:g.sb>0?"#002d6e":"inherit",fontWeight:g.sb>0?700:400}}>{g.sb||0}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                    <div style={{padding:"10px 20px 4px",fontSize:11,color:"#9ca3af"}}>Stats sourced from recorded box scores only.</div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* BATTING TABLE */}
        {tab === 0 && !loading && (
          <Card>
            <div style={{padding:"14px 18px",borderBottom:"1px solid rgba(0,0,0,0.07)",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,textTransform:"uppercase"}}>Batting Leaderboard</div>
              <div style={{fontSize:12,color:"rgba(0,0,0,0.4)"}}>{sortedBat.length} players · click column to sort · click name for career stats</div>
            </div>
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:700}}>
                <thead>
                  <tr style={{background:"#f8f9fb"}}>
                    <th style={{padding:"10px 14px",textAlign:"left",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:12,textTransform:"uppercase",color:"rgba(0,0,0,0.45)",whiteSpace:"nowrap",borderBottom:"2px solid rgba(0,0,0,0.08)",minWidth:140}}>Player</th>
                    <SortTh label="Team" col="team" sortState={batSort} onSort={handleBatSort} align="left" />
                    {BAT_COLS.map(c => <SortTh key={c.col} label={c.label} col={c.col} sortState={batSort} onSort={handleBatSort} highlight={c.highlight} />)}
                  </tr>
                </thead>
                <tbody>
                  {sortedBat.map((p, i) => {
                    const vals = batValMap(p);
                    return (
                      <tr key={i} style={{borderBottom:"1px solid rgba(0,0,0,0.05)",background:i%2===0?"#fff":"#fafafa",transition:"background .1s",cursor:"pointer"}}
                        onMouseEnter={e => e.currentTarget.style.background="#f0f4ff"}
                        onMouseLeave={e => e.currentTarget.style.background=i%2===0?"#fff":"#fafafa"}
                        onClick={() => loadPlayer(p.player_name, p.team)}>
                        <td style={{padding:"9px 14px",fontWeight:600,whiteSpace:"nowrap"}}>
                          <span style={{fontSize:11,color:"rgba(0,0,0,0.3)",marginRight:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700}}>{i+1}</span>
                          {p.player_name}
                        </td>
                        <td style={{padding:"9px 8px",whiteSpace:"nowrap"}}>
                          <span style={{background:`${TEAM_COLOR(p.team)}18`,color:TEAM_COLOR(p.team),border:`1px solid ${TEAM_COLOR(p.team)}40`,borderRadius:4,padding:"2px 6px",fontSize:11,fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif",textTransform:"uppercase"}}>{p.team}</span>
                        </td>
                        {BAT_COLS.map(c => (
                          <td key={c.col} style={{
                            padding:"9px 8px", textAlign:"center",
                            background: batSort.col===c.col ? "rgba(0,45,110,0.03)" : "transparent",
                            fontWeight: ["avg","obp","slg"].includes(c.col) ? 800 : c.col==="rbi"||c.col==="hr" ? 600 : 400,
                            color: ["avg","obp","slg"].includes(c.col) ? "#002d6e" : c.col==="hr"&&vals[c.col]>0 ? "#c8102e" : "inherit",
                            fontSize: ["avg","obp","slg"].includes(c.col) ? 14 : 13,
                            fontFamily: ["avg","obp","slg"].includes(c.col) ? "'Barlow Condensed',sans-serif" : "inherit",
                          }}>{vals[c.col]}</td>
                        ))}
                      </tr>
                    );
                  })}
                  {sortedBat.length === 0 && (
                    <tr><td colSpan={16} style={{padding:"40px",textAlign:"center",color:"rgba(0,0,0,0.35)"}}>No players found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* PITCHING TABLE */}
        {tab === 1 && !loading && (
          <Card>
            <div style={{padding:"14px 18px",borderBottom:"1px solid rgba(0,0,0,0.07)",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,textTransform:"uppercase"}}>Pitching Leaderboard</div>
              <div style={{fontSize:12,color:"rgba(0,0,0,0.4)"}}>{sortedPit.length} pitchers · click column to sort</div>
            </div>
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:600}}>
                <thead>
                  <tr style={{background:"#f8f9fb"}}>
                    <th style={{padding:"10px 14px",textAlign:"left",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:12,textTransform:"uppercase",color:"rgba(0,0,0,0.45)",whiteSpace:"nowrap",borderBottom:"2px solid rgba(0,0,0,0.08)",minWidth:140}}>Pitcher</th>
                    <SortTh label="Team" col="team" sortState={pitSort} onSort={handlePitSort} align="left" />
                    {PIT_COLS.map(c => <SortTh key={c.col} label={c.label} col={c.col} sortState={pitSort} onSort={handlePitSort} highlight={c.highlight} />)}
                  </tr>
                </thead>
                <tbody>
                  {sortedPit.map((p, i) => {
                    const vals = pitValMap(p);
                    return (
                      <tr key={i} style={{borderBottom:"1px solid rgba(0,0,0,0.05)",background:i%2===0?"#fff":"#fafafa",cursor:"pointer"}}
                        onMouseEnter={e => e.currentTarget.style.background="#f0f4ff"}
                        onMouseLeave={e => e.currentTarget.style.background=i%2===0?"#fff":"#fafafa"}
                        onClick={() => loadPlayer(p.player_name, p.team)}>
                        <td style={{padding:"9px 14px",fontWeight:600,whiteSpace:"nowrap"}}>
                          <span style={{fontSize:11,color:"rgba(0,0,0,0.3)",marginRight:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700}}>{i+1}</span>
                          {p.player_name}
                        </td>
                        <td style={{padding:"9px 8px",whiteSpace:"nowrap"}}>
                          <span style={{background:`${TEAM_COLOR(p.team)}18`,color:TEAM_COLOR(p.team),border:`1px solid ${TEAM_COLOR(p.team)}40`,borderRadius:4,padding:"2px 6px",fontSize:11,fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif",textTransform:"uppercase"}}>{p.team}</span>
                        </td>
                        {PIT_COLS.map(c => (
                          <td key={c.col} style={{
                            padding:"9px 8px", textAlign:"center",
                            background: pitSort.col===c.col ? "rgba(0,45,110,0.03)" : "transparent",
                            fontWeight: ["era","whip"].includes(c.col) ? 800 : c.col==="w" ? 700 : c.col==="l" ? 700 : 400,
                            color: ["era","whip"].includes(c.col) ? "#002d6e" : c.col==="w"&&vals[c.col]>0 ? "#166534" : c.col==="l"&&vals[c.col]>0 ? "#991b1b" : "inherit",
                            fontSize: ["era","whip"].includes(c.col) ? 14 : 13,
                            fontFamily: ["era","whip"].includes(c.col) ? "'Barlow Condensed',sans-serif" : "inherit",
                          }}>{vals[c.col]}</td>
                        ))}
                      </tr>
                    );
                  })}
                  {sortedPit.length === 0 && (
                    <tr><td colSpan={14} style={{padding:"40px",textAlign:"center",color:"rgba(0,0,0,0.35)"}}>No pitchers found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <div style={{marginTop:16,fontSize:12,color:"rgba(0,0,0,0.35)",textAlign:"center"}}>
          Stats pulled live from database · {season} · {batting.length} batters, {pitching.length} pitchers logged
        </div>
        <StatLegend />
      </div>
    </div>
  );
}


/* ─── LIVE SCORER ─────────────────────────────────────────────────────────── */
function Diamond({ bases, onBaseClick }) {
  const c = (o) => o ? "#FFD700" : "rgba(255,255,255,0.75)";
  const clickable = !!onBaseClick;
  return (
    <svg width={150} height={150} viewBox="0 0 150 150">
      <polygon points="75,140 140,75 75,10 10,75" fill="#1e4d1a" stroke="#3d7a35" strokeWidth={1.5}/>
      <circle cx={75} cy={80} r={44} fill="#c4935a" opacity={0.22}/>
      <circle cx={75} cy={80} r={6} fill="#a07040" stroke="#7a5028" strokeWidth={1}/>
      <rect x={68} y={133} width={14} height={9} rx={1} fill="rgba(255,255,255,0.85)"/>
      {/* 1B */}
      <rect x={133} y={68} width={14} height={14} rx={2} fill={c(bases[0])}
        onClick={clickable && bases[0] ? ()=>onBaseClick("1B") : undefined}
        style={clickable && bases[0] ? {cursor:"pointer"} : {}}/>
      {/* 2B */}
      <rect x={68} y={3} width={14} height={14} rx={2} fill={c(bases[1])}
        onClick={clickable && bases[1] ? ()=>onBaseClick("2B") : undefined}
        style={clickable && bases[1] ? {cursor:"pointer"} : {}}/>
      {/* 3B */}
      <rect x={3} y={68} width={14} height={14} rx={2} fill={c(bases[2])}
        onClick={clickable && bases[2] ? ()=>onBaseClick("3B") : undefined}
        style={clickable && bases[2] ? {cursor:"pointer"} : {}}/>
    </svg>
  );
}

function LiveScorerPage({ teamFilter=null, onExit=null }) {
  const [view, setView] = useState("pick");
  const [weekIdx, setWeekIdx] = useState(0);
  const [liveLeague, setLiveLeague] = useState(() => BOOMERS_TEAMS.has(teamFilter) ? 1 : 0);
  const [gs, setGs] = useState(null);
  const [setupInfo, setSetupInfo] = useState(null);
  const [lineupStep, setLineupStep] = useState("away"); // will be set to captain's side on game select
  const [lineupDraft, setLineupDraft] = useState({away:[],home:[]});
  const [lineupPitcher, setLineupPitcher] = useState({away:"",home:""});
  const [lineupPositions, setLineupPositions] = useState({away:{},home:{}});
  const [nameInput, setNameInput] = useState("");
  const [modal, setModal] = useState(null);
  const [pendingOutcome, setPO] = useState(null);
  const [pendingLoc, setPL] = useState(null);
  const [pendingOutType, setPOT] = useState(null);
  const [runnerDests, setRD] = useState({});
  const [stealBase, setStealBase] = useState(null); // "1B","2B","3B" — base clicked for steal
  const [pitcherSubSide, setPitcherSubSide] = useState(null); // "away"|"home" — which team is subbing pitcher
  const [addPlayerIdx, setAddPlayerIdx] = useState(null); // null=append, number=insert before that index
  const [saving, setSaving] = useState(false);
  // Box score submission
  const [bsMode, setBsMode] = useState(false); // true = box score entry mode
  const [rosterCache, setRosterCache] = useState({}); // {teamName: [{name,number}]}
  const [bsTab, setBsTab] = useState("batting"); // "batting" | "pitching" | "paste"
  const [bsScore, setBsScore] = useState({away:"",home:""});
  const [bsBat, setBsBat] = useState({}); // {playerName: {ab,h,r,rbi,bb,k,doubles,triples,hr,hbp,sf}}
  const [bsPit, setBsPit] = useState([]); // [{name,team,ip,h,r,er,bb,k,decision}]
  const [bsPaste, setBsPaste] = useState("");
  const [bsSaving, setBsSaving] = useState(false);

  const lsKey = (a,h,d) => `lbdc_live_${a}_${h}_${d}`.replace(/[\s/]/g,"_");
  const lineupDraftKey = (a,h,d) => `lbdc_lineup_${a}_${h}_${d}`.replace(/[\s/]/g,"_");
  const saveLineupDraft = (draft, a, h, d) => { try { localStorage.setItem(lineupDraftKey(a,h,d), JSON.stringify(draft)); } catch(e) {} };
  const loadLineupDraft = (a,h,d) => { try { return JSON.parse(localStorage.getItem(lineupDraftKey(a,h,d))); } catch(e) { return null; } };
  const clearLineupDraft = (a,h,d) => { try { localStorage.removeItem(lineupDraftKey(a,h,d)); } catch(e) {} };
  // Auto-save lineupDraft to localStorage when it changes (during lineup setup)
  useEffect(() => {
    if (!setupInfo || view !== "lineup") return;
    saveLineupDraft(lineupDraft, setupInfo.away, setupInfo.home, setupInfo.date);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineupDraft, setupInfo, view]);

  const [liveStates, setLiveStates] = useState({});
  useEffect(() => {
    sbFetch("lbdc_live_state?select=id,data")
      .then(rows => {
        const m = {};
        (rows||[]).forEach(r => { m[r.id] = r.data; });
        setLiveStates(m);
      }).catch(() => {});
  }, []);
  const persist = (s) => {
    if (!s) return;
    const {_hist,...save} = s;
    const key = lsKey(s.away,s.home,s.date);
    setLiveStates(prev => ({...prev,[key]:save}));
    try { localStorage.setItem(`lbdc_game_${key}`, JSON.stringify(save)); } catch(e) {}
    sbUpsert("lbdc_live_state", {id:key, data:save}).catch(e => console.warn("Live state sync failed:", e.message));
    setGs(s);
  };
  const loadSaved = (a,h,d) => {
    const key = lsKey(a,h,d);
    if (liveStates[key]) return liveStates[key];
    try { const ls=localStorage.getItem(`lbdc_game_${key}`); if(ls) return JSON.parse(ls); } catch(e) {}
    return null;
  };
  const clearSaved = (a,h,d) => {
    const key = lsKey(a,h,d);
    setLiveStates(prev => { const n={...prev}; delete n[key]; return n; });
    try { localStorage.removeItem(`lbdc_game_${key}`); } catch(e) {}
    sbDelete(`lbdc_live_state?id=eq.${key}`).catch(()=>{});
  };

  const weekGames = (SCHED[weekIdx]?.fields||[])
    .flatMap(f => f.games.map(g => ({...g,field:f.name,date:SCHED[weekIdx].label})))
    .filter(g => !teamFilter || g.away===teamFilter || g.home===teamFilter);

  const getBatter = (s) => { const side=s.topBottom==="top"?"away":"home"; const lu=s.lineup[side]; return lu.length?lu[s.batterIdx[side]%lu.length]:"—"; };
  const getOnDeck = (s) => { const side=s.topBottom==="top"?"away":"home"; const lu=s.lineup[side]; return lu.length?lu[(s.batterIdx[side]+1)%lu.length]:"—"; };
  const advBatter = (s, explicitSide) => { const side=explicitSide||(s.topBottom==="top"?"away":"home"); return {...s,batterIdx:{...s.batterIdx,[side]:s.batterIdx[side]+1},balls:0,strikes:0}; };
  const endHalf = (s) => {
    const side=s.topBottom==="top"?"away":"home";
    const ls={...s.lineScore,[side]:[...s.lineScore[side],s.runsThisHalf]};
    if (s.topBottom==="top") return {...s,topBottom:"bot",outs:0,bases:[false,false,false],runsThisHalf:0,balls:0,strikes:0,lineScore:ls};
    return {...s,inning:s.inning+1,topBottom:"top",outs:0,bases:[false,false,false],runsThisHalf:0,balls:0,strikes:0,lineScore:ls};
  };
  const addOut = (s,n=1) => {
    const pitcher = getCurPitcher(s);
    const actualOuts = Math.min(n, 3 - s.outs); // cap at outs actually recorded this half
    let ps = s.pitStats||{};
    if (pitcher && actualOuts>0) ps = updPitStat(ps, pitcher, {outs:actualOuts});
    const o=s.outs+n;
    return o>=3 ? endHalf({...s,outs:3,pitStats:ps}) : {...s,outs:o,pitStats:ps};
  };
  const updStat = (stats,name,d) => {
    if (!name||name==="—") return stats;
    const c=stats[name]||{ab:0,h:0,r:0,rbi:0,bb:0,k:0,hbp:0,e:0,doubles:0,triples:0,hr:0,sb:0};
    return {...stats,[name]:Object.entries(d).reduce((a,[k,v])=>({...a,[k]:(a[k]||0)+v}),c)};
  };
  const updPitStat = (ps,name,d) => {
    if (!name) return ps;
    const c=ps[name]||{outs:0,h:0,r:0,er:0,bb:0,k:0,hbp:0};
    return {...ps,[name]:Object.entries(d).reduce((a,[k,v])=>({...a,[k]:(a[k]||0)+v}),c)};
  };
  const getCurPitcher = (s) => s.curPitcher?.[(s.topBottom==="top"?"home":"away")]||null;
  const forceAdv = (bases) => {
    // A runner is only forced if every base between them and home is occupied
    const force1 = bases[0];                          // 1B runner forced if batter walks
    const force2 = bases[0] && bases[1];             // 2B runner forced only if 1B was also occupied
    const force3 = bases[0] && bases[1] && bases[2]; // 3B runner forced (scores) only if bases loaded
    const nb = [
      true,                                           // batter always takes 1st
      force1 || (bases[1] && !force2),               // 2nd: forced 1B runner, or unforced 2B runner stays
      force2 || (bases[2] && !force3),               // 3rd: forced 2B runner, or unforced 3B runner stays
    ];
    return [nb, force3 ? 1 : 0];
  };

  const applyPlay = (outcome,loc,outType,dests) => {
    const prevForUndo = {...gs,_hist:undefined};
    const hist = [...(gs._hist||[]).slice(-4),prevForUndo];
    let s = {...gs,_hist:hist,balls:0,strikes:0};
    const side = s.topBottom==="top"?"away":"home";
    const batter = getBatter(s);
    let stats={...s.stats}, bases=[...s.bases], score={...s.score}, runs=0, rbis=0;
    let pitStats={...(s.pitStats||{})};
    const pitcher=getCurPitcher(s);

    // applyDests: resolves runner destinations, credits R to runners who score,
    // and returns updated baseRunners so each play properly tracks who's on base.
    const applyDests = (d) => {
      let nb=[false,false,false],r=0,rbi=0,runnerOuts=0;
      const oldBr=s.baseRunners||{};
      let newBr={0:null,1:null,2:null};
      Object.entries(d||{}).forEach(([k,v])=>{
        const isBatter=k==="__batter__";
        const srcIdx=!isBatter?(k==="1B"?0:k==="2B"?1:k==="3B"?2:-1):-1;
        const runner=isBatter?batter:(srcIdx>=0?oldBr[srcIdx]:null);
        if(v==="scored"){
          r++;score[side]++;
          if(!isBatter){rbi++;if(runner)stats=updStat(stats,runner,{r:1});}
        } else if(v==="out"&&!isBatter){runnerOuts++;}
        else {
          const dstIdx=v==="1B"?0:v==="2B"?1:v==="3B"?2:-1;
          if(dstIdx>=0){nb[dstIdx]=true;if(runner)newBr[dstIdx]=runner;}
          else if(v==="stay"&&!isBatter){
            if(k==="3B"){nb[2]=true;if(runner)newBr[2]=runner;}
            else if(k==="2B"){nb[1]=true;if(runner)newBr[1]=runner;}
            else if(k==="1B"){nb[0]=true;if(runner)newBr[0]=runner;}
          }
        }
      });
      return {nb,r,rbi,runnerOuts,newBr};
    };

    if(outcome==="BB"||outcome==="HBP"){
      if(outcome==="BB"){stats=updStat(stats,batter,{bb:1});pitStats=updPitStat(pitStats,pitcher,{bb:1});}
      else{stats=updStat(stats,batter,{hbp:1});pitStats=updPitStat(pitStats,pitcher,{hbp:1});}
      const[nb,r]=forceAdv(bases);
      // Credit run to 3B runner if bases were loaded (force-scored)
      const oldBr=s.baseRunners||{};
      const force3=bases[0]&&bases[1]&&bases[2];
      if(r>0&&force3&&oldBr[2])stats=updStat(stats,oldBr[2],{r:1});
      if(r>0)pitStats=updPitStat(pitStats,pitcher,{r:1,er:1});
      // Shift baseRunners: batter→1B, 1B→2B (if forced), 2B→3B (if forced), 3B scored
      const force1=bases[0],force2=bases[0]&&bases[1];
      const newBrWalk={0:batter,1:force1?oldBr[0]:oldBr[1],2:force2?oldBr[1]:oldBr[2]};
      bases=nb;runs=r;rbis=r;score[side]+=runs;
      s={...s,baseRunners:newBrWalk};
    }
    else if(outcome==="K"){
      stats=updStat(stats,batter,{ab:1,k:1});
      pitStats=updPitStat(pitStats,pitcher,{k:1});
      const play={inning:s.inning,side:s.topBottom,batter,outcome:"K",loc:null,outType:null,rbis:0,runs:0};
      s={...s,stats,bases,score,pitStats,plays:[...s.plays,play]};s=addOut(s);s=advBatter(s,side);persist(s);setModal(null);setPO(null);return;
    }
    else if(outcome==="HR"){
      runs=bases.filter(Boolean).length+1;rbis=runs;score[side]+=runs;
      // Credit R to all runners already on base
      const oldBr=s.baseRunners||{};
      [0,1,2].forEach(i=>{if(bases[i]&&oldBr[i])stats=updStat(stats,oldBr[i],{r:1});});
      stats=updStat(stats,batter,{ab:1,h:1,hr:1,r:1,rbi:rbis});
      pitStats=updPitStat(pitStats,pitcher,{h:1,r:runs,er:runs});
      bases=[false,false,false];
      s={...s,baseRunners:{0:null,1:null,2:null}};
    }
    else if(outcome==="OUT"){
      stats=updStat(stats,batter,{ab:1});
      let runnerOuts=0,newBr=s.baseRunners||{};
      if(dests){const res=applyDests(dests);bases=res.nb;runs=res.r;rbis=res.rbi;runnerOuts=res.runnerOuts;newBr=res.newBr;}
      if(runs>0)pitStats=updPitStat(pitStats,pitcher,{r:runs,er:runs});
      const play={inning:s.inning,side:s.topBottom,batter,outcome:"OUT",loc,outType,rbis,runs};
      s={...s,stats,bases,score,pitStats,baseRunners:newBr,runsThisHalf:(s.runsThisHalf||0)+runs,plays:[...s.plays,play]};
      s=addOut(s,(outType==="DP"?2:1)+runnerOuts);s=advBatter(s,side);persist(s);setModal(null);setPO(null);setPL(null);setPOT(null);setRD({});return;
    }
    else if(outcome==="SAC"){
      let runnerOuts=0,newBr=s.baseRunners||{};
      if(dests){const res=applyDests(dests);bases=res.nb;runs=res.r;rbis=res.rbi;runnerOuts=res.runnerOuts;newBr=res.newBr;}
      stats=updStat(stats,batter,{rbi:rbis});
      if(runs>0)pitStats=updPitStat(pitStats,pitcher,{r:runs,er:runs});
      const play={inning:s.inning,side:s.topBottom,batter,outcome:"SAC",loc,outType,rbis,runs};
      s={...s,stats,bases,score,pitStats,baseRunners:newBr,runsThisHalf:(s.runsThisHalf||0)+runs,plays:[...s.plays,play]};
      s=addOut(s,1+runnerOuts);s=advBatter(s,side);persist(s);setModal(null);setPO(null);setPL(null);setPOT(null);setRD({});return;
    }
    else if(outcome==="E"||outcome==="FC"){
      stats=updStat(stats,batter,{ab:1});if(outcome==="E")stats=updStat(stats,batter,{e:1});
      let runnerOuts=0,newBr=s.baseRunners||{};
      if(dests){const res=applyDests(dests);bases=res.nb;runs=res.r;rbis=res.rbi;runnerOuts=res.runnerOuts;newBr=res.newBr;}
      else{bases=[true,...s.bases.slice(0,2)];const ob=s.baseRunners||{};newBr={0:batter,1:ob[0],2:ob[1]};}
      if(runs>0&&outcome!=="E")pitStats=updPitStat(pitStats,pitcher,{r:runs,er:runs});
      const play={inning:s.inning,side:s.topBottom,batter,outcome,loc,outType:null,rbis,runs};
      s={...s,stats,bases,score,pitStats,baseRunners:newBr,runsThisHalf:(s.runsThisHalf||0)+runs,plays:[...s.plays,play]};
      if(runnerOuts>0){s=addOut(s,runnerOuts);} s=advBatter(s,side);persist(s);setModal(null);setPO(null);setPL(null);setPOT(null);setRD({});return;
    }
    else{
      stats=updStat(stats,batter,{ab:1,h:1});
      if(outcome==="2B")stats=updStat(stats,batter,{doubles:1});
      if(outcome==="3B")stats=updStat(stats,batter,{triples:1});
      pitStats=updPitStat(pitStats,pitcher,{h:1});
      let runnerOuts=0,newBr=s.baseRunners||{};
      if(dests){
        const res=applyDests(dests);bases=res.nb;runs=res.r;rbis=res.rbi;runnerOuts=res.runnerOuts;newBr=res.newBr;
        if(dests["__batter__"]==="scored")stats=updStat(stats,batter,{r:1});
        stats=updStat(stats,batter,{rbi:rbis});
      } else {
        const ob=s.baseRunners||{};
        if(outcome==="1B"){bases=[true,s.bases[0],s.bases[1]];newBr={0:batter,1:ob[0],2:ob[1]};}
        else if(outcome==="2B"){bases=[false,true,s.bases[0]];newBr={0:null,1:batter,2:ob[0]};}
        else if(outcome==="3B"){bases=[false,false,true];newBr={0:null,1:null,2:batter};}
      }
      if(runs>0)pitStats=updPitStat(pitStats,pitcher,{r:runs,er:runs});
      const play={inning:s.inning,side:s.topBottom,batter,outcome,loc,outType:null,rbis,runs};
      s={...s,stats,bases,score,pitStats,baseRunners:newBr,runsThisHalf:(s.runsThisHalf||0)+runs,plays:[...s.plays,play]};
      if(runnerOuts>0)s=addOut(s,runnerOuts);
      s=advBatter(s,side);persist(s);setModal(null);setPO(null);setPL(null);setPOT(null);setRD({});return;
    }
    const play={inning:s.inning,side:s.topBottom,batter,outcome,loc,outType:null,rbis,runs};
    s={...s,stats,bases,score,pitStats,runsThisHalf:(s.runsThisHalf||0)+runs,plays:[...s.plays,play]};
    s=advBatter(s,side);persist(s);setModal(null);setPO(null);setPL(null);setPOT(null);setRD({});
  };

  const undoPlay = () => {
    if (!gs._hist?.length) return;
    persist({...gs._hist[gs._hist.length-1],_hist:gs._hist.slice(0,-1)});
  };

  // ── Stolen Base / Out Stealing ──
  // runnerName = name of runner on the stolen base (determined by batting order position)
  const applyOutStealing = (fromBase) => {
    const prevForUndo = {...gs,_hist:undefined};
    const hist = [...(gs._hist||[]).slice(-4),prevForUndo];
    let s = {...gs,_hist:hist};
    let bases = [...s.bases];
    const baseIdx = fromBase==="1B"?0:fromBase==="2B"?1:2;
    // Find runner name from play log
    let runnerName = null;
    for (let i = s.plays.length-1; i >= 0; i--) {
      const p = s.plays[i];
      if (p.side === s.topBottom && p.inning === s.inning) {
        if (["1B","2B","3B","BB","HBP","E","FC"].includes(p.outcome)) {
          runnerName = p.batter;
          break;
        }
      }
    }
    // Remove runner from base
    bases[baseIdx] = false;
    const newOuts = (s.outs||0) + 1;
    const play = {inning:s.inning,side:s.topBottom,batter:runnerName||"?",outcome:"OUT",loc:fromBase,outType:"CS",rbis:0,runs:0};
    let ns = {...s,bases,outs:newOuts,plays:[...s.plays,play]};
    // End half-inning if 3 outs
    if (newOuts >= 3) {
      const side = ns.topBottom==="top"?"away":"home";
      const opp  = ns.topBottom==="top"?"home":"away";
      const nextInning = ns.topBottom==="bottom" ? ns.inning+1 : ns.inning;
      const nextHalf   = ns.topBottom==="top" ? "bottom" : "top";
      ns = {...ns, topBottom:nextHalf, inning:nextInning, outs:0, bases:[false,false,false], runsThisHalf:0};
    }
    persist(ns);
    setStealBase(null);
    setModal(null);
  };

  const applySteal = (fromBase) => {
    const prevForUndo = {...gs,_hist:undefined};
    const hist = [...(gs._hist||[]).slice(-4),prevForUndo];
    let s = {...gs,_hist:hist};
    const side = s.topBottom==="top"?"away":"home";
    let bases = [...s.bases];
    let stats = {...s.stats};
    let score = {...s.score};
    let runs = 0;
    // Identify which lineup slot occupies this base
    // bases[0]=1B, bases[1]=2B, bases[2]=3B
    const baseIdx = fromBase==="1B"?0:fromBase==="2B"?1:2;
    // Use explicit baseRunners tracking if set, else fall back to play log heuristic
    let runnerName = (s.baseRunners||{})[baseIdx] || null;
    if (!runnerName) {
      for (let i = s.plays.length-1; i >= 0; i--) {
        const p = s.plays[i];
        if (p.side === s.topBottom && p.inning === s.inning) {
          if (["1B","2B","3B","BB","HBP","E","FC"].includes(p.outcome)) { runnerName = p.batter; break; }
        }
      }
    }
    let br = {...(s.baseRunners||{0:null,1:null,2:null})};
    // Advance base: 1B→2B, 2B→3B, 3B→score
    if (fromBase==="3B") {
      bases[2] = false; runs = 1; score[side] += 1;
      if (runnerName) stats = updStat(stats, runnerName, {sb:1, r:1});
      br[2] = null;
    } else if (fromBase==="2B") {
      bases[1] = false; bases[2] = true;
      if (runnerName) stats = updStat(stats, runnerName, {sb:1});
      br[2] = runnerName; br[1] = null;
    } else {
      bases[0] = false; bases[1] = true;
      if (runnerName) stats = updStat(stats, runnerName, {sb:1});
      br[1] = runnerName; br[0] = null;
    }
    const play = {inning:s.inning,side:s.topBottom,batter:runnerName||"?",outcome:"SB",loc:fromBase,outType:null,rbis:0,runs};
    s = {...s,stats,bases,baseRunners:br,score,runsThisHalf:(s.runsThisHalf||0)+runs,plays:[...s.plays,play]};
    persist(s);
    setStealBase(null);
    setModal(null);
  };

  // Wild Pitch / Passed Ball — advance runner without SB credit
  const applyAdvance = (fromBase, type) => {
    const prevForUndo = {...gs,_hist:undefined};
    const hist = [...(gs._hist||[]).slice(-4),prevForUndo];
    let s = {...gs,_hist:hist};
    const side = s.topBottom==="top"?"away":"home";
    let bases = [...s.bases];
    let stats = {...s.stats};
    let score = {...s.score};
    let runs = 0;
    const baseIdx = fromBase==="1B"?0:fromBase==="2B"?1:2;
    let runnerName = (s.baseRunners||{})[baseIdx] || null;
    if (!runnerName) {
      for (let i = s.plays.length-1; i >= 0; i--) {
        const p = s.plays[i];
        if (p.side === s.topBottom && p.inning === s.inning) {
          if (["1B","2B","3B","BB","HBP","E","FC"].includes(p.outcome)) { runnerName = p.batter; break; }
        }
      }
    }
    let br = {...(s.baseRunners||{0:null,1:null,2:null})};
    if (fromBase==="3B") {
      bases[2] = false; runs = 1; score[side] += 1;
      if (runnerName) stats = updStat(stats, runnerName, {r:1});
      br[2] = null;
    } else if (fromBase==="2B") {
      bases[1] = false; bases[2] = true;
      br[2] = runnerName; br[1] = null;
    } else {
      bases[0] = false; bases[1] = true;
      br[1] = runnerName; br[0] = null;
    }
    const play = {inning:s.inning,side:s.topBottom,batter:runnerName||"?",outcome:type,loc:fromBase,outType:null,rbis:0,runs};
    s = {...s,stats,bases,baseRunners:br,score,runsThisHalf:(s.runsThisHalf||0)+runs,plays:[...s.plays,play]};
    persist(s);
    setStealBase(null);
    setModal(null);
  };

  const initRunnerDests = (outcome) => {
    const d={};
    gs.bases.forEach((occ,i)=>{
      if(occ){
        const base=["1B","2B","3B"][i];
        const opts=getRunnerOpts(base,outcome);
        // Pre-select the most likely destination (first option = scored on triple/double, etc.)
        d[base]=opts[0];
      }
    });
    if(!["OUT","SAC"].includes(outcome))d["__batter__"]=outcome==="2B"?"2B":outcome==="3B"?"3B":"1B";
    setRD(d);
  };

  const onAction = (outcome) => {
    if(["BB","HBP","K"].includes(outcome)){applyPlay(outcome,null,null,null);return;}
    setPO(outcome);setModal("loc"); // HR, 1B, 2B, 3B, OUT, SAC all go through location
  };
  const onLocation = (loc) => {
    setPL(loc);
    if(pendingOutcome==="HR"){applyPlay("HR",loc,null,null);return;} // HR: just need location, no runners/outtype
    if(pendingOutcome==="OUT"||pendingOutcome==="SAC"){setModal("outtype");return;}
    if(gs.bases.some(Boolean)){initRunnerDests(pendingOutcome);setModal("runners");return;}
    applyPlay(pendingOutcome,loc,null,null);
  };
  const onOutType = (ot) => {
    setPOT(ot);
    if(gs.bases.some(Boolean)||pendingOutcome==="SAC"){initRunnerDests(pendingOutcome);setModal("runners");return;}
    applyPlay(pendingOutcome,pendingLoc,ot,null);
  };

  const endGame = async () => {
    setSaving(true);
    try {
      const seasons=await sbFetch("seasons?select=id,name&limit=50");
      const isBoomerGame=BOOMERS_TEAMS.has(gs.away)&&BOOMERS_TEAMS.has(gs.home);
      let season;
      if(isBoomerGame){
        season=seasons.find(s=>s.name==="2026 BOOMERS 60/70 Division")||seasons.find(s=>s.name.toLowerCase().includes("boomers"));
        if(!season){const byName=await sbFetch(`seasons?select=id,name&name=eq.2026%20BOOMERS%2060%2F70%20Division&limit=1`);season=byName?.[0];}
        if(!season){const r=await sbPost("seasons",[{name:"2026 BOOMERS 60/70 Division"}]);season=r?.[0];}
      }else{
        season=seasons.find(s=>s.name==="Spring/Summer 2026 Diamond Classics Saturdays")||seasons.find(s=>s.name.includes("Diamond Classics"));
        if(!season){const byName=await sbFetch(`seasons?select=id,name&name=eq.${encodeURIComponent("Spring/Summer 2026 Diamond Classics Saturdays")}&limit=1`);season=byName?.[0];}
        if(!season){const r=await sbPost("seasons",[{name:"Spring/Summer 2026 Diamond Classics Saturdays"}]);season=r?.[0];}
      }
      if(!season) throw new Error("Could not find or create season — please try again.");
      const _gsISODate = toISODate(gs.date) || null;
      const _gsDateFilter = _gsISODate ? `&game_date=eq.${_gsISODate}` : "";
      const existing=await sbFetch(`games?select=id,headline&away_team=eq.${encodeURIComponent(gs.away)}&home_team=eq.${encodeURIComponent(gs.home)}&season_id=eq.${season.id}${_gsDateFilter}&order=id.desc&limit=1`);
      const finalAway = bsScore.away!==""?parseInt(bsScore.away)||0:gs.score.away;
      const finalHome = bsScore.home!==""?parseInt(bsScore.home)||0:gs.score.home;
      const gameData={away_team:gs.away,home_team:gs.home,season_id:season.id,status:"Final",away_score:finalAway,home_score:finalHome,game_date:toISODate(gs.date)||null,game_time:gs.time||null,field:gs.field||null};
      let gameId;
      if(existing.length){
        gameId=existing[0].id;
        await sbPatch(`games?id=eq.${gameId}`,gameData);
        // Only overwrite batting lines if the game wasn't manually entered via BoxScoreEntry
        // (manually entered games have a headline set)
        if(!existing[0].headline){await sbDelete(`batting_lines?game_id=eq.${gameId}`);}
      }
      else{const r=await sbPost("games",[gameData]);if(!r?.[0]?.id) throw new Error("Game record was not created — please try again.");gameId=r[0].id;}
      const batRows=[];
      Object.entries(gs.stats).forEach(([name,st])=>{
        const awayIdx=gs.lineup.away.indexOf(name);
        const team=awayIdx>=0?gs.away:gs.home;
        const order=awayIdx>=0?awayIdx+1:gs.lineup.home.indexOf(name)+1;
        batRows.push({game_id:gameId,player_name:cleanName(name),team,ab:st.ab||0,h:st.h||0,r:st.r||0,rbi:st.rbi||0,bb:st.bb||0,k:st.k||0,hbp:st.hbp||0,doubles:st.doubles||0,triples:st.triples||0,hr:st.hr||0,sb:st.sb||0});
      });
      if(batRows.length)await sbPost("batting_lines",batRows);
      const toIP=(v)=>{if(!v&&v!==0)return null;const s=String(v).trim();const m=s.match(/^(\d+)\.([012])?$/);if(m)return parseInt(m[1])+(parseInt(m[2]||0)/3);const n=parseFloat(s);return isNaN(n)?null:n;};
      // Build pitcher rows from live tracked stats, then merge with any manual bsPit edits
      const autoRows={};
      Object.entries(gs.pitStats||{}).forEach(([name,st])=>{
        const team=gs.lineup.away.includes(name)?gs.away:gs.home;
        const outs=st.outs||0;
        const ip=Math.floor(outs/3)+(outs%3)/3; // decimal innings
        autoRows[name]={game_id:gameId,player_name:cleanName(name),team,ip,h:st.h||0,r:st.r||0,er:st.er||0,bb:st.bb||0,k:st.k||0,decision:null};
      });
      // Manual bsPit entries override auto-tracked ones
      bsPit.filter(p=>p.name).forEach(p=>{
        const key=p.name;
        const base=autoRows[key]||{game_id:gameId,player_name:cleanName(p.name),team:p.team};
        autoRows[key]={...base,ip:p.ip?toIP(p.ip):(base.ip||0),h:p.h?+p.h:(base.h||0),r:p.r?+p.r:(base.r||0),er:p.er?+p.er:(base.er||0),bb:p.bb?+p.bb:(base.bb||0),k:p.k?+p.k:(base.k||0),decision:p.decision||null};
      });
      const pitRows=Object.values(autoRows).filter(p=>p.ip>0||p.h>0||p.k>0||p.bb>0);
      if(pitRows.length){await sbDelete(`pitching_lines?game_id=eq.${gameId}`);await sbPost("pitching_lines",pitRows);}
      clearSaved(gs.away,gs.home,gs.date);setModal(null);setView("pick");
    } catch(e){alert(friendlyError(e));}
    setSaving(false);
  };

  // ── PICK SCREEN ──
  const boomersGames = BOOMERS_SCHED.filter(g => !teamFilter || g.away===teamFilter || g.home===teamFilter)
    .map(g => ({away:g.away,home:g.home,field:g.field,time:g.time,date:g.date}));

  if (view==="pick") return (
    <div style={{minHeight:"100vh",background:"#f2f4f8"}}>
      <PageHero label="Live Scoring" title="Score a Game" subtitle={teamFilter ? `${teamFilter} games · Select a game to start or resume` : "Select a game to start or resume scoring"}>
        {onExit && <button onClick={onExit} style={{marginTop:12,padding:"7px 16px",background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:8,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>← Back to Portal</button>}
      </PageHero>
      <div style={{maxWidth:680,margin:"0 auto",padding:"24px clamp(12px,3vw,40px) 60px"}}>
        {/* League toggle */}
        {!teamFilter && (
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            {["Saturday Division","Boomers 60/70"].map((label,i)=>(
              <button key={i} onClick={()=>setLiveLeague(i)} style={{
                padding:"7px 18px",borderRadius:20,border:"none",cursor:"pointer",
                fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,textTransform:"uppercase",
                background:liveLeague===i?"#002d6e":"rgba(0,0,0,0.07)",
                color:liveLeague===i?"#fff":"#333",
              }}>{label}</button>
            ))}
          </div>
        )}

        {/* Saturday week pills */}
        {liveLeague === 0 && (
          <div style={{display:"flex",gap:8,marginBottom:18,overflowX:"auto",paddingBottom:4}}>
            {SCHED.map((w,i)=>(
              <button key={i} onClick={()=>setWeekIdx(i)} style={{padding:"6px 14px",borderRadius:20,border:"none",cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,background:weekIdx===i?"#002d6e":"rgba(0,0,0,0.07)",color:weekIdx===i?"#fff":"#333"}}>{w.label}</button>
            ))}
          </div>
        )}

        {/* Boomers header */}
        {liveLeague === 1 && (
          <div style={{background:"#f3e8ff",border:"1px solid #d8b4fe",borderRadius:8,padding:"10px 16px",marginBottom:16,fontSize:13,color:"#6b21a8",fontWeight:700}}>
            👴 Boomers 60/70 · All 2026 games
          </div>
        )}

        {(liveLeague === 1 ? boomersGames : weekGames).map((g,i)=>{
          const saved=loadSaved(g.away,g.home,g.date);
          const isFinal=saved?.status==="final";
          const inProg=saved&&!isFinal;
          return (
            <div key={i} style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderLeft:`4px solid ${inProg?"#b45309":"#002d6e"}`,borderRadius:10,padding:"12px 14px",marginBottom:10,display:"flex",alignItems:"center",gap:10}}>
              <div style={{flex:1,minWidth:0}}>
                {/* Teams row with time/field on right */}
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    {/* Away */}
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                      <TLogo name={g.away} size={26}/>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,textTransform:"uppercase"}}>{g.away}</span>
                      <span style={{fontSize:11,color:"rgba(0,0,0,0.35)",fontWeight:600}}>{(()=>{const t=ALL_TEAMS.find(t=>t.name===g.away);return t&&(t.w||t.l)?`${t.w}-${t.l}`:""})()}</span>
                    </div>
                    {/* Home */}
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <TLogo name={g.home} size={26}/>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,textTransform:"uppercase"}}>{g.home}</span>
                      <span style={{fontSize:11,color:"rgba(0,0,0,0.35)",fontWeight:600}}>{(()=>{const t=ALL_TEAMS.find(t=>t.name===g.home);return t&&(t.w||t.l)?`${t.w}-${t.l}`:""})()}</span>
                    </div>
                  </div>
                  {/* Time / field */}
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#002d6e"}}>{g.time}</div>
                    <div style={{fontSize:11,color:"#888",marginTop:2,maxWidth:110,textAlign:"right"}}>{g.field}</div>
                    {inProg&&<div style={{fontSize:11,color:"#b45309",fontWeight:700,marginTop:3}}>⚡ {saved.inning} {saved.topBottom==="top"?"T":"B"} · {saved.score.away}–{saved.score.home}</div>}
                    {isFinal&&<div style={{fontSize:11,color:"#16a34a",fontWeight:700,marginTop:3}}>✅ {saved.score.away}–{saved.score.home}</div>}
                  </div>
                </div>
              </div>
              <div>
                {isFinal?(
                  <button disabled style={{padding:"8px 16px",background:"#e5e7eb",border:"none",borderRadius:8,fontWeight:700,fontSize:14,color:"#9ca3af"}}>Final</button>
                ):inProg?(
                  <button onClick={()=>{setGs({...saved,_hist:[]});setView("game");}} style={{padding:"8px 16px",background:"#b45309",border:"none",borderRadius:8,fontWeight:700,fontSize:14,color:"#fff",cursor:"pointer"}}>▶ Resume</button>
                ):(
                  <button onClick={()=>{setBsMode(false);setSetupInfo(g);const saved=loadLineupDraft(g.away,g.home,g.date);setLineupDraft(saved||{away:[],home:[]});setLineupPitcher({away:"",home:""});setLineupPositions({away:{},home:{}});setLineupStep("away");setView("lineup");sbFetch(`lbdc_rosters?select=name,number,team&team=in.(${encodeURIComponent(g.away)},${encodeURIComponent(g.home)})&order=id.asc`).then(rows=>{const c={};rows.forEach(r=>{if(!c[r.team])c[r.team]=[];c[r.team].push({name:r.name,number:r.number||""});});setRosterCache(c);}).catch(()=>{});}} style={{padding:"8px 16px",background:"#002d6e",border:"none",borderRadius:8,fontWeight:700,fontSize:14,color:"#fff",cursor:"pointer",whiteSpace:"nowrap"}}>⚡ Score Live</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── LINEUP SETUP ──
  if (view==="lineup") {
    const g=setupInfo;
    const teamName=g[lineupStep];
    const roster=rosterCache[teamName]||TEAM_ROSTERS[teamName]||[];
    const cur=lineupDraft[lineupStep];
    const addPlayer=(name)=>{if(!name.trim()||cur.includes(name.trim()))return;setLineupDraft(p=>({...p,[lineupStep]:[...p[lineupStep],name.trim()]}));setNameInput("");};
    const doneTeam=()=>{
      if(!cur.length){alert("Add at least 1 player.");return;}
      if(!lineupPitcher[lineupStep]){alert(`Select a starting pitcher for ${teamName} before continuing.`);return;}
      // Always require both lineups before starting
      if(lineupStep==="away"){setLineupStep("home");return;}
      if(bsMode){
        // Route to box score entry
        const initBat={};
        [...lineupDraft.away,...lineupDraft.home].forEach(n=>{initBat[n]={ab:"",h:"",r:"",rbi:"",bb:"",k:"",doubles:"",triples:"",hr:"",hbp:"",sf:""};});
        setBsBat(initBat);
        setBsPit([{name:"",team:g.away,ip:"",h:"",r:"",er:"",bb:"",k:"",decision:""}]);
        setBsScore({away:"",home:""});
        setBsTab("batting");
        setView("boxscore");
        return;
      }
      const si={};[...lineupDraft.away,...lineupDraft.home].forEach(n=>{si[n]={ab:0,h:0,r:0,rbi:0,bb:0,k:0,hbp:0,e:0,doubles:0,triples:0,hr:0,sb:0};});
      const state={away:g.away,home:g.home,date:g.date,field:g.field,time:g.time,inning:1,topBottom:"top",outs:0,bases:[false,false,false],baseRunners:{0:null,1:null,2:null},score:{away:0,home:0},lineScore:{away:[],home:[]},runsThisHalf:0,balls:0,strikes:0,lineup:lineupDraft,batterIdx:{away:0,home:0},stats:si,plays:[],status:"in_progress",pitcher:lineupPitcher,positions:lineupPositions,curPitcher:{away:lineupPitcher.away||"",home:lineupPitcher.home||""},pitStats:{}};
      clearLineupDraft(g.away,g.home,g.date);
      persist({...state,_hist:[]});setView("game");
    };
    return (
      <div style={{minHeight:"100vh",background:"#f2f4f8"}}>
        <div style={{background:"#002d6e",padding:"14px 16px",display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>lineupStep==="away"?setView("pick"):setLineupStep("away")} style={{padding:"6px 12px",background:"rgba(255,255,255,0.15)",border:"none",borderRadius:6,color:"#fff",fontWeight:700,cursor:"pointer"}}>← Back</button>
          <div style={{color:"#FFD700",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,textTransform:"uppercase"}}>{teamName} Batting Order</div>
          <div style={{marginLeft:"auto",fontSize:12,color:"rgba(255,255,255,0.5)"}}>{lineupStep==="away"?"Step 1 of 2":"Step 2 of 2"}</div>
          {onExit && <button onClick={onExit} style={{padding:"6px 12px",background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:6,color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>✕ Exit</button>}
        </div>
        <div style={{maxWidth:500,margin:"0 auto",padding:"20px 16px 60px"}}>
          <div style={{background:"#fff",borderRadius:12,padding:"20px",marginBottom:14,boxShadow:"0 2px 8px rgba(0,0,0,0.08)"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,textTransform:"uppercase",color:"#002d6e",marginBottom:12}}>{teamName} — {cur.length} players</div>
            {cur.map((name,i)=>{
              const pos = lineupPositions[lineupStep][name]||"";
              const isPitcher = lineupPitcher[lineupStep]===name;
              return (
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid rgba(0,0,0,0.06)"}}>
                <div style={{width:24,height:24,borderRadius:"50%",background:isPitcher?"#c8102e":"#002d6e",color:"#FFD700",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:13,flexShrink:0}}>{i+1}</div>
                <span style={{flex:1,fontSize:14,fontWeight:600,color:isPitcher?"#c8102e":"#111"}}>{name}{isPitcher&&<span style={{fontSize:10,marginLeft:5,background:"#c8102e",color:"#fff",borderRadius:3,padding:"1px 4px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700}}>SP</span>}</span>
                <select value={pos}
                  onChange={e=>{
                    const newPos=e.target.value;
                    setLineupPositions(p=>({...p,[lineupStep]:{...p[lineupStep],[name]:newPos}}));
                    if(newPos==="P") setLineupPitcher(p=>({...p,[lineupStep]:name}));
                    else if(lineupPitcher[lineupStep]===name && newPos!=="P") setLineupPitcher(p=>({...p,[lineupStep]:""}));
                  }}
                  style={{padding:"3px 4px",borderRadius:4,border:"1px solid #ddd",fontSize:12,background:"#f8f9fb",width:52,flexShrink:0}}>
                  <option value="">Pos</option>
                  {["P","C","1B","2B","3B","SS","LF","CF","RF","DH","EH"].map(p=><option key={p} value={p}>{p}</option>)}
                </select>
                <button onClick={()=>{setLineupDraft(p=>({...p,[lineupStep]:p[lineupStep].filter((_,j)=>j!==i)}));if(lineupPitcher[lineupStep]===name)setLineupPitcher(p=>({...p,[lineupStep]:""}));setLineupPositions(p=>({...p,[lineupStep]:Object.fromEntries(Object.entries(p[lineupStep]).filter(([k])=>k!==name))}));}} style={{padding:"3px 8px",background:"rgba(220,38,38,0.1)",border:"none",borderRadius:5,color:"#dc2626",fontWeight:700,cursor:"pointer",flexShrink:0}}>✕</button>
              </div>
              );
            })}
            {roster.length>0&&(
              <div style={{marginTop:12}}>
                <div style={{fontSize:11,color:"#888",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>Tap to add from roster:</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {roster.filter(p=>!cur.includes(p.name)).map(p=>(
                    <button key={p.name} onClick={()=>addPlayer(p.name)} style={{padding:"5px 10px",background:"rgba(0,45,110,0.07)",border:"1px solid rgba(0,45,110,0.2)",borderRadius:6,fontSize:13,fontWeight:600,color:"#002d6e",cursor:"pointer"}}>{p.name}</button>
                  ))}
                </div>
              </div>
            )}
            <div style={{marginTop:12,display:"flex",gap:8}}>
              <input value={nameInput} onChange={e=>setNameInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addPlayer(nameInput)} placeholder="Type player name + Enter..." style={{flex:1,padding:"8px 12px",border:"1px solid #ddd",borderRadius:8,fontSize:15}}/>
              <button onClick={()=>addPlayer(nameInput)} style={{padding:"8px 14px",background:"#002d6e",border:"none",borderRadius:8,color:"#fff",fontWeight:700,cursor:"pointer"}}>Add</button>
            </div>
          </div>

          {/* ── Required: Starting Pitcher ── */}
          {cur.length > 0 && (
            <div style={{background:lineupPitcher[lineupStep]?"#f0fdf4":"#fff7ed",border:`2px solid ${lineupPitcher[lineupStep]?"#16a34a":"#f97316"}`,borderRadius:12,padding:"16px 18px",marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <span style={{fontSize:20}}>⚾</span>
                <div>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:15,textTransform:"uppercase",color:lineupPitcher[lineupStep]?"#15803d":"#c2410c"}}>
                    Starting Pitcher <span style={{color:"#dc2626",fontSize:12}}>required</span>
                  </div>
                  <div style={{fontSize:11,color:"rgba(0,0,0,0.45)",marginTop:1}}>Must be selected to continue</div>
                </div>
                {lineupPitcher[lineupStep] && <span style={{marginLeft:"auto",fontSize:18}}>✅</span>}
              </div>
              <select value={lineupPitcher[lineupStep]}
                onChange={e=>{
                  const name=e.target.value;
                  setLineupPitcher(p=>({...p,[lineupStep]:name}));
                  if(name) setLineupPositions(p=>({...p,[lineupStep]:{...p[lineupStep],[name]:"P"}}));
                }}
                style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid ${lineupPitcher[lineupStep]?"#16a34a":"#f97316"}`,fontSize:15,fontFamily:"inherit",background:"#fff",fontWeight:lineupPitcher[lineupStep]?700:400}}>
                <option value="">— Select starting pitcher —</option>
                {cur.map(name=><option key={name} value={name}>{name}</option>)}
              </select>
            </div>
          )}

          <button onClick={doneTeam} style={{width:"100%",padding:"14px",background:lineupPitcher[lineupStep]?"#002d6e":"#9ca3af",border:"none",borderRadius:10,color:"#FFD700",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,textTransform:"uppercase",cursor:lineupPitcher[lineupStep]?"pointer":"not-allowed"}}>
            {lineupStep==="away"?`Next: ${g.home} Order →`:"▶ Start Game!"}
          </button>
        </div>
      </div>
    );
  }

  // ── BOX SCORE ENTRY ──
  if (view==="boxscore") {
    const g = setupInfo;
    const awayPlayers = lineupDraft.away;
    const homePlayers = lineupDraft.home;
    const batCols = ["ab","h","r","rbi","bb","k","doubles","triples","hr","hbp","sf"];
    const batLabels = ["AB","H","R","RBI","BB","K","2B","3B","HR","HBP","SF"];
    const updBat = (name, col, val) => setBsBat(p => ({...p,[name]:{...p[name],[col]:val}}));
    const updPit = (i, col, val) => setBsPit(p => p.map((r,j) => j===i ? {...r,[col]:val} : r));

    const parsePaste = () => {
      const lines = bsPaste.split("\n").filter(l => l.trim());
      const allPlayers = [...awayPlayers,...homePlayers];
      const newBat = {...bsBat};
      lines.forEach(line => {
        const nums = line.match(/\d+\.?\d*/g) || [];
        const namePart = line.replace(/\d+\.?\d*/g,"").trim().replace(/\s+/g," ");
        const match = allPlayers.find(p => namePart.toLowerCase().includes(p.split(" ").pop().toLowerCase()));
        if (match && nums.length >= 4) {
          newBat[match] = {
            ab: nums[0]||"", r: nums[1]||"", h: nums[2]||"", rbi: nums[3]||"",
            bb: nums[4]||"", k: nums[5]||"",
            doubles: nums[6]||"", triples: nums[7]||"", hr: nums[8]||"", hbp: "", sf: ""
          };
        }
      });
      setBsBat(newBat);
      setBsTab("batting");
      alert("Parsed! Review and correct stats before submitting.");
    };

    const submitBoxScore = async () => {
      if (bsScore.away==="" || bsScore.home==="") { alert("Enter final score."); return; }
      setBsSaving(true);
      try {
        const seasons = await sbFetch("seasons?select=id,name&limit=100");
        let season = seasons.find(s => s.name.includes("Diamond Classics Saturdays")) || seasons.find(s => s.name.includes("Spring") && s.name.includes("2026"));
        if (!season) { const r = await sbPost("seasons",[{name:"Spring/Summer 2026 Diamond Classics Saturdays"}]); season=r?.[0]; }
        if (!season) throw new Error("Could not find or create season — please try again.");
        const _gISODate = toISODate(g.date) || null;
        const _gDateFilter = _gISODate ? `&game_date=eq.${_gISODate}` : "";
        const existing = await sbFetch(`games?select=id&away_team=eq.${encodeURIComponent(g.away)}&home_team=eq.${encodeURIComponent(g.home)}&season_id=eq.${season.id}${_gDateFilter}&order=id.desc&limit=1`);
        const gameData = {away_team:g.away,home_team:g.home,season_id:season.id,status:"Final",away_score:parseInt(bsScore.away)||0,home_score:parseInt(bsScore.home)||0,game_date:_gISODate,game_time:g.time||null,field:g.field||null};
        let gameId;
        if (existing.length) {
          gameId = existing[0].id;
          await sbPatch(`games?id=eq.${gameId}`, gameData);
          await sbDelete(`batting_lines?game_id=eq.${gameId}`);
          await sbDelete(`pitching_lines?game_id=eq.${gameId}`);
        } else {
          const r = await sbPost("games",[gameData]);
          if(!r?.[0]?.id) throw new Error("Game record was not created — please try again.");
          gameId = r[0].id;
        }
        const batRows = [];
        [...awayPlayers.map(n=>({n,team:g.away})),...homePlayers.map(n=>({n,team:g.home}))].forEach(({n,team},i) => {
          const s = bsBat[n]||{};
          if (!s.ab && !s.h) return;
          batRows.push({game_id:gameId,player_name:cleanName(n),team,
            ab:parseInt(s.ab)||0,h:parseInt(s.h)||0,r:parseInt(s.r)||0,rbi:parseInt(s.rbi)||0,
            bb:parseInt(s.bb)||0,k:parseInt(s.k)||0,doubles:parseInt(s.doubles)||0,
            triples:parseInt(s.triples)||0,hr:parseInt(s.hr)||0,hbp:parseInt(s.hbp)||0,sf:parseInt(s.sf)||0});
        });
        if (batRows.length) await sbPost("batting_lines", batRows);
        const pitRows = bsPit.filter(p=>p.name&&p.ip).map(p=>({
          game_id:gameId,player_name:cleanName(p.name),team:p.team,ip:parseFloat(p.ip)||0,
          h:parseInt(p.h)||0,r:parseInt(p.r)||0,er:parseInt(p.er)||0,bb:parseInt(p.bb)||0,k:parseInt(p.k)||0,decision:p.decision||null
        }));
        if (pitRows.length) await sbPost("pitching_lines", pitRows);
        clearLineupDraft(g.away,g.home,g.date);
        alert("Box score saved!");
        setView("pick"); setBsMode(false);
      } catch(e) { alert(friendlyError(e)); }
      setBsSaving(false);
    };

    const inputStyle = {width:"100%",padding:"6px 4px",border:"1px solid rgba(0,0,0,0.15)",borderRadius:4,fontSize:13,textAlign:"center",background:"#fff"};

    return (
      <div style={{minHeight:"100vh",background:"#f2f4f8"}}>
        <div style={{background:"#002d6e",padding:"14px 16px",display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>setView("lineup")} style={{padding:"6px 12px",background:"rgba(255,255,255,0.15)",border:"none",borderRadius:6,color:"#fff",fontWeight:700,cursor:"pointer"}}>← Back</button>
          <div style={{flex:1,textAlign:"center"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,color:"#fff",textTransform:"uppercase"}}>{g.away} @ {g.home}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.6)"}}>{g.date} · {g.field}</div>
          </div>
        </div>

        <div style={{maxWidth:900,margin:"0 auto",padding:"20px 12px 60px"}}>
          {/* Final Score */}
          <div style={{background:"#fff",borderRadius:10,padding:"16px",marginBottom:16,border:"1px solid rgba(0,0,0,0.09)"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,textTransform:"uppercase",marginBottom:12}}>Final Score</div>
            <div style={{display:"flex",gap:16,alignItems:"center"}}>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:12,fontWeight:700,color:"rgba(0,0,0,0.5)",marginBottom:4}}>{g.away}</div>
                <input type="number" min="0" value={bsScore.away} onChange={e=>setBsScore(p=>({...p,away:e.target.value}))}
                  style={{width:70,padding:"8px",border:"2px solid #002d6e",borderRadius:8,fontSize:22,fontWeight:900,textAlign:"center"}} />
              </div>
              <div style={{fontSize:20,color:"#ccc",fontWeight:700}}>–</div>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:12,fontWeight:700,color:"rgba(0,0,0,0.5)",marginBottom:4}}>{g.home}</div>
                <input type="number" min="0" value={bsScore.home} onChange={e=>setBsScore(p=>({...p,home:e.target.value}))}
                  style={{width:70,padding:"8px",border:"2px solid #002d6e",borderRadius:8,fontSize:22,fontWeight:900,textAlign:"center"}} />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{display:"flex",gap:0,marginBottom:0,background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:"10px 10px 0 0",overflow:"hidden"}}>
            {[["batting","🏏 Batting"],["pitching","⚾ Pitching"],["paste","📋 Paste"]].map(([id,label])=>(
              <button key={id} onClick={()=>setBsTab(id)} style={{flex:1,padding:"11px",border:"none",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,background:bsTab===id?"#002d6e":"#f8f9fb",color:bsTab===id?"#fff":"#555",borderBottom:bsTab===id?"none":"1px solid rgba(0,0,0,0.09)"}}>{label}</button>
            ))}
          </div>

          <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderTop:"none",borderRadius:"0 0 10px 10px",padding:"16px",marginBottom:16}}>
            {bsTab==="batting" && (
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                  <thead>
                    <tr style={{background:"#f8f9fb"}}>
                      <th style={{padding:"8px 10px",textAlign:"left",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:12,textTransform:"uppercase",color:"rgba(0,0,0,0.45)",whiteSpace:"nowrap",minWidth:140}}>Player</th>
                      <th style={{padding:"6px 4px",fontSize:11,color:"rgba(0,0,0,0.4)",fontWeight:700}}>Team</th>
                      {batLabels.map(l=><th key={l} style={{padding:"6px 4px",fontSize:11,color:"rgba(0,0,0,0.4)",fontWeight:700,textAlign:"center",minWidth:40}}>{l}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {[...awayPlayers.map(n=>({n,team:g.away})),...homePlayers.map(n=>({n,team:g.home}))].map(({n,team},i) => (
                      <tr key={n} style={{borderBottom:"1px solid rgba(0,0,0,0.05)",background:i%2===0?"#fff":"#fafafa"}}>
                        <td style={{padding:"6px 10px",fontWeight:600,whiteSpace:"nowrap"}}>{n}</td>
                        <td style={{padding:"4px",textAlign:"center"}}>
                          <span style={{background:`${TEAM_COLORS[team]||"#002d6e"}18`,color:TEAM_COLORS[team]||"#002d6e",border:`1px solid ${TEAM_COLORS[team]||"#002d6e"}40`,borderRadius:4,padding:"1px 5px",fontSize:10,fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif",textTransform:"uppercase",whiteSpace:"nowrap"}}>{team}</span>
                        </td>
                        {batCols.map(col => (
                          <td key={col} style={{padding:"4px 2px"}}>
                            <input type="number" min="0" value={bsBat[n]?.[col]??""} onChange={e=>updBat(n,col,e.target.value)} style={inputStyle} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {bsTab==="pitching" && (
              <div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                  <thead>
                    <tr style={{background:"#f8f9fb"}}>
                      {["Pitcher","Team","IP","H","R","ER","BB","K","W/L/S"].map(l=>(
                        <th key={l} style={{padding:"8px 6px",fontSize:11,color:"rgba(0,0,0,0.4)",fontWeight:700,textAlign:"center",whiteSpace:"nowrap"}}>{l}</th>
                      ))}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {bsPit.map((p,i) => (
                      <tr key={i} style={{borderBottom:"1px solid rgba(0,0,0,0.05)"}}>
                        <td style={{padding:"4px 6px"}}>
                          <select value={p.name||""} onChange={e=>{
                            const name=e.target.value;
                            const team=awayPlayers.includes(name)?g.away:homePlayers.includes(name)?g.home:p.team;
                            updPit(i,"name",name);
                            updPit(i,"team",team);
                          }} style={{...inputStyle,textAlign:"left",minWidth:130}}>
                            <option value="">— Select pitcher —</option>
                            <optgroup label={g.away}>
                              {awayPlayers.map(n=><option key={n} value={n}>{n}</option>)}
                            </optgroup>
                            <optgroup label={g.home}>
                              {homePlayers.map(n=><option key={n} value={n}>{n}</option>)}
                            </optgroup>
                          </select>
                        </td>
                        <td style={{padding:"4px 6px"}}>
                          <select value={p.team} onChange={e=>updPit(i,"team",e.target.value)} style={{...inputStyle,textAlign:"left"}}>
                            <option value={g.away}>{g.away}</option>
                            <option value={g.home}>{g.home}</option>
                          </select>
                        </td>
                        {["ip","h","r","er","bb","k"].map(col=>(
                          <td key={col} style={{padding:"4px 6px"}}>
                            <input type="number" min="0" value={p[col]} onChange={e=>updPit(i,col,e.target.value)} style={inputStyle} />
                          </td>
                        ))}
                        <td style={{padding:"4px 6px"}}>
                          <select value={p.decision} onChange={e=>updPit(i,"decision",e.target.value)} style={inputStyle}>
                            <option value="">—</option>
                            <option value="W">W</option><option value="L">L</option><option value="S">S</option>
                          </select>
                        </td>
                        <td style={{padding:"4px"}}>
                          <button onClick={()=>setBsPit(p=>p.filter((_,j)=>j!==i))} style={{padding:"4px 8px",background:"#fee2e2",border:"none",borderRadius:4,color:"#991b1b",cursor:"pointer",fontSize:12,fontWeight:700}}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={()=>setBsPit(p=>[...p,{name:"",team:g.away,ip:"",h:"",r:"",er:"",bb:"",k:"",decision:""}])}
                  style={{marginTop:10,padding:"8px 16px",background:"#f0f4ff",border:"1px solid #002d6e",borderRadius:8,fontWeight:700,fontSize:13,color:"#002d6e",cursor:"pointer"}}>
                  + Add Pitcher
                </button>
              </div>
            )}

            {bsTab==="paste" && (
              <div>
                <p style={{fontSize:13,color:"rgba(0,0,0,0.5)",marginTop:0,marginBottom:10}}>Paste your printed box score text below. We'll try to match player names and fill in stats — review everything before submitting.</p>
                <textarea value={bsPaste} onChange={e=>setBsPaste(e.target.value)}
                  placeholder={"Example:\nJohn Smith  4  1  2  1  0  1\nMike Jones  3  0  1  0  1  0\n..."}
                  style={{width:"100%",minHeight:200,padding:10,border:"1px solid rgba(0,0,0,0.15)",borderRadius:8,fontSize:13,fontFamily:"monospace",boxSizing:"border-box"}} />
                <button onClick={parsePaste} style={{marginTop:8,padding:"9px 18px",background:"#002d6e",border:"none",borderRadius:8,fontWeight:700,fontSize:13,color:"#fff",cursor:"pointer"}}>
                  Parse & Fill Stats →
                </button>
              </div>
            )}
          </div>

          <button onClick={submitBoxScore} disabled={bsSaving}
            style={{width:"100%",padding:"14px",background:bsSaving?"#9ca3af":"#16a34a",border:"none",borderRadius:10,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,color:"#fff",cursor:bsSaving?"not-allowed":"pointer",textTransform:"uppercase",letterSpacing:".05em"}}>
            {bsSaving ? "Saving…" : "✅ Submit Box Score"}
          </button>
        </div>
      </div>
    );
  }

  // ── IN-GAME SCORER ──
  if (!gs) return null;
  const batter=getBatter(gs);
  const onDeck=getOnDeck(gs);
  const bSt=gs.stats[batter]||{};
  const avg=bSt.ab>0?(bSt.h/bSt.ab).toFixed(3).replace(/^0/,""):".000";
  const maxInns=Math.max(9,gs.lineScore.away.length+(gs.topBottom==="top"?1:2));
  const LOC_ROWS=[["LF","CF","RF"],["3B","SS","P","2B","1B"],[null,"C",null]];
  const OUT_TYPES=[["GO","Ground Out"],["FO","Fly Out"],["LO","Line Out"],["PO","Pop Out"],["DP","Double Play"]];
  const DEST_OPTS=["scored","3B","2B","1B","out","stay"];
  const DEST_LBL={scored:"🏠 Scored","3B":"3rd","2B":"2nd","1B":"1st",out:"Out",stay:"Stay"};
  // Returns only physically realistic destinations for a runner given the hit type
  // base = "1B","2B","3B" (where they started), outcome = "1B","2B","3B"
  const getRunnerOpts = (base, outcome) => {
    if (outcome === "3B") {
      // Triple: runner on 1B or 2B must score or be out; runner on 3B scores or out
      // "stay" allowed in rare cases (e.g. runner held)
      if (base === "1B") return ["scored","out","stay"];
      if (base === "2B") return ["scored","out","stay"];
      if (base === "3B") return ["scored","out","stay"];
    }
    if (outcome === "2B") {
      // Double: runner on 1B can score or stop at 3rd (or out); runner on 2B scores or out; runner on 3B scores
      if (base === "1B") return ["scored","3B","out","stay"];
      if (base === "2B") return ["scored","out","stay"];
      if (base === "3B") return ["scored","out","stay"];
    }
    if (outcome === "1B") {
      // Single: runners advance 1-2 bases typically; "stay" allows runner to hold
      if (base === "1B") return ["scored","3B","2B","out","stay"];
      if (base === "2B") return ["scored","3B","out","stay"];
      if (base === "3B") return ["scored","out","stay"];
    }
    // OUT/SAC: runners can advance or stay
    return ["scored","3B","2B","1B","out","stay"];
  };

  return (
    <div style={{minHeight:"100vh",background:"#111",color:"#fff",maxWidth:500,margin:"0 auto",paddingBottom:60}}>
      {/* Top bar */}
      <div style={{background:"#002d6e",padding:"10px 12px",display:"flex",alignItems:"center",gap:8,position:"sticky",top:62,zIndex:200}}>
        <button onClick={()=>setView("pick")} style={{padding:"5px 10px",background:"rgba(255,255,255,0.1)",border:"none",borderRadius:6,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>← Games</button>
        <div style={{flex:1,textAlign:"center",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,color:"#FFD700",textTransform:"uppercase"}}>{gs.away} {gs.score.away} – {gs.score.home} {gs.home}</div>
        <button onClick={()=>{
          // Pre-populate one blank pitcher per team
          setBsPit([
            {name:"",team:gs.away,ip:"",h:"",r:"",er:"",bb:"",k:"",decision:"ND"},
            {name:"",team:gs.home,ip:"",h:"",r:"",er:"",bb:"",k:"",decision:"ND"},
          ]);
          setBsScore({away:"",home:""});
          setModal("endgame");
        }} style={{padding:"5px 10px",background:"rgba(220,38,38,0.4)",border:"1px solid rgba(220,38,38,0.5)",borderRadius:6,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>End Game</button>
        {onExit && <button onClick={onExit} style={{padding:"5px 10px",background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:6,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>✕ Admin</button>}
      </div>
      {/* Inning bar */}
      <div style={{background:"#001a4d",borderBottom:"1px solid rgba(255,215,0,0.2)",padding:"6px 12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.6)",letterSpacing:".08em",fontWeight:700}}>{gs.topBottom==="top"?"▲ TOP":"▼ BOT"}</div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:28,color:"#fff",lineHeight:1}}>{gs.inning}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.55)",fontWeight:700}}>{gs[gs.topBottom==="top"?"away":"home"]} bat</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>{
            if(!window.confirm(`Reset ${gs.topBottom==="top"?"TOP":"BOT"} ${gs.inning}? Outs, runs, and batting order will revert to the start of this half.`))return;
            const side=gs.topBottom==="top"?"away":"home";
            const playsThisHalf=gs.plays.filter(p=>p.inning===gs.inning&&p.side===gs.topBottom);
            const pas=playsThisHalf.length;
            const newScore={...gs.score,[side]:Math.max(0,gs.score[side]-(gs.runsThisHalf||0))};
            const newBatterIdx={...gs.batterIdx,[side]:Math.max(0,gs.batterIdx[side]-pas)};
            const newPlays=gs.plays.filter(p=>!(p.inning===gs.inning&&p.side===gs.topBottom));
            persist({...gs,outs:0,bases:[false,false,false],balls:0,strikes:0,runsThisHalf:0,score:newScore,batterIdx:newBatterIdx,plays:newPlays,_hist:gs._hist||[]});
          }} style={{padding:"5px 8px",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:6,color:"#ccc",fontSize:11,fontWeight:700,cursor:"pointer"}}>↺ Half</button>
          <button onClick={()=>{
            if(!window.confirm("Full game reset?"))return;
            const fi={};[...gs.lineup.away,...gs.lineup.home].forEach(n=>{fi[n]={ab:0,h:0,r:0,rbi:0,bb:0,k:0,hbp:0,e:0,doubles:0,triples:0,hr:0,sb:0};});
            persist({...gs,inning:1,topBottom:"top",outs:0,bases:[false,false,false],score:{away:0,home:0},lineScore:{away:[],home:[]},runsThisHalf:0,balls:0,strikes:0,batterIdx:{away:0,home:0},stats:fi,plays:[],_hist:[]});
          }} style={{padding:"5px 8px",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:6,color:"#ccc",fontSize:11,fontWeight:700,cursor:"pointer"}}>↺ Game</button>
        </div>
      </div>
      {/* Diamond + batter */}
      <div style={{background:"#1a1a1a",padding:"14px 16px",display:"flex",gap:14,alignItems:"center"}}>
        <Diamond bases={gs.bases} onBaseClick={(base)=>setStealBase(base)}/>
        <div style={{flex:1}}>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:3,fontWeight:700}}>At Bat</div>
          <div onClick={()=>setModal("setBatter")} style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:24,color:"#fff",lineHeight:1.1,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
            {batter}<span style={{fontSize:12,color:"#FFD700",fontWeight:700,background:"rgba(255,215,0,0.15)",border:"1px solid rgba(255,215,0,0.35)",borderRadius:4,padding:"1px 5px",marginLeft:2}}>✎ edit</span>
          </div>
          <div style={{fontSize:14,color:"rgba(255,255,255,0.55)",marginTop:2,fontWeight:700}}>{bSt.h||0}-{bSt.ab||0} · {avg}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.4)",marginTop:5,fontWeight:600}}>On deck: {onDeck}</div>
          <div style={{display:"flex",gap:12,marginTop:10,alignItems:"center"}}>
            <div style={{display:"flex",gap:4,alignItems:"center"}}><span style={{fontSize:13,color:"rgba(255,255,255,0.5)",fontWeight:900}}>B</span>{[0,1,2].map(i=><div key={i} style={{width:17,height:17,borderRadius:"50%",background:i<gs.balls?"#22c55e":"rgba(255,255,255,0.12)",border:"2px solid rgba(255,255,255,0.25)"}}/>)}</div>
            <div style={{display:"flex",gap:4,alignItems:"center"}}><span style={{fontSize:13,color:"rgba(255,255,255,0.5)",fontWeight:900}}>S</span>{[0,1].map(i=><div key={i} style={{width:17,height:17,borderRadius:"50%",background:i<gs.strikes?"#FFD700":"rgba(255,255,255,0.12)",border:"2px solid rgba(255,255,255,0.25)"}}/>)}</div>
            <div style={{display:"flex",gap:4,alignItems:"center"}}><span style={{fontSize:13,color:"rgba(255,255,255,0.5)",fontWeight:900}}>O</span>{[0,1].map(i=><div key={i} style={{width:17,height:17,borderRadius:"50%",background:i<gs.outs?"#ef4444":"rgba(255,255,255,0.12)",border:"2px solid rgba(255,255,255,0.25)"}}/>)}</div>
          </div>
        </div>
      </div>
      {/* Pitch buttons */}
      <div style={{background:"#1a1a1a",borderTop:"1px solid rgba(255,255,255,0.05)",padding:"10px 16px",display:"flex",gap:8}}>
        <button onClick={()=>{const nb=gs.balls+1;if(nb>=4)applyPlay("BB",null,null,null);else persist({...gs,balls:nb});}} style={{flex:1,padding:"13px",background:"rgba(22,163,74,0.22)",border:"2px solid rgba(22,163,74,0.5)",borderRadius:8,color:"#4ade80",fontWeight:900,fontSize:18,cursor:"pointer"}}>Ball</button>
        <button onClick={()=>{const ns=gs.strikes+1;if(ns>=3)applyPlay("K",null,null,null);else persist({...gs,strikes:ns});}} style={{flex:1,padding:"13px",background:"rgba(220,38,38,0.22)",border:"2px solid rgba(220,38,38,0.5)",borderRadius:8,color:"#f87171",fontWeight:900,fontSize:18,cursor:"pointer"}}>Strike</button>
        <button onClick={()=>{if(gs.strikes<2)persist({...gs,strikes:gs.strikes+1});}} style={{flex:1,padding:"13px",background:"rgba(180,83,9,0.22)",border:"2px solid rgba(180,83,9,0.5)",borderRadius:8,color:"#fb923c",fontWeight:900,fontSize:18,cursor:"pointer"}}>Foul</button>
      </div>
      {/* Action buttons */}
      <div style={{padding:"12px 16px",background:"#111",display:"flex",flexDirection:"column",gap:6}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:5}}>
          {["1B","2B","3B","HR","BB"].map(o=>(
            <button key={o} onClick={()=>onAction(o)} style={{padding:"17px 4px",background:o==="HR"?"rgba(220,38,38,0.35)":o==="BB"?"rgba(22,163,74,0.25)":"rgba(0,45,110,0.55)",border:"2px solid rgba(255,255,255,0.15)",borderRadius:8,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:23,cursor:"pointer"}}>{o}</button>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:5}}>
          {["HBP","K","OUT","E","FC"].map(o=>(
            <button key={o} onClick={()=>onAction(o)} style={{padding:"17px 4px",background:o==="K"?"rgba(220,38,38,0.25)":o==="OUT"?"rgba(80,80,80,0.4)":"rgba(180,83,9,0.25)",border:"2px solid rgba(255,255,255,0.15)",borderRadius:8,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:23,cursor:"pointer"}}>{o}</button>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5}}>
          <button onClick={()=>onAction("SAC")} style={{padding:"12px",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,color:"#ddd",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,cursor:"pointer"}}>SAC</button>
          <button onClick={undoPlay} style={{padding:"12px",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,color:"#ddd",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,cursor:"pointer"}}>↩ Undo</button>
          <button onClick={()=>setModal("log")} style={{padding:"12px",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,color:"#ddd",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,cursor:"pointer"}}>📋 Log</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
          <button onClick={()=>setPitcherSubSide(gs.topBottom==="top"?"home":"away")} style={{padding:"10px",background:"rgba(99,102,241,0.12)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:8,color:"#a5b4fc",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer"}}>🔄 Change Pitcher</button>
          <button onClick={()=>setModal("pitStats")} style={{padding:"10px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"rgba(255,255,255,0.55)",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer"}}>📊 Pit Stats</button>
        </div>
      </div>
      {/* Line score */}
      <div style={{padding:"0 16px 16px",background:"#111",overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,background:"rgba(255,255,255,0.04)",borderRadius:8,overflow:"hidden",minWidth:280}}>
          <thead><tr>
            <th style={{textAlign:"left",padding:"6px 8px",color:"rgba(255,255,255,0.55)",fontWeight:700,fontSize:12,textTransform:"uppercase",minWidth:44}}>Team</th>
            {Array.from({length:maxInns},(_,i)=><th key={i} style={{textAlign:"center",padding:"6px 3px",color:"rgba(255,255,255,0.45)",fontWeight:700,fontSize:12,minWidth:22}}>{i+1}</th>)}
            <th style={{textAlign:"center",padding:"6px 8px",color:"rgba(255,255,255,0.8)",fontWeight:700,fontSize:14}}>R</th>
          </tr></thead>
          <tbody>
            {["away","home"].map(t=>(
              <tr key={t}>
                <td style={{padding:"6px 8px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:15,color:"#fff",textTransform:"uppercase"}}>{gs[t].slice(0,4)}</td>
                {Array.from({length:maxInns},(_,i)=>{
                  const v=gs.lineScore[t][i];
                  const isLive=v===undefined&&i===gs.inning-1&&((t==="away"&&gs.topBottom==="top")||(t==="home"&&gs.topBottom==="bot"));
                  return <td key={i} style={{textAlign:"center",padding:"5px 3px",color:v!==undefined?"#fff":isLive?"rgba(255,215,0,0.8)":"rgba(255,255,255,0.15)",fontWeight:isLive?700:500,fontSize:12,background:isLive?"rgba(255,215,0,0.08)":"transparent"}}>{v!==undefined?v:isLive?gs.runsThisHalf:"—"}</td>;
                })}
                <td style={{textAlign:"center",padding:"6px 8px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:19,color:"#FFD700"}}>{gs.score[t]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Current Pitchers */}
      {(()=>{
        const fmtIP=(outs)=>`${Math.floor(outs/3)}.${outs%3}`;
        return (
          <div style={{padding:"0 16px 10px",background:"#111"}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>Pitching</div>
            <div style={{display:"flex",gap:8}}>
              {["away","home"].map(side=>{
                const pitName=gs.curPitcher?.[side]||"—";
                const ps=(gs.pitStats||{})[pitName]||{};
                const outs=ps.outs||0;
                const isPitching=(side==="home"&&gs.topBottom==="top")||(side==="away"&&gs.topBottom==="bot");
                return (
                  <div key={side} style={{flex:1,background:isPitching?"rgba(99,102,241,0.12)":"rgba(255,255,255,0.04)",border:`1px solid ${isPitching?"rgba(99,102,241,0.4)":"rgba(255,255,255,0.08)"}`,borderRadius:8,padding:"8px 10px"}}>
                    <div style={{fontSize:9,color:isPitching?"#a5b4fc":"rgba(255,255,255,0.3)",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>{gs[side]}{isPitching&&" ⚡"}</div>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:14,color:isPitching?"#fff":"rgba(255,255,255,0.6)",marginBottom:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{pitName}</div>
                    {pitName!=="—"&&(
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:2}}>
                        {[["IP",fmtIP(outs)],["H",ps.h||0],["R",ps.r||0],["ER",ps.er||0],["BB",ps.bb||0],["K",ps.k||0]].map(([lbl,val])=>(
                          <div key={lbl} style={{textAlign:"center"}}>
                            <div style={{fontSize:8,color:"rgba(255,255,255,0.3)",fontWeight:700}}>{lbl}</div>
                            <div style={{fontSize:13,color:lbl==="K"?"#f87171":lbl==="BB"?"#4ade80":lbl==="IP"?"#FFD700":"rgba(255,255,255,0.7)",fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif"}}>{val}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* In-Game Box Score */}
      <div style={{padding:"0 16px 16px",background:"#111",overflowX:"auto"}}>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>Box Score — Tap a base to steal</div>
        {["away","home"].map(side=>{
          const players = gs.lineup[side];
          if (!players.length) return null;
          return (
            <div key={side} style={{marginBottom:10}}>
              <div style={{fontSize:10,fontWeight:900,color:"#FFD700",textTransform:"uppercase",fontFamily:"'Barlow Condensed',sans-serif",marginBottom:4}}>{gs[side]}</div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead>
                  <tr style={{background:"rgba(255,255,255,0.05)"}}>
                    <th style={{textAlign:"left",padding:"3px 6px",color:"rgba(255,255,255,0.4)",fontWeight:700,fontSize:10}}>Player</th>
                    {["AB","R","H","RBI","BB","K","SB"].map(c=>(
                      <th key={c} style={{textAlign:"center",padding:"3px 4px",color:c==="SB"?"#FFD700":"rgba(255,255,255,0.4)",fontWeight:700,fontSize:10}}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {players.map((name,i)=>{
                    const st = gs.stats[name]||{};
                    const isCur = side===(gs.topBottom==="top"?"away":"home") && i===gs.batterIdx[side]%players.length;
                    return (
                      <tr key={name} style={{background:isCur?"rgba(255,215,0,0.08)":"transparent",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                        <td style={{padding:"3px 6px",color:isCur?"#FFD700":"rgba(255,255,255,0.75)",fontWeight:isCur?700:400,fontSize:11,whiteSpace:"nowrap",maxWidth:90,overflow:"hidden",textOverflow:"ellipsis"}}>{name}</td>
                        {[st.ab||0,st.r||0,st.h||0,st.rbi||0,st.bb||0,st.k||0,st.sb||0].map((v,ci)=>(
                          <td key={ci} style={{textAlign:"center",padding:"3px 4px",color:ci===6&&v>0?"#FFD700":"rgba(255,255,255,0.65)",fontWeight:ci===6&&v>0?700:400,fontSize:11}}>{v||""}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      {/* ── MODALS ── */}
      {pitcherSubSide&&(()=>{
        const side=pitcherSubSide;
        const teamName=gs[side];
        const lineup=gs.lineup[side]||[];
        const curPit=gs.curPitcher?.[side]||"";
        const fmtIP=(o)=>`${Math.floor(o/3)}.${o%3}`;
        return (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:700,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
            <div style={{background:"#1c1c1c",borderRadius:"16px 16px 0 0",padding:"20px 16px 32px",width:"100%",maxWidth:480}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,color:"#a5b4fc",textTransform:"uppercase",marginBottom:4,textAlign:"center"}}>🔄 Change {teamName} Pitcher</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",textAlign:"center",marginBottom:14}}>Select incoming pitcher</div>
              <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:340,overflowY:"auto",marginBottom:10}}>
                {lineup.map((name,i)=>{
                  const ps=(gs.pitStats||{})[name]||null;
                  const isCur=name===curPit;
                  const outs=ps?.outs||0;
                  return (
                    <button key={i} onClick={()=>{
                      persist({...gs,curPitcher:{...gs.curPitcher,[side]:name}});
                      setPitcherSubSide(null);
                    }} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",background:isCur?"rgba(99,102,241,0.2)":"rgba(255,255,255,0.05)",border:`2px solid ${isCur?"rgba(99,102,241,0.6)":"rgba(255,255,255,0.1)"}`,borderRadius:10,color:isCur?"#a5b4fc":"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer",textAlign:"left"}}>
                      <span style={{flex:1}}>{name}{isCur&&<span style={{fontSize:10,marginLeft:6,background:"rgba(99,102,241,0.4)",borderRadius:3,padding:"1px 5px"}}>current</span>}</span>
                      {ps&&<span style={{fontSize:11,color:"rgba(255,255,255,0.4)",fontFamily:"monospace",fontWeight:400}}>{fmtIP(outs)} IP · {ps.h||0}H {ps.bb||0}BB {ps.k||0}K</span>}
                    </button>
                  );
                })}
              </div>
              <button onClick={()=>setPitcherSubSide(null)} style={{width:"100%",padding:"10px",background:"none",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:13}}>Cancel</button>
            </div>
          </div>
        );
      })()}

      {modal==="pitStats"&&(()=>{
        const fmtIP2=(o)=>`${Math.floor(o/3)}.${o%3}`;
        const allPit=gs.pitStats||{};
        return (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:700,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
            <div style={{background:"#1c1c1c",borderRadius:"16px 16px 0 0",padding:"20px 16px 32px",width:"100%",maxWidth:480,maxHeight:"80vh",overflowY:"auto"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,color:"#FFD700",textTransform:"uppercase",marginBottom:14,textAlign:"center"}}>📊 Pitching Stats</div>
              {["away","home"].map(side=>{
                const pitchers=gs.lineup[side].filter(n=>allPit[n]);
                if(!pitchers.length)return <div key={side} style={{marginBottom:10,fontSize:12,color:"rgba(255,255,255,0.3)",textAlign:"center"}}>{gs[side]}: no stats yet</div>;
                return (
                  <div key={side} style={{marginBottom:14}}>
                    <div style={{fontSize:10,fontWeight:900,color:"#FFD700",textTransform:"uppercase",fontFamily:"'Barlow Condensed',sans-serif",marginBottom:6}}>{gs[side]}</div>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead>
                        <tr style={{background:"rgba(255,255,255,0.06)"}}>
                          {["Pitcher","IP","H","R","ER","BB","K"].map(h=>(
                            <th key={h} style={{padding:"4px 6px",textAlign:h==="Pitcher"?"left":"center",color:"rgba(255,255,255,0.4)",fontWeight:700,fontSize:10}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pitchers.map(name=>{
                          const p2=allPit[name]||{};
                          const o2=p2.outs||0;
                          const isCur=gs.curPitcher?.[side]===name;
                          return (
                            <tr key={name} style={{borderBottom:"1px solid rgba(255,255,255,0.05)",background:isCur?"rgba(99,102,241,0.1)":"transparent"}}>
                              <td style={{padding:"5px 6px",color:isCur?"#a5b4fc":"#fff",fontWeight:isCur?700:400,whiteSpace:"nowrap"}}>{name}{isCur&&<span style={{fontSize:9,marginLeft:4,color:"#a5b4fc"}}>●</span>}</td>
                              <td style={{textAlign:"center",padding:"5px 4px",color:"#FFD700",fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif"}}>{fmtIP2(o2)}</td>
                              {[p2.h||0,p2.r||0,p2.er||0,p2.bb||0,p2.k||0].map((v,ci)=>(
                                <td key={ci} style={{textAlign:"center",padding:"5px 4px",color:ci===4?"#f87171":ci===3?"#4ade80":"rgba(255,255,255,0.7)"}}>{v||""}</td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
              <button onClick={()=>setModal(null)} style={{width:"100%",padding:"10px",background:"rgba(255,255,255,0.08)",border:"none",borderRadius:8,color:"#fff",fontWeight:700,cursor:"pointer",fontSize:14}}>Close</button>
            </div>
          </div>
        );
      })()}

      {stealBase&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:600,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div style={{background:"#1c1c1c",borderRadius:"16px 16px 0 0",padding:"20px 16px 32px",width:"100%",maxWidth:480}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,color:"#FFD700",textTransform:"uppercase",marginBottom:6,textAlign:"center"}}>Runner on {stealBase}</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.55)",textAlign:"center",marginBottom:16}}>What happened?</div>
            <div style={{display:"flex",gap:10,marginBottom:8}}>
              <button onClick={()=>applySteal(stealBase)} style={{flex:1,padding:"14px 8px",background:"rgba(255,215,0,0.15)",border:"2px solid rgba(255,215,0,0.4)",borderRadius:10,color:"#FFD700",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,cursor:"pointer",textAlign:"center"}}>
                🏃 Stolen Base{stealBase==="3B"?" — Scores!":stealBase==="2B"?" — 3rd":" — 2nd"}
              </button>
              <button onClick={()=>applyOutStealing(stealBase)} style={{flex:1,padding:"14px 8px",background:"rgba(220,38,38,0.15)",border:"2px solid rgba(220,38,38,0.4)",borderRadius:10,color:"#f87171",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,cursor:"pointer",textAlign:"center"}}>
                ❌ Out Stealing
              </button>
            </div>
            <div style={{display:"flex",gap:10,marginBottom:8}}>
              <button onClick={()=>applyAdvance(stealBase,"WP")} style={{flex:1,padding:"12px 8px",background:"rgba(99,102,241,0.15)",border:"2px solid rgba(99,102,241,0.4)",borderRadius:10,color:"#a5b4fc",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:15,cursor:"pointer",textAlign:"center"}}>
                ⚡ Wild Pitch{stealBase==="3B"?" — Scores!":stealBase==="2B"?" — 3rd":" — 2nd"}
              </button>
              <button onClick={()=>applyAdvance(stealBase,"PB")} style={{flex:1,padding:"12px 8px",background:"rgba(20,184,166,0.15)",border:"2px solid rgba(20,184,166,0.4)",borderRadius:10,color:"#5eead4",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:15,cursor:"pointer",textAlign:"center"}}>
                🥊 Passed Ball{stealBase==="3B"?" — Scores!":stealBase==="2B"?" — 3rd":" — 2nd"}
              </button>
            </div>
            <button onClick={()=>{setModal("setCR");}} style={{width:"100%",padding:"11px",background:"rgba(234,179,8,0.12)",border:"2px solid rgba(234,179,8,0.3)",borderRadius:10,color:"#fde047",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:15,cursor:"pointer",marginBottom:8}}>
              🔄 Courtesy / Pinch Runner on {stealBase}
            </button>
            <button onClick={()=>setStealBase(null)} style={{width:"100%",padding:"10px",background:"none",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:13}}>Cancel</button>
          </div>
        </div>
      )}
      {modal==="setCR"&&stealBase&&(()=>{
        const side=gs.topBottom==="top"?"away":"home";
        const lineup=gs.lineup[side]||[];
        const baseIdx=stealBase==="1B"?0:stealBase==="2B"?1:2;
        const currentRunner=(gs.baseRunners||{})[baseIdx];
        const teamName=gs[side];
        const roster=(rosterCache[teamName]||TEAM_ROSTERS[teamName]||[]).map(p=>typeof p==="string"?p:p.name);
        const candidates=[...new Set([...lineup,...roster])].filter(n=>n);
        return (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:700,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
            <div style={{background:"#1c1c1c",borderRadius:"16px 16px 0 0",padding:"20px 16px 32px",width:"100%",maxWidth:480}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,color:"#fde047",textTransform:"uppercase",marginBottom:4,textAlign:"center"}}>Courtesy / Pinch Runner</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.45)",textAlign:"center",marginBottom:14}}>
                Who is running on <strong style={{color:"#fff"}}>{stealBase}</strong>?{currentRunner&&<span> (currently <strong style={{color:"#fde047"}}>{currentRunner}</strong>)</span>}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:320,overflowY:"auto",marginBottom:10}}>
                {candidates.map((name,i)=>(
                  <button key={i} onClick={()=>{
                    const br={...(gs.baseRunners||{0:null,1:null,2:null}),[baseIdx]:name};
                    // Add to stats if new player
                    const newStats={...gs.stats};
                    if(!newStats[name])newStats[name]={ab:0,h:0,r:0,rbi:0,bb:0,k:0,hbp:0,e:0,doubles:0,triples:0,hr:0,sb:0};
                    persist({...gs,baseRunners:br,stats:newStats});
                    setModal(null);setStealBase(null);
                  }} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",background:name===currentRunner?"rgba(253,224,71,0.15)":"rgba(255,255,255,0.05)",border:`2px solid ${name===currentRunner?"rgba(253,224,71,0.5)":"rgba(255,255,255,0.1)"}`,borderRadius:10,color:name===currentRunner?"#fde047":"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer",textAlign:"left"}}>
                    {name}{name===currentRunner&&<span style={{marginLeft:"auto",fontSize:11}}>← current</span>}
                  </button>
                ))}
              </div>
              <button onClick={()=>{setModal(null);}} style={{width:"100%",padding:"10px",background:"none",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:13}}>← Back</button>
            </div>
          </div>
        );
      })()}
      {modal==="loc"&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.88)",zIndex:9000,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onTouchStart={e=>e.stopPropagation()}>
          <div style={{background:"#1c1c1c",borderRadius:"16px 16px 0 0",padding:"20px 16px 40px",width:"100%",maxWidth:500}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,color:"#FFD700",textTransform:"uppercase",marginBottom:14,textAlign:"center"}}>{pendingOutcome} — Where was it hit?</div>
            {LOC_ROWS.map((row,ri)=>(
              <div key={ri} style={{display:"flex",justifyContent:"center",gap:8,marginBottom:8}}>
                {row.map((loc,ci)=>loc
                  ? <button key={ci} onTouchEnd={e=>{e.preventDefault();onLocation(loc);}} onClick={()=>onLocation(loc)} style={{padding:"14px 16px",background:"rgba(0,45,110,0.55)",border:"1px solid rgba(100,160,255,0.3)",borderRadius:8,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,cursor:"pointer",minWidth:60,touchAction:"manipulation"}}>{loc}</button>
                  : <div key={ci} style={{minWidth:60}}/>)}
              </div>
            ))}
            <button onTouchEnd={e=>{e.preventDefault();onLocation(null);}} onClick={()=>onLocation(null)} style={{width:"100%",marginTop:10,padding:"13px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,color:"#999",fontWeight:700,cursor:"pointer",touchAction:"manipulation"}}>Skip</button>
            <button onTouchEnd={e=>{e.preventDefault();setModal(null);setPO(null);setPL(null);}} onClick={()=>{setModal(null);setPO(null);setPL(null);}} style={{width:"100%",marginTop:6,padding:"10px",background:"none",border:"none",color:"rgba(255,255,255,0.25)",cursor:"pointer",fontSize:13,touchAction:"manipulation"}}>Cancel</button>
          </div>
        </div>
      )}
      {modal==="outtype"&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:600,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div style={{background:"#1c1c1c",borderRadius:"16px 16px 0 0",padding:"20px 16px 32px",width:"100%",maxWidth:480}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,color:"#FFD700",textTransform:"uppercase",marginBottom:14,textAlign:"center"}}>Out Type</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {OUT_TYPES.filter(([code])=> code!=="DP" || gs.bases.some(Boolean)).map(([code,label])=>(
                <button key={code} onClick={()=>onOutType(code)} style={{padding:"13px",background:"rgba(80,80,80,0.25)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer",textAlign:"center"}}>
                  <span style={{fontSize:10,display:"block",color:"rgba(255,255,255,0.4)"}}>{code}</span>{label}
                </button>
              ))}
            </div>
            <button onClick={()=>{setModal(null);setPO(null);setPL(null);setPOT(null);}} style={{width:"100%",marginTop:10,padding:"8px",background:"none",border:"none",color:"rgba(255,255,255,0.25)",cursor:"pointer",fontSize:12}}>Cancel</button>
          </div>
        </div>
      )}
      {modal==="runners"&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:600,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div style={{background:"#1c1c1c",borderRadius:"16px 16px 0 0",padding:"20px 16px 32px",width:"100%",maxWidth:480,maxHeight:"80vh",overflowY:"auto"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,color:"#FFD700",textTransform:"uppercase",marginBottom:14,textAlign:"center"}}>Where did each runner end up?</div>
            {Object.keys(runnerDests).map(k=>(
              <div key={k} style={{marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.8)",marginBottom:6}}>{k==="__batter__"?`${batter} (batter)`:`Runner on ${k}`}</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {(k==="__batter__" ? DEST_OPTS : getRunnerOpts(k, pendingOutcome)).map(d=>(
                    <button key={d} onClick={()=>setRD(p=>({...p,[k]:d}))} style={{padding:"7px 11px",borderRadius:6,border:"2px solid",cursor:"pointer",fontSize:12,fontWeight:700,background:runnerDests[k]===d?"#FFD700":"rgba(255,255,255,0.07)",color:runnerDests[k]===d?"#002d6e":"#ddd",borderColor:runnerDests[k]===d?"#FFD700":"rgba(255,255,255,0.12)"}}>{DEST_LBL[d]}</button>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={()=>applyPlay(pendingOutcome,pendingLoc,pendingOutType,runnerDests)} style={{width:"100%",marginTop:8,padding:"13px",background:"#002d6e",border:"none",borderRadius:10,color:"#FFD700",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,textTransform:"uppercase",cursor:"pointer"}}>Confirm</button>
            <button onClick={()=>applyPlay(pendingOutcome,pendingLoc,pendingOutType,null)} style={{width:"100%",marginTop:6,padding:"8px",background:"none",border:"none",color:"rgba(255,255,255,0.25)",cursor:"pointer",fontSize:12}}>Skip / Auto-advance</button>
          </div>
        </div>
      )}
      {(modal==="setBatter"||modal==="setPH")&&(()=>{
        const side=gs.topBottom==="top"?"away":"home";
        const lineup=gs.lineup[side]||[];
        const curIdx=gs.batterIdx[side]%lineup.length;
        const teamName=gs[side];
        const roster=(rosterCache[teamName]||TEAM_ROSTERS[teamName]||[]).map(p=>typeof p==="string"?p:p.name);
        const rosterNotInLineup=roster.filter(n=>!lineup.includes(n));

        if(modal==="setPH") return (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:600,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
            <div style={{background:"#1c1c1c",borderRadius:"16px 16px 0 0",padding:"20px 16px 32px",width:"100%",maxWidth:480}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,color:"#FFD700",textTransform:"uppercase",marginBottom:4,textAlign:"center"}}>Pinch Hitter</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.45)",textAlign:"center",marginBottom:14}}>Replacing <strong style={{color:"#fff"}}>{lineup[curIdx]}</strong> in slot #{curIdx+1}</div>
              {rosterNotInLineup.length>0&&(
                <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:220,overflowY:"auto",marginBottom:12}}>
                  {rosterNotInLineup.map(name=>(
                    <button key={name} onClick={()=>{
                      const newLineup=[...lineup];newLineup[curIdx]=name;
                      const newStats={...gs.stats};
                      if(!newStats[name])newStats[name]={ab:0,h:0,r:0,rbi:0,bb:0,k:0,hbp:0,e:0,doubles:0,triples:0,hr:0,sb:0};
                      persist({...gs,lineup:{...gs.lineup,[side]:newLineup},stats:newStats,balls:0,strikes:0});
                      setModal(null);setNameInput("");
                    }} style={{padding:"11px 14px",background:"rgba(255,255,255,0.05)",border:"2px solid rgba(255,255,255,0.1)",borderRadius:10,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,cursor:"pointer",textAlign:"left"}}>
                      {name}
                    </button>
                  ))}
                </div>
              )}
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <input value={nameInput} onChange={e=>setNameInput(e.target.value)}
                  onKeyDown={e=>{
                    if(e.key!=="Enter"||!nameInput.trim())return;
                    const name=nameInput.trim();
                    const newLineup=[...lineup];newLineup[curIdx]=name;
                    const newStats={...gs.stats};
                    if(!newStats[name])newStats[name]={ab:0,h:0,r:0,rbi:0,bb:0,k:0,hbp:0,e:0,doubles:0,triples:0,hr:0,sb:0};
                    persist({...gs,lineup:{...gs.lineup,[side]:newLineup},stats:newStats,balls:0,strikes:0});
                    setModal(null);setNameInput("");
                  }}
                  placeholder="Type name + Enter…" style={{flex:1,padding:"10px 12px",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:8,color:"#fff",fontSize:15,fontFamily:"inherit"}}/>
                <button onClick={()=>{
                  if(!nameInput.trim())return;
                  const name=nameInput.trim();
                  const newLineup=[...lineup];newLineup[curIdx]=name;
                  const newStats={...gs.stats};
                  if(!newStats[name])newStats[name]={ab:0,h:0,r:0,rbi:0,bb:0,k:0,hbp:0,e:0,doubles:0,triples:0,hr:0,sb:0};
                  persist({...gs,lineup:{...gs.lineup,[side]:newLineup},stats:newStats,balls:0,strikes:0});
                  setModal(null);setNameInput("");
                }} style={{padding:"10px 16px",background:"#002d6e",border:"none",borderRadius:8,color:"#FFD700",fontWeight:700,cursor:"pointer"}}>Sub In</button>
              </div>
              <button onClick={()=>{setModal("setBatter");setNameInput("");}} style={{width:"100%",padding:"10px",background:"none",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:13}}>← Back</button>
            </div>
          </div>
        );

        return (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:600,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
            <div style={{background:"#1c1c1c",borderRadius:"16px 16px 0 0",padding:"20px 16px 32px",width:"100%",maxWidth:480}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,color:"#FFD700",textTransform:"uppercase",marginBottom:6,textAlign:"center"}}>Who's up?</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.45)",textAlign:"center",marginBottom:16}}>Tap to set the current batter</div>
              <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:300,overflowY:"auto",marginBottom:10}}>
                {lineup.map((name,i)=>{
                  const isCurrent=name===batter;
                  return (
                    <button key={i} onClick={()=>{
                      persist({...gs,batterIdx:{...gs.batterIdx,[side]:i},balls:0,strikes:0});
                      setModal(null);
                    }} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",background:isCurrent?"rgba(255,215,0,0.15)":"rgba(255,255,255,0.05)",border:`2px solid ${isCurrent?"rgba(255,215,0,0.5)":"rgba(255,255,255,0.1)"}`,borderRadius:10,color:isCurrent?"#FFD700":"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,cursor:"pointer",textAlign:"left"}}>
                      <span style={{width:24,height:24,borderRadius:"50%",background:isCurrent?"rgba(255,215,0,0.2)":"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>{i+1}</span>
                      {name}
                      {isCurrent&&<span style={{marginLeft:"auto",fontSize:12}}>← current</span>}
                    </button>
                  );
                })}
              </div>
              <button onClick={()=>setModal("setPH")} style={{width:"100%",padding:"12px",background:"rgba(99,102,241,0.15)",border:"2px solid rgba(99,102,241,0.35)",borderRadius:10,color:"#a5b4fc",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:15,cursor:"pointer",marginBottom:6}}>
                🔄 Pinch Hitter for {batter}
              </button>
              <div style={{marginBottom:8}}>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>➕ Add Player to Lineup</div>
                <div style={{display:"flex",gap:8,marginBottom:6}}>
                  <input value={nameInput} onChange={e=>setNameInput(e.target.value)}
                    onKeyDown={e=>{
                      if(e.key!=="Enter"||!nameInput.trim())return;
                      const name=nameInput.trim();
                      if(gs.lineup[side].includes(name)){setNameInput("");return;}
                      const lu=gs.lineup[side];
                      const idx=addPlayerIdx===null?lu.length:addPlayerIdx;
                      const newLineup=[...lu.slice(0,idx),name,...lu.slice(idx)];
                      const newStats={...gs.stats};
                      if(!newStats[name])newStats[name]={ab:0,h:0,r:0,rbi:0,bb:0,k:0,hbp:0,e:0,doubles:0,triples:0,hr:0,sb:0};
                      persist({...gs,lineup:{...gs.lineup,[side]:newLineup},stats:newStats});
                      setModal(null);setNameInput("");setAddPlayerIdx(null);
                    }}
                    placeholder="Player name…" style={{flex:1,padding:"9px 12px",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,color:"#fff",fontSize:14,fontFamily:"inherit"}}/>
                  <button onClick={()=>{
                    if(!nameInput.trim())return;
                    const name=nameInput.trim();
                    if(gs.lineup[side].includes(name)){setNameInput("");return;}
                    const lu=gs.lineup[side];
                    const idx=addPlayerIdx===null?lu.length:addPlayerIdx;
                    const newLineup=[...lu.slice(0,idx),name,...lu.slice(idx)];
                    const newStats={...gs.stats};
                    if(!newStats[name])newStats[name]={ab:0,h:0,r:0,rbi:0,bb:0,k:0,hbp:0,e:0,doubles:0,triples:0,hr:0,sb:0};
                    persist({...gs,lineup:{...gs.lineup,[side]:newLineup},stats:newStats});
                    setModal(null);setNameInput("");setAddPlayerIdx(null);
                  }} style={{padding:"9px 14px",background:"#16a34a",border:"none",borderRadius:8,color:"#fff",fontWeight:700,cursor:"pointer",fontSize:14}}>Add</button>
                </div>
                <select value={addPlayerIdx===null?"end":addPlayerIdx}
                  onChange={e=>setAddPlayerIdx(e.target.value==="end"?null:parseInt(e.target.value))}
                  style={{width:"100%",padding:"7px 10px",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,color:"rgba(255,255,255,0.8)",fontSize:13,fontFamily:"inherit"}}>
                  <option value="end">📍 Add to end of lineup</option>
                  {lineup.map((name,i)=>(
                    <option key={i} value={i}>📍 Insert before #{i+1} — {name}</option>
                  ))}
                </select>
              </div>
              <button onClick={()=>setModal(null)} style={{width:"100%",padding:"10px",background:"none",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:13}}>Cancel</button>
            </div>
          </div>
        );
      })()}
      {modal==="log"&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.95)",zIndex:600,display:"flex",flexDirection:"column"}}>
          <div style={{background:"#002d6e",padding:"12px 16px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            <button onClick={()=>setModal(null)} style={{padding:"6px 10px",background:"rgba(255,255,255,0.15)",border:"none",borderRadius:6,color:"#fff",fontWeight:700,cursor:"pointer"}}>← Back</button>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,color:"#FFD700",textTransform:"uppercase"}}>Play Log ({gs.plays.length})</div>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"12px 16px"}}>
            {gs.plays.length===0&&<div style={{color:"rgba(255,255,255,0.35)",textAlign:"center",padding:32}}>No plays yet.</div>}
            {[...gs.plays].reverse().map((p,i)=>(
              <div key={i} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:"9px 12px",marginBottom:7}}>
                <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:7}}>
                  <span style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontWeight:600}}>Inn {p.inning} {p.side==="top"?"▲":"▼"}</span>
                  <span style={{fontSize:14,fontWeight:700,color:"#fff"}}>{p.batter}</span>
                  <span style={{background:["1B","2B","3B","HR"].includes(p.outcome)?"rgba(0,80,200,0.4)":["K","OUT"].includes(p.outcome)?"rgba(220,38,38,0.25)":"rgba(255,255,255,0.1)",padding:"2px 8px",borderRadius:10,fontSize:12,fontWeight:700,color:["1B","2B","3B","HR"].includes(p.outcome)?"#93c5fd":"#fff"}}>{p.outcome}{p.outType?` (${p.outType})`:""}</span>
                  {p.loc&&<span style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>{p.loc}</span>}
                  {p.runs>0&&<span style={{color:"#FFD700",fontSize:12,fontWeight:700}}>+{p.runs} R</span>}
                  {p.rbis>0&&<span style={{color:"#4ade80",fontSize:12,fontWeight:700}}>{p.rbis} RBI</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {modal==="endgame"&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.95)",zIndex:600,display:"flex",flexDirection:"column"}}>
          <div style={{background:"#002d6e",padding:"12px 16px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            <button onClick={()=>setModal(null)} style={{padding:"6px 10px",background:"rgba(255,255,255,0.15)",border:"none",borderRadius:6,color:"#fff",fontWeight:700,cursor:"pointer"}}>← Back</button>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,color:"#FFD700",textTransform:"uppercase"}}>End Game</div>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"16px"}}>
            {/* Score */}
            <div style={{background:"#1c1c1c",borderRadius:12,padding:"16px",marginBottom:14,textAlign:"center"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,color:"#FFD700",textTransform:"uppercase",marginBottom:4}}>Final Score</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginBottom:12}}>Tap to correct if needed</div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14}}>
                <div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",fontWeight:700,marginBottom:6}}>{gs.away}</div>
                  <input type="number" min="0" inputMode="numeric" value={bsScore.away!==""?bsScore.away:gs.score.away}
                    onChange={e=>setBsScore(p=>({...p,away:e.target.value}))}
                    style={{width:80,padding:"8px 4px",textAlign:"center",border:"2px solid rgba(255,215,0,0.4)",borderRadius:10,
                      fontSize:48,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,color:"#fff",
                      background:"rgba(255,255,255,0.08)",display:"block",margin:"0 auto",boxSizing:"border-box"}}/>
                </div>
                <div style={{color:"rgba(255,255,255,0.25)",fontSize:20,fontWeight:700}}>–</div>
                <div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",fontWeight:700,marginBottom:6}}>{gs.home}</div>
                  <input type="number" min="0" inputMode="numeric" value={bsScore.home!==""?bsScore.home:gs.score.home}
                    onChange={e=>setBsScore(p=>({...p,home:e.target.value}))}
                    style={{width:80,padding:"8px 4px",textAlign:"center",border:"2px solid rgba(255,215,0,0.4)",borderRadius:10,
                      fontSize:48,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,color:"#fff",
                      background:"rgba(255,255,255,0.08)",display:"block",margin:"0 auto",boxSizing:"border-box"}}/>
                </div>
              </div>
            </div>
            {/* Pitching */}
            <div style={{background:"#1c1c1c",borderRadius:12,padding:"16px",marginBottom:14}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:15,color:"#FFD700",textTransform:"uppercase",marginBottom:12}}>Pitching (optional)</div>
              {bsPit.map((p,i)=>(
                <div key={i} style={{marginBottom:14,paddingBottom:14,borderBottom:i<bsPit.length-1?"1px solid rgba(255,255,255,0.07)":"none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",width:50,flexShrink:0}}>{p.team}</div>
                    <input value={p.name} onChange={e=>setBsPit(prev=>prev.map((r,j)=>j===i?{...r,name:e.target.value}:r))}
                      placeholder="Pitcher name" style={{flex:1,padding:"7px 10px",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:6,color:"#fff",fontSize:13,fontFamily:"inherit"}}/>
                    <select value={p.decision} onChange={e=>setBsPit(prev=>prev.map((r,j)=>j===i?{...r,decision:e.target.value}:r))}
                      style={{padding:"7px 6px",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:6,color:"#fff",fontSize:13,fontFamily:"inherit"}}>
                      {["ND","W","L","S"].map(d=><option key={d} value={d}>{d}</option>)}
                    </select>
                    {bsPit.filter(r=>r.team===p.team).length>1&&(
                      <button onClick={()=>setBsPit(prev=>prev.filter((_,j)=>j!==i))} style={{padding:"4px 8px",background:"rgba(220,38,38,0.15)",border:"none",borderRadius:4,color:"#f87171",fontWeight:700,cursor:"pointer"}}>✕</button>
                    )}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:6}}>
                    {[["IP","ip",true],["H","h"],["R","r"],["ER","er"],["BB","bb"],["K","k"]].map(([lbl,f,isText])=>(
                      <div key={f} style={{display:"flex",flexDirection:"column",gap:2,alignItems:"center"}}>
                        <span style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>{lbl}</span>
                        <input type={isText?"text":"number"} min="0" value={p[f]} placeholder={isText?"6.0":"0"}
                          onChange={e=>setBsPit(prev=>prev.map((r,j)=>j===i?{...r,[f]:e.target.value}:r))}
                          style={{width:"100%",padding:"5px 2px",textAlign:"center",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:4,color:"#fff",fontSize:13,fontFamily:"inherit"}}/>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{display:"flex",gap:8,marginTop:4}}>
                {[gs.away,gs.home].map(team=>(
                  <button key={team} onClick={()=>setBsPit(prev=>[...prev,{name:"",team,ip:"",h:"",r:"",er:"",bb:"",k:"",decision:"ND"}])}
                    style={{flex:1,padding:"7px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,color:"rgba(255,255,255,0.5)",fontSize:12,cursor:"pointer"}}>
                    + {team} pitcher
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{padding:"12px 16px",background:"#111",flexShrink:0,display:"flex",flexDirection:"column",gap:8}}>
            <button onClick={endGame} disabled={saving} style={{width:"100%",padding:"14px",background:"#16a34a",border:"none",borderRadius:10,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,textTransform:"uppercase",cursor:"pointer",opacity:saving?0.6:1}}>{saving?"Saving…":"✅ Mark Game Final"}</button>
            <button onClick={()=>{if(!window.confirm("Reset game?"))return;clearSaved(gs.away,gs.home,gs.date);setModal(null);setView("pick");}} style={{width:"100%",padding:"11px",background:"rgba(220,38,38,0.15)",border:"1px solid rgba(220,38,38,0.25)",borderRadius:10,color:"#f87171",fontWeight:700,fontSize:14,cursor:"pointer"}}>↺ Reset Game</button>
            <button onClick={()=>setModal(null)} style={{padding:"7px",background:"none",border:"none",color:"rgba(255,255,255,0.25)",cursor:"pointer",fontSize:12,textAlign:"center"}}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── SCHEDULE GRAPHICS PAGE ────────────────────────────────────────────── */
function GraphicsPage() {
  const [lightbox, setLightbox] = useState(null);

  const WEEKS = [
    { label: "Week 1", date: "Apr 11", src: "/week1.png" },
    { label: "Week 2", date: "Apr 18", src: "/week2.png" },
    { label: "Week 3", date: "Apr 25", src: "/week3.png" },
  ];

  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8"}}>
      <PageHero label="Schedule" title="Schedule Graphics" subtitle="Weekly schedule graphics for social media" />
      {getPageContent("graphics_intro") && <div style={{maxWidth:700,margin:"0 auto",padding:"16px clamp(12px,3vw,32px) 0"}} dangerouslySetInnerHTML={sanitizeHTML(getPageContent("graphics_intro"))} />}
      <div style={{maxWidth:700,margin:"0 auto",padding:"28px clamp(12px,3vw,32px) 60px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:18}}>
          {WEEKS.map((w,i) => (
            <div key={i} onClick={() => setLightbox(w)}
              style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,0.10)",cursor:"pointer",transition:"transform .15s, box-shadow .15s"}}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.18)"}}
              onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,0.10)"}}>
              <img src={w.src} alt={w.label} style={{width:"100%",display:"block",objectFit:"contain"}} />
              <div style={{padding:"10px 14px 12px"}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,color:"#002d6e",textTransform:"uppercase"}}>{w.label}</div>
                <div style={{fontSize:13,color:"rgba(0,0,0,0.45)",marginTop:2}}>{w.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div onClick={e => e.stopPropagation()}
            style={{maxWidth:600,width:"100%",background:"#fff",borderRadius:16,overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}>
            <img src={lightbox.src} alt={lightbox.label} style={{width:"100%",maxHeight:"75vh",objectFit:"contain",display:"block"}} />
            <div style={{padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
              <div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,color:"#002d6e",textTransform:"uppercase"}}>{lightbox.label} — {lightbox.date}</div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <a href={lightbox.src} download={`LBDC-${lightbox.label}.png`}
                  style={{background:"#002d6e",color:"#fff",borderRadius:8,padding:"9px 16px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer",textDecoration:"none",whiteSpace:"nowrap"}}>
                  ⬇ Save
                </a>
                <button onClick={() => setLightbox(null)}
                  style={{background:"#f2f4f8",color:"#555",border:"none",borderRadius:8,padding:"9px 14px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer"}}>
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── APP ────────────────────────────────────────────────────────────────── */
export default function App() {
  const [tab, setTab] = useState("home");
  const [teamDetail, setTeamDetail] = useState(null);
  const [prevTab, setPrevTab] = useState("home");
  const [activeAlert, setActiveAlert] = useState(null);
  const [activeAlertStyle, setActiveAlertStyle] = useState({});
  const [alertDismissed, setAlertDismissed] = useState(false);
  const dismissAlert = () => setAlertDismissed(true);

  // Load alert + page content from Supabase on startup
  useEffect(() => {
    // Load alert
    sbFetch("lbdc_alert?id=eq.main&select=text,style,expire_at,go_live_at")
      .then(rows => {
        if (!rows || !rows[0] || !rows[0].text) return;
        const {text, style, expire_at, go_live_at} = rows[0];
        if (go_live_at && new Date(go_live_at) > new Date()) return;
        if (expire_at && new Date(expire_at) <= new Date()) return;
        setActiveAlert(text);
        setActiveAlertStyle(style || {});
      }).catch(() => {});
    // Load page content blocks
    sbFetch("lbdc_page_content?select=id,content")
      .then(rows => {
        (rows||[]).forEach(r => { _pageContentMap[r.id] = r.content || ""; });
      }).catch(() => {});
  }, []);

  // Strip any leftover URL hash on every load so the site never opens mid-page
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const handleSetTab = (t) => { setTab(t); setTeamDetail(null); window.scrollTo(0,0); };
  const handleTeamDetail = (name) => {
    setPrevTab(tab);
    setTeamDetail(name);
    setTab("teams");
    window.scrollTo(0,0);
  };
  const handleBackFromTeam = () => {
    setTeamDetail(null);
    window.scrollTo(0,0);
  };

  return (
    <div style={{minHeight:"100vh",fontFamily:"'Barlow',sans-serif",width:"100%",maxWidth:"100%",overflowX:"hidden"}}>
      {activeAlert && !alertDismissed && ( /* shows every page load until OK clicked */
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{
            background:activeAlertStyle.bgColor||"#dc2626",
            borderRadius:16,padding:"32px 36px",maxWidth:520,width:"100%",
            textAlign:"center",
            boxShadow: activeAlertStyle.border==="glow"
              ? "0 20px 60px rgba(0,0,0,0.5), 0 0 30px 10px rgba(255,200,0,0.8)"
              : "0 20px 60px rgba(0,0,0,0.5)",
            border: activeAlertStyle.border==="none" ? "none"
              : activeAlertStyle.border==="dashed" ? "4px dashed rgba(255,255,255,0.6)"
              : activeAlertStyle.border==="glow" ? "none"
              : "4px solid rgba(0,0,0,0.2)",
            animation: activeAlertStyle.border==="glow" ? "alertGlow 1.5s ease-in-out infinite" : "none",
          }}>
            <div style={{fontSize:48,marginBottom:12,animation:activeAlertStyle.blink?"alertBlink 1s step-start infinite":"none"}}>🚨</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:28,color:activeAlertStyle.color||"#fff",textTransform:"uppercase",letterSpacing:".04em",marginBottom:16,lineHeight:1.2}}>League Alert</div>
            <div style={{fontFamily:activeAlertStyle.fontFamily||"inherit",fontSize:Number(activeAlertStyle.fontSize||16),fontWeight:Number(activeAlertStyle.fontWeight||400),fontStyle:activeAlertStyle.fontStyle||"normal",color:activeAlertStyle.color||"rgba(255,255,255,0.95)",textAlign:activeAlertStyle.textAlign||"center",lineHeight:1.6,marginBottom:28,whiteSpace:"pre-wrap",animation:activeAlertStyle.blink?"alertBlink 1s step-start infinite":"none"}}>{activeAlert}</div>
            <button type="button" onClick={dismissAlert}
              style={{padding:"14px 48px",background:"#fff",border:"none",borderRadius:10,color:"#dc2626",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,textTransform:"uppercase",cursor:"pointer",letterSpacing:".06em",boxShadow:"0 4px 12px rgba(0,0,0,0.2)"}}>
              OK, I Understand
            </button>
          </div>
        </div>
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body,#root{overflow-x:hidden;width:100%;max-width:100%;}
        body{background:#f2f4f8;color:#111;-webkit-font-smoothing:antialiased;position:relative;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes alertBlink{0%,49%{opacity:1}50%,100%{opacity:0}}
        @keyframes alertGlow{0%,100%{box-shadow:0 0 20px 6px rgba(255,200,0,0.7)}50%{box-shadow:0 0 40px 14px rgba(255,200,0,0.9)}}
        a{text-decoration:none;}
        [contenteditable]:empty:before{content:attr(data-placeholder);color:rgba(0,0,0,0.3);pointer-events:none;display:block;}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#f2f4f8}
        ::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.15);border-radius:3px}
        .nav-btn{transition:color .15s,transform .15s,box-shadow .15s,background .15s!important;}
        .nav-btn:hover{transform:translateY(-2px);box-shadow:0 4px 14px rgba(0,45,110,0.22);background:rgba(0,45,110,0.07)!important;color:#002d6e!important;}
        .standings-table{overflow-x:auto;-webkit-overflow-scrolling:touch;}
        .mobile-standings{display:none;}
        .desktop-standings{display:block;}
        .hero-img { width: 100%; max-height: 400px; object-fit: cover; object-position: center 80%; display: block; }
        @media(max-width:700px){
          .hero-img { width: 100%; max-height: 250px; object-fit: cover; object-position: center 80%; }
          .home-two-col{grid-template-columns:1fr!important;}
          .team-detail-grid{grid-template-columns:1fr!important;}
          .sidebar-standings{display:none!important;}
          .scores-grid{grid-template-columns:1fr!important;}
          .desktop-nav{display:none!important;}
          .hamburger{display:flex!important;}
          .mobile-standings{display:block!important;}
          .desktop-standings{display:none!important;}
          /* Prevent iOS zoom on focus — ALL inputs must be >= 16px */
          input, select, textarea { font-size: 16px!important; }
          /* Box score entry mobile */
          .bs-two-col{grid-template-columns:1fr!important;}
          .bs-stat-input{min-width:72px!important;}
          .bs-stat-input button{width:32px!important;height:36px!important;font-size:18px!important;}
          .bs-stat-input input{height:36px!important;width:36px!important;}
          .bs-stat-label{font-size:11px!important;}
          .bs-score-input{width:90px!important;font-size:42px!important;}
          .bs-inn-input{width:38px!important;height:36px!important;}
          .bs-order-btn{padding:5px 10px!important;font-size:13px!important;}
          /* Schedule page */
          .schedule-week-grid{grid-template-columns:1fr!important;}
          /* Upcoming cards — team name font size */
          .upcoming-team-name{font-size:16px!important;}
          /* Game preview modal roster grid */
          .preview-roster-grid{grid-template-columns:1fr!important;}
          /* Stats/leaderboard page controls */
          .stats-controls{flex-direction:column!important;}
          /* Ticker LBDC label compact on mobile */
          .ticker-lbdc-text{display:none!important;}
          .ticker-lbdc-date{font-size:10px!important;}
          .ticker-brand{display:flex!important;align-items:center;gap:4px;}
          .ticker-brand-label{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:#FFD700;}
          /* Ticker game items: stacked layout on mobile */
          .ticker-game-item{min-width:108px!important;padding:5px 8px!important;gap:2px!important;}
          .ticker-game-item .ticker-team-name{font-size:11px!important;}
          .ticker-game-item .ticker-time{font-size:9px!important;}
          .ticker-game-item div img{width:16px!important;height:16px!important;}
          .ticker-lbdc-date{font-size:9px!important;}
        }
      `}</style>
      <SaveStatusToast />
      <div style={{width:"100%",overflow:"hidden"}}><Ticker setTab={handleSetTab} /></div>
      <div style={{position:"sticky",top:0,zIndex:300,width:"100%"}}><Navbar tab={tab} setTab={handleSetTab} /></div>
      {tab==="home"      && <HomePage setTab={handleSetTab} setTeamDetail={handleTeamDetail} />}
      {tab==="scores"    && <ScoresPage setTab={handleSetTab} setTeamDetail={handleTeamDetail} />}
      {tab==="schedule"     && <SchedulePage setTab={handleSetTab} setTeamDetail={handleTeamDetail} />}
      {tab==="tournaments"  && <TournamentsPage setTab={handleSetTab} setTeamDetail={handleTeamDetail} />}
      {tab==="standings" && <StandingsPage setTab={handleSetTab} setTeamDetail={handleTeamDetail} />}
      {tab==="teams"     && !teamDetail && <TeamsPage setTab={handleSetTab} setTeamDetail={handleTeamDetail} />}
      {tab==="teams"     && teamDetail  && <TeamDetailPage teamName={teamDetail} prevTab={prevTab} onBack={handleBackFromTeam} setTab={handleSetTab} setTeamDetail={handleTeamDetail} />}
      {tab==="stats"     && <StatsPage />}
      {tab==="live"      && <LiveScorerPage />}
      {tab==="subs"      && <SubBoardPage />}
      {tab==="contact"   && <ContactPage />}
      {tab==="payments"  && <PaymentsPage />}
      {tab==="admin"     && <AdminPage onAlertChange={(txt, style) => { setActiveAlert(txt); setActiveAlertStyle(style || {}); }} />}
      {tab==="history"   && <HistoryPage />}
      {tab==="rules"     && <RulesPage />}
      {tab==="directions"&& <FieldDirectionsPage />}
      {tab==="sponsors"  && <SponsorsPage />}
      {tab==="photos"    && <PhotosPage />}
      {tab==="signup"    && <PlayerSignUpPage />}
      {tab==="graphics"   && <GraphicsPage />}
      {tab==="availability" && <PlayerAvailabilityPage setTab={handleSetTab} />}
      <Footer setTab={handleSetTab} />
    </div>
  );
}
