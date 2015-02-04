/*jslint node: true */
/*jslint nomen: true */
/*jslint plusplus: true */
'use strict';


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

module.exports = function (candle, past, opts) {
    var AF = 0.01, AFMax = 0.05, long = true, reverse;
    if (opts !== undefined && opts.AF !== undefined) { AF = opts.AF; }
    if (opts !== undefined && opts.AFMax !== undefined) { AFMax = opts.AFMax; }
    if (opts !== undefined && opts.long !== undefined) { AF = opts.long; }
    
    if (past.length === 0) {
        candle.sar = candle.close;
        candle.sarislong = true;
        candle.af = AF;             //init acelleration factor
        candle.ep = candle.low;     //init extreme point
        candle.hp = candle.high;
        candle.lp = candle.low;
    } else {
        candle.sarislong = past[0].sarislong;
        candle.af = past[0].af;
        candle.ep = past[0].ep;
        candle.hp = past[0].hp;
        candle.lp = past[0].lp;
        
        if (candle.sarislong) {
            candle.sar = past[0].sar + past[0].af * (past[0].hp - past[0].sar);
        } else {
            candle.sar = past[0].sar + past[0].af * (past[0].lp - past[0].sar);
        }
        
        reverse = true;
        
        if (candle.sarislong) {
            if (candle.low < candle.sar) {
                candle.sarislong = false;
                reverse = false;            //reverse position to short
                candle.sar = candle.hp;    //sar is high point in prev trade
                candle.lp = candle.low;
                candle.af = AF;
            }
        } else {
            if (candle.high > candle.sar) {
                candle.sarislong = true;
                reverse = false;            //reverse position to long
                candle.sar = candle.lp;
                candle.hp = candle.high;
                candle.af = AF;
            }
        }
        
        if (reverse) {
            if (candle.sarislong) {
                if (candle.high > candle.hp) {
                    candle.hp = candle.high;
                    candle.af += AF;
                    candle.af = _min([candle.af, AFMax]);
                }
                candle.sar = _min([candle.sar, past[0].low, past.length > 1 ? past[1].low : past[0].low]);
            } else {
                if (candle.low < candle.lp) {
                    candle.lp = candle.low;
                    candle.af += AF;
                    candle.af = _min([candle.af, AFMax]);
                }
                candle.sar = _max([candle.sar, past[0].high, past.length > 1 ? past[1].high : past[0].high]);
            }
        }
    }
};