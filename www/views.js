/*jslint node: true */
/*jslint nomen: true */
/*jslint plusplus: true */
'use strict';

var redis = require('redis');
var config = require('../config');
var rc  = redis.createClient();
var views = {};

views.page = {};
views.page.signal = [];
views.page.exec = function execPage(callback, symbol) {
    callback({ markets: [symbol] });
};

views.head = {};
views.head.signal = ['balance'];
views.head.exec = function execPage(callback) {
    rc.get('balance', function (error, resultBalance) {
        if (error) {
            console.log('Redis Error: ' + error);
            callback({error: error});
        } else {
            resultBalance = JSON.parse(resultBalance);
            callback({
                BTC: resultBalance.BTC.amount,
                totalBTC: resultBalance.totalBTC
            });
        }
    });
};

views.market = {};
views.market.signal = [{ balance: [], openorders: [], history: [] }];
views.market.exec = function execOpenOrders(callback, symbol) {
    
    if (symbol === undefined) {
        symbol = config.markets[0];
    }
    
    rc.get('balance', function (error, resultBalance) {
        if (error) {
            console.log('Redis Error: ' + error);
            callback({error: error});
        } else {
            rc.get(symbol + '.history', function (error, resulthistory) {
                if (error) {
                    console.log('Redis Error: ' + error);
                    callback({error: error});
                } else {
                    rc.get(symbol + '.mytrades', function (error, resultmytrades) {
                        if (error) {
                            console.log('Redis Error: ' + error);
                            callback({error: error});
                        } else {
                            try {
                                resultBalance = JSON.parse(resultBalance);
                                resulthistory = JSON.parse(resulthistory);
                                resultmytrades = JSON.parse(resultmytrades);
                                
                                if (resulthistory === undefined || resultmytrades === undefined || resulthistory === null) {
                                    callback({
                                        market: symbol,
                                        amount: resultBalance[symbol.substr(symbol.indexOf('_') + 1)].amount,
                                        asBTC: resultBalance[symbol.substr(symbol.indexOf('_') + 1)].asBTC,
                                        symbol: symbol.substr(symbol.indexOf('_') + 1),
                                        last: 0,
                                        avgsell: 0,
                                        avgbuy: 0
                                    });
                                    return;
                                }
                                
                            } catch (err) {
                                console.log('Redis/Json Error: ' + err.message);
                                callback({error: error});
                            }
                            
                            callback({
                                market: symbol,
                                amount: resultBalance[symbol.substr(symbol.indexOf('_') + 1)] === undefined ? 0 : resultBalance[symbol.substr(symbol.indexOf('_') + 1)].amount,
                                asBTC: resultBalance[symbol.substr(symbol.indexOf('_') + 1)] === undefined ? 0 : resultBalance[symbol.substr(symbol.indexOf('_') + 1)].asBTC,
                                symbol: symbol.substr(symbol.indexOf('_') + 1),
                                last: resulthistory.last,
                                avgsell: resultmytrades.avgsell,
                                avgbuy: resultmytrades.avgbuy
                            });

                        }
                    });
                }
            });
        }
    });
};

views.openorders = {};
views.openorders.signal = [{ openorders: [], orderbook: [] }];
views.openorders.exec = function execOpenOrders(callback, symbol) {
    rc.get(symbol + '.openorders', function (error, result) {
        var data, i;
        if (error) {
            console.log('Redis Error: ' + error);
            callback({error: error});
        } else {
            rc.get(symbol + '.orderbook', function (error, orderbook) {
                var r, i, rate, amount, data, ii;
                
                if (error) {
                    console.log('Redis Error: ' + error);
                    callback({error: error});
                } else {
                    result = JSON.parse(result);
                    orderbook = JSON.parse(orderbook);
                    
                    data = { buys: [], sells: [] };
                    for (i = 0; i < result.length; i++) {
                        result[i].symbol = symbol.substr(symbol.indexOf('_') + 1);
                        result[i].market = symbol;
                        if (result[i].type === 'buy') {
                            r = 0;
                            
                            for (ii = 0; ii < orderbook.bids.length; ii++) {
                                amount = orderbook.bids[ii][1] * orderbook.bids[ii][0];
                                rate = orderbook.bids[ii][0];
                                
                                if (rate > result[i].rate) {
                                    r += (amount * rate);
                                }
                            }
                            result[i].depth = r;
                            data.buys.push(result[i]);
                        } else {
                            r = 0;
                            
                            for (ii = 0; ii < orderbook.asks.length; ii++) {
                                amount = orderbook.asks[ii][1] * orderbook.asks[ii][0];
                                rate = orderbook.asks[ii][0];

                                if (rate < result[i].rate) {
                                    r += (amount * rate);
                                }
                            }
                            result[i].depth = r;
                            data.sells.push(result[i]);
                        }
                    }
                    
                    data.buys = data.buys.sort(function (a, b) { return a.rate < b.rate; });
                    data.sells = data.sells.sort(function (a, b) { return a.rate < b.rate; });
                    
                    callback(data);
                }
            });
        }
    });
};

views.mytrades = {};
views.mytrades.signal = [{ mytrades: [] }];
views.mytrades.exec = function execOpenOrders(callback, symbol) {
    rc.get(symbol + '.mytrades', function (error, result) {
        var i;
        if (error) {
            console.log('Redis Error: ' + error);
            callback({error: error});
        } else {
            result = JSON.parse(result);
            for (i = 0; i < result.trades.length; i++) {
                result.trades[i].symbol = symbol.substr(symbol.indexOf('_') + 1);
                result.trades[i].market = symbol;
            }
            result.trades = result.trades.sort(function (a, b) { return (a.date > b.date ? -1 : 1); });
            callback(result);
        }
    });
};

module.exports = views;