#!/bin/bash

sudo /etc/init.d/varnish stop
sudo cp default.vcl /etc/varnish/default.vcl
sudo cp varnish /etc/default/varnish
sudo /etc/init.d/varnish start

