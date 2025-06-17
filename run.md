# contract
make build-mainnet-reproducible

# uploader
npm install

npm run build

npm run upload (upload contract)

Copy the code id and contract hash, paste contract hash into frontend/.env VITE_CONTRACT_CODE_HASH

npm run test_raffle {Code id} {Contract hash} (test uploaded and instantiated contract)

npm run instantiate {Code id} {Contract hash} (instantiate contract)

Copy the contract address, paste contract address into frontend/.env VITE_CONTRACT_ADDR

# frontend 
npm install

npm run build

npm run dev