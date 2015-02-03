#!/bin/bash
while :
do
	( cmdpid=$BASHPID; (sleep 1h; kill $cmdpid) & exec /usr/bin/node /home/ubuntu/trader/bot.js )
done