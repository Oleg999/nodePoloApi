/*jslint node: true */
/*jslint continue: true */
/*jslint nomen: true */
/*jslint plusplus: true */
'use strict';

var poloniex = require('../lib/poloniex');
var config = require('../config');
var async = require('async');
var publisher  = require('../lib/publisher'); // SYMBOL.history, balance, SYMBOL.openorders, SYMBOL.orderbook, SYMBOL.mytrades
var env = {};
var clc = require('cli-color');
var _candles = require('../lib/candles');

async.mapSeries(config.markets, function (item, callback) {
    console.log('CANCEL orders', item);
    poloniex.cancel_orders(item, function (err) { callback(); });
});

function fmtdate(strdate) {
    var s = strdate.split(/[-: ]/);
    return new Date(parseInt(s[0], 10), parseInt(s[1], 10) - 1, parseInt(s[2], 10), parseInt(s[3], 10), parseInt(s[4], 10), parseInt(s[5], 10));
}

function _modifyorderbook(symbol, rate, amount, bidask) {
    var i,
        found = false;
    
    rate = parseFloat(rate);
    amount = parseFloat(amount);
    bidask += 's';
    
    if (env === undefined || env.orderbook === undefined || env.orderbook[symbol] === undefined) {
        return;
    }
    
    for (i = 0; i < env.orderbook[symbol][bidask].length; i++) {
        if (env.orderbook[symbol][bidask][i][0] === rate) {
            
            env.orderbook[symbol][bidask][i][1] = amount;
            found = true;
            break;
            
        } else if (bidask === 'bids' && env.orderbook[symbol][bidask][i][0] < rate) {
            
            env.orderbook[symbol][bidask].splice(i, 0, [rate, amount]);
            found = true;
            break;
            
        } else if (bidask === 'asks' && env.orderbook[symbol][bidask][i][0] > rate) {
           
            env.orderbook[symbol][bidask].splice(i, 0, [rate, amount]);
            found = true;
            break;
            
        }
    }
    
    if (!found) {
        env.orderbook[symbol][bidask].push([rate, amount]);
    }
}

function _removefromorderbook(symbol, rate, bidask) {
    var i,
        found = false;
    
    if (env === undefined || env.orderbook === undefined || env.orderbook[symbol] === undefined) {
        return;
    }
    
    rate = parseFloat(rate);

    bidask += 's';
    
    for (i = 0; i < env.orderbook[symbol][bidask].length; i++) {
        if (env.orderbook[symbol][bidask][i][0] === rate) {
            env.orderbook[symbol][bidask].splice(i, 1);
            found = true;
            break;
        }
    }
}

env._dirtyMyTrades = false;
env._dirtyOpenOrders = false;

env.dirtyOpenOrders = function dirtyOpenOrders() {
    return env._dirtyOpenOrders;
};

env.dirtyMyTrades = function dirtyMyTrades() {
    return env._dirtyMyTrades;
};

// { SAR: { AF: arg1, AFMax: arg2 } }
env.candles = function candles(market, candleWidth, opts) {
    return _candles.get(candleWidth, env.history[market].trades, opts);
};

