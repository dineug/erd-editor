#!/bin/sh

git submodule init
git submodule update

cd submodules/r-html

git sparse-checkout set --no-cone '!/*/' 'packages/' '/tsconfig.json'

cd ../go

git sparse-checkout set --no-cone '!/*/' 'packages/' '/tsconfig.json'
