# cliget

Download login-protected files from the command line using curl, wget or aria2.

This addon will generate commands that emulate the request as though it was
coming from your browser by sending the same cookies, user agent string and
referrer. With this addon you can download email attachments, purchased
software/media, source code from a private repository to a remote server without
having to download the files locally first. If come across a website where
cliget doesn't work, please open an issue providing details to help reproduce
the problem.

*Windows users*: Enable the "Escape with double-quotes" option because Windows
doesn't support single quotes. If you use cygwin, however, you don't need to
enable this option.

**Please be aware** of potential security and privacy implications from cookies
being exposed in the download command.
