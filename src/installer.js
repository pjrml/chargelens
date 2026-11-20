// ChargeLens "Installer" - serves the install/update page from the plug. Design: section 7 of
// docs/superpowers/specs/2026-11-19-chargelens-design.md
// Stored on the plug, never enabled at boot. Endpoint http://<ip>/script/<id>/install returns a small loader that
// fetches install.html from GitHub: from main while main/dist/release.json has the tag this file was built for
// (same build, also before that tag is published), otherwise from that tag; ?tag= or ?base=<url>/ override it,
// passes REPO, TAG and base to it as window.CL and writes it into the document. The page itself is downloaded by
// the browser and never stored or sent by the plug, so the plug's ~4 KB reply limit only applies to this loader.
// The Library names the script after the file; at start (deferred: a Shelly.call during load can be rejected) it
// renames itself to "Installer" when that name is free.
// Tokens @REPO@ and @TAG@ are replaced by tools/build.py.

let REPO = "@REPO@";
let TAG = "@TAG@";

let BOOT = "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">" +
  "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>ChargeLens installer</title></head>" +
  "<body style=\"background:#0b1221;color:#94a3b8;font-family:sans-serif;padding:16px\"><div id=\"m\">Loading the installer...</div><script>" +
  "(async function(){var s=location.search,m=/[?&]base=([^&]*)/.exec(s),t=/[?&]tag=(v[0-9]+[.][0-9]+[.][0-9]+(-[0-9A-Za-z]+([.][0-9A-Za-z]+)*)?)(&|$)/.exec(s),tg=t?t[1]:'" + TAG + "'," +
  "g='https://raw.githubusercontent.com/" + REPO + "/',d=g+tg+'/',b=m?decodeURIComponent(m[1]):'';if(b&&b.slice(-1)!='/')b+='/';" +
  "if(!b&&!t){try{var q=await fetch(g+'main/dist/release.json',{cache:'no-store'});if(q.ok&&(await q.json()).tag==tg)d=g+'main/'}catch(e){}}if(!b)b=d;" +
  "if(b!=d&&!confirm('This link installs ChargeLens from a test source ('+b+') instead of the official release. Continue only if you are testing ChargeLens yourself.'))throw new Error('cancelled');" +
  "var r=await fetch(b+'dist/install.html',{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);var h=await r.text();" +
  "window.CL={repo:'" + REPO + "',tag:tg,base:b};document.open();document.write(h);document.close()})()" +
  ".catch(function(e){document.getElementById('m').innerHTML='Could not load the install page: '+e+'<br><button onclick=\"bk()\">Back</button>'});" +
  "async function bk(){var g=function(u){return fetch(u).then(function(r){return r.json()})},L=(await g('/rpc/Script.List')).scripts,i,j,p=null,n=['Meter','Led','Page'];" +
  "await g('/rpc/Script.Stop?id='+/[/]script[/]([0-9]+)[/]/.exec(location.pathname)[1]);" +
  "for(j=0;j<3;j++)for(i=0;i<L.length;i++)if(L[i].name==n[j]){if(!L[i].running)await g('/rpc/Script.Start?id='+L[i].id);if(j==2)p=L[i].id}" +
  "location.href=p===null?'/':'/script/'+p+'/ui'}</script></body></html>";

HTTPServer.registerEndpoint("install", function (req, res) {
  res.code = 200;
  res.headers = [["Content-Type", "text/html; charset=utf-8"], ["Cache-Control", "no-store"]];
  res.body = BOOT;
  res.send();
});

Timer.set(1500, false, function () {
  let id = Shelly.getCurrentScriptId();
  Shelly.call("Script.List", {}, function (r, err) {
    let me = null, taken = false, i;
    if (!err && r) {
      for (i = 0; i < r.scripts.length; i++) {
        if (r.scripts[i].id === id) me = r.scripts[i].name;
        else if (r.scripts[i].name === "Installer") taken = true;
      }
    }
    if (me !== null && me !== "Installer" && !taken) Shelly.call("Script.SetConfig", {id: id, config: {name: "Installer"}});
    // The console shows print() only with websocket debug logs on: turn them on if the user did not press Enable.
    let c = Shelly.getComponentConfig("sys");
    if (!(c && c.debug && c.debug.websocket && c.debug.websocket.enable)) {
      Shelly.call("Sys.SetConfig", {config: {debug: {websocket: {enable: true}}}});
    }
    // Repeat the address for 30 s, so a console opened (or reloaded) after Start still shows it.
    let left = 10;
    let say = function () {
      let w = Shelly.getComponentStatus("wifi");
      print("ChargeLens installer: open http://" + ((w && w.sta_ip) || "192.168.33.1") + "/script/" + JSON.stringify(id) + "/install");
      left--;
      if (left > 0) Timer.set(3000, false, say);
    };
    say();
  });
});
