#!/bin/bash

docker build -t sqlit/build:latest . && \
docker push sqlit/build
