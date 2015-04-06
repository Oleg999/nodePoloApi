/*jslint node: true */
/*jslint nomen: true */
/*jslint plusplus: true */
'use strict';

var fs = require('fs');
var path = require('path');
var redis = require("redis");
var sub  = redis.createClient();
var compress = require('compression');
var express = require('express');
var views = require('./www/views');
var charts = require('./www/charts');
var app = express();
var config = require('./config');
app.use(compress());
var http = require('http').Server(app);
var sio = require('socket.io');
var io = sio(http); //, { transports: [ 'websocket' ] });

var markets = [];
var lastchart = {};
var lastview = {};

function emitchart(force, v) {
    return function (data) {
        var sid;
        
        if (force === false && lastchart[v] !== undefined) {
            if (new Date().getTime() - 10000 < lastchart[v]) {
                return;
            }
        }
        lastchart[v] = new Date().getTime();

        console.log(force ? 'force push' : 'push', v, data.tooksecs, 'secs');
        
        io.emit(v, data);

    };
}

function emitview(market, v) {
    return function (data) {
        var sid;
        
        if (lastview[market] === undefined) {
            lastview[market] = {};
        }
        
        if (lastview[market][v] !== undefined) {
            if (new Date().getTime() - 10000 < lastview[market][v]) {
                return;
            }
        }
        lastview[market][v] = new Date().getTime();

        console.log('push', market, v);
        
        io.emit(v, data);
    };
}

function initmarket(market) {
    var i;
    
    if (market === undefined) {
        return;
    }
    
    for (i = 0; i < markets.length; i++) {
        if (markets[i] === market) {
            return;
        }
    }
    
    console.log('init', market);
    sub.subscribe(market + '.orderbook');
    sub.subscribe(market + '.mytrades');
    sub.subscribe(market + '.openorders');
    sub.subscribe(market + '.history');

    markets.push(market);
    
}
app.get('/', function (req, res) {
    res.setHeader('Content-Type', 'text/css');
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", 0);
    res.sendFile(path.join(__dirname, 'public', 'markets.html'));
});
app.get('/favicon.ico', function (req, res) {
    res.setHeader('Content-Type', 'image/x-icon');
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", 0);
    res.sendFile(path.join(__dirname, 'public', 'favicon.ico'));
});
// SYMBOL.history, balance, SYMBOL.openorders, SYMBOL.orderbook, SYMBOL.mytrades SYMBOL.trade
app.get('/css', function (req, res) {
    res.setHeader('Content-Type', 'text/css');
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", 0);
    res.sendFile(path.join(__dirname, 'public', 'index.css'));
});
app.get('/js/:file', function (req, res) {
    res.setHeader('Content-Type', 'text/javascript');
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", 0);
    res.sendFile(path.join(__dirname, 'public', req.params.file + '.js'));
});

app.get('/:market/js/:file', function (req, res) {
    res.setHeader('Content-Type', 'text/javascript');
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", 0);
    initmarket(req.params.market);
    res.sendFile(path.join(__dirname, 'public', req.params.file + '.js'));
});
app.get('/:market', function (req, res) {
    res.setHeader('Content-Type', 'text/html');
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", 0);
    initmarket(req.params.market);
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/:market/view/:data', function (req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", 0);
    initmarket(req.params.market);
    views[req.params.data].exec(function (data) { res.end(JSON.stringify(data)); }, req.params.market);
});
app.get('/:origin/view/:data/:market', function (req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", 0);
    initmarket(req.params.market);
    initmarket(req.params.oigin);
    views[req.params.data].exec(function (data) { res.end(JSON.stringify(data)); }, req.params.market);
});

io.on('connection', function (socket) {
    
    // socket.set('transports', [ 'websocket' ]);
    
    console.log('client connected');
    socket.on('api', function (msg) {
        console.log('api', JSON.stringify(msg));
        
        if (msg.method === 'chartconfig') {
            if (charts.settings[msg.market] === undefined) {
                charts.settings[msg.market] = {};
            }
            charts.settings[msg.market].width = msg.args[0];
            initmarket(msg.market);
            charts.data(msg.market, emitchart(true, msg.market));
        }
    });
    
    socket.on('ping', function () {
        socket.emit('pong', {});
    });
});

http.listen(config.HttpPort, function () {
    console.log('listening on *:' + config.HttpPort);
});

sub.on("connect", function () {
    var view, i, listens = [], k, ii;
    console.log('redis connected');
    sub.subscribe('balance');
});

setInterval(function checkLastSend() {
    var i;
    
    for (i = 0; i < markets.length; i++) {
        charts.data(markets[i], emitchart(false, markets[i]));
    }
    
}, 2500);

sub.on("message", function (channel, message) {
    var view, i, ii, k, emit, t = '';

    for (i = 0; i < markets.length; i++) {
        if (channel.substr(0, markets[i].length) === markets[i]) {
            charts.data(markets[i], emitchart(false, markets[i]));
        }
    }

    for (view in views) {
        if (views.hasOwnProperty(view)) {
            try {
                if (views[view].signal !== undefined) {
                    for (i = 0; i < views[view].signal.length; i++) {
                        if (views[view].signal[i].toString() === '[object Object]') {
                            for (k in views[view].signal[i]) {
                                if (views[view].signal[i].hasOwnProperty(k)) {
                                    for (ii = 0; ii < markets.length; ii++) {
                                        if (k === 'balance' && channel === 'balance') {
                                            t = markets[ii];
                                            views[view].exec(emitview(markets[ii], view + '/' + markets[ii]), markets[ii]);
                                        } else {
                                            if (markets[ii] + '.' + k === channel) {
                                                views[view].exec(emitview(markets[ii], view + '/' + markets[ii]), markets[ii]);
                                            }
                                        }
                                    }
                                }
                            }
                        } else {
                            if (views[view].signal[i] === channel) {
                                views[view].exec(emitview(channel.substr(0, markets[i].length), view));
                            }
                        }
                    }
                }
            } catch (ee) {
                console.log('error', channel, view, t, ee, ee.stack);
            }
        }
    }
});

