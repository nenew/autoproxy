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

/**
 * Fake browser implementation to make findbar widget happy - searches in
 * the filter list.
 */


let fastFindBrowser =
{
  fastFind: {
    searchString: null,
    foundLink: null,
    foundEditable: null,
    caseSensitive: false,
    _resultListeners: [],

    get currentWindow() { return fastFindBrowser.contentWindow; },

    find: function(searchString, linksOnly)
    {
      this.searchString = searchString;
      //return treeView.find(this.searchString, 0, false, this.caseSensitive);
      var result = treeView.find(this.searchString, 0, false, this.caseSensitive);
      this._notify(result, false);
    },

    findAgain: function(findBackwards, linksOnly)
    {
      //return treeView.find(this.searchString, findBackwards ? -1 : 1, false, this.caseSensitive);
      var result = treeView.find(this.searchString, findBackwards ? -1 : 1, false, this.caseSensitive);
      this._notify(result, findBackwards);
    },

    _notify: function(result, findBackwards){
      for (let listener of this._resultListeners){
        try {
          if (listener.onFindResult.length == 1){
            listener.onFindResult({
              result: result,
              findBackwards: findBackwards,
              earchString: this.searchString
            });
          }else{
            listener.onFindResult(result, findBackwards);
          }
        }catch(ex){}
      }
    },

    // Irrelevant for us
    addResultListener: function(listener) {
      if (this._resultListeners.indexOf(listener) === -1)
        this._resultListeners.push(listener);
    },
    removeResultListener: function(listener) {
      let index = this._resultListeners.indexOf(listener);
      if (index !== -1)
        this._resultListeners.splice(index, 1);
    },
    requestMatchesCount: function() {},
    enableSelection: function() {},
    highlight: function() {},
    focusContent: function () {},
    removeSelection: function () {},
    keyPress: function() {},
    getInitialSelection: function() {}
  },

  currentURI: aup.makeURL("http://example.com/"),
  contentWindow: {
    focus: function()
    {
      E("list").focus();
    },
    scrollByLines: function(num)
    {
      E("list").boxObject.scrollByLines(num);
    },
    scrollByPages: function(num)
    {
      E("list").boxObject.scrollByPages(num);
    },
  },

}

// compatibility with Nightly 26+
fastFindBrowser.finder = fastFindBrowser.fastFind;
fastFindBrowser.finder.fastFind = fastFindBrowser.fastFind.find;