env.connect = function connect(symbols) {

    poloniex.connectmarket(symbols, function ticker(symbol, tick) {
        var i, orderbook = false, history = false;
        
        try {
        
            for (i = 0; i < tick.length; i++) {
                if (tick[i].type === 'orderBookRemove') { // { data: { rate: '0.00129499', type: 'ask' }, type: 'orderBookRemove' }
                    _removefromorderbook(symbol, tick[i].data.rate, tick[i].data.type);
                    orderbook = true;
                } else if (tick[i].type === 'orderBookModify') { // { data: { rate: '0.00125083', type: 'ask', amount: '19.47585661' }, type: 'orderBookModify' }
                    _modifyorderbook(symbol, tick[i].data.rate, tick[i].data.amount, tick[i].data.type);
                    orderbook = true;
                } else if (tick[i].type === 'newTrade') { // BTC_CLAM newTrade { data: { tradeID: '190489', rate: '0.00519751', amount: '0.08551438', date: '2015-01-30 23:53:05', total: '0.00044446', type: 'buy' }, type: 'newTrade' }
                    console.log(new Date().toLocaleString(), clc.yellow('newTrade'), JSON.stringify(env.history[symbol].trades[0]));
                    env.history[symbol].trades.unshift({ date: fmtdate(tick[i].data.date).getTime(), rate: parseFloat(tick[i].data.rate), amount: parseFloat(tick[i].data.amount) });
                    env.history[symbol].last = parseFloat(parseFloat(tick[i].data.rate));
                    history = true;
                } else {
                    console.log('unkown', tick[i].type);
                }
            }

            if (history && env.history !== undefined && env.history[symbol] !== undefined) {
                publisher.publish(symbol + '.history', JSON.stringify(env.history[symbol]));
            }

            if (orderbook && env.orderbook !== undefined && env.orderbook[symbol] !== undefined) {
                publisher.publish(symbol + '.orderbook', JSON.stringify(env.orderbook[symbol]));
            }
            
        } catch (e) {
            console.log('market error', e, e.stack);
        }
    }, function (tick) {
        var i, history = false;
        // ['BTC_BBR','0.00069501','0.00074346','0.00069501','-0.00742634','8.63286802','11983.47150109',0,'0.00107920','0.00045422']
        // currencyPair, last, lowestAsk, highestBid, percentChange, baseVolume, quoteVolume, isFrozen, 24hrHigh, 24hrLow
        
        if (env.history === undefined) {
            return;
        }
        
        try {
            for (i = 0; i < config.markets.length; i++) {
                history = false;
                
                if (env.history === undefined || env.history[config.markets[i]] === undefined || env.history[config.markets[i]].last === undefined) {
                    
                    console.log(config.markets[i], 'unkown market');
                    continue;
                }
                
                if (tick[0] === config.markets[i] && env.history[config.markets[i]].last !== parseFloat(tick[1])) {
                    console.log(new Date().toLocaleString(), clc.yellow('Tick'), config.markets[i], parseFloat(tick[1]));
                    env.history[config.markets[i]].trades.unshift({ date: new Date().getTime(), rate: parseFloat(tick[1]), amount: 1 });
                    env.history[config.markets[i]].last = parseFloat(tick[1]);
                    history = true;

                }

                if (history) {
                    publisher.publish(config.markets[i] + '.history', JSON.stringify(env.history[config.markets[i]]));
                }
            }
        } catch (e) {
            console.log('ticker error', e, e.stack);
        }
    });
};


