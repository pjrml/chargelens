t("build", function () {
  //@if relay
  eq("fx", FX, "relay");
  //@else
  eq("fx", FX, "norelay");
  //@end
});
