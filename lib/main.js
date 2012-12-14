const windowUtils = require('window-utils');
const observer = require('observer-service');
const {Cc, Ci} = require('chrome');
const clipboard = require('clipboard');
const prefs = require('simple-prefs').prefs;
const contextMenu = require('context-menu');
const apiUtils = require('api-utils');
const {Class} = require("sdk/core/heritage.js");
const {Unknown, Service} = require('api-utils/xpcom');
const {Request} = require('request');


var recentChannels = [];

// original: https://raw.github.com/kvz/phpjs/master/functions/exec/escapeshellarg.js
function escapeshellarg(arg) {
  let ret = '';

  if (prefs['use_double_quotes']) {
    ret = arg.replace(/[^\\]"/g, function (m, i, s) {
      return m.slice(0, 1) + '\\"';
    });
    return '"' + ret + '"';
  }

  ret = arg.replace(/[^\\]'/g, function (m, i, s) {
    return m.slice(0, 1) + '\\\'';
  });
  return "'" + ret + "'";
}


function getDownloadCommands(httpChannel, filename) {
  let headerVisitor = {
    headers: [],
    visitHeader: function(aHeader, aValue) {
      this.headers.push({'name' : aHeader, 'value' : aValue});
    }
  };
  
  httpChannel.visitRequestHeaders(headerVisitor);
  
  let uri = httpChannel.URI.spec;
  let ret = {};
  
  // Generating wget command
  if (prefs['wget']) {
    ret.wget = 'wget';
    
    for (let i in headerVisitor.headers) {
      let n = headerVisitor.headers[i].name;
      let v = headerVisitor.headers[i].value;
      ret.wget += ' --header=' + escapeshellarg(n + ': ' + v);
    }
    
    ret.wget += ' ' + escapeshellarg(uri);
    
    if (filename)
      ret.wget += ' -O ' + escapeshellarg(filename);
    
    let wgetOptions = prefs['wget.options'];
    if (wgetOptions)
      ret.wget += ' ' + wgetOptions;
  }

  // Generating curl command
  if (prefs['curl']) {
    ret.curl = 'curl';

    for (let i in headerVisitor.headers) {
      let n = headerVisitor.headers[i].name;
      let v = headerVisitor.headers[i].value;
      ret.curl += ' --header ' + escapeshellarg(n + ': ' + v);
    }

    ret.curl += ' ' + escapeshellarg(uri);

    if (filename)
      ret.curl += ' -o ' + escapeshellarg(filename);
    else
      ret.curl += ' -O -J';

    let curlOptions = prefs['curl.options'];
    if (curlOptions)
      ret.curl += ' ' + curlOptions;
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
  }
  
  return vbox;
}


// A context-menu context that enables or disables menu item based on addon preferences
function PreferencesContext(pref) {
  this.isCurrent = function PreferencesContext_isCurrent(popupNode) {
    return prefs[pref];
  };
}

PreferencesContext.prototype = new contextMenu.PageContext();
PreferencesContext = apiUtils.publicConstructor(PreferencesContext);


copyLinkContentScript = '\
self.on("click", function (node, data) {\
  self.postMessage(node.href);\
});\
';
copyImgContentScript = '\
self.on("click", function (node, data) {\
  self.postMessage(node.src);\
});\
';
copyPageContentScript = '\
self.on("click", function (node, data) {\
  self.postMessage(location.href);\
});\
';


function CopyCommandForUri(uri, type) {
  this.uri = uri;
  this.type = type;

  this.call = function(self, subject, data) {
    if (subject.QueryInterface(Ci.nsIChannel).originalURI.spec == uri) {
      let cmd = getDownloadCommands(subject.QueryInterface(Ci.nsIHttpChannel), null);
      clipboard.set(cmd[type]);

      subject.QueryInterface(Ci.nsIRequest).cancel(0);
      observer.remove('http-on-modify-request', this);
    }
  };

  observer.add('http-on-modify-request', this);

  Request({url: uri}).get();
}


// This is an active module of the cliget Add-on
exports.main = function() {
  // wget
  contextMenu.Item({
    label: 'Copy wget for link',
    context: [PreferencesContext('wget'), contextMenu.SelectorContext('a[href]')],
    contentScript: copyLinkContentScript,
    onMessage: function (uri) {new CopyCommandForUri(uri, 'wget');}
  });

  contextMenu.Item({
    label: 'Copy wget for image',
    context: [PreferencesContext('wget'), contextMenu.SelectorContext('img')],
    contentScript: copyImgContentScript,
    onMessage: function (uri) {new CopyCommandForUri(uri, 'wget');}
  });

  contextMenu.Item({
    label: 'Copy wget for page',
    context: [PreferencesContext('wget'), contextMenu.PageContext()],
    contentScript: copyPageContentScript,
    onMessage: function (uri) {new CopyCommandForUri(uri, 'wget');}
  });

  // curl
  contextMenu.Item({
    label: 'Copy curl for link',
    context: [PreferencesContext('curl'), contextMenu.SelectorContext('a[href]')],
    contentScript: copyLinkContentScript,
    onMessage: function (uri) {new CopyCommandForUri(uri, 'curl');}
  });

  contextMenu.Item({
    label: 'Copy curl for image',
    context: [PreferencesContext('curl'), contextMenu.SelectorContext('img')],
    contentScript: copyImgContentScript,
    onMessage: function (uri) {new CopyCommandForUri(uri, 'curl');}
  });

  contextMenu.Item({
    label: 'Copy curl for page',
    context: [PreferencesContext('curl'), contextMenu.PageContext()],
    contentScript: copyPageContentScript,
    onMessage: function (uri) {new CopyCommandForUri(uri, 'curl');}
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
      
      if (cmd.wget) {
        let el = window.document.createElement('vbox');
        el.appendChild(createDownloadElement(window, 'Wget', cmd.wget));
        parent.appendChild(el);
      }

      if (cmd.curl) {
        let el = window.document.createElement('vbox');
        el.appendChild(createDownloadElement(window, 'cURL', cmd.curl));
        parent.appendChild(el);
      }
    }
  });
};


var contractId = '@mozilla.org/uriloader/external-helper-app-service;1';

// Implement the service by subclassing Unknown
var DownloadHelper = Class({
  extends: Unknown,

  interfaces: ['nsIExternalHelperAppService'],

  get wrappedJSObject() this,

  originalService: Cc[contractId].getService(Ci.nsIExternalHelperAppService),

  applyDecodingForExtension: function(aExtension, aEncodingType) {
    return this.originalService.applyDecodingForExtension(aExtension, aEncodingType);
  },

  doContent: function(aMimeContentType, aRequest, aWindowContext, aForceSave) {
    recentChannels.push(aRequest.QueryInterface(Ci.nsIHttpChannel));
    if (recentChannels.length >= 10)
      recentChannels.splice(0, recentChannels.length - 10);
    return this.originalService.doContent(aMimeContentType, aRequest, aWindowContext, aForceSave);
  }
});
 
// Register the service using the contract ID
var service = Service({
  contract: contractId,
  Component: DownloadHelper
});
