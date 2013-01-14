cliget
======

Download protected files using curl or wget. This addon will generate curl/wget commands that emulate the request as though it's coming from your browser by sending the same cookies, user agent string and referrer. With this addon you can download email attachments, purchased software/media, source code from a private repository to a remote server without having to download the files locally first. This addon should work with any website; if you find a website that cliget doesn't work well with, please let me know.

This addon adds entries to the context menu as well as the download dialog to copy commands to clipboard. By default, it only generates commands for curl. But you can enable wget from about:config under extensions.cliget.

You can add your own parameters to be included in the commands. Set that under "cliget.curl.options" in about:config.

*If you use curl or wget on Windows*, make sure to enable "cliget.use_double_quotes" in about:config because Windows doesn't support single quotes. If you use cygwin, however, you don't need to enable this option.

**Please be aware** of potential security and privacy implications from cookies exposed in the download commands.
