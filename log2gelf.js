#!/usr/bin/nodejs

// validate parameters
if (process.argv.length !== 9) {
    console.error('Usage: log2gelf hostname gelfhost gelfport protocol secure logType logfilepath');
    process.exit(3);
}

if (process.argv[7] !== 'syslog' && process.argv[7] !== 'apache' && process.argv[7] !== 'nginx') {
    console.error('logType must be syslog, apache or nginx');
    process.exit(3);
}

if (process.argv[5] !== 'tcp' && process.argv[5] !== 'http') {
    console.error('Protocol must be either http or tcp');
    process.exit(3);
}

if (process.argv[6] !== 'true' && process.argv[6] !== 'false') {
    console.error('Secure is a boolean');
    process.exit(3);
}

const hostname = process.argv[2];
const host = process.argv[3];
const port = process.argv[4];
const protocol = process.argv[5];
const logType = process.argv[7];
const logfile = process.argv[8];


const fs = require('fs');
const Tail = require('always-tail');
const net = (process.argv[6]) ? require('tls') : require('net');
const http = (process.argv[6]) ? require('https') : require('http');

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
    const regex = /([a-zA-Z]{3}  ?[0-9]{1,2} [0-9]{2}:[0-9]{2}:[0-9]{2}) [a-z0-9-]* (.*): (.*)/g;

    var log = regex.exec(line);
    var year = new Date().getFullYear();
    var timestamp = Date.parse(log[1] + ' ' + year) / 1000;

    return JSON.stringify({
        "host": hostname,
        "short_message": log[3],
        "timestamp": timestamp,
        "_service": log[2],
        "_logtype": logType
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
        "timestamp": timestamp,
        "_logtype": logType
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
        "timestamp": timestamp,
        "_logtype": logType
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

    var req = http.request(options, (res) => {
        // usefull for debug
        //console.log('statusCode: ', res.statusCode);
    });

    req.on('error', (e) => {
        console.error(e);
    });

    req.write(msg);
    req.end();
}

// same behaviour as a tail -f
var tail = new Tail(logfile, '\n');
tail.on('line', function(data) {
    var gelfEncoded;
    if (logType === 'syslog') gelfEncoded = convertSyslogToGELF(data);
    else if (logType === 'apache') gelfEncoded = convertApacheToGELF(data);
    else gelfEncoded = convertNginxToGELF(data);

    if (protocol === 'tcp') sendTCPGelf(gelfEncoded);
    else sendHTTPGelf(gelfEncoded);
});

tail.on('error', function(data) {
  console.log("error:", data);
});

tail.watch();
