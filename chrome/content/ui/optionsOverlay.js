const aup = Components.classes["@mozilla.org/autoproxy;1"].createInstance().wrappedJSObject;

window.onload = bindEvent = function()
{
  var pane = document.getElementById("paneAdvanced");
  if (!pane.loaded)
    pane.addEventListener("click", bindEvent, false);
  else {
    var connectionSettings = document.getElementById("connectionSettings");
    connectionSettings.removeAttribute("oncommand");
    connectionSettings.addEventListener("command", handleProxySettings);
    pane.removeEventListener("click", bindEvent, false);
  }
}

function handleProxySettings()
{
  aup.openSettingsDialog();
}
