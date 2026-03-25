import { useState } from "react";

const L_LEAGUE = "/hero111.jpg";

const TEAM_LOGOS = {
  "Tribe":    "/tribe.png",
  "Dodgers":  "/dodgers.png",
  "Pirates":  "/pirates.png",
  "Titans":   "/titans.png",
  "Brooklyn": "/brooklyn.png",
  "Generals": "/generals.png",
  "Black Sox": "/blacksox.png",
};

const DIV = {
  SAT: {
    name: "Spring/Summer 2026", accent: "#002d6e",
    teams: [
      {seed:1,name:"Tribe",full:"Tribe",w:0,l:0,t:0,pct:"---",gp:0,rs:0,ra:0,diff:"---"},
      {seed:2,name:"Dodgers",full:"Dodgers",w:0,l:0,t:0,pct:"---",gp:0,rs:0,ra:0,diff:"---"},
      {seed:3,name:"Pirates",full:"Pirates",w:0,l:0,t:0,pct:"---",gp:0,rs:0,ra:0,diff:"---"},
      {seed:4,name:"Titans",full:"Titans",w:0,l:0,t:0,pct:"---",gp:0,rs:0,ra:0,diff:"---"},
      {seed:5,name:"Brooklyn",full:"Brooklyn",w:0,l:0,t:0,pct:"---",gp:0,rs:0,ra:0,diff:"---"},
      {seed:6,name:"Generals",full:"Generals",w:0,l:0,t:0,pct:"---",gp:0,rs:0,ra:0,diff:"---"},
      {seed:7,name:"Black Sox",full:"Black Sox",w:0,l:0,t:0,pct:"---",gp:0,rs:0,ra:0,diff:"---"},
    ]},
};

const ALL_TEAMS = Object.entries(DIV).flatMap(([dk,div]) =>
  div.teams.map(t => ({...t, divKey:dk, divName:div.name, divAccent:div.accent}))
);

const TEAM_COLORS = {
  "Tribe":"#002d6e","Dodgers":"#005a9c","Pirates":"#1d2d44","Titans":"#4a1d96",
  "Brooklyn":"#b45309","Generals":"#374151","Black Sox":"#111111",
};

const TEAM_ROSTERS = {
  "Tribe": ["Tom Cavanagh","R. Martinez","K. Flores","D. Reyes","J. Hernandez","M. Lopez","B. Garcia","S. Ortiz","P. Morales","A. Castillo","E. Ramirez"],
  "Dodgers": ["Glenn Barr","D. Chen","G. Wong","K. Park","T. Nguyen","R. Tanaka","J. Kim","A. Lee","B. Yamamoto","C. Chang"],
  "Pirates": ["Joe Sandoval","K. Williams","D. Torres","M. Rivera","J. Cruz","A. Mendez","B. Vargas","S. Rojas","P. Soto","L. Diaz"],
  "Titans": ["Mike McCann","M. Torres","R. Schmidt","D. Mueller","J. Hoffmann","K. Weber","B. Fischer","A. Wagner","C. Bauer"],
  "Brooklyn": ["Daniel Gutierrez","B. Johnson","T. Davis","K. Wilson","R. Brown","J. Thompson","M. Harris","C. Jackson"],
  "Generals": ["TBD","P. Garcia","R. Martinez","J. Santos","A. Flores","B. Reyes","C. Lopez"],
  "Black Sox": ["TBD"],
};

const SCORES = [
  {
    season:"Spring/Summer 2026",
    weeks:[
      {week:"Season opens Apr 11, 2026", games:[]},
    ]
  },
  {
    season:"Fall/Winter 2026",
    weeks:[
      {week:"Mar 14, 2026 — Championship", games:[
        {away:"Dodgers",aScore:10,home:"Tribe",hScore:5,div:"Championship",note:"Dodgers Advance To Championship Game!"},
        {away:"Generals",aScore:12,home:"Brooklyn",hScore:8,div:"Championship",note:"General Potvin Takes Out Brooklyn!"},
      ]},
      {week:"Feb 28, 2026", games:[
        {away:"Pirates",aScore:20,home:"Titans",hScore:10,div:"FW26"},
        {away:"Generals",aScore:5,home:"Titans",hScore:4,div:"FW26",note:"Generals clinch playoff berth"},
        {away:"Dodgers",aScore:13,home:"Tribe",hScore:0,div:"FW26"},
      ]},
      {week:"Feb 21, 2026", games:[
        {away:"Brooklyn",aScore:11,home:"Titans",hScore:4,div:"FW26",note:"Brooklyn Bests Titans"},
      ]},
      {week:"Feb 14, 2026", games:[
        {away:"Tribe",aScore:15,home:"Pirates",hScore:5,div:"FW26"},
        {away:"Dodgers",aScore:10,home:"Titans",hScore:4,div:"FW26"},
        {away:"Brooklyn",aScore:10,home:"Generals",hScore:6,div:"FW26",note:"Brooklyn Stages Comeback!"},
      ]},
      {week:"Feb 7, 2026", games:[
        {away:"Dodgers",aScore:9,home:"Pirates",hScore:0,div:"FW26",note:"Forfeit — Protest Upheld"},
        {away:"Brooklyn",aScore:10,home:"Tribe",hScore:9,div:"FW26",note:"Brooklyn Survives Tribal Scare!"},
      ]},
      {week:"Jan 31, 2026", games:[
        {away:"Tribe",aScore:21,home:"Titans",hScore:4,div:"FW26"},
        {away:"Dodgers",aScore:14,home:"Generals",hScore:4,div:"FW26"},
        {away:"Pirates",aScore:4,home:"Brooklyn",hScore:4,div:"FW26",note:"Tie"},
      ]},
      {week:"Jan 24, 2026", games:[
        {away:"Generals",aScore:18,home:"Pirates",hScore:6,div:"FW26",note:"Generals Cruise to Win"},
        {away:"Tribe",aScore:12,home:"Dodgers",hScore:4,div:"FW26"},
        {away:"Titans",aScore:7,home:"Brooklyn",hScore:5,div:"FW26",note:"Weinrich Holds Off Brooklyn!"},
      ]},
      {week:"Jan 10, 2026", games:[
        {away:"Tribe",aScore:16,home:"Pirates",hScore:9,div:"FW26"},
        {away:"Brooklyn",aScore:6,home:"Generals",hScore:2,div:"FW26",note:"Brooklyn Holds Off Generals"},
        {away:"Dodgers",aScore:10,home:"Titans",hScore:3,div:"FW26"},
      ]},
      {week:"Dec 20, 2025", games:[
        {away:"Tribe",aScore:11,home:"Generals",hScore:6,div:"FW26"},
        {away:"Brooklyn",aScore:7,home:"Dodgers",hScore:4,div:"FW26",note:"Brooklyn Holds Off Dodgers"},
      ]},
      {week:"Dec 13, 2025", games:[
        {away:"Titans",aScore:9,home:"Generals",hScore:0,div:"FW26"},
        {away:"Brooklyn",aScore:10,home:"Tribe",hScore:4,div:"FW26",note:"Brooklyn Holds Off Tribe"},
        {away:"Dodgers",aScore:16,home:"Pirates",hScore:1,div:"FW26"},
      ]},
      {week:"Dec 6, 2025", games:[
        {away:"Tribe",aScore:21,home:"Titans",hScore:5,div:"FW26"},
        {away:"Generals",aScore:10,home:"Dodgers",hScore:5,div:"FW26"},
        {away:"Brooklyn",aScore:11,home:"Pirates",hScore:0,div:"FW26",note:"Pirates Garner Just 2 Hits"},
      ]},
      {week:"Nov 8, 2025 — Opening Week", games:[
        {away:"Brooklyn",aScore:15,home:"Dodgers",hScore:3,div:"FW26",note:"Brooklyn Breaks Open Game Late"},
        {away:"Generals",aScore:5,home:"Tribe",hScore:4,div:"FW26",note:"Generals win a close game"},
        {away:"Titans",aScore:10,home:"Pirates",hScore:6,div:"FW26",note:"Titans start season with a W"},
      ]},
    ]
  },
  {
    season:"2025 NABA AZ World Series",
    weeks:[
      {week:"Oct 5–9, 2025 — Tempe, AZ", games:[
        {away:"Diamond Classics Titans",aScore:18,home:"Guam",hScore:0,div:"NABA",note:"Oct 5 · Tempe Diablo #2"},
        {away:"Dallas Redbirds",aScore:15,home:"Diamond Classics Titans",hScore:1,div:"NABA",note:"Oct 6 · Red Mountain #3"},
        {away:"KC Royals",aScore:18,home:"Diamond Classics Titans",hScore:8,div:"NABA",note:"Oct 7 · Tempe Diablo Stadium"},
        {away:"Diamond Classics Titans",aScore:19,home:"Serpientes",hScore:9,div:"NABA",note:"Oct 8 · Indian School Park #2"},
        {away:"Diamond Classics Titans",aScore:10,home:"Serpientes",hScore:5,div:"NABA",note:"Oct 9 · Indian School Park #3"},
      ]},
    ]
  },
];

const SCHED = [
  { label:"Apr 11", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Pirates",home:"Brooklyn"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Generals",home:"Dodgers"},
      {time:"12:00 PM",away:"Tribe",home:"Titans"},
    ]},
  ]},
  { label:"Apr 18", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Brooklyn",home:"Generals"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Dodgers",home:"Black Sox"},
      {time:"12:00 PM",away:"Tribe",home:"Pirates"},
    ]},
  ]},
  { label:"Apr 25", fields:[
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Generals",home:"Tribe"},
      {time:"12:00 PM",away:"Black Sox",home:"Titans"},
    ]},
    {name:"St Pius X — Downey", games:[
      {time:"9:00 AM",away:"Dodgers",home:"Brooklyn"},
    ]},
  ]},
  { label:"May 2", fields:[
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Titans",home:"Pirates"},
      {time:"12:00 PM",away:"Dodgers",home:"Tribe"},
    ]},
    {name:"St Pius X — Downey", games:[
      {time:"9:00 AM",away:"Brooklyn",home:"Black Sox"},
    ]},
  ]},
  { label:"May 9", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Brooklyn",home:"Tribe"},
      {time:"12:00 PM",away:"Titans",home:"Generals"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Black Sox",home:"Pirates"},
    ]},
  ]},
  { label:"May 16", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Tribe",home:"Black Sox"},
      {time:"12:00 PM",away:"Pirates",home:"Generals"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Titans",home:"Dodgers"},
    ]},
  ]},
  { label:"May 30", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Brooklyn",home:"Titans"},
      {time:"12:00 PM",away:"Black Sox",home:"Generals"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Pirates",home:"Dodgers"},
    ]},
  ]},
  { label:"Jun 6", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Dodgers",home:"Generals"},
      {time:"12:00 PM",away:"Titans",home:"Tribe"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Brooklyn",home:"Pirates"},
    ]},
  ]},
  { label:"Jun 13", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Generals",home:"Brooklyn"},
      {time:"12:00 PM",away:"Pirates",home:"Tribe"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Black Sox",home:"Dodgers"},
    ]},
  ]},
  { label:"Jun 20", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Tribe",home:"Generals"},
      {time:"12:00 PM",away:"Titans",home:"Black Sox"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Brooklyn",home:"Dodgers"},
    ]},
  ]},
  { label:"Jun 27", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Pirates",home:"Titans"},
      {time:"12:00 PM",away:"Black Sox",home:"Brooklyn"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Tribe",home:"Dodgers"},
    ]},
  ]},
  { label:"Jul 11", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Tribe",home:"Brooklyn"},
      {time:"12:00 PM",away:"Generals",home:"Titans"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Black Sox",home:"Pirates"},
    ]},
  ]},
  { label:"Jul 18", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Pirates",home:"Generals"},
      {time:"12:00 PM",away:"Dodgers",home:"Titans"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Black Sox",home:"Tribe"},
    ]},
  ]},
  { label:"Jul 25", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Black Sox",home:"Generals"},
      {time:"12:00 PM",away:"Brooklyn",home:"Titans"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Pirates",home:"Dodgers"},
    ]},
  ]},
  { label:"Aug 1", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Pirates",home:"Brooklyn"},
      {time:"12:00 PM",away:"Tribe",home:"Titans"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Generals",home:"Dodgers"},
    ]},
  ]},
  { label:"Aug 8", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Brooklyn",home:"Generals"},
      {time:"12:00 PM",away:"Dodgers",home:"Black Sox"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Tribe",home:"Pirates"},
    ]},
  ]},
  { label:"Aug 15", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Dodgers",home:"Brooklyn"},
      {time:"12:00 PM",away:"Black Sox",home:"Titans"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Generals",home:"Tribe"},
    ]},
  ]},
  { label:"Aug 22", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Brooklyn",home:"Black Sox"},
      {time:"12:00 PM",away:"Dodgers",home:"Tribe"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Titans",home:"Pirates"},
    ]},
  ]},
  { label:"Aug 29", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Titans",home:"Generals"},
      {time:"12:00 PM",away:"Brooklyn",home:"Tribe"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Black Sox",home:"Pirates"},
    ]},
  ]},
  { label:"Sep 12", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Pirates",home:"Generals"},
      {time:"12:00 PM",away:"Tribe",home:"Black Sox"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Titans",home:"Dodgers"},
    ]},
  ]},
  { label:"Sep 19", fields:[
    {name:"Clark Field — Long Beach", games:[
      {time:"9:00 AM",away:"Black Sox",home:"Generals"},
      {time:"12:00 PM",away:"Brooklyn",home:"Titans"},
    ]},
    {name:"Fromhold Field — San Pedro", games:[
      {time:"9:00 AM",away:"Pirates",home:"Dodgers"},
    ]},
  ]},
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
  {section:"St Pius X Ground Rules",icon:"🏟️",items:[
    "The home run line appears deceiving. From left field, the yellow marker is actually behind the screen — balls striking the netting is a HOME RUN.",
    "Please keep the dugout fences closed to keep more balls in play (this applies also to the softball field in center field).",
    "Restrooms are located down the left field line.",
    "Parking is off Consuelo Street (behind the church at the end of the street).",
  ]},
];

