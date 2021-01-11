"use strict";

window.aria2 = function (url, method, headers, payload, filename, options) {
  if (method !== "GET") throw new Error("Unsupported HTTP method");

  const esc = window.escapeShellArg;

  let parts = ["aria2c"];

  for (let header of headers) {
    let headerName = header.name.toLowerCase();

    if (headerName === "referer") {
      parts.push(`--referer ${esc(header.value, options.doubleQuotes)}`);
    } else if (headerName === "user-agent") {
      parts.push(`--user-agent ${esc(header.value, options.doubleQuotes)}`);
    } else {
      let h = esc(`${header.name}: ${header.value}`, options.doubleQuotes);
      parts.push(`--header ${h}`);
    }
  }

  parts.push(esc(url, options.doubleQuotes));

  if (filename) parts.push(`--out ${esc(filename, options.doubleQuotes)}`);

  if (options.aria2Options) parts.push(options.aria2Options);

  return parts.join(" ");
};
