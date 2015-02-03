/*jslint node: true */
/*jslint continue: true */
/*jslint nomen: true */
/*jslint plusplus: true */
'use strict';

var redis = require('redis');
var publisher  = redis.createClient();

module.exports = {
    publish: function (channel, message, expires) {
        // publisher.get(channel, function (error, result) {
            
        publisher.set(channel, message, function () {
            if (expires !== undefined) {
                publisher.expire(channel, expires / 1000);
            }

            // if (result !== message) {
            publisher.publish(channel, '');
            // }
        });

        // });
    }
};