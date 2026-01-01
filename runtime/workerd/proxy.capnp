using Workerd = import "/workerd/workerd.capnp";

const proxyConfig :Workerd.Config = (
  services = [
    (name = "dws-proxy", worker = .proxyWorker),
    (name = "internet", network = (allow = ["public", "private", "local"]))
  ],
  sockets = [
    (
      name = "http",
      address = "*:8787",
      http = (),
      service = "dws-proxy"
    )
  ]
);

const proxyWorker :Workerd.Worker = (
  modules = [
    (name = "worker", esModule = embed "workers/proxy.js")
  ],
  compatibilityDate = "2024-01-01",
  bindings = [
    (name = "TARGET_URL", text = "http://127.0.0.1:4030")
  ],
  globalOutbound = "internet"
);
