# Secret Raffle dApp

**Author:** Henry J. Borthwick  

---

## 1  Overview
Secret Raffle is a proof of concept decentralised application built for the Cosmos ecosystem using CosmWasm smart contracts and Secret Network privacy features. It allows an **admin** to create a time boxed raffle, sell on-chain tickets for uSCRT, and randomly select a winner who can claim the accumulated pot alongside a _secret phrase_ that only the winner can view (via permit authenticated query).

---

## 2 Repository Structure
```text
secret-raffle-monorepo/
├── contract/    # CosmWasm Rust contract
├── uploader/    # Node scripts to compile, upload, instantiate the contract & test the contract
├── frontend/    # React + Tailwind +Vite dApp for users to interact with the raffle
└── docs/        # White-paper, diagrams
README.md        # this file
```

---

## 3 Getting Started
### 3.1 Prerequisites
* Rust
* Node
* Docker  
* Keplr browser wallet

### 3.2 Clone & Install
```bash
# clone the repo
$ git clone <repo-url>
$ cd secret-raffle-monorepo
```
### 3.3 Build the Contract
```bash
# enter the contract workspace
$ cd contract

# produce a reproducible main-net WASM (uses Docker – works on Apple Silicon)
$ make build-mainnet-reproducible
```

### 3.4 Upload & Instantiate (local or test-net)
```bash
# back to repo root (secret-raffle-monorepo)
$ cd uploader
$ cp .env.example .env           # then add MNEMONIC="... 24 words ..."

# install, build, & run the upload helper
$ npm install
$ npm run build
$ npm run upload                 # returns CODE_ID & CODE_HASH

# optionally test contract on the test-net
$ npm run test_raffle <CODE_ID> <CODE_HASH>

# instantiate the contract on the test-net
$ npm run instantiate <CODE_ID> <CODE_HASH>         # returns CONTRACT_ADDRESS

# Copy the CODE_HASH and CONTRACT_ADDRESS, will need to paste into frontend/.env (do this later)
```

### 3.5 Run the Frontend
```bash
# back to repo root (secret-raffle-monorepo)
$ cd ../frontend
$ cp .env.example .env   # add VITE_CONTRACT_ADDRESS & VITE_CODE_HASH & VITE_ADMIN_ADDR

# VITE_CONTRACT_ADDR=secret1... (From Uploader instantiate function)
# VITE_CONTRACT_CODE_HASH=CODE_HASH_HERE (From Uploader upload function)
# VITE_ADMIN_ADDR="YOUR_WALLET_ADDRESS" (your Keplr wallet address from browser)

$ npm install
$ npm run build
$ npm run dev
```

---

## 4 Frontend Getting Started Workflow

Entire Frontend Workflow is show in diagram in the /docs whitepaper.

1. Start the frontend (npm run dev)
2. Wallet connects via Keplr / SecretJS.  
3. If keplr wallet address matches VITE_ADMIN_ADDR, then admin panel is shown, can configure and start the raffle.
4. Disconnect wallet and switch to another wallet in Keplr.
5. If keplr wallet address does not match VITE_ADMIN_ADDR, then user panel is shown, can buy tickets if the raffle has been started.
6. Click _Buy Ticket_, sign a `MsgExecuteContract` with payment. 
7. Frontend polls contract for updated totals & countdown timer as raffle progresses.
8. Once raffle ends, switch to admin wallet and press _Select Winner_, winner is displayed.
9. Switch back to wallet that won.
10. Winner sees _Claim Prize_ button & can reveal the secret phrase.
11. Winner claims prize and reveals the secret phrase.
12. Restart raffle by uploading and instantiating a new contract, pasting into frontend/.env VITE_CONTRACT_ADDR and VITE_CONTRACT_CODE_HASH.

---