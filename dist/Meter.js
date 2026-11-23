// ChargeLens Meter v1.0.0-rc.9
function cx() {
let D = "r,0.1,0.02,1;g,5,1,11;y,11,1,12;h,0.3,0.05,1;hr,0.05,0.01,0.5;hs,10,2,60;sg,600,60,3600;p,0,0,10;lo,1,0,1;lb,50,5,100".split(";");
let K = [], w, B;
for (w = 0; w < D.length; w++) { B = D[w].split(","); K.push([B[0], Number(B[1]), Number(B[2]), Number(B[3])]); }
return K;
}
let bS = null;
function cy(ah) {
let aL = cx(), J = {v: 1}, w, E, L;
if (typeof ah !== "object" || ah === null) ah = {};
for (w = 0; w < aL.length; w++) {
E = aL[w]; L = ah[E[0]];
J[E[0]] = (typeof L === "number" && L >= E[2] && L <= E[3]) ? L : E[1];
}
if (!(J.r < J.g && J.g < J.y)) { J.r = aL[0][1]; J.g = aL[1][1]; J.y = aL[2][1]; }
return bS ? bS(J, ah) : J;
}
function bT(cz) {
let ah = null;
try { ah = JSON.parse(cz); } catch (P) { ah = null; }
return cy(ah);
}
let aM = 1700000000;
let cA = 8;
let cB = 6;
function ak(L) { return Math.round(L * 1000) / 1000; }
function aX(F) { return (F < 10 ? "0" : "") + String(F); }
function cC(aY) {
let bh = aY + 719468;
let bU = (bh - bh % 146097) / 146097;
let aq = bh - bU * 146097;
let E = (aq - aq % 1460) / 1460;
let ar = (aq - aq % 36524) / 36524;
let J = (aq - aq % 146096) / 146096;
let F = aq - E + ar - J;
let aA = (F - F % 365) / 365;
let bV = aq - 365 * aA - (aA - aA % 4) / 4 + (aA - aA % 100) / 100;
let bW = 5 * bV + 2;
let aZ = (bW - bW % 153) / 153;
let bX = 153 * aZ + 2;
let aa = bV - (bX - bX % 5) / 5 + 1;
let X = aZ < 10 ? aZ + 3 : aZ - 9;
let aN = aA + bU * 400 + (X <= 2 ? 1 : 0);
return {y: aN, m: X, d: aa};
}
function aw(cD) {
let J = cC(Math.floor(cD / 86400));
return String(J.y) + aX(J.m) + aX(J.d);
}
function bY(bZ) {
if (!bZ) return null;
let B = bZ.split("|");
let aY = [];
if (B.length > 1 && B[1].length > 0) {
let E = B[1].split(","); let w;
for (w = 0; w < E.length; w++) aY.push(parseInt(E[w], 10));
}
return {s: parseInt(B[0], 10), days: aY};
}
function bi(X) { return String(X.s) + "|" + X.days.join(","); }
function cE(R, bj, aB) {
if (R >= bj) {
let aa = ak(R - bj);
if (aa > aB) return {d: 0, code: "s", x: Math.round(aa)};
return {d: aa, code: ""};
}
if (R <= aB) return {d: ak(R), code: ""};
return {d: 0, code: "b", x: Math.round(bj - R)};
}
function cF(S, bk, aC) {
let K = [];
if (!(S > 0)) return K;
if (aC <= bk) { K.push([aw(aC), S]); return K; }
let D = bk; let cG = aC - bk;
while (D < aC) {
let a0 = Math.floor(D / 86400) * 86400 + 86400;
if (a0 > aC) a0 = aC;
K.push([aw(D), ak(S * (a0 - D) / cG)]);
D = a0;
}
return K;
}
function bl(ai, al, S, cH) {
ai.push([al, S, cH]);
while (ai.length > cA) ai.splice(0, 1);
}
function aO(A, I, al, S) {
let aD = parseInt(al.slice(6), 10) - 1;
while (I.days.length <= aD) I.days.push(0);
if (al === A.dk) {
A.dw = ak(A.dw + S);
I.days[aD] = Math.round(A.dw);
} else {
I.days[aD] = I.days[aD] + Math.round(S);
}
}
function cI(af, bm) {
let ab = af.slice(0); let K = [];
while (ab.length > bm) {
let a1 = 0; let w;
for (w = 1; w < ab.length; w++) if (ab[w] < ab[a1]) a1 = w;
K.push(ab[a1]);
ab.splice(a1, 1);
}
return K;
}
function cJ(af, bn, bm) {
let a2 = af.slice(0); let w; let b0 = false;
for (w = 0; w < a2.length; w++) if (a2[w] === bn) b0 = true;
if (!b0) a2.push(bn);
let am = cI(a2, bm); let K = [];
for (w = 0; w < am.length; w++) if (am[w] !== bn) K.push(am[w]);
return K;
}
function cK(af, b1, b2) {
if (!(b2 > 0)) return [];
let aE = []; let w; let Z;
for (w = 0; w < af.length; w++) if (af[w].slice(0, 5) === "cc:m:") aE.push(af[w]);
let am = cJ(aE, "cc:m:" + b1, b2); let K = [];
for (w = 0; w < am.length; w++) {
K.push(am[w]);
let B = "cc:s:" + am[w].slice(5);
for (Z = 0; Z < af.length; Z++) {
let F = af[Z];
if (F === B || F === B + "-2" || F === B + "-3") K.push(F);
}
}
let bo = "cc:m:" + b1;
for (w = 0; w < aE.length; w++) if (K.indexOf(aE[w]) < 0 && aE[w] < bo) bo = aE[w];
for (Z = 0; Z < af.length; Z++) {
let F = af[Z];
if (F.slice(0, 5) === "cc:s:" && "cc:m:" + F.slice(5, 11) < bo && K.indexOf(F) < 0) K.push(F);
}
return K;
}
function bp(H, Y) {
if (!H) return Y ? "use" : "new";
return H === -105 ? "new" : "skip";
}
function cL(aF, M) {
if (aF < 0) return M > 120 ? M : 120;
return M - aF;
}
function cM(b3, cN, cO) {
if (cO) return true;
return b3 > 0 && (b3 >= 10 || cN >= 3600);
}
function cP(M, bq) {
return typeof bq !== "number" || M < bq || (M < 120 && bq < 120);
}
function cQ(A, br) {
if (br) { A.sv = 1; return {st: A, legacy: false}; }
return {st: A, legacy: A.sv === undefined};
}
function cR(A) { return A.sv >= 1 ? cB : 0; }
function b4(J) { return {r: J.r, g: J.g, y: J.y, h: J.h, hr: J.hr, hs: J.hs, lo: J.lo, lb: J.lb}; }
function aG(aj, F, M) {
if (aj > aM) return aj;
return "~" + String(F) + "." + String(Math.floor(M));
}
function b5(N) {
let K = [];
if (!N) return K;
let E = N.split(";"); let w;
for (w = 0; w < E.length; w++) {
let B = E[w].split(":");
if (B.length === 3) K.push([parseInt(B[0], 10), parseInt(B[1], 10), B[2]]);
}
return K;
}
function cS(at) {
let E = []; let w;
for (w = 0; w < at.length; w++) E.push(String(at[w][0]) + ":" + String(at[w][1]) + ":" + at[w][2]);
let N = E.join(";");
while (N.length > 253) { E.splice(0, 1); N = E.join(";"); }
return N;
}
function cT(at, F, bs, bv) {
let K = []; let w;
for (w = 0; w < at.length; w++) if (at[w][0] !== F) K.push(at[w]);
K.push([F, bs, bv]);
return K;
}
function cU(bw, F) {
let w;
for (w = 0; w < bw.length; w++) if (bw[w][0] === F) return bw[w][1];
return null;
}
function aP(A) {
if (typeof A !== "string" || A.slice(0, 1) !== "~") return null;
let B = A.slice(1).split(".");
return [parseInt(B[0], 10), parseInt(B[1], 10)];
}
function cV(A) {
let ah = {}; let ax;
for (ax in A) if (ax !== "ss") ah[ax] = A[ax];
return JSON.stringify(ah);
}
function b6(W) { return ["cc:s:" + W, "cc:s:" + W + "-2"]; }
function a3(aQ, J) { return aQ.indexOf(J) >= 0 ? aQ : aQ + J; }
function bx(G, cW, cX, aQ) {
let X = Math.round((cW - G.su) / 60);
return {s: G.s, min: X > 0 ? X : 0, wh: Math.round(cX - G.c - G.x), f: aQ};
}
function cY(G, ar, aH) {
if (!G) {
if (ar !== 2) return {ss: null, closed: null};
return {ss: {s: aH.stamp, su: aH.up, c: aH.c, g: 0, gc: 0, x: 0, f: ""}, closed: null};
}
if (ar === 2) { G.g = 0; return {ss: G, closed: null}; }
if (G.g === 0) { G.g = aH.up > 0 ? aH.up : 1; G.gc = aH.c; }
if (ar === 3) G.f = a3(G.f, "y");
if (ar === 1) G.f = a3(G.f, "r");
return {ss: G, closed: null};
}
function cZ(G, M, c0) {
if (G && G.g > 0 && M - G.g >= c0) return {ss: null, closed: bx(G, G.g, G.gc, G.f)};
return {ss: G, closed: null};
}
function c1(G, S) { if (G) G.x = G.x + S; return G; }
function c2(G, dL, c3, J) {
if (!G) return null;
if (G.g > 0) return bx(G, G.g, G.gc, G.f);
return bx(G, c3, J, a3(G.f, "p"));
}
function c4(ac, au) {
let by; let B = aP(ac.s);
if (B) { by = String(B[0]) + "," + String(B[1]); } else {
let b7 = ac.s + au; let a4 = b7 % 86400;
by = aw(b7).slice(6) + "," + aX((a4 - a4 % 3600) / 3600) + aX(((a4 % 3600) - a4 % 60) / 60);
}
return by + "," + String(ac.min) + "," + String(ac.wh) + (ac.f ? "," + ac.f : "");
}
function c5(ac, au) {
if (aP(ac.s)) return null;
return aw(ac.s + au).slice(0, 6);
}
function a5(Y, U) {
let V = Y ? Y + ";" + U : U;
return V.length > 253 ? null : V;
}
function a6(c6, A, b8) { return c6 + "," + String(A) + (b8 ? "," + b8 : ""); }
function b9(aD, c7) { return (aD + 1) % c7; }
function c8(Y, U) {
let V = a5(Y, U);
return V === null ? {value: U, full: true} : {value: V, full: false};
}
function c9(ca, F, da) {
let an = null; let cc = null; let cd = -1; let w;
for (w = 0; w < ca.length; w++) {
let V = ca[w];
if (!V) continue;
let B = aP(V);
if (B) { if (B[0] === F - 1 && B[1] > cd) { cd = B[1]; cc = V; } } else {
let L = parseInt(V, 10);
if (an === null || L > an) an = L;
}
}
if (!da && an !== null) return an;
return cc;
}
function db(Y, F, bs) {
let ce = []; let ab = []; let D = 0;
if (Y) {
let E = Y.split(";"); let w;
for (w = 0; w < E.length; w++) {
let B = E[w].split(",");
if (parseInt(B[0], 10) === F && B[1] === "T") D = D + parseInt(B[3], 10);
else if (parseInt(B[0], 10) === F) {
ce.push({s: bs + parseInt(B[1], 10), min: parseInt(B[2], 10), wh: parseInt(B[3], 10), f: B.length > 4 ? B[4] : ""});
} else ab.push(E[w]);
}
}
return {recs: ce, rest: ab.length ? ab.join(";") : null, t: D};
}
function dc(Y, F, S) {
let E = Y ? Y.split(";") : []; let w;
for (w = 0; w < E.length; w++) {
let B = E[w].split(",");
if (B[1] === "T" && parseInt(B[0], 10) === F) { E[w] = String(F) + ",T,0," + String(parseInt(B[3], 10) + S); return E.join(";"); }
}
E.push(String(F) + ",T,0," + String(S));
return E.join(";");
}
function dd(Y, F, M, ad) {
if (!Y) return null;
let E = Y.split(";"); let a7 = -1; let aR = -1; let bz = 0; let w;
for (w = 0; w < E.length; w++) {
let B = E[w].split(",");
if (parseInt(B[0], 10) !== F) continue;
if (B[1] === "T") aR = w; else { bz++; if (B[1] === M) a7 = w; }
}
let D = aR >= 0 ? parseInt(E[aR].split(",")[3], 10) : 0;
let S = 0; let U = null;
if (M === "T") {
if (aR < 0 || bz > 0) return null;
S = D; D = 0;
} else {
if (a7 < 0) return null;
let Q = E[a7].split(",");
S = parseInt(Q[3], 10);
U = ad.slice(6) + ",~" + String(F) + "." + Q[1] + "," + Q[2] + "," + Q[3] + "," + (Q.length > 4 ? Q[4] : "") + "d";
D = D - S; if (D < 0) D = 0;
if (bz === 1) { S = S + D; D = 0; }
}
let ab = [];
for (w = 0; w < E.length; w++) {
if (w === a7) continue;
if (w === aR) { if (D > 0) ab.push(String(F) + ",T,0," + String(D)); continue; }
ab.push(E[w]);
}
return {wh: S, line: U, rest: ab.length ? ab.join(";") : null};
}
function de(ad, df) {
if (typeof ad !== "string" || ad.length !== 8 || isNaN(Number(ad))) return false;
let aN = parseInt(ad.slice(0, 4), 10); let X = parseInt(ad.slice(4, 6), 10); let aa = parseInt(ad.slice(6), 10);
let dg = [31, (aN % 4 === 0 && (aN % 100 !== 0 || aN % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
if (X < 1 || X > 12 || aa < 1 || aa > dg[X - 1]) return false;
return ad <= df;
}
function dh(A, I, R, aj, au, M, ai, aB) {
let ao = cE(R, A.c, aB);
let aa = ao.d;
A.c = R;
A.o = ak(A.o + aa);
let ae = {changed: aa > 0, month: I, created: false, adjChanged: false, d: aa, forced: false,
sx: ao.code === "s" ? ao.x : 0};
if (!(aj > aM)) {
A.pb = ak(A.pb + aa);
if (ao.code) { bl(ai, "00000000", ao.x, ao.code); ae.adjChanged = true; ae.changed = true; ae.forced = true; }
return ae;
}
let bA = aj + au;
let al = aw(bA);
let W = al.slice(0, 6);
if (!I || I.k !== W) {
I = {k: W, s: Math.round(A.o - aa - A.pb - A.po), days: []};
ae.created = true; ae.changed = true; ae.forced = true;
}
ae.month = I;
if (A.dk !== al) {
A.dk = al;
let di = parseInt(al.slice(6), 10) - 1;
A.dw = I.days[di] || 0;
}
if (ao.code) { bl(ai, al, ao.x, ao.code); ae.adjChanged = true; ae.changed = true; ae.forced = true; }
if (A.pb > 0) {
let ay = cF(A.pb, bA - M, bA); let w;
for (w = 0; w < ay.length; w++) {
if (ay[w][0].slice(0, 6) === W) {
aO(A, I, ay[w][0], ay[w][1]);
} else {
aO(A, I, W + "01", ay[w][1]);
bl(ai, ay[w][0], Math.round(ay[w][1]), "m"); ae.adjChanged = true;
}
}
A.pb = 0; ae.changed = true; ae.forced = true;
}
if (aa > 0) aO(A, I, al, aa);
A.t = aj;
return ae;
}
let a8 = "switch:0";
let dj = 60000;
let dm = 5000;
let dn = 4000;
let dp = 600000;
let aS = bT(null), bB = null;
let A = null, I = null, ai = [];
let aF = -1;
let aT = 0, a9 = 0;
let Q = [], bC = false;
let bD = [], bE = false;
function cf() {
if (bC || Q.length === 0) return;
bC = true;
let bF = Q.splice(0, 1)[0];
Shelly.call(bF[0], bF[1], function (C, H, dq) {
if (H) print("meter: " + bF[0] + " failed: " + String(dq));
bC = false;
cf();
});
}
function aI(cg, Y) {
let w;
for (w = 0; w < Q.length; w++) {
if (Q[w][0] === "KVS.Set" && Q[w][1].key === cg) { Q[w][1].value = Y; return; }
}
Q.push(["KVS.Set", {key: cg, value: Y}]);
cf();
}
let ch = "";
function bG() {
A.u = Math.floor(Shelly.getComponentStatus("sys").uptime);
aI("cc:state", cV(A));
let Z = JSON.stringify(A.ss || null);
if (Z !== ch) { aI("cc:ss", Z); ch = Z; }
}
function ba() {
if (I) aI("cc:m:" + I.k, bi(I));
bG(); aT = 0; a9 = Shelly.getComponentStatus("sys").uptime;
}
function av() {
let ag = Shelly.getComponentStatus("sys");
return {unix: (typeof ag.unixtime === "number") ? ag.unixtime : 0,
off: (typeof ag.utc_offset === "number") ? ag.utc_offset : 0, up: ag.uptime, sync: ag.last_sync_ts};
}
function az(dr) { bD.push(dr); ci(); }
function ci() {
if (bE || bD.length === 0) return;
bE = true;
bD.splice(0, 1)[0](function () { bE = false; ci(); });
}
function bb(ap, U, w, O) {
Shelly.call("KVS.Get", {key: ap[w]}, function (C, H) {
if (H && H !== -105) { Timer.set(5000, false, function () { bb(ap, U, w, O); }); return; }
let cj = (!H && C) ? C.value : null;
let V = a5(cj, U);
if (V === null && w + 1 < ap.length) { bb(ap, U, w + 1, O); return; }
if (V === null) {
A.l = (A.l || 0) + 1;
let E = cj.split(";");
while (E.length && a5(E.join(";"), U) === null) E.splice(0, 1);
V = a5(E.length ? E.join(";") : null, U);
}
Shelly.call("KVS.Set", {key: ap[w], value: V}, function (bH, ds) { if (ds) A.l = (A.l || 0) + 1; O(); });
});
}
function bI(ac) {
let D = av();
let W = c5(ac, D.off);
let U = c4(ac, D.off);
let ap = W ? b6(W) : ["cc:su"];
az(function (O) { bb(ap, U, 0, O); });
}
function dt(D) {
let an = Math.floor(D.unix - D.up);
let bv = (typeof D.sync === "number" && D.sync >= an) ? "s" : "p";
let F = A.n; let B;
A.nb = true;
if (A.ss) {
B = aP(A.ss.s); if (B && B[0] === F) A.ss.s = an + B[1];
}
ba();
az(function (O) {
Shelly.call("KVS.Get", {key: "cc:boot"}, function (C, H) {
if (H && H !== -105) { O(); return; }
let V = cS(cT(b5(!H && C ? C.value : null), F, an, bv));
Shelly.call("KVS.Set", {key: "cc:boot", value: V}, function () { O(); });
});
});
az(function (O) {
Shelly.call("KVS.Get", {key: "cc:su"}, function (C, H) {
let L = db(!H && C ? C.value : null, F, an); let w;
if (L.t > 0) { A.po = ak(A.po - L.t); if (A.po < 0) A.po = 0; A.pb = ak(A.pb + L.t); }
if (L.recs.length === 0 && L.t === 0) { O(); return; }
for (w = 0; w < L.recs.length; w++) bI(L.recs[w]);
bJ(L.rest, O);
});
});
}
function bc(U) {
az(function (O) {
if (A.ei === undefined) A.ei = 0;
Shelly.call("KVS.Get", {key: "cc:ev" + String(A.ei)}, function (C, H) {
if (H && H !== -105) { O(); return; }
let B = c8(!H && C ? C.value : null, U);
if (B.full) A.ei = b9(A.ei, 3);
Shelly.call("KVS.Set", {key: "cc:ev" + String(A.ei), value: B.value}, function () { ba(); O(); });
});
});
}
function du() {
let D = av();
if (A.hi === undefined) A.hi = 0;
aI("cc:hb" + String(A.hi), String(aG(D.unix, A.n, D.up)));
A.hi = b9(A.hi, 3);
}
Shelly.addStatusHandler(function (P) {
if (!A || !P || P.component !== a8 || !P.delta || typeof P.delta.output !== "boolean") return;
let D = av();
if (!P.delta.output && A.ss) A.ss.f = a3(A.ss.f, "o");
bc(a6("R", aG(D.unix, A.n, D.up), (P.delta.output ? "1/" : "0/") + (P.delta.source || "?")));
});
function dv(R, aU) {
Shelly.call("KVS.GetMany", {match: "cc:hb*"}, function (C, H) {
let ck = []; let w;
if (!H && C && C.items) for (w = 0; w < C.items.length; w++) ck.push(C.items[w].value);
Shelly.call("KVS.Get", {key: "cc:boot"}, function (aJ, bd) {
let aK = A.n;
let aV = cU(b5(!bd && aJ ? aJ.value : null), aK);
let bK = c9(ck, aK + 1, aV === null);
let be = -1; let B = aP(bK);
if (B) be = B[1]; else if (bK !== null && aV !== null) be = bK - aV;
let bL = (A.u || 0) > be ? (A.u || 0) : be;
let ac = c2(A.ss, null, bL, R);
A.n = aK + 1; A.nb = false; A.ss = null;
if (ac) bI(ac);
let D = av();
let bH = Shelly.getComponentStatus("sys").reset_reason;
bc(a6("B", aG(D.unix, A.n, D.up), (bH === undefined ? "?" : String(bH)) + "/" +
(aV === null ? "~" + String(aK) + "." + String(bL) : String(aV + bL))));
bG();
aU();
});
});
}
function dx(ap, U) { az(function (O) { bb(ap, U, 0, O); }); }
function bJ(V, O) {
if (V) Shelly.call("KVS.Set", {key: "cc:su", value: V}, function () { O(); });
else Shelly.call("KVS.Delete", {key: "cc:su"}, function () { O(); });
}
function dy(F, M, ad) {
let D = av();
if (!(D.unix > aM) || !de(ad, aw(D.unix + D.off))) return;
let W = ad.slice(0, 6);
az(function (O) {
Shelly.call("KVS.Get", {key: "cc:su"}, function (C, H) {
let L = (!H && C) ? dd(C.value, F, String(M), ad) : null;
if (!L) { O(); return; }
function cl() {
A.po = ak(A.po - L.wh); if (A.po < 0) A.po = 0;
if (L.line) dx(b6(W), L.line);
ba();
bJ(L.rest, O);
}
if (I && I.k === W) { aO(A, I, ad, L.wh); cl(); return; }
Shelly.call("KVS.Get", {key: "cc:m:" + W}, function (cm, bM) {
if (bM && bM !== -105) { O(); return; }
let X = (!bM && cm) ? bY(cm.value) : {s: 0, days: []};
aO(A, X, ad, L.wh);
Shelly.call("KVS.Set", {key: "cc:m:" + W, value: bi(X)}, function () { cl(); });
});
});
});
}
function dz(ar) {
let D = av();
let aW = Shelly.getComponentStatus(a8);
let dA = A.ss;
let C = cY(A.ss, ar, {stamp: aG(D.unix, A.n, D.up), up: D.up, c: aW.aenergy.total});
A.ss = C.ss;
if (dA || C.ss) ba();
}
function dB() {
Shelly.call("KVS.Get", {key: "cc:cfg"}, function (C, H) {
if (H && H !== -105) return;
let cn = H ? "-" : (C.etag || C.value);
if (cn === bB) return;
bB = cn;
aS = bT(H ? null : C.value);
print("meter: cfg changed, session gap " + String(aS.sg));
Shelly.emitEvent("cc_cfg", b4(aS));
});
}
Shelly.addEventHandler(function (P) {
if (P && P.info && P.info.event === "cc_cfgq") Shelly.emitEvent("cc_cfg", b4(aS));
if (!A || !P || !P.info || !P.info.data) return;
if (P.info.event === "cc_band") dz(P.info.data.b);
else if (P.info.event === "cc_date") dy(P.info.data.n, P.info.data.u, P.info.data.day);
});
function dC(C) {
function co() {
if (I) aI("cc:m:" + I.k, bi(I));
bG();
if (C.adjChanged) aI("cc:adj", JSON.stringify(ai));
}
if (!C.created) { co(); return; }
Shelly.call("KVS.List", {match: "cc:*"}, function (bN, dD) {
if (!dD && bN && bN.keys) {
let af = []; let ax;
for (ax in bN.keys) af.push(ax);
let am = cK(af, I.k, cR(A)); let w;
for (w = 0; w < am.length; w++) Q.push(["KVS.Delete", {key: am[w]}]);
}
co();
});
}
function dE(W, aU) {
if (I && I.k === W) { aU(true); return; }
Shelly.call("KVS.Get", {key: "cc:m:" + W}, function (C, H) {
let cp = bp(H, (!H && C) ? C.value : null);
if (cp === "skip") { aU(false); return; }
if (cp === "use") { let X = bY(C.value); X.k = W; I = X; }
aU(true);
});
}
function cq() {
let ag = Shelly.getComponentStatus("sys");
let aW = Shelly.getComponentStatus(a8);
if (!ag || !aW || !aW.aenergy) return;
dB();
let aj = (typeof ag.unixtime === "number") ? ag.unixtime : 0;
let au = (typeof ag.utc_offset === "number") ? ag.utc_offset : 0;
let M = ag.uptime;
if (aF < 0) Shelly.emitEvent("cc_ask", {});
let aB = dn * cL(aF, M) / 3600 + 10;
let R = aW.aenergy.total;
function cr(dF) {
if (!dF) return;
aF = M;
let C = dh(A, I, R, aj, au, M, ai, aB);
I = C.month;
aT = ak(aT + C.d);
if (C.sx) A.ss = c1(A.ss, C.sx);
let cs = bB === null ? {ss: A.ss, closed: null} : cZ(A.ss, M, aS.sg);
if (cs.closed) { A.ss = null; bI(cs.closed); C.changed = true; C.forced = true; }
if (aj > aM && !A.nb) dt({unix: aj, up: M, sync: ag.last_sync_ts});
if (C.changed && cM(aT, M - a9, C.forced)) {
dC(C); aT = 0; a9 = M;
}
}
if (aj > aM) dE(aw(aj + au).slice(0, 6), cr);
else cr(true);
}
function dG() {
a9 = Shelly.getComponentStatus("sys").uptime;
Timer.set(dm, false, cq);
Timer.set(dj, true, cq);
Timer.set(dp, true, du);
}
function bf(R) {
if (R < 0) { let bg = Shelly.getComponentStatus(a8); R = bg && bg.aenergy ? bg.aenergy.total : 0; bg = null; }
Shelly.call("KVS.Get", {key: "cc:adj"}, function (C, H) {
if (bp(H, null) === "skip") { Timer.set(5000, false, function () { bf(R); }); return; }
if (!H && C && C.value) { try { ai = JSON.parse(C.value); } catch (P) { ai = []; } }
Shelly.call("KVS.Get", {key: "cc:state"}, function (aJ, bd) {
if (bp(bd, null) === "skip") { Timer.set(5000, false, function () { bf(R); }); return; }
let N = null;
if (!bd && aJ && aJ.value) { try { N = JSON.parse(aJ.value); } catch (P) { N = null; } }
let br = !N;
if (!N) N = {c: R, o: 0, t: 0, pb: 0, po: 0, dk: "", dw: 0};
let bO = Math.round(N.pb || 0); let aK = N.n || 0;
if (bO > 0) N.po = ak(N.po + N.pb);
N.pb = 0;
Shelly.call("KVS.Get", {key: "cc:ss"}, function (bP, bQ) {
if (bQ && bQ !== -105) { Timer.set(5000, false, function () { bf(R); }); return; }
if (!bQ && bP && bP.value) { try { N.ss = JSON.parse(bP.value); } catch (P) { N.ss = null; } }
A = N;
if (A.n === undefined) { A.n = 0; A.nb = false; }
if (A.ss === undefined) A.ss = null;
let dH = cQ(A, br);
function ct() {
if (dH.legacy) { let cu = av(); bc(a6("L", aG(cu.unix, A.n, cu.up))); }
dG();
}
if (bO > 0) az(function (O) {
Shelly.call("KVS.Get", {key: "cc:su"}, function (cv, dI) { bJ(dc(!dI && cv ? cv.value : null, aK, bO), O); });
});
let D = av();
if (cP(D.up, A.u)) dv(R, ct);
else { bc(a6("U", aG(D.unix, A.n, D.up))); ct(); }
});
});
});
}
function cw(Q, w, dJ) {
if (w >= Q.length) return;
Timer.set(Q[w][1] - dJ, false, function () {
Shelly.call("Script.Start", {id: Q[w][0]});
cw(Q, w + 1, Q[w][1]);
});
}
function dK() {
Shelly.call("Script.List", {}, function (C, H) {
if (H || !C || !C.scripts) return;
let bR = [["Led", 5000], ["Page", 20000]];
let w, Z, Q = [];
for (w = 0; w < bR.length; w++) {
for (Z = 0; Z < C.scripts.length; Z++) {
let N = C.scripts[Z];
if (N.name === bR[w][0] && !N.running) Q.push([N.id, bR[w][1]]);
}
}
cw(Q, 0, 0);
});
}
dK();
bf(-1);
