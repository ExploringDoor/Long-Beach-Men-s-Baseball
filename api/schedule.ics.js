// Vercel serverless function — live iCal feed for LBDC schedule
// URL: /api/schedule.ics?team=Brooklyn  (team param is optional)
//
// Cal apps re-check this URL periodically, so any schedule change made
// in the admin panel (which writes to lbdc_schedules in Supabase) will
// automatically appear on subscribers' phones within a few hours.

const SB_URL = "https://vhovzpajuyphjatjlodo.supabase.co";
const SB_KEY = "sb_publishable_btmQX9enbqeWvKPHLRVVgA_kdObTZxC";

// ── Default schedule data (mirrors App.jsx SCHED) ──────────────────────────
// This is the fallback if Supabase is unreachable. The admin panel writes
// to Supabase so live edits are always served from there.
const DEFAULT_SAT = [
  { label:"Apr 11", fields:[
    {name:"Clark Field — Long Beach", games:[{time:"9:00 AM",away:"Pirates",home:"Brooklyn"}]},
    {name:"Fromhold Field — San Pedro", games:[{time:"9:00 AM",away:"Tribe",home:"Titans"},{time:"12:00 PM",away:"Generals",home:"Black Sox",status:"PPD"}]},
  ]},
  { label:"Apr 18", fields:[
    {name:"Clark Field — Long Beach", games:[{time:"9:00 AM",away:"Brooklyn",home:"Tribe"}]},
    {name:"Fromhold Field — San Pedro", games:[{time:"9:00 AM",away:"Generals",home:"Pirates"},{time:"12:00 PM",away:"Titans",home:"Black Sox"}]},
  ]},
  { label:"Apr 25", fields:[
    {name:"Fromhold Field — San Pedro", games:[{time:"9:00 AM",away:"Pirates",home:"Tribe"},{time:"12:00 PM",away:"Black Sox",home:"Brooklyn"}]},
    {name:"St Pius X — Downey", games:[{time:"12:00 PM",away:"Generals",home:"Titans"}]},
  ]},
  { label:"May 2", fields:[
    {name:"Fromhold Field — San Pedro", games:[{time:"9:00 AM",away:"Titans",home:"Pirates"},{time:"12:00 PM",away:"Brooklyn",home:"Generals"}]},
    {name:"St Pius X — Downey", games:[{time:"9:00 AM",away:"Tribe",home:"Black Sox"}]},
  ]},
  { label:"May 9", fields:[
    {name:"Clark Field — Long Beach", games:[{time:"9:00 AM",away:"Titans",home:"Brooklyn"},{time:"12:00 PM",away:"Generals",home:"Tribe"}]},
    {name:"Fromhold Field — San Pedro", games:[{time:"9:00 AM",away:"Pirates",home:"Black Sox"}]},
  ]},
  { label:"May 16", fields:[
    {name:"Clark Field — Long Beach", games:[{time:"9:00 AM",away:"Titans",home:"Tribe"},{time:"12:00 PM",away:"Generals",home:"Black Sox"}]},
    {name:"Fromhold Field — San Pedro", games:[{time:"9:00 AM",away:"Brooklyn",home:"Pirates"}]},
  ]},
  { label:"May 30", fields:[
    {name:"Clark Field — Long Beach", games:[{time:"9:00 AM",away:"Tribe",home:"Brooklyn"},{time:"12:00 PM",away:"Black Sox",home:"Titans"}]},
    {name:"Fromhold Field — San Pedro", games:[{time:"9:00 AM",away:"Pirates",home:"Generals"}]},
  ]},
  { label:"Jun 6", fields:[
    {name:"Clark Field — Long Beach", games:[{time:"9:00 AM",away:"Titans",home:"Generals"},{time:"12:00 PM",away:"Brooklyn",home:"Black Sox"}]},
    {name:"Fromhold Field — San Pedro", games:[{time:"9:00 AM",away:"Tribe",home:"Pirates"}]},
  ]},
  { label:"Jun 13", fields:[
    {name:"Clark Field — Long Beach", games:[{time:"9:00 AM",away:"Generals",home:"Brooklyn"},{time:"12:00 PM",away:"Titans",home:"Pirates"}]},
    {name:"Fromhold Field — San Pedro", games:[{time:"9:00 AM",away:"Black Sox",home:"Tribe"}]},
  ]},
  { label:"Jun 20", fields:[
    {name:"Clark Field — Long Beach", games:[{time:"9:00 AM",away:"Brooklyn",home:"Titans"},{time:"12:00 PM",away:"Tribe",home:"Generals"}]},
    {name:"Fromhold Field — San Pedro", games:[{time:"9:00 AM",away:"Pirates",home:"Black Sox"}]},
  ]},
  { label:"Jun 27", fields:[
    {name:"Clark Field — Long Beach", games:[{time:"9:00 AM",away:"Black Sox",home:"Generals"},{time:"12:00 PM",away:"Tribe",home:"Titans"}]},
    {name:"Fromhold Field — San Pedro", games:[{time:"9:00 AM",away:"Brooklyn",home:"Pirates"}]},
  ]},
  { label:"Jul 11", fields:[
    {name:"Clark Field — Long Beach", games:[{time:"9:00 AM",away:"Brooklyn",home:"Tribe"},{time:"12:00 PM",away:"Titans",home:"Black Sox"}]},
    {name:"Fromhold Field — San Pedro", games:[{time:"9:00 AM",away:"Generals",home:"Pirates"}]},
  ]},
  { label:"Jul 18", fields:[
    {name:"Clark Field — Long Beach", games:[{time:"9:00 AM",away:"Pirates",home:"Tribe"},{time:"12:00 PM",away:"Generals",home:"Titans"}]},
    {name:"Fromhold Field — San Pedro", games:[{time:"9:00 AM",away:"Black Sox",home:"Brooklyn"}]},
  ]},
  { label:"Jul 25", fields:[
    {name:"Clark Field — Long Beach", games:[{time:"9:00 AM",away:"Tribe",home:"Black Sox"},{time:"12:00 PM",away:"Brooklyn",home:"Generals"}]},
    {name:"Fromhold Field — San Pedro", games:[{time:"9:00 AM",away:"Titans",home:"Pirates"}]},
  ]},
  { label:"Aug 1", fields:[
    {name:"Clark Field — Long Beach", games:[{time:"9:00 AM",away:"Titans",home:"Brooklyn"},{time:"12:00 PM",away:"Pirates",home:"Black Sox"}]},
    {name:"Fromhold Field — San Pedro", games:[{time:"9:00 AM",away:"Generals",home:"Tribe"}]},
  ]},
  { label:"Aug 8", fields:[
    {name:"Clark Field — Long Beach", games:[{time:"9:00 AM",away:"Generals",home:"Black Sox"}]},
  ]},
];

