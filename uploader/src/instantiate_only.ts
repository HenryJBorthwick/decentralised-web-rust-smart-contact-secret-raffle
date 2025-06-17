import { SecretNetworkClient, Wallet, } from "secretjs";
import * as dotenv from "dotenv";

dotenv.config();  // Load environment variables from .env file 
const mnemonic = process.env.MNEMONIC;  // Retrieve the mnemonic

const wallet = new Wallet(mnemonic);
const CHAIN_ID = "pulsar-3";
const DENOM = "uscrt";

// create a new client for the Pulsar testnet
const admin = new SecretNetworkClient({
  chainId: CHAIN_ID,
  url: "https://pulsar.lcd.secretnodes.com",
  wallet,
  walletAddress: wallet.address,
});

const instantiateContract = async (codeId: string, contractCodeHash: string): Promise<string> => {
    //instantiate message is empty in this example. If your contract needs to be instantiated with additional variables, be sure to include them.
    
    const initMsg = {};
    let tx = await admin.tx.compute.instantiateContract(
        {
            code_id: codeId,
            sender: wallet.address,
            code_hash: contractCodeHash,
            init_msg: initMsg,
            label: "test contract" + Math.ceil(Math.random() * 10000000),
        },
        {
            gasLimit: 400_000,
        }
    );
    
    //Find the contract_address in the logs
    //@ts-ignore
    const contractAddress = tx.arrayLog!.find((log) => log.type === "message" && log.key === "contract_address").value;
    
    return contractAddress;
};

type AuctionInfoResult = {
    started: boolean,
    minimum_bid?: string,
    end_time?: string,
};

export const main = async (): Promise<void> => {
    if (process.argv.length !== 4) {
        console.error('Expected two arguments!');
        process.exit(1);
    }

    let code_id = process.argv[2];
    let code_hash = process.argv[3];

    const contract_address = await instantiateContract(code_id, code_hash);
    
    console.log("Contract address: ", contract_address);
}

main()