/* ─── SHARED COMPONENTS ─────────────────────────────────────────────────── */
function TLogo({ name, size=80 }) {
  const src = TEAM_LOGOS[name];
  if (src) return (
    <div style={{width:size,height:size,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <img src={src} alt={name} style={{width:size*2,height:size*2,objectFit:"contain",display:"block",flexShrink:0}} />
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
              <div style={{fontSize:11,fontWeight:700,color:"#002d6e",marginBottom:6,textTransform:"uppercase"}}>📰 Game Recap</div>
              <p style={{fontSize:13,color:"rgba(0,0,0,0.65)",lineHeight:1.6}}>{recap}</p>
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

function UpcomingCard({ away, home, time, date, field, isNext, onTeamClick }) {
  return (
    <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderTop:"3px solid #002d6e",borderLeft:isNext?"4px solid #c8102e":"1px solid rgba(0,0,0,0.09)",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
      <div style={{display:"flex",alignItems:"center",padding:"12px 14px",gap:12,flexWrap:"wrap"}}>
        <div style={{display:"flex",flexDirection:"column",gap:8,flex:"1 1 200px",minWidth:0}}>
          {isNext && <div style={{fontSize:10,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"#c8102e",marginBottom:-2}}>▶ NEXT GAME</div>}
          {[away,home].map((t,i) => (
            <div key={i} onClick={() => onTeamClick?.(t)} style={{display:"flex",alignItems:"center",gap:10,cursor:onTeamClick?"pointer":"default"}}>
              <TLogo name={t} size={60} />
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:"clamp(14px,2vw,24px)",textTransform:"uppercase",color:"#111",lineHeight:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t}</div>
            </div>
          ))}
        </div>
        <div style={{flexShrink:0,borderLeft:"1px solid rgba(0,0,0,0.08)",paddingLeft:14}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:"clamp(20px,3vw,32px)",color:"#002d6e",lineHeight:1}}>{time}</div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(12px,1.5vw,15px)",color:"rgba(0,0,0,0.55)",fontWeight:700,marginTop:3}}>{date}</div>
          <div style={{fontSize:"clamp(11px,1.2vw,13px)",color:"rgba(0,0,0,0.4)",marginTop:2,fontWeight:500}}>{field}</div>
        </div>
      </div>
    </div>
  );
}

/* ─── TICKER ─────────────────────────────────────────────────────────────── */
function Ticker({ setTab }) {
  const games = SCHED[0].fields.flatMap(f => f.games.map(g => ({...g, field:f.name})));
  return (
    <div style={{background:"#001a3e",borderBottom:"2px solid #002d6e",display:"flex",alignItems:"stretch",overflow:"hidden",width:"100%",position:"relative"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"0 12px",borderRight:"1px solid rgba(255,255,255,0.15)",flexShrink:0}}>
        <span style={{fontSize:22,lineHeight:1}}>⚾</span>
        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:13,letterSpacing:".1em",textTransform:"uppercase",color:"#FFD700"}}>LBDC</span>
      </div>
      <div style={{display:"flex",alignItems:"stretch",overflowX:"auto",overflowY:"hidden",scrollbarWidth:"none",msOverflowStyle:"none",flex:"1 1 0",minWidth:0,WebkitOverflowScrolling:"touch"}}>
        {games.map((g,i) => (
          <div key={i} style={{display:"flex",flexDirection:"column",justifyContent:"center",padding:"5px 12px",borderRight:"1px solid rgba(255,255,255,0.1)",flexShrink:0,gap:2}}>
            <div style={{fontSize:9,fontWeight:700,letterSpacing:".08em",color:"#ff6b6b",textTransform:"uppercase",whiteSpace:"nowrap"}}>{g.time}</div>
            {[g.away,g.home].map((t,j) => (
              <div key={j} style={{display:"flex",alignItems:"center",gap:5}}>
                <TLogo name={t} size={14} />
                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:12,color:"#fff",letterSpacing:".02em",whiteSpace:"nowrap"}}>{t}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",padding:"0 12px",flexShrink:0,borderLeft:"1px solid rgba(255,255,255,0.1)",cursor:"pointer"}} onClick={() => setTab("schedule")}>
        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,color:"#FFD700",whiteSpace:"nowrap"}}>Schedule »</span>
      </div>
    </div>
  );
}

/* ─── NAVBAR ─────────────────────────────────────────────────────────────── */
function Navbar({ tab, setTab }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const links = [["home","Home"],["scores","Scores"],["schedule","Schedule"],["standings","Standings"],["teams","Teams"],["subs","Sub Board"],["rules","Rules"],["admin","⚙ Admin"]];
  const handleNav = (id) => { setTab(id); setMenuOpen(false); window.scrollTo(0,0); };
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
            {links.map(([id,label]) => (
              <li key={id}>
                <button onClick={() => handleNav(id)} style={{
                  fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,
                  letterSpacing:".06em",textTransform:"uppercase",
                  color:tab===id?"#002d6e":"#555",background:"none",border:"none",
                  cursor:"pointer",padding:"7px 12px",borderRadius:6,
                  borderBottom:tab===id?"2px solid #002d6e":"2px solid transparent",
                  transition:"color .15s",whiteSpace:"nowrap",
                }}>{label}</button>
              </li>
            ))}
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
          <div style={{background:"#fff",borderBottom:"3px solid #002d6e",boxShadow:"0 8px 24px rgba(0,0,0,0.2)"}}>
          <button onClick={() => handleNav("home")} style={{
            display:"flex",alignItems:"center",gap:12,width:"100%",textAlign:"left",
            fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,
            letterSpacing:".06em",textTransform:"uppercase",
            color:"#002d6e",background:"rgba(0,45,110,0.06)",
            border:"none",borderBottom:"2px solid #002d6e",
            cursor:"pointer",padding:"18px 20px",
          }}>⚾ Home</button>
          {links.filter(([id])=>id!=="home").map(([id,label]) => (
            <button key={id} onClick={() => handleNav(id)} style={{
              display:"block",width:"100%",textAlign:"left",
              fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:22,
              letterSpacing:".06em",textTransform:"uppercase",
              color:tab===id?"#002d6e":"#111",background:tab===id?"rgba(0,45,110,0.04)":"none",
              border:"none",borderBottom:"1px solid rgba(0,0,0,0.06)",
              cursor:"pointer",padding:"18px 20px",
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
  const topTeams = [...ALL_TEAMS].sort((a,b) => parseFloat(b.pct) - parseFloat(a.pct)).slice(0,8);
  const nextGames = SCHED[0].fields.flatMap(f => f.games.map(g => ({...g,field:f.name}))).slice(0,5);
  const recent = SCORES[1].weeks[0].games;
  const goTeam = (name) => { setTeamDetail(name); setTab("teams"); window.scrollTo(0,0); };
  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",overflowX:"hidden",width:"100%"}}>
      {/* HERO */}
      <div style={{width:"100%",borderBottom:"4px solid #002d6e",lineHeight:0,overflow:"hidden"}}>
        <img src="/hero111.jpg" alt="Long Beach Diamond Classics" className="hero-img" style={{display:"block"}} />
      </div>

      <div style={{maxWidth:1400,margin:"0 auto",padding:"28px clamp(12px,3vw,40px) 60px"}}>
        <div className="home-two-col" style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:32,alignItems:"start"}}>
          <div>
            <div style={{marginBottom:32}}>
              <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:14}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:"#002d6e",marginBottom:4}}>2026 Season</div>
                  <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:34,textTransform:"uppercase",color:"#111",lineHeight:1}}>Recent Results</h2>
                </div>
                <span onClick={() => setTab("scores")} style={{color:"#002d6e",fontWeight:700,fontSize:13,cursor:"pointer"}}>All Scores →</span>
              </div>
              <div className="scores-grid" style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,gridAutoRows:"1fr"}}>
                {recent.slice(0,6).map((g,i) => <FinalCard key={i} g={g} onTeamClick={goTeam} />)}
              </div>
            </div>
            <div>
              <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:14}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:"#002d6e",marginBottom:4}}>On Deck</div>
                  <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:34,textTransform:"uppercase",color:"#111",lineHeight:1}}>Upcoming</h2>
                </div>
                <span onClick={() => setTab("schedule")} style={{color:"#002d6e",fontWeight:700,fontSize:13,cursor:"pointer"}}>Full Schedule →</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {nextGames.map((g,i) => <UpcomingCard key={i} away={g.away} home={g.home} time={g.time} date="Apr 11, 2026" onTeamClick={goTeam} field={g.field} isNext={i===0} />)}
              </div>
            </div>
          </div>

          {/* Standings sidebar */}
          <div style={{position:"sticky",top:72}} className="sidebar-standings">
            <Card style={{boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
              <div style={{padding:"14px 20px",borderBottom:"1px solid rgba(0,0,0,0.07)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,textTransform:"uppercase",color:"#111"}}>Standings</span>
                <span onClick={() => setTab("standings")} style={{color:"#002d6e",fontSize:13,fontWeight:700,cursor:"pointer"}}>Full →</span>
              </div>
              {topTeams.map((t,i) => (
                <div key={t.name+t.divKey} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:"1px solid rgba(0,0,0,0.04)",transition:"background .15s",cursor:"pointer"}}
                  onMouseEnter={e => e.currentTarget.style.background="rgba(0,45,110,0.03)"}
                  onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,color:"#002d6e",width:22,textAlign:"center",flexShrink:0}}>{i+1}</span>
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
function ScoresPage({ setTab, setTeamDetail }) {
  const [seasonIdx, setSeasonIdx] = useState(0);
  const [weekIdx, setWeekIdx] = useState(0);
  const goTeam = (name) => { setTeamDetail(name); setTab("teams"); window.scrollTo(0,0); };
  const season = SCORES[seasonIdx];
  const week = season.weeks[weekIdx];
  const handleSeasonChange = (i) => { setSeasonIdx(i); setWeekIdx(0); };
  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",overflowX:"hidden",width:"100%"}}>
      <PageHero label="Results" title="Scores">
        <TabBar items={SCORES.map(s=>s.season)} active={seasonIdx} onChange={handleSeasonChange} />
      </PageHero>
      <div style={{maxWidth:1400,margin:"0 auto",padding:"24px clamp(12px,3vw,40px) 60px"}}>
        {/* Week selector */}
        {season.weeks.length > 1 && (
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
            {season.weeks.map((w,i) => (
              <button key={i} onClick={() => setWeekIdx(i)} style={{
                padding:"6px 14px",borderRadius:20,cursor:"pointer",
                fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,
                letterSpacing:".04em",textTransform:"uppercase",
                background:weekIdx===i?"#002d6e":"#fff",
                color:weekIdx===i?"#fff":"#555",
                border:`1px solid ${weekIdx===i?"#002d6e":"rgba(0,0,0,0.15)"}`,
                transition:"all .15s",
              }}>{w.week}</button>
            ))}
          </div>
        )}
        {week.games.length === 0 ? (
          <div style={{background:"#fff",borderRadius:12,padding:"48px",textAlign:"center",border:"1px solid rgba(0,0,0,0.09)"}}>
            <div style={{fontSize:40,marginBottom:12}}>⚾</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:28,color:"#111",textTransform:"uppercase"}}>Season Opens April 11th</div>
            <div style={{fontSize:14,color:"rgba(0,0,0,0.45)",marginTop:8}}>Check back after the first games are played!</div>
          </div>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(300px,100%),1fr))",gap:12}}>
            {week.games.map((g,i) => <FinalCard key={i} g={g} onTeamClick={goTeam} />)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── SCHEDULE PAGE ───────────────────────────────────────────────────────── */
function SchedulePage({ setTab, setTeamDetail }) {
  const [wk,setWk] = useState(0);
  const week = SCHED[wk];
  const games = week.fields.flatMap(f => f.games.map(g => ({...g,field:f.name})));
  const dateStr = week.label;
  const goTeam = (name) => { setTeamDetail(name); setTab("teams"); window.scrollTo(0,0); };
  const allTeams = ["Tribe","Dodgers","Pirates","Titans","Brooklyn","Generals","Black Sox"];
  const playingTeams = new Set(games.flatMap(g => [g.away, g.home]));
  const byeTeams = allTeams.filter(t => !playingTeams.has(t));
  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",overflowX:"hidden",width:"100%"}}>
      <PageHero label="2026 Season" title="Schedule" subtitle="Away team listed first · Home team listed second">
        <TabBar items={SCHED.map(s=>s.label)} active={wk} onChange={setWk} />
      </PageHero>
      <div style={{maxWidth:1400,margin:"0 auto",padding:"24px clamp(12px,3vw,40px) 60px"}}>
        {byeTeams.length > 0 && (
          <div style={{display:"flex",alignItems:"center",gap:12,background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderLeft:"3px solid #c8102e",borderRadius:8,padding:"12px 18px",marginBottom:16}}>
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:12,letterSpacing:"1px",textTransform:"uppercase",color:"#c8102e",flexShrink:0}}>BYE WEEK</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {byeTeams.map(t => (
                <div key={t} style={{display:"flex",alignItems:"center",gap:6}}>
                  <TLogo name={t} size={40} />
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:"#111",textTransform:"uppercase"}}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {games.map((g,i) => <UpcomingCard key={i} away={g.away} home={g.home} time={g.time} date={dateStr} onTeamClick={goTeam} field={g.field} isNext={i===0} />)}
        </div>
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
  const [view, setView] = useState("current"); // "current" | "history"
  const [histIdx, setHistIdx] = useState(0);
  const div = DIV["SAT"];
  const goTeam = (name) => { if(setTeamDetail){ setTeamDetail(name); setTab("teams"); } };
  const hist = STANDINGS_HISTORY[histIdx];

  const StandingsTable = ({ teams, accent="#002d6e" }) => (<>
    <div className="mobile-standings" style={{display:"none",padding:"16px 12px"}}>
      {teams.map((t,i) => (
        <div key={t.name} onClick={() => goTeam(t.name)} style={{background:"#fff",borderRadius:10,marginBottom:8,padding:"12px 14px",display:"flex",alignItems:"center",gap:10,border:"1px solid rgba(0,0,0,0.08)",borderLeft:`3px solid ${i===0?"#002d6e":accent}`,cursor:"pointer"}}>
          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,color:i===0?"#002d6e":"rgba(0,0,0,0.25)",width:24,flexShrink:0}}>{t.seed}</span>
          <TLogo name={t.name} size={80} />
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,textTransform:"uppercase",color:"#111",lineHeight:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</div>
            <div style={{fontSize:11,color:"rgba(0,0,0,0.4)",marginTop:2}}>{t.pct} PCT · {t.gp} GP</div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:28,color:"#111",lineHeight:1}}>{t.w}-{t.l}{t.t>0?`-${t.t}`:""}</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700,color:t.diff.startsWith("+")?accent:"#dc2626"}}>{t.diff}</div>
          </div>
        </div>
      ))}
    </div>
    <div className="desktop-standings standings-table">
      <Card style={{boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
        <div style={{display:"grid",gridTemplateColumns:"50px minmax(260px,1fr) 60px 60px 60px 80px 60px 60px 60px 70px",padding:"10px 20px",background:"#f8f9fb",borderBottom:"1px solid rgba(0,0,0,0.07)"}}>
          {["#","Team","W","L","T","PCT","GP","RS","RA","DIFF"].map((h,hi) => (
            <span key={h} style={{fontSize:11,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:"rgba(0,0,0,0.3)",textAlign:hi>1?"center":"left"}}>{h}</span>
          ))}
        </div>
        {teams.map((t,i) => (
          <div key={t.name} onClick={() => goTeam(t.name)} style={{display:"grid",gridTemplateColumns:"50px minmax(260px,1fr) 60px 60px 60px 80px 60px 60px 60px 70px",padding:"14px 20px",borderBottom:"1px solid rgba(0,0,0,0.04)",alignItems:"center",transition:"background .15s",cursor:"pointer",background:i===0?"rgba(0,45,110,0.02)":"transparent"}}
            onMouseEnter={e => e.currentTarget.style.background="rgba(0,45,110,0.04)"}
            onMouseLeave={e => e.currentTarget.style.background=i===0?"rgba(0,45,110,0.02)":"transparent"}>
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:30,color:i===0?"#002d6e":"rgba(0,0,0,0.22)"}}>{t.seed}</span>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <TLogo name={t.name} size={130} />
              <div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:38,textTransform:"uppercase",color:"#111",lineHeight:1}}>{t.name}</div>
                <div style={{height:3,width:120,background:"rgba(0,0,0,0.07)",borderRadius:2,marginTop:6,overflow:"hidden"}}>
                  <div style={{height:"100%",background:i===0?"#002d6e":"rgba(0,0,0,0.18)",borderRadius:2,width:`${parseFloat(t.pct)*100}%`}} />
                </div>
              </div>
            </div>
            {[t.w,t.l,t.t,t.pct,t.gp,t.rs,t.ra].map((v,vi) => (
              <span key={vi} style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:vi===3?18:28,fontWeight:vi===0?900:vi===3?700:400,color:vi===0?"#111":vi===3?"#002d6e":"rgba(0,0,0,0.55)",textAlign:"center",display:"block"}}>{v}</span>
            ))}
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:700,textAlign:"center",display:"block",color:t.diff.startsWith("+")?"#002d6e":"#dc2626"}}>{t.diff}</span>
          </div>
        ))}
      </Card>
    </div>
  </>);

  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",overflowX:"hidden",width:"100%"}}>
      <PageHero label="Diamond Classics" title="Standings">
        <TabBar items={["Current Season","Season History"]} active={view==="current"?0:1} onChange={i => setView(i===0?"current":"history")} />
      </PageHero>

      <div style={{maxWidth:1400,margin:"0 auto",padding:"28px clamp(12px,3vw,40px) 60px"}}>
        {view==="current" && <>
          <div style={{background:"#fff3cd",border:"1px solid #ffc107",borderRadius:8,padding:"12px 18px",marginBottom:20,fontSize:14,color:"#856404"}}>
            ⚾ <strong>Season opens April 11, 2026</strong> — standings will update after each week's games.
          </div>
          <StandingsTable teams={div.teams} />
        </>}

        {view==="history" && <>
          {/* Season selector */}
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

          {/* Champion banner */}
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
    </div>
  );
}

