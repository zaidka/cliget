const prefs = require('sdk/simple-prefs').prefs;

exports.escapeShellArg = function(arg) {
  let ret = '';

  if (prefs.use_double_quotes) {
    ret = arg.replace(/["\\]/g, function (m, i, s) {
      return '\\' + m.slice(0, 1);
    });

    return '"' + ret + '"';
  }

  ret = arg.replace(/'/g, function (m, i, s) {
    return "'\\" + m.slice(0, 1) + "'";
  });

  return "'" + ret + "'";
};
