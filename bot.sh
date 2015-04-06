#!/bin/bash
while :
do
	( cmdpid=$BASHPID; (sleep 5h; kill $cmdpid) & exec /usr/bin/node /home/ubuntu/botter/bot.js )
done
