#!/bin/bash

# Check if transmission rpc is running
# It check 5 times before giving up waiting 2 seconds
# in between.

echo "Checking transmission RPC"
OUTPUT=1
retries="5"

while [ $retries -gt 0 -a $OUTPUT -ne 0 ]
do
    echo "Trying to reach transmission rpc"
    transmission-remote -i > /dev/null 2>&1
    OUTPUT=$?
    if [ $OUTPUT -ne 0 ]
    then
        echo "Transmission not responding. Retrying..."
        sleep 2
    fi
    retries=$[$retries-1]
done

if [ $OUTPUT -eq 0 ]
then
    echo "Transmission responded succesfully"
    exit 0
else
    echo "Transmission not responding"
    exit 127
fi
