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
 * The Original Code is Adblock Plus.
 *
 * The Initial Developer of the Original Code is
 * Wladimir Palant.
 * Portions created by the Initial Developer are Copyright (C) 2006-2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

/*
 * Manages AutoProxy preferences.
 * This file is included from AutoProxy.js.
 */

const prefRoot = "extensions.autoproxy.";

var prefService = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);

var prefs = {
  lastVersion: null,
  disableObserver: false,
  privateBrowsing: false,
  branch: prefService.getBranch(prefRoot),
  prefList: [],
  listeners: [],

  addObservers: function() {
    // Observe preferences changes
    try {
      var branchInternal = this.branch.QueryInterface(Ci.nsIPrefBranchInternal);
      branchInternal.addObserver("", this, true);
    }
    catch (e) {
      dump("AutoProxy: exception registering pref observer: " + e + "\n");
    }

    // Add Private Browsing observer
    if ("@mozilla.org/privatebrowsing;1" in Cc)
    {
      try
      {
        this.privateBrowsing = Cc["@mozilla.org/privatebrowsing;1"].getService(Ci.nsIPrivateBrowsingService).privateBrowsingEnabled;

        var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
        observerService.addObserver(this, "private-browsing", true);
      }
      catch(e)
      {
        dump("AutoProxy: exception initializing private browsing observer: " + e + "\n");
      }
    }
  },

  init: function()
  {
    // Initialize prefs list
    var defaultBranch = prefService.getDefaultBranch(prefRoot);
    var defaultPrefs = defaultBranch.getChildList("", {});
    var types = {};
    types[defaultBranch.PREF_INT] = "Int";
    types[defaultBranch.PREF_BOOL] = "Bool";

    this.prefList = [];
    for (var name of defaultPrefs) {
      var type = defaultBranch.getPrefType(name);
      var typeName = (type in types ? types[type] : "Char");

      try {
        var pref = [name, typeName, defaultBranch["get" + typeName + "Pref"](name)];
        this.prefList.push(pref);
        this.prefList[" " + name] = pref;
      } catch(e) {}
    }

    // Initial prefs loading
    this.reload();

    // Update lastVersion pref if necessary
    this.lastVersion = this.currentVersion;
    if (this.currentVersion != aup.getInstalledVersion())
    {
      this.currentVersion = aup.getInstalledVersion();
      this.save();
    }

    // Add observers for pref changes
    prefs.addObservers();
  },

  // Loads a pref and stores it as a property of the object
  loadPref: function(pref) {
    try {
      if (pref[0] == "customProxy")
        this[pref[0]] = decodeURI(this.branch["get" + pref[1] + "Pref"](pref[0]));
      else if (pref[0] == "default_proxy")
        this["defaultProxy"] = this.branch["get" + pref[1] + "Pref"](pref[0]);
      else
        this[pref[0]] = this.branch["get" + pref[1] + "Pref"](pref[0]);
    }
    catch (e) {
      // Use default value
      this[pref[0]] = pref[2];
    }
  },

  // Saves a property of the object into the corresponding pref
  savePref: function(pref) {
    try {
      if (pref[0] == "customProxy")
        this.branch["set" + pref[1] + "Pref"](pref[0], encodeURI(this[pref[0]]));
      else if (pref[0] == "default_proxy")
        this.branch["set" + pref[1] + "Pref"](pref[0], this["defaultProxy"]);
      else
        this.branch["set" + pref[1] + "Pref"](pref[0], this[pref[0]]);
    }
    catch (e) {}
  },

  // Reloads the preferences
  reload: function() {
    // Load data from prefs.js
    for (let i = 0; i < this.prefList.length; i++)
      this.loadPref(this.prefList[i]);

    // Fire pref listeners
    for (var listener of this.listeners)
      listener(this);
  },

  // Saves the changes back into the prefs
  save: function() {
    this.disableObserver = true;

    for (let i = 0; i < this.prefList.length; i++)
      this.savePref(this.prefList[i]);

    this.disableObserver = false;

    // Make sure to save the prefs on disk (and if we don't - at least reload the prefs)
    try {
      prefService.savePrefFile(null);
    }
    catch(e) {}

    this.reload();
  },

  addListener: function(handler) {
    this.listeners.push(handler);
  },

  removeListener: function(handler) {
    for (var i = 0; i < this.listeners.length; i++)
      if (this.listeners[i] == handler)
        this.listeners.splice(i--, 1);
  },

  // nsIObserver implementation
  observe: function(subject, topic, prefName) {
    if (topic == "private-browsing")
    {
      if (prefName == "enter")
        this.privateBrowsing = true;
      else if (prefName == "exit")
        this.privateBrowsing = false;
    }
    else if (!this.disableObserver)
      this.reload();
  },

  // nsISupports implementation
  QueryInterface: XPCOMUtils.generateQI([Ci.nsISupportsWeakReference, Ci.nsIObserver])
};

aup.prefs = prefs;
