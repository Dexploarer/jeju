
package metric

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

const historyCount = 2

const updateInterval = 5 * time.Minute

// sqlitStatsMetrics provide description, value, and value type for SQLIT stat metrics.
type sqlitStatsMetrics []struct {
	desc    *prometheus.Desc
	eval    func(*SqlitCollector) float64
	valType prometheus.ValueType
}

// SqlitCollector collects SQLIT metrics.
type SqlitCollector struct {
	sqlitStatHistory [historyCount]int64
	sync.RWMutex

	// metrics to describe and collect
	metrics sqlitStatsMetrics

	// context for graceful shutdown
	ctx    context.Context
	cancel context.CancelFunc
}

func sqlitStatNamespace(s string) string {
	return fmt.Sprintf("sqlitstats_%s", s)
}

// NewSqlitCollector returns a new SqlitCollector.
func NewSqlitCollector() prometheus.Collector {
	ctx, cancel := context.WithCancel(context.Background())
	cc := &SqlitCollector{
		sqlitStatHistory: [historyCount]int64{},
		RWMutex:                sync.RWMutex{},
		ctx:                    ctx,
		cancel:                 cancel,
		metrics: sqlitStatsMetrics{
			{
				desc: prometheus.NewDesc(
					sqlitStatNamespace("db_random"),
					"SQLIT random",
					nil,
					nil,
				),
				eval:    SqlitIdle,
				valType: prometheus.GaugeValue,
			},
		},
	}

	go cc.runUpdateLoop()
	return cc
}

func (cc *SqlitCollector) runUpdateLoop() {
	ticker := time.NewTicker(updateInterval)
	defer ticker.Stop()

	for {
		select {
		case <-cc.ctx.Done():
			return
		case <-ticker.C:
			cc.updateSqlitStat()
		}
	}
}

// Describe returns all descriptions of the collector.
func (cc *SqlitCollector) Describe(ch chan<- *prometheus.Desc) {
	for _, i := range cc.metrics {
		ch <- i.desc
	}
}

// Collect returns the current state of all metrics of the collector.
func (cc *SqlitCollector) Collect(ch chan<- prometheus.Metric) {
	if !cc.SqlitPrepared() {
		return
	}

	for _, i := range cc.metrics {
		ch <- prometheus.MustNewConstMetric(i.desc, i.valType, i.eval(cc))
	}
}

// updateSqlitStat updates metric in background.
func (cc *SqlitCollector) updateSqlitStat() error {
	cc.Lock()
	defer cc.Unlock()
	for i := historyCount - 1; i > 0; i-- {
		cc.sqlitStatHistory[i] = cc.sqlitStatHistory[i-1]
	}

	cc.sqlitStatHistory[0] = time.Now().UnixNano()
	return nil
}

// SqlitIdle gets the idle of DB.
func SqlitIdle(cc *SqlitCollector) float64 {
	cc.RLock()
	defer cc.RUnlock()
	//TODO(auxten): implement SQLIT Idle metric
	return float64(cc.sqlitStatHistory[0] - cc.sqlitStatHistory[1])
}

// SqlitPrepared returns true when the metric is ready to be collected.
func (cc *SqlitCollector) SqlitPrepared() bool {
	cc.RLock()
	defer cc.RUnlock()
	return cc.sqlitStatHistory[1] != 0
}

// Stop gracefully stops the collector's update loop.
func (cc *SqlitCollector) Stop() {
	if cc.cancel != nil {
		cc.cancel()
	}
}
