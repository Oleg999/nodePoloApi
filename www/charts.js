/*jslint node: true */
/*jslint nomen: true */
/*jslint plusplus: true */
'use strict';

var redis = require('redis');
var rc  = redis.createClient();
var async = require('async');

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
            console.log('Redis Error: ' + error);
            callback(undefined);
        } else {
            callback(JSON.parse(r));
        }
    });
};

Chart.formattrades = function formattrades(openorders, mytrades, callback) {
    var result = [], i, maxvol, minvol, color, size, tooltip;
    
    if (openorders === null) {
        callback([]);
        return;
    }
    
    result = async.map(openorders, function (item, callback) {
        item.color = item.type === 'buy' ? 'green' : 'red';
        item.size = 5;
        item.order = true;
        
        Chart.getTradeTooltip(item, function (tooltip) {
            item.tooltip = tooltip;

            callback(undefined, item);
        });
    }, function (err, results) {
        for (i = 0; i < mytrades.trades.length; i++) {
            color = mytrades.trades[i].type === 'buy' ? 'green' : 'red';
            size = 3;

            results.push({ color: color, size: size, amount: mytrades.trades[i].amount, rate: mytrades.trades[i].rate, date: mytrades.trades[i].date, order: false, type: mytrades.trades[i].type });
        }
        callback(results);
    });
};

Chart.formatcandelizer = function formatcandelizer(market, history) {
    var result = [], i, candleWidth, candle, first, cur, r;
    
    if (Chart.settings[market] === undefined) {
        Chart.settings[market] = { width: 1000 * 60 * 15 };
    }
    candleWidth = Chart.settings[market].width; // 1h
    
    
    if (history === null) {
        return [];
    }
    history = history.trades.sort(function (a, b) { return a.date > b.date ? -1 : 1; });
    
    for (i = history.length - 1; i >= 0; i--) {
        if (candle === undefined) {
            candle = {
                date: (history[i].date / candleWidth).toFixed(0),
                open: result.length > 0 ? result[result.length - 1].close : history[i].rate,
                low: history[i].rate,
                high: history[i].rate,
                close: history[i].rate
            };
        }
        
        candle.close = history[i].rate;
        if (history[i].rate > candle.high) {
            candle.high = history[i].rate;
        }
        if (history[i].rate < candle.low) {
            candle.low = history[i].rate;
        }
        
        if (candle.date !== (history[i].date / candleWidth).toFixed(0)) {
            result[candle.date] = candle;
            if (first === undefined) { first = candle; }
            candle = undefined;
        }
    }

    if (candle !== undefined) {
        result[candle.date] = candle;
    }

    cur = history[history.length - 1].date;
    candle = first;
    while (cur < history[0].date) {
        
        if (result[(cur / candleWidth).toFixed(0)] === undefined) {
            result[(cur / candleWidth).toFixed(0)] = {
                date: (cur / candleWidth).toFixed(0),
                open: candle.close,
                low: candle.close,
                high: candle.close,
                close: candle.close
            };
        }
        
        candle = result[(cur / candleWidth).toFixed(0)];
        
        cur += candleWidth;
    }
    
    r = [];
    for (i in result) {
        if (result.hasOwnProperty(i)) {
            result[i].date = parseInt(result[i].date, 10) * candleWidth;
            r.push(result[i]);
        }
    }
    
    r = r.sort(function (a, b) { return a.date > b.date ? -1 : 1; });
    r[0].ishot = true;
    
    return Chart.extendindicators(r);
};

Chart.extendindicators = function extendindicators(candles) {
    
    var ewt, n = 10,                            // ema
        AF, Max, long, af, ep, hp, lp, reverse, // sar
        i;
    
    candles[candles.length - 1].ema = candles[candles.length - 1].close;
    
    AF = 0.01; //acceleration factor
    Max = 0.05; //max acceleration
    
    ewt = 2 / (10 + 1);
    
    candles[candles.length - 1].sar = candles[candles.length - 1].close;

    long = true;                            //assume long for initial conditions
    af = AF;                                //init acelleration factor
    ep = candles[candles.length - 1].low;   //init extreme point
    hp = candles[candles.length - 1].high;
    lp = candles[candles.length - 1].low;
    
    for (i = candles.length - 2; i >= 0; i--) {
        candles[i].ema = ((candles[i].close - candles[i + 1].ema) * ewt) + candles[i + 1].ema;

        if (long) {
            candles[i].sar = candles[i + 1].sar + af * (hp - candles[i + 1].sar);
        } else {
            candles[i].sar = candles[i + 1].sar + af * (lp - candles[i + 1].sar);
        }
        
        reverse = 0;
        
        if (long) {
            if (candles[i].low < candles[i].sar) {
                long = false;
                reverse = 1;            //reverse position to short
                candles[i].sar = hp;    //sar is high point in prev trade
                lp = candles[i].low;
                af = AF;
            }
        } else {
            if (candles[i].high > candles[i].sar) {
                long = true;
                reverse = 1;            //reverse position to long
                candles[i].sar = lp;
                hp = candles[i].high;
                af = AF;
            }
        }
        
        candles[i].sarislong = long;
        
        if (reverse === 0) {
            if (long) {
                if (candles[i].high > hp) {
                    hp = candles[i].high;
                    af += AF;
                    af = Chart.min([af, Max]);
                }
                candles[i].sar = Chart.min([candles[i].sar, candles[i + 1].low, i < (candles.length - 2) ? candles[i + 2].low : candles[i + 1].low]);
            } else {
                if (candles[i].low < lp) {
                    lp = candles[i].low;
                    af = af + AF;
                    af = Chart.min([af, Max]);
                }
                candles[i].sar = Chart.max([candles[i].sar, candles[i + 1].high, i < (candles.length - 2) ? candles[i + 2].high : candles[i + 1].high]);
            }
        }
    }
    
    return candles;
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
                                    Chart.formattrades(openorders, mytrades, function (ftrades) {
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