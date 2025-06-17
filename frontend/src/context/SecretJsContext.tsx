import {
  createContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import type { ReactNode, FC } from 'react';
import { SecretNetworkClient } from 'secretjs';
import type { SecretJsContextType } from '../types';

const SECRET_CHAIN_ID = import.meta.env.VITE_SECRET_CHAIN_ID;
const SECRET_LCD = import.meta.env.VITE_SECRET_LCD;
const ADMIN_ADDR = import.meta.env.VITE_ADMIN_ADDR;

declare global {
  interface Window {
    keplr?: any;
    getEnigmaUtils?: (chainId: string) => any;
    getOfflineSignerOnlyAmino?: (chainId: string) => any;
  }
}

export const SecretJsContext = createContext<SecretJsContextType | null>(null);

interface SecretJsContextProviderProps {
  children: ReactNode;
}

export const SecretJsContextProvider: FC<SecretJsContextProviderProps> = ({ children }) => {
  const [secretJs, setSecretJs] = useState<SecretNetworkClient | null>(null);
  const [address, setAddress] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  const setupKeplr = useCallback(async () => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    // Keep retrying until the Keplr extension injects the required helpers –
    // this is crucial during page reloads where React may mount before Keplr
    // finishes initialising.
    while (
      !window.keplr ||
      !window.getEnigmaUtils ||
      !window.getOfflineSignerOnlyAmino
    ) {
      await sleep(50);
    }

    await window.keplr.enable(SECRET_CHAIN_ID);
    window.keplr.defaultOptions = {
      sign: { preferNoSetFee: false, disableBalanceCheck: true },
    };

    // We intentionally disable Keplr's balance check to avoid "insufficient
    // funds" client-side errors when the wallet holds enough SCRT but *uSCRT*
    // (gas denom) may look low.  The contract itself still enforces fees.
    const keplrOfflineSigner = window.getOfflineSignerOnlyAmino(SECRET_CHAIN_ID);
    const accounts = await keplrOfflineSigner.getAccounts();
    const userAddress = accounts[0].address;

    const client = new SecretNetworkClient({
      url: SECRET_LCD,
      chainId: SECRET_CHAIN_ID,
      wallet: keplrOfflineSigner,
      walletAddress: userAddress,
      encryptionUtils: window.getEnigmaUtils(SECRET_CHAIN_ID),
    });

    const adminFlag = userAddress === ADMIN_ADDR;
    setAddress(userAddress);
    setSecretJs(client);
    setIsAdmin(adminFlag);
    // Persist auto-connect preference so the app can silently reconnect on reloads.
    localStorage.setItem('keplrAutoConnect', 'true');
  }, []);

  const connectWallet = useCallback(async () => {
    if (!window.keplr) {
      alert('Please install Keplr wallet extension.');
      return;
    }
    try {
      await setupKeplr();
    } catch (error) {
      console.error('Error connecting to Keplr:', error);
      alert('Failed to connect to wallet. See console for details.');
    }
  }, [setupKeplr]);

  const disconnectWallet = () => {
    setAddress('');
    setSecretJs(null);
    setIsAdmin(false);
    // Clear auto-connect flag – prevents unwanted automatic reconnection after explicit logout.
    localStorage.setItem('keplrAutoConnect', 'false');
  };

  useEffect(() => {
    const autoConnect = localStorage.getItem('keplrAutoConnect') === 'true';
    if (autoConnect) {
      connectWallet();
    }
  }, [connectWallet]);

  return (
    <SecretJsContext.Provider
      value={{ secretJs, address, connectWallet, disconnectWallet, isAdmin }}
    >
      {children}
    </SecretJsContext.Provider>
  );
}; 