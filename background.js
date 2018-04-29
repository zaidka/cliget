"use strict";

const MAX_ITEMS = 10;

const downloads = new Map();
const pages = new Map();
const currentRequests = new Map();

const defaultOptions = {
  doubleQuotes: false,
  excludeHeaders: "Accept-Encoding Connection",
  command: "curl",
  curlOptions: "",
  wgetOptions: "",
  aria2Options: ""
};

function getOptions() {
  return new Promise(resolve => {
    browser.storage.local.get().then(res => {
      res = Object.assign({}, defaultOptions, res);
      resolve(res);
    });
  });
}

function setOptions(values) {
  new Promise(resolve => {
    browser.storage.local.set(values).then(() =>
      getOptions().then(c => {
        resolve(c);
      })
    );
  });
}

function resetOptions() {
  new Promise(resolve => {
    browser.storage.local.clear().then(() =>
      getOptions().then(c => {
        resolve(c);
      })
    );
  });
}

function clear() {
  downloads.clear();
}

function getDownloadList() {
  const list = [];
  for (let [reqId, req] of downloads)
    list.push({
      id: reqId,
      url: req.url,
      filename: req.filename,
      size: req.size
    });

  return list;
}

function getPageRequest(pageUrl) {
  var pageRequest;
  for (let [reqId, req] of pages)
	  if (pageUrl == req.url) {
		  pageRequest = {
	      id: reqId,
	      url: req.url,
	      filename: req.filename,
	      size: req.size
	    };
	  }
  return pageRequest;
}

function generateCommand(reqId, options) {
  let request = downloads.get(reqId);
  if (!request) {
	  request = pages.get(reqId);
	  if (!request) {
		  throw new Error("Request not found");
	  }
  }

  let excludeHeaders = options.excludeHeaders
    .split(" ")
    .map(h => h.toLowerCase());

  let headers = request.headers.filter(
    h => excludeHeaders.indexOf(h.name.toLowerCase()) === -1
  );

  const cmd = window[options.command](
    request.url,
    request.method,
    headers,
    request.payload,
    request.filename,
    options
  );

  return cmd;
}

function handleMessage(msg) {
  const name = msg[0];
  const args = msg.slice(1);

  if (name === "getOptions") return getOptions();
  else if (name === "setOptions") return setOptions(...args);
  else if (name === "resetOptions") return resetOptions();
  else if (name === "getDownloadList")
    return new Promise(resolve => resolve(getDownloadList()));
  else if (name === "clear") return clear(...args);
  else if (name === "getPageRequest")
	  return new Promise(resolve => resolve(getPageRequest(...args)));
  else if (name === "generateCommand")
    return new Promise(resolve => {
      try {
        resolve(generateCommand(...args));
      } catch (err) {
        resolve(err.message);
      }
    });
}

browser.runtime.onMessage.addListener(handleMessage);

function onBeforeRequest(details) {
  if (
    (details.type === "main_frame" || details.type === "sub_frame") &&
    details.tabId >= 0
  ) {
    const now = Date.now();

    // Just in case of a leak
    currentRequests.forEach((req, reqId) => {
      if (req.timestamp + 10000 < now) currentRequests.delete(reqId);
    });

    const req = {
      id: details.requestId,
      method: details.method,
      url: details.url,
      timestamp: now,
      payload: details.requestBody
    };
    currentRequests.set(details.requestId, req);
  }
}

function onSendHeaders(details) {
  const req = currentRequests.get(details.requestId+" "+details.url);
  if (req) {
    req.headers = details.requestHeaders;
  } else if (
    (details.type === "main_frame" || details.type === "sub_frame") &&
    details.tabId >= 0 &&
    details.method === "GET"
  ) {
    // Firefox 52 (ESR) doesn't call "onBeforeRequest" because requestBody
    // property isn't supported
    const now = Date.now();

    // Just in case of a leak
    currentRequests.forEach((r, reqId) => {
      if (r.timestamp + 10000 < now) currentRequests.delete(reqId);
    });

    currentRequests.set(details.requestId, {
      id: details.requestId,
      method: details.method,
      url: details.url,
      timestamp: now,
      headers: details.requestHeaders
    });
  }
}

function onResponseStarted(details) {
  const request = currentRequests.get(details.requestId);

  if (!request) return;

  currentRequests.delete(details.requestId);

  if (details.statusCode !== 200 || details.fromCache) return;

  let contentType, contentDisposition;

  for (let header of details.responseHeaders) {
    let headerName = header.name.toLowerCase();
    if (headerName === "content-type") {
      contentType = header.value.toLowerCase();
    } else if (headerName === "content-disposition") {
      contentDisposition = header.value.toLowerCase();
      request.filename = window.getFilenameFromContentDisposition(header.value);
    } else if (headerName === "content-length") {
      request.size = +header.value;
    }
  }

  if (!contentDisposition || !contentDisposition.startsWith("attachment"))
    if (
      contentType.startsWith("text/plain") ||
      contentType.startsWith("image/") ||
      contentType.startsWith("application/xhtml") ||
      contentType.startsWith("application/xml")
    ) {
      return;
    }
  	if (contentType.startsWith("text/html")) {
  		// This is a request for a page, store it
  		storeRequest(pages, details, request);
  		return;
    }

  storeRequest(pagres, details, request);

  browser.browserAction.getBadgeText({}).then(txt => {
    browser.browserAction.setBadgeText({ text: `${+txt + 1}` });
  });

}

function storeRequest(containerMap, details, request) {
	if (!request.filename)
		request.filename = window.getFilenameFromUrl(request.url);
	
	containerMap.set(details.requestId, request);
	
	if (containerMap.size > MAX_ITEMS) {
	    let keys = Array.from(containerMap.keys());
	    keys.slice(0, keys.length - MAX_ITEMS).forEach(k => containerMap.delete(k));
	}
	containerMap.set(details.requestId, request);
	return;
}

function onBeforeRedirect() {
  // Need to listen to this event otherwise the new request will include
  // the old URL. This is possibly a bug.
}

function onErrorOccurred(details) {
  currentRequests.delete(details.requestId);
}

browser.webRequest.onBeforeRedirect.addListener(onBeforeRedirect, {
  urls: ["<all_urls>"]
});

browser.webRequest.onErrorOccurred.addListener(onErrorOccurred, {
  urls: ["<all_urls>"]
});

browser.webRequest.onBeforeRequest.addListener(
  onBeforeRequest,
  { urls: ["<all_urls>"] },
  ["requestBody"]
);
browser.webRequest.onSendHeaders.addListener(
  onSendHeaders,
  { urls: ["<all_urls>"] },
  ["requestHeaders"]
);

browser.webRequest.onResponseStarted.addListener(
  onResponseStarted,
  {
    urls: ["<all_urls>"]
  },
  ["responseHeaders"]
);

browser.browserAction.setBadgeBackgroundColor({ color: "#4a90d9" });
