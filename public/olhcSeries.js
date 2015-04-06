/*jslint nomen: true */
/*jslint plusplus: true */
/*jslint browser: true*/
/*jslint node: true*/
/*global d3, io, nunjucks, createChart, updateChart*/
'use strict';

var olhcSeries = {};

olhcSeries.ohlc = function () {
    var xScale = d3.time.scale(),
        yScale = d3.scale.linear();
    
    var isUpDay = function (d) {
        return d.close > d.open;
    };
    
    var isDownDay = function (d) {
        return !isUpDay(d);
    };
    
    var tickWidth = 7;
    var line = d3.svg.line()
        .x(function (d) { return d.x; })
        .y(function (d) { return d.y; })
        ;
    
    var highLowLines = function (bars) {
        var paths = bars.selectAll('.high-low-line').data(function (d) {
            return [d];
        });
        paths.enter().append('path');
        paths.classed('high-low-line', true)
            .attr('d', function (d) {
                return line([
                    {
                        x: xScale(d.date),
                        y: yScale(d.high)
                    },
                    {
                        x: xScale(d.date),
                        y: yScale(d.low)
                    }
                ])
            });
            paths.attr("stroke-width", function(d) {
                // 1000 => 6
                // 0 => 1
                var t = parseInt(d.volume / 1000) * 6;
                if (t > 6) { t = 6; }
                if (t < 1) { t = 1; }
            
                return t;
            });
            paths.attr("stroke-opacity", function(d) {
                // 10000 => 100
                // 0 => 25
                var t = parseInt(d.volume / 10000) * 100;
                if (t > 90) { t = 90; }
                if (t < 33) { t = 33; }
            
                return t + '%';
            });
        
    };
    var openCloseTicks = function (bars) {
        var open,
            close;
        open = bars.selectAll('.open-tick').data(function (d) {
            return [d];
        });
        close = bars.selectAll('.close-tick').data(function (d) {
            return [d];
        });

        open.enter().append('path');
        close.enter().append('path');
        open.classed('open-tick', true)
            .attr('d', function (d) {
                return line([
                    {
                        x: xScale(d.date) - tickWidth,
                        y: yScale(d.open)
                    },
                    {
                        x: xScale(d.date),
                        y: yScale(d.open)
                    }
                ]);
            });
        close.classed('close-tick', true)
            .attr('d', function (d) {
                return line([
                    {
                        x: xScale(d.date),
                        y: yScale(d.close)
                    },
                    {
                        x: xScale(d.date) + (tickWidth + (d.ishot !== undefined ? 30 : 0)),
                        y: yScale(d.close)
                    }
                ]);
            });
           
            open.attr("stroke-opacity", function(d) {
                var t = parseInt(d.volume / 10000) * 100;
                if (t > 90) { t = 90; }
                if (t < 33) { t = 33; }
            
                return t + '%';
            });
            
            close.attr("stroke-opacity", function(d) {
                var t = parseInt(d.volume / 10000) * 100;
                if (t > 90) { t = 90; }
                if (t < 33) { t = 33; }
            
                return t + '%';
            }); 
           
        open.exit().remove();
        close.exit().remove();
        
    };
    var ohlc = function (selection) {
        var series, bars;
        selection.each(function (data) {
            // series = d3.select(this);
            series = d3.select(this).selectAll('.ohlc-series').data([data]);
            series.enter().append('g').classed('ohlc-series', true);
            bars = series.selectAll('.bar')
                .data(data, function (d) {
                    return d.date;
                });
            bars.enter()
                .append('g')
                .classed('bar', true);
            bars.classed({
                'up-day': isUpDay,
                'down-day': isDownDay
            });
            highLowLines(bars);
            openCloseTicks(bars);
            bars.exit().remove();
        });
    };
    ohlc.xScale = function (value) {
        if (!arguments.length) {
            return xScale;
        }
        xScale = value;
        return ohlc;
    };
    ohlc.yScale = function (value) {
        if (!arguments.length) {
            return yScale;
        }
        yScale = value;
        return ohlc;
    };
    ohlc.tickWidth = function (value) {
        if (!arguments.length) {
            return tickWidth;
        }
        tickWidth = value;
        return ohlc;
    };
    return ohlc;
};