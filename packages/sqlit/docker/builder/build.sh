#!/bin/bash

docker build -t sqlit/release-builder:latest . && \
docker push sqlit/release-builder
