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
 * Definition of Filter class and its subclasses.
 * This file is included from AutoProxy.js.
 */

/**
 * Abstract base class for filters
 *
 * @param {String} text   string representation of the filter
 * @constructor
 */
function Filter(text)
{
  this.text = text;
  this.subscriptions = [];
}
Filter.prototype =
{
  /**
   * String representation of the filter
   * @type String
   */
  text: null,

  /**
   * Filter subscriptions the filter belongs to
   * @type Array of Subscription
   */
  subscriptions: null,

  /**
   * Serializes the filter to an array of strings for writing out on the disk.
   * @param {Array of String} buffer  buffer to push the serialization results into
   */
  serialize: function(buffer)
  {
    buffer.push("[Filter]");
    buffer.push("text=" + this.text);
  },

  toString: function()
  {
    return this.text;
  }
};
aup.Filter = Filter;

/**
 * Cache for known filters, maps string representation to filter objects.
 * @type Object
 */
Filter.knownFilters = {__proto__: null};

/**
 * Regular expression that RegExp filters specified as RegExps should match
 * @type RegExp
 */
Filter.regexpRegExp = /^(@@)?\/.*\/(?:\$~?[\w\-]+(?:=[^,\s]+)?(?:,~?[\w\-]+(?:=[^,\s]+)?)*)?$/;

/**
 * Regular expression that options on a RegExp filter should match
 * @type RegExp
 */
Filter.optionsRegExp = /\$(~?[\w\-]+(?:=[^,\s]+)?(?:,~?[\w\-]+(?:=[^,\s]+)?)*)$/;

/**
 * Creates a filter of correct type from its text representation - does the basic parsing and
 * calls the right constructor then.
 *
 * @param {String} text   as in Filter()
 * @return {Filter} filter or null if the filter couldn't be created
 */
Filter.fromText = function(text)
{
  if (!/\S/.test(text))
    return null;

  if (text in Filter.knownFilters)
    return Filter.knownFilters[text];

  let ret;
  if (text[0] == "!")
    ret = new CommentFilter(text);
  else
    ret = RegExpFilter.fromText(text);

  Filter.knownFilters[ret.text] = ret;
  return ret;
}

/**
 * Deserializes a filter
 *
 * @param {Object}  obj map of serialized properties and their values
 * @return {Filter} filter or null if the filter couldn't be created
 */
Filter.fromObject = function(obj)
{
  let ret = Filter.fromText(obj.text);
  if (ret instanceof ActiveFilter)
  {
    if ("disabled" in obj)
      ret.disabled = (obj.disabled == "true");
    if ("hitCount" in obj)
      ret.hitCount = parseInt(obj.hitCount) || 0;
    if ("lastHit" in obj)
      ret.lastHit = parseInt(obj.lastHit) || 0;
  }
  return ret;
}

/**
 * Class for invalid filters
 * @param {String} text see Filter()
 * @param {String} reason Reason why this filter is invalid
 * @constructor
 * @augments Filter
 */
function InvalidFilter(text, reason)
{
  Filter.call(this, text);

  this.reason = reason;
}
InvalidFilter.prototype =
{
  __proto__: Filter.prototype,

  /**
   * Reason why this filter is invalid
   * @type String
   */
  reason: null,

  /**
   * See Filter.serialize()
   */
  serialize: function(buffer) {}
};
aup.InvalidFilter = InvalidFilter;

/**
 * Class for comments
 * @param {String} text see Filter()
 * @constructor
 * @augments Filter
 */
function CommentFilter(text)
{
  Filter.call(this, text);
}
CommentFilter.prototype =
{
  __proto__: Filter.prototype,

  /**
   * See Filter.serialize()
   */
  serialize: function(buffer) {}
};
aup.CommentFilter = CommentFilter;

/**
 * Abstract base class for filters that can get hits
 * @param {String} text see Filter()
 * @param {Array of String} domains  (optional) Domains that the filter is restricted to, e.g. ["foo.com", "bar.com", "~baz.com"]
 * @constructor
 * @augments Filter
 */
