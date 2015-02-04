/*jslint node: true */
/*jslint nomen: true */
/*jslint plusplus: true */
'use strict';

module.exports = function (candle, past, opts) {
    var ewt = 2 / (10 + 1);
    if (opts !== undefined && opts.EWT !== undefined) { ewt = opts.EWT; }
    
    if (past.length < 2) {
        candle.ema = candle.close;
    } else {
        candle.ema = ((past[0].close - past[1].ema) * ewt) + past[0].ema;
    }
};