import { useContext } from 'react';
import { SecretJsContext } from '../context/SecretJsContext';

const WalletButton = () => {
  const context = useContext(SecretJsContext);

  if (!context) {
    return null; // or a loading indicator
  }

  const { address, connectWallet, disconnectWallet, isAdmin } = context;

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 10)}...${addr.substring(addr.length - 4)}`;
  };

  return address ? (
    <div className="flex items-center gap-3">
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
        isAdmin 
          ? 'bg-blue-100 text-blue-800 border border-blue-200' 
          : 'bg-green-100 text-green-800 border border-green-200'
      }`}>
        {isAdmin ? '👑 Admin' : '✓ Connected'}: {formatAddress(address)}
      </span>
      <button 
        className="btn-secondary text-sm"
        onClick={disconnectWallet}
        aria-label="Disconnect wallet"
      >
        Disconnect
      </button>
    </div>
  ) : (
    <button 
      className="btn-primary"
      onClick={connectWallet}
      aria-label="Connect wallet"
    >
      Connect Wallet
    </button>
  );
};

export default WalletButton; 