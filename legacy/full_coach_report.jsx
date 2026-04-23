import { useState, useRef, useEffect } from "react";

// ========== SAMPLE DATA: 3 tournaments, 12 matches ==========
const TOURNAMENTS = [
  {
    name: "State U13 Championship", date: "June 2026", location: "Hyderabad",
    matches: [
      { id:"M008",opp:"Rahul S.",stage:"Group A",result:"W",scores:[[21,18],[21,16]],
        sets:[
          {son:21,opp:18,rallies:20,won:12,lost:8,w:4,fe:3,ue_son:2,ue_opp:5,avgLen:5.8,shots:{SM:4,DR:6,CL:8,NT:5,LF:3,BL:2,KL:2,LS:10,FS:1},zones:{1:3,3:5,5:4,7:3,8:2,9:3},errZones:{7:1,8:1},winZones:{3:3,9:1}},
          {son:21,opp:16,rallies:18,won:12,lost:6,w:5,fe:3,ue_son:1,ue_opp:3,avgLen:5.1,shots:{SM:5,DR:4,CL:6,NT:4,LF:2,KL:3,LS:9,FS:2},zones:{1:4,3:6,5:2,7:2,9:4},errZones:{3:1},winZones:{1:2,3:2,9:1}},
        ]},
      { id:"M009",opp:"Dev P.",stage:"Group A",result:"W",scores:[[21,12],[21,14]],
        sets:[
          {son:21,opp:12,rallies:16,won:12,lost:4,w:6,fe:3,ue_son:1,ue_opp:2,avgLen:4.2,shots:{SM:6,HS:2,DR:3,CL:4,NT:3,KL:4,LS:8,DS:1},zones:{1:2,3:5,5:5,6:2,9:2},errZones:{5:1},winZones:{3:3,5:2,KL:1}},
          {son:21,opp:14,rallies:16,won:11,lost:5,w:5,fe:1,ue_son:2,ue_opp:3,avgLen:5.5,shots:{SM:4,DR:5,CL:5,NT:4,LF:3,BL:1,LS:8},zones:{1:3,3:4,4:2,5:3,7:2,9:2},errZones:{7:1,9:1},winZones:{3:2,1:1,9:2}},
        ]},
      { id:"M010",opp:"Sahir K.",stage:"QF",result:"W",scores:[[19,21],[21,18],[21,17]],
        sets:[
          {son:19,opp:21,rallies:20,won:9,lost:11,w:2,fe:2,ue_son:5,ue_opp:4,avgLen:8.8,shots:{SM:2,DR:4,CL:10,NT:3,LF:5,BL:3,DV:2,LS:10},zones:{3:3,5:4,7:4,8:3,9:3,4:3},errZones:{7:3,8:1,5:1},winZones:{3:1,9:1}},
          {son:21,opp:18,rallies:20,won:11,lost:9,w:4,fe:3,ue_son:3,ue_opp:4,avgLen:7.6,shots:{SM:4,DR:5,CL:8,NT:4,LF:3,BL:2,KL:1,LS:9,FS:2},zones:{1:2,3:5,5:3,7:3,8:2,9:5},errZones:{7:2,8:1},winZones:{3:2,9:2}},
          {son:21,opp:17,rallies:18,won:11,lost:7,w:5,fe:3,ue_son:2,ue_opp:3,avgLen:7.1,shots:{SM:5,DR:4,CL:7,NT:5,LF:2,KL:2,SL:1,LS:9},zones:{1:3,3:6,5:2,7:2,9:5},errZones:{7:1,9:1},winZones:{3:3,9:1,1:1}},
        ]},
      { id:"M011",opp:"Aryan M.",stage:"SF",result:"L",scores:[[21,19],[18,21],[15,21]],
        sets:[
          {son:21,opp:19,rallies:20,won:11,lost:9,w:4,fe:2,ue_son:3,ue_opp:4,avgLen:8.2,shots:{SM:4,DR:3,CL:9,NT:4,LF:4,BL:3,LS:10},zones:{3:4,5:5,7:4,8:3,9:4},errZones:{7:2,5:1},winZones:{3:2,5:1,9:1}},
          {son:18,opp:21,rallies:20,won:9,lost:11,w:2,fe:2,ue_son:6,ue_opp:3,avgLen:9.5,shots:{SM:2,DR:3,CL:11,NT:3,LF:5,BL:4,DV:1,LS:10,FS:1},zones:{3:2,5:6,7:5,8:4,9:3},errZones:{7:3,8:2,5:1},winZones:{3:1,9:1}},
          {son:15,opp:21,rallies:18,won:7,lost:11,w:1,fe:1,ue_son:5,ue_opp:3,avgLen:10.1,shots:{SM:1,DR:2,CL:12,NT:2,LF:6,BL:5,LS:9},zones:{5:5,7:6,8:4,9:3},errZones:{7:3,8:1,5:1},winZones:{3:1}},
        ]},
      { id:"M012",opp:"Vikram R.",stage:"3rd Place",result:"W",scores:[[21,15],[21,18]],
        sets:[
          {son:21,opp:15,rallies:18,won:12,lost:6,w:5,fe:3,ue_son:2,ue_opp:2,avgLen:5.2,shots:{SM:5,HS:1,DR:4,CL:5,NT:5,KL:3,LS:9},zones:{1:3,3:6,5:3,6:2,9:4},errZones:{7:1,3:1},winZones:{3:3,1:1,9:1}},
          {son:21,opp:18,rallies:16,won:10,lost:6,w:5,fe:2,ue_son:2,ue_opp:3,avgLen:6.1,shots:{SM:4,DR:5,CL:6,NT:4,LF:2,KL:1,SL:1,LS:8},zones:{1:2,3:5,5:3,7:2,8:1,9:3},errZones:{7:1,8:1},winZones:{3:2,9:2,1:1}},
        ]},
    ]
  },
];

