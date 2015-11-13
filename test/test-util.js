const util = require('../lib/util.js');
const prefs = require('sdk/simple-prefs').prefs;

exports["test escapeShellArg simple quotes"] = function(assert) {
  var cases = {
    "nothingToEscape": "'nothingToEscape'",
    "string with spaces": "'string with spaces'",
    "aSingle'ToEscape": "'aSingle'\\''ToEscape'",
    "anEscaped\\'ToEscape": "'anEscaped\\'\\''ToEscape'",
  };


  prefs.use_double_quotes = false;
  for (let k in cases) {
    assert.strictEqual(
      util.escapeShellArg(k),
      cases[k],
      "string is properly escaped"
    );
  }
};

exports["test escapeShellArg double quotes"] = function(assert) {
  var cases = {
    'nothingToEscape': '"nothingToEscape"',
    'string with spaces': '"string with spaces"',
    'aSingle"ToEscape': '"aSingle\\"ToEscape"',
    'anEscaped\\"ToEscape': '"anEscaped\\\\\\"ToEscape"',
  };


  prefs.use_double_quotes = true;
  for (let k in cases) {
    assert.strictEqual(
      util.escapeShellArg(k),
      cases[k],
      "string is properly escaped"
    );
  }
};

require("sdk/test").run(exports);