/* ─── TEAM DETAIL PAGE ────────────────────────────────────────────────────── */
function TeamDetailPage({ teamName, onBack, setTab, setTeamDetail }) {
  const team = ALL_TEAMS.find(t => t.name === teamName);
  const roster = TEAM_ROSTERS[teamName] || [];
  if (!team) return null;
  const color = TEAM_COLORS[teamName] || "#002d6e";
  const teamGames = SCORES.flatMap(s => s.weeks.flatMap(w => w.games)).filter(g => g.away===teamName||g.home===teamName).slice(0,5);
  const upcoming = SCHED[0].fields.flatMap(f => f.games.map(g=>({...g,field:f.name}))).filter(g=>g.away===teamName||g.home===teamName);
  const goTeam = (name) => { if(setTeamDetail){ setTeamDetail(name); setTab("teams"); window.scrollTo(0,0); } };
  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",overflowX:"hidden",width:"100%"}}>
      <div style={{background:`linear-gradient(135deg, ${color}15 0%, #fff 60%)`,borderBottom:"3px solid #002d6e",padding:"32px clamp(12px,3vw,40px) 0"}}>
        <div style={{maxWidth:1400,margin:"0 auto"}}>
          <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(0,0,0,0.4)",fontSize:13,fontWeight:600,marginBottom:16,padding:0,display:"flex",alignItems:"center",gap:6}}>← All Teams</button>
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
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:44,color,lineHeight:1}}>{team.w}-{team.l}</div>
                <div style={{fontSize:12,color:"rgba(0,0,0,0.4)",marginTop:4,fontFamily:"'Barlow Condensed',sans-serif"}}>{team.pct} PCT</div>
                <div style={{fontSize:11,color:"rgba(0,0,0,0.35)",marginTop:2}}>{team.rs} RF · {team.ra} RA</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="team-detail-grid" style={{maxWidth:1400,margin:"0 auto",padding:"28px clamp(12px,3vw,40px) 60px",display:"grid",gridTemplateColumns:"1fr 300px",gap:28,alignItems:"start"}}>
        <div>
          {roster.length > 0 && (
            <div style={{marginBottom:28}}>
              <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:26,textTransform:"uppercase",color:"#111",marginBottom:14}}>Roster</h2>
              <Card>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))"}}>
                  {roster.map((player,i) => (
                    <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderBottom:"1px solid rgba(0,0,0,0.04)",borderRight:"1px solid rgba(0,0,0,0.04)"}}>
                      <div style={{width:28,height:28,borderRadius:"50%",background:`${color}18`,border:`2px solid ${color}50`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:10,color}}>{i+1}</span>
                      </div>
                      <span style={{fontSize:14,fontWeight:500,color:"#111"}}>{player}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
          {teamGames.length > 0 && (
            <div>
              <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:26,textTransform:"uppercase",color:"#111",marginBottom:14}}>Recent Results</h2>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
                {teamGames.map((g,i) => <FinalCard key={i} g={g} onTeamClick={goTeam} />)}
              </div>
            </div>
          )}
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:16,position:"sticky",top:72}}>
          <Card>
            <div style={{padding:"14px 16px",borderBottom:"1px solid rgba(0,0,0,0.07)"}}>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,textTransform:"uppercase",color:"#111"}}>Upcoming Games</span>
            </div>
            {upcoming.length===0 ? (
              <div style={{padding:"16px",fontSize:13,color:"rgba(0,0,0,0.4)"}}>No upcoming games scheduled.</div>
            ) : upcoming.map((g,i) => {
              const isHome = g.home===teamName;
              const opp = isHome ? g.away : g.home;
              return (
                <div key={i} style={{padding:"12px 16px",borderBottom:"1px solid rgba(0,0,0,0.05)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <TLogo name={opp} size={70} />
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,textTransform:"uppercase",color:"#111"}}>{isHome?"vs":"@"} {opp}</span>
                  </div>
                  <div style={{fontSize:12,color:"rgba(0,0,0,0.4)"}}>{g.time} · Mar 22 · {g.field}</div>
                </div>
              );
            })}
          </Card>
          <Card>
            <div style={{padding:"14px 16px",borderBottom:"1px solid rgba(0,0,0,0.07)"}}>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,textTransform:"uppercase",color:"#111"}}>{team.divName}</span>
            </div>
            {DIV[team.divKey].teams.map((t,i) => (
              <div key={t.name} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:"1px solid rgba(0,0,0,0.04)",background:t.name===teamName?"rgba(0,45,110,0.04)":"transparent"}}>
                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,color:i===0?"#002d6e":"rgba(0,0,0,0.25)",width:20,textAlign:"center"}}>{t.seed}</span>
                <TLogo name={t.name} size={70} />
                <span style={{flex:1,fontSize:13,fontWeight:t.name===teamName?700:500,color:t.name===teamName?color:"#111",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</span>
                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:700,color:"#111",flexShrink:0}}>{t.w}-{t.l}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ─── TEAMS PAGE ─────────────────────────────────────────────────────────── */
