#ifndef WEB_SERVER_H
#define WEB_SERVER_H

#include <WiFi.h>
#include <WebServer.h>
#include "common.h"

extern WebServer server;
extern const char* ssid;
extern const char* password;
extern struct_message data;

extern bool webSOS;
extern bool webClear;
extern bool alertActive;
extern bool sosLatched;

// Defined in sensors.h (included after this file).
int readWaterRaw();
int waterSensorPin();

// ---------------------------------------------------------
// UI page. PROGMEM + send_P so no heap is used per request.
// Self-contained: a phone joined to this AP has no internet, so
// no CDN, no web fonts, no chart library.
// Endpoints and button behaviour are unchanged.
// ---------------------------------------------------------
static const char FLOOD_PAGE[] PROGMEM = R"HTML(
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#F6F7F5">
<title>FineLynk Flood Sensor</title>
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
padding:18px 16px calc(40px + env(safe-area-inset-bottom))}
.num{font-variant-numeric:tabular-nums}
.wrap{max-width:540px;margin:0 auto}
.top{display:flex;align-items:center;gap:10px;margin-bottom:20px}
.mark{width:32px;height:32px;flex:none}
.brand{font-size:17px;font-weight:600;letter-spacing:-.2px;line-height:1.2}
.brand small{display:block;font-size:12px;font-weight:400;color:var(--tx2)}
.badge{margin-left:auto;display:inline-flex;align-items:center;gap:6px;padding:5px 11px;
border-radius:99px;font-size:12px;font-weight:500;background:var(--okbg);color:var(--ok)}
.badge.off{background:#F0F1EF;color:var(--tx3)}
.dot{width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;
box-shadow:var(--sh);margin-bottom:14px;overflow:hidden}
.pad{padding:18px}
h2{margin:0 0 3px;font-size:15px;font-weight:600;letter-spacing:-.1px}
.hint{font-size:13px;color:var(--tx2);margin:0}
/* headline status */
.status{display:flex;gap:14px;align-items:flex-start;padding:18px;border-left:4px solid var(--ok)}
.status.warn{border-left-color:var(--warn)}
.status.bad{border-left-color:var(--bad)}
.sico{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;flex:none;
background:var(--okbg);color:var(--ok)}
.status.warn .sico{background:var(--warnbg);color:var(--warn)}
.status.bad .sico{background:var(--badbg);color:var(--bad)}
.stitle{font-size:17px;font-weight:600;letter-spacing:-.2px}
.sdesc{font-size:13.5px;color:var(--tx2);margin-top:2px}
/* level */
.lvrow{display:flex;align-items:baseline;justify-content:space-between;margin-top:14px}
.lvbig{font-size:34px;font-weight:600;letter-spacing:-1px;line-height:1}
.lvbig em{font-style:normal;font-size:16px;font-weight:500;color:var(--tx2);margin-left:2px}
.lvraw{font-size:13px;color:var(--tx2)}
.bar{position:relative;height:12px;border-radius:99px;background:#EDEFEB;margin-top:13px;overflow:hidden}
.fill{height:100%;border-radius:99px;background:var(--ok);width:0;transition:width .5s cubic-bezier(.2,.7,.3,1),background .3s}
.fill.bad{background:var(--bad)}
.mark2{position:absolute;top:-4px;bottom:-4px;width:2px;background:var(--bad);left:60.7%;border-radius:2px}
.scale{display:flex;justify-content:space-between;font-size:11.5px;color:var(--tx3);margin-top:7px}
.note{display:flex;gap:8px;align-items:flex-start;margin-top:14px;padding:11px 13px;
background:#F7F8F6;border-radius:10px;font-size:12.5px;color:var(--tx2);line-height:1.45}
/* buttons */
.btn{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;
border-radius:12px;padding:15px;font-size:15px;font-weight:600;font-family:inherit;
cursor:pointer;border:1px solid transparent;transition:transform .1s,opacity .2s,background .2s}
.btn:active{transform:scale(.99)}
.primary{background:var(--bad);color:#fff;box-shadow:0 1px 2px rgba(194,64,44,.3)}
.primary:hover{background:#A93724}
.ghost{background:var(--card);color:var(--tx);border-color:var(--line)}
.ghost:hover{background:#FAFBFA}
.ghost[disabled]{color:var(--tx3);cursor:default;background:#FAFBFA}
.bsub{font-size:12.5px;color:var(--tx2);text-align:center;margin:7px 0 15px}
/* detail rows */
.row{display:flex;justify-content:space-between;align-items:center;gap:12px;
padding:13px 18px;border-top:1px solid var(--line2)}
.row .k{font-size:13.5px;color:var(--tx2)}
.row .v{font-size:13.5px;font-weight:500;text-align:right}
.pill{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:99px;
font-size:12px;font-weight:500;background:var(--okbg);color:var(--ok)}
.pill.warn{background:var(--warnbg);color:var(--warn)}
.pill.bad{background:var(--badbg);color:var(--bad)}
.pill.mut{background:#F0F1EF;color:var(--tx2)}
ul.help{margin:8px 0 0;padding-left:18px;font-size:13px;color:var(--tx2);line-height:1.6}
ul.help li{margin-bottom:5px}
.foot{font-size:12px;color:var(--tx3);text-align:center;margin-top:20px}
/* toast */
.toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,70px);
background:#1A1F1C;color:#fff;padding:12px 18px;border-radius:11px;font-size:13.5px;font-weight:500;
box-shadow:0 8px 24px rgba(26,31,28,.24);opacity:0;pointer-events:none;
transition:transform .3s cubic-bezier(.2,.7,.3,1),opacity .3s;z-index:9}
.toast.show{transform:translate(-50%,0);opacity:1}
</style>
</head>
<body>
<div class="wrap">

<div class="top">
<svg class="mark" viewBox="0 0 40 40" aria-hidden="true"><path d="M3 22h5l3-11 4 20 4-25 4 22 3-9h6" fill="none" stroke="#1E7A5A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
<div class="brand">FineLynk<small>Flood sensor station</small></div>
<div class="badge" id="badge"><span class="dot"></span><span id="conn">Connected</span></div>
</div>

<div class="card">
<div class="status" id="status">
<div class="sico" id="sico"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" id="sicon"><path d="M20 6L9 17l-5-5"/></svg></div>
<div>
<div class="stitle" id="stitle">Everything is normal</div>
<div class="sdesc" id="sdesc">Water level is below the alert threshold</div>
</div>
</div>
</div>

<div class="card">
<div class="pad">
<h2>Water level</h2>
<p class="hint">How much of the sensor strip is currently in water</p>
<div class="lvrow">
<div class="lvbig num"><span id="pct">0</span><em>%</em></div>
<div class="lvraw num"><span id="raw">0</span> of 1400</div>
</div>
<div class="bar"><div class="fill" id="fill"></div><div class="mark2" title="Alert threshold"></div></div>
<div class="scale"><span>Dry</span><span>Alert at 61%</span><span>Submerged</span></div>
<div class="note">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A938C" stroke-width="2" stroke-linecap="round" style="flex:none;margin-top:2px"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.4"/></svg>
<span>An alert starts when the level goes above <b>850</b> and stops once it falls back under <b>650</b>. The gap keeps the alarm steady instead of flickering.</span>
</div>
</div>
</div>

<button class="btn primary" onclick="act('/sos','Emergency SOS sent to the master station')">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
Send emergency SOS
</button>
<p class="bsub">Immediately alerts the master station</p>

<button class="btn ghost" id="clrbtn" onclick="act('/clear','Alert cleared')" disabled>Clear active alert</button>
<p class="bsub" id="clrsub">Nothing to clear right now</p>

<div class="card">
<div class="pad" style="padding-bottom:4px"><h2>Station details</h2></div>
<div class="row"><span class="k">Station name</span><span class="v" id="v0">FL-01</span></div>
<div class="row"><span class="k">Flood state</span><span class="v"><span class="pill" id="v1">Normal</span></span></div>
<div class="row"><span class="k">SOS signal</span><span class="v"><span class="pill mut" id="v2">Inactive</span></span></div>
<div class="row"><span class="k">Sensor health</span><span class="v"><span class="pill" id="v3">Healthy</span></span></div>
<div class="row"><span class="k">Running for</span><span class="v num" id="v4">0m</span></div>
<div class="row"><span class="k">Sensor pin</span><span class="v num" id="v5">GPIO32</span></div>
</div>

<div class="card">
<div class="pad">
<h2>How this station works</h2>
<ul class="help">
<li>The sensor strip reads how far water has risen, updated twice a second.</li>
<li>If the level crosses the threshold, this station alerts the master automatically.</li>
<li>The SOS button raises a manual alert even when the water is normal.</li>
<li>It keeps working with no internet, because it talks to the master directly over radio.</li>
</ul>
</div>
</div>

<div class="foot">FineLynk, safer communities</div>
</div>
<div class="toast" id="toast"></div>

<script>
var FULL=1400,miss=0,tmr=null;
function el(i){return document.getElementById(i);}
function set(i,v){el(i).innerHTML=v;}
function toast(m){var t=el("toast");t.innerHTML=m;t.className="toast show";
 clearTimeout(tmr);tmr=setTimeout(function(){t.className="toast";},2600);}
function act(u,m){fetch(u,{cache:"no-store"}).then(function(r){return r.text();})
 .then(function(){toast(m);update();});}
function upfmt(s){var h=Math.floor(s/3600),m=Math.floor(s%3600/60);
 return h?h+"h "+m+"m":(m?m+"m":"less than a minute");}
function update(){
 fetch("/status",{cache:"no-store"}).then(function(r){return r.json();}).then(function(d){
  miss=0;
  el("badge").className="badge";set("conn","Connected");
  set("v0",d.node);set("raw",d.raw);set("v4",upfmt(d.up));set("v5","GPIO"+d.pin);
  var p=Math.min(100,Math.round(d.water/FULL*100));
  set("pct",p);
  var f=el("fill");f.style.width=p+"%";f.className="fill"+(d.flood?" bad":"");

  var st=el("status"),ic=el("sicon");
  if(d.flood){
   st.className="status bad";
   ic.innerHTML='<path d="M12 8v5M12 16.5v.5"/><path d="M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>';
   set("stitle","Flood detected");
   set("sdesc","Water is above the alert threshold. The master station has been notified.");
  }else if(d.sos){
   st.className="status warn";
   ic.innerHTML='<path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>';
   set("stitle","Emergency SOS active");
   set("sdesc","A manual alert was raised from this station.");
  }else{
   st.className="status";
   ic.innerHTML='<path d="M20 6L9 17l-5-5"/>';
   set("stitle","Everything is normal");
   set("sdesc","Water level is below the alert threshold.");
  }

  set("v1",d.flood?"Above threshold":"Normal");
  el("v1").className="pill"+(d.flood?" bad":"");
  set("v2",d.sos?"Active":"Inactive");
  el("v2").className="pill"+(d.sos?" warn":" mut");
  set("v3",d.fault?"Check wiring":"Healthy");
  el("v3").className="pill"+(d.fault?" warn":"");

  el("clrbtn").disabled=!d.alert;
  set("clrsub",d.alert?"Stops the alarm on this station and the master":"Nothing to clear right now");
 }).catch(function(){
  miss++;
  if(miss>4){el("badge").className="badge off";set("conn","Not responding");}
 });
}
setInterval(update,600);update();
</script>
</body>
</html>
)HTML";

void handleRoot()
{
  server.send_P(200, "text/html", FLOOD_PAGE);
}

// Live JSON status. no-store stops the browser caching the poll,
// which otherwise freezes the readings on screen.
void handleNodeStatus()
{
  char json[288];
  snprintf(json, sizeof(json),
    "{\"node\":\"%s\",\"water\":%d,\"raw\":%d,\"pin\":%d,\"up\":%lu,"
    "\"flood\":%s,\"sos\":%s,\"alert\":%s,\"fault\":%s}",
    data.nodeName,
    data.waterLevel,
    readWaterRaw(),
    waterSensorPin(),
    (unsigned long)(millis() / 1000UL),
    data.flood       ? "true" : "false",
    sosLatched       ? "true" : "false",
    alertActive      ? "true" : "false",
    data.sensorFault ? "true" : "false");

  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "application/json", json);
}

// ---------------------------------------------------------
// Raw ADC diagnostic. http://192.168.4.1/raw
// ---------------------------------------------------------
void handleRawADC()
{
  String out = "WATER_SENSOR = GPIO ";
  out += String(waterSensorPin());
  out += "\n20 live samples:\n";

  for (int i = 0; i < 20; i++) {
    out += String(readWaterRaw());
    out += "\n";
    delay(20);
  }

  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "text/plain", out);
}

void handleSOS()
{
  Serial.println("WEB SOS Triggered");
  webSOS = true;
  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "text/plain", "SOS Sent!");
}

void handleNodeClear()
{
  Serial.println("WEB CLEAR Triggered");
  webClear = true;
  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "text/plain", "Alert Cleared!");
}

// ---------------------------
// Wi-Fi Setup
// ---------------------------
void setupWiFi()
{
  IPAddress apIP(192, 168, 4, 1);
  IPAddress apGW(192, 168, 4, 1);
  IPAddress apMask(255, 255, 255, 0);
  WiFi.softAPConfig(apIP, apGW, apMask);

  WiFi.softAP(ssid, password, ESPNOW_CHANNEL);
  delay(100);

  Serial.println("--------------------------------");
  Serial.println("Flood Node AP Started");
  Serial.print("SSID    : "); Serial.println(ssid);
  Serial.print("Password: "); Serial.println(password);
  Serial.print("Channel : "); Serial.println(ESPNOW_CHANNEL);
  Serial.print("OPEN THIS URL -> http://");
  Serial.println(WiFi.softAPIP());
  Serial.println("--------------------------------");

  server.on("/", handleRoot);
  server.on("/status", handleNodeStatus);
  server.on("/raw", handleRawADC);
  server.on("/sos", handleSOS);
  server.on("/clear", handleNodeClear);

  server.onNotFound([]() {
    server.sendHeader("Location", "/", true);
    server.send(302, "text/plain", "");
  });

  server.begin();
  Serial.println("Web Server Started");
}

#endif
