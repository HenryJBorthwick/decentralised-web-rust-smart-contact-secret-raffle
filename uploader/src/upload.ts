import { SecretNetworkClient, Wallet } from "secretjs";
import * as dotenv from "dotenv";
import * as fs from "fs";

dotenv.config();  // Load environment variables from .env file 
const mnemonic = process.env.MNEMONIC;  // Retrieve the mnemonic
console.log(mnemonic);
const wallet = new Wallet(mnemonic);

// create a new client for the Pulsar testnet
const secretjs = new SecretNetworkClient({
  chainId: "pulsar-3",
  url: "https://pulsar.lcd.secretnodes.com",
  wallet: wallet,
  walletAddress: wallet.address,
});


const uploadContract = async (contract_wasm: Buffer): Promise<{code_id: string, code_hash?: string}> => {
    console.log(contract_wasm);
    let tx = await secretjs.tx.compute.storeCode(
        {
            sender: wallet.address,
            wasm_byte_code: contract_wasm,
            source: "",
            builder: "",
        },
        {
            gasLimit: 1_500_000,
        }
    );

    //@ts-ignore
    const codeId = tx.arrayLog!.find((log) => log.type === "message" && log.key === "code_id").value;
  
    console.log("Code Id: ", codeId);
  
    const contractCodeHash = (
        await secretjs.query.compute.codeHashByCodeId({ code_id: codeId })
    ).code_hash;
    console.log(`Contract hash: ${contractCodeHash}`);
    return {
        code_id: codeId,
        code_hash: contractCodeHash,
    };
};

export const main = async (): Promise<void> => {
    await uploadContract(fs.readFileSync("../contract/optimized-wasm/secret_contract_example.wasm.gz"));
}

main()
