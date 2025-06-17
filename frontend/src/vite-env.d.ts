/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SECRET_CHAIN_ID: string;
    readonly VITE_SECRET_LCD: string;
    readonly VITE_CONTRACT_CODE_HASH: string;
    readonly VITE_CONTRACT_ADDR: string;
    readonly VITE_ADMIN_ADDR: string;
}
  
interface ImportMeta {
    readonly env: ImportMetaEnv;
}