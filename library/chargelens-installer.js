// ChargeLens Installer v1.0.0
let REPO = "pjrml/chargelens";
let TAG = "v1.0.0";
let BOOT = "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">" +
"<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>ChargeLens installer</title></head>" +
"<body style=\"background:#0b1221;color:#94a3b8;font-family:sans-serif;padding:16px\">Loading the installer...<script>" +
"(async function(){var m=/[?&]base=([^&]*)/.exec(location.search),b=m?decodeURIComponent(m[1]):'';" +
"if(b&&b.slice(-1)!='/')b+='/';if(!b)b='https://raw.githubusercontent.com/" + REPO + "/" + TAG + "/';" +
"var r=await fetch(b+'dist/install.html',{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);var h=await r.text();" +
"window.CL={repo:'" + REPO + "',tag:'" + TAG + "',base:b};document.open();document.write(h);document.close()})()" +
".catch(function(e){document.body.textContent='Could not load the install page: '+e})</script></body></html>";
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
let w = Shelly.getComponentStatus("wifi");
print("ChargeLens installer: open http://" + ((w && w.sta_ip) || "192.168.33.1") + "/script/" + JSON.stringify(id) + "/install");
});
});
