"use strict";

window.wget = function (url, method, headers, payload, filename, options) {
  const esc = window.escapeShellArg;

  let contentType;
  let parts = ["wget"];

  for (let header of headers) {
    let headerName = header.name.toLowerCase();

    if (headerName === "content-type") {
      contentType = header.value.toLowerCase();
      let v = header.value;
      if (v.startsWith("multipart/form-data;")) v = v.slice(0, 19);
      let h = esc(`${header.name}: ${v}`, options.doubleQuotes);
      parts.push(`--header ${h}`);
    } else if (headerName === "content-length") {
      // Implicitly added by wget
    } else if (headerName === "referer") {
      parts.push(`--referer ${esc(header.value, options.doubleQuotes)}`);
    } else if (headerName === "user-agent") {
      parts.push(`--user-agent ${esc(header.value, options.doubleQuotes)}`);
    } else {
      let h = esc(`${header.name}: ${header.value}`, options.doubleQuotes);
      parts.push(`--header ${h}`);
    }
  }

  if (method !== "GET" || payload) parts.push(`--method ${method}`);

  if (payload)
    if (payload.formData) {
      if (contentType === "application/x-www-form-urlencoded")
        parts.push(`--body-data ${window.toQueryString(payload.formData)}`);
      else if (contentType.startsWith("multipart/form-data;"))
        throw new Error("Unsupported upload data");
    } else if (payload.raw) {
      throw new Error("Unsupported upload data");
    }

  parts.push(esc(url, options.doubleQuotes));

  if (filename)
    parts.push(`--output-document ${esc(filename, options.doubleQuotes)}`);

  if (options.wgetOptions) parts.push(options.wgetOptions);

  return parts.join(" ");
};