function ActiveFilter(text, domains)
{
  Filter.call(this, text);

  if (domains != null)
  {
    for (let domain of domains)
    {
      if (domain == "")
        continue;

      let hash = "includeDomains";
      if (domain[0] == "~")
      {
        hash = "excludeDomains";
        domain = domain.substr(1);
      }

      if (!this[hash])
        this[hash] = {__proto__: null};

      this[hash][domain] = true;
    }
  }
}
ActiveFilter.prototype =
{
  __proto__: Filter.prototype,

  /**
   * Defines whether the filter is disabled
   * @type Boolean
   */
  disabled: false,
  /**
   * Number of hits on the filter since the last reset
   * @type Number
   */
  hitCount: 0,
  /**
   * Last time the filter had a hit (in milliseconds since the beginning of the epoch)
   * @type Number
   */
  lastHit: 0,

  /**
   * Map containing domains that this filter should match on or null if the filter should match on all domains
   * @type Object
   */
  includeDomains: null,
  /**
   * Map containing domains that this filter should not match on or null if the filter should match on all domains
   * @type Object
   */
  excludeDomains: null,

  /**
   * Checks whether this filter is active on a domain.
   */
  isActiveOnDomain: function(/**String*/ docDomain) /**Boolean*/
  {
    // If the document has no host name, match only if the filter isn't restricted to specific domains
    if (!docDomain)
      return (!this.includeDomains);

    if (!this.includeDomains && !this.excludeDomains)
      return true;

    docDomain = docDomain.replace(/\.+$/, "").toUpperCase();

    while (true)
    {
      if (this.includeDomains && docDomain in this.includeDomains)
        return true;
      if (this.excludeDomains && docDomain in this.excludeDomains)
        return false;

      let nextDot = docDomain.indexOf(".");
      if (nextDot < 0)
        break;
      docDomain = docDomain.substr(nextDot + 1);
    }
    return (this.includeDomains == null);
  },

  /**
   * Checks whether this filter is active only on a domain and its subdomains.
   */
  isActiveOnlyOnDomain: function(/**String*/ docDomain) /**Boolean*/
  {
    if (!docDomain || !this.includeDomains)
      return false;

    docDomain = docDomain.replace(/\.+$/, "").toUpperCase();

    for (let domain in this.includeDomains)
      if (domain != docDomain && domain.indexOf("." + docDomain) != domain.length - docDomain.length - 1)
        return false;

    return true;
  },

  /**
   * See Filter.serialize()
   */
  serialize: function(buffer)
  {
    if (this.disabled || this.hitCount || this.lastHit)
    {
      Filter.prototype.serialize.call(this, buffer);
      if (this.disabled)
        buffer.push("disabled=true");
      if (this.hitCount)
        buffer.push("hitCount=" + this.hitCount);
      if (this.lastHit)
        buffer.push("lastHit=" + this.lastHit);
    }
  }
};
aup.ActiveFilter = ActiveFilter;

/**
 * Abstract base class for RegExp-based filters
 * @param {String} text see Filter()
 * @param {String} regexp       regular expression this filter should use
 * @param {Number} contentType  (optional) Content types the filter applies to, combination of values from RegExpFilter.typeMap
 * @param {Boolean} matchCase   (optional) Defines whether the filter should distinguish between lower and upper case letters
 * @param {String} domains      (optional) Domains that the filter is restricted to, e.g. "foo.com|bar.com|~baz.com"
 * @param {Boolean} thirdParty  (optional) Defines whether the filter should apply to third-party or first-party content only
 * @constructor
 * @augments ActiveFilter
 */
function RegExpFilter(text, regexp, contentType, matchCase, domains, thirdParty)
{
  ActiveFilter.call(this, text, domains ? domains.split("|") : null);

  if (contentType != null)
    this.contentType = contentType;
  if (matchCase)
    this.matchCase = matchCase;
  if (thirdParty != null)
    this.thirdParty = thirdParty;

  this.regexp = new RegExp(regexp, this.matchCase ? "" : "i");
}
RegExpFilter.prototype =
{
  __proto__: ActiveFilter.prototype,

  /**
   * Regular expression to be used when testing against this filter
   * @type RegExp
   */
  regexp: null,
  /**
   * 8 character string identifying this filter for faster matching
   * @type String
   */
  shortcut: null,
  /**
   * Content types the filter applies to, combination of values from RegExpFilter.typeMap
   * @type Number
   */
  contentType: 0x7FFFFFFF,
  /**
   * Defines whether the filter should distinguish between lower and upper case letters
   * @type Boolean
   */
  matchCase: false,
  /**
   * Defines whether the filter should apply to third-party or first-party content only. Can be null (apply to all content).
   * @type Boolean
   */
  thirdParty: null,

  /**
   * Tests whether the URL matches this filters
   * @param {String} location URL to be tested
   * @param {String} contentType content type identifier of the URL
   * @param {String} docDomain domain name of the document that loads the URL
   * @param {Boolean} thirdParty should be true if the URL is a third-party request
   * @return {Boolean}
   */
  matches: function(location, contentType, docDomain, thirdParty)
  {
    return ((RegExpFilter.typeMap[contentType] & this.contentType) != 0 &&
            (this.thirdParty == null || this.thirdParty == thirdParty) &&
            this.isActiveOnDomain(docDomain) && this.regexp.test(location));
  }
};
aup.RegExpFilter = RegExpFilter;

/**
 * Creates a RegExp filter from its text representation
 * @param {String} text   same as in Filter()
 */
