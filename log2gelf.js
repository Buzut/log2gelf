#!/usr/bin/nodejs

// validate parameters
if (process.argv.length !== 9) {
    console.error('Usage: log2gelf hostname gelfhost gelfport logType logfilepath protocol secure');
    process.exit(3);
}

if (process.argv[5] !== 'syslog' && process.argv[5] !== 'apache' && process.argv[5] !== 'nginx') {
    console.error('logType must be syslog, apache or nginx');
    process.exit(3);
}

if (process.argv[7] !== 'tcp' && process.argv[7] !== 'http') {
    console.error('Protocol must be either http or tcp');
    process.exit(3);
}

if (process.argv[8] !== 'true' && process.argv[8] !== 'false') {
    console.error('Secure is a boolean');
    process.exit(3);
}

const hostname = process.argv[2];
const host = process.argv[3];
const port = process.argv[4];
const logType = process.argv[5];
const logfile = process.argv[6];
const protocol = process.argv[7];

const fs = require('fs');
const Tail = require('always-tail');
const net = (process.argv[8]) ? require('tls') : require('net');
const http = (process.argv[8]) ? require('https') : require('http');

// make sure log file exists and is readable
try {
    fs.statSync(logfile);
}
catch (e) {
    console.log(`Can't read logfile: ${logfile}`);
    process.exit(3);
}

/**
 * parse syslog and format it to GELF
 * @return {string} msg – JSON stringified GELF msg
 */
function convertSyslogToGELF(line) {
    const regex = /([a-zA-Z]{3} [0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}) [a-z0-9-]* ([a-zA-Z0-9-\[\]]*): (.*)/g;

    var log = regex.exec(line);
    var year = new Date().getFullYear();
    var timestamp = Date.parse(log[1] + ' ' + year) / 1000;

    return JSON.stringify({
        "host": hostname,
        "short_message": log[3],
        "timestamp": timestamp,
        "_service": log[2]
    });
}

/**
 * parse apache2 error log and format it to GELF
 * @return {string} msg – JSON stringified GELF msg
 */
function convertApacheToGELF(line) {
    const regex = /\[[a-zA-Z]{3} ([a-zA-Z]{3} [0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2})\.[0-9]{6} [0-9]{4}\] (.*)/g;

    var log = regex.exec(line);
    var year = new Date().getFullYear();
    var timestamp = Date.parse(log[1] + ' ' + year) / 1000;

    return JSON.stringify({
        "host": hostname,
        "short_message": log[3],
        "timestamp": timestamp
    });
}

/**
 * parse nginx error log and format it to GELF
 * @return {string} msg – JSON stringified GELF msg
 */
function convertNginxToGELF(line) {
    const regex = /\[[a-zA-Z]{3} ([a-zA-Z]{3} [0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2})\.[0-9]{6} [0-9]{4}\] (.*)/g;

    var log = regex.exec(line);
    var d = new Date();
    var locale = "en-us";
    var dom = d.getDate();
    var month = d.toLocaleString(locale, { month: "short" });
    var year = d.getFullYear();
    var timestamp = Date.parse(month + ' ' + dom + ' ' + log[1] + ' ' + year) / 1000;

    return JSON.stringify({
        "host": hostname,
        "short_message": log[3],
        "timestamp": timestamp
    });
}

/**
 * open a TCP socket and send logs to Gelf server
 * @param {string} msg – JSON stringified GELF msg
 */
var sendTCPGelf = (function () {
    var client;
    var TCPcon = false;

    return (msg) => {
        if (TCPcon) {
            return client.write(msg + '\0');
        }

        var options = {
            host: host,
            port: port,
            rejectUnauthorized: false
        };

        client = net.connect(options, () => {
            console.log('Connected to server');
            TCPcon = true;

            return client.write(msg + '\0');
        });

        client.on('end', () => {
            console.log('Disconnected from server');
            TCPcon = false;
        });

        client.on('error', (err) => {
            console.error(err);
        });
    };
})();

/**
 * send logs to Gelf server via HTTP(S)
 * @param {string} msg – JSON stringified GELF msg
 */
function sendHTTPGelf(msg) {
    var options = {
        hostname: host,
        port: port,
        path: '/gelf',
        method: 'POST',
        rejectUnauthorized: false,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(msg)
        }
    };

    // usefull for debug
    /*var req = http.request(options, (res) => {
        console.log('statusCode: ', res.statusCode);
    });*/

    req.on('error', (e) => {
        console.error(e);
    });

    req.write(msg);
    req.end();
}

// same behaviour as a tail -f
var tail = new Tail(logfile, '\n');
tail.on('line', function(data) {
    if (protocol === 'tcp') sendTCPGelf(convertToGELF(data));
    else sendHTTPGelf(convertToGELF(data));
});

tail.on('error', function(data) {
  console.log("error:", data);
});

tail.watch();
