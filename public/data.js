/*jslint nomen: true */
/*jslint plusplus: true */
/*jslint browser: true*/
/*jslint node: true*/
/*global d3, io, nunjucks, createChart, env, socket, _current, updateChart */
'use strict';

var cache = {};
var socket = io();
var lastping = new Date().getTime();
var roundtrip;

setInterval(function () {
    lastping = new Date().getTime();
    socket.emit('ping', {});
}, 1000 * 10);

function setTemplate(d, source) {
    var dlink = source, market = '', res;
    if (d.attr('data-market') !== undefined && d.attr('data-market') !== null && d.attr('data-market') !== '') {
        market = d.attr('data-market');
        dlink += '/' + market;
    }

    res = env.renderString(d3.select('#' + source).html(), cache[dlink]);
    d.html(res);

    d.selectAll('[data-chart]').each(function () { createChart(d3.select(this)); });
    d.selectAll('[data-template]').each(function () {
        var self, src;

        self = d3.select(this);
        src = self.attr('data-template');
        setTemplate(self, src);
    });
    d.selectAll('[data-api]').on('click', function () {
        var self = d3.select(this);
        socket.emit('api', { method: self.attr('data-api'), market: self.attr('data-market'), args: [ parseInt(self.attr('data-arg'), 10) ] });
    });
    
    d3.selectAll('[data-api="chartconfig"]').style('color', 'grey');
    d3.select('[data-api="chartconfig"][data-arg="' + _current[market].candleWidth + '"]').style('color', 'white');
    
    d.selectAll('[data-apply]').each(function () {
        var self = d3.select(this),
            target = d3.select(this).attr('data-apply'),
            cur = _current,
            s = target.split('.'),
            i;

        for (i = 0; i < s.length - 1; i++) {
            cur = cur[s[i]];
        }
        this.checked = cur[s[s.length - 1]];
    });
    d.selectAll('[data-apply]').on('change', function () {
        var target = d3.select(this).attr('data-apply'),
            value = this.checked,
            cur = _current,
            s = target.split('.'),
            i;

        for (i = 0; i < s.length - 1; i++) {
            cur = cur[s[i]];
        }
        cur[s[s.length - 1]] = value;
    });
}

setInterval(function () {
    cache.page._last = new Date().getTime() - roundtrip;
    var res = env.renderString(d3.select('#status').html(), { cache: cache }), k;
    d3.selectAll('.status').html(res);
    
    for (k in cache) {
        if (cache.hasOwnProperty(k)) {
            cache[k].bg = 'black';
        }
    }
    
}, 250);

function loadTemplate(d, source) {
    var dlink = source, market = '', res, loc;
    
    if (source === 'status') { return; }
    
    if (d.attr('data-market') !== undefined && d.attr('data-market') !== null && d.attr('data-market') !== '') {
        market = d.attr('data-market');
        dlink += '/' + market;
    }
    
    socket.on(dlink, function (msg) {
        msg._last = (new Date()).getTime();
        msg.bg = '#222222';
        cache[dlink] = msg;
        setTemplate(d, source);
    });
    loc = window.location.pathname.split('/');
    loc = loc[loc.length - 1];
    d3.json(loc + '/view/' + dlink, function (data) {
        var i, res;

        if (data === null) {
            console.log(loc + '/view/' + dlink);
        }
        
        data._last = (new Date()).getTime();
        cache[dlink] = data;
        
        if (dlink === 'page') {
            i = 0;
            socket.on(cache.page.markets[i], function (msg) {
                cache[cache.page.markets[i]] = { _last: (new Date()).getTime(), bg: '#222222' };
                if (_current[cache.page.markets[i]] !== undefined) {
                    _current[cache.page.markets[i]].data = msg;
                    _current[cache.page.markets[i]].databind = true;
                    updateChart(d3.select('[data-chart="' + cache.page.markets[i] + '"]'));
                }
            });
        }
        
        res = env.renderString(d3.select('#' + source).html(), data);
        d.html(res);
        
        d.selectAll('[data-api]').on('click', function () {
            var self = d3.select(this);
            socket.emit('api', { method: self.attr('data-api'), market: self.attr('data-market'), args: [ parseInt(self.attr('data-arg'), 10) ] });
        });
        
        d.selectAll('[data-chart]').each(function () { createChart(d3.select(this)); });
        
        d.selectAll('[data-apply]').on('change', function () {
            var target = d3.select(this).attr('data-apply'),
                value = this.checked,
                cur = _current,
                s = target.split('.'),
                i;
            
            for (i = 0; i < s.length - 1; i++) {
                cur = cur[s[i]];
            }
            cur[s[s.length - 1]] = value;
        });

        d.selectAll('[data-template]').each(function () {
            var self, src;

            self = d3.select(this);
            src = self.attr('data-template');
            loadTemplate(self, src);

        });
    });
}

document.addEventListener('DOMContentLoaded', function DOMContentLoaded() {
    var sources = {},
        source;
    
    socket.on('reconnect', function () {
        var loc;
        loc = window.location.pathname.split('/');
        loc = loc[loc.length - 1];
        d3.json(loc + '/view/head', function (data) {});
    });
    
    socket.on('pong', function () {
        roundtrip = new Date().getTime() - lastping;
    });

    d3.selectAll('[data-template]').each(function () {
        var self, source;

        self = d3.select(this);
        source = self.attr('data-template');
        loadTemplate(self, source);

    });

});