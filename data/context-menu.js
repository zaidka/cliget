self.on('context', function(node) {
  var urls = {};
  n = node;

  while (n) {
    if (n.src && !urls.image)
      urls.image = n.src;
    if (n.href && !urls.link)
      urls.link = n.href;
    n = n.parentNode;
  }

  if (Object.keys(urls).length === 0) {
    if (window != top)
      urls.frame = window.location.href;
    urls.page = top.location.href;
  }

  for (var url in urls) {
    if (urls[url].substring(0,4) != 'http')
      delete urls[url];
  }

  self.postMessage(urls);
  return Object.keys(urls).length !== 0;
});

self.on('click', function (node, data) {
  self.postMessage(data);
});
