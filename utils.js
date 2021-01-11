window.escapeShellArg = function (arg, doubleQuotes) {
  let ret = "";

  if (doubleQuotes) {
    ret = arg.replace(/["\\]/g, (m) => `\\${m.slice(0, 1)}`);
    return `"${ret}"`;
  }

  ret = arg.replace(/'/g, (m) => `'\\${m.slice(0, 1)}'`);
  return `'${ret}'`;
};

window.toQueryString = function (obj) {
  let parts = [];
  for (let [key, values] of Object.entries(obj))
    if (Array.isArray(values))
      for (let value of values)
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    else parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(values)}`);

  return parts.join("&");
};

window.getFilenameFromContentDisposition = function (header) {
  let headerL = header.toLowerCase();

  let i;
  i = headerL.indexOf("filename*=utf-8''");
  if (i !== -1) {
    i += 17;
    let j = i;
    while (j < headerL.length && !/[\s;]/.test(headerL[j])) ++j;

    return decodeURIComponent(header.slice(i, j));
  }

  i = headerL.indexOf('filename="');
  if (i !== -1) {
    i += 10;
    let j = i;
    while (
      j < headerL.length &&
      !(header[j] === '"' && headerL.slice(j - 1, j + 1) !== '\\"')
    )
      ++j;

    return JSON.parse(header.slice(i - 1, j + 1));
  }

  i = headerL.indexOf("filename=");
  if (i !== -1) {
    i += 9;
    let j = i;
    while (j < headerL.length && !/[\s;]/.test(headerL[j])) ++j;

    return header.slice(i, j);
  }

  return null;
};

window.getFilenameFromUrl = function (url) {
  let j = url.indexOf("?");
  if (j === -1) j = url.indexOf("#");
  if (j === -1) j = url.length;

  let i = url.lastIndexOf("/", j);

  return decodeURIComponent(url.slice(i + 1, j));
};
