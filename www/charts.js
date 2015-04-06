/*jslint node: true */
/*jslint nomen: true */
/*jslint plusplus: true */
'use strict';

var redis = require('redis');
var rc  = redis.createClient();
var async = require('async');
var _candles = require('../lib/candles');

function Chart(market) {
}

Chart.settings = {};

Chart.formatorderbook = function formatorderbook(orderbook) {
    var result = [], i, curvol;
    
    if (orderbook === null || orderbook === undefined) {
        return [];
    }
    
    orderbook.asks = orderbook.asks.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
    orderbook.asks.splice(0, 0, [orderbook.asks[0][0], 0]);
    curvol = 0;
    for (i = 0; i < orderbook.asks.length; i++) {
        curvol += orderbook.asks[i][1];
        result.push([ orderbook.asks[i][0], curvol * orderbook.asks[i][0] ]);
    }
    
    orderbook.bids = orderbook.bids.sort(function (a, b) { return a[0] > b[0] ? -1 : 1; });
    orderbook.bids.splice(0, 0, [orderbook.bids[0][0], 0]);
    curvol = 0;
    for (i = 0; i < orderbook.bids.length; i++) {
        curvol += orderbook.bids[i][1];
        result.push([ orderbook.bids[i][0], curvol * orderbook.bids[i][0] ]);
    }

    return result.sort(function (a, b) { return a[0] > b[0] ? -1 : 1; });
};

Chart.getTradeTooltip = function getTradeTooltip(order, callback) {
    rc.get(order.market + '.trade.' + order.orderNumber, function (error, r) {
        if (error) {
            callback(undefined);
        } else {
            callback(JSON.parse(r));
        }
    });
};

Chart.formattrades = function formattrades(market, openorders, mytrades, callback) {
    var result = [], i, maxvol, minvol, color, size, tooltip;
    
    if (openorders === null) {
        callback([]);
        return;
    }
    
    async.map(openorders, function (item, cc2) {
        item.color = item.type === 'buy' ? 'green' : 'red';
        item.size = 5;
        item.order = true;
        
        Chart.getTradeTooltip(item, function (tooltip) {
            if (tooltip !== null && tooltip !== undefined) {
                item.tooltip = tooltip;
            }

            cc2(undefined, item);
        });
    }, function (err, results) {
        
        async.map(mytrades.trades, function (item, cc) {
            item.color = item.type === 'buy' ? 'green' : 'red';
            item.size = 3;
            item.market = market;
            Chart.getTradeTooltip(item, function (tooltip) {
                if (tooltip !== null && tooltip !== undefined) {
                    item.tooltip = tooltip;
                }

                cc(undefined, item);
            });
        }, function (err, rs) {
            callback(results.concat(rs));
        });
    });
};

Chart.formatcandelizer = function formatcandelizer(market, history) {
    var candleWidth;
    
    if (Chart.settings[market] === undefined) {
        Chart.settings[market] = { width: 1000 * 60 * 15 };
    }
    candleWidth = Chart.settings[market].width; // 1h
    
    return _candles.get(candleWidth, history.trades, { SAR: { AF: 0.002, AFMax: 0.05 }, EMA: { EWT: 2 / (10 + 1)} });
};

Chart.min = function min(arr, cb) {
    if (arr === null || arr === undefined) { return -1; }
    var i, mi, v;
    for (i = 0; i < arr.length; i++) {
        v = arr[i];
        if (cb !== undefined) {
            v = cb(v);
        }
        if ((mi === undefined || mi === null || isNaN(mi)) || v < mi) {
            if (v !== null && v !== undefined && !isNaN(v)) {
                mi = v;
            }
        }
    }
    return mi;
};

Chart.max = function max(arr, cb) {
    if (arr === null || arr === undefined) { return 1; }
    var i, mi, v;
    for (i = 0; i < arr.length; i++) {
        v = arr[i];
        if (cb !== undefined) {
            v = cb(v);
        }
        if ((mi === undefined || mi === null || isNaN(mi)) || v > mi) {
            if (v !== null && v !== undefined && !isNaN(v)) {
                mi = v;
            }
        }
    }

    return mi;
};

Chart.data = function data(market, callback) {
    var start = new Date().getTime(),
        olhc;
    
    if (market === undefined || market === null || market === 'favicon.ico') {
        callback('');
        return;
    }
    
    rc.get(market + '.orderbook', function (error, orderbook) {
        if (error) {
            console.log('Redis Error: ' + error);
            callback({error: error});
        } else {
            rc.get(market + '.history', function (error, history) {
                if (error) {
                    console.log('Redis Error: ' + error);
                    callback({error: error});
                } else {
                    rc.get(market + '.openorders', function (error, openorders) {
                        if (error) {
                            console.log('Redis Error: ' + error);
                            callback({error: error});
                        } else {
                            rc.get(market + '.mytrades', function (error, mytrades) {
                                var trades, min, max, sar, ema, oh;
                                
                                if (error) {
                                    console.log('Redis Error: ' + error);
                                    callback({error: error});
                                } else {
                                    history = JSON.parse(history);
                                    oh = history;
                                    history = Chart.formatcandelizer(market, history);
                                    
                                    if (history === null || history === undefined) {
                                        callback({
                                            min: -1,
                                            max: 1,
                                            orderbook: [],
                                            olhc: [],
                                            trades: [],
                                            avgsell: 0,
                                            avgbuy: 0,
                                            market: market,
                                            candleWidth: Chart.settings[market].width,
                                            tooksecs: ((new Date().getTime()) - start) / 1000
                                        });
                                        return;
                                    }
                                    
                                    openorders = JSON.parse(openorders);
                                    mytrades = JSON.parse(mytrades);
                                    Chart.formattrades(market, openorders, mytrades, function (ftrades) {
                                        trades = ftrades;
                                        
                                        if (mytrades === null || mytrades === undefined) {
                                            mytrades = {
                                                avgsell: 0,
                                                avgbuy: 0,
                                                trades: []
                                            };
                                        }

                                        min = Chart.min([
                                            Chart.min(history, function (d) { return d.low; }),
                                            Chart.min(mytrades, function (d) { return d.rate; })
                                        ]);

                                        max = Chart.max([
                                            Chart.max(history, function (d) { return d.high; }),
                                            Chart.max(mytrades, function (d) { return d.rate; })
                                        ]);

                                        orderbook = Chart.formatorderbook(JSON.parse(orderbook));
                                        
                                        if (history[0].close !== oh.trades[0].rate) {
                                            console.log('hist differs last candle', history[0].close, oh.trades[0].rate);
                                        }

                                        callback({
                                            min: min,
                                            max: max,
                                            orderbook: orderbook,
                                            olhc: history,
                                            trades: trades,
                                            avgsell: mytrades.avgsell,
                                            avgbuy: mytrades.avgbuy,
                                            market: market,
                                            candleWidth: Chart.settings[market].width,
                                            tooksecs: ((new Date().getTime()) - start) / 1000
                                        });
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
    });
};

module.exports = Chart;