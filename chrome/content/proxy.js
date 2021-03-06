/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is AutoProxy.
 *
 * The Initial Developer of the Original Code is
 * Wang Congming <lovelywcm@gmail.com>.
 * Portions created by the Initial Developer are Copyright (C) 2010-2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 * 2010: slimx <slimxfir@gmail.com>.
 *
 * ***** END LICENSE BLOCK ***** */

/**
 * Core implementation of proxy mechanism
 * This file is included from AutoProxy.js.
 */

const pS = Cc['@mozilla.org/network/protocol-proxy-service;1'].getService(Ci.nsIProtocolProxyService);

var proxy =
{
  server: null,
  getName: null,
  defaultProxy: null,
  validConfigs: null,
  mode: ['auto', 'global', 'disabled'],
  direct: pS.newProxyInfo('direct', '', -1, 0, 0, null),

  init: function()
  {
    this.reloadPrefs();
    prefs.addListener(this.reloadPrefs);
  },

  reloadPrefs: function()
  {
    // Refresh validConfigs - array of objects
    proxy.validConfigs = proxy.configToObj(prefs.customProxy) ||
                            proxy.configToObj(prefs.knownProxy);

    /**
     * Refresh proxy name & available proxy servers
     *
     * newProxyInfo(type, host, port, socks_remote_dns, failoverTimeout, failoverProxy)
     */
    proxy.server = []; proxy.getName = [];
    for (var conf of proxy.validConfigs) {
      proxy.getName.push(conf.name);
      proxy.server.push(pS.newProxyInfo(conf.type, conf.host, conf.port, (conf.type == 'socks' && conf.remoteDNS ? Ci.nsIProxyInfo.TRANSPARENT_PROXY_RESOLVES_HOST : 0), 30, null));
    }

    // Refresh defaultProxy {nsIProxyInfo}
    proxy.defaultProxy = proxy.server[prefs.defaultProxy] || proxy.server[0];
    proxy.nameOfDefaultProxy = proxy.getName[prefs.defaultProxy] || proxy.getName[0];

    // Refresh fallbackProxy {nsIProxyInfo}
    proxy.fallbackProxy = prefs.fallbackProxy == -1 ?
           proxy.direct : proxy.server[prefs.fallbackProxy];

    if(prefs.fallbackProxy != -1){
      proxy.server.forEach(function(p){
        p.failoverProxy = proxy.fallbackProxy == p ? proxy.direct : proxy.fallbackProxy;
      });
    }

    pS.unregisterFilter(proxy);
    pS.registerFilter(proxy, 0);
  },

  /**
   * Convert proxy config(e.g.: prefs.knownProxy) to objects for convenient usage later
   *
   * @param config {String}
   * @return {Array} of objects
   */
  configToObj: function(config)
  {
    var proxyObjArray = [];

    for (var proxyAttr of config.split('$')) {
      proxyAttr = proxyAttr.split(';');
      if (proxyAttr.length < 4 || proxyAttr[0] == '' || isNaN(proxyAttr[2]))
        continue;

      var proxyObj = {};
      proxyObj.name = proxyAttr[0];
      proxyObj.host = proxyAttr[1] == '' ? '127.0.0.1' : proxyAttr[1];
      proxyObj.port = proxyAttr[2];
      proxyObj.type = /^socks4?$/i.test(proxyAttr[3]) ? proxyAttr[3] : 'http';
      proxyObj.remoteDNS = parseInt((typeof proxyAttr[4] == 'undefined') ? 1 : proxyAttr[4]);
      proxyObjArray.push(proxyObj);
    }

    return proxyObjArray.length == 0 ? false : proxyObjArray;
  },

  /**
   * Checks whether the location's scheme is proxyable
   *
   * @param location {nsIURI}
   * @return {Boolean}
   */
  isProxyableScheme: function(location)
  {
    return ['http', 'https', 'ftp', 'gopher'].some(
      function(scheme){return location.scheme==scheme;});
  },

  /**
   * Switch to specified proxy mode
   * @param mode {String} see this.mode
   */
  switchToMode: function(mode)
  {
    prefs.proxyMode = mode;
    prefs.save();
  },

  //
  // nsIProtocolProxyFilter implementation
  //
  applyFilter: function(pS, uri, aProxy)
  {
    if (prefs.proxyMode == 'disabled' || uri.schemeIs('feed'))
      return this.direct;

    var match = policy.autoMatching(uri);

    if (this.isNoProxy(match)) return this.direct;
    if (prefs.proxyMode == "auto")
      return this.getGroupProxy(match) || this.fallbackProxy;

    return this.defaultProxy;
  },

  // @todo: bug, whitelist in other group may overwrite "global no proxy" group
  isNoProxy: function(match)
  {
    if (match instanceof WhitelistFilter)
//      for (var s of match.subscriptions)
//        if (!s.disabled && s.url == "~wl~")
          return true;

    return false;
  },

  getGroupProxy: function(match)
  {
    if (!match || match instanceof WhitelistFilter) return null;
    for (var s of match.subscriptions)
      if (!s.disabled)
        return this.server[s.proxy] || this.defaultProxy;
  }
};

aup.proxy = proxy;

// @TODO: ";" & "$" is not allowed in proxy name
// @TODO: review editProxyServer.js
// @TODO: proxy name should be unique
// @TODO: aup.getString('no proxy') && aup.getString('default proxy') are reserved
