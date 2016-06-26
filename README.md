# log2gelf
Node.js utility that reads directly from syslog, nginx or apache error log file and send them to a Graylog or Gelf server via TCP or HTTP (TLS or clear).


## Usage exemple

Install with `npm install log2gelf -g` and you're ready to go!

The script is intended to be started on boot to monitor logs effectively. As such, you'll usually want to start it from `rc.local`.

```bash
log2gelf hostname gelfhost gelfport protocol secure logType logfilepath

# exemple
log2gelf web2 logs.mycompany.com 12201 tcp true syslog /var/log/syslog
```

## Parameters
* `hostname`: arbitrary string
* `gelfhost`: FQDN or ipv4 address
* `gelfport`: destination port
* `protocol`: `http` or `tcp`
* `secure`: boolean indicating if connection is secured (TLS) or clear (GELF server has to be configured adequately)
* `logType`: `syslog`, `apache` or `nginx`
* `logfilepath`: absolute path to log file

## Log format
### syslog
`Jun 26 17:10:26 sd-92316 autossh[1109]: ssh child pid is 20591`

### apache error log
`[Sun Jun 26 06:25:07.916957 2016] [mpm_prefork:notice] [pid 28915] AH00163: Apache/2.4.20 (Ubuntu) OpenSSL/1.0.2h configured -- resuming normal operations`

### nginx error log
`2016/06/26 10:08:43 [warn] 28604#28604: no resolver defined to resolve ocsp.int-x3.letsencrypt.org while requesting certificate status, responder: ocsp.int-x3.letsencrypt.org`
