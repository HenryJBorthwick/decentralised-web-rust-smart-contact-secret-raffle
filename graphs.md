# Secret Raffle Monorepo Contract Structure Diagram
```mermaid
flowchart TD
    subgraph src["src"]
        direction LR
        contract_rs["contract.rs"]
        lib_rs["lib.rs"]
        msg_rs["msg.rs"]
        state_rs["state.rs"]
        schema_rs["bin/schema.rs"]
    end

    subgraph buildup["Build & Deploy"]
        direction TB
        cargo_toml["Cargo.toml / Cargo.lock"]
        makefile["Makefile"]
        contract_wasm["contract.wasm (.gz)"]
    end

    subgraph schema["schema"]
        direction TB
        init_msg["init_msg.json"]
        handle_msg["handle_msg.json"]
        query_msg["query_msg.json"]
        count_resp["count_response.json"]
        state_json["state.json"]
    end

    subgraph contract["(1) Contract  (Rust)"]
        direction TB
        src
        buildup
        schema
        tests_ts["tests/integration.ts"]
    end

    subgraph live_env["Live Environment"]
        secret_network["Secret Network (Pulsar Testnet)"]
    end

    %% Dependencies / data-flow
    schema_rs -->|imports types| lib_rs
    schema_rs -- generates --> init_msg & handle_msg & query_msg & count_resp & state_json

    lib_rs --> contract_rs
    contract_rs --> msg_rs & state_rs

    cargo_toml -.-> makefile
    makefile --> contract_wasm

    contract_wasm -- example counter tests --> tests_ts
    contract_wasm -- Uploaded to --> secret_network
```

# Secret Raffle Monorepo Uploader Structure Diagram
```mermaid
flowchart TD
  subgraph uploader["(2) Uploader  (Node.js + TypeScript)"]
    direction TB
    upload_ts["src/upload.ts"]
    inst_only_ts["src/instantiate_only.ts"]
    inst_and_test_ts["src/instantiate_and_test.ts"]
    index_ts["src/index.ts"]
    unit_test["test/index.spec.ts"]
    uploader_pkg_json["package.json"]
    uploader_tsconfig["tsconfig.json"]
    uploader_env[".env  (wallet mnemonic)"]
    uploader_contract_file[".contract"]
    secretjs_dep["secretjs"]
    dotenv_dep["dotenv"]
  end

  subgraph live_env["Live Environment"]
    secret_network["Secret Network (Pulsar Testnet)"]
  end

  %% script execution
  uploader_pkg_json --> upload_ts & inst_only_ts & inst_and_test_ts & index_ts
  uploader_pkg_json -- runs tests --> unit_test

  %% dependencies
  upload_ts --> secretjs_dep & dotenv_dep
  inst_only_ts --> secretjs_dep & dotenv_dep
  inst_and_test_ts --> secretjs_dep & dotenv_dep

  %% network interactions
  upload_ts -- Uploads WASM --> secret_network
  inst_only_ts -- Instantiates contract --> secret_network
  inst_and_test_ts -- Instantiates & tests --> secret_network
```
# Secret Raffle Monorepo Frontend Structure Diagram
```mermaid
flowchart TD
  subgraph frontend["(3) Frontend  (React + Vite)"]
    direction TB
    secret_context["SecretJsContext.tsx\n• SecretJsContext\n• SecretJsContextProvider"]
    main_tsx["src/main.tsx"]
    router["BrowserRouter"]
    layout_tsx["components/Layout.tsx"]
    app_tsx["src/App.tsx"]
    home_page["pages/HomePage.tsx"]
    raffle_info["components/RaffleInfo.tsx"]
    admin_panel["components/AdminPanel.tsx"]
    buy_ticket["components/BuyTicket.tsx"]
    claim_prize["components/ClaimPrize.tsx"]
    view_secret["components/ViewSecret.tsx"]
    toast_container["components/shared/ToastContainer.tsx"]
    toast_timer["components/shared/CountdownTimer.tsx"]
    loading_spinner["components/shared/LoadingSpinner.tsx"]
    wallet_btn["components/WalletButton.tsx"]
    use_raffle["hooks/useRaffle.ts"]
    use_toast["hooks/useToast.ts"]
    frontend_env[".env (VITE_* variables)"]
    vite_config["vite.config.ts"]
    tailwind_config["tailwind.config.js"]
    package_json["package.json"]
  end

  subgraph live_env["Live Environment"]
      secret_network["Secret Network (Pulsar Testnet)"]
  end

  main_tsx --> secret_context
  secret_context --> router
  router --> app_tsx
  app_tsx --> layout_tsx
  layout_tsx -->|Route| home_page
  layout_tsx --> toast_container
  layout_tsx --> wallet_btn
  layout_tsx --> use_toast

  home_page --> raffle_info & admin_panel & buy_ticket & claim_prize & view_secret
  home_page --> use_raffle
  home_page --> secret_context

  raffle_info --> use_raffle
  raffle_info --> toast_timer

  admin_panel --> use_raffle
  buy_ticket  --> use_raffle
  claim_prize --> use_raffle
  view_secret --> use_raffle

  wallet_btn --> secret_context

  use_raffle --> secret_context
  use_raffle --> use_toast
  use_raffle --> frontend_env

  secret_context --> frontend_env
  secret_context -- SecretJS --> secret_network
```
# Secret Raffle Monorepo Structure Diagram
```mermaid
flowchart LR
    %% =============== HEADERS ================
    classDef header fill:#eaeaea,stroke:#555,font-weight:bold;

    %% =============== CONTRACT COLUMN ================
    subgraph C["Contract (Rust)"]
        direction TB
        C_src["Source<br>lib.rs · contract.rs · msg.rs · state.rs"]
        C_schema["Schema<br>*.json"]
        C_build["Build / Deploy<br>Cargo.toml · Makefile"]
        C_wasm["optimized-wasm/<br>compiled WASM"]
        C_tests["integration.ts"]

        C_src --> C_build --> C_wasm
        C_wasm -. tested by .-> C_tests
        C_schema --- C_src
    end

    %% =============== UPLOADER COLUMN ================
    subgraph U["Uploader (Node.js + TS)"]
        direction TB
        U_scripts["Scripts<br>upload.ts · instantiate_*.ts · index.ts"]
        U_tests["test/index.spec.ts"]
        U_cfg["Config<br>package.json · tsconfig.json · .env"]
        U_scripts --> U_tests
        U_cfg --- U_scripts
    end

    %% =============== FRONTEND COLUMN ================
    subgraph F["Frontend (React + Vite)"]
        direction TB
        F_entry["Entry<br>main.tsx"]
        F_pages["Pages & Layout<br>App.tsx · Layout.tsx · HomePage.tsx"]
        F_features["Features<br>AdminPanel · BuyTicket · ClaimPrize · ViewSecret"]
        F_shared["Shared<br>Toast · Countdown · Spinner"]
        F_hooks["Hooks & Context<br>useRaffle · useToast · SecretJsContext"]

        F_entry --> F_pages --> F_features --> F_hooks
        F_shared --- F_pages
    end

    %% =============== LIVE NETWORK ================
    secretNet(("Secret Network<br>(Pulsar Testnet)"))

    %% =============== CROSS-WORKSPACE FLOWS ================
    C_wasm -- "upload.ts" --> secretNet
    U_scripts -- "upload / instantiate" --> secretNet
    F_hooks -- "secretjs" --> secretNet

    %% =============== COLUMN LAYOUT HELPERS ================
    C --- U --- F
```