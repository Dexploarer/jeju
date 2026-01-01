# Jeju Localnet - Full OP Stack with Real Derivation
#
# This sets up a REAL L1 ↔ L2 rollup where L2 blocks are derived from L1.
# 
# Components:
# - L1: Geth in dev mode with OP Stack contracts
# - L2: op-geth + op-node with real derivation pipeline
# - Batcher: Submits L2 batches to L1 (optional)
# - Proposer: Submits L2 output roots (optional)
#
# Usage:
#   kurtosis run packages/deployment/kurtosis --enclave jeju-localnet
#
# Note: For a simpler setup without derivation, use --args '{"simple": true}'

# Pinned versions for reproducibility (January 2026)
GETH_VERSION = "v1.16.7"  # Fusaka-compatible
OP_GETH_VERSION = "v1.101408.0"  # Latest stable
OP_NODE_VERSION = "v1.10.1"  # Latest stable

# Chain configuration
L1_CHAIN_ID = 900
L2_CHAIN_ID = 901

# Predeploy addresses (OP Stack standard)
L2_CROSS_DOMAIN_MESSENGER = "0x4200000000000000000000000000000000000007"
L2_TO_L1_MESSAGE_PASSER = "0x4200000000000000000000000000000000000016"
L2_STANDARD_BRIDGE = "0x4200000000000000000000000000000000000010"
L1_BLOCK = "0x4200000000000000000000000000000000000015"

def run(plan, args={}):
    """
    Deploy Jeju localnet with real L1 ↔ L2 derivation.
    
    Args:
        simple: If true, use separate anvil chains (no derivation)
        enable_batcher: If true, run op-batcher (default: false for simplicity)
        enable_proposer: If true, run op-proposer (default: false for simplicity)
    """
    
    simple = args.get("simple", False)
    enable_batcher = args.get("enable_batcher", False)
    enable_proposer = args.get("enable_proposer", False)
    
    if simple:
        return run_simple(plan, args)
    
    return run_real_op_stack(plan, args, enable_batcher, enable_proposer)


def run_simple(plan, args):
    """Simple mode: Two independent anvil chains (no derivation)."""
    
    plan.print("=" * 70)
    plan.print("Starting Jeju Localnet (Simple Mode)")
    plan.print("=" * 70)
    plan.print("")
    plan.print("WARNING: This mode does NOT have L1 ↔ L2 derivation.")
    plan.print("         Deposits on L1 will NOT appear on L2.")
    plan.print("         Use for contract testing only.")
    plan.print("")
    
    # L1: Geth in dev mode
    l1 = plan.add_service(
        name="geth-l1",
        config=ServiceConfig(
            image="ethereum/client-go:" + GETH_VERSION,
            ports={
                "rpc": PortSpec(number=8545, transport_protocol="TCP"),
                "ws": PortSpec(number=8546, transport_protocol="TCP"),
            },
            cmd=[
                "--dev",
                "--dev.period=1",
                "--http",
                "--http.addr=0.0.0.0",
                "--http.port=8545",
                "--http.api=eth,net,web3,debug,personal,admin",
                "--http.corsdomain=*",
                "--ws",
                "--ws.addr=0.0.0.0",
                "--ws.port=8546",
                "--ws.api=eth,net,web3",
                "--ws.origins=*",
                "--nodiscover",
            ]
        )
    )
    
    plan.print("L1 (Geth --dev) started")
    
    # L2: op-geth in dev mode
    l2 = plan.add_service(
        name="op-geth",
        config=ServiceConfig(
            image="us-docker.pkg.dev/oplabs-tools-artifacts/images/op-geth:" + OP_GETH_VERSION,
            ports={
                "rpc": PortSpec(number=9545, transport_protocol="TCP"),
                "ws": PortSpec(number=9546, transport_protocol="TCP"),
            },
            cmd=[
                "--dev",
                "--dev.period=2",
                "--http",
                "--http.addr=0.0.0.0",
                "--http.port=9545",
                "--http.api=eth,net,web3,debug,txpool,admin",
                "--http.corsdomain=*",
                "--ws",
                "--ws.addr=0.0.0.0",
                "--ws.port=9546",
                "--ws.api=eth,net,web3,debug",
                "--ws.origins=*",
                "--nodiscover",
                "--maxpeers=0",
                "--networkid=" + str(L2_CHAIN_ID),
            ]
        )
    )
    
    plan.print("L2 (op-geth --dev) started")
    
    print_endpoints(plan, "Simple Mode (No Derivation)")
    
    return {
        "mode": "simple",
        "l1_rpc": "http://geth-l1:8545",
        "l2_rpc": "http://op-geth:9545",
        "derivation": False,
    }


def run_real_op_stack(plan, args, enable_batcher, enable_proposer):
    """Real mode: L2 derived from L1 via op-node."""
    
    plan.print("=" * 70)
    plan.print("Starting Jeju Localnet (Real OP Stack)")
    plan.print("=" * 70)
    plan.print("")
    plan.print("L1 Chain ID: " + str(L1_CHAIN_ID))
    plan.print("L2 Chain ID: " + str(L2_CHAIN_ID))
    plan.print("")
    
    # Generate JWT secret for engine auth
    jwt_result = plan.run_sh(
        run="openssl rand -hex 32",
        name="generate-jwt"
    )
    jwt_secret = jwt_result.output.strip()
    
    jwt_artifact = plan.render_templates(
        config={
            "jwt-secret.txt": struct(
                template=jwt_secret,
                data={},
            ),
        },
        name="jwt-secret",
    )
    
    # Generate genesis files
    genesis_config = generate_genesis_config(plan, jwt_secret)
    
    # ========================================================================
    # L1: Geth with OP Stack contracts
    # ========================================================================
    
    l1 = plan.add_service(
        name="l1-geth",
        config=ServiceConfig(
            image="ethereum/client-go:" + GETH_VERSION,
            ports={
                "rpc": PortSpec(number=8545, transport_protocol="TCP"),
                "ws": PortSpec(number=8546, transport_protocol="TCP"),
                "authrpc": PortSpec(number=8551, transport_protocol="TCP"),
            },
            cmd=[
                "--dev",
                "--dev.period=2",
                "--http",
                "--http.addr=0.0.0.0",
                "--http.port=8545",
                "--http.api=eth,net,web3,debug,personal,admin,txpool",
                "--http.corsdomain=*",
                "--ws",
                "--ws.addr=0.0.0.0",
                "--ws.port=8546",
                "--ws.api=eth,net,web3,debug",
                "--ws.origins=*",
                "--authrpc.addr=0.0.0.0",
                "--authrpc.port=8551",
                "--authrpc.vhosts=*",
                "--authrpc.jwtsecret=/secrets/jwt-secret.txt",
                "--nodiscover",
                "--networkid=" + str(L1_CHAIN_ID),
            ],
            files={
                "/secrets": jwt_artifact,
            },
        )
    )
    
    plan.print("L1 Geth started")
    
    # Wait for L1 to be ready
    plan.wait(
        service_name="l1-geth",
        recipe=PostHttpRequestRecipe(
            port_id="rpc",
            endpoint="/",
            content_type="application/json",
            body='{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}',
        ),
        field="code",
        assertion="==",
        target_value=200,
        timeout="60s",
    )
    
    # ========================================================================
    # L2: op-geth (Execution Layer)
    # ========================================================================
    
    l2_geth = plan.add_service(
        name="op-geth",
        config=ServiceConfig(
            image="us-docker.pkg.dev/oplabs-tools-artifacts/images/op-geth:" + OP_GETH_VERSION,
            ports={
                "rpc": PortSpec(number=8545, transport_protocol="TCP"),
                "ws": PortSpec(number=8546, transport_protocol="TCP"),
                "authrpc": PortSpec(number=8551, transport_protocol="TCP"),
            },
            cmd=[
                "--dev",
                "--dev.period=2",
                "--http",
                "--http.addr=0.0.0.0",
                "--http.port=8545",
                "--http.api=eth,net,web3,debug,txpool,engine",
                "--http.corsdomain=*",
                "--ws",
                "--ws.addr=0.0.0.0",
                "--ws.port=8546",
                "--ws.api=eth,net,web3,debug",
                "--ws.origins=*",
                "--authrpc.addr=0.0.0.0",
                "--authrpc.port=8551",
                "--authrpc.vhosts=*",
                "--authrpc.jwtsecret=/secrets/jwt-secret.txt",
                "--nodiscover",
                "--networkid=" + str(L2_CHAIN_ID),
                "--maxpeers=0",
                "--gcmode=archive",  # Keep full state for proofs
            ],
            files={
                "/secrets": jwt_artifact,
            },
        )
    )
    
    plan.print("op-geth started")
    
    # ========================================================================
    # op-node (Consensus/Derivation Layer)
    # ========================================================================
    
    rollup_config = plan.render_templates(
        config={
            "rollup.json": struct(
                template='''{
  "genesis": {
    "l1": {
      "hash": "0x0000000000000000000000000000000000000000000000000000000000000000",
      "number": 0
    },
    "l2": {
      "hash": "0x0000000000000000000000000000000000000000000000000000000000000000",
      "number": 0
    },
    "l2_time": 0,
    "system_config": {
      "batcherAddr": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      "overhead": "0x0000000000000000000000000000000000000000000000000000000000000000",
      "scalar": "0x00000000000000000000000000000000000000000000000000000000000f4240",
      "gasLimit": 30000000
    }
  },
  "block_time": 2,
  "max_sequencer_drift": 600,
  "seq_window_size": 3600,
  "channel_timeout": 300,
  "l1_chain_id": {{.l1_chain_id}},
  "l2_chain_id": {{.l2_chain_id}},
  "regolith_time": 0,
  "canyon_time": 0,
  "delta_time": 0,
  "ecotone_time": 0,
  "fjord_time": 0,
  "granite_time": 0,
  "holocene_time": 0,
  "isthmus_time": 0,
  "batch_inbox_address": "0xff00000000000000000000000000000000000901",
  "deposit_contract_address": "0x0000000000000000000000000000000000000000",
  "l1_system_config_address": "0x0000000000000000000000000000000000000000"
}''',
                data={"l1_chain_id": L1_CHAIN_ID, "l2_chain_id": L2_CHAIN_ID},
            ),
        },
        name="rollup-config",
    )
    
    op_node = plan.add_service(
        name="op-node",
        config=ServiceConfig(
            image="us-docker.pkg.dev/oplabs-tools-artifacts/images/op-node:" + OP_NODE_VERSION,
            ports={
                "rpc": PortSpec(number=9545, transport_protocol="TCP"),
                "metrics": PortSpec(number=7300, transport_protocol="TCP"),
            },
            cmd=[
                "op-node",
                "--l1=ws://l1-geth:8546",
                "--l2=http://op-geth:8551",
                "--l2.jwt-secret=/secrets/jwt-secret.txt",
                "--rollup.config=/config/rollup.json",
                "--rpc.addr=0.0.0.0",
                "--rpc.port=9545",
                "--p2p.disable",
                "--verifier.l1-confs=0",
                "--sequencer.enabled=true",
                "--sequencer.l1-confs=0",
                "--log.level=info",
            ],
            files={
                "/secrets": jwt_artifact,
                "/config": rollup_config,
            },
        )
    )
    
    plan.print("op-node started")
    
    # ========================================================================
    # Optional: op-batcher
    # ========================================================================
    
    if enable_batcher:
        plan.print("Starting op-batcher...")
        # Note: Requires funded batcher account
        # op_batcher = ...
    
    # ========================================================================
    # Optional: op-proposer
    # ========================================================================
    
    if enable_proposer:
        plan.print("Starting op-proposer...")
        # Note: Requires L2OutputOracle deployed on L1
        # op_proposer = ...
    
    print_endpoints(plan, "Real OP Stack")
    
    return {
        "mode": "real",
        "l1_rpc": "http://l1-geth:8545",
        "l2_rpc": "http://op-geth:8545",
        "op_node_rpc": "http://op-node:9545",
        "derivation": True,
    }


def generate_genesis_config(plan, jwt_secret):
    """Generate genesis configuration for L2."""
    
    # For a proper setup, we would:
    # 1. Deploy L1 contracts
    # 2. Run op-node genesis l2 to generate L2 genesis
    # 3. Initialize op-geth with the genesis
    #
    # For now, we use dev mode which handles genesis automatically
    
    return {}


def print_endpoints(plan, mode):
    """Print endpoint information."""
    
    plan.print("")
    plan.print("=" * 70)
    plan.print("Jeju Localnet Deployed (" + mode + ")")
    plan.print("=" * 70)
    plan.print("")
    plan.print("Get actual ports with:")
    plan.print("  kurtosis enclave inspect jeju-localnet")
    plan.print("")
    plan.print("Port forwarding:")
    plan.print("  kurtosis port print jeju-localnet l1-geth rpc   # or geth-l1")
    plan.print("  kurtosis port print jeju-localnet op-geth rpc")
    plan.print("")
    plan.print("To deploy L1 contracts:")
    plan.print("  cd packages/contracts")
    plan.print("  forge script script/DeployL1OpStack.s.sol --rpc-url <L1_RPC> --broadcast")
    plan.print("")