const DEFAULT_BOM = [
  {date:"Apr 11", time:"2:00 PM", away:"Eddie Murray Mashers '56", home:"Greg Maddux Magicians '66", field:"St Pius X — Downey"},
  {date:"Apr 25", time:"3:00 PM", away:"Greg Maddux Magicians '66", home:"Eddie Murray Mashers '56", field:"St Pius X — Downey"},
  {date:"May 9",  time:"3:00 PM", away:"Eddie Murray Mashers '56", home:"Greg Maddux Magicians '66", field:"St Pius X — Downey"},
  {date:"Jun 6",  time:"3:00 PM", away:"Greg Maddux Magicians '66", home:"Eddie Murray Mashers '56", field:"St Pius X — Downey"},
  {date:"Jun 20", time:"2:00 PM", away:"Eddie Murray Mashers '56", home:"Greg Maddux Magicians '66", field:"St Pius X — Downey"},
  {date:"Jul 11", time:"3:00 PM", away:"Greg Maddux Magicians '66", home:"Eddie Murray Mashers '56", field:"Clark Field — Long Beach"},
  {date:"Jul 25", time:"3:00 PM", away:"Eddie Murray Mashers '56", home:"Greg Maddux Magicians '66", field:"Clark Field — Long Beach"},
  {date:"Aug 8",  time:"12:00 PM",away:"Greg Maddux Magicians '66", home:"Eddie Murray Mashers '56", field:"Clark Field — Long Beach"},
  {date:"Aug 22", time:"8:00 AM", away:"Greg Maddux Magicians '66", home:"Eddie Murray Mashers '56", field:"Clark Field — Long Beach"},
];

// ── Helpers ────────────────────────────────────────────────────────────────
const MONTH_NUM = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};

// Parse "Apr 11" → { month:4, day:11 }
function parseDate(label) {
  const [mon, day] = label.trim().split(/\s+/);
  return { month: MONTH_NUM[mon] || 1, day: parseInt(day) };
}

// Parse "9:00 AM" → { h:9, m:0 }
function parseTime(str) {
  const [timePart, ampm] = str.trim().split(' ');
  let [h, m] = timePart.split(':').map(Number);
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return { h, m };
}

// Format as iCal local datetime (TZID=America/Los_Angeles)
function icsLocal(year, month, day, h, m) {
  const pad = n => String(n).padStart(2, '0');
  return `${year}${pad(month)}${pad(day)}T${pad(h)}${pad(m)}00`;
}

