#!/bin/sh

if [ ! -d in ] ; then exit; fi
if [ ! -d out ]; then mkdir out; fi

for i in in/*; do
    name=`basename "$i"`
    echo $name
    venv/bin/python3 packer.py "$i" "out/$name.epub"
done