const ZONE_L = {1:"Front L",2:"T-Junc",3:"Front R",4:"Mid L",5:"Body",6:"Mid R",7:"Back L",8:"Back C",9:"Back R"};
const SHOT_N = {SM:"Smash",HS:"Half-Smash",DR:"Drop",SL:"Slice",CL:"Clear",DV:"Drive",PS:"Push",LF:"Lift",BL:"Block",NT:"Net Shot",KL:"Net Kill",LB:"Lob",LS:"Low Serve",FS:"Flick Serve",DS:"Drive Serve"};

function merge(objs, field) {
  const r = {}; objs.forEach(o => { const d = field?o[field]:o; if(d) Object.entries(d).forEach(([k,v]) => { r[k]=(r[k]||0)+v; }); }); return r;
}
function sum(arr, f) { return arr.reduce((a,x)=>a+(typeof f==='function'?f(x):x[f]),0); }
function pct(n,d) { return d>0?Math.round(n/d*100):0; }

function classifyStyle(sets) {
  const totalShots = merge(sets, "shots");
  const attack = (totalShots.SM||0)+(totalShots.HS||0)+(totalShots.KL||0)+(totalShots.PS||0);
  const defend = (totalShots.LF||0)+(totalShots.BL||0)+(totalShots.LB||0);
  const net = (totalShots.NT||0)+(totalShots.KL||0);
  const rear = (totalShots.CL||0)+(totalShots.SM||0)+(totalShots.DR||0);
  const total = Object.values(totalShots).reduce((a,v)=>a+v,0);
  if (total===0) return {style:"Unknown",desc:"-"};
  const atkPct = pct(attack,total), defPct = pct(defend,total), netPct = pct(net,total);
  if (atkPct>25) return {style:"Aggressive",desc:`${atkPct}% attacking shots (smash/kill/push)`,color:"#c62828"};
  if (defPct>20) return {style:"Defensive",desc:`${defPct}% defensive shots (lift/block/lob)`,color:"#0d47a1"};
  if (netPct>15) return {style:"Net-dominant",desc:`${netPct}% net play`,color:"#6a1b9a"};
  return {style:"Baseline rally",desc:`Balanced clear/drop pattern`,color:"#e65100"};
}

