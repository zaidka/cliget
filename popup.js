"use strict";

function fileSizeToText(size) {
  let unit = "B";
  if (size >= 1024) {
    size /= 1024;
    unit = "KB";

    if (size >= 1024) {
      size /= 1024;
      unit = "MB";

      if (size >= 1024) {
        size /= 1024;
        unit = "GB";
      }
    }
  }

  return `${size.toFixed(1)} ${unit}`;
}

function renderOptionsElement(body, type, name, value, label, help, callback) {
  const labelEl = document.createElement("label");
  labelEl.title = help;
  labelEl.htmlFor = name;

  const input = document.createElement("input");
  input.id = name;
  input.name = name;
  input.type = type;
  if (type === "checkbox" || type === "radio") input.checked = value;
  else input.value = value;

  input.onchange = callback;

  if (type === "text") {
    labelEl.classList.add("text-input", "browser-style");
    labelEl.appendChild(document.createTextNode(label + ":"));
    labelEl.appendChild(input);
    body.appendChild(labelEl);
  } else {
    labelEl.appendChild(document.createTextNode(label));
    body.appendChild(input);
    body.appendChild(labelEl);
  }
}

function renderOptions(body, options, callback) {
  function onchange(event) {
    let ops = {};
    let target = event.target;
    if (target.type === "radio") ops["command"] = target.name;
    else if (target.type === "checkbox") ops[target.name] = target.checked;
    else if (target.type === "text") ops[target.name] = target.value;

    callback(ops);
  }

  function resetCallback() {
    callback();
  }

  let reset = document.createElement("button");
  reset.classList.add("reset", "browser-style");
  reset.onclick = resetCallback;
  reset.textContent = "Reset";
  body.appendChild(reset);

  let command = document.createElement("div");
  command.classList.add("command", "browser-style");
  renderOptionsElement(
    command,
    "radio",
    "curl",
    options.command === "curl",
    "curl",
    "Generate curl command.",
    onchange
  );
  renderOptionsElement(
    command,
    "radio",
    "wget",
    options.command === "wget",
    "wget",
    "Generate wget command.",
    onchange
  );
  renderOptionsElement(
    command,
    "radio",
    "aria2",
    options.command === "aria2",
    "aria2",
    "Generate aria2 command.",
    onchange
  );

  let common = document.createElement("div");
  common.classList.add("common", "browser-style");
  renderOptionsElement(
    common,
    "checkbox",
    "doubleQuotes",
    options.doubleQuotes,
    "Escape with double-quotes",
    'Use double quotation marks (") for command-line arguments. Enable this if you plan to *execute* the commands on a Windows machine.',
    onchange
  );
  renderOptionsElement(
    common,
    "text",
    "excludeHeaders",
    options.excludeHeaders,
    "Exclude headers",
    "Exclude request headers from the generated command.",
    onchange
  );

  let extra = document.createElement("div");
  extra.classList.add("extra", "browser-style");

  if (options.command === "curl")
    renderOptionsElement(
      extra,
      "text",
      "curlOptions",
      options.curlOptions,
      "Extra curl arguments",
      "Add extra command-line arguments to be appended to the curl command.",
      onchange
    );

  if (options.command === "wget")
    renderOptionsElement(
      extra,
      "text",
      "wgetOptions",
      options.wgetOptions,
      "Extra wget arguments",
      "Add extra command-line arguments to be appended to the curl command.",
      onchange
    );

  if (options.command === "aria2")
    renderOptionsElement(
      extra,
      "text",
      "aria2Options",
      options.aria2Options,
      "Extra aria2 arguments",
      "Add extra command-line arguments to be appended to the curl command.",
      onchange
    );

  body.appendChild(command);
  body.appendChild(common);
  body.appendChild(extra);
}

function showCommand(requestId, options) {
  if (!options) {
    browser.runtime.sendMessage(["getOptions"]).then((opts) => {
      showCommand(requestId, opts);
    });
    return;
  }

  browser.runtime
    .sendMessage(["generateCommand", requestId, options])
    .then((cmd) => {
      const body = document.body;
      while (body.firstChild) body.removeChild(body.firstChild);

      const textArea = document.createElement("textarea");
      textArea.classList.add("browser-style");
      textArea.cols = 80;
      textArea.rows = 15;
      textArea.value = cmd;

      let optionsDiv = document.createElement("div");
      optionsDiv.classList.add("options");
      renderOptions(optionsDiv, options, (optionsUpdate) => {
        if (!optionsUpdate)
          browser.runtime.sendMessage(["resetOptions"]).then((newOptions) => {
            showCommand(requestId, newOptions);
          });
        else
          browser.runtime
            .sendMessage(["setOptions", optionsUpdate])
            .then((newOptions) => {
              showCommand(requestId, newOptions);
            });
      });
      body.appendChild(textArea);
      body.appendChild(optionsDiv);
      textArea.focus();
      textArea.select();
    });
}

function showList(downloadList, highlight) {
  const body = document.body;
  while (body.firstChild) body.removeChild(body.firstChild);

  if (!downloadList.length) {
    let el = document.createElement("div");
    el.style.margin = "20px";
    el.textContent = "No downloads for this session.";
    body.appendChild(el);
    return;
  }

  for (let i = downloadList.length - 1; i >= 0; --i) {
    const req = downloadList[i];

    const row = document.createElement("div");
    row.classList.add("panel-section", "panel-section-tabs");
    if (highlight-- > 0) row.classList.add("highlight");
    body.appendChild(row);

    const buttonElement = document.createElement("div");
    buttonElement.classList.add("panel-section-tabs-button");
    buttonElement.title = req.url;
    buttonElement.onclick = function () {
      showCommand(req.id);
    };

    let fileNameSpan = document.createElement("span");
    if (req.size) {
      fileNameSpan.textContent = req.filename + " ";
      let sizeSpan = document.createElement("span");
      sizeSpan.classList.add("file-size");
      sizeSpan.textContent = `(${fileSizeToText(req.size)})`;
      fileNameSpan.appendChild(sizeSpan);
    } else {
      fileNameSpan.textContent = req.filename;
    }

    buttonElement.appendChild(fileNameSpan);
    row.appendChild(buttonElement);

    if (i) {
      let sep = document.createElement("div");
      sep.classList.add("panel-section-separator");
      body.appendChild(sep);
    }
  }

  let footer = document.createElement("div");
  footer.classList.add("panel-section", "panel-section-footer");
  body.appendChild(footer);
  let clearButton = document.createElement("div");
  clearButton.classList.add("panel-section-footer-button");
  clearButton.textContent = "Clear all";
  clearButton.onclick = function () {
    browser.runtime.sendMessage(["clear"]).then(() => window.close());
  };
  footer.appendChild(clearButton);
}

function applyTheme(theme) {
  if (!theme || !theme.colors) return;
  const colors = theme.colors;
  const styleEl = document.createElement("style");
  document.head.appendChild(styleEl);
  const rules = [
    `body { color: ${colors.popup_text}; background-color: ${colors.popup}; }`,
    `.panel-section-tabs { color: ${colors.popup_text}; }`,
    `.panel-section-footer { color: ${colors.popup_text}; background-color: rgba(128, 128, 128, 0.12); border-top-color: rgba(128, 128, 128, 0.30); }`,
    `.panel-section-separator { background-color: rgba(128, 128, 128, 0.30); }`,
    `.options { background-color: rgba(128, 128, 128, 0.12); border-top-color: rgba(128, 128, 128, 0.30); }`,
  ];

  if (colors.popup_heightlight)
    rules.push(
      `.panel-section-tabs-button:hover { color: ${colors.popup_heightlight_text}; background-color: ${colors.popup_heightlight}; }`,
      `.panel-section-footer-button:hover { color: ${colors.popup_heightlight_text}; background-color: ${colors.popup_heightlight}; }`
    );
  else
    rules.push(
      `.panel-section-tabs-button:hover { background-color: rgba(128, 128, 128, 0.12); }`,
      `.panel-section-footer-button:hover { background-color: rgba(128, 128, 128, 0.12); }`
    );

  for (const rule of rules) styleEl.sheet.insertRule(rule);
}

document.addEventListener("DOMContentLoaded", () => {
  Promise.all([
    browser.runtime.sendMessage(["getDownloadList"]),
    browser.browserAction.getBadgeText({}),
    browser.theme.getCurrent(),
  ]).then(([list, txt, theme]) => {
    let highlight = +txt;
    browser.browserAction.setBadgeText({ text: "" });
    applyTheme(theme);
    showList(list, highlight);
  });
});
