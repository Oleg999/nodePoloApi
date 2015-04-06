/*jslint node: true */
/*jslint nomen: true */
/*jslint plusplus: true */
'use strict';

var env = require('./env');
var trade = require('./trade');
var config = require('../config');

var actions = [], i, ii;

var markets = config.markets;

var XMRTARGET = 66;

var actionsDef = [
    {
        interval: 1000 * 15,
        title: 'Balance',
        action: env.updateBalance
    },
    {
        interval: 1000,
        title: 'Cancel',
        check: trade.checkCancels,
        loop: markets,
        action: trade.executeCancels
    },
    {
        interval: 1000 * 60 * 5,
        title: 'OrderBook',
        action: env.updateOrderBook
    },
    {
        interval: 1000 * 15,
        title: 'MyTrades',
        check: env.dirtyMyTrades,
        action: env.updateMyTrades
    },
    {
        interval: 1000 * 15,
        check: env.dirtyOpenOrders,
        title: 'OpenOrders',
        action: env.updateOpenOrders
    },
    {
        interval: 1000 * 60 * 13,
        title: 'History',
        loop: markets,
        action: env.updateHistory
    },
    {
        interval: 1000 * 10,
        title: 'Trade',
        loop: [
            {
                symbol: 'BTC_XMR',
                type: 'sell',
                amount: trade.totalBTC().percent(6).ifAvgSell(1.25).ifTarget(XMRTARGET, 1.5).toSymbol().exec(),
                rate: trade.last().percent(106).orderbook().exec(),
                toString: function () {
                    return 'SELL  XMR 6%   ';
                }
            },
            {
                symbol: 'BTC_XMR',
                type: 'sell',
                amount: trade.totalBTC().percent(4).ifAvgSell(1.25).ifTarget(XMRTARGET, 1.5).toSymbol().exec(),
                rate: trade.last().percent(104).orderbook().exec(),
                toString: function () {
                    return 'SELL  XMR 4%   ';
                }
            },
            {
                symbol: 'BTC_XMR',
                type: 'sell',
                amount: trade.totalBTC().percent(1).ifAvgSell(1.25).ifTarget(XMRTARGET, 1.5).toSymbol().exec(),
                rate: trade.last().percent(102).orderbook().exec(),
                toString: function () {
                    return 'SELL  XMR 2%   ';
                }
            },
            {
                symbol: 'BTC_XMR',
                type: 'buy',
                amount: trade.totalBTC().percent(1).ifAvgBuy(1.25).ifTarget(XMRTARGET, 1.5).toSymbol().exec(),
                rate: trade.last().percent(98).orderbook().exec(),
                toString: function () {
                    return 'BUY   XMR 2%   ';
                }
            },
            {
                symbol: 'BTC_XMR',
                type: 'buy',
                amount: trade.totalBTC().percent(4).ifAvgBuy(1.25).ifTarget(XMRTARGET, 1.5).toSymbol().exec(),
                rate: trade.last().percent(96).orderbook().exec(),
                toString: function () {
                    return 'BUY   XMR 4%   ';
                }
            },
            {
                symbol: 'BTC_XMR',
                type: 'buy',
                amount: trade.totalBTC().percent(6).ifAvgBuy(1.25).ifTarget(XMRTARGET, 1.5).toSymbol().exec(),
                rate: trade.last().percent(94).orderbook().exec(),
                toString: function () {
                    return 'BUY   XMR 6%   ';
                }
            }
            
        ],
        check: trade.checkTrade,
        action: trade.executeTrade
    }
];

for (i = 0; i < actionsDef.length; i++) {
    if (actionsDef[i].loop === undefined) {
        actions.push({
            action: actionsDef[i],
            item: undefined
        });
    } else {
        for (ii = 0; ii < actionsDef[i].loop.length; ii++) {
            actions.push({
                action: actionsDef[i],
                item: actionsDef[i].loop[ii]
            });
        }
    }
}

env.connect(markets);

function next() {
    var current = Math.floor(Math.random() * actions.length),
        action = actions[current].action,
        item = actions[current].item,
        shouldrun = false,
        callback;

    callback = function (log) {
        console.log(new Date().toLocaleString(), action.title, item === undefined ? '' : item.toString(), log);
        setTimeout(next, 1000);
    };

    if (action.interval !== undefined) {
        if (actions[current].lastrun === undefined || (new Date().getTime() - actions[current].lastrun) > action.interval) {
            shouldrun = true;
        }
    } else {
        shouldrun = true;
    }

    if (action.check !== undefined && shouldrun) {
        shouldrun = action.check(item, env);
    }

    if (shouldrun) {
        actions[current].lastrun = (new Date()).getTime();
        action.action(callback, item, env);
    } else {
        setTimeout(next, 1000);
    }
}

setTimeout(next, 2000);

module.exports = actions;
