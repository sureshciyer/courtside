
import { useState, useEffect, useCallback } from "react";

const STORE_KEY = "badminton-app-v4";

const SHOT_CODES = {
  rear: [
    { code: "SM", label: "Smash", color: "#c62828" },
    { code: "HS", label: "Half-Smash", color: "#c62828" },
    { code: "DR", label: "Drop", color: "#c62828" },
    { code: "SL", label: "Slice", color: "#c62828" },
    { code: "CL", label: "Clear", color: "#c62828" },
  ],
  mid: [
    { code: "DV", label: "Drive", color: "#e65100" },
    { code: "PS", label: "Push", color: "#e65100" },
    { code: "LF", label: "Lift", color: "#e65100" },
    { code: "BL", label: "Block", color: "#e65100" },
  ],
  front: [
    { code: "NT", label: "Net", color: "#0d47a1" },
    { code: "KL", label: "Kill", color: "#0d47a1" },
    { code: "LB", label: "Lob", color: "#0d47a1" },
  ],
  serve: [
    { code: "LS", label: "Low Serve", color: "#6a1b9a" },
    { code: "FS", label: "Flick Serve", color: "#6a1b9a" },
    { code: "DS", label: "Drive Serve", color: "#6a1b9a" },
  ],
};
const GRIPS = [{ code: "F", label: "Forehand" }, { code: "B", label: "Backhand" }];
const DIRS = [{ code: "ST", label: "Straight" }, { code: "CR", label: "Cross" }, { code: "BD", label: "Body" }];
const ZONES = [
  { n: 1, l: "Front L" }, { n: 2, l: "T-Junc" }, { n: 3, l: "Front R" },
  { n: 4, l: "Mid L" }, { n: 5, l: "Body" }, { n: 6, l: "Mid R" },
  { n: 7, l: "Back L" }, { n: 8, l: "Back C" }, { n: 9, l: "Back R" },
];
const ROLES = [
  { code: "opening", label: "Opening", bg: "#e3f2fd", c: "#0d47a1" },
  { code: "neutral", label: "Neutral", bg: "#f5f5f5", c: "#78909c" },
  { code: "disruption", label: "Disruption", bg: "#fff3e0", c: "#e65100" },
  { code: "finish", label: "Finish", bg: "#ffebee", c: "#b71c1c" },
];
const roleColor = (r) => ({ opening: ["#e3f2fd", "#0d47a1"], disruption: ["#fff3e0", "#e65100"], finish: ["#ffebee", "#b71c1c"], neutral: ["#f5f5f5", "#78909c"] }[r] || ["#f5f5f5", "#78909c"]);
const initMatch = () => ({ id: "", date: new Date().toISOString().split("T")[0], tournament: "", opponent: "", sets: [{ sonScore: 0, oppScore: 0 }], currentSet: 0, rallies: [], completed: false });
const initRally = (mid, s, son, opp) => ({ matchId: mid, set: s + 1, score: `${son}-${opp}`, server: null, shots: [], result: null, pointWonBy: null, phase: son >= 16 || opp >= 16 ? "Clutch" : son <= 5 && opp <= 5 ? "Early" : "Mid" });
const emptyBuild = () => ({ grip: null, shot: null, dir: null, zone: null, role: null });

export default function App() {
  const [data, setData] = useState({ matches: [], currentMatch: null });
  const [screen, setScreen] = useState("home");
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => { try { const r = await window.storage.get(STORE_KEY); if (r?.value) setData(JSON.parse(r.value)); } catch(e){} setLoading(false); })(); }, []);
  const save = useCallback(async (d) => { setData(d); try { await window.storage.set(STORE_KEY, JSON.stringify(d)); } catch(e){} }, []);
  if (loading) return <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh" }}><p style={{ color:"#90a4ae",fontFamily:"Outfit" }}>Loading...</p></div>;
  const p = { data, save, setScreen };
  const v = { home:<Home {...p}/>, setup:<Setup {...p}/>, capture:<Capture {...p}/>, summary:<Summary {...p}/>, history:<History {...p}/>, exportScreen:<Export {...p}/> };
  return (<div style={{ maxWidth:420,margin:"0 auto",minHeight:"100vh",fontFamily:"Outfit,sans-serif" }}>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet"/>
    {v[screen]||v.home}
  </div>);
}

function Home({ data, setScreen }) {
  const n = data.matches.length, active = data.currentMatch && !data.currentMatch.completed;
  return (<Screen>
    <div style={{ textAlign:"center",padding:"2rem 0 1rem" }}><div style={{ fontSize:36 }}>🏸</div><h1 style={{ fontWeight:800,fontSize:28,color:"#1B5E20",margin:0 }}>Courtside</h1><p style={{ fontSize:14,color:"#78909c",marginTop:2 }}>Badminton match notation</p></div>
    {active && <BigBtn bg="#E8F5E9" color="#1B5E20" onClick={()=>setScreen("capture")}>Resume vs {data.currentMatch.opponent||"..."}</BigBtn>}
    <BigBtn bg="#e3f2fd" color="#0d47a1" onClick={()=>setScreen("setup")}>New match</BigBtn>
    {n>0&&<><BigBtn bg="#f3e5f5" color="#4a148c" onClick={()=>setScreen("history")}>Match history ({n})</BigBtn><BigBtn bg="#fbe9e7" color="#bf360c" onClick={()=>setScreen("exportScreen")}>Export to CSV</BigBtn></>}
    <div style={{ marginTop:"auto",textAlign:"center",padding:"1rem 0" }}><p style={{ fontSize:11,color:"#90a4ae" }}>{n} match{n!==1?"es":""} stored</p></div>
  </Screen>);
}

function Setup({ data, save, setScreen }) {
  const nextId = `M${String(data.matches.length+1).padStart(3,"0")}`;
  const [m,setM] = useState({...initMatch(),id:nextId});
  return (<Screen>
    <TopBar title="New match" onBack={()=>setScreen("home")}/>
    <Badge>{nextId}</Badge>
    <Field label="Date" value={m.date} onChange={v=>setM({...m,date:v})} type="date"/>
    <Field label="Opponent" value={m.opponent} onChange={v=>setM({...m,opponent:v})} placeholder="Name"/>
    <Field label="Tournament / Stage" value={m.tournament} onChange={v=>setM({...m,tournament:v})} placeholder="e.g. State U13 QF"/>
    <BigBtn bg="#1B5E20" color="#fff" onClick={()=>{save({...data,currentMatch:m});setScreen("capture");}} disabled={!m.opponent}>Start match</BigBtn>
  </Screen>);
}

function Capture({ data, save, setScreen }) {
  const m = data.currentMatch;
  if (!m) { setScreen("home"); return null; }
  const set = m.sets[m.currentSet]||{sonScore:0,oppScore:0};
  const [rally,setRally] = useState(initRally(m.id,m.currentSet,set.sonScore,set.oppScore));
  const [build,setBuild] = useState(emptyBuild());
  const [editIdx,setEditIdx] = useState(null);
  const [step,setStep] = useState("server");
  const [toast,setToast] = useState(null);
  const flash = (msg) => { setToast(msg); setTimeout(()=>setToast(null),1500); };
  const isEditing = editIdx !== null;

  const autoRole = (pos) => { const p = pos !== undefined ? pos : rally.shots.length; return p < 3 ? "opening" : "neutral"; };

  // NEW SHOT: auto-commit when zone is tapped (last piece)
  const commitShot = (grip,shot,dir,zone,role) => {
    const code = [grip,shot,dir].join("-");
    const r = role || autoRole();
    setRally(prev=>({...prev,shots:[...prev.shots,{code,zone,role:r,grip,shotType:shot,dir}]}));
    setBuild(emptyBuild());
  };
  const commitServe = (shotCode,zone) => {
    setRally(prev=>({...prev,shots:[...prev.shots,{code:shotCode,zone,role:"opening",grip:null,shotType:shotCode,dir:null}]}));
    setBuild(emptyBuild()); setStep("shot");
  };

  // EDIT: requires explicit Update tap
  const updateShot = () => {
    if (!build.grip||!build.shot||!build.dir||!build.zone) return;
    const code = [build.grip,build.shot,build.dir].join("-");
    const role = build.role||autoRole(editIdx);
    const s = {code,zone:build.zone,role,grip:build.grip,shotType:build.shot,dir:build.dir};
    const u = [...rally.shots]; u[editIdx]=s;
    setRally({...rally,shots:u}); setBuild(emptyBuild()); setEditIdx(null); flash("Shot updated");
  };
  const updateServe = () => {
    if (!build.shot||!build.zone) return;
    const s = {code:build.shot,zone:build.zone,role:"opening",grip:null,shotType:build.shot,dir:null};
    const u = [...rally.shots]; u[editIdx]=s;
    setRally({...rally,shots:u}); setBuild(emptyBuild()); setEditIdx(null); setStep("shot"); flash("Serve updated");
  };
  const deleteShot = (i) => { setRally({...rally,shots:rally.shots.filter((_,j)=>j!==i)}); setBuild(emptyBuild()); setEditIdx(null); flash("Shot deleted"); };
  const editShot = (i) => {
    const s = rally.shots[i];
    if (s.dir===null) { setBuild({grip:null,shot:s.shotType||s.code,dir:null,zone:s.zone,role:s.role}); setEditIdx(i); setStep("serve"); }
    else { setBuild({grip:s.grip,shot:s.shotType,dir:s.dir,zone:s.zone,role:s.role}); setEditIdx(i); setStep("shot"); }
  };
  const finishRally = (result,wonBy) => {
    const fr = {...rally,result,pointWonBy:wonBy};
    const nr = [...m.rallies,fr]; const ns = [...m.sets];
    if (wonBy==="S") ns[m.currentSet]={...set,sonScore:set.sonScore+1}; else ns[m.currentSet]={...set,oppScore:set.oppScore+1};
    save({...data,currentMatch:{...m,rallies:nr,sets:ns}});
    setRally(initRally(m.id,m.currentSet,ns[m.currentSet].sonScore,ns[m.currentSet].oppScore));
    setStep("server"); setBuild(emptyBuild()); setEditIdx(null); flash("Rally saved");
  };
  const nextSet = () => {
    const ns = [...m.sets,{sonScore:0,oppScore:0}];
    save({...data,currentMatch:{...m,sets:ns,currentSet:m.currentSet+1}});
    setRally(initRally(m.id,m.currentSet+1,0,0)); setStep("server"); setBuild(emptyBuild());
  };
  const endMatch = () => {
    save({...data,matches:[...data.matches,{...m,completed:true}],currentMatch:null}); setScreen("summary");
  };
  const phase = set.sonScore>=16||set.oppScore>=16;
  const isServe = step==="serve";
  const editDone = isServe ? (build.shot&&build.zone) : (build.grip&&build.shot&&build.dir&&build.zone);

  return (<Screen>
    {toast&&<div style={{position:"fixed",top:12,left:"50%",transform:"translateX(-50%)",zIndex:99,background:"#1B5E20",color:"#fff",padding:"8px 20px",borderRadius:20,fontSize:13,fontWeight:600,animation:"fadeIn 0.2s ease"}}>{toast}</div>}
    <style>{`@keyframes fadeIn{from{opacity:0;transform:translateX(-50%) translateY(-8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>

    {/* Scoreboard */}
    <div style={{background:"#1B5E20",borderRadius:14,padding:"10px 16px",marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <span style={{fontSize:11,color:"#a5d6a7",fontWeight:600}}>{m.id} · Set {m.currentSet+1}</span>
        {phase&&<span style={{fontSize:10,background:"#ef5350",color:"#fff",padding:"2px 8px",borderRadius:10,fontWeight:700}}>CLUTCH</span>}
        <span style={{fontSize:11,color:"#a5d6a7"}}>R{m.rallies.filter(r=>r.set===m.currentSet+1).length+1}</span>
      </div>
      <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:12}}>
        <ScoreSide label="SON" score={set.sonScore}
          onInc={()=>{const ns=[...m.sets];ns[m.currentSet]={...set,sonScore:set.sonScore+1};save({...data,currentMatch:{...m,sets:ns}});}}
          onDec={()=>{if(set.sonScore<=0)return;const ns=[...m.sets];ns[m.currentSet]={...set,sonScore:set.sonScore-1};save({...data,currentMatch:{...m,sets:ns}});}}/>
        <span style={{fontSize:20,color:"#4caf50"}}>:</span>
        <ScoreSide label="OPP" score={set.oppScore}
          onInc={()=>{const ns=[...m.sets];ns[m.currentSet]={...set,oppScore:set.oppScore+1};save({...data,currentMatch:{...m,sets:ns}});}}
          onDec={()=>{if(set.oppScore<=0)return;const ns=[...m.sets];ns[m.currentSet]={...set,oppScore:set.oppScore-1};save({...data,currentMatch:{...m,sets:ns}});}}/>
      </div>
    </div>

    {/* Rally timeline — tap any shot to edit/delete */}
    {rally.shots.length>0&&(
      <div style={{background:"#fafafa",borderRadius:10,padding:"8px 10px",marginBottom:8,border:"1px solid #eee"}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:4,alignItems:"center"}}>
          {rally.shots.map((s,i)=>{
            const [bg,fg]=roleColor(s.role); const ed=editIdx===i;
            return (<span key={i} style={{display:"inline-flex",alignItems:"center",gap:2}}>
              <button onClick={()=>editShot(i)} style={{padding:"3px 8px",borderRadius:6,border:ed?`2px solid ${fg}`:"1px solid transparent",background:bg,color:fg,fontFamily:"JetBrains Mono",fontSize:11,fontWeight:600,cursor:"pointer",outline:"none"}}>{s.code}{s.zone?`—${s.zone}`:""}</button>
              {i<rally.shots.length-1&&<span style={{color:"#ccc",fontSize:10}}>→</span>}
            </span>);
          })}
        </div>
        <div style={{fontSize:10,color:"#90a4ae",marginTop:4}}>Tap a shot to edit or delete</div>
      </div>
    )}

    {/* EDIT MODE: builder bar with chips + Update button — only when editing */}
    {isEditing&&(
      <div style={{background:"#fff",border:"1.5px solid #e0e0e0",borderRadius:12,padding:"10px 12px",marginBottom:10,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:12,fontWeight:700,color:"#37474f"}}>Editing shot {editIdx+1}</span>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>deleteShot(editIdx)} style={{padding:"4px 10px",borderRadius:6,border:"1px solid #ef9a9a",background:"#ffebee",color:"#c62828",fontSize:11,fontWeight:600,cursor:"pointer"}}>Delete</button>
            <button onClick={()=>{setBuild(emptyBuild());setEditIdx(null);}} style={{padding:"4px 10px",borderRadius:6,border:"1px solid #e0e0e0",background:"#f5f5f5",color:"#78909c",fontSize:11,fontWeight:600,cursor:"pointer"}}>Cancel</button>
          </div>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
          {!isServe&&<Chip label={build.grip?(build.grip==="F"?"FH":"BH"):"Grip?"} filled={!!build.grip} color="#37474f" onClick={()=>setBuild({...build,grip:null,shot:null,dir:null,zone:null})}/>}
          <Chip label={build.shot||(isServe?"Serve?":"Shot?")} filled={!!build.shot} color="#6a1b9a" onClick={()=>isServe?setBuild({...build,shot:null,zone:null}):setBuild({...build,shot:null,dir:null,zone:null})}/>
          {!isServe&&<Chip label={build.dir?{ST:"Straight",CR:"Cross",BD:"Body"}[build.dir]:"Dir?"} filled={!!build.dir} color="#e65100" onClick={()=>setBuild({...build,dir:null,zone:null})}/>}
          <Chip label={build.zone?`Zone ${build.zone}`:"Zone?"} filled={!!build.zone} color="#0d47a1" onClick={()=>setBuild({...build,zone:null})}/>
        </div>
        {!isServe&&editIdx>=3&&(
          <div style={{display:"flex",gap:4,marginBottom:10}}>
            {ROLES.map(r=>(<button key={r.code} onClick={()=>setBuild({...build,role:r.code})} style={{flex:1,padding:"5px 2px",borderRadius:6,fontSize:10,fontWeight:600,cursor:"pointer",border:(build.role||autoRole(editIdx))===r.code?`2px solid ${r.c}`:"1px solid #e0e0e0",background:(build.role||autoRole(editIdx))===r.code?r.bg:"#fff",color:r.c}}>{r.label}</button>))}
          </div>
        )}
        <button onClick={isServe?updateServe:updateShot} disabled={!editDone} style={{width:"100%",padding:12,borderRadius:10,border:"none",background:editDone?"#1B5E20":"#e0e0e0",color:editDone?"#fff":"#9e9e9e",fontWeight:700,fontSize:14,cursor:editDone?"pointer":"default"}}>Update shot</button>
      </div>
    )}

    {/* === NEW SHOT FLOW: tap-tap-tap-done, no confirm === */}

    {step==="server"&&(<div>
      <SLabel>Who's serving?</SLabel>
      <div style={{display:"flex",gap:8}}>
        <TapBtn flex label="Son serves" color="#1B5E20" onClick={()=>{setRally({...rally,server:"S"});setStep("serve");}}/>
        <TapBtn flex label="Opponent serves" color="#546e7a" onClick={()=>{setRally({...rally,server:"O"});setStep("serve");}}/>
      </div>
    </div>)}

    {/* Serve: type → zone auto-commits (new) or fills build (edit) */}
    {step==="serve"&&!build.shot&&(<div>
      <SLabel>Serve type</SLabel>
      <div style={{display:"flex",gap:8}}>
        {SHOT_CODES.serve.map(s=>(<TapBtn key={s.code} flex label={s.label} sub={s.code} color={s.color} onClick={()=>setBuild({...build,shot:s.code})}/>))}
      </div>
    </div>)}

    {step==="serve"&&build.shot&&!build.zone&&(<div>
      <SLabel>Where did it land?</SLabel>
      <CourtGrid onTap={(z)=>isEditing?setBuild({...build,zone:z}):commitServe(build.shot,z)} active={isEditing?build.zone:null}/>
    </div>)}

    {/* Shot: grip → type → dir → zone auto-commits (new) or fills build (edit) */}
    {step==="shot"&&!isEditing&&!build.grip&&(<div>
      <SLabel>{rally.shots.length<3?`Shot ${rally.shots.length+1} of opening`:"Next shot"}</SLabel>
      {rally.shots.length>=3&&(
        <div style={{display:"flex",gap:4,marginBottom:10}}>
          {ROLES.map(r=>(<button key={r.code} onClick={()=>setBuild({...build,role:r.code})} style={{flex:1,padding:"5px 2px",borderRadius:6,fontSize:10,fontWeight:600,cursor:"pointer",border:(build.role||"neutral")===r.code?`2px solid ${r.c}`:"1px solid #e0e0e0",background:(build.role||"neutral")===r.code?r.bg:"#fff",color:r.c}}>{r.label}</button>))}
        </div>
      )}
      <div style={{display:"flex",gap:8}}>
        {GRIPS.map(g=>(<TapBtn key={g.code} flex label={g.label} sub={g.code} color="#37474f" onClick={()=>setBuild({...build,grip:g.code})}/>))}
      </div>
    </div>)}

    {step==="shot"&&!build.shot&&build.grip&&(<div>
      <SLabel>Shot type</SLabel>
      {Object.entries({"Rear court":SHOT_CODES.rear,"Mid court":SHOT_CODES.mid,"Front court":SHOT_CODES.front}).map(([g,shots])=>(
        <div key={g}><div style={{fontSize:10,color:"#90a4ae",marginBottom:4,marginTop:6}}>{g}</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{shots.map(s=>(<TapBtn key={s.code} label={s.label} sub={s.code} color={s.color} onClick={()=>setBuild({...build,shot:s.code})}/>))}</div></div>
      ))}
    </div>)}

    {step==="shot"&&build.grip&&build.shot&&!build.dir&&(<div>
      <SLabel>Direction</SLabel>
      <div style={{display:"flex",gap:8}}>
        {DIRS.map(d=>(<TapBtn key={d.code} flex label={d.label} sub={d.code} color="#546e7a" onClick={()=>setBuild({...build,dir:d.code})}/>))}
      </div>
    </div>)}

    {step==="shot"&&build.grip&&build.shot&&build.dir&&!build.zone&&(<div>
      <SLabel>Landing zone</SLabel>
      <CourtGrid onTap={(z)=>isEditing?setBuild({...build,zone:z}):commitShot(build.grip,build.shot,build.dir,z,build.role)} active={isEditing?build.zone:null}/>
    </div>)}

    {/* Edit mode: grip picker if cleared */}
    {step==="shot"&&isEditing&&!build.grip&&(<div>
      <SLabel>Grip</SLabel>
      <div style={{display:"flex",gap:8}}>
        {GRIPS.map(g=>(<TapBtn key={g.code} flex label={g.label} sub={g.code} color="#37474f" onClick={()=>setBuild({...build,grip:g.code})}/>))}
      </div>
    </div>)}

    {/* Result */}
    {step==="result"&&(<div>
      <SLabel>How did the rally end?</SLabel>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
        <TapBtn label="Winner" sub="W" color="#2e7d32" onClick={()=>setRally({...rally,result:"W"})} active={rally.result==="W"}/>
        <TapBtn label="Forced Err" sub="FE" color="#e65100" onClick={()=>setRally({...rally,result:"FE"})} active={rally.result==="FE"}/>
        <TapBtn label="Unforced Err" sub="UE" color="#c62828" onClick={()=>setRally({...rally,result:"UE"})} active={rally.result==="UE"}/>
      </div>
      <SLabel>Point won by?</SLabel>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <TapBtn flex label="Son" color="#1B5E20" onClick={()=>finishRally(rally.result||"W","S")}/>
        <TapBtn flex label="Opponent" color="#546e7a" onClick={()=>finishRally(rally.result||"UE","O")}/>
      </div>
      <button onClick={()=>{setStep("shot");setRally({...rally,result:null});}} style={{width:"100%",padding:10,borderRadius:8,border:"1px solid #e0e0e0",background:"#fff",color:"#78909c",fontSize:12,fontWeight:600,cursor:"pointer"}}>← Back to shots</button>
    </div>)}

    {/* Action bar */}
    {step!=="result"&&step!=="server"&&!isEditing&&(
      <div style={{display:"flex",gap:6,marginTop:8}}>
        <GhostBtn onClick={()=>setStep("result")}>End rally →</GhostBtn>
        <GhostBtn onClick={()=>{setRally(initRally(m.id,m.currentSet,set.sonScore,set.oppScore));setStep("server");setBuild(emptyBuild());setEditIdx(null);}}>Restart rally</GhostBtn>
      </div>
    )}

    <div style={{marginTop:"auto",paddingTop:12}}>
      {/* Rally history log */}
      <RallyLog rallies={m.rallies} currentSet={m.currentSet+1}/>

      <div style={{display:"flex",gap:6,marginTop:8}}>
        <GhostBtn onClick={nextSet}>Next set</GhostBtn>
        <GhostBtn onClick={endMatch} danger>End match</GhostBtn>
        <GhostBtn onClick={()=>{setRally(initRally(m.id,m.currentSet,set.sonScore,set.oppScore));setStep("server");setBuild(emptyBuild());setEditIdx(null);}}>Skip rally</GhostBtn>
      </div>
    </div>
  </Screen>);
}

function Summary({ data, setScreen }) {
  const m = data.matches[data.matches.length-1];
  if (!m){setScreen("home");return null;}
  const r=m.rallies,w=r.filter(x=>x.pointWonBy==="S").length,l=r.filter(x=>x.pointWonBy==="O").length;
  const ue=r.filter(x=>x.result==="UE"&&x.pointWonBy==="O").length,wn=r.filter(x=>x.result==="W"&&x.pointWonBy==="S").length;
  const cl=r.filter(x=>x.phase==="Clutch"),cw=cl.filter(x=>x.pointWonBy==="S").length;
  const avg=r.length>0?(r.reduce((a,x)=>a+x.shots.length,0)/r.length).toFixed(1):0;
  return (<Screen>
    <TopBar title="Match summary" onBack={()=>setScreen("home")}/>
    <div style={{background:"#1B5E20",borderRadius:14,padding:"10px 16px",marginBottom:12,textAlign:"center"}}>
      <div style={{fontSize:12,color:"#a5d6a7"}}>{m.id} · vs {m.opponent}</div>
      <div>{m.sets.map((s,i)=><span key={i} style={{fontSize:20,fontWeight:700,color:"#fff",margin:"0 8px"}}>{s.sonScore}-{s.oppScore}</span>)}</div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
      <Stat label="Rallies" value={r.length}/><Stat label="Won" value={w} color="#4caf50"/><Stat label="Lost" value={l} color="#ef5350"/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
      <Stat label="Winners" value={wn} color="#1B5E20"/><Stat label="Unforced Err" value={ue} color="#c62828"/><Stat label="Avg rally" value={avg}/>
    </div>
    {cl.length>0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
      <Stat label="Clutch pts" value={cl.length}/><Stat label="Clutch won" value={`${cw}/${cl.length}`} color={cw>=cl.length/2?"#4caf50":"#ef5350"}/>
    </div>}
    <BigBtn bg="#e3f2fd" color="#0d47a1" onClick={()=>setScreen("home")}>Done</BigBtn>
  </Screen>);
}

function History({ data, setScreen }) {
  return (<Screen>
    <TopBar title="Match history" onBack={()=>setScreen("home")}/>
    {data.matches.length===0&&<p style={{color:"#90a4ae",textAlign:"center",marginTop:"2rem"}}>No matches yet</p>}
    {[...data.matches].reverse().map((m,i)=>{
      const w=m.rallies.filter(r=>r.pointWonBy==="S").length,l=m.rallies.filter(r=>r.pointWonBy==="O").length;
      return (<div key={i} style={{background:"#fff",border:"1px solid #e0e0e0",borderRadius:10,padding:12,marginBottom:8}}>
        <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontFamily:"JetBrains Mono",fontSize:11,color:"#90a4ae"}}>{m.id}</span><span style={{fontSize:11,color:"#90a4ae"}}>{m.date}</span></div>
        <div style={{fontWeight:700,fontSize:15,margin:"4px 0"}}>vs {m.opponent}</div>
        <div style={{fontSize:13,color:"#546e7a"}}>{m.sets.map(s=>`${s.sonScore}-${s.oppScore}`).join(", ")}<span style={{marginLeft:8,color:w>l?"#4caf50":"#ef5350"}}>({w}W-{l}L)</span></div>
        {m.tournament&&<div style={{fontSize:11,color:"#90a4ae",marginTop:2}}>{m.tournament}</div>}
      </div>);
    })}
  </Screen>);
}

function Export({ data }) {
  const [showData,setShowData]=useState(false);
  const [copied,setCopied]=useState(false);
  const total=data.matches.reduce((a,m)=>a+m.rallies.length,0);

  const exportJson = JSON.stringify(data.matches, null, 0);

  const copyData=async()=>{
    try {
      await navigator.clipboard.writeText("Here is my match data from the Courtside app. Please analyze it and generate a downloadable CSV file.\n\n__COURTSIDE_EXPORT__\n"+exportJson+"\n__END_EXPORT__");
      setCopied(true); setTimeout(()=>setCopied(false),2000);
    } catch(e) {
      setShowData(true);
    }
  };

  return (<Screen>
    <div style={{textAlign:"center",padding:"2rem 0 1rem"}}><div style={{fontSize:28,marginBottom:8}}>📊</div><h2 style={{fontSize:18,fontWeight:700,marginBottom:4}}>Export data</h2><p style={{fontSize:13,color:"#78909c"}}>{data.matches.length} match{data.matches.length!==1?"es":""} · {total} rallies</p></div>

    <div style={{background:"#f5f5f5",borderRadius:10,padding:14,marginBottom:16,fontSize:13,color:"#546e7a",lineHeight:1.7}}>
      <div style={{fontWeight:700,color:"#37474f",marginBottom:6}}>How to export:</div>
      1. Tap "Copy data" below<br/>
      2. Go to the chat and <strong>paste</strong> it as a new message<br/>
      3. Claude will analyze your matches and give you a downloadable CSV<br/>
    </div>

    <BigBtn bg="#1B5E20" color="#fff" onClick={copyData}>{copied?"Copied! Now paste in chat":"Copy data to clipboard"}</BigBtn>

    {copied&&<p style={{textAlign:"center",color:"#4caf50",fontSize:13,fontWeight:600,marginTop:4}}>Now switch to the chat and paste (long-press → Paste)</p>}

    <div style={{marginTop:8}}>
      <button onClick={()=>setShowData(!showData)} style={{background:"none",border:"none",color:"#90a4ae",fontSize:12,cursor:"pointer",textDecoration:"underline",fontFamily:"Outfit"}}>
        {showData?"Hide":"If copy doesn't work, tap here to show data"}
      </button>
    </div>

    {showData&&(
      <div style={{marginTop:8}}>
        <p style={{fontSize:12,color:"#78909c",marginBottom:6}}>Select all the text below, copy it, and paste it in the chat:</p>
        <textarea readOnly value={"Here is my match data from the Courtside app. Please analyze it and generate a downloadable CSV file.\n\n__COURTSIDE_EXPORT__\n"+exportJson+"\n__END_EXPORT__"} style={{
          width:"100%",minHeight:150,padding:10,borderRadius:8,border:"1px solid #e0e0e0",
          fontSize:11,fontFamily:"JetBrains Mono",resize:"vertical",boxSizing:"border-box",
          background:"#fafafa",color:"#333",
        }}/>
      </div>
    )}
  </Screen>);
}

function RallyLog({ rallies, currentSet }) {
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  if (rallies.length === 0) return null;

  const setRallies = rallies.filter(r => r.set === currentSet);
  const prevRallies = rallies.filter(r => r.set !== currentSet);
  const displaySet = showAll ? rallies : setRallies;

  return (
    <div style={{background:"#fff",border:"1px solid #e0e0e0",borderRadius:10,overflow:"hidden"}}>
      <button onClick={()=>setOpen(!open)} style={{
        width:"100%",padding:"8px 12px",background:"#f8f9fa",border:"none",cursor:"pointer",
        display:"flex",justifyContent:"space-between",alignItems:"center",
      }}>
        <span style={{fontSize:12,fontWeight:700,color:"#37474f",fontFamily:"Outfit"}}>
          Rally log ({rallies.length} total{setRallies.length!==rallies.length?` · ${setRallies.length} this set`:""})
        </span>
        <span style={{fontSize:11,color:"#90a4ae",transform:open?"rotate(180deg)":"rotate(0)",transition:"transform 0.2s"}}>▼</span>
      </button>
      {open&&(
        <div style={{maxHeight:220,overflowY:"auto",padding:"4px 8px 8px"}}>
          {prevRallies.length>0&&!showAll&&(
            <button onClick={()=>setShowAll(true)} style={{
              width:"100%",padding:6,marginBottom:4,background:"none",border:"1px dashed #ddd",borderRadius:6,
              fontSize:11,color:"#90a4ae",cursor:"pointer",fontFamily:"Outfit",
            }}>Show earlier sets ({prevRallies.length} rallies)</button>
          )}
          {showAll&&prevRallies.length>0&&(
            <button onClick={()=>setShowAll(false)} style={{
              width:"100%",padding:6,marginBottom:4,background:"none",border:"1px dashed #ddd",borderRadius:6,
              fontSize:11,color:"#90a4ae",cursor:"pointer",fontFamily:"Outfit",
            }}>Hide earlier sets</button>
          )}
          {displaySet.map((r,i)=>{
            const won = r.pointWonBy==="S";
            const rc = ({"opening":["#e3f2fd","#0d47a1"],"disruption":["#fff3e0","#e65100"],"finish":["#ffebee","#b71c1c"],"neutral":["#f5f5f5","#78909c"]});
            return (
              <div key={i} style={{
                padding:"6px 8px",marginBottom:3,borderRadius:6,
                background:won?"#f1f8f1":"#fef5f5",
                borderLeft:`3px solid ${won?"#4caf50":"#ef5350"}`,
              }}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                  <span style={{fontSize:11,fontWeight:600,color:"#555",fontFamily:"Outfit"}}>
                    {showAll&&r.set!==currentSet?`S${r.set} `:""}{r.score} · R{(showAll?rallies:setRallies).indexOf(r)+1}
                  </span>
                  <span style={{display:"flex",gap:4,alignItems:"center"}}>
                    <span style={{fontSize:10,fontWeight:600,color:won?"#4caf50":"#ef5350",fontFamily:"Outfit"}}>{r.result}</span>
                    <span style={{fontSize:10,color:won?"#4caf50":"#ef5350",fontFamily:"Outfit"}}>{won?"SON":"OPP"}</span>
                  </span>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:3,alignItems:"center"}}>
                  {r.shots.map((s,j)=>{
                    const [bg,fg] = rc[s.role]||rc.neutral;
                    return (
                      <span key={j} style={{display:"inline-flex",alignItems:"center",gap:2}}>
                        <span style={{
                          padding:"1px 5px",borderRadius:4,background:bg,color:fg,
                          fontFamily:"JetBrains Mono",fontSize:10,fontWeight:600,
                        }}>{s.code}{s.zone?`—${s.zone}`:""}</span>
                        {j<r.shots.length-1&&<span style={{color:"#ddd",fontSize:9}}>→</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Screen({children}){return <div style={{display:"flex",flexDirection:"column",minHeight:"100vh",padding:"12px 16px"}}>{children}</div>;}
function TopBar({title,onBack}){return <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><button onClick={onBack} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",padding:4}}>←</button><span style={{fontWeight:700,fontSize:16}}>{title}</span></div>;}
function BigBtn({children,bg,color,onClick,disabled}){return <button onClick={onClick} disabled={disabled} style={{width:"100%",padding:14,borderRadius:12,border:"none",background:bg,color,fontWeight:700,fontSize:15,cursor:disabled?"default":"pointer",opacity:disabled?0.4:1,marginBottom:8,fontFamily:"Outfit"}}>{children}</button>;}
function GhostBtn({children,onClick,danger}){return <button onClick={onClick} style={{flex:1,padding:10,borderRadius:8,border:`1px solid ${danger?"#ef9a9a":"#e0e0e0"}`,background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",color:danger?"#ef5350":"#78909c",fontFamily:"Outfit"}}>{children}</button>;}
function TapBtn({label,sub,color,onClick,flex,active}){return <button onClick={onClick} style={{padding:"10px 14px",borderRadius:10,border:active?`2px solid ${color}`:`1.5px solid ${color}22`,background:active?`${color}22`:`${color}08`,cursor:"pointer",textAlign:"center",flex:flex?1:undefined,minWidth:flex?0:undefined}}><div style={{fontWeight:600,fontSize:13,color}}>{label}</div>{sub&&<div style={{fontFamily:"JetBrains Mono",fontSize:11,color:`${color}99`,marginTop:2}}>{sub}</div>}</button>;}
function SLabel({children}){return <div style={{fontWeight:600,fontSize:13,color:"#37474f",marginBottom:8}}>{children}</div>;}
function Badge({children}){return <div style={{fontFamily:"JetBrains Mono",fontSize:12,color:"#1B5E20",background:"#E8F5E9",padding:"4px 10px",borderRadius:6,display:"inline-block",marginBottom:12,fontWeight:600}}>{children}</div>;}
function Field({label,value,onChange,type="text",placeholder}){return <div style={{marginBottom:12}}><div style={{fontSize:12,color:"#78909c",marginBottom:4}}>{label}</div><input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid #e0e0e0",fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"Outfit"}}/></div>;}
function Chip({label,filled,color,onClick}){return <button onClick={onClick} style={{padding:"4px 12px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",border:filled?`1.5px solid ${color}`:"1.5px dashed #bdbdbd",background:filled?`${color}12`:"#fff",color:filled?color:"#bdbdbd",fontFamily:"Outfit"}}>{label}{filled&&" ✕"}</button>;}
function CourtGrid({onTap,active}){return <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,maxWidth:260,margin:"0 auto 8px"}}>{ZONES.map(z=><button key={z.n} onClick={()=>onTap(z.n)} style={{padding:"14px 4px",borderRadius:8,textAlign:"center",cursor:"pointer",border:active===z.n?"2px solid #0d47a1":"1.5px solid #e0e0e0",background:active===z.n?"#e3f2fd":"#fafafa"}}><div style={{fontWeight:800,fontSize:18,color:active===z.n?"#0d47a1":"#37474f"}}>{z.n}</div><div style={{fontSize:10,color:"#90a4ae"}}>{z.l}</div></button>)}<div style={{gridColumn:"1 / -1",textAlign:"center",fontSize:10,color:"#bdbdbd"}}>↑ NET ↑</div></div>;}
function Stat({label,value,color}){return <div style={{background:"#f5f5f5",borderRadius:10,padding:10,textAlign:"center"}}><div style={{fontSize:10,color:"#90a4ae",marginBottom:4}}>{label}</div><div style={{fontWeight:800,fontSize:20,color:color||"#37474f"}}>{value}</div></div>;}
function ScoreSide({label,score,onInc,onDec}){return <div style={{textAlign:"center"}}><div style={{fontSize:11,color:"#a5d6a7"}}>{label}</div><div style={{display:"flex",alignItems:"center",gap:8}}><button onClick={onDec} style={{width:28,height:28,borderRadius:14,border:"1px solid #4caf50",background:"transparent",color:"#a5d6a7",fontSize:16,cursor:"pointer",fontWeight:700}}>−</button><div style={{fontSize:36,fontWeight:800,color:"#fff",fontFamily:"Outfit",minWidth:40}}>{score}</div><button onClick={onInc} style={{width:28,height:28,borderRadius:14,border:"1px solid #4caf50",background:"transparent",color:"#a5d6a7",fontSize:16,cursor:"pointer",fontWeight:700}}>+</button></div></div>;}