// Fold long lines per RFC 5545 (max 75 octets, continuation with CRLF + space)
function fold(line) {
  const MAX = 75;
  if (line.length <= MAX) return line;
  let out = '';
  while (line.length > MAX) {
    out += line.slice(0, MAX) + '\r\n ';
    line = line.slice(MAX);
  }
  return out + line;
}

// Escape special chars for iCal text values
function esc(s) {
  return (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// Build a VEVENT block
function makeEvent({ uid, dtstart, dtend, summary, location, description }) {
  const now = new Date().toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z';
  const lines = [
    'BEGIN:VEVENT',
    fold(`UID:${uid}`),
    fold(`DTSTAMP:${now}`),
    fold(`DTSTART;TZID=America/Los_Angeles:${dtstart}`),
    fold(`DTEND;TZID=America/Los_Angeles:${dtend}`),
    fold(`SUMMARY:${esc(summary)}`),
    fold(`LOCATION:${esc(location)}`),
    fold(`DESCRIPTION:${esc(description)}`),
    'END:VEVENT',
  ];
  return lines.join('\r\n');
}

// ── Convert schedule formats to flat game list ─────────────────────────────
function flattenSat(weeks) {
  const games = [];
  for (const week of weeks) {
    const { month, day } = parseDate(week.label);
    for (const field of (week.fields || [])) {
      for (const g of (field.games || [])) {
        games.push({ month, day, field: field.name, ...g });
      }
    }
  }
  return games;
}

function flattenBom(list) {
  return list.map(g => {
    const { month, day } = parseDate(g.date);
    return { month, day, field: g.field, time: g.time, away: g.away, home: g.home };
  });
}

// ── Generate full .ics content ─────────────────────────────────────────────
function buildICS(satGames, bomGames, teamFilter) {
  const YEAR = 2026;
  const events = [];

  const allGames = [
    ...satGames.map(g => ({ ...g, league: 'Diamond Classics' })),
    ...bomGames.map(g => ({ ...g, league: 'Boomers 60/70' })),
  ];

  for (const g of allGames) {
    // Team filter
    if (teamFilter && g.away !== teamFilter && g.home !== teamFilter) continue;
    // Skip postponed
    if (g.status === 'PPD') continue;

    const { h, m } = parseTime(g.time);
    const dtstart = icsLocal(YEAR, g.month, g.day, h, m);
    // Games are 3-hour blocks
    const endH = h + 3;
    const dtend = icsLocal(YEAR, g.month, g.day, endH, m);

    const summary = `⚾ ${g.away} @ ${g.home}`;
    const uid = `lbdc-${YEAR}${String(g.month).padStart(2,'0')}${String(g.day).padStart(2,'0')}-${g.away.replace(/\s+/g,'-')}-vs-${g.home.replace(/\s+/g,'-')}@lbdc.baseball`.toLowerCase();

    events.push(makeEvent({
      uid,
      dtstart,
      dtend,
      summary,
      location: g.field || '',
      description: `${g.league} · ${g.away} (away) vs ${g.home} (home)\\nLong Beach Diamond Classics Baseball`,
    }));
  }

  const calName = teamFilter
    ? `LBDC 2026 — ${teamFilter}`
    : 'Long Beach Diamond Classics 2026';

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Long Beach Diamond Classics//Schedule 2026//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    fold(`X-WR-CALNAME:${calName}`),
    'X-WR-TIMEZONE:America/Los_Angeles',
    'X-WR-CALDESC:Long Beach Men\'s 50+ Baseball — 2026 Season',
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
    // Minimal VTIMEZONE for America/Los_Angeles (PDT/PST)
    'BEGIN:VTIMEZONE',
    'TZID:America/Los_Angeles',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:-0800',
    'TZOFFSETTO:-0700',
    'TZNAME:PDT',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0700',
    'TZOFFSETTO:-0800',
    'TZNAME:PST',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

// ── Vercel handler ─────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const teamFilter = req.query?.team || null;

  // Load live schedule from Supabase (admin edits write here)
  let satSchedule = DEFAULT_SAT;
  let bomSchedule = DEFAULT_BOM;

  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/lbdc_schedules?id=in.(sat,bom)&select=id,data`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Accept: 'application/json' } }
    );
    if (r.ok) {
      const rows = await r.json();
      const sat = rows.find(x => x.id === 'sat');
      const bom = rows.find(x => x.id === 'bom');
      if (sat?.data) satSchedule = sat.data;
      if (bom?.data) bomSchedule = bom.data;
    }
  } catch (_) { /* use defaults */ }

  const satGames = flattenSat(satSchedule);
  const bomGames = flattenBom(bomSchedule);
  const ics = buildICS(satGames, bomGames, teamFilter);

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="lbdc-schedule.ics"');
  // Allow caching for 1 hour, revalidate after — calendar apps will poll this
  res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  res.status(200).send(ics);
}
