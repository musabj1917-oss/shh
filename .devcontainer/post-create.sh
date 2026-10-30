#!/usr/bin/env bash
set -e
npm install
npm --prefix apps/api install
npm --prefix apps/mobile install
