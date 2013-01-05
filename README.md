cliget
======

Download protected files using wget or curl. This addon will generate wget/curl commands that emulate the request as though it's coming from your browser by sending the same cookies, user agent string and referrer. With this addon you can download email attachments, purcahsed software/media, source code from a private respository to a remote server without having to download the files locally first. This addon should work with any website; if you find a website that cliget doesn't work well with, please let me know.

This addon adds entries to the context menu as well as the download dialog to copy commands to clipboard (although commands from context menu don't always work). By default, it only generates commands for wget. But you can enable curl from about:config under extensions.cliget.

You can add your own parameters to be included in the commands. Set that under "cliget.wget.options" in about:config.

*If you use wget on Windows*, make sure to enable "cliget.use_double_quotes" in about:config because Windows doesn't support single quotes.

**Please be aware** of potential security and privacy implications from cookies exposed in the download commands.
