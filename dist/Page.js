// ChargeLens Page v1.0.0-rc.9
let V = 1700000000;
let aa = 5;
function A(f, O) {
let y = f.query || "";
let G = O + "="; let D = y.indexOf(G);
if (D < 0) return null;
let d = y.slice(D + G.length);
let j = d.indexOf("&");
return j >= 0 ? d.slice(0, j) : d;
}
function H(b, ab, ac, ad) {
b.code = ab;
b.headers = [["Content-Type", ac], ["Cache-Control", "no-store"]];
b.body = ad;
b.send();
}
function E(b, ae) { H(b, 200, "application/json", JSON.stringify(ae)); }
function z(O, L) {
Shelly.call("KVS.Get", {key: O}, function (B, I) { L((!I && B) ? B.value : null); });
}
function J(d, W) {
if (!d) return W;
try { return JSON.parse(d); } catch (aj) { return W; }
}
function X(P, x, L) {
if (x.length >= P.length) { L(x); return; }
z(P[x.length], function (d) { x.push(d); X(P, x, L); });
}
function Y(g) { return g !== null && g.length === 6 && !isNaN(Number(g)); }
HTTPServer.registerEndpoint("ui", function (f, b) {
H(b, 200, "text/html; charset=utf-8", "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">" +
"<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">" +
"<meta name=\"apple-mobile-web-app-capable\" content=\"yes\"><meta name=\"apple-mobile-web-app-title\" content=\"ChargeLens\">" +
"<title>ChargeLens</title></head><body style=\"background:#0b1221;color:#94a3b8;font-family:sans-serif\">Loading...<script>" +
"(async function(){var g=async function(u){return (await fetch(u)).json()};" +
"var L=await g('/rpc/Script.List'),id=-1,i,n=location.search.indexOf('p=setup')>=0?'SetupHtml':'PageHtml';for(i=0;i<L.scripts.length;i++)if(L.scripts[i].name==n)id=L.scripts[i].id;" +
"var h='',o=0,r;do{r=await g('/rpc/Script.GetCode?id='+id+'&offset='+o);h+=r.data;o+=r.data.length}while(r.left>0&&r.data.length);" +
"document.open();document.write(h);document.close()})()</script></body></html>");
});
HTTPServer.registerEndpoint("data", function (f, b) {
let F = Shelly.getComponentStatus("switch:0");
let Q = Shelly.getComponentStatus("sys");
z("cc:state", function (R) {
let h = J(R, null);
if (!h) h = {c: 0, o: 0, t: 0, pb: 0, po: 0, dk: "", dw: 0};
let g = A(f, "m");
if (!Y(g)) g = h.dk ? h.dk.slice(0, 6) : "";
let x = {w: F.apower, a: F.current, v: F.voltage, on: F.output, e: F.aenergy.total,
unix: Q.unixtime || 0, off: Q.utc_offset || 0, up: Q.uptime, st: h, k: g, m: "", er: F.errors || []};
if (!g) { E(b, x); return; }
z("cc:m:" + g, function (af) { x.m = af || ""; E(b, x); });
});
});
HTTPServer.registerEndpoint("log", function (f, b) {
z("cc:state", function (R) {
let h = J(R, {});
let g = A(f, "m");
if (!Y(g)) g = h.dk ? h.dk.slice(0, 6) : "";
let D = "cc:s:" + g;
X([D, D + "-2", D + "-3", "cc:su", "cc:ev0", "cc:ev1", "cc:ev2", "cc:boot", "cc:hb0", "cc:hb1", "cc:hb2"], [],
function (d) {
let y = []; let K;
for (K = 0; K < 3; K++) if (d[K] !== null) y.push(d[K]);
E(b, {k: g, s: y, su: d[3], ev: [d[4], d[5], d[6]], ei: h.ei || 0, boot: d[7], hb: [d[8], d[9], d[10]],
n: h.n || 0, l: h.l || 0});
});
});
});
HTTPServer.registerEndpoint("list", function (f, b) {
Shelly.call("KVS.List", {match: "cc:m:*"}, function (B, I) {
let Z = []; let G;
if (!I && B && B.keys) for (G in B.keys) Z.push(G.slice(5));
z("cc:adj", function (j) {
z("cc:tadj", function (S) {
E(b, {months: Z, adj: J(j, []), tadj: J(S, [])});
});
});
});
});
function ag(f, b) {
let T = parseInt(A(f, "boot"), 10); let M = A(f, "day"); let U = A(f, "up");
z("cc:su", function (d) {
let ah = !isNaN(T) && U !== null && M !== null && M.length === 8 && !isNaN(Number(M)) && d !== null &&
(";" + d).indexOf(";" + String(T) + "," + U + ",") >= 0;
if (!ah) { H(b, 400, "text/plain", "use time?boot=N&up=UP|T&day=YYYYMMDD (an undated item)"); return; }
Shelly.emitEvent("cc_date", {n: T, u: U, day: M});
E(b, {ok: true});
});
}
HTTPServer.registerEndpoint("time", function (f, b) {
if (A(f, "boot") !== null) { ag(f, b); return; }
let y = A(f, "set");
let C = y === null ? NaN : Number(y);
if (isNaN(C) || C < V) { H(b, 400, "text/plain", "use time?set=<unix>"); return; }
C = Math.floor(C);
let N = Shelly.getComponentStatus("sys").unixtime || 0;
Shelly.call("Sys.SetTime", {unixtime: C}, function (B, I, ai) {
if (I) { H(b, 500, "text/plain", "SetTime failed: " + String(ai)); return; }
E(b, {ok: true, prev: N});
if (N > V && Math.abs(C - N) > 300) {
z("cc:tadj", function (S) {
let j = J(S, []);
j.push([N, C]);
while (j.length > aa) j.splice(0, 1);
Shelly.call("KVS.Set", {key: "cc:tadj", value: JSON.stringify(j)});
});
}
});
});