env.updateBalance = function updateBalance(callback) {
    var start = new Date().getTime(), b;
    poloniex.get_balance(function (err, balances) {
        var symbol, total;
        // {"LTC":{"available":"5.015","onOrders":"1.0025","btcValue":"0.078"},"NXT:{...} ... }

        if (err === undefined) {
            if (env.balance === undefined) {
                env.balance = {};
            }

            total = 0;
            for (symbol in balances) {
                if (balances.hasOwnProperty(symbol) && parseFloat(balances[symbol].btcValue) > 0) {
                    if (env.balance[symbol] === undefined) {
                        env.balance[symbol] = {};
                    }
                    
                    if (env.balance[symbol].available !== parseFloat(balances[symbol].available)) {
                        env._dirtyMyTrades = true;
                        env._dirtyOpenOrders = true;
                    }
                    
                    if (env.balance[symbol].onOrders !== parseFloat(balances[symbol].onOrders)) {
                        env._dirtyMyTrades = true;
                        env._dirtyOpenOrders = true;
                    }
                    
                    env.balance[symbol].available = parseFloat(balances[symbol].available);
                    env.balance[symbol].onOrders = parseFloat(balances[symbol].onOrders);
                    env.balance[symbol].amount = parseFloat(balances[symbol].available) + parseFloat(balances[symbol].onOrders);
                    env.balance[symbol].asBTC = parseFloat(balances[symbol].btcValue);

                    total += parseFloat(balances[symbol].btcValue);
                }
            }
            env.balance.totalBTC = total;
        }

        publisher.publish('balance', JSON.stringify(env.balance));
        callback('took ' + ((new Date().getTime() - start) / 1000) + 's');
    });
};
env.updateOpenOrders = function updateOpenOrders(callback) {
    
    if (!env.dirtyOpenOrders()) {
        callback(' DISABLED');
        return;
    }
    
    var start = new Date().getTime();
    poloniex.get_orders(undefined, function (err, orders) {
        var symbol, result, i;

        if (err === undefined) {
            if (env.openorders === undefined) {
                env.openorders = {};
            }

            env._dirtyOpenOrders = false;
            
            for (symbol in orders) {
                if (orders.hasOwnProperty(symbol)) {
                    result = [];
                    
                    for (i = 0; i < orders[symbol].length; i++) {
                        result.push({ market: symbol, orderNumber: orders[symbol][i].orderNumber, type: orders[symbol][i].type, amount: parseFloat(orders[symbol][i].amount), rate: parseFloat(orders[symbol][i].rate) });
                    }
                    env.openorders[symbol] = result;
                    publisher.publish(symbol + '.openorders', JSON.stringify(env.openorders[symbol]));
                }
            }
        }

        callback('took ' + ((new Date().getTime() - start) / 1000) + 's');
    });
};
env.updateOrderBook = function updateOrderBook(callback) {
    var start = new Date().getTime();
    poloniex.get_orderbook(undefined, 200, function (err, orderbook) {
        var symbol, i;

        if (err === undefined) {
            if (env.orderbook === undefined) {
                env.orderbook = {};
            }

            for (symbol in orderbook) {
                if (orderbook.hasOwnProperty(symbol)) {
                    env.orderbook[symbol] = orderbook[symbol];
                    
                    for (i = 0; i < env.orderbook[symbol].bids.length; i++) {
                        env.orderbook[symbol].bids[i] = [
                            parseFloat(env.orderbook[symbol].bids[i][0]),
                            parseFloat(env.orderbook[symbol].bids[i][1])
                        ];
                    }
                    
                    for (i = 0; i < env.orderbook[symbol].asks.length; i++) {
                        env.orderbook[symbol].asks[i] = [
                            parseFloat(env.orderbook[symbol].asks[i][0]),
                            parseFloat(env.orderbook[symbol].asks[i][1])
                        ];
                    }
                    publisher.publish(symbol + '.orderbook', JSON.stringify(env.orderbook[symbol]));
                }
            }
        }

        callback('took ' + ((new Date().getTime() - start) / 1000) + 's');
    });
};
env.updateMyTrades = function updateMyTrades(callback) {
    
    if (!env.dirtyMyTrades()) {
        callback(' DISABLED');
        return;
    }
    
    var start = new Date().getTime();
    poloniex.get_tradehistory(undefined, Math.round((new Date()).getTime() / 1000) - (60 * 60 * 24 * 7), function (err, trades) {
        var symbol, i, sellamount, sellprice, buyamount, buyprice, trade, result, ii;
        // {"BTC_NXT":[{"date":"2014-02-19 03:44:59","rate":"0.0011","amount":"99.9070909","total":"0.10989779","orderNumber":"3048809", "type":"sell"},{"date":"2014-02-19 04:55:44","rate":"0.0015","amount":"100","total":"0.15","orderNumber":"3048903","type":"sell"}, ... ],"BTC_LTX":[ ... ] ... }
        if (err === undefined) {

            if (env.mytrades === undefined) {
                env.mytrades = {};
            }

            env._dirtyMyTrades = false;
            for (symbol in trades) {
                if (trades.hasOwnProperty(symbol)) {

                    sellprice = 0;
                    sellamount = 0;
                    buyprice = 0;
                    buyamount = 0;

                    if (trades[symbol] !== undefined && trades[symbol].length > 0) {

                        for (i = 0; i < trades[symbol].length; i++) {
                            trade = trades[symbol][i];

                            if (trade.type === 'buy') {
                                buyprice += parseFloat(trade.total);
                                buyamount += parseFloat(trade.amount);
                            } else if (trade.type === 'sell') {
                                sellprice += parseFloat(trade.total);
                                sellamount += parseFloat(trade.amount);
                            }
                        }

                        if (env.mytrades[symbol] === undefined) {
                            env.mytrades[symbol] = {};
                        }

                        result = [];
                        for (ii = 0; ii < trades[symbol].length; ii++) {
                            result.push({ orderNumber: trades[symbol][ii].orderNumber, type: trades[symbol][ii].type, date: fmtdate(trades[symbol][ii].date).getTime(), rate: parseFloat(trades[symbol][ii].rate), amount: parseFloat(trades[symbol][ii].amount) });
                        }
                        
                        env.mytrades[symbol].trades = result;

                        if (buyamount > 0) {
                            env.mytrades[symbol].avgbuy = buyprice / buyamount;
                        }

                        if (sellamount > 0) {
                            env.mytrades[symbol].avgsell = sellprice / sellamount;
                        }
                    }
                    publisher.publish(symbol + '.mytrades', JSON.stringify(env.mytrades[symbol]));
                }
            }
        }
        callback('took ' + ((new Date().getTime() - start) / 1000) + 's');
    });
};

env.updateHistory = function updateHistory(callback, symbol) {
    var start = new Date().getTime();
    poloniex.get_publictradehistory(symbol, Math.round((new Date()).getTime() / 1000) - (60 * 60 * 24 * 7), function (err, trades) {
        var result = [], i;
        
        // [{"tradeID":21387,"date":"2014-09-12 05:21:26","type":"buy","rate":"0.00008943","amount":"1.27241180","total":"0.00011379"},{"t
        if (err === undefined) {
            if (env.history === undefined) {
                env.history = {};
            }
            
            if (env.history[symbol] === undefined) {
                env.history[symbol] = {};
            }
            
            for (i = 0; i < trades.length; i++) {
                result.push({ date: fmtdate(trades[i].date).getTime(), rate: parseFloat(trades[i].rate), amount: parseFloat(trades[i].amount) });
            }
            
            env.history[symbol].trades = result;
            env.history[symbol].last = trades[0].rate;
        }
        publisher.publish(symbol + '.history', JSON.stringify(env.history[symbol]));
        callback('took ' + ((new Date().getTime() - start) / 1000) + 's');
    });
};

module.exports = env;