cliget
======

Download protected files using curl, wget, youtube-dl or aria2.  
This addon will generate commands that emulate the request as though it's
coming from your browser by sending the same cookies, user agent string and
referrer. With this addon you can download email attachments, purchased
software/media, source code from a private repository to a remote server
without having to download the files locally first.  
This addon should work with any website; if you find a website that cliget
doesn't work well with, please let me know.

This addon adds entries to the context menu as well as the download dialog to
copy commands to clipboard. By default, it only generates commands for curl
but you can enable others clients in the extension preferences menu.

You can add your own parameters to be included for each command.

**Windows users**: Make sure to enable the "Escape with double-quotes"
option because Windows doesn't support single quotes.  
If you use cygwin, however, you don't need to enable this option.

**Please be aware** of potential security and privacy implications from cookies
exposed in the download commands.

Development
-----------

This addon is built with the [Addon-SDK](https://addons.mozilla.org/en-US/developers/builder).  
Install the SDK and run `jpm xpi` to build the extension, run `jpm test` to run
the unit tests, or use `jpm run` to run the extension in a new Firefox profile.