function TeamsPage({ setTab, setTeamDetail }) {
  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",overflowX:"hidden",width:"100%"}}>
      <PageHero label="2026 Season" title="Team Directory">
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:16,paddingBottom:2}}>
          {ALL_TEAMS.sort((a,b)=>parseFloat(b.pct)-parseFloat(a.pct)).map(t => {
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
                        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:30,color,lineHeight:1}}>{t.w}-{t.l}</div>
                        <div style={{fontSize:12,color:"rgba(0,0,0,0.4)",fontFamily:"'Barlow Condensed',sans-serif"}}>{t.pct}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:16,paddingTop:10,borderTop:"1px solid rgba(0,0,0,0.05)"}}>
                      <div style={{textAlign:"center"}}>
                        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:18,color:"#111"}}>{t.rs}</div>
                        <div style={{fontSize:10,color:"rgba(0,0,0,0.35)",textTransform:"uppercase",letterSpacing:".08em"}}>Runs For</div>
                      </div>
                      <div style={{textAlign:"center"}}>
                        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:18,color:"#111"}}>{t.ra}</div>
                        <div style={{fontSize:10,color:"rgba(0,0,0,0.35)",textTransform:"uppercase",letterSpacing:".08em"}}>Runs Against</div>
                      </div>
                      <div style={{textAlign:"center"}}>
                        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:18,color:t.diff.startsWith("+")?div.accent:t.diff==="0"?"#111":"#dc2626"}}>{t.diff}</div>
                        <div style={{fontSize:10,color:"rgba(0,0,0,0.35)",textTransform:"uppercase",letterSpacing:".08em"}}>Differential</div>
                      </div>
                      <div style={{marginLeft:"auto",display:"flex",alignItems:"center"}}>
                        <span style={{fontSize:12,fontWeight:700,color:"#002d6e",fontFamily:"'Barlow Condensed',sans-serif"}}>View Team →</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── RULES PAGE ─────────────────────────────────────────────────────────── */
