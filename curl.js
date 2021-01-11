"use strict";

function escapeGlobbing(url) {
  return url.replace(/[[\]{}]/g, (m) => `\\${m.slice(0, 1)}`);
}

window.curl = function (url, method, headers, payload, filename, options) {
  const esc = window.escapeShellArg;

  let contentType;
  let parts = ["curl"];

  for (let header of headers) {
    let headerName = header.name.toLowerCase();

    if (headerName === "content-type") {
      contentType = header.value.toLowerCase();
      let v = header.value;
      if (v.startsWith("multipart/form-data;")) v = v.slice(0, 19);
      let h = esc(`${header.name}: ${v}`, options.doubleQuotes);
      parts.push(`--header ${h}`);
    } else if (headerName === "content-length") {
      // Implicitly added by curl
    } else if (headerName === "referer") {
      parts.push(`--referer ${esc(header.value, options.doubleQuotes)}`);
    } else if (headerName === "cookie") {
      parts.push(`--cookie ${esc(header.value, options.doubleQuotes)}`);
    } else if (headerName === "user-agent") {
      parts.push(`--user-agent ${esc(header.value, options.doubleQuotes)}`);
    } else {
      let h = esc(`${header.name}: ${header.value}`, options.doubleQuotes);
      parts.push(`--header ${h}`);
    }
  }

  if (method !== "GET" || payload) parts.push(`--request ${method}`);

  if (payload)
    if (payload.formData) {
      if (contentType === "application/x-www-form-urlencoded")
        for (let [key, values] of Object.entries(payload.formData))
          for (let value of values) {
            let v = esc(
              `${encodeURIComponent(key)}=${value}`,
              options.doubleQuotes
            );
            parts.push(`--data-urlencode ${v}`);
          }
      else if (contentType.startsWith("multipart/form-data;"))
        // TODO comment about escaping of name value (e.g. = " ')
        for (let [key, values] of Object.entries(payload.formData))
          for (let value of values) {
            let v = esc(
              `${encodeURIComponent(key)}=${value}`,
              options.doubleQuotes
            );
            parts.push(`--form-string ${v}`);
          }
    } else if (payload.raw) {
      throw new Error("Unsupported upload data");
    }

  parts.push(esc(escapeGlobbing(url), options.doubleQuotes));

  if (filename) parts.push(`--output ${esc(filename, options.doubleQuotes)}`);
  else parts.push("--remote-name --remote-header-name");

  if (options.curlOptions) parts.push(options.curlOptions);

  return parts.join(" ");
};
