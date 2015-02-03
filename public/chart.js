/*jslint nomen: true */
/*jslint plusplus: true */
/*jslint browser: true*/
/*jslint node: true*/
/*global d3, io, nunjucks, olhcSeries, socket, env*/
'use strict';

var _current = {};

var margin = {
    top: 30,
    right: 100,
    bottom: 20,
    left: 0,
    smalltop: 10,
    smallbottom: 25
};

var tooltip;

function getSize(container) {
    return {
        width: parseInt(container.style('width'), 10) - margin.left - margin.right,
        height: parseInt(container.style('height'), 10) - margin.top - margin.bottom - 100,
        smallheight: 50
    };
}


function dateTickFormat(value) {
    var v, v1, d, units, u, h = '', m;

    v = parseInt(value.getTime(), 10);
    v1 = new Date().getTime();
    d = v1 - v;

    if (d < 0) {
        return '';
    }

    units = ['s', 'm', 'h', 'd'];
    u = 0;
    d /= 1000;

    if (d > 60) {
        u++;
        d /= 60;
    }
    if (d > 60) {
        u++;
        d /= 60;
    }
    if (d > 24) {
        u++;
        m = d % 24;
        d /= 24;
        h = ' ' + m.toFixed(0) + 'h';
    }

    return d.toFixed(0) + units[u] + h;
}

function createAxis(size) {
    var axis = {
        rateScale: d3.scale.linear().range([size.height, 0]),
        volumeScale: d3.scale.linear().range([size.width, 0]),
        dateScale: d3.time.scale().range([size.width, 0]),
        
        rateScaleSmall: d3.scale.linear().range([size.smallheight, 0]),
        dateScaleSmall: d3.time.scale().range([size.width, 0])
    };

    axis.rateSmall = d3.svg.axis().scale(axis.rateScaleSmall).orient('right').ticks(1)
        .tickFormat(function (v) { return '%0.6f'.sprintf(v); });

    axis.dateSmall = d3.svg.axis().scale(axis.dateScaleSmall).orient('bottom')
        .tickFormat(dateTickFormat);

    axis.rate = d3.svg.axis().scale(axis.rateScale).orient('right')
        .tickFormat(function (v) { return '%0.6f'.sprintf(v); });

    axis.date = d3.svg.axis().scale(axis.dateScale).orient('bottom')
        .tickFormat(dateTickFormat);

    axis.volume = d3.svg.axis().scale(axis.volumeScale).orient('top').ticks(size.width / 75).tickSize(0);

    return axis;
}

function createMaps(axis, size) {

    return {

        orderbook: d3.svg.area()
            .interpolate("step-before")
            .y(function (d) {
                return axis.rateScale(d[0]);
            })
            .x0(function (d) {
                return axis.volumeScale(d[1]);
            })
            .x1(size.width),

        olhc: olhcSeries.ohlc()
            .xScale(axis.dateScale)
            .yScale(axis.rateScale),

        avgbuys: d3.svg.area()
            .y0(function (d) {
                return axis.rateScale(d.avgbuy);
            })
            .y1(size.height)
            .x(function (d) {
                return axis.dateScale(d.date);
            }),

        avgsells: d3.svg.area()
            .y0(function (d) {
                return axis.rateScale(d.avgsell);
            })
            .y1(0)
            .x(function (d) {
                return axis.dateScale(d.date);
            }),
        
        ema: d3.svg.line()
            .y(function (d) { return axis.rateScale(d.ema); })
            .x(function (d) { return axis.dateScale(d.date); }),
        
        closeSmall: d3.svg.line()
            .y(function (d) { return axis.rateScaleSmall(d.close); })
            .x(function (d) { return axis.dateScaleSmall(d.date); }),
        
        viewport: d3.svg.area()
            .y0(function (d) { return axis.rateScaleSmall(d.close); })
            .y1(size.smallheight)
            .x(function (d) { return axis.dateScaleSmall(d.date); })
    };
}

function setDomain(market) {
    var min,
        max,
        vmin,
        vmax,
        newest,
        trades = [],
        i,
        realoldest,
        oldest,
        ccount,
        last,
        maxvol,
        minvol,
        data,
        axis,
        rateTickValues = [];

    data = _current[market].data;
    axis = _current[market].axis;
    
    newest = new Date(data.olhc[0].date + (data.candleWidth * 2));
    realoldest = new Date(data.olhc[data.olhc.length - 1].date);
    oldest = new Date(data.olhc[data.olhc.length - 1].date);
    ccount = parseInt(_current[market].size.width / 15, 10);
    
    // oldest so setzen, dass immer width / 10 candles sichtbar sein
    if (ccount > data.olhc.length) {
        ccount = data.olhc.length;
    }
    oldest = data.olhc[ccount].date;
    last = data.olhc[0].close;
    rateTickValues.push(last);
    
    min = data.min * 0.98;
    max = data.max * 1.02;
    
    vmin = d3.min([
        d3.min(data.olhc, function (d) { if (d.date < oldest) { return 999999999; } return d.low; }),
        d3.min(data.trades, function (d) { if (d.date < oldest) { return 999999999; } return d.rate; }),
        data.avgsell,
        data.avgbuy
    ]) * 0.98;
    vmax = d3.max([
        d3.max(data.olhc, function (d) { if (d.date < oldest) { return -999999; } return d.high; }),
        d3.max(data.trades, function (d) { if (d.date < oldest) { return -999999; } return d.rate; }),
        data.avgsell,
        data.avgbuy
    ]) * 1.02;
    
    if (_current[market].userZoom !== undefined) {
        if (_current[market].userZoom > 10) { _current[market].userZoom = 10; }
        if (_current[market].userZoom < -10) { _current[market].userZoom = -10; }
        
        if (last > min) {
            vmin += ((last - vmin) / 100) * _current[market].userZoom * 5;
        }
        if (last < max) {
            vmax -= ((vmax - last) / 100) * _current[market].userZoom * 5;
        }
    }
    rateTickValues.push(vmin);
    rateTickValues.push(vmax);
    
    data.rateRange = { min: min, max: max };
    data.rateViewRange = { min: vmin, max: vmax };

    data.dateRange = { min: realoldest, max: data.olhc[0].date };
    data.dateViewRange = { min: oldest, max: newest };
    
    axis.rateScale.domain([data.rateViewRange.min, data.rateViewRange.max]);
    axis.dateScale.domain([data.dateViewRange.max, data.dateViewRange.min]);
    axis.rateScaleSmall.domain([data.rateRange.min, data.rateRange.max]);
    axis.dateScaleSmall.domain([data.dateRange.max, data.dateRange.min]);
    
    if (_current[market].databind) {
        axis.rateSmall.tickValues([last]);
    }

    if (data.origorderbook === undefined) { data.origorderbook = data.orderbook; }
    data.orderbook = data.origorderbook.filter(function (v) { return v[0] > data.rateViewRange.min && v[0] < data.rateViewRange.max; });
    data.orderbook.splice(0, 0, [data.rateViewRange.max, d3.max(data.orderbook, function (d) {
        return d[0] > (((data.rateViewRange.max - data.rateViewRange.min) / 2) + data.rateViewRange.min) ? d[1] : 0;
    })]);
    data.orderbook.push([data.rateViewRange.min, d3.max(data.orderbook, function (d) {
        return d[0] < (((data.rateViewRange.max - data.rateViewRange.min) / 2) + data.rateViewRange.min) ? d[1] : 0;
    })]);

    data.orderbookViewRange = { min: 0, max: d3.max(data.orderbook, function (d) { return d[1]; }) };
    axis.volumeScale.domain([ data.orderbookViewRange.min, data.orderbookViewRange.max ]).nice();

    for (i = 0; i < data.trades.length; i++) {
        if (data.trades[i].order) {
            data.trades[i].date = data.dateViewRange.max.getTime();
            rateTickValues.push(data.trades[i].rate);
        }
    }
    
    if (data.avgbuy < data.rateViewRange.min || data.avgbuy > data.rateViewRange.max) {
        data.avgbuyData = [];
    } else {
        data.avgbuyData = [
            { avgbuy: data.avgbuy, date: data.dateViewRange.max },
            { avgbuy: data.avgbuy, date: data.dateViewRange.min }
        ];
    }
    if (data.avgsell > data.rateViewRange.max || data.avgsell < data.rateViewRange.min) {
        data.avgsellData = [];
    } else {
        data.avgsellData = [
            { avgsell: data.avgsell, date: data.dateViewRange.max },
            { avgsell: data.avgsell, date: data.dateViewRange.min }
        ];
    }
    
    axis.rate.tickValues(rateTickValues);

    data.viewport = data.olhc.filter(function (v) { return v.date > oldest; });
}

