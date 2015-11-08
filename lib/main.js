const windowUtils = require('sdk/deprecated/window-utils');
const events = require("sdk/system/events");
const {Cc, Ci, Cu} = require('chrome');
const clipboard = require('sdk/clipboard');
const prefs = require('sdk/simple-prefs').prefs;
const contextMenu = require('sdk/context-menu');
const {Class} = require('sdk/core/heritage');
const {Unknown, Service} = require('sdk/platform/xpcom');
const {Request} = require('sdk/request');
const data = require('sdk/self').data;
const getters = require('./getters.js');

var NetUtil = {};
Cu.import('resource://gre/modules/NetUtil.jsm', NetUtil);
NetUtil = NetUtil.NetUtil;

var recentChannels = [];

function getDownloadCommands(httpChannel, filename) {
  let request = getRequestInfo(httpChannel);
  if (request === null) {
    return {};
  }

  if (prefs.remove_accept_encoding) {
    request.headers = request.headers.filter(function(h) {
      return h.substring(0, 15).toLowerCase() !== 'accept-encoding';
    });
  }

  let ret = {};
  for (let getter in getters) {
    if (prefs[getter]) {
      let command = getters[getter](request, filename);
      if (command !== null) {
        ret[getter] = command;
      }
    }
  }

  return ret;
}

/**
 * Return the basic HTTP request info contained in a nsIHttpChannel.
 *
 * @param nsIHttpChannel httpChannel
 * @return {
 *   uri: string
 *   method: string "POST" or "GET"
 *   payload: string body sent by the client in POST requests
 *   headers: []string
 * }
 */
function getRequestInfo(httpChannel) {
  let headerVisitor = {
    headers: [],
    visitHeader: function(aHeader, aValue) {
      this.headers.push(aHeader + ': ' + aValue);
    }
  };

  httpChannel.visitRequestHeaders(headerVisitor);

  let payload = null;

  return {
    headers: headerVisitor.headers,
    method: httpChannel.requestMethod,
    payload: payload,
    uri: httpChannel.URI.spec,
  };
}

/**
 * Return the POST payload from an nsIHttpChannel.
 *
 * @param nsIHttpChannel httpChannel
 * @return string|null
 */
function getPayload(httpChannel) {
  let inputStream = httpChannel.QueryInterface(Ci.nsIUploadChannel).uploadStream;
  if (!inputStream)
    return null;

  let originalStreamPos = inputStream.tell();
  inputStream.seek(0, 0);

  let response = NetUtil.readInputStreamToString(
    inputStream,
    inputStream.available(),
    {}
  );

  let i = response.indexOf("\r\n\r\n");
  let headers = response.substring(0, i);
  let payload = response.substring(i + 4);

  if (headers.indexOf('application/x-www-form-urlencoded') === -1)
    return null; // can't include binary data in command

  headerVisitor.headers = headerVisitor.headers.concat(
      headers.split("\r\n")
  );

  inputStream.seek(0, originalStreamPos); // back to its original position

  return payload;
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
  };

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
  }

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
          for (let name in getters) {
            if (prefs[name]) {
              menuItems.push(contextMenu.Item({
                label: 'Copy ' + name + ' for ' + t,
                data: JSON.stringify({uri: arg[t], type: name})
              }));
            }
          }
        }
        this.items = menuItems;
      }
    }
  });

  windowTracker = new windowUtils.WindowTracker({
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
      let commands = getDownloadCommands(channel, filename);

      for (let name in commands) {
        if (commands[name] !== null) {
          let el = window.document.createElement('vbox');
          el.appendChild(createDownloadElement(window, name, commands[name]));
          parent.appendChild(el);
        }
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
    for (let i in srv) {
      if (!(i in this)) {
        this[i] = function() {
          return srv[i].apply(srv, arguments);
        }; /* TODO: fix this. */ // jshint ignore:line
      }
    }
    return this;
  },

  doContent: function(aMimeContentType, aRequest, aWindowContext, aForceSave) {
    if (aRequest instanceof Ci.nsIHttpChannel)
      recentChannels.push(aRequest.QueryInterface(Ci.nsIHttpChannel));

    if (recentChannels.length >= 10)
      recentChannels.splice(0, recentChannels.length - 10);
    return this.originalService.QueryInterface(Ci.nsIExternalHelperAppService).doContent.apply(this, arguments);
  }
});

// Register the service using the contract ID
var service = Service({
  contract: contractId,
  Component: DownloadHelper
});