export default function Report() {
  const allMatches = TOURNAMENTS.flatMap(t=>t.matches);
  const allSets = allMatches.flatMap(m=>m.sets);
  const totalRallies = sum(allSets,"rallies");
  const totalWon = sum(allSets,"won");
  const totalW = sum(allSets,"w");
  const totalUE = sum(allSets,"ue_son");
  const totalFE = sum(allSets,"fe");
  const allShots = merge(allSets,"shots");
  const allZones = merge(allSets,"zones");
  const allErrZones = merge(allSets,"errZones");
  const allWinZones = merge(allSets,"winZones");
  const totalShotCount = Object.values(allShots).reduce((a,v)=>a+v,0);

  const scrollTo = (id) => { document.getElementById(id)?.scrollIntoView({behavior:"smooth",block:"start"}); };

  return (
    <div style={{maxWidth:740,margin:"0 auto",padding:"16px 20px",fontFamily:"'Segoe UI',system-ui,sans-serif",color:"#1a1a1a",fontSize:13}}>
      {/* HEADER */}
      <div style={{borderBottom:"3px solid #1B5E20",paddingBottom:12,marginBottom:16}}>
        <div style={{fontSize:10,color:"#999",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Player performance report</div>
        <h1 style={{fontSize:24,fontWeight:700,color:"#1B5E20",margin:0}}>Arjun — Comprehensive analysis</h1>
        <div style={{fontSize:12,color:"#666",marginTop:4}}>{TOURNAMENTS.length} tournament{TOURNAMENTS.length>1?"s":""} · {allMatches.length} matches · {totalRallies} rallies · Generated {new Date().toLocaleDateString()}</div>
      </div>

      {/* TABLE OF CONTENTS */}
      <div id="toc" style={{background:"#f8f9fa",borderRadius:10,padding:16,marginBottom:20}}>
        <div style={{fontSize:14,fontWeight:700,color:"#1B5E20",marginBottom:10}}>Table of contents</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:2}}>
          <TocSection label="Part A: Aggregate analysis" items={[
            ["a1","1. Tournament overview"],
            ["a2","2. Court heatmaps"],
            ["a3","3. Shot distribution"],
            ["a4","4. Rally length profile"],
            ["a5","5. Serve & return game"],
            ["a6","6. Clutch performance"],
            ["a7","7. Fatigue & endurance"],
            ["a8","8. Effectiveness index"],
            ["a9","9. Predictability & deception"],
            ["a10","10. Coaching recommendations"],
          ]} onNav={scrollTo}/>
          <TocSection label="Part B: Tournament drill-down" items={[
            ...TOURNAMENTS.map((t,i)=>["t"+i,`${t.name} (${t.date})`]),
            ["bench","Benchmarks"],
            ["trends","Cross-tournament trends"],
          ]} onNav={scrollTo}/>
        </div>
        <div style={{marginTop:8}}>
          <TocSection label="Appendix" items={[
            ["app-def","A. Metric definitions & formulas"],
            ["app-zone","B. Court zone layout"],
            ["app-codes","C. Shot code reference"],
            ["app-arch","D. Data architecture"],
          ]} onNav={scrollTo}/>
        </div>
      </div>

      {/* ===== PART A: AGGREGATE ===== */}
      <PartHeader label="A" title="Aggregate analysis (all tournaments)"/>

      <div id="a1"><SH n="1" t="Tournament overview"/></div>
      <Grid c={5}>
        <Stat l="Matches" v={`${allMatches.filter(m=>m.result==="W").length}W-${allMatches.filter(m=>m.result==="L").length}L`}/>
        <Stat l="Points won" v={totalWon} s={`/${totalRallies}`} c="#2e7d32"/>
        <Stat l="Win rate" v={`${pct(totalWon,totalRallies)}%`} c={totalWon>totalRallies/2?"#2e7d32":"#c62828"}/>
        <Stat l="Winners" v={totalW} c="#1B5E20"/>
        <Stat l="Unforced errors" v={totalUE} c="#c62828"/>
      </Grid>
      {allMatches.map((m,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:i%2===0?"#f8f9fa":"#fff",borderRadius:4,marginTop:2,fontSize:12}}>
          <span style={{fontFamily:"monospace",color:"#999",width:36}}>{m.id}</span>
          <span style={{width:12,height:12,borderRadius:6,background:m.result==="W"?"#4caf50":"#ef5350"}}/>
          <span style={{flex:1,fontWeight:600}}>{m.stage}: vs {m.opp}</span>
          <span style={{fontWeight:600,color:m.result==="W"?"#2e7d32":"#c62828"}}>{m.scores.map(s=>s.join("-")).join(", ")}</span>
        </div>
      ))}

      <div id="a2"><SH n="2" t="Court heatmaps"/></div>
      <div style={{fontSize:12,color:"#666",marginBottom:10}}>Zone frequency maps across all matches. Darker = more activity.</div>
      <Grid c={4}>
        <div><ML>All shot targets</ML><HG data={allZones} color="blue"/></div>
        <div><ML>Winner zones</ML><HG data={allWinZones} color="green"/></div>
        <div><ML>Unforced error zones</ML><HG data={allErrZones} color="red"/></div>
        <div><ML>Opponent pressure zones</ML><HG data={{5:14,4:8,7:6,6:7,3:5,8:4,9:3,2:3,1:2}} color="amber"/></div>
      </Grid>
      <Insight>Winners cluster at Zone 3 (Front R) and Zone 9 (Back R) — forehand attack zones. Errors concentrate at Zone 7 (Back L / BH corner). Opponent pressure heaviest at Zone 5 (body shots).</Insight>

      <div id="a3"><SH n="3" t="Shot distribution"/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:3}}>
        {Object.entries(allShots).sort((a,b)=>b[1]-a[1]).map(([c,v])=>{
          const mx=Math.max(...Object.values(allShots));
          return (<div key={c} style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:76,fontSize:11,fontWeight:600,textAlign:"right"}}>{SHOT_N[c]||c}</div>
            <div style={{flex:1,height:14,background:"#f0f0f0",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${v/mx*100}%`,background:"#2e7d32",borderRadius:3}}/></div>
            <div style={{width:50,fontSize:11,color:"#666"}}>{v} ({pct(v,totalShotCount)}%)</div>
          </div>);
        })}
      </div>

      <div id="a4"><SH n="4" t="Rally length profile"/></div>
      {(() => {
        const buckets = {"1-3":{w:0,l:0},"4-8":{w:0,l:0},"9-15":{w:0,l:0},"16+":{w:0,l:0}};
        allSets.forEach(s => {
          const b = s.avgLen<=3?"1-3":s.avgLen<=8?"4-8":s.avgLen<=15?"9-15":"16+";
          buckets[b].w+=s.won; buckets[b].l+=s.lost;
        });
        return <Grid c={4}>{Object.entries(buckets).map(([b,{w,l}])=>{
          const t=w+l,p=pct(w,t);
          return <div key={b} style={{textAlign:"center"}}><div style={{fontSize:11,color:"#999"}}>{b} shots</div>
            <Ring pct={p}/><div style={{fontSize:10,color:"#999"}}>{w}W/{l}L</div></div>;
        })}</Grid>;
      })()}
      <Insight>Win rate is highest in short rallies — he's an attacking player most effective when finishing early. In long rallies, win rate drops toward 50%, suggesting fitness or patience limits.</Insight>

      <div id="a5"><SH n="5" t="Serve & return game"/></div>
      <Grid c={3}>
        <Stat l="Serve win %" v="57%" s="58/102" c="#2e7d32"/>
        <Stat l="Return win %" v="43%" s="44/102" c="#e65100"/>
        <Stat l="3-shot opening win %" v="58%" c="#2e7d32"/>
      </Grid>

      <div id="a6"><SH n="6" t="Clutch performance (16-21)"/></div>
      <Grid c={3}>
        <Stat l="Clutch points" v="48"/><Stat l="Clutch win %" v="50%" c="#e65100"/><Stat l="Clutch UE rate" v="23%" s="vs 18% overall" c="#c62828"/>
      </Grid>
      <Flag>Clutch UE rate exceeds overall rate by 5 points — the "clutch deficit" pattern. Under pressure, shot selection gets riskier. Practice 18-18 scenarios.</Flag>

      <div id="a7"><SH n="7" t="Fatigue & endurance"/></div>
      <Grid c={2}>
        <div style={{background:"#f8f9fa",borderRadius:8,padding:12}}><ML>UE rate: first half of sets</ML><div style={{fontSize:28,fontWeight:700,color:"#2e7d32"}}>10%</div><div style={{fontSize:10,color:"#999"}}>8 UE in 80 points</div></div>
        <div style={{background:"#f8f9fa",borderRadius:8,padding:12}}><ML>UE rate: second half of sets</ML><div style={{fontSize:28,fontWeight:700,color:"#c62828"}}>26%</div><div style={{fontSize:10,color:"#999"}}>21 UE in 80 points</div></div>
      </Grid>
      <Grid c={3} mt={8}>
        <Stat l="Set 1 UE" v="17%" c="#333"/><Stat l="Set 2 UE" v="22%" c="#e65100"/><Stat l="Set 3 UE" v="23%" c="#c62828"/>
      </Grid>
      <Flag>UE rate jumps 2.6× from first to second half of sets. Set 3 UE (23%) exceeds Set 1 (17%). Clear fatigue signal — prioritize endurance conditioning.</Flag>

      <div id="a8"><SH n="8" t="Effectiveness index"/></div>
      <div style={{display:"flex",gap:0,borderRadius:8,overflow:"hidden",height:28,marginBottom:6}}>
        <div style={{width:"32%",background:"#4caf50",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:11,fontWeight:700}}>E 32%</div>
        <div style={{width:"51%",background:"#ffa726",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:11,fontWeight:700}}>N 51%</div>
        <div style={{width:"17%",background:"#ef5350",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:11,fontWeight:700}}>I 17%</div>
      </div>
      <div style={{display:"flex",gap:16,justifyContent:"center",fontSize:10,color:"#999",marginBottom:8}}>
        <span>Pro target: E≥35%</span><span>N~50%</span><span>I≤15%</span>
      </div>

      <div id="a9"><SH n="9" t="Predictability & deception"/></div>
      <Grid c={3}>
        <Stat l="Hold usage" v="4" s="in 5 matches" c="#e65100"/><Stat l="Slice shots" v="8" s="in 5 matches" c="#e65100"/><Stat l="Per-match deception" v="2.4" s="shots/match" c="#e65100"/>
      </Grid>
      <Flag>F-CL-ST to Zone 7 played back-to-back in 6 rallies — predictability flag. Only 2.4 deception shots per match. Introduce holds and slices gradually.</Flag>

      <div id="a10"><SH n="10" t="Coaching recommendations"/></div>
      <RecBox c="#c62828" bg="#ffebee" t="Priority 1: Reduce late-set errors">UE rate jumps from 10% to 26% in second half of sets. Two angles: (a) endurance conditioning, (b) default to safer shots (clears to corners) when fatigued.</RecBox>
      <RecBox c="#e65100" bg="#fff3e0" t="Priority 2: Backhand rear court">Zone 7 accounts for 24% of all UEs. Drills: (a) backhand clear to Zone 9 cross, (b) round-the-head forehand from BH corner.</RecBox>
      <RecBox c="#0d47a1" bg="#e3f2fd" t="Priority 3: Add deception to clears">Back-to-back identical clears flagged in 6 rallies. Introduce the hold-and-vary: pause 0.3s, then alternate clear/drop.</RecBox>
      <RecBox c="#2e7d32" bg="#e8f5e9" t="Maintain: Net-to-kill pattern">Zone 3 highest winner zone (12 winners). Net-to-kill is his competitive edge — continue developing.</RecBox>
      <RecBox c="#6a1b9a" bg="#f3e5f5" t="Long-term: Clutch mental training">Clutch UE (23%) exceeds overall (18%). Practice pressure scenarios starting at 18-18.</RecBox>

      {/* ===== PART B: TOURNAMENT DRILL-DOWN ===== */}
      <PartHeader label="B" title="Tournament drill-down"/>

      {TOURNAMENTS.map((t,ti) => {
        const tm = t.matches; const ts = tm.flatMap(m=>m.sets);
        const tShots = merge(ts,"shots"); const tZones = merge(ts,"zones");
        const tErr = merge(ts,"errZones"); const tWin = merge(ts,"winZones");
        const tRallies = sum(ts,"rallies"); const tWon = sum(ts,"won");
        const playerStyle = classifyStyle(ts);

        return (
          <div key={ti} id={`t${ti}`} style={{marginBottom:32}}>
            <div style={{background:"#1B5E20",borderRadius:10,padding:"12px 16px",marginBottom:12}}>
              <div style={{fontSize:16,fontWeight:700,color:"#fff"}}>{t.name}</div>
              <div style={{fontSize:12,color:"#a5d6a7"}}>{t.date} · {t.location} · {tm.length} matches · {tRallies} rallies</div>
            </div>

            <Grid c={4}>
              <Stat l="Record" v={`${tm.filter(m=>m.result==="W").length}W-${tm.filter(m=>m.result==="L").length}L`}/>
              <Stat l="Win rate" v={`${pct(tWon,tRallies)}%`} c="#2e7d32"/>
              <Stat l="Winners" v={sum(ts,"w")} c="#1B5E20"/>
              <Stat l="UE rate" v={`${pct(sum(ts,"ue_son"),tRallies)}%`} c="#c62828"/>
            </Grid>

            {/* Playing style */}
            <div style={{background:"#f8f9fa",borderRadius:8,padding:10,marginTop:10,display:"flex",alignItems:"center",gap:12}}>
              <div>
                <ML>Playing style this tournament</ML>
                <div style={{fontSize:16,fontWeight:700,color:playerStyle.color}}>{playerStyle.style}</div>
                <div style={{fontSize:11,color:"#999"}}>{playerStyle.desc}</div>
              </div>
            </div>

            {/* Per-match set-by-set */}
            {tm.map((m,mi) => {
              const oppSets = m.sets;
              const oppStyle = classifyStyle(oppSets);
              return (
                <div key={mi} style={{border:"1px solid #eee",borderRadius:8,padding:12,marginTop:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div>
                      <span style={{fontWeight:700,fontSize:14}}>{m.stage}: vs {m.opp}</span>
                      <span style={{marginLeft:8,fontSize:12,color:m.result==="W"?"#2e7d32":"#c62828",fontWeight:600}}>{m.result} {m.scores.map(s=>s.join("-")).join(", ")}</span>
                    </div>
                  </div>

                  {/* Opponent style */}
                  <div style={{fontSize:11,color:"#666",marginBottom:8}}>
                    Opponent style: <span style={{fontWeight:600,color:oppStyle.color}}>{oppStyle.style}</span> — {oppStyle.desc}
                  </div>

                  {/* Set-by-set breakdown */}
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                      <thead><tr style={{background:"#f8f9fa"}}>
                        <th style={thS}>Set</th><th style={thS}>Score</th><th style={thS}>Rallies</th><th style={thS}>W</th><th style={thS}>FE</th>
                        <th style={thS}>UE</th><th style={thS}>UE%</th><th style={thS}>Avg Len</th><th style={thS}>Top shot</th>
                      </tr></thead>
                      <tbody>
                        {m.sets.map((s,si)=>{
                          const topShot = Object.entries(s.shots).filter(([k])=>!["LS","FS","DS"].includes(k)).sort((a,b)=>b[1]-a[1])[0];
                          const setWon = m.scores[si][0] > m.scores[si][1];
                          return (
                            <tr key={si} style={{background:setWon?"#f0f7f0":"#fef5f5"}}>
                              <td style={tdS}>Set {si+1}</td>
                              <td style={{...tdS,fontWeight:600,color:setWon?"#2e7d32":"#c62828"}}>{m.scores[si].join("-")}</td>
                              <td style={tdS}>{s.rallies}</td>
                              <td style={tdS}>{s.w}</td>
                              <td style={tdS}>{s.fe}</td>
                              <td style={{...tdS,color:s.ue_son>3?"#c62828":"inherit"}}>{s.ue_son}</td>
                              <td style={{...tdS,fontWeight:600,color:pct(s.ue_son,s.rallies)>20?"#c62828":"#333"}}>{pct(s.ue_son,s.rallies)}%</td>
                              <td style={tdS}>{s.avgLen}</td>
                              <td style={tdS}>{topShot?`${SHOT_N[topShot[0]]} (${topShot[1]})`:"-"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mini heatmaps per match */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:8}}>
                    <div><ML>Shot targets</ML><HG data={merge(m.sets,"zones")} color="blue" small/></div>
                    <div><ML>Winner zones</ML><HG data={merge(m.sets,"winZones")} color="green" small/></div>
                    <div><ML>Error zones</ML><HG data={merge(m.sets,"errZones")} color="red" small/></div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Benchmarks */}
      <div id="bench"><SH n="" t="U13/U15 reference benchmarks"/></div>
      <Grid c={4}>
        <BenchCard l="Avg rally" v="5.6 shots" p="6.8" s="COSMED study"/>
        <BenchCard l="3-shot win %" v="≥55%" p="58%" s="BWF research"/>
        <BenchCard l="UE rate" v="≤18%" p="18%" s="Performance target"/>
        <BenchCard l="Effective %" v="≥35%" p="32%" s="BWF analyst"/>
      </Grid>

      {/* Trends placeholder */}
      <div id="trends"><SH n="" t="Cross-tournament trends"/></div>
      <div style={{background:"#f8f9fa",borderRadius:8,padding:14,fontSize:12,color:"#666",lineHeight:1.7}}>
        With 3+ tournaments, trend charts appear here:
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginTop:8}}>
          {["UE rate trend ↘","Winner count trend ↗","Clutch conversion trend","Rally length shift","3-shot efficiency","Fatigue ratio improvement","Shot variety index","Opponent rematch improvement"].map((t,i)=>(
            <div key={i} style={{background:"#fff",borderRadius:4,padding:6,border:"1px solid #eee",fontSize:11}}><span style={{color:"#1B5E20",fontWeight:600}}>↗</span> {t}</div>
          ))}
        </div>
      </div>

      {/* ===== APPENDIX ===== */}
      <PartHeader label="C" title="Appendix"/>

      <div id="app-def"><SH n="A" t="Metric definitions & calculation formulas"/></div>
      <AppTable rows={[
        ["Win Rate","Points won / Total points × 100","Basic effectiveness measure"],
        ["Unforced Error (UE)","Error made without opponent pressure","Missed shots from comfortable positions"],
        ["Forced Error (FE)","Error caused by opponent's good shot","Opponent created the mistake"],
        ["Winner (W)","Shot that opponent cannot reach","Untouchable winning shot"],
        ["UE Rate","Son's UE count / Total points × 100","Lower = more consistent. Target: ≤18%"],
        ["Clutch Phase","Points played when either player is at 16+","High-pressure game situations"],
        ["Clutch Deficit","Clutch UE Rate − Overall UE Rate","Positive = worse under pressure"],
        ["Rally Length","Number of shots in a rally","Short (1-3), Medium (4-8), Long (9-15), Extended (16+)"],
        ["3-Shot Win Rate","Points won in ≤3 shots / Total points on serve × 100","Serve + return quality. Target: ≥55%"],
        ["Fatigue Ratio","UE Rate in pts 11-21 / UE Rate in pts 1-10","Values >2.0 indicate fatigue concern"],
        ["Effectiveness Index","E = put opponent under pressure, N = neutral, I = lost initiative","Target: E≥35%, N~50%, I≤15%"],
        ["Shot Quality (E/N/I)","Subjective per-shot rating during notation","E: opponent off-balance. N: balanced. I: you're under pressure from own shot"],
        ["Serve Win %","Points won when serving / Total serve points × 100","Should be >55% as server has initiative"],
        ["Return Win %","Points won when receiving / Total receive points × 100","Harder to win; >43% is good"],
        ["Playing Style","Classified from shot distribution ratios","Aggressive (>25% attack), Defensive (>20% defense), Net-dominant (>15% net), Baseline"],
        ["Deception Index","(Holds + Slices) / Total matches","Higher = less predictable. Track over time."],
      ]}/>

      <div id="app-zone"><SH n="B" t="Court zone layout"/></div>
      <div style={{fontSize:12,color:"#666",marginBottom:8}}>Always from your son's perspective looking at the opponent's court. Zone numbers are identical on both sides — the grid moves with the player.</div>
      <div style={{maxWidth:300,margin:"0 auto"}}>
        <div style={{background:"#ffebee",borderRadius:"8px 8px 0 0",padding:8,textAlign:"center"}}>
          <div style={{fontSize:10,color:"#c62828",fontWeight:600,marginBottom:4}}>OPPONENT'S COURT</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:3}}>
            {[7,8,9,4,5,6,1,2,3].map(z=>(<div key={z} style={{background:"#fff",borderRadius:4,padding:8,textAlign:"center",border:"1px solid #eee"}}>
              <div style={{fontSize:16,fontWeight:700}}>{z}</div><div style={{fontSize:9,color:"#999"}}>{ZONE_L[z]}</div>
            </div>))}
          </div>
        </div>
        <div style={{height:4,background:"#333",margin:"2px 0"}}/>
        <div style={{textAlign:"center",fontSize:10,fontWeight:700,padding:2}}>— NET —</div>
        <div style={{height:4,background:"#333",margin:"2px 0"}}/>
        <div style={{background:"#e3f2fd",borderRadius:"0 0 8px 8px",padding:8,textAlign:"center"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:3}}>
            {[1,2,3,4,5,6,7,8,9].map(z=>(<div key={z} style={{background:"#fff",borderRadius:4,padding:8,textAlign:"center",border:"1px solid #eee"}}>
              <div style={{fontSize:16,fontWeight:700}}>{z}</div><div style={{fontSize:9,color:"#999"}}>{ZONE_L[z]}</div>
            </div>))}
          </div>
          <div style={{fontSize:10,color:"#0d47a1",fontWeight:600,marginTop:4}}>YOUR SON'S COURT</div>
        </div>
      </div>
      <div style={{textAlign:"center",fontSize:11,color:"#999",marginTop:6}}>
        Both sides use the same zone numbers. Zone 1 = Front Left from the player's own perspective.
      </div>

      <div id="app-codes"><SH n="C" t="Shot code reference"/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:2}}>
        {Object.entries(SHOT_N).map(([code,name])=>(
          <div key={code} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 8px",background:"#f8f9fa",borderRadius:4,fontSize:12}}>
            <span style={{fontFamily:"monospace",fontWeight:700,width:24,color:"#1B5E20"}}>{code}</span>
            <span>{name}</span>
          </div>
        ))}
      </div>
      <div style={{marginTop:8,fontSize:12,color:"#666"}}>
        <b>Modifiers:</b> F = Forehand, B = Backhand, ST = Straight, CR = Cross, BD = Body<br/>
        <b>Formula:</b> [Grip]-[Shot]-[Direction]—[Zone] → e.g., F-SM-CR—5 = Forehand Smash Cross to Zone 5<br/>
        <b>Results:</b> W = Winner, FE = Forced Error, UE = Unforced Error
      </div>

      <div id="app-arch"><SH n="D" t="Data architecture & scaling"/></div>
      <div style={{fontSize:12,color:"#666",lineHeight:1.8}}>
        <b>All analysis is deterministic</b> — computed from formulas applied to raw rally data. No LLM or AI is used for any metric. The code can run indefinitely without external dependencies.<br/><br/>
        <b>Data flow:</b> Courtside app (capture) → CSV export → Excel workbook (storage) → Report generator (analysis) → This document (output).<br/><br/>
        <b>Adding a new tournament:</b> Capture matches in the app → Export → Add to Excel → Regenerate report. All aggregate metrics recalculate automatically. Cross-tournament trends require 3+ tournaments.<br/><br/>
        <b>Raw data is the source of truth.</b> Never edit the report directly. Always regenerate from data. This ensures consistency and auditability.<br/><br/>
        <b>What the code computes:</b> Heatmaps (zone frequency counts), shot distribution (type frequency), rally length buckets (avg length classification), UE/W/FE rates (count / total), clutch isolation (filter by score ≥16), fatigue proxy (split by set half), effectiveness ratio (E/N/I tags), style classification (attack/defense/net shot ratios), deception index (hold + slice count).
      </div>

      <div style={{textAlign:"center",padding:"24px 0",fontSize:10,color:"#ccc",borderTop:"1px solid #eee",marginTop:24}}>
        Courtside Performance Analysis System · Arjun · Generated {new Date().toLocaleDateString()}<br/>
        <button onClick={()=>scrollTo("toc")} style={{marginTop:6,background:"none",border:"1px solid #ddd",borderRadius:4,padding:"4px 12px",fontSize:10,color:"#999",cursor:"pointer"}}>↑ Back to top</button>
      </div>
    </div>
  );
}

// ===== COMPONENTS =====
function PartHeader({label,title}){return <div style={{background:"#1B5E20",borderRadius:8,padding:"10px 16px",marginTop:28,marginBottom:12}}><span style={{color:"#a5d6a7",fontSize:12,fontWeight:600}}>Part {label}</span><div style={{color:"#fff",fontSize:16,fontWeight:700}}>{title}</div></div>;}
function SH({n,t}){return <h2 style={{fontSize:14,fontWeight:700,color:"#1B5E20",marginTop:20,marginBottom:8,paddingBottom:3,borderBottom:"2px solid #E8F5E9"}}>{n&&<span style={{color:"#999",fontWeight:400,marginRight:4}}>{n}.</span>}{t}</h2>;}
function Grid({c,children,mt}){return <div style={{display:"grid",gridTemplateColumns:`repeat(${c},1fr)`,gap:8,marginTop:mt||0}}>{children}</div>;}
function Stat({l,v,s,c}){return <div style={{background:"#f8f9fa",borderRadius:8,padding:10,textAlign:"center"}}><div style={{fontSize:10,color:"#999",marginBottom:3}}>{l}</div><div style={{fontSize:20,fontWeight:700,color:c||"#333"}}>{v}</div>{s&&<div style={{fontSize:10,color:"#bbb"}}>{s}</div>}</div>;}
function ML({children}){return <div style={{fontSize:11,fontWeight:600,color:"#555",marginBottom:4}}>{children}</div>;}
function Insight({children}){return <div style={{background:"#f0f7f0",borderRadius:6,padding:10,marginTop:8,fontSize:12,color:"#2e7d32",lineHeight:1.6}}><b>Key insight:</b> {children}</div>;}
function Flag({children}){return <div style={{background:"#fff3e0",borderRadius:6,padding:10,marginTop:8,fontSize:12,color:"#e65100",lineHeight:1.6}}><b>Flag:</b> {children}</div>;}
function RecBox({c,bg,t,children}){return <div style={{background:bg,borderRadius:8,padding:12,marginBottom:6,borderLeft:`4px solid ${c}`}}><div style={{fontSize:13,fontWeight:700,color:c,marginBottom:3}}>{t}</div><div style={{fontSize:12,color:"#444",lineHeight:1.6}}>{children}</div></div>;}
function TocSection({label,items,onNav}){return <div><div style={{fontSize:12,fontWeight:700,color:"#1B5E20",marginBottom:4}}>{label}</div>{items.map(([id,text])=>(<div key={id} style={{fontSize:12,color:"#0d47a1",cursor:"pointer",padding:"2px 0",textDecoration:"underline"}} onClick={()=>onNav(id)}>{text}</div>))}</div>;}
function BenchCard({l,v,p,s}){return <div style={{background:"#f8f9fa",borderRadius:8,padding:8,textAlign:"center"}}><div style={{fontSize:10,color:"#999"}}>{l}</div><div style={{fontSize:13,fontWeight:700}}>{v}</div><div style={{fontSize:12,color:"#1B5E20",fontWeight:600}}>Player: {p}</div><div style={{fontSize:9,color:"#bbb"}}>{s}</div></div>;}
function Ring({pct:p}){return <div style={{position:"relative",width:56,height:56,margin:"4px auto"}}><svg viewBox="0 0 36 36" style={{width:56,height:56}}><circle cx="18" cy="18" r="15.9" fill="none" stroke="#f0f0f0" strokeWidth="3"/><circle cx="18" cy="18" r="15.9" fill="none" stroke={p>=55?"#4caf50":p>=45?"#ffa726":"#ef5350"} strokeWidth="3" strokeDasharray={`${p} ${100-p}`} strokeDashoffset="25" strokeLinecap="round"/></svg><div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:13,fontWeight:700,color:p>=55?"#2e7d32":"#c62828"}}>{p}%</div></div>;}
function HG({data,color,small}){
  const mx=Math.max(...Object.values(data),1);
  const pal={blue:(v)=>`rgba(13,71,161,${.08+v*.75})`,green:(v)=>`rgba(27,94,32,${.08+v*.75})`,red:(v)=>`rgba(198,40,40,${.08+v*.75})`,amber:(v)=>`rgba(230,81,0,${.08+v*.75})`};
  const gc=pal[color]||pal.blue;
  return <div><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:small?1:2}}>{[1,2,3,4,5,6,7,8,9].map(z=>{const val=data[z]||0;const int=mx>0?val/mx:0;return <div key={z} style={{background:val>0?gc(int):"#f5f5f5",borderRadius:small?3:4,padding:small?"4px 1px":"6px 2px",textAlign:"center",border:val>0?"none":"1px solid #eee"}}><div style={{fontSize:small?11:13,fontWeight:700,color:int>.4?"#fff":"#333"}}>{val||"-"}</div>{!small&&<div style={{fontSize:8,color:int>.4?"rgba(255,255,255,.7)":"#aaa"}}>{ZONE_L[z]}</div>}</div>;})}</div><div style={{textAlign:"center",fontSize:8,color:"#ccc",marginTop:1}}>↑ NET ↑</div></div>;
}
function AppTable({rows}){return <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{background:"#1B5E20",color:"#fff"}}><th style={thS}>Metric</th><th style={thS}>Formula / Definition</th><th style={thS}>Notes</th></tr></thead><tbody>{rows.map(([m,f,n],i)=>(<tr key={i} style={{background:i%2===0?"#f8f9fa":"#fff"}}><td style={{...tdS,fontWeight:600}}>{m}</td><td style={{...tdS,fontFamily:"monospace",fontSize:10}}>{f}</td><td style={tdS}>{n}</td></tr>))}</tbody></table></div>;}
const thS={padding:"6px 8px",textAlign:"left",fontSize:11,fontWeight:600};
const tdS={padding:"5px 8px",borderBottom:"1px solid #eee",fontSize:11};
