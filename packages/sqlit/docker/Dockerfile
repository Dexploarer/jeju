# Stage: runtime
# Use Alpine 3.22 to match golang:1.23-alpine ICU version
FROM alpine:3.22

ARG COMMIT
ARG VERSION

LABEL \
    name="sqlit" \
    homepage="https://github.com/jejunetwork/jeju.git" \
    maintainer="hello@jejunetwork.org" \
    authors="Jeju Network" \
    commit="${COMMIT}" \
    version="${VERSION}"

ENV VERSION=${VERSION}
ENV SQLIT_ROLE=miner
ENV SQLIT_CONF=config.yaml

# Include ICU libs for dynamic linking and other runtime dependencies
RUN apk --no-cache add ca-certificates icu-libs musl libgcc libstdc++ sqlite-libs

WORKDIR /app
COPY --from=sqlit/sqlit-builder:latest /go/src/sqlit/bin/sqlitd /app/
COPY --from=sqlit/sqlit-builder:latest /go/src/sqlit/bin/sqlit-minerd /app/
COPY --from=sqlit/sqlit-builder:latest /go/src/sqlit/bin/sqlit /app/
COPY --from=sqlit/sqlit-builder:latest /go/src/sqlit/bin/sqlit-fuse /app/
COPY --from=sqlit/sqlit-builder:latest /go/src/sqlit/bin/sqlit-mysql-adapter /app/
COPY --from=sqlit/sqlit-builder:latest /go/src/sqlit/bin/sqlit-proxy /app/
COPY docker/docker-entry.sh /app/
RUN chmod +x /app/docker-entry.sh
ENTRYPOINT [ "./docker-entry.sh" ]
EXPOSE 4661