RegExpFilter.fromText = function(text)
{
  let constructor = BlockingFilter;
  let origText = text;
  if (text.indexOf("@@") == 0)
  {
    constructor = WhitelistFilter;
    text = text.substr(2);
  }

  let contentType = null;
  let matchCase = null;
  let domains = null;
  let thirdParty = null;
  let options;
  if (Filter.optionsRegExp.test(text))
  {
    options = RegExp.$1.toUpperCase().split(",");
    text = text.replace(Filter.optionsRegExp, "");
    for (let option of options)
    {
      let value;
      [option, value] = option.split("=");
      option = option.replace(/-/, "_");
      if (option in RegExpFilter.typeMap)
      {
        if (contentType == null)
          contentType = 0;
        contentType |= RegExpFilter.typeMap[option];
      }
      else if (option[0] == "~" && option.substr(1) in RegExpFilter.typeMap)
      {
        if (contentType == null)
          contentType = 0x7FFFFFFF;
        contentType &= ~RegExpFilter.typeMap[option.substr(1)];
      }
      else if (option == "MATCH_CASE")
        matchCase = true;
      else if (option == "DOMAIN" && typeof value != "undefined")
        domains = value;
      else if (option == "THIRD_PARTY")
        thirdParty = true;
      else if (option == "~THIRD_PARTY")
        thirdParty = false;
    }
  }

  let regexp;
  if (text[0] == "/" && text[text.length - 1] == "/")   // filter is a regexp already
  {
    regexp = text.substr(1, text.length - 2);
  }
  else
  {
    // Issue 126: Strictly mapping to keyword blocking,
    // rule "example.com" should not match "httpS://example.com/"
    //
    // (trivial) bug here:
    //   "p://" will match almost nothing contrast to almost anything
    //   "http://abc" will not match http://example.com/?http://abc
    if (text.indexOf("http:") == 0) text = "|" + text;
    else if (text[0] != "|") text = "|http:*" + text;

    regexp = text.replace(/\*+/g, "*")        // remove multiple wildcards
                 .replace(/\^\|$/, "^")       // remove anchors following separator placeholder
                 .replace(/(\W)/g, "\\$1")    // escape special symbols
                 .replace(/\\\*/g, ".*")      // replace wildcards by .*
                 .replace(/\\\^/g, "(?:[^\\w\\-.%\\u0080-\\uFFFF]|$)")            // process separator placeholders
                 .replace(/^\\\|\\\|/, "^[\\w\\-]+:\\/+(?!\\/)(?:[^\\/]+\\.)?") // process extended anchor at expression start
                 .replace(/^\\\|/, "^")       // process anchor at expression start
                 .replace(/\\\|$/, "$")       // process anchor at expression end
                 .replace(/^(\.\*)/,"")       // remove leading wildcards
                 .replace(/(\.\*)$/,"");      // remove trailing wildcards 
  }
  if (regexp == "")
    regexp = ".*";

  if (constructor == WhitelistFilter && (contentType == null || (contentType & RegExpFilter.typeMap.DOCUMENT)) &&
      (!options || options.indexOf("DOCUMENT") < 0) && !/^\|?[\w\-]+:/.test(text))
  {
    // 0x7FFFFFFF & typeMap.* != 0
    // it means filter '@@||example.com' will match all content types
    if (contentType == null)
      contentType = 0x7FFFFFFF;
  }

  try
  {
    return new constructor(origText, regexp, contentType, matchCase, domains, thirdParty, false);
  }
  catch (e)
  {
    return new InvalidFilter(text, e);
  }
}

/**
 * Maps type strings like "SCRIPT" or "OBJECT" to bit masks
 */
RegExpFilter.typeMap = {
  OTHER: 1,
  SCRIPT: 2,
  IMAGE: 4,
  STYLESHEET: 8,
  OBJECT: 16,
  SUBDOCUMENT: 32,
  DOCUMENT: 64,
  BACKGROUND: 256,
  XBL: 512,
  PING: 1024,
  XMLHTTPREQUEST: 2048,
  OBJECT_SUBREQUEST: 4096,
  DTD: 8192,
  MEDIA: 16384,
  FONT: 32768
};

/**
 * Class for blocking filters
 * @param {String} text see Filter()
 * @param {String} regexp see RegExpFilter()
 * @param {Number} contentType see RegExpFilter()
 * @param {Boolean} matchCase see RegExpFilter()
 * @param {String} domains see RegExpFilter()
 * @param {Boolean} thirdParty see RegExpFilter()
 * @constructor
 * @augments RegExpFilter
 */
function BlockingFilter(text, regexp, contentType, matchCase, domains, thirdParty)
{
  RegExpFilter.call(this, text, regexp, contentType, matchCase, domains, thirdParty);
}
BlockingFilter.prototype =
{
  __proto__: RegExpFilter.prototype
};
aup.BlockingFilter = BlockingFilter;

/**
 * Class for whitelist filters
 * @param {String} text see Filter()
 * @param {String} regexp see RegExpFilter()
 * @param {Number} contentType see RegExpFilter()
 * @param {Boolean} matchCase see RegExpFilter()
 * @param {String} domains see RegExpFilter()
 * @param {Boolean} thirdParty see RegExpFilter()
 * @constructor
 * @augments RegExpFilter
 */
function WhitelistFilter(text, regexp, contentType, matchCase, domains, thirdParty)
{
  RegExpFilter.call(this, text, regexp, contentType, matchCase, domains, thirdParty);
}
WhitelistFilter.prototype =
{
  __proto__: RegExpFilter.prototype
}
aup.WhitelistFilter = WhitelistFilter;