function updateChart(container) {
    var size, y, market, axis, maps, svg, data, scatter, scatterdata, rw, rh, i;
    market = container.attr('data-chart');

    size = _current[market].size;
    axis = _current[market].axis;
    maps = _current[market].maps;
    data = _current[market].data;
    
    setDomain(market);

    svg = container.select('.svg');
    if (_current[market].resize) {
        svg.attr('width', size.width + margin.left + margin.right).attr('height', size.height + margin.top + margin.bottom);
    }
    svg = svg.select('.cc');
    if (_current[market].resize) {
        svg.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
    }

    svg.select('path.orderbook').data([data.orderbook]).attr('d', maps.orderbook);

    if (_current[market].showEMA) {
        svg.select('path.ema').data([data.olhc]).attr('d', maps.ema);
    } else {
        svg.select('path.ema').data([[]]).attr('d', maps.ema);
    }

    if (_current[market].showAverages) {
        svg.select('path.avgbuy').data([data.avgbuyData]).attr('d', maps.avgbuys);
        svg.select('path.avgsell').data([data.avgsellData]).attr('d', maps.avgsells);
    } else {
        svg.select('path.avgbuy').data([[]]).attr('d', maps.avgbuys);
        svg.select('path.avgsell').data([[]]).attr('d', maps.avgsells);
    }
    
    svg.select(".x.axis.volume").call(axis.volume);
    svg.select(".y.axis.rate").attr('transform', 'translate(' + size.width + ' ,0)').call(axis.rate);
    svg.select(".x.axis.date").attr('transform', 'translate(0,' + size.height + ')').call(axis.date);

    svg.select('.olhc').data([data.olhc]).call(maps.olhc);
    
    scatterdata = data.trades;
    if (!_current[market].showTrades) {
        scatterdata = scatterdata.filter(function (t) { return t.order; });
    }
    if (_current[market].showSAR) {
        for (i = 0; i < data.viewport.length; i++) {
            scatterdata.push({ size: 1.5, color: 'white', rate: data.viewport[i].sar, date: data.viewport[i].date });
        }
    }
    scatter = svg.selectAll("circle").data(scatterdata);

    scatter.enter().append("circle")
        .on("mouseover", function () {
            var d = d3.select(this).data()[0];
            if (d.tooltip !== undefined) {
                tooltip.html(env.renderString(d3.select('#tooltip').html(), d));
                return tooltip.style("visibility", "visible");
            }
            return false;
        })
        .on("mouseout", function () { return tooltip.style("visibility", "hidden"); })
        .on("mousemove", function () {
            return tooltip
                .style("top", (d3.event.pageY - (parseInt(tooltip.style('height'), 10) / 2)) + "px")
                .style("right", (margin.right + 10) + "px");
        });

    scatter
        .attr("cx", function (d) {
            return axis.dateScale(d.date);
        })
        .attr("cy", function (d) {
            return axis.rateScale(d.rate);
        })
        .attr("r", function (d) {
            return d.size;
        })
        .style("fill", function (d) {
            return d.color;
        });

    scatter.exit().remove();
    
    // small
    svg = container.select('.ssvg').attr('width', size.width + margin.left + margin.right).attr('height', size.smallheight + margin.smalltop + margin.bottom);
    svg = svg.select('.scc').attr('transform', 'translate(' + margin.left + ',' + margin.smalltop + ')');
    
    svg.select(".y.axis.ratesmall").attr('transform', 'translate(' + size.width + ' ,0)').call(axis.rateSmall);
    svg.select(".x.axis.datesmall").attr('transform', 'translate(0,' + size.smallheight + ')').call(axis.dateSmall);
    
    svg.select('path.viewport').data([data.viewport]).attr('d', maps.viewport);
    svg.select('path.ema').data([data.olhc]).attr('d', maps.closeSmall);
    
    _current[market].candleWidth = data.candleWidth;
    d3.selectAll('[data-api="chartconfig"]').style('color', 'grey');
    d3.select('[data-api="chartconfig"][data-arg="' + data.candleWidth + '"]').style('color', 'white');
    
    _current[market].resize = false;
    _current[market].databind = false;
}

