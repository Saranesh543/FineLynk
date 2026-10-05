#ifndef DASHBOARD_H
#define DASHBOARD_H

// struct_message lives in common.h, shared with the Flood node.
//
// PROGMEM + send_P (no heap per request). All live data is filled
// client-side from /status, which already reports every known node.
// Self-contained: no CDN, no web fonts, no chart library.
//
// Endpoints and button behaviour are unchanged: /status polls,
// /clear clears the alert.

static const char MASTER_PAGE[] PROGMEM = R"HTML(
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#F6F7F5">
<title>FineLynk Dashboard</title>
<style>
:root{
--bg:#F6F7F5;--card:#FFFFFF;--line:#E4E7E2;--line2:#EFF1EE;
--tx:#1A1F1C;--tx2:#5C6660;--tx3:#8A938C;
--ok:#1E7A5A;--okbg:#E8F4EE;
--warn:#B4791C;--warnbg:#FBF2E0;
--bad:#C2402C;--badbg:#FBEBE7;
--sh:0 1px 2px rgba(26,31,28,.05),0 1px 3px rgba(26,31,28,.04);
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;padding:0}
body{min-height:100vh;background:var(--bg);color:var(--tx);
font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:15px;line-height:1.5;
padding:20px 18px calc(40px + env(safe-area-inset-bottom))}
.num{font-variant-numeric:tabular-nums}
.wrap{max-width:1040px;margin:0 auto}
.top{display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap}
.mark{width:32px;height:32px;flex:none}
.brand{font-size:17px;font-weight:600;letter-spacing:-.2px;line-height:1.2}
.brand small{display:block;font-size:12px;font-weight:400;color:var(--tx2)}
.badge{margin-left:auto;display:inline-flex;align-items:center;gap:6px;padding:5px 11px;
border-radius:99px;font-size:12px;font-weight:500;background:var(--okbg);color:var(--ok)}
.badge.off{background:#F0F1EF;color:var(--tx3)}
.dot{width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}
h1{margin:16px 0 3px;font-size:23px;font-weight:600;letter-spacing:-.5px}
.lede{margin:0 0 18px;font-size:13.5px;color:var(--tx2)}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;
box-shadow:var(--sh);margin-bottom:14px;overflow:hidden}
.pad{padding:18px}
h2{margin:0 0 3px;font-size:15px;font-weight:600;letter-spacing:-.1px}
.hint{font-size:13px;color:var(--tx2);margin:0}
/* banner */
.banner{display:flex;gap:14px;align-items:center;padding:16px 18px;border-left:4px solid var(--ok)}
.banner.bad{border-left-color:var(--bad)}
.banner.warn{border-left-color:var(--warn)}
.bico{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;flex:none;
background:var(--okbg);color:var(--ok)}
.banner.bad .bico{background:var(--badbg);color:var(--bad)}
.banner.warn .bico{background:var(--warnbg);color:var(--warn)}
.btitle{font-size:16.5px;font-weight:600;letter-spacing:-.2px}
.bdesc{font-size:13.5px;color:var(--tx2);margin-top:2px}
/* stats */
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:14px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:var(--sh);padding:16px}
.stat .k{font-size:12.5px;color:var(--tx2)}
.stat .v{font-size:28px;font-weight:600;letter-spacing:-.9px;line-height:1.2;margin-top:2px}
.stat .s{font-size:12px;color:var(--tx3);margin-top:1px}
.stat .s.bad{color:var(--bad)}.stat .s.warn{color:var(--warn)}.stat .s.ok{color:var(--ok)}
.cols{display:grid;grid-template-columns:1.6fr 1fr;gap:14px}
/* chart */
svg.chart{display:block;width:100%;height:190px;margin-top:14px}
.legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:11px;font-size:12.5px;color:var(--tx2)}
.legend i{display:inline-block;width:12px;height:3px;border-radius:2px;margin-right:6px;vertical-align:middle}
.note{display:flex;gap:8px;align-items:flex-start;margin-top:13px;padding:11px 13px;
background:#F7F8F6;border-radius:10px;font-size:12.5px;color:var(--tx2);line-height:1.45}
/* table */
table{width:100%;border-collapse:collapse}
th{text-align:left;font-size:12px;font-weight:500;color:var(--tx3);padding:0 10px 10px 0}
td{padding:13px 10px 13px 0;border-top:1px solid var(--line2);font-size:13.5px}
td.n{font-weight:600}
.pill{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:99px;
font-size:12px;font-weight:500;background:var(--okbg);color:var(--ok)}
.pill.warn{background:var(--warnbg);color:var(--warn)}
.pill.bad{background:var(--badbg);color:var(--bad)}
.pill.mut{background:#F0F1EF;color:var(--tx2)}
.minibar{height:6px;border-radius:99px;background:#EDEFEB;overflow:hidden;margin-top:5px;max-width:110px}
.minifill{height:100%;border-radius:99px;background:var(--ok);transition:width .5s}
.minifill.bad{background:var(--bad)}
/* buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;
border-radius:11px;padding:11px 18px;font-size:14px;font-weight:600;font-family:inherit;
cursor:pointer;border:1px solid transparent;transition:transform .1s,background .2s,opacity .2s}
.btn:active{transform:scale(.99)}
.primary{background:var(--bad);color:#fff}
.primary:hover{background:#A93724}
.primary[disabled]{background:#F0F1EF;color:var(--tx3);cursor:default}
/* activity */
.ev{display:flex;gap:11px;padding:13px 0;border-top:1px solid var(--line2)}
.ev:first-child{border-top:0}
.evi{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;flex:none}
.ev .t{font-size:13px;font-weight:600}
.ev .d{font-size:12.5px;color:var(--tx2);margin-top:1px}
.ev .w{margin-left:auto;font-size:12px;color:var(--tx3);white-space:nowrap}
.empty{padding:26px 6px;text-align:center;color:var(--tx3);font-size:13px}
ul.help{margin:8px 0 0;padding-left:18px;font-size:13px;color:var(--tx2);line-height:1.6}
ul.help li{margin-bottom:5px}
.foot{font-size:12px;color:var(--tx3);text-align:center;margin-top:20px}
.toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,70px);
background:#1A1F1C;color:#fff;padding:12px 18px;border-radius:11px;font-size:13.5px;font-weight:500;
box-shadow:0 8px 24px rgba(26,31,28,.24);opacity:0;pointer-events:none;
transition:transform .3s cubic-bezier(.2,.7,.3,1),opacity .3s;z-index:9}
.toast.show{transform:translate(-50%,0);opacity:1}
@media(max-width:880px){.stats{grid-template-columns:1fr 1fr}.cols{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="wrap">

<div class="top">
<svg class="mark" viewBox="0 0 40 40" aria-hidden="true"><path d="M3 22h5l3-11 4 20 4-25 4 22 3-9h6" fill="none" stroke="#1E7A5A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
<div class="brand">FineLynk<small>Master dashboard</small></div>
<div class="badge" id="badge"><span class="dot"></span><span id="conn">Live</span></div>
</div>

<h1>Flood monitoring</h1>
<p class="lede">Live status of every sensor station reporting to this master unit.</p>

<div class="card">
<div class="banner" id="banner">
<div class="bico"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" id="bicon"><path d="M20 6L9 17l-5-5"/></svg></div>
<div style="flex:1">
<div class="btitle" id="btitle">All stations normal</div>
<div class="bdesc" id="bdesc">No stations are reporting a flood or an SOS.</div>
</div>
<button class="btn primary" id="clrbtn" onclick="clearAlert()" disabled>Clear alert</button>
</div>
</div>

<div class="stats">
<div class="stat"><div class="k">Stations</div><div class="v num" id="k1">0</div><div class="s" id="s1">None connected yet</div></div>
<div class="stat"><div class="k">Reporting now</div><div class="v num" id="k2">0</div><div class="s" id="s2">Waiting</div></div>
<div class="stat"><div class="k">Flood alerts</div><div class="v num" id="k3">0</div><div class="s ok" id="s3">All clear</div></div>
<div class="stat"><div class="k">SOS signals</div><div class="v num" id="k4">0</div><div class="s ok" id="s4">None raised</div></div>
</div>

<div class="cols">

<div class="card">
<div class="pad">
<h2>Water levels over time</h2>
<p class="hint">Each line is one station, updated live</p>
<svg class="chart" viewBox="0 0 480 190" preserveAspectRatio="none" aria-hidden="true">
<rect x="0" y="10" width="480" height="160" fill="#FAFBFA"/>
<rect x="0" y="10" width="480" height="63" fill="#C2402C" opacity=".05"/>
<line x1="0" y1="50" x2="480" y2="50" stroke="#EFF1EE"/>
<line x1="0" y1="90" x2="480" y2="90" stroke="#EFF1EE"/>
<line x1="0" y1="130" x2="480" y2="130" stroke="#EFF1EE"/>
<g id="fills"></g><g id="lines"></g>
<line x1="0" y1="73" x2="480" y2="73" stroke="#C2402C" stroke-width="1" stroke-dasharray="5 5" opacity=".6"/>
<line x1="0" y1="96" x2="480" y2="96" stroke="#B4791C" stroke-width="1" stroke-dasharray="5 5" opacity=".45"/>
</svg>
<div class="legend" id="legend"><span style="color:var(--tx3)">No station data yet</span></div>
<div class="note">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A938C" stroke-width="2" stroke-linecap="round" style="flex:none;margin-top:2px"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.4"/></svg>
<span>The red dashed line is the alert threshold at <b>850</b>. The amber line at <b>650</b> is where an alert switches back off.</span>
</div>
</div>
</div>

<div class="card">
<div class="pad" style="padding-bottom:10px"><h2>Recent activity</h2><p class="hint">Since you opened this page</p></div>
<div class="pad" style="padding-top:0" id="events"><div class="empty">Nothing has happened yet</div></div>
</div>

</div>

<div class="card">
<div class="pad" style="padding-bottom:12px"><h2>Stations</h2><p class="hint" id="ncount">No stations have reported in</p></div>
<div class="pad" style="padding-top:0">
<table><thead><tr><th>Station</th><th>Water level</th><th>Last seen</th><th>Status</th></tr></thead>
<tbody id="tbody"></tbody></table>
<div class="empty" id="nempty">Waiting for a station to connect</div>
</div>
</div>

<div class="card">
<div class="pad">
<h2>How this dashboard works</h2>
<ul class="help">
<li>Sensor stations send their readings to this master unit over direct radio, so no internet or router is needed.</li>
<li>A station raises a flood alert automatically when its water level crosses the threshold.</li>
<li>Anyone at a station can also raise a manual SOS using the button on the station itself.</li>
<li>Clearing an alert here also silences the alarm on every connected station.</li>
<li>A station shows as offline if nothing is heard from it for five seconds.</li>
</ul>
</div>
</div>

<div class="foot">FineLynk, safer communities</div>
</div>
<div class="toast" id="toast"></div>

<script>
var FULL=1400,hist={},evs=[],miss=0,prev={},tmr=null;
var COL=["#1E7A5A","#B4791C","#4A7C59","#8A6D3B","#2F6B52","#A05C2C","#3D7A66","#7A6A3A"];
var KIND={flood:["#FBEBE7","#C2402C"],sos:["#FBF2E0","#B4791C"],off:["#F0F1EF","#8A938C"],on:["#E8F4EE","#1E7A5A"]};
function el(i){return document.getElementById(i);}
function set(i,v){el(i).innerHTML=v;}
function esc(s){return String(s).replace(/[&<>]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;"}[c];});}
function clk(){return new Date().toTimeString().slice(0,5);}
function ago(ms){var s=Math.round(ms/1000);return s<2?"Just now":s<60?s+" seconds ago":Math.floor(s/60)+" min ago";}
function toast(m){var t=el("toast");t.innerHTML=m;t.className="toast show";
 clearTimeout(tmr);tmr=setTimeout(function(){t.className="toast";},2600);}
function addEv(k,t,d){
 evs.unshift({k:k,t:t,d:d,w:clk()});if(evs.length>6)evs.pop();
 var h="";
 for(var i=0;i<evs.length;i++){var e=evs[i],c=KIND[e.k];
  h+='<div class="ev"><div class="evi" style="background:'+c[0]+'">'+
     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="'+c[1]+'" stroke-width="2.6" stroke-linecap="round"><circle cx="12" cy="12" r="7"/></svg></div>'+
     '<div><div class="t">'+esc(e.t)+'</div><div class="d">'+esc(e.d)+'</div></div>'+
     '<div class="w num">'+e.w+'</div></div>';}
 el("events").innerHTML=h;
}
function drawChart(nodes){
 var L="",F="",lg="",any=false;
 for(var i=0;i<nodes.length;i++){
  var nm=nodes[i].name,pts=hist[nm]||[];
  if(pts.length<2)continue;any=true;
  var c=nodes[i].flood?"#C2402C":COL[i%COL.length],st=480/(pts.length-1),d="";
  for(var j=0;j<pts.length;j++){
   var v=Math.max(0,Math.min(FULL,pts[j]));
   d+=(j?"L":"M")+(j*st).toFixed(1)+" "+(170-(v/FULL)*160).toFixed(1);}
  F+='<path d="'+d+'L480 170L0 170Z" fill="'+c+'" fill-opacity=".07"/>';
  L+='<path d="'+d+'" fill="none" stroke="'+c+'" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
  lg+='<span><i style="background:'+c+'"></i>'+esc(nm)+'</span>';
 }
 el("fills").innerHTML=F;el("lines").innerHTML=L;
 el("legend").innerHTML=any?lg:'<span style="color:var(--tx3)">No station data yet</span>';
}
function clearAlert(){fetch("/clear",{cache:"no-store"}).then(function(){
 toast("Alert cleared on all stations");update();});}
function update(){
 fetch("/status",{cache:"no-store"}).then(function(r){return r.json();}).then(function(d){
  miss=0;
  el("badge").className="badge";set("conn","Live");
  var ns=d.nodes,online=0,flooding=0,worst=null;
  for(var i=0;i<ns.length;i++){
   var n=ns[i];
   if(n.online)online++;
   if(n.online&&n.flood){flooding++;if(!worst||n.water>worst.water)worst=n;}
   var a=hist[n.name]||[];a.push(n.water);if(a.length>50)a.shift();hist[n.name]=a;
   var p=prev[n.name]||{};
   if(p.flood===false&&n.flood)addEv("flood","Flood detected at "+n.name,"Water level reached "+n.water);
   if(p.online===true&&!n.online)addEv("off",n.name+" went offline","No readings received");
   if(p.online===false&&n.online)addEv("on",n.name+" is back online","Reporting normally again");
   prev[n.name]={flood:n.flood,online:n.online};
  }
  if(d.manualSOS&&!prev.__sos)addEv("sos","SOS raised at "+d.manualSOSNode,"Triggered from the "+String(d.manualSOSType).toLowerCase());
  prev.__sos=d.manualSOS;

  set("k1",ns.length);
  set("s1",ns.length?"Connected to this master":"None connected yet");
  set("k2",online);
  el("s2").className="s"+(ns.length&&online<ns.length?" warn":"");
  set("s2",ns.length?(online===ns.length?"All responding":(ns.length-online)+" not responding"):"Waiting");
  set("k3",flooding);
  el("s3").className="s "+(flooding?"bad":"ok");
  set("s3",flooding?"Needs attention":"All clear");
  set("k4",d.manualSOS?1:0);
  el("s4").className="s "+(d.manualSOS?"bad":"ok");
  set("s4",d.manualSOS?"Raised at "+d.manualSOSNode:"None raised");

  var act=flooding>0||d.manualSOS,bn=el("banner"),ic=el("bicon");
  if(flooding){
   bn.className="banner bad";
   ic.innerHTML='<path d="M12 8v5M12 16.5v.5"/><path d="M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>';
   set("btitle","Flood detected");
   set("bdesc",worst?esc(worst.name)+" is above the alert threshold at "+worst.water+".":"A station is above the alert threshold.");
  }else if(d.manualSOS){
   bn.className="banner warn";
   ic.innerHTML='<path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>';
   set("btitle","Emergency SOS raised");
   set("bdesc","Someone triggered a manual alert at "+esc(d.manualSOSNode)+".");
  }else{
   bn.className="banner";
   ic.innerHTML='<path d="M20 6L9 17l-5-5"/>';
   set("btitle","All stations normal");
   set("bdesc",ns.length?"No stations are reporting a flood or an SOS.":"Waiting for the first station to connect.");
  }
  el("clrbtn").disabled=!act;

  set("ncount",ns.length?ns.length+" station"+(ns.length>1?"s":"")+" reporting to this master":"No stations have reported in");
  el("nempty").style.display=ns.length?"none":"block";
  var t="";
  for(var i=0;i<ns.length;i++){
   var n=ns[i],b,c;
   if(!n.online){b="Offline";c="mut";}
   else if(n.flood){b="Flood detected";c="bad";}
   else if(n.sensorFault){b="Check sensor";c="warn";}
   else{b="Normal";c="";}
   var p=Math.min(100,Math.round(n.water/FULL*100));
   t+='<tr><td class="n">'+esc(n.name)+'</td>'+
      '<td><span class="num">'+p+'% ('+n.water+')</span>'+
      '<div class="minibar"><div class="minifill'+(n.online&&n.flood?" bad":"")+'" style="width:'+p+'%"></div></div></td>'+
      '<td style="color:var(--tx2)" class="num">'+ago(n.lastSeenMs)+'</td>'+
      '<td><span class="pill '+c+'">'+b+'</span></td></tr>';
  }
  el("tbody").innerHTML=t;
  drawChart(ns);
 }).catch(function(){
  miss++;
  if(miss>4){el("badge").className="badge off";set("conn","Not responding");}
 });
}
setInterval(update,700);update();
</script>
</body>
</html>
)HTML";

const char* getDashboard()
{
  return MASTER_PAGE;
}

#endif
