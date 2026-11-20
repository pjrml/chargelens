// ChargeLens Meter v1.0.0
function cfgNum() {
let t = "r,0.1,0.02,1;g,5,1,11;y,11,1,12;h,0.3,0.05,1;hr,0.05,0.01,0.5;hs,10,2,60;sg,600,60,3600;p,0,0,10;lo,1,0,1;lb,50,5,100".split(";");
let out = [], i, p;
for (i = 0; i < t.length; i++) { p = t[i].split(","); out.push([p[0], Number(p[1]), Number(p[2]), Number(p[3])]); }
return out;
}
let cfgX = null;
function cfgFix(o) {
let T = cfgNum(), c = {v: 1}, i, a, x;
if (typeof o !== "object" || o === null) o = {};
for (i = 0; i < T.length; i++) {
a = T[i]; x = o[a[0]];
c[a[0]] = (typeof x === "number" && x >= a[2] && x <= a[3]) ? x : a[1];
}
if (!(c.r < c.g && c.g < c.y)) { c.r = T[0][1]; c.g = T[1][1]; c.y = T[2][1]; }
return cfgX ? cfgX(c, o) : c;
}
function cfgParse(text) {
let o = null;
try { o = JSON.parse(text); } catch (e) { o = null; }
return cfgFix(o);
}
let CLOCK_MIN = 1700000000;
let ADJ_MAX = 8;
let MAX_MONTHS = 6;
function r3(x) { return Math.round(x * 1000) / 1000; }
function pad2(n) { return (n < 10 ? "0" : "") + String(n); }
function civil(days) {
let z = days + 719468;
let era = (z - z % 146097) / 146097;
let doe = z - era * 146097;
let a = (doe - doe % 1460) / 1460;
let b = (doe - doe % 36524) / 36524;
let c = (doe - doe % 146096) / 146096;
let n = doe - a + b - c;
let yoe = (n - n % 365) / 365;
let doy = doe - 365 * yoe - (yoe - yoe % 4) / 4 + (yoe - yoe % 100) / 100;
let t5 = 5 * doy + 2;
let mp = (t5 - t5 % 153) / 153;
let t153 = 153 * mp + 2;
let d = doy - (t153 - t153 % 5) / 5 + 1;
let m = mp < 10 ? mp + 3 : mp - 9;
let y = yoe + era * 400 + (m <= 2 ? 1 : 0);
return {y: y, m: m, d: d};
}
function dayKey(localUnix) {
let c = civil(Math.floor(localUnix / 86400));
return String(c.y) + pad2(c.m) + pad2(c.d);
}
function parseMonth(str) {
if (!str) return null;
let p = str.split("|");
let days = [];
if (p.length > 1 && p[1].length > 0) {
let a = p[1].split(","); let i;
for (i = 0; i < a.length; i++) days.push(parseInt(a[i], 10));
}
return {s: parseInt(p[0], 10), days: days};
}
function fmtMonth(m) { return String(m.s) + "|" + m.days.join(","); }
function computeDelta(total, last, maxWh) {
if (total >= last) {
let d = r3(total - last);
if (d > maxWh) return {d: 0, code: "s", x: Math.round(d)};
return {d: d, code: ""};
}
if (total <= maxWh) return {d: r3(total), code: ""};
return {d: 0, code: "b", x: Math.round(last - total)};
}
function splitPending(wh, bootLocal, nowLocal) {
let out = [];
if (!(wh > 0)) return out;
if (nowLocal <= bootLocal) { out.push([dayKey(nowLocal), wh]); return out; }
let t = bootLocal; let span = nowLocal - bootLocal;
while (t < nowLocal) {
let end = Math.floor(t / 86400) * 86400 + 86400;
if (end > nowLocal) end = nowLocal;
out.push([dayKey(t), r3(wh * (end - t) / span)]);
t = end;
}
return out;
}
function pushAdj(adj, dk, wh, code) {
adj.push([dk, wh, code]);
while (adj.length > ADJ_MAX) adj.splice(0, 1);
}
function addDay(st, month, dk, wh) {
let idx = parseInt(dk.slice(6), 10) - 1;
while (month.days.length <= idx) month.days.push(0);
if (dk === st.dk) {
st.dw = r3(st.dw + wh);
month.days[idx] = Math.round(st.dw);
} else {
month.days[idx] = month.days[idx] + Math.round(wh);
}
}
function excessOldest(names, max) {
let rest = names.slice(0); let out = [];
while (rest.length > max) {
let mi = 0; let i;
for (i = 1; i < rest.length; i++) if (rest[i] < rest[mi]) mi = i;
out.push(rest[mi]);
rest.splice(mi, 1);
}
return out;
}
function capDeletes(names, newKey, max) {
let all = names.slice(0); let i; let present = false;
for (i = 0; i < all.length; i++) if (all[i] === newKey) present = true;
if (!present) all.push(newKey);
let del = excessOldest(all, max); let out = [];
for (i = 0; i < del.length; i++) if (del[i] !== newKey) out.push(del[i]);
return out;
}
function monthDeletes(names, newMonth, maxMonths) {
if (!(maxMonths > 0)) return [];
let ms = []; let i; let j;
for (i = 0; i < names.length; i++) if (names[i].slice(0, 5) === "cc:m:") ms.push(names[i]);
let del = capDeletes(ms, "cc:m:" + newMonth, maxMonths); let out = [];
for (i = 0; i < del.length; i++) {
out.push(del[i]);
let p = "cc:s:" + del[i].slice(5);
for (j = 0; j < names.length; j++) {
let n = names[j];
if (n === p || n === p + "-2" || n === p + "-3") out.push(n);
}
}
let keep = "cc:m:" + newMonth;
for (i = 0; i < ms.length; i++) if (out.indexOf(ms[i]) < 0 && ms[i] < keep) keep = ms[i];
for (j = 0; j < names.length; j++) {
let n = names[j];
if (n.slice(0, 5) === "cc:s:" && "cc:m:" + n.slice(5, 11) < keep && out.indexOf(n) < 0) out.push(n);
}
return out;
}
function monthLoadAction(err, value) {
if (!err) return value ? "use" : "new";
return err === -105 ? "new" : "skip";
}
function tickElapsed(lastTickUp, up) {
if (lastTickUp < 0) return up > 120 ? up : 120;
return up - lastTickUp;
}
function shouldPersist(unsavedWh, secsSinceSave, forced) {
if (forced) return true;
return unsavedWh > 0 && (unsavedWh >= 10 || secsSinceSave >= 3600);
}
function isRealBoot(up, savedU) {
return typeof savedU !== "number" || up < savedU || (up < 120 && savedU < 120);
}
function migrate(st, fresh) {
if (fresh) { st.sv = 1; return {st: st, legacy: false}; }
return {st: st, legacy: st.sv === undefined};
}
function pruneMax(st) { return st.sv >= 1 ? MAX_MONTHS : 0; }
function ledCfg(c) { return {r: c.r, g: c.g, y: c.y, h: c.h, hr: c.hr, hs: c.hs, lo: c.lo, lb: c.lb}; }
function stamp(unix, n, up) {
if (unix > CLOCK_MIN) return unix;
return "~" + String(n) + "." + String(Math.floor(up));
}
function parseBoots(s) {
let out = [];
if (!s) return out;
let a = s.split(";"); let i;
for (i = 0; i < a.length; i++) {
let p = a[i].split(":");
if (p.length === 3) out.push([parseInt(p[0], 10), parseInt(p[1], 10), p[2]]);
}
return out;
}
function fmtBoots(list) {
let a = []; let i;
for (i = 0; i < list.length; i++) a.push(String(list[i][0]) + ":" + String(list[i][1]) + ":" + list[i][2]);
let s = a.join(";");
while (s.length > 253) { a.splice(0, 1); s = a.join(";"); }
return s;
}
function addBoot(list, n, bootUnix, src) {
let out = []; let i;
for (i = 0; i < list.length; i++) if (list[i][0] !== n) out.push(list[i]);
out.push([n, bootUnix, src]);
return out;
}
function bootUnixOf(boots, n) {
let i;
for (i = 0; i < boots.length; i++) if (boots[i][0] === n) return boots[i][1];
return null;
}
function splitStamp(st) {
if (typeof st !== "string" || st.slice(0, 1) !== "~") return null;
let p = st.slice(1).split(".");
return [parseInt(p[0], 10), parseInt(p[1], 10)];
}
function stateJson(st) {
let o = {}; let k;
for (k in st) if (k !== "ss") o[k] = st[k];
return JSON.stringify(o);
}
function recKeys(mk) { return ["cc:s:" + mk, "cc:s:" + mk + "-2"]; }
function addFlag(f, c) { return f.indexOf(c) >= 0 ? f : f + c; }
function sessRec(ss, endUp, endC, f) {
let m = Math.round((endUp - ss.su) / 60);
return {s: ss.s, min: m > 0 ? m : 0, wh: Math.round(endC - ss.c - ss.x), f: f};
}
function sessBand(ss, b, ctx) {
if (!ss) {
if (b !== 2) return {ss: null, closed: null};
return {ss: {s: ctx.stamp, su: ctx.up, c: ctx.c, g: 0, gc: 0, x: 0, f: ""}, closed: null};
}
if (b === 2) { ss.g = 0; return {ss: ss, closed: null}; }
if (ss.g === 0) { ss.g = ctx.up > 0 ? ctx.up : 1; ss.gc = ctx.c; }
if (b === 3) ss.f = addFlag(ss.f, "y");
if (b === 1) ss.f = addFlag(ss.f, "r");
return {ss: ss, closed: null};
}
function sessTick(ss, up, gap) {
if (ss && ss.g > 0 && up - ss.g >= gap) return {ss: null, closed: sessRec(ss, ss.g, ss.gc, ss.f)};
return {ss: ss, closed: null};
}
function sessSpike(ss, wh) { if (ss) ss.x = ss.x + wh; return ss; }
function sessBootClose(ss, lastHb, lastHbUp, c) {
if (!ss) return null;
if (ss.g > 0) return sessRec(ss, ss.g, ss.gc, ss.f);
return sessRec(ss, lastHbUp, c, addFlag(ss.f, "p"));
}
function fmtRec(rec, off) {
let h; let p = splitStamp(rec.s);
if (p) { h = String(p[0]) + "," + String(p[1]); } else {
let l = rec.s + off; let sd = l % 86400;
h = dayKey(l).slice(6) + "," + pad2((sd - sd % 3600) / 3600) + pad2(((sd % 3600) - sd % 60) / 60);
}
return h + "," + String(rec.min) + "," + String(rec.wh) + (rec.f ? "," + rec.f : "");
}
function recMonth(rec, off) {
if (splitStamp(rec.s)) return null;
return dayKey(rec.s + off).slice(0, 6);
}
function appendRec(value, line) {
let v = value ? value + ";" + line : line;
return v.length > 253 ? null : v;
}
function fmtEv(type, st, extra) { return type + "," + String(st) + (extra ? "," + extra : ""); }
function ringNext(idx, size) { return (idx + 1) % size; }
function evPush(value, line) {
let v = appendRec(value, line);
return v === null ? {value: line, full: true} : {value: v, full: false};
}
function lossEstimate(hbVals, n, prevUndated) {
let bu = null; let bt = null; let bup = -1; let i;
for (i = 0; i < hbVals.length; i++) {
let v = hbVals[i];
if (!v) continue;
let p = splitStamp(v);
if (p) { if (p[0] === n - 1 && p[1] > bup) { bup = p[1]; bt = v; } } else {
let x = parseInt(v, 10);
if (bu === null || x > bu) bu = x;
}
}
if (!prevUndated && bu !== null) return bu;
return bt;
}
function suTake(value, n, bootUnix) {
let recs = []; let rest = []; let t = 0;
if (value) {
let a = value.split(";"); let i;
for (i = 0; i < a.length; i++) {
let p = a[i].split(",");
if (parseInt(p[0], 10) === n && p[1] === "T") t = t + parseInt(p[3], 10);
else if (parseInt(p[0], 10) === n) {
recs.push({s: bootUnix + parseInt(p[1], 10), min: parseInt(p[2], 10), wh: parseInt(p[3], 10), f: p.length > 4 ? p[4] : ""});
} else rest.push(a[i]);
}
}
return {recs: recs, rest: rest.length ? rest.join(";") : null, t: t};
}
function suAddT(value, n, wh) {
let a = value ? value.split(";") : []; let i;
for (i = 0; i < a.length; i++) {
let p = a[i].split(",");
if (p[1] === "T" && parseInt(p[0], 10) === n) { a[i] = String(n) + ",T,0," + String(parseInt(p[3], 10) + wh); return a.join(";"); }
}
a.push(String(n) + ",T,0," + String(wh));
return a.join(";");
}
function suDate(value, n, up, day) {
if (!value) return null;
let a = value.split(";"); let si = -1; let ti = -1; let ns = 0; let i;
for (i = 0; i < a.length; i++) {
let p = a[i].split(",");
if (parseInt(p[0], 10) !== n) continue;
if (p[1] === "T") ti = i; else { ns++; if (p[1] === up) si = i; }
}
let t = ti >= 0 ? parseInt(a[ti].split(",")[3], 10) : 0;
let wh = 0; let line = null;
if (up === "T") {
if (ti < 0 || ns > 0) return null;
wh = t; t = 0;
} else {
if (si < 0) return null;
let q = a[si].split(",");
wh = parseInt(q[3], 10);
line = day.slice(6) + ",~" + String(n) + "." + q[1] + "," + q[2] + "," + q[3] + "," + (q.length > 4 ? q[4] : "") + "d";
t = t - wh; if (t < 0) t = 0;
if (ns === 1) { wh = wh + t; t = 0; }
}
let rest = [];
for (i = 0; i < a.length; i++) {
if (i === si) continue;
if (i === ti) { if (t > 0) rest.push(String(n) + ",T,0," + String(t)); continue; }
rest.push(a[i]);
}
return {wh: wh, line: line, rest: rest.length ? rest.join(";") : null};
}
function validDay(day, todayKey) {
if (typeof day !== "string" || day.length !== 8 || isNaN(Number(day))) return false;
let y = parseInt(day.slice(0, 4), 10); let m = parseInt(day.slice(4, 6), 10); let d = parseInt(day.slice(6), 10);
let dim = [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
if (m < 1 || m > 12 || d < 1 || d > dim[m - 1]) return false;
return day <= todayKey;
}
function applyTick(st, month, total, unix, off, up, adj, maxWh) {
let dl = computeDelta(total, st.c, maxWh);
let d = dl.d;
st.c = total;
st.o = r3(st.o + d);
let res = {changed: d > 0, month: month, created: false, adjChanged: false, d: d, forced: false,
sx: dl.code === "s" ? dl.x : 0};
if (!(unix > CLOCK_MIN)) {
st.pb = r3(st.pb + d);
if (dl.code) { pushAdj(adj, "00000000", dl.x, dl.code); res.adjChanged = true; res.changed = true; res.forced = true; }
return res;
}
let local = unix + off;
let dk = dayKey(local);
let mk = dk.slice(0, 6);
if (!month || month.k !== mk) {
month = {k: mk, s: Math.round(st.o - d - st.pb - st.po), days: []};
res.created = true; res.changed = true; res.forced = true;
}
res.month = month;
if (st.dk !== dk) {
st.dk = dk;
let i0 = parseInt(dk.slice(6), 10) - 1;
st.dw = month.days[i0] || 0;
}
if (dl.code) { pushAdj(adj, dk, dl.x, dl.code); res.adjChanged = true; res.changed = true; res.forced = true; }
if (st.pb > 0) {
let parts = splitPending(st.pb, local - up, local); let i;
for (i = 0; i < parts.length; i++) {
if (parts[i][0].slice(0, 6) === mk) {
addDay(st, month, parts[i][0], parts[i][1]);
} else {
addDay(st, month, mk + "01", parts[i][1]);
pushAdj(adj, parts[i][0], Math.round(parts[i][1]), "m"); res.adjChanged = true;
}
}
st.pb = 0; res.changed = true; res.forced = true;
}
if (d > 0) addDay(st, month, dk, d);
st.t = unix;
return res;
}
let SWITCH_ID = 0;
let TICK_MS = 60000;
let FIRST_TICK_MS = 5000;
let MAX_W = 4000;
let HB_MS = 600000;
let cfg = cfgParse(null), cfgTag = null;
let st = null, month = null, adj = [];
let lastTickUp = -1;
let unsaved = 0, lastSaveUp = 0;
let q = [], busy = false;
let rq = [], rbusy = false;
function pump() {
if (busy || q.length === 0) return;
busy = true;
let job = q.splice(0, 1)[0];
Shelly.call(job[0], job[1], function (r, err, msg) {
if (err) print("meter: " + job[0] + " failed: " + String(msg));
busy = false;
pump();
});
}
function kvsSet(key, value) {
let i;
for (i = 0; i < q.length; i++) {
if (q[i][0] === "KVS.Set" && q[i][1].key === key) { q[i][1].value = value; return; }
}
q.push(["KVS.Set", {key: key, value: value}]);
pump();
}
let ssJson = "";
function saveState() {
st.u = Math.floor(Shelly.getComponentStatus("sys").uptime);
kvsSet("cc:state", stateJson(st));
let j = JSON.stringify(st.ss || null);
if (j !== ssJson) { kvsSet("cc:ss", j); ssJson = j; }
}
function saveAll() {
if (month) kvsSet("cc:m:" + month.k, fmtMonth(month));
saveState(); unsaved = 0; lastSaveUp = Shelly.getComponentStatus("sys").uptime;
}
function now() {
let sys = Shelly.getComponentStatus("sys");
return {unix: (typeof sys.unixtime === "number") ? sys.unixtime : 0,
off: (typeof sys.utc_offset === "number") ? sys.utc_offset : 0, up: sys.uptime, sync: sys.last_sync_ts};
}
function rqPush(fn) { rq.push(fn); rqNext(); }
function rqNext() {
if (rbusy || rq.length === 0) return;
rbusy = true;
rq.splice(0, 1)[0](function () { rbusy = false; rqNext(); });
}
function appendTo(keys, line, i, done) {
Shelly.call("KVS.Get", {key: keys[i]}, function (r, err) {
if (err && err !== -105) { Timer.set(5000, false, function () { appendTo(keys, line, i, done); }); return; }
let old = (!err && r) ? r.value : null;
let v = appendRec(old, line);
if (v === null && i + 1 < keys.length) { appendTo(keys, line, i + 1, done); return; }
if (v === null) {
st.l = (st.l || 0) + 1;
let a = old.split(";");
while (a.length && appendRec(a.join(";"), line) === null) a.splice(0, 1);
v = appendRec(a.length ? a.join(";") : null, line);
}
Shelly.call("KVS.Set", {key: keys[i], value: v}, function (rr, e2) { if (e2) st.l = (st.l || 0) + 1; done(); });
});
}
function saveRec(rec) {
let t = now();
let mk = recMonth(rec, t.off);
let line = fmtRec(rec, t.off);
let keys = mk ? recKeys(mk) : ["cc:su"];
rqPush(function (done) { appendTo(keys, line, 0, done); });
}
function dateThisBoot(t) {
let bu = Math.floor(t.unix - t.up);
let src = (typeof t.sync === "number" && t.sync >= bu) ? "s" : "p";
let n = st.n; let p;
st.nb = true;
if (st.ss) {
p = splitStamp(st.ss.s); if (p && p[0] === n) st.ss.s = bu + p[1];
}
saveAll();
rqPush(function (done) {
Shelly.call("KVS.Get", {key: "cc:boot"}, function (r, err) {
if (err && err !== -105) { done(); return; }
let v = fmtBoots(addBoot(parseBoots(!err && r ? r.value : null), n, bu, src));
Shelly.call("KVS.Set", {key: "cc:boot", value: v}, function () { done(); });
});
});
rqPush(function (done) {
Shelly.call("KVS.Get", {key: "cc:su"}, function (r, err) {
let x = suTake(!err && r ? r.value : null, n, bu); let i;
if (x.t > 0) { st.po = r3(st.po - x.t); if (st.po < 0) st.po = 0; st.pb = r3(st.pb + x.t); }
if (x.recs.length === 0 && x.t === 0) { done(); return; }
for (i = 0; i < x.recs.length; i++) saveRec(x.recs[i]);
suSave(x.rest, done);
});
});
}
function logEv(line) {
rqPush(function (done) {
if (st.ei === undefined) st.ei = 0;
Shelly.call("KVS.Get", {key: "cc:ev" + String(st.ei)}, function (r, err) {
if (err && err !== -105) { done(); return; }
let p = evPush(!err && r ? r.value : null, line);
if (p.full) st.ei = ringNext(st.ei, 3);
Shelly.call("KVS.Set", {key: "cc:ev" + String(st.ei), value: p.value}, function () { saveAll(); done(); });
});
});
}
function heartbeat() {
let t = now();
if (st.hi === undefined) st.hi = 0;
kvsSet("cc:hb" + String(st.hi), String(stamp(t.unix, st.n, t.up)));
st.hi = ringNext(st.hi, 3);
}
Shelly.addStatusHandler(function (e) {
if (!st || !e || e.component !== "switch:" + SWITCH_ID || !e.delta || typeof e.delta.output !== "boolean") return;
let t = now();
if (!e.delta.output && st.ss) st.ss.f = addFlag(st.ss.f, "o");
logEv(fmtEv("R", stamp(t.unix, st.n, t.up), (e.delta.output ? "1/" : "0/") + (e.delta.source || "?")));
});
function newBoot(total, cb) {
Shelly.call("KVS.GetMany", {match: "cc:hb*"}, function (r, err) {
let hb = []; let i;
if (!err && r && r.items) for (i = 0; i < r.items.length; i++) hb.push(r.items[i].value);
Shelly.call("KVS.Get", {key: "cc:boot"}, function (r2, err2) {
let pn = st.n;
let pb = bootUnixOf(parseBoots(!err2 && r2 ? r2.value : null), pn);
let le = lossEstimate(hb, pn + 1, pb === null);
let hu = -1; let p = splitStamp(le);
if (p) hu = p[1]; else if (le !== null && pb !== null) hu = le - pb;
let lu = (st.u || 0) > hu ? (st.u || 0) : hu;
let rec = sessBootClose(st.ss, null, lu, total);
st.n = pn + 1; st.nb = false; st.ss = null;
if (rec) saveRec(rec);
let t = now();
let rr = Shelly.getComponentStatus("sys").reset_reason;
logEv(fmtEv("B", stamp(t.unix, st.n, t.up), (rr === undefined ? "?" : String(rr)) + "/" +
(pb === null ? "~" + String(pn) + "." + String(lu) : String(pb + lu))));
saveState();
cb();
});
});
}
function pushLine(keys, line) { rqPush(function (done) { appendTo(keys, line, 0, done); }); }
function suSave(v, done) {
if (v) Shelly.call("KVS.Set", {key: "cc:su", value: v}, function () { done(); });
else Shelly.call("KVS.Delete", {key: "cc:su"}, function () { done(); });
}
function onDate(n, up, day) {
let t = now();
if (!(t.unix > CLOCK_MIN) || !validDay(day, dayKey(t.unix + t.off))) return;
let mk = day.slice(0, 6);
rqPush(function (done) {
Shelly.call("KVS.Get", {key: "cc:su"}, function (r, err) {
let x = (!err && r) ? suDate(r.value, n, String(up), day) : null;
if (!x) { done(); return; }
function fin() {
st.po = r3(st.po - x.wh); if (st.po < 0) st.po = 0;
if (x.line) pushLine(recKeys(mk), x.line);
saveAll();
suSave(x.rest, done);
}
if (month && month.k === mk) { addDay(st, month, day, x.wh); fin(); return; }
Shelly.call("KVS.Get", {key: "cc:m:" + mk}, function (rm, em) {
if (em && em !== -105) { done(); return; }
let m = (!em && rm) ? parseMonth(rm.value) : {s: 0, days: []};
addDay(st, m, day, x.wh);
Shelly.call("KVS.Set", {key: "cc:m:" + mk, value: fmtMonth(m)}, function () { fin(); });
});
});
});
}
function onBand(b) {
let t = now();
let sw = Shelly.getComponentStatus("switch:" + SWITCH_ID);
let had = st.ss;
let r = sessBand(st.ss, b, {stamp: stamp(t.unix, st.n, t.up), up: t.up, c: sw.aenergy.total});
st.ss = r.ss;
if (had || r.ss) saveAll();
}
function cfgPoll() {
Shelly.call("KVS.Get", {key: "cc:cfg"}, function (r, err) {
if (err && err !== -105) return;
let tag = err ? "-" : (r.etag || r.value);
if (tag === cfgTag) return;
cfgTag = tag;
cfg = cfgParse(err ? null : r.value);
print("meter: cfg changed, session gap " + String(cfg.sg));
Shelly.emitEvent("cc_cfg", ledCfg(cfg));
});
}
Shelly.addEventHandler(function (e) {
if (e && e.info && e.info.event === "cc_cfgq") Shelly.emitEvent("cc_cfg", ledCfg(cfg));
if (!st || !e || !e.info || !e.info.data) return;
if (e.info.event === "cc_band") onBand(e.info.data.b);
else if (e.info.event === "cc_date") onDate(e.info.data.n, e.info.data.u, e.info.data.day);
});
function writeTick(r) {
function writes() {
if (month) kvsSet("cc:m:" + month.k, fmtMonth(month));
saveState();
if (r.adjChanged) kvsSet("cc:adj", JSON.stringify(adj));
}
if (!r.created) { writes(); return; }
Shelly.call("KVS.List", {match: "cc:*"}, function (lr, lerr) {
if (!lerr && lr && lr.keys) {
let names = []; let k;
for (k in lr.keys) names.push(k);
let del = monthDeletes(names, month.k, pruneMax(st)); let i;
for (i = 0; i < del.length; i++) q.push(["KVS.Delete", {key: del[i]}]);
}
writes();
});
}
function ensureMonth(mk, cb) {
if (month && month.k === mk) { cb(true); return; }
Shelly.call("KVS.Get", {key: "cc:m:" + mk}, function (r, err) {
let act = monthLoadAction(err, (!err && r) ? r.value : null);
if (act === "skip") { cb(false); return; }
if (act === "use") { let m = parseMonth(r.value); m.k = mk; month = m; }
cb(true);
});
}
function tick() {
let sys = Shelly.getComponentStatus("sys");
let sw = Shelly.getComponentStatus("switch:" + SWITCH_ID);
if (!sys || !sw || !sw.aenergy) return;
cfgPoll();
let unix = (typeof sys.unixtime === "number") ? sys.unixtime : 0;
let off = (typeof sys.utc_offset === "number") ? sys.utc_offset : 0;
let up = sys.uptime;
if (lastTickUp < 0) Shelly.emitEvent("cc_ask", {});
let maxWh = MAX_W * tickElapsed(lastTickUp, up) / 3600 + 10;
let total = sw.aenergy.total;
function run(ok) {
if (!ok) return;
lastTickUp = up;
let r = applyTick(st, month, total, unix, off, up, adj, maxWh);
month = r.month;
unsaved = r3(unsaved + r.d);
if (r.sx) st.ss = sessSpike(st.ss, r.sx);
let sr = cfgTag === null ? {ss: st.ss, closed: null} : sessTick(st.ss, up, cfg.sg);
if (sr.closed) { st.ss = null; saveRec(sr.closed); r.changed = true; r.forced = true; }
if (unix > CLOCK_MIN && !st.nb) dateThisBoot({unix: unix, up: up, sync: sys.last_sync_ts});
if (r.changed && shouldPersist(unsaved, up - lastSaveUp, r.forced)) {
writeTick(r); unsaved = 0; lastSaveUp = up;
}
}
if (unix > CLOCK_MIN) ensureMonth(dayKey(unix + off).slice(0, 6), run);
else run(true);
}
function startTimers() {
lastSaveUp = Shelly.getComponentStatus("sys").uptime;
Timer.set(FIRST_TICK_MS, false, tick);
Timer.set(TICK_MS, true, tick);
Timer.set(HB_MS, true, heartbeat);
}
function start(total) {
Shelly.call("KVS.Get", {key: "cc:adj"}, function (r, err) {
if (monthLoadAction(err, null) === "skip") { Timer.set(5000, false, function () { start(total); }); return; }
if (!err && r && r.value) { try { adj = JSON.parse(r.value); } catch (e) { adj = []; } }
Shelly.call("KVS.Get", {key: "cc:state"}, function (r2, err2) {
if (monthLoadAction(err2, null) === "skip") { Timer.set(5000, false, function () { start(total); }); return; }
let s = null;
if (!err2 && r2 && r2.value) { try { s = JSON.parse(r2.value); } catch (e) { s = null; } }
let fresh = !s;
if (!s) s = {c: total, o: 0, t: 0, pb: 0, po: 0, dk: "", dw: 0};
let pw = Math.round(s.pb || 0); let pn = s.n || 0;
if (pw > 0) s.po = r3(s.po + s.pb);
s.pb = 0;
Shelly.call("KVS.Get", {key: "cc:ss"}, function (rs, es) {
if (es && es !== -105) { Timer.set(5000, false, function () { start(total); }); return; }
if (!es && rs && rs.value) { try { s.ss = JSON.parse(rs.value); } catch (e) { s.ss = null; } }
st = s;
if (st.n === undefined) { st.n = 0; st.nb = false; }
if (st.ss === undefined) st.ss = null;
let mg = migrate(st, fresh);
function go() {
if (mg.legacy) { let t2 = now(); logEv(fmtEv("L", stamp(t2.unix, st.n, t2.up))); }
startTimers();
}
if (pw > 0) rqPush(function (done) {
Shelly.call("KVS.Get", {key: "cc:su"}, function (ru, eu) { suSave(suAddT(!eu && ru ? ru.value : null, pn, pw), done); });
});
let t = now();
if (isRealBoot(t.up, st.u)) newBoot(total, go);
else { logEv(fmtEv("U", stamp(t.unix, st.n, t.up))); go(); }
});
});
});
}
let LAUNCH = [["Led", 5000], ["Page", 20000]];
function startChain(q, i, prev) {
if (i >= q.length) return;
Timer.set(q[i][1] - prev, false, function () {
Shelly.call("Script.Start", {id: q[i][0]});
startChain(q, i + 1, q[i][1]);
});
}
function launch() {
Shelly.call("Script.List", {}, function (r, err) {
if (err || !r || !r.scripts) return;
let i, j, q = [];
for (i = 0; i < LAUNCH.length; i++) {
for (j = 0; j < r.scripts.length; j++) {
let s = r.scripts[j];
if (s.name === LAUNCH[i][0] && !s.running) q.push([s.id, LAUNCH[i][1]]);
}
}
startChain(q, 0, 0);
});
}
launch();
let sw0 = Shelly.getComponentStatus("switch:" + SWITCH_ID);
start(sw0 && sw0.aenergy ? sw0.aenergy.total : 0);