function createChart(container) {
    var x, y, market, svg, ssvg, axis;
    
    market = container.attr('data-chart');

    _current[market] = {};
    _current[market].data = {};
    _current[market].size = getSize(container);
    _current[market].axis = createAxis(_current[market].size);
    _current[market].maps = createMaps(_current[market].axis, _current[market].size);
    
    axis = _current[market].axis;

    container.html('');
    svg = container.append('svg')
        .attr('class', 'svg')
        .attr('width', _current[market].size.width + margin.left + margin.right)
        .attr('height', _current[market].size.height + margin.top + margin.bottom);
    
    tooltip = d3.select('body').append("div")
        .style("position", "absolute")
        .style("z-index", "10")
        .style("visibility", "hidden")
        .text('');
    
    svg.on("wheel.zoom", function (ev, args) {
        if (_current[market].userZoom === undefined) {
            _current[market].userZoom = 0;
        }
        _current[market].userZoom += (d3.event.deltaY < 0) ? 1 : -1;
        _current[market].resize = true;
        updateChart(container);
    });
    
    svg.on('click', function (ev, args) {
        _current[market].userZoom = undefined;
        _current[market].resize = true;
        updateChart(container);
    });
    
    svg = svg.append('g')
        .attr('class', 'cc')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    _current[market].showTrades = true;
    _current[market].showSAR = true;
    _current[market].showEMA = true;
    _current[market].showAverages = true;

    svg.append('g').attr('class', 'x axis volume').call(_current[market].axis.volume);
    svg.append('g').attr('class', 'y axis rate').attr('transform', 'translate(' + _current[market].size.width + ' ,0)').call(_current[market].axis.rate);
    svg.append('g').attr('class', 'x axis date').attr('transform', 'translate(0,' + _current[market].size.height + ')').call(_current[market].axis.date);
    
    svg.append('path').data([[]]).attr('class', 'area avgbuy').attr('d', _current[market].maps.avgbuys);
    svg.append('path').data([[]]).attr('class', 'area avgsell').attr('d', _current[market].maps.avgsells);
    svg.append('path').data([[]]).attr('class', 'area orderbook').attr('d', _current[market].maps.orderbook);
    svg.append('g').attr('class', 'series olhc').data([[]]).call(_current[market].maps.olhc);
    svg.append('path').data([[]]).attr('class', 'line ema').attr('d', _current[market].maps.ema);

    // small
    ssvg = container.append('svg')
        .attr('class', 'ssvg')
        .attr('width', _current[market].size.width + margin.left + margin.right)
        .attr('height', _current[market].size.smallheight + margin.smalltop + margin.bottom);
    
    ssvg = ssvg.append('g')
        .attr('class', 'scc')
        .attr('transform', 'translate(' + margin.left + ',' + margin.smalltop + ')');
    
    ssvg.append('g').attr('class', 'y axis ratesmall').attr('transform', 'translate(' + _current[market].size.width + ' ,0)').call(_current[market].axis.rateSmall);
    ssvg.append('g').attr('class', 'x axis datesmall').attr('transform', 'translate(0,' + _current[market].size.smallheight + ')').call(_current[market].axis.dateSmall);

    ssvg.append('path').data([[]]).attr('class', 'area viewport').attr('d', _current[market].maps.viewport);
    ssvg.append('path').data([[]]).attr('class', 'line ema').attr('d', _current[market].maps.closeSmall);
}

function resizeCharts() {

    d3.selectAll('[data-chart]').each(function () {
        var container = d3.select(this), market;

        market = container.attr('data-chart');
        
        if (_current[market].data === undefined) { return; }

        _current[market].size = getSize(container);
        _current[market].axis = createAxis(_current[market].size);
        _current[market].maps = createMaps(_current[market].axis, _current[market].size);
        _current[market].resize = true;

        updateChart(container);
    });
}


document.addEventListener('DOMContentLoaded', function DOMContentLoaded() {
    d3.select(window).on('resize', resizeCharts);
});