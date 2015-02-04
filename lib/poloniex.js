/*jslint node: true */
/*jslint nomen: true */
/*jslint plusplus: true */
'use strict';

var autobahn = require('autobahn'),
    crypto = require('crypto'),
    async = require('async'),
    https = require('https'),
    querystring = require('querystring'),
    Curl = require('node-curl/lib/Curl'),
    microtime = require('microtime'),
    events = require('events'),
    util = require('util');

var Poloniex = function Poloniex() {};

Poloniex.buy = function (symbol, amount, rate, callback) {
    Poloniex._query_tradeApi({ 'command': 'buy', 'currencyPair': symbol, 'rate': rate, 'amount': amount}, callback);
};

Poloniex.sell = function (symbol, amount, rate, callback) {
    Poloniex._query_tradeApi({ 'command': 'sell', 'currencyPair': symbol, 'rate': rate, 'amount': amount}, callback);
};

Poloniex.get_balance = function (callback) {
    Poloniex._query_tradeApi({ 'command': 'returnCompleteBalances' }, callback);
};

Poloniex.get_orders = function (symbol, callback) {
    var cp = 'all';
    
    if (symbol !== undefined) {
        cp = symbol;
    }
    
    Poloniex._query_tradeApi({ 'command': 'returnOpenOrders', 'currencyPair': cp }, callback);
};

Poloniex.get_tradehistory = function (symbol, start, callback) {
    var cp = 'all';
    
    if (symbol !== undefined) {
        cp = symbol;
    }
    
    Poloniex._query_tradeApi({ 'command': 'returnTradeHistory', 'currencyPair': cp, start: start, end: 9999999999 }, callback);
};

Poloniex.get_publictradehistory = function (symbol, start, callback) {
    var cp = 'all';
    
    if (symbol !== undefined) {
        cp = symbol;
    }
    
    Poloniex._query_publicApi({ 'command': 'returnTradeHistory', 'currencyPair': cp, start: start, end: 9999999999 }, callback);
};

Poloniex.get_orderbook = function (symbol, depth, callback) {
    var cp = 'all';
    
    if (symbol !== undefined) {
        cp = symbol;
    }
    
    Poloniex._query_publicApi({ 'command': 'returnOrderBook', 'currencyPair': cp, depth: depth }, callback);
};

Poloniex.returnTicker = function (callback) {
    Poloniex._query_publicApi({ 'command': 'returnTicker' }, callback);
};

Poloniex.cancel_order = function (symbol, orderNumber, callback) {
    Poloniex._query_tradeApi({ 'command': 'cancelOrder', 'currencyPair': symbol, 'orderNumber': orderNumber }, callback);
};

Poloniex.cancel_orders = function (symbol, callback) {
    Poloniex.get_orders(symbol, function (err, orders) {

        if (err !== undefined) {
            return callback(err);
        }
        
        async.each(orders, function (oi, cb) {

            Poloniex.cancel_order(symbol, oi.orderNumber, cb);

        }, function (err) {
            return callback(err);
        });
    });
};

Poloniex._query_publicApi = function (req, callback) {
    var get_data = querystring.stringify(req),
        url = 'https://poloniex.com/public?' + get_data;
    
    try {
        https.get(url, function (res) {
            var body = '';

            res.on('data', function (chunk) {
                body += chunk;
            });

            res.on('end', function () {
                try {
                    var data = JSON.parse(body);
                    callback(undefined, data);
                } catch (e) {
                    console.error('exchanges/poloniex', '_query_publicApi', e, e.stack);
                    callback(e, undefined);
                }
            });

        }).on('error', function (e) {
            console.error('exchanges/poloniex', '_query_publicApi', e, e.stack);
            callback(e, undefined);
        });
    } catch (e) {
        console.error('exchanges/poloniex', '_query_publicApi', e, e.stack);
        callback(e, undefined);
    }
};

Poloniex._query_tradeApi = function (req, callback) {
    var post_data,
        hash = crypto.createHmac('sha512', "secret"),
        sign,
        received,
        headers,
        curl;

    req.nonce = microtime.now().toString();
    post_data = querystring.stringify(req);
    hash.update(post_data);
    sign = hash.digest("hex");

    try {
        headers = [ 'Key: ' + "key", 'Sign: ' + sign ];

        curl = new Curl();
        curl.setopt('URL', 'https://poloniex.com/tradingApi');
        curl.setopt('POST', 1);
        curl.setopt('POSTFIELDS', post_data);
        curl.setopt('HTTPHEADER', headers);

        received = '';

        curl.on('data', function (chunk) {
            received += chunk;
            return chunk.length;
        });

        curl.on('header', function (chunk) {
            return chunk.length;
        });

        curl.on('error', function (e) {
            console.error('exchanges/poloniex', '_query_tradeApi', e, req, e.stack);
            callback(e, undefined);
            curl.close();
        });

        curl.on('end', function () {
            try {
                
                var data = JSON.parse(received);
                callback(undefined, data);
                
            } catch (ex) {
                console.error('exchanges/poloniex', '_query_tradeApi', ex, req, ex.stack);
                callback(ex, received);
            }

            curl.close();
        });

        curl.perform();

    } catch (ee) {
        console.error('exchanges/poloniex', '_query_tradeApi', ee, req, ee.stack);
        callback(ee, received);
    }

};

function marketcallback(symbol, callback) {
    return function (args) { callback(symbol, args); };
}

Poloniex.connectmarket = function (symbols, callback, tick) {
    var wsuri = "wss://api.poloniex.com",
        connection = new autobahn.Connection({
            url: wsuri,
            realm: "realm1"
        });
    
    connection.onopen = function (session) {
        console.log('Poloniex', 'connect', 'ticker');
        session.subscribe('ticker', tick);
        
        var i;
        
        for (i = 0; i < symbols.length; i++) {
            console.log('Poloniex', 'connect', symbols[i]);
            session.subscribe(symbols[i], marketcallback(symbols[i], callback));
        }

    };
                    
    connection.open();
};

module.exports = Poloniex;