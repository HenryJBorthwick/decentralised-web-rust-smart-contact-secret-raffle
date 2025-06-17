import { useState, useEffect } from 'react';
import { useRaffle } from '../hooks/useRaffle';
import LoadingSpinner from './shared/LoadingSpinner';

const BuyTicket = () => {
  const { raffleInfo, buyTicket, loading, error, getRaffleInfo } = useRaffle();

  // Use string for easier validation of empty input / leading zeros etc.
  const [quantity, setQuantity] = useState('1');
  const [quantityError, setQuantityError] = useState<string | null>(null);

  // Ensure we have raffle info (this component may mount before the parent hook finished fetching)
  useEffect(() => {
    if (!raffleInfo) {
      getRaffleInfo();
    }
  }, [raffleInfo, getRaffleInfo]);

  const validateQuantity = (val: string): string | null => {
    if (!val) return 'Enter how many tickets you want to buy.';
    if (!/^[0-9]+$/.test(val)) return 'Quantity must be a number.';
    const num = Number(val);
    if (num < 1) return 'You must buy at least 1 ticket.';
    if (num > 100) return 'You can buy at most 100 tickets per transaction.';
    return null;
  };

  if (!raffleInfo) return null;

  const handlePurchase = () => {
    const errorMsg = validateQuantity(quantity);
    setQuantityError(errorMsg);
    if (errorMsg) return;
    buyTicket(Number(quantity));
  };

  const quantityNum = Number(quantity) || 0;
  const totalCost = raffleInfo.ticketPrice
    ? (BigInt(raffleInfo.ticketPrice) * BigInt(quantityNum)).toString()
    : '0';

  const formatCost = (cost: string) => {
    // Format large numbers with commas
    return parseInt(cost).toLocaleString();
  };

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
      <div className="flex items-center mb-4">
        <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
        </svg>
        <h3 className="text-lg font-semibold text-green-900">Buy Tickets</h3>
      </div>
      
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
              Number of Tickets
            </label>
            <input
              id="quantity"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className={`input w-full ${quantityError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              value={quantity}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, '');
                setQuantity(raw);
                setQuantityError(validateQuantity(raw));
              }}
              placeholder="1"
            />
            {quantityError && <p className="text-red-600 text-sm mt-1">{quantityError}</p>}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Cost
            </label>
            <div className="bg-gray-50 border border-gray-300 rounded px-3 py-2 text-sm font-medium text-gray-900">
              {formatCost(totalCost)} uSCRT
            </div>
          </div>
          
          <button 
            className="btn-primary flex items-center justify-center"
            disabled={loading || !!quantityError || !quantity} 
            onClick={handlePurchase}
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Purchasing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                </svg>
                Buy {quantity} Ticket{quantity !== '1' ? 's' : ''}
              </>
            )}
          </button>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <div className="flex items-start">
            <svg className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">How it works:</p>
              <ul className="text-xs space-y-1">
                <li>• Each ticket gives you a chance to win the entire prize pool</li>
                <li>• More tickets = higher chance of winning</li>
                <li>• Winner is selected randomly when the raffle ends</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="alert-error mt-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Purchase Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyTicket; 