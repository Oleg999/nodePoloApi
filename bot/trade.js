/*jslint node: true */
/*jslint continue: true */
/*jslint nomen: true */
/*jslint plusplus: true */
'use strict';

var poloniex = require('../lib/poloniex');
var publisher  = require('../lib/publisher'); // SYMBOL.trade
var trade = {};
var clc = require('cli-color');
var current = {};
var async = require('async');

function min(arr, cb) {
    var i, mi, v;
    for (i = 0; i < arr.length; i++) {
        v = arr[i];
        if (cb !== undefined) {
            v = cb(v);
        }
        if (mi === undefined || v < mi) {
            mi = v;
        }
    }
    return mi;
}

function max(arr, cb) {
    var i, ma, v;
    for (i = 0; i < arr.length; i++) {
        v = arr[i];
        if (cb !== undefined) {
            v = cb(v);
        }
        if (ma === undefined || v > ma) {
            ma = v;
        }
    }
    return ma;
}

function TradeCalculations() {
    this._actions = [];
}

TradeCalculations.prototype.percent = function percent(value) {
    this._actions.push({method: 'percent', args: [value]});
    return this;
};

TradeCalculations.prototype.sar = function sar(candlewidth, af, afmax) {
    this._actions.push({method: 'sar', args: [candlewidth, af, afmax]});
    return this;
};

TradeCalculations.prototype.ifTarget = function ifTarget(percent, value) {
    this._actions.push({method: 'target', args: [percent, value]});
    return this;
};

TradeCalculations.prototype.ifAvgSell = function ifAvgSell(value) {
    this._actions.push({method: 'avgsell', args: [value]});
    return this;
};

TradeCalculations.prototype.ifAvgBuy = function ifAvgBuy(value) {
    this._actions.push({method: 'avgbuy', args: [value]});
    return this;
};

TradeCalculations.prototype.toSymbol = function toSymbol() {
    this._actions.push({method: 'tosymbol'});
    return this;
};

TradeCalculations.prototype.orderbook = function orderbook() {
    this._actions.push({method: 'orderbook'});
    return this;
};

TradeCalculations.prototype.exec = function exec() {
    var self = this;
    return function (env, order, rate) { // rate kann undefined sein
        var i, cur, info = [], arg0, arg1, arg2, getob, cdl, tmp;
        
        getob = function (d) { return d[0]; };

        for (i = 0; i < self._actions.length; i++) {
            switch (self._actions[i].method) {
                    
            case 'sar':
                arg0 = self._actions[i].args[0];
                if (!!(arg0 && arg0.constructor && arg0.call && arg0.apply)) { arg0 = arg0(env, order, rate); }
                
                arg1 = self._actions[i].args[1];
                if (!!(arg1 && arg1.constructor && arg1.call && arg1.apply)) { arg1 = arg1(env, order, rate); }
                
                arg2 = self._actions[i].args[2];
                if (!!(arg2 && arg2.constructor && arg2.call && arg2.apply)) { arg2 = arg2(env, order, rate); }
                
                cdl = env.candles(order.symbol, arg0, { SAR: { AF: arg1, AFMax: arg2 } });
                cur = cdl[0].sar;
                    
                info.push({method: 'sar', value: cur, args: [{ v: (arg0 / (1000 * 60)), u: 'm' }, { v: arg1, u: 'AF' }, { v: arg2, u: 'AFmax' }]});
                break;
                    
            case 'sarpostype':
                arg0 = self._actions[i].args[0];
                if (!!(arg0 && arg0.constructor && arg0.call && arg0.apply)) { arg0 = arg0(env, order, rate); }
                
                arg1 = self._actions[i].args[1];
                if (!!(arg1 && arg1.constructor && arg1.call && arg1.apply)) { arg1 = arg1(env, order, rate); }
                
                arg2 = self._actions[i].args[2];
                if (!!(arg2 && arg2.constructor && arg2.call && arg2.apply)) { arg2 = arg2(env, order, rate); }
                
                cdl = env.candles(order.symbol, arg0, { SAR: { AF: arg1, AFMax: arg2 } });
                cur = cdl[0].sarislong ? 'buy' : 'sell';
                break;
                    
            case 'totalBTC':
                cur = env.balance.totalBTC;
                info.push({method: 'totalBTC', value: cur, args: []});
                break;
            case 'last':
                cur = env.history[order.symbol].last;
                info.push({method: 'last', value: cur, args: []});
                break;
                    
            case 'orderbook':
                if (order.orderType === 'buy') {
                    if (cur > max(env.orderbook[order.symbol].bids, getob)) {
                        tmp = max(env.orderbook[order.symbol].bids, getob) + 0.000001;
                        if (tmp !== undefined && tmp !== null) {
                            cur = tmp;
                        }
                        info.push({method: 'ordberbook', args: [], value: cur});
                    }
                    
                } else {
                    if (cur < min(env.orderbook[order.symbol].asks, getob)) {
                        tmp = min(env.orderbook[order.symbol].asks, getob) - 0.000001;
                        if (tmp !== undefined && tmp !== null) {
                            cur = tmp;
                        }
                        info.push({method: 'ordberbook', args: [], value: cur});
                    }
                }
                break;
                    
            case 'percent':
                arg0 = self._actions[i].args[0];
                if (!!(arg0 && arg0.constructor && arg0.call && arg0.apply)) { arg0 = arg0(env, order, rate); }
                cur *= (arg0 / 100);
                info.push({method: 'percent', args: [{ v: arg0, u: '%' }], value: cur});
                break;
            case 'target':
                    
                if (env.balance[order.symbol.substr(order.symbol.indexOf('_') + 1)] === undefined) {
                    console.log(order.symbol.substr(order.symbol.indexOf('_') + 1) + ' is undefined');
                    throw new Error('undefined symbol: ' + order.symbol.substr(order.symbol.indexOf('_') + 1));
                }
                    
                arg0 = self._actions[i].args[0];
                if (!!(arg0 && arg0.constructor && arg0.call && arg0.apply)) { arg0 = arg0(env, order, rate); }
                arg0 = env.balance.totalBTC * (arg0 / 100);
                    
                arg1 = self._actions[i].args[1];
                if (!!(arg1 && arg1.constructor && arg1.call && arg1.apply)) { arg1 = arg1(env, order, rate); }
                    
                if (order.type === 'buy' && arg0 > env.balance[order.symbol.substr(order.symbol.indexOf('_') + 1)].asBTC) {
                    cur *= arg1;
                    info.push({method: 'target', args: [{v: arg0.toFixed(6), u: 'BTC'}, {v: arg1, u: '*'}], value: cur});
                }
                    
                if (order.type === 'sell' && arg0 < env.balance[order.symbol.substr(order.symbol.indexOf('_') + 1)].asBTC) {
                    cur *= arg1;
                    info.push({method: 'target', args: [{v: arg0.toFixed(6), u: 'BTC'}, {v: arg1, u: '*'}], value: cur});
                }
                    
                break;
                    
            case 'avgsell':
                arg0 = self._actions[i].args[0];
                if (!!(arg0 && arg0.constructor && arg0.call && arg0.apply)) { arg0 = arg0(env, order, rate); }
                
                if (rate !== undefined) {
                    if (order.type === 'buy' && rate < env.mytrades[order.symbol].avgsell) {
                        cur *= arg0;
                        info.push({method: 'avgsell', args: [{v: arg0, u: '*'}], value: cur});
                    }

                    if (order.type === 'sell' && rate > env.mytrades[order.symbol].avgsell) {
                        cur *= arg0;
                        info.push({method: 'avgsell', args: [{v: arg0, u: '*'}], value: cur});
                    }
                }
                break;
                                        
            case 'avgbuy':
                arg0 = self._actions[i].args[0];
                if (!!(arg0 && arg0.constructor && arg0.call && arg0.apply)) { arg0 = arg0(env, order, rate); }
                
                if (rate !== undefined) {
                    if (order.type === 'buy' && rate < env.mytrades[order.symbol].avgbuy) {
                        cur *= arg0;
                        info.push({method: 'avgbuy', args: [{v: arg0, u: '*'}], value: cur});
                    }

                    if (order.type === 'sell' && rate > env.mytrades[order.symbol].avgbuy) {
                        cur *= arg0;
                        info.push({method: 'avgbuy', args: [{v: arg0, u: '*'}], value: cur});
                    }
                }
                break;
                    
            case 'tosymbol':
                cur = cur / env.history[order.symbol].last;
                info.push({method: 'tosymbol', args: [], value: cur});
                break;
                
            default:
                console.log('unkown method', self._actions[i].method);
            }
        }
        
        if (rate !== undefined) {
            order.calcamount = info;
        } else {
            order.calcrate = info;
        }

        return cur;
    };
};

trade.totalBTC = function totalBTC() {
    var calc = new TradeCalculations();
    calc._actions.push({method: 'totalBTC'});
    
    return calc;
};

trade.last = function last() {
    var calc = new TradeCalculations();
    calc._actions.push({method: 'last'});
    
    return calc;
};

trade.sarpostype = function sarpostype(candlewidth, af, afmax) {
    var calc = new TradeCalculations();
    calc._actions.push({method: 'sarpostype', args: [candlewidth, af, afmax]});
    
    return calc;
};

trade.sar = function sar(candlewidth, af, afmax) {
    var calc = new TradeCalculations();
    calc._actions.push({method: 'sar', args: [candlewidth, af, afmax]});
    
    return calc;
};

function ismatch(m1, m2, diff) {
    if (m1 < m2) {
        // console.log(m1.toFixed(6), m2.toFixed(6), diff.toFixed(6), diff > (m2 - m1));
        m2 = m2 - m1;
        return diff > m2;
    } else {
        // console.log(m1.toFixed(6), m2.toFixed(6), diff.toFixed(6), diff > (m1 - m2));
        m1 = m1 - m2;
        return diff > m1;
    }
}

trade.checkCancels = function checkCancels(market, env) {
    var i;
    
    if (env.openorders === undefined) {
        return false;
    }
    
    for (i = 0; i < env.openorders[market].length; i++) {
        if (current[env.openorders[market][i].orderNumber] === undefined) {
            return true;
        }
    }
    
    return false;
};

trade.executeCancels = function executeCancels(callback, market, env) {
    var i, cancels = [], log = '', start = new Date().getTime();

    if (env.openorders === undefined) {
        callback('');
        return false;
    }
    
    for (i = 0; i < env.openorders[market].length; i++) {
        if (current[env.openorders[market][i].orderNumber] === undefined) {
            cancels.push(env.openorders[market][i].orderNumber);
        }
    }
    
    async.map(cancels,
        function (item, cb) {
            log += ' CANCEL ' + item;
            poloniex.cancel_order(market, item, cb);
        },
        function (err, results) {
        
            env._dirtyOpenOrders = true;
            env.updateOpenOrders(function (l) {
                callback(l + ' ' + log + ' took ' + ((new Date().getTime() - start) / 1000) + 's');
            });
            
        }
        );
};

trade.checkTrade = function checkTrade(order, env) {
    var rate, type, amount, res = false;
    
    if (env.history === undefined || env.mytrades === undefined || env.balance === undefined || env.orderbook === undefined || env.orderbook[order.symbol] === undefined) {
        return res;
    }
    
    if (env.history[order.symbol] === undefined || env.mytrades[order.symbol] === undefined) {
        return res;
    }
    
    type = order.type;
    if (!!(type && type.constructor && type.call && type.apply)) { type = type(env, order); }
    order.orderType = type;
    
    rate = order.rate(env, order);
    if (order.orderRate === undefined || !ismatch(rate, parseFloat(order.orderRate), 0.000001)) {
        order.orderRate = rate.toFixed(6);
        res = true;
    }

    amount = order.amount(env, order, rate);
    if (order.orderAmount === undefined || amount.toFixed(2) !== order.orderAmount) {
        order.orderAmount = amount.toFixed(2);
        res = true;
    }

    return res;
};

trade.executeTrade = function executeTrade(callback, order, env) {
    var start = new Date().getTime(), log = '', setorder;
    setorder = function (o, s, l, cb) {
        o.orderNumber = 'pending';
        if (o.orderType === 'buy') {
            l += ' ' + clc.green(o.orderType.toUpperCase()) + '  ' + o.symbol + ' ' + o.orderAmount + ' ' + o.orderRate + 'BTC';
            poloniex.buy(o.symbol, o.orderAmount, o.orderRate, function (err, result) {
                if (result.error !== undefined) {
                    console.log('\t', result.error, JSON.stringify(o));
                }
                if (err !== undefined) {
                    console.log('\t', err, JSON.stringify(o));
                }
                current[result.orderNumber] = 'OPEN';
                env._dirtyOpenOrders = true;
                o.orderNumber = result.orderNumber;
                publisher.publish(o.symbol + '.trade.' + o.orderNumber, JSON.stringify(o), 1000 * 60 * 60 * 24 * 7);
                cb(l + ' took ' + ((new Date().getTime() - start) / 1000) + 's');
            });
        } else {
            l += ' ' + clc.red(o.orderType.toUpperCase()) + ' ' + o.symbol + ' ' + o.orderAmount + ' ' + o.orderRate + 'BTC';
            poloniex.sell(o.symbol, o.orderAmount, o.orderRate, function (err, result) {
                if (result.error !== undefined) {
                    console.log('\t', result.error, JSON.stringify(o));
                }
                if (err !== undefined) {
                    console.log('\t', err, JSON.stringify(o));
                }
                current[result.orderNumber] = 'OPEN';
                o.orderNumber = result.orderNumber;
                env._dirtyOpenOrders = true;
                publisher.publish(o.symbol + '.trade.' + o.orderNumber, JSON.stringify(o), 1000 * 60 * 60 * 24 * 7);
                cb(l + ' took ' + ((new Date().getTime() - start) / 1000) + 's');
            });
        }
    };
    
    if (order.orderNumber !== undefined) {
        current[order.orderNumber] = undefined;
    }

    if (order.orderType === undefined) {
        log += ' DISABLED ' + order.symbol + ' ' + order.orderAmount + ' ' + order.orderRate + 'BTC';
        callback(log);
    } else {
        setorder(order, start, log, callback);
    }
};

module.exports = trade;