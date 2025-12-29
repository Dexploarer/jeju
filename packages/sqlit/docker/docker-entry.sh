#!/bin/sh

# echo nameserver 114.114.114.114 > /etc/resolv.conf

[ -s "${SQLIT_ALERT}" ] && [ -x "${SQLIT_ALERT}" ] && (eval "${SQLIT_ALERT}")

case "${SQLIT_ROLE}" in
miner)
    exec /app/sqlit-minerd -config "${SQLIT_CONF}" -metric-web "${METRIC_WEB_ADDR}" "${@}"
    ;;
blockproducer)
    exec /app/sqlitd -config "${SQLIT_CONF}" -metric-web "${METRIC_WEB_ADDR}" "${@}"
    ;;
explorer)
    exec /app/sqlit explorer -config "${SQLIT_CONF}" "${@}" "${SQLIT_OBSERVER_ADDR}"
    ;;
adapter)
    exec /app/sqlit adapter -config "${SQLIT_CONF}" "${@}" "${SQLIT_ADAPTER_ADDR}"
    ;;
mysql-adapter)
    exec /app/sqlit-mysql-adapter -config "${SQLIT_CONF}" "${@}"
    ;;
cli)
    exec /app/sqlit console -config ${SQLIT_CONF} "${@}"
    ;;
faucet)
    exec /app/sqlit-faucet -config ${SQLIT_CONF} "${@}"
    ;;
esac

