# log2gelf
Node.js utility that reads directly from syslog, nginx or apache error log file and send them to a Graylog or Gelf server via TCP or HTTP (TLS or clear).


## Usage exemple

Install with `npm install log2gelf -g` and you're ready to go!

The script is intended to be started on boot to monitor logs effectively. As such, you'll usually want to start it from `rc.local`.

```bash
log2gelf hostname gelfhost gelfport logType logfilepath protocol secure

# exemple
log2gelf web2 logs.mycompany.com 12201 syslog /var/log/syslog tcp true
```

## Parameters
* `hostname`: arbitrary string
* `gelfhost`: FQDN or ipv4 address
* `gelfport`: destination port
* `logType`: `syslog`, `apache` or `nginx`
* `logfilepath`: absolute path to log file
* `protocol`: `http` or `tcp`
* `secure`: boolean indicating if connection is secured (TLS) or clear (GELF server has to be configured adequately)