function RulesPage() {
  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",overflowX:"hidden",width:"100%"}}>
      <PageHero label="Diamond Classics Baseball" title="Field Guide" subtitle="Official rules and guidelines for the 2026 season" />
      <div style={{maxWidth:900,margin:"0 auto",padding:"28px clamp(12px,3vw,40px) 60px"}}>
        <Card style={{marginBottom:24}}>
          <div style={{padding:"14px 20px",borderBottom:"1px solid rgba(0,0,0,0.07)"}}>
            <span style={{fontSize:11,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:"rgba(0,0,0,0.4)"}}>Jump To</span>
          </div>
          <div style={{padding:"14px 20px",display:"flex",flexWrap:"wrap",gap:8}}>
            {RULES_DATA.map(r => (
              <a key={r.section} href={`#rule-${r.section.replace(/\s+/g,"-").toLowerCase()}`} style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(0,45,110,0.06)",border:"1px solid rgba(0,45,110,0.15)",borderRadius:20,padding:"5px 14px",textDecoration:"none",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,color:"#002d6e",letterSpacing:".04em",transition:"all .15s"}}
                onMouseEnter={e => e.currentTarget.style.background="rgba(0,45,110,0.12)"}
                onMouseLeave={e => e.currentTarget.style.background="rgba(0,45,110,0.06)"}>
                {r.icon} {r.section}
              </a>
            ))}
          </div>
        </Card>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {RULES_DATA.map(r => (
            <Card key={r.section} style={{padding:0}} id={`rule-${r.section.replace(/\s+/g,"-").toLowerCase()}`}>
              <div style={{padding:"16px 24px",borderBottom:"1px solid rgba(0,0,0,0.07)",display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:22}}>{r.icon}</span>
                <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:24,color:"#111",textTransform:"uppercase"}}>{r.section}</h2>
              </div>
              <div style={{padding:"16px 24px"}}>
                <ol style={{listStyle:"none",display:"flex",flexDirection:"column",gap:10}}>
                  {r.items.map((item,i) => (
                    <li key={i} style={{display:"flex",gap:14}}>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:12,color:"#002d6e",minWidth:24,paddingTop:1,flexShrink:0}}>{String(i+1).padStart(2,"0")}</span>
                      <span style={{fontSize:14,color:"rgba(0,0,0,0.65)",lineHeight:1.6}}>{item}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </Card>
          ))}
        </div>
        <div style={{marginTop:20,background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:10,padding:"14px 20px",textAlign:"center",fontSize:13,color:"rgba(0,0,0,0.4)"}}>
          Questions? Contact Daniel Gutierrez, Diamond Classics Founder · Rules subject to change by league vote.
        </div>
      </div>
    </div>
  );
}

