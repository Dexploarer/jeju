using Workerd = import "/workerd/workerd.capnp";

const autocratConfig :Workerd.Config = (
  services = [
    (name = "autocrat", worker = .autocratWorker)
  ],
  sockets = [
    (
      name = "http",
      address = "*:8787",
      http = (),
      service = "autocrat"
    )
  ]
);

const autocratWorker :Workerd.Worker = (
  modules = [
    (name = "worker", esModule = embed "autocrat-bundle.js")
  ],
  compatibilityDate = "2024-01-01",
  compatibilityFlags = ["nodejs_compat"],
  bindings = [
    (name = "NETWORK", text = "localnet"),
    (name = "RPC_URL", text = "http://127.0.0.1:6546"),
    (name = "DWS_URL", text = "http://127.0.0.1:4030"),
    (name = "SQLIT_NODES", text = "http://127.0.0.1:4661"),
    (name = "SQLIT_DATABASE_ID", text = "autocrat"),
    (name = "TEE_MODE", text = "simulated"),
    (name = "TEE_PLATFORM", text = "local"),
    (name = "TEE_REGION", text = "local")
  ]
);
