/**
 * This file contains the CLI command generators.
 *
 * Every exported function should have this prototype:
 * fn(object request, string filename) -> string
 *
 * See the definition of getRequestInfo in main.js to see what "request"
 * contains.
 */

const prefs = require('sdk/simple-prefs').prefs;
const escapeShellArg = require('./util.js').escapeShellArg;

exports.wget = function(request, filename) {
  if (
    request.method === 'GET' && request.payload ||
    request.method === 'POST' && !request.payload
  ) {
    return null;
  }

  let cmd = "wget";

  for (let i in request.headers) {
    cmd += ' --header=' + escapeShellArg(request.headers[i]);
  }

  if (request.payload)
    cmd += ' --post-data ' + escapeShellArg(request.payload);

  cmd += ' ' + escapeShellArg(request.uri);

  if (filename)
    cmd += ' -O ' + escapeShellArg(filename);

  let wgetOptions = prefs['wget.options'];
  if (wgetOptions)
    cmd += ' ' + wgetOptions;

  return cmd;
};

exports.curl = function(request, filename) {
  let cmd = "curl";

  for (let i in request.headers) {
    cmd += ' --header ' + escapeShellArg(request.headers[i]);
  }

  if (request.method !== 'GET' || request.payload)
    cmd += ' -X ' + request.method;

  if (request.payload)
    cmd += ' --data-binary ' + escapeShellArg(request.payload);

  cmd += ' ' + escapeShellArg(request.uri);

  if (filename)
    cmd += ' -o ' + escapeShellArg(filename);
  else
    cmd += ' -O -J';

  let curlOptions = prefs['curl.options'];
  if (curlOptions)
    cmd += ' ' + curlOptions;

  return cmd;
};

exports.aria2 = function(request, filename) {
  if (request.method !== "GET" || request.payload)
    return null;

  let cmd = "aria2c";

  for (let i in request.headers) {
    cmd += ' --header ' + escapeShellArg(request.headers[i]);
  }

  if (filename)
    cmd += ' --out ' + escapeShellArg(filename);

  cmd += ' ' + escapeShellArg(request.uri);

  let aria2Options = prefs['aria2.options'];
  if (aria2Options)
    cmd += ' ' + aria2Options;

  return cmd;
};
