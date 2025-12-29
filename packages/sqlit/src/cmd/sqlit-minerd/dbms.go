
package main

import (
	"github.com/pkg/errors"

	"sqlit/src/conf"
	"sqlit/src/rpc"
	"sqlit/src/rpc/mux"
	"sqlit/src/worker"
)

func startDBMS(server *mux.Server, direct *rpc.Server, onCreateDB func()) (dbms *worker.DBMS, err error) {
	if conf.GConf.Miner == nil {
		err = errors.New("invalid database config")
		return
	}

	cfg := &worker.DBMSConfig{
		RootDir:          conf.GConf.Miner.RootDir,
		Server:           server,
		DirectServer:     direct,
		MaxReqTimeGap:    conf.GConf.Miner.MaxReqTimeGap,
		OnCreateDatabase: onCreateDB,
	}

	if dbms, err = worker.NewDBMS(cfg); err != nil {
		err = errors.Wrap(err, "create new DBMS failed")
		return
	}

	if err = dbms.Init(); err != nil {
		err = errors.Wrap(err, "init DBMS failed")
		return
	}

	return
}
