/*jslint node: true */
/*jslint nomen: true */
/*jslint plusplus: true */
'use strict';

var _ema = require('./indicators/ema');
var _sar = require('./indicators/sar');
var candles = {};

function _min(arr, cb) {
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
    if (mi === undefined || isNaN(mi)) {
        console.log('_min', mi, JSON.stringify(arr), cb === undefined);
    }
    return mi;
}

function _max(arr, cb) {
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
    if (mi === undefined || isNaN(mi)) {
        console.log('_max', mi, JSON.stringify(arr), cb === undefined);
    }
    return mi;
}

function extendindicators(candles, opts) {
    var past = [], i, current;
    
    for (i = candles.length - 1; i >= 0; i--) {
        current = candles[i];
        _ema(current, past, opts.EMA);
        _sar(current, past, opts.SAR);
        past.unshift(current);
    }
}

candles.get = function get(candleWidth, trades, opts) {
    var result = [], i, candle, first, cur, r, history;
    
    history = trades.sort(function (a, b) { return a.date > b.date ? -1 : 1; });
    
    for (i = history.length - 1; i >= 0; i--) {
        if (candle === undefined) {
            candle = {
                date: (history[i].date / candleWidth).toFixed(0),
                open: result.length > 0 ? result[result.length - 1].close : history[i].rate,
                low: history[i].rate,
                high: history[i].rate,
                close: history[i].rate,
                volume: 0
            };
        }
        candle.volume += history[i].amount;
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
                close: candle.close,
                volume: 0
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
        
    extendindicators(r, opts);
    r = r.sort(function (a, b) { return a.date > b.date ? -1 : 1; });
    r[0].ishot = true;
    
    return r;
};


module.exports = candles;