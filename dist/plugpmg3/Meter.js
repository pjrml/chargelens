// ChargeLens Meter v1.0.0-rc.9
function cx() {
let D = "r,0.1,0.02,1;g,5,1,15;y,11,1,16;h,0.3,0.05,1;hr,0.05,0.01,0.5;hs,10,2,60;sg,600,60,3600;p,0,0,10;lo,1,0,1;lb,50,5,100".split(";");
let K = [], w, B;
for (w = 0; w < D.length; w++) { B = D[w].split(","); K.push([B[0], Number(B[1]), Number(B[2]), Number(B[3])]); }
return K;
}
let bS = null;
function cy(ah) {
let aK = cx(), J = {v: 1}, w, E, L;
if (typeof ah !== "object" || ah === null) ah = {};
for (w = 0; w < aK.length; w++) {
E = aK[w]; L = ah[E[0]];
J[E[0]] = (typeof L === "number" && L >= E[2] && L <= E[3]) ? L : E[1];
}
if (!(J.r < J.g && J.g < J.y)) { J.r = aK[0][1]; J.g = aK[1][1]; J.y = aK[2][1]; }
return bS ? bS(J, ah) : J;
}
function bT(cz) {
let ah = null;
try { ah = JSON.parse(cz); } catch (Z) { ah = null; }
return cy(ah);
}
let aL = 1700000000;
let cA = 8;
let cB = 6;
function ak(L) { return Math.round(L * 1000) / 1000; }
function aX(F) { return (F < 10 ? "0" : "") + String(F); }
function cC(aY) {
let bd = aY + 719468;
let bU = (bd - bd % 146097) / 146097;
let aq = bd - bU * 146097;
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
let W = aZ < 10 ? aZ + 3 : aZ - 9;
let aM = aA + bU * 400 + (W <= 2 ? 1 : 0);
return {y: aM, m: W, d: aa};
}
function av(cD) {
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
function be(W) { return String(W.s) + "|" + W.days.join(","); }
function cE(Q, bf, aB) {
if (Q >= bf) {
let aa = ak(Q - bf);
if (aa > aB) return {d: 0, code: "s", x: Math.round(aa)};
return {d: aa, code: ""};
}
if (Q <= aB) return {d: ak(Q), code: ""};
return {d: 0, code: "b", x: Math.round(bf - Q)};
}
function cF(R, bg, aC) {
let K = [];
if (!(R > 0)) return K;
if (aC <= bg) { K.push([av(aC), R]); return K; }
let D = bg; let cG = aC - bg;
while (D < aC) {
let a0 = Math.floor(D / 86400) * 86400 + 86400;
if (a0 > aC) a0 = aC;
K.push([av(D), ak(R * (a0 - D) / cG)]);
D = a0;
}
return K;
}
function bh(ai, al, R, cH) {
ai.push([al, R, cH]);
while (ai.length > cA) ai.splice(0, 1);
}
function aN(A, I, al, R) {
let aD = parseInt(al.slice(6), 10) - 1;
while (I.days.length <= aD) I.days.push(0);
if (al === A.dk) {
A.dw = ak(A.dw + R);
I.days[aD] = Math.round(A.dw);
} else {
I.days[aD] = I.days[aD] + Math.round(R);
}
}
function cI(af, bi) {
let ab = af.slice(0); let K = [];
while (ab.length > bi) {
let a1 = 0; let w;
for (w = 1; w < ab.length; w++) if (ab[w] < ab[a1]) a1 = w;
K.push(ab[a1]);
ab.splice(a1, 1);
}
return K;
}
function cJ(af, bj, bi) {
let a2 = af.slice(0); let w; let b0 = false;
for (w = 0; w < a2.length; w++) if (a2[w] === bj) b0 = true;
if (!b0) a2.push(bj);
let am = cI(a2, bi); let K = [];
for (w = 0; w < am.length; w++) if (am[w] !== bj) K.push(am[w]);
return K;
}
function cK(af, b1, b2) {
if (!(b2 > 0)) return [];
let aE = []; let w; let Y;
for (w = 0; w < af.length; w++) if (af[w].slice(0, 5) === "cc:m:") aE.push(af[w]);
let am = cJ(aE, "cc:m:" + b1, b2); let K = [];
for (w = 0; w < am.length; w++) {
K.push(am[w]);
let B = "cc:s:" + am[w].slice(5);
for (Y = 0; Y < af.length; Y++) {
let F = af[Y];
if (F === B || F === B + "-2" || F === B + "-3") K.push(F);
}
}
let bk = "cc:m:" + b1;
for (w = 0; w < aE.length; w++) if (K.indexOf(aE[w]) < 0 && aE[w] < bk) bk = aE[w];
for (Y = 0; Y < af.length; Y++) {
let F = af[Y];
if (F.slice(0, 5) === "cc:s:" && "cc:m:" + F.slice(5, 11) < bk && K.indexOf(F) < 0) K.push(F);
}
return K;
}
function bl(H, X) {
if (!H) return X ? "use" : "new";
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
function cP(M, bm) {
return typeof bm !== "number" || M < bm || (M < 120 && bm < 120);
}
function cQ(A, bn) {
if (bn) { A.sv = 1; return {st: A, legacy: false}; }
return {st: A, legacy: A.sv === undefined};
}
function cR(A) { return A.sv >= 1 ? cB : 0; }
function b4(J) { return {r: J.r, g: J.g, y: J.y, h: J.h, hr: J.hr, hs: J.hs, lo: J.lo, lb: J.lb}; }
function aO(aj, F, M) {
if (aj > aL) return aj;
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
function cT(at, F, bo, bp) {
let K = []; let w;
for (w = 0; w < at.length; w++) if (at[w][0] !== F) K.push(at[w]);
K.push([F, bo, bp]);
return K;
}
function cU(bq, F) {
let w;
for (w = 0; w < bq.length; w++) if (bq[w][0] === F) return bq[w][1];
return null;
}
function aP(A) {
if (typeof A !== "string" || A.slice(0, 1) !== "~") return null;
let B = A.slice(1).split(".");
return [parseInt(B[0], 10), parseInt(B[1], 10)];
}
function cV(A) {
let ah = {}; let aw;
for (aw in A) if (aw !== "ss") ah[aw] = A[aw];
return JSON.stringify(ah);
}
function b6(V) { return ["cc:s:" + V, "cc:s:" + V + "-2"]; }
function br(aQ, J) { return aQ.indexOf(J) >= 0 ? aQ : aQ + J; }
function bs(G, cW, cX, aQ) {
let W = Math.round((cW - G.su) / 60);
return {s: G.s, min: W > 0 ? W : 0, wh: Math.round(cX - G.c - G.x), f: aQ};
}
function cY(G, ar, aG) {
if (!G) {
if (ar !== 2) return {ss: null, closed: null};
return {ss: {s: aG.stamp, su: aG.up, c: aG.c, g: 0, gc: 0, x: 0, f: ""}, closed: null};
}
if (ar === 2) { G.g = 0; return {ss: G, closed: null}; }
if (G.g === 0) { G.g = aG.up > 0 ? aG.up : 1; G.gc = aG.c; }
if (ar === 3) G.f = br(G.f, "y");
if (ar === 1) G.f = br(G.f, "r");
return {ss: G, closed: null};
}
function cZ(G, M, c0) {
if (G && G.g > 0 && M - G.g >= c0) return {ss: null, closed: bs(G, G.g, G.gc, G.f)};
return {ss: G, closed: null};
}
function c1(G, R) { if (G) G.x = G.x + R; return G; }
function c2(G, dL, c3, J) {
if (!G) return null;
if (G.g > 0) return bs(G, G.g, G.gc, G.f);
return bs(G, c3, J, br(G.f, "p"));
}
function c4(ac, au) {
let bv; let B = aP(ac.s);
if (B) { bv = String(B[0]) + "," + String(B[1]); } else {
let b7 = ac.s + au; let a3 = b7 % 86400;
bv = av(b7).slice(6) + "," + aX((a3 - a3 % 3600) / 3600) + aX(((a3 % 3600) - a3 % 60) / 60);
}
return bv + "," + String(ac.min) + "," + String(ac.wh) + (ac.f ? "," + ac.f : "");
}
function c5(ac, au) {
if (aP(ac.s)) return null;
return av(ac.s + au).slice(0, 6);
}
function a4(X, S) {
let U = X ? X + ";" + S : S;
return U.length > 253 ? null : U;
}
function bw(c6, A, b8) { return c6 + "," + String(A) + (b8 ? "," + b8 : ""); }
function b9(aD, c7) { return (aD + 1) % c7; }
function c8(X, S) {
let U = a4(X, S);
return U === null ? {value: S, full: true} : {value: U, full: false};
}
function c9(ca, F, da) {
let an = null; let cc = null; let cd = -1; let w;
for (w = 0; w < ca.length; w++) {
let U = ca[w];
if (!U) continue;
let B = aP(U);
if (B) { if (B[0] === F - 1 && B[1] > cd) { cd = B[1]; cc = U; } } else {
let L = parseInt(U, 10);
if (an === null || L > an) an = L;
}
}
if (!da && an !== null) return an;
return cc;
}
function db(X, F, bo) {
let ce = []; let ab = []; let D = 0;
if (X) {
let E = X.split(";"); let w;
for (w = 0; w < E.length; w++) {
let B = E[w].split(",");
if (parseInt(B[0], 10) === F && B[1] === "T") D = D + parseInt(B[3], 10);
else if (parseInt(B[0], 10) === F) {
ce.push({s: bo + parseInt(B[1], 10), min: parseInt(B[2], 10), wh: parseInt(B[3], 10), f: B.length > 4 ? B[4] : ""});
} else ab.push(E[w]);
}
}
return {recs: ce, rest: ab.length ? ab.join(";") : null, t: D};
}
function dc(X, F, R) {
let E = X ? X.split(";") : []; let w;
for (w = 0; w < E.length; w++) {
let B = E[w].split(",");
if (B[1] === "T" && parseInt(B[0], 10) === F) { E[w] = String(F) + ",T,0," + String(parseInt(B[3], 10) + R); return E.join(";"); }
}
E.push(String(F) + ",T,0," + String(R));
return E.join(";");
}
function dd(X, F, M, ad) {
if (!X) return null;
let E = X.split(";"); let a5 = -1; let aR = -1; let bx = 0; let w;
for (w = 0; w < E.length; w++) {
let B = E[w].split(",");
if (parseInt(B[0], 10) !== F) continue;
if (B[1] === "T") aR = w; else { bx++; if (B[1] === M) a5 = w; }
}
let D = aR >= 0 ? parseInt(E[aR].split(",")[3], 10) : 0;
let R = 0; let S = null;
if (M === "T") {
if (aR < 0 || bx > 0) return null;
R = D; D = 0;
} else {
if (a5 < 0) return null;
let P = E[a5].split(",");
R = parseInt(P[3], 10);
S = ad.slice(6) + ",~" + String(F) + "." + P[1] + "," + P[2] + "," + P[3] + "," + (P.length > 4 ? P[4] : "") + "d";
D = D - R; if (D < 0) D = 0;
if (bx === 1) { R = R + D; D = 0; }
}
let ab = [];
for (w = 0; w < E.length; w++) {
if (w === a5) continue;
if (w === aR) { if (D > 0) ab.push(String(F) + ",T,0," + String(D)); continue; }
ab.push(E[w]);
}
return {wh: R, line: S, rest: ab.length ? ab.join(";") : null};
}
function de(ad, df) {
if (typeof ad !== "string" || ad.length !== 8 || isNaN(Number(ad))) return false;
let aM = parseInt(ad.slice(0, 4), 10); let W = parseInt(ad.slice(4, 6), 10); let aa = parseInt(ad.slice(6), 10);
let dg = [31, (aM % 4 === 0 && (aM % 100 !== 0 || aM % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
if (W < 1 || W > 12 || aa < 1 || aa > dg[W - 1]) return false;
return ad <= df;
}
function dh(A, I, Q, aj, au, M, ai, aB) {
let ao = cE(Q, A.c, aB);
let aa = ao.d;
A.c = Q;
A.o = ak(A.o + aa);
let ae = {changed: aa > 0, month: I, created: false, adjChanged: false, d: aa, forced: false,
sx: ao.code === "s" ? ao.x : 0};
if (!(aj > aL)) {
A.pb = ak(A.pb + aa);
if (ao.code) { bh(ai, "00000000", ao.x, ao.code); ae.adjChanged = true; ae.changed = true; ae.forced = true; }
return ae;
}
let by = aj + au;
let al = av(by);
let V = al.slice(0, 6);
if (!I || I.k !== V) {
I = {k: V, s: Math.round(A.o - aa - A.pb - A.po), days: []};
ae.created = true; ae.changed = true; ae.forced = true;
}
ae.month = I;
if (A.dk !== al) {
A.dk = al;
let di = parseInt(al.slice(6), 10) - 1;
A.dw = I.days[di] || 0;
}
if (ao.code) { bh(ai, al, ao.x, ao.code); ae.adjChanged = true; ae.changed = true; ae.forced = true; }
if (A.pb > 0) {
let ax = cF(A.pb, by - M, by); let w;
for (w = 0; w < ax.length; w++) {
if (ax[w][0].slice(0, 6) === V) {
aN(A, I, ax[w][0], ax[w][1]);
} else {
aN(A, I, V + "01", ax[w][1]);
bh(ai, ax[w][0], Math.round(ax[w][1]), "m"); ae.adjChanged = true;
}
}
A.pb = 0; ae.changed = true; ae.forced = true;
}
if (aa > 0) aN(A, I, al, aa);
A.t = aj;
return ae;
}
let bz = "pm1:0";
let dj = 60000;
let dm = 5000;
let dn = 4000;
let dp = 600000;
let aS = bT(null), bA = null;
let A = null, I = null, ai = [];
let aF = -1;
let aT = 0, a6 = 0;
let P = [], bB = false;
let bC = [], bD = false;
function cf() {
if (bB || P.length === 0) return;
bB = true;
let bE = P.splice(0, 1)[0];
Shelly.call(bE[0], bE[1], function (C, H, dq) {
if (H) print("meter: " + bE[0] + " failed: " + String(dq));
bB = false;
cf();
});
}
function aH(cg, X) {
let w;
for (w = 0; w < P.length; w++) {
if (P[w][0] === "KVS.Set" && P[w][1].key === cg) { P[w][1].value = X; return; }
}
P.push(["KVS.Set", {key: cg, value: X}]);
cf();
}
let ch = "";
function bF() {
A.u = Math.floor(Shelly.getComponentStatus("sys").uptime);
aH("cc:state", cV(A));
let Y = JSON.stringify(A.ss || null);
if (Y !== ch) { aH("cc:ss", Y); ch = Y; }
}
function a7() {
if (I) aH("cc:m:" + I.k, be(I));
bF(); aT = 0; a6 = Shelly.getComponentStatus("sys").uptime;
}
function ay() {
let ag = Shelly.getComponentStatus("sys");
return {unix: (typeof ag.unixtime === "number") ? ag.unixtime : 0,
off: (typeof ag.utc_offset === "number") ? ag.utc_offset : 0, up: ag.uptime, sync: ag.last_sync_ts};
}
function az(dr) { bC.push(dr); ci(); }
function ci() {
if (bD || bC.length === 0) return;
bD = true;
bC.splice(0, 1)[0](function () { bD = false; ci(); });
}
function a8(ap, S, w, O) {
Shelly.call("KVS.Get", {key: ap[w]}, function (C, H) {
if (H && H !== -105) { Timer.set(5000, false, function () { a8(ap, S, w, O); }); return; }
let cj = (!H && C) ? C.value : null;
let U = a4(cj, S);
if (U === null && w + 1 < ap.length) { a8(ap, S, w + 1, O); return; }
if (U === null) {
A.l = (A.l || 0) + 1;
let E = cj.split(";");
while (E.length && a4(E.join(";"), S) === null) E.splice(0, 1);
U = a4(E.length ? E.join(";") : null, S);
}
Shelly.call("KVS.Set", {key: ap[w], value: U}, function (bG, ds) { if (ds) A.l = (A.l || 0) + 1; O(); });
});
}
function bH(ac) {
let D = ay();
let V = c5(ac, D.off);
let S = c4(ac, D.off);
let ap = V ? b6(V) : ["cc:su"];
az(function (O) { a8(ap, S, 0, O); });
}
function dt(D) {
let an = Math.floor(D.unix - D.up);
let bp = (typeof D.sync === "number" && D.sync >= an) ? "s" : "p";
let F = A.n; let B;
A.nb = true;
if (A.ss) {
B = aP(A.ss.s); if (B && B[0] === F) A.ss.s = an + B[1];
}
a7();
az(function (O) {
Shelly.call("KVS.Get", {key: "cc:boot"}, function (C, H) {
if (H && H !== -105) { O(); return; }
let U = cS(cT(b5(!H && C ? C.value : null), F, an, bp));
Shelly.call("KVS.Set", {key: "cc:boot", value: U}, function () { O(); });
});
});
az(function (O) {
Shelly.call("KVS.Get", {key: "cc:su"}, function (C, H) {
let L = db(!H && C ? C.value : null, F, an); let w;
if (L.t > 0) { A.po = ak(A.po - L.t); if (A.po < 0) A.po = 0; A.pb = ak(A.pb + L.t); }
if (L.recs.length === 0 && L.t === 0) { O(); return; }
for (w = 0; w < L.recs.length; w++) bH(L.recs[w]);
bI(L.rest, O);
});
});
}
function bJ(S) {
az(function (O) {
if (A.ei === undefined) A.ei = 0;
Shelly.call("KVS.Get", {key: "cc:ev" + String(A.ei)}, function (C, H) {
if (H && H !== -105) { O(); return; }
let B = c8(!H && C ? C.value : null, S);
if (B.full) A.ei = b9(A.ei, 3);
Shelly.call("KVS.Set", {key: "cc:ev" + String(A.ei), value: B.value}, function () { a7(); O(); });
});
});
}
function du() {
let D = ay();
if (A.hi === undefined) A.hi = 0;
aH("cc:hb" + String(A.hi), String(aO(D.unix, A.n, D.up)));
A.hi = b9(A.hi, 3);
}
function dv(Q, aU) {
Shelly.call("KVS.GetMany", {match: "cc:hb*"}, function (C, H) {
let ck = []; let w;
if (!H && C && C.items) for (w = 0; w < C.items.length; w++) ck.push(C.items[w].value);
Shelly.call("KVS.Get", {key: "cc:boot"}, function (aI, a9) {
let aJ = A.n;
let aV = cU(b5(!a9 && aI ? aI.value : null), aJ);
let bK = c9(ck, aJ + 1, aV === null);
let ba = -1; let B = aP(bK);
if (B) ba = B[1]; else if (bK !== null && aV !== null) ba = bK - aV;
let bL = (A.u || 0) > ba ? (A.u || 0) : ba;
let ac = c2(A.ss, null, bL, Q);
A.n = aJ + 1; A.nb = false; A.ss = null;
if (ac) bH(ac);
let D = ay();
let bG = Shelly.getComponentStatus("sys").reset_reason;
bJ(bw("B", aO(D.unix, A.n, D.up), (bG === undefined ? "?" : String(bG)) + "/" +
(aV === null ? "~" + String(aJ) + "." + String(bL) : String(aV + bL))));
bF();
aU();
});
});
}
function dx(ap, S) { az(function (O) { a8(ap, S, 0, O); }); }
function bI(U, O) {
if (U) Shelly.call("KVS.Set", {key: "cc:su", value: U}, function () { O(); });
else Shelly.call("KVS.Delete", {key: "cc:su"}, function () { O(); });
}
function dy(F, M, ad) {
let D = ay();
if (!(D.unix > aL) || !de(ad, av(D.unix + D.off))) return;
let V = ad.slice(0, 6);
az(function (O) {
Shelly.call("KVS.Get", {key: "cc:su"}, function (C, H) {
let L = (!H && C) ? dd(C.value, F, String(M), ad) : null;
if (!L) { O(); return; }
function cl() {
A.po = ak(A.po - L.wh); if (A.po < 0) A.po = 0;
if (L.line) dx(b6(V), L.line);
a7();
bI(L.rest, O);
}
if (I && I.k === V) { aN(A, I, ad, L.wh); cl(); return; }
Shelly.call("KVS.Get", {key: "cc:m:" + V}, function (cm, bM) {
if (bM && bM !== -105) { O(); return; }
let W = (!bM && cm) ? bY(cm.value) : {s: 0, days: []};
aN(A, W, ad, L.wh);
Shelly.call("KVS.Set", {key: "cc:m:" + V, value: be(W)}, function () { cl(); });
});
});
});
}
function dz(ar) {
let D = ay();
let aW = Shelly.getComponentStatus(bz);
let dA = A.ss;
let C = cY(A.ss, ar, {stamp: aO(D.unix, A.n, D.up), up: D.up, c: aW.aenergy.total});
A.ss = C.ss;
if (dA || C.ss) a7();
}
function dB() {
Shelly.call("KVS.Get", {key: "cc:cfg"}, function (C, H) {
if (H && H !== -105) return;
let cn = H ? "-" : (C.etag || C.value);
if (cn === bA) return;
bA = cn;
aS = bT(H ? null : C.value);
print("meter: cfg changed, session gap " + String(aS.sg));
Shelly.emitEvent("cc_cfg", b4(aS));
});
}
Shelly.addEventHandler(function (Z) {
if (Z && Z.info && Z.info.event === "cc_cfgq") Shelly.emitEvent("cc_cfg", b4(aS));
if (!A || !Z || !Z.info || !Z.info.data) return;
if (Z.info.event === "cc_band") dz(Z.info.data.b);
else if (Z.info.event === "cc_date") dy(Z.info.data.n, Z.info.data.u, Z.info.data.day);
});
function dC(C) {
function co() {
if (I) aH("cc:m:" + I.k, be(I));
bF();
if (C.adjChanged) aH("cc:adj", JSON.stringify(ai));
}
if (!C.created) { co(); return; }
Shelly.call("KVS.List", {match: "cc:*"}, function (bN, dD) {
if (!dD && bN && bN.keys) {
let af = []; let aw;
for (aw in bN.keys) af.push(aw);
let am = cK(af, I.k, cR(A)); let w;
for (w = 0; w < am.length; w++) P.push(["KVS.Delete", {key: am[w]}]);
}
co();
});
}
function dE(V, aU) {
if (I && I.k === V) { aU(true); return; }
Shelly.call("KVS.Get", {key: "cc:m:" + V}, function (C, H) {
let cp = bl(H, (!H && C) ? C.value : null);
if (cp === "skip") { aU(false); return; }
if (cp === "use") { let W = bY(C.value); W.k = V; I = W; }
aU(true);
});
}
function cq() {
let ag = Shelly.getComponentStatus("sys");
let aW = Shelly.getComponentStatus(bz);
if (!ag || !aW || !aW.aenergy) return;
dB();
let aj = (typeof ag.unixtime === "number") ? ag.unixtime : 0;
let au = (typeof ag.utc_offset === "number") ? ag.utc_offset : 0;
let M = ag.uptime;
if (aF < 0) Shelly.emitEvent("cc_ask", {});
let aB = dn * cL(aF, M) / 3600 + 10;
let Q = aW.aenergy.total;
function cr(dF) {
if (!dF) return;
aF = M;
let C = dh(A, I, Q, aj, au, M, ai, aB);
I = C.month;
aT = ak(aT + C.d);
if (C.sx) A.ss = c1(A.ss, C.sx);
let cs = bA === null ? {ss: A.ss, closed: null} : cZ(A.ss, M, aS.sg);
if (cs.closed) { A.ss = null; bH(cs.closed); C.changed = true; C.forced = true; }
if (aj > aL && !A.nb) dt({unix: aj, up: M, sync: ag.last_sync_ts});
if (C.changed && cM(aT, M - a6, C.forced)) {
dC(C); aT = 0; a6 = M;
}
}
if (aj > aL) dE(av(aj + au).slice(0, 6), cr);
else cr(true);
}
function dG() {
a6 = Shelly.getComponentStatus("sys").uptime;
Timer.set(dm, false, cq);
Timer.set(dj, true, cq);
Timer.set(dp, true, du);
}
function bb(Q) {
if (Q < 0) { let bc = Shelly.getComponentStatus(bz); Q = bc && bc.aenergy ? bc.aenergy.total : 0; bc = null; }
Shelly.call("KVS.Get", {key: "cc:adj"}, function (C, H) {
if (bl(H, null) === "skip") { Timer.set(5000, false, function () { bb(Q); }); return; }
if (!H && C && C.value) { try { ai = JSON.parse(C.value); } catch (Z) { ai = []; } }
Shelly.call("KVS.Get", {key: "cc:state"}, function (aI, a9) {
if (bl(a9, null) === "skip") { Timer.set(5000, false, function () { bb(Q); }); return; }
let N = null;
if (!a9 && aI && aI.value) { try { N = JSON.parse(aI.value); } catch (Z) { N = null; } }
let bn = !N;
if (!N) N = {c: Q, o: 0, t: 0, pb: 0, po: 0, dk: "", dw: 0};
let bO = Math.round(N.pb || 0); let aJ = N.n || 0;
if (bO > 0) N.po = ak(N.po + N.pb);
N.pb = 0;
Shelly.call("KVS.Get", {key: "cc:ss"}, function (bP, bQ) {
if (bQ && bQ !== -105) { Timer.set(5000, false, function () { bb(Q); }); return; }
if (!bQ && bP && bP.value) { try { N.ss = JSON.parse(bP.value); } catch (Z) { N.ss = null; } }
A = N;
if (A.n === undefined) { A.n = 0; A.nb = false; }
if (A.ss === undefined) A.ss = null;
let dH = cQ(A, bn);
function ct() {
if (dH.legacy) { let cu = ay(); bJ(bw("L", aO(cu.unix, A.n, cu.up))); }
dG();
}
if (bO > 0) az(function (O) {
Shelly.call("KVS.Get", {key: "cc:su"}, function (cv, dI) { bI(dc(!dI && cv ? cv.value : null, aJ, bO), O); });
});
let D = ay();
if (cP(D.up, A.u)) dv(Q, ct);
else { bJ(bw("U", aO(D.unix, A.n, D.up))); ct(); }
});
});
});
}
function cw(P, w, dJ) {
if (w >= P.length) return;
Timer.set(P[w][1] - dJ, false, function () {
Shelly.call("Script.Start", {id: P[w][0]});
cw(P, w + 1, P[w][1]);
});
}
function dK() {
Shelly.call("Script.List", {}, function (C, H) {
if (H || !C || !C.scripts) return;
let bR = [["Led", 5000], ["Page", 20000]];
let w, Y, P = [];
for (w = 0; w < bR.length; w++) {
for (Y = 0; Y < C.scripts.length; Y++) {
let N = C.scripts[Y];
if (N.name === bR[w][0] && !N.running) P.push([N.id, bR[w][1]]);
}
}
cw(P, 0, 0);
});
}
dK();
bb(-1);