/* ─── FOOTER ─────────────────────────────────────────────────────────────── */
function Footer({ setTab }) {
  const links = [["home","Home"],["scores","Scores"],["schedule","Schedule"],["standings","Standings"],["teams","Teams"],["subs","Sub Board"],["rules","Rules"]];
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
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,color:"rgba(255,255,255,0.25)"}}>© 2026 Long Beach Diamond Classics</div>
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

/* ─── ADMIN PAGE ─────────────────────────────────────────────────────────── */
function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);
  const [alertType, setAlertType] = useState("rainout-all");
  const [alertDate, setAlertDate] = useState("Saturday, March 29");
  const [alertMsg, setAlertMsg] = useState("");
  const [activeAlert, setActiveAlert] = useState(null);

  const alertTypes = [
    {id:"rainout-all",label:"⚠️ Rainout — all games cancelled"},
    {id:"rainout-some",label:"⚠️ Rainout — select games cancelled"},
    {id:"reschedule",label:"🔄 Games rescheduled"},
    {id:"field-change",label:"🕐 Time or field change"},
    {id:"general",label:"📢 General announcement"},
  ];

  const preview = alertTypes.find(a => a.id===alertType)?.label.split("—")[1]?.trim() || "";

  if (!authed) return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <Card style={{maxWidth:380,width:"100%",padding:0}}>
        <div style={{background:"#001a3e",padding:"24px 28px",borderRadius:"12px 12px 0 0",display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:32}}>⚾</div>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,color:"#FFD700",textTransform:"uppercase"}}>LBDC Admin</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.45)"}}>League management portal</div>
          </div>
        </div>
        <div style={{padding:"28px"}}>
          <div style={{fontSize:14,color:"rgba(0,0,0,0.5)",marginBottom:16}}>Enter your admin password to continue.</div>
          <input type="password" placeholder="Password" value={pw} onChange={e => {setPw(e.target.value); setPwError(false);}} onKeyDown={e => e.key==="Enter" && (pw==="lbdc2026" ? setAuthed(true) : setPwError(true))} style={{width:"100%",padding:"10px 14px",borderRadius:8,border:`1px solid ${pwError?"#dc2626":"rgba(0,0,0,0.15)"}`,fontSize:15,marginBottom:8,background:"#f8f9fb"}} />
          {pwError && <div style={{fontSize:12,color:"#dc2626",marginBottom:8}}>Incorrect password.</div>}
          <button onClick={() => pw==="lbdc2026" ? setAuthed(true) : setPwError(true)} style={{width:"100%",padding:"11px",background:"#002d6e",border:"none",borderRadius:8,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,textTransform:"uppercase",cursor:"pointer",letterSpacing:".06em"}}>Log in</button>
          <div style={{fontSize:11,color:"rgba(0,0,0,0.3)",textAlign:"center",marginTop:12}}>Demo password: lbdc2026</div>
        </div>
      </Card>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#f2f4f8",overflowX:"hidden",width:"100%"}}>
      <div style={{background:"#001a3e",borderBottom:"3px solid #002d6e",padding:"16px clamp(12px,3vw,40px)"}}>
        <div style={{maxWidth:900,margin:"0 auto",display:"flex",alignItems:"center",gap:14}}>
          <div style={{fontSize:32}}>⚾</div>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,color:"#FFD700",textTransform:"uppercase"}}>LBDC Admin</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>Logged in as League Admin</div>
          </div>
          <button onClick={() => setAuthed(false)} style={{marginLeft:"auto",padding:"6px 14px",background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:6,color:"rgba(255,255,255,0.6)",fontSize:13,cursor:"pointer"}}>Log out</button>
        </div>
      </div>
      <div style={{maxWidth:900,margin:"0 auto",padding:"24px clamp(12px,3vw,40px) 60px",display:"flex",flexDirection:"column",gap:20}}>
        <div style={{background:activeAlert?"#fef2f2":"#f0fdf4",border:`1px solid ${activeAlert?"#fecaca":"#bbf7d0"}`,borderRadius:10,padding:"12px 18px",display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:10,height:10,borderRadius:"50%",background:activeAlert?"#dc2626":"#22c55e",flexShrink:0,boxShadow:`0 0 6px ${activeAlert?"#dc2626":"#22c55e"}`}} />
          <span style={{fontSize:14,fontWeight:600,color:activeAlert?"#991b1b":"#166534"}}>
            {activeAlert ? `Active alert: ${activeAlert}` : "No active alerts — site showing normal"}
          </span>
          {activeAlert && <button onClick={() => setActiveAlert(null)} style={{marginLeft:"auto",padding:"4px 12px",background:"none",border:"1px solid #fca5a5",borderRadius:6,color:"#dc2626",fontSize:12,cursor:"pointer"}}>Clear alert</button>}
        </div>
        <Card>
          <div style={{padding:"16px 20px",borderBottom:"1px solid rgba(0,0,0,0.07)"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,textTransform:"uppercase",color:"#111"}}>Post a league alert</div>
          </div>
          <div style={{padding:"20px",display:"flex",flexDirection:"column",gap:14}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div style={{display:"flex",flexDirection:"column",gap:5,gridColumn:"1 / -1"}}>
                <label style={{fontSize:12,color:"rgba(0,0,0,0.4)",fontWeight:600}}>Alert type</label>
                <select value={alertType} onChange={e => setAlertType(e.target.value)} style={{padding:"10px 12px",borderRadius:8,border:"1px solid rgba(0,0,0,0.15)",fontSize:14,background:"#f8f9fb"}}>
                  {alertTypes.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                <label style={{fontSize:12,color:"rgba(0,0,0,0.4)",fontWeight:600}}>Date affected</label>
                <input value={alertDate} onChange={e => setAlertDate(e.target.value)} style={{padding:"10px 12px",borderRadius:8,border:"1px solid rgba(0,0,0,0.15)",fontSize:14,background:"#f8f9fb"}} />
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                <label style={{fontSize:12,color:"rgba(0,0,0,0.4)",fontWeight:600}}>Additional message (optional)</label>
                <input placeholder="e.g. Fields are waterlogged. Makeup dates TBD." value={alertMsg} onChange={e => setAlertMsg(e.target.value)} style={{padding:"10px 12px",borderRadius:8,border:"1px solid rgba(0,0,0,0.15)",fontSize:14,background:"#f8f9fb"}} />
              </div>
            </div>
            <div style={{background:"#fff3cd",border:"1px solid #ffc107",borderRadius:8,padding:"12px 16px"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#856404",marginBottom:4,textTransform:"uppercase",letterSpacing:".08em"}}>Preview — what players see at the top of the site:</div>
              <div style={{fontSize:14,color:"#111"}}>⚠️ <strong>{alertDate} — {preview || "All games cancelled."}</strong>{alertMsg ? ` ${alertMsg}` : ""}</div>
            </div>
            <button onClick={() => setActiveAlert(`${alertDate} — ${preview}`)} style={{padding:"13px",background:"#002d6e",border:"none",borderRadius:8,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,textTransform:"uppercase",cursor:"pointer",letterSpacing:".06em"}}>Post alert to site now</button>
          </div>
        </Card>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,textTransform:"uppercase",color:"#111"}}>Quick Actions</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}}>
          {[
            {icon:"📊",title:"Update scores",desc:"Enter this week's results"},
            {icon:"📧",title:"Send weekly email",desc:"Blast scoreboard to league"},
            {icon:"📱",title:"Send text blast",desc:"Push message to all managers"},
            {icon:"📅",title:"Manage schedule",desc:"Add or edit games"},
            {icon:"🙋",title:"Availability board",desc:"View or clear listings"},
            {icon:"👥",title:"Season sub list",desc:"Manage registered subs"},
          ].map((a,i) => (
            <div key={i} style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderTop:"3px solid #002d6e",borderRadius:10,padding:"16px 18px",cursor:"pointer",transition:"box-shadow .15s"}}
              onMouseEnter={e => e.currentTarget.style.boxShadow="0 4px 16px rgba(0,45,110,0.15)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow="none"}>
              <div style={{fontSize:24,marginBottom:8}}>{a.icon}</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,color:"#111",textTransform:"uppercase"}}>{a.title}</div>
              <div style={{fontSize:12,color:"rgba(0,0,0,0.4)",marginTop:3}}>{a.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── APP ────────────────────────────────────────────────────────────────── */
export default function App() {
  const [tab, setTab] = useState("home");
  const [teamDetail, setTeamDetail] = useState(null);

  const handleSetTab = (t) => { setTab(t); setTeamDetail(null); };
  const handleTeamDetail = (name) => { setTeamDetail(name); setTab("teams"); };

  return (
    <div style={{minHeight:"100vh",fontFamily:"'Barlow',sans-serif",width:"100%",maxWidth:"100%",overflowX:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body,#root{overflow-x:hidden;width:100%;max-width:100%;}
        body{background:#f2f4f8;color:#111;-webkit-font-smoothing:antialiased;position:relative;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        a{text-decoration:none;}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#f2f4f8}
        ::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.15);border-radius:3px}
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
        }
      `}</style>
      <div style={{position:"relative",zIndex:200,overflow:"hidden",width:"100%"}}><Ticker setTab={handleSetTab} /></div>
      <div style={{position:"sticky",top:0,zIndex:300,overflow:"hidden",width:"100%"}}><Navbar tab={tab} setTab={handleSetTab} /></div>
      {tab==="home"      && <HomePage setTab={handleSetTab} setTeamDetail={handleTeamDetail} />}
      {tab==="scores"    && <ScoresPage setTab={handleSetTab} setTeamDetail={handleTeamDetail} />}
      {tab==="schedule"  && <SchedulePage setTab={handleSetTab} setTeamDetail={handleTeamDetail} />}
      {tab==="standings" && <StandingsPage setTab={handleSetTab} setTeamDetail={handleTeamDetail} />}
      {tab==="teams"     && !teamDetail && <TeamsPage setTab={handleSetTab} setTeamDetail={handleTeamDetail} />}
      {tab==="teams"     && teamDetail  && <TeamDetailPage teamName={teamDetail} onBack={() => { setTeamDetail(null); window.scrollTo(0,0); }} setTab={handleSetTab} setTeamDetail={handleTeamDetail} />}
      {tab==="subs"      && <SubBoardPage />}
      {tab==="admin"     && <AdminPage />}
      {tab==="rules"     && <RulesPage />}
      <Footer setTab={handleSetTab} />
    </div>
  );
}
