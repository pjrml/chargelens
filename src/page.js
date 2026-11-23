// ChargeLens "Page" - phone page and JSON for the energy log written by meter.js.
// Reads KVS only, except Sys.SetTime + its own time-correction log cc:tadj. Design:
// docs/superpowers/specs/2026-11-19-chargelens-design.md
// Device limits that shape this script: script HTTP responses <= ~4 KB, max 5 endpoints per script, and all
// scripts share a ~25 KB heap (source included). So the page itself (page.html) is stored as a separate script
// "PageHtml" that is never started (flash only) and "ui" is a small loader that reads it with
// /rpc/Script.GetCode and writes it into the document.
// Endpoints (http://<ip>/script/<id>/...):
//   ui[?p=setup]    loader for the page (PageHtml), or for the setup page (SetupHtml) with p=setup
//   data[?m=YYYYMM] {w,a,v,on,e,unix,off,up,st,k,m,er}  live meter (e = firmware counter Wh) + sys, cc:state, month;
//                   on (relay output) and er (switch:0 errors) only on the relay plugs; the Plug PM Gen3 build reads pm1:0
//   list            {months:[YYYYMM...], adj:[...], tadj:[...]}
//   time?set=<unix> {ok,prev}   sets the clock; logs corrections > 300 s of a set clock in cc:tadj
//   log[?m=YYYYMM]  v2 {k,s:[cc:s:m,-2,-3 present],su,ev:[ev0..2],ei,boot,hb:[hb0..2],n,l} (missing keys null)
//   time?boot=N&up=UP|T&day=YYYYMMDD {ok}  v2.1: dates one undated item of cc:su (session N,UP or boot N's T line);
//                   Meter does the writes (event cc_date)
// The relay toggle on the page (relay plugs only) calls /rpc/Switch.Set directly.

let CLOCK_MIN = 1700000000;
let TADJ_MAX = 5;

function q(req, key) {
  let s = req.query || "";
  let k = key + "="; let p = s.indexOf(k);
  if (p < 0) return null;
  let v = s.slice(p + k.length);
  let a = v.indexOf("&");
  return a >= 0 ? v.slice(0, a) : v;
}

function send(res, code, type, body) {
  res.code = code;
  res.headers = [["Content-Type", type], ["Cache-Control", "no-store"]];
  res.body = body;
  res.send();
}
function json(res, obj) { send(res, 200, "application/json", JSON.stringify(obj)); }

function kvsGet(key, cb) {
  Shelly.call("KVS.Get", {key: key}, function (r, err) { cb((!err && r) ? r.value : null); });
}
function parseOr(v, dflt) {
  if (!v) return dflt;
  try { return JSON.parse(v); } catch (e) { return dflt; }
}

// sequential KVS reads (one call in flight: small heap); out[i] = value of keys[i] or null
function getAll(keys, out, cb) {
  if (out.length >= keys.length) { cb(out); return; }
  kvsGet(keys[out.length], function (v) { out.push(v); getAll(keys, out, cb); });
}

function validMonth(m) { return m !== null && m.length === 6 && !isNaN(Number(m)); }

// The loader HTML is a literal inside the handler, not a global: a global string costs script heap all the time
// (~1.4 KB), a literal in a function body only while the handler runs.
HTTPServer.registerEndpoint("ui", function (req, res) {
  send(res, 200, "text/html; charset=utf-8", "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">" +
    "<meta name=\"apple-mobile-web-app-capable\" content=\"yes\"><meta name=\"apple-mobile-web-app-title\" content=\"ChargeLens\">" +
    "<title>ChargeLens</title></head><body style=\"background:#0b1221;color:#94a3b8;font-family:sans-serif\">Loading...<script>" +
    "(async function(){var g=async function(u){return (await fetch(u)).json()};" +
    "var L=await g('/rpc/Script.List'),id=-1,i,n=location.search.indexOf('p=setup')>=0?'SetupHtml':'PageHtml';for(i=0;i<L.scripts.length;i++)if(L.scripts[i].name==n)id=L.scripts[i].id;" +
    "var h='',o=0,r;do{r=await g('/rpc/Script.GetCode?id='+id+'&offset='+o);h+=r.data;o+=r.data.length}while(r.left>0&&r.data.length);" +
    "document.open();document.write(h);document.close()})()</script></body></html>");
});

