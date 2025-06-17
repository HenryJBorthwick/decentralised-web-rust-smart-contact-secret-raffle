# Uploader scripts for the secret auction example

## Building

`npm install`

`npm run build`

## Uploading the contract to pulsar

Compile the contract in monorepo `contract/` folder: `make build-mainnet-reproducible`

Add `MNEMONIC` to `.env` file.

Run:

`npm run upload`

Record the resulting Code id and Contract hash.

## Instantiating the contract only

`npm run instantiate {Code id} {Contract hash}`

Record the resulting Contract address. This can be used, along with the code hash, in the frontend react application (add to `.env` there).

## Run a full auction test

`npm run test_auction {Code id} {Contract hash}`