const windowUtils = require('window-utils');
const events = require("sdk/system/events");
const {Cc, Ci, Cu} = require('chrome');
const clipboard = require('sdk/clipboard');
const prefs = require('simple-prefs').prefs;
const contextMenu = require('sdk/context-menu');
const {Class} = require('sdk/core/heritage');
const {Unknown, Service} = require('sdk/platform/xpcom');
const {Request} = require('request');
const data = require('self').data;

var NetUtil = {};
Cu.import('resource://gre/modules/NetUtil.jsm', NetUtil);
NetUtil = NetUtil.NetUtil;

var recentChannels = [];

function escapeShellArg(arg) {
  let ret = '';

  if (prefs['use_double_quotes']) {
    ret = arg.replace(/["\\]/g, function (m, i, s) {
      return '\\' + m.slice(0, 1);
    });
    return '"' + ret + '"';
  }

  ret = arg.replace(/'/g, function (m, i, s) {
    return "'\\" + m.slice(0, 1) + "'";
  });
  return "'" + ret + "'";
}


function getDownloadCommands(httpChannel, filename) {
  let headerVisitor = {
    headers: [],
    visitHeader: function(aHeader, aValue) {
      this.headers.push(aHeader + ': ' + aValue);
    }
  };

  httpChannel.visitRequestHeaders(headerVisitor);

  let uri = httpChannel.URI.spec;
  let requestMethod = httpChannel.requestMethod;
  let payload = null;

  let inputStream = httpChannel.QueryInterface(Ci.nsIUploadChannel).uploadStream;
  if (inputStream) {
    let streamPos = inputStream.tell()
    inputStream.seek(0, 0);
    let body = NetUtil.readInputStreamToString(inputStream, inputStream.available(), {});
    let i = body.indexOf("\r\n\r\n");
    payload = body.substring(i+4);
    let bodyHeader = body.substring(0, i);
    if (bodyHeader.indexOf('application/x-www-form-urlencoded') == -1)
      return {}; // can't include binary data in command

    let bodyHeaders = bodyHeader.split("\r\n");

    for (h in bodyHeaders) {
      headerVisitor.headers.push(bodyHeaders[h]);
    }
    inputStream.seek(0, streamPos); // back to its original position
  }

  let ret = {};

  // Generating wget command
  if (prefs['wget'] && ((requestMethod == 'GET' && !payload) || (requestMethod == 'POST' && payload))) {
    ret.wget = 'wget';

    for (let i in headerVisitor.headers) {
      let h = headerVisitor.headers[i];
      if (h.substring(0, 15).toLowerCase() == 'accept-encoding' && prefs['remove_accept_encoding'])
        continue;
      ret.wget += ' --header=' + escapeShellArg(h);
    }

    if (payload)
      ret.wget += ' --post-data ' + escapeShellArg(payload);

    ret.wget += ' ' + escapeShellArg(uri);

    if (filename)
      ret.wget += ' -O ' + escapeShellArg(filename);

    let wgetOptions = prefs['wget.options'];
    if (wgetOptions)
      ret.wget += ' ' + wgetOptions;
  }

  // Generating curl command
  if (prefs['curl']) {
    ret.curl = 'curl';

    for (let i in headerVisitor.headers) {
      let h = headerVisitor.headers[i];
      if (h.substring(0, 15).toLowerCase() == 'accept-encoding' && prefs['remove_accept_encoding'])
        continue;
      ret.curl += ' --header ' + escapeShellArg(h);
    }

    if (requestMethod != 'GET' || payload)
      ret.curl += ' -X ' + requestMethod;

    if (payload)
      ret.curl += ' --data-binary ' + escapeShellArg(payload);

    ret.curl += ' ' + escapeShellArg(uri);

    if (filename)
      ret.curl += ' -o ' + escapeShellArg(filename);
    else
      ret.curl += ' -O -J';

    let curlOptions = prefs['curl.options'];
    if (curlOptions)
      ret.curl += ' ' + curlOptions;
  }

  // Generating aria2 command
  if (prefs['aria2'] && (requestMethod == 'GET' && !payload)) {
    ret.aria2 = 'aria2c';

    for (let i in headerVisitor.headers) {
      let h = headerVisitor.headers[i];
      if (h.substring(0, 15).toLowerCase() == 'accept-encoding' && prefs['remove_accept_encoding'])
        continue;
      ret.aria2 += ' --header ' + escapeShellArg(h);
    }

    if (filename)
      ret.aria2 += ' --out ' + escapeShellArg(filename);

    ret.aria2 += ' ' + escapeShellArg(uri);

    let aria2Options = prefs['aria2.options'];
    if (aria2Options)
      ret.aria2 += ' ' + aria2Options;
  }

  return ret;
}


function createDownloadElement(window, cmdtype, cmd) {
  let vbox = window.document.createElement('vbox');
  let label = window.document.createElement('label');
  label.setAttribute('value', 'Download with ' + cmdtype);
  vbox.appendChild(label);

  let hbox = window.document.createElement('hbox');
  vbox.appendChild(hbox);

  let textbox = window.document.createElement('textbox');
  hbox.appendChild(textbox);
  textbox.setAttribute('flex', 1);
  textbox.setAttribute('readonly', 'true');
  textbox.setAttribute('clickSelectsAll', 'true');
  textbox.setAttribute('value', cmd);

  let button = window.document.createElement('button');
  hbox.appendChild(button);
  button.setAttribute('label', 'Copy');
  button.onclick = function () {
    clipboard.set(cmd);
    window.close();
  }

  return vbox;
}


function copyCommandForUri(uri, type) {
  function listener(event) {
    if (event.subject.QueryInterface(Ci.nsIChannel).originalURI.spec == uri) {
      let cmd = getDownloadCommands(event.subject.QueryInterface(Ci.nsIHttpChannel), null);
      clipboard.set(cmd[type]);

      event.subject.QueryInterface(Ci.nsIRequest).cancel(0);
      events.off('http-on-modify-request', listener);
    }
  };

  events.on('http-on-modify-request', listener);

  Request({url: uri}).get();
}


// This is an active module of the cliget Add-on
exports.main = function() {
  contextMenu.Menu({
    label: 'cliget',
    contentScriptFile: data.url('context-menu.js'),
    items: [],
    onMessage: function (arg) {
      if (typeof arg == 'string') {
        arg = JSON.parse(arg);
        copyCommandForUri(arg.uri, arg.type);
      }
      else {
        menuItems = [];
        for (var t in arg) {
          if (prefs['curl'])
            menuItems.push(contextMenu.Item({
              label: 'Copy curl for ' + t,
              data: JSON.stringify({uri: arg[t], type: 'curl'})
            }));
          if (prefs['wget'])
            menuItems.push(contextMenu.Item({
              label: 'Copy wget for ' + t,
              data: JSON.stringify({uri: arg[t], type: 'wget'})
            }));
          if (prefs['aria2'])
            menuItems.push(contextMenu.Item({
              label: 'Copy aria2 for ' + t,
              data: JSON.stringify({uri: arg[t], type: 'aria2'})
            }));
        }
        this.items = menuItems;
      }
    }
  });

  windowUtils = new windowUtils.WindowTracker({
    onTrack: function (window) {
      if ('chrome://mozapps/content/downloads/unknownContentType.xul' != window.location)
        return;

      let parent = window.document.getElementById('unknownContentType');
      if (!parent)
        return;

      // find channel
      let channel = null;
      for (let i = 0; i < recentChannels.length; ++ i) {
        if (recentChannels[i].URI.equals(window.dialog.mLauncher.source)) {
          channel = recentChannels[i];
          recentChannels.splice(i, 1);
        }
      }
      if (!channel)
        return;

      let filename = window.dialog.mLauncher.suggestedFileName;
      let cmd = getDownloadCommands(channel, filename);

      if (cmd.curl) {
        let el = window.document.createElement('vbox');
        el.appendChild(createDownloadElement(window, 'cURL', cmd.curl));
        parent.appendChild(el);
      }

      if (cmd.wget) {
        let el = window.document.createElement('vbox');
        el.appendChild(createDownloadElement(window, 'Wget', cmd.wget));
        parent.appendChild(el);
      }

      if (cmd.aria2) {
        let el = window.document.createElement('vbox');
        el.appendChild(createDownloadElement(window, 'aria2', cmd.aria2));
        parent.appendChild(el);
      }
    }
  });
};


var contractId = '@mozilla.org/uriloader/external-helper-app-service;1';

// Implement a wrapper around external helper app service
var DownloadHelper = Class({
  extends: Unknown,
  get wrappedJSObject() this,

  originalService: Cc[contractId].getService(),

  QueryInterface: function(interface) {
    var srv = this.originalService.QueryInterface(interface);
    for (let i in srv)
      if (!(i in this))
        this[i] = function() {
          return srv[i].apply(srv, arguments);
        };
    return this;
  },

  doContent: function(aMimeContentType, aRequest, aWindowContext, aForceSave) {
    if (aRequest instanceof Ci.nsIHttpChannel)
      recentChannels.push(aRequest.QueryInterface(Ci.nsIHttpChannel));

    if (recentChannels.length >= 10)
      recentChannels.splice(0, recentChannels.length - 10);
    return this.originalService.QueryInterface(Ci.nsIExternalHelperAppService)
      .doContent(aMimeContentType, aRequest, aWindowContext, aForceSave);
  }
});

// Register the service using the contract ID
var service = Service({
  contract: contractId,
  Component: DownloadHelper
});