HTTPServer.registerEndpoint("data", function (req, res) {
  //@if relay
  let sw = Shelly.getComponentStatus("switch:0");
  //@else
  let sw = Shelly.getComponentStatus("pm1:0");
  //@end
  let sys = Shelly.getComponentStatus("sys");
  kvsGet("cc:state", function (sv) {
    let st = parseOr(sv, null);
    if (!st) st = {c: 0, o: 0, t: 0, pb: 0, po: 0, dk: "", dw: 0};
    let m = q(req, "m");
    if (!validMonth(m)) m = st.dk ? st.dk.slice(0, 6) : "";
    //@if relay
    let out = {w: sw.apower, a: sw.current, v: sw.voltage, on: sw.output, e: sw.aenergy.total,
      unix: sys.unixtime || 0, off: sys.utc_offset || 0, up: sys.uptime, st: st, k: m, m: "", er: sw.errors || []};
    //@else
    let out = {w: sw.apower, a: sw.current, v: sw.voltage, e: sw.aenergy.total,
      unix: sys.unixtime || 0, off: sys.utc_offset || 0, up: sys.uptime, st: st, k: m, m: ""};
    //@end
    if (!m) { json(res, out); return; }
    kvsGet("cc:m:" + m, function (mv) { out.m = mv || ""; json(res, out); });
  });
});

HTTPServer.registerEndpoint("log", function (req, res) {
  kvsGet("cc:state", function (sv) {
    let st = parseOr(sv, {});
    let m = q(req, "m");
    if (!validMonth(m)) m = st.dk ? st.dk.slice(0, 6) : "";
    let p = "cc:s:" + m;
    getAll([p, p + "-2", p + "-3", "cc:su", "cc:ev0", "cc:ev1", "cc:ev2", "cc:boot", "cc:hb0", "cc:hb1", "cc:hb2"], [],
      function (v) {
        let s = []; let i;
        for (i = 0; i < 3; i++) if (v[i] !== null) s.push(v[i]);
        json(res, {k: m, s: s, su: v[3], ev: [v[4], v[5], v[6]], ei: st.ei || 0, boot: v[7], hb: [v[8], v[9], v[10]],
          n: st.n || 0, l: st.l || 0});
      });
  });
});

HTTPServer.registerEndpoint("list", function (req, res) {
  Shelly.call("KVS.List", {match: "cc:m:*"}, function (r, err) {
    let months = []; let k;
    if (!err && r && r.keys) for (k in r.keys) months.push(k.slice(5));
    kvsGet("cc:adj", function (a) {
      kvsGet("cc:tadj", function (t) {
        json(res, {months: months, adj: parseOr(a, []), tadj: parseOr(t, [])});
      });
    });
  });
});

function dateBootReq(req, res) {
  let n = parseInt(q(req, "boot"), 10); let day = q(req, "day"); let up = q(req, "up");
  kvsGet("cc:su", function (v) {
    let ok = !isNaN(n) && up !== null && day !== null && day.length === 8 && !isNaN(Number(day)) && v !== null &&
      (";" + v).indexOf(";" + String(n) + "," + up + ",") >= 0;
    if (!ok) { send(res, 400, "text/plain", "use time?boot=N&up=UP|T&day=YYYYMMDD (an undated item)"); return; }
    Shelly.emitEvent("cc_date", {n: n, u: up, day: day});
    json(res, {ok: true});
  });
}

HTTPServer.registerEndpoint("time", function (req, res) {
  if (q(req, "boot") !== null) { dateBootReq(req, res); return; }
  let s = q(req, "set");
  let unix = s === null ? NaN : Number(s);
  if (isNaN(unix) || unix < CLOCK_MIN) { send(res, 400, "text/plain", "use time?set=<unix>"); return; }
  unix = Math.floor(unix);
  let prev = Shelly.getComponentStatus("sys").unixtime || 0;
  Shelly.call("Sys.SetTime", {unixtime: unix}, function (r, err, msg) {
    if (err) { send(res, 500, "text/plain", "SetTime failed: " + String(msg)); return; }
    json(res, {ok: true, prev: prev});
    if (prev > CLOCK_MIN && Math.abs(unix - prev) > 300) {
      kvsGet("cc:tadj", function (t) {
        let a = parseOr(t, []);
        a.push([prev, unix]);
        while (a.length > TADJ_MAX) a.splice(0, 1);
        Shelly.call("KVS.Set", {key: "cc:tadj", value: JSON.stringify(a)});
      });
    }
  });
});
