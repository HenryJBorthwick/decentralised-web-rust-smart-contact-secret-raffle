import { useEffect, useState } from 'react';
import { useRaffle } from '../hooks/useRaffle';
import { RaffleStatus } from '../types';
import LoadingSpinner from './shared/LoadingSpinner';

const AdminPanel = () => {
  const {
    raffleInfo,
    setRaffle,
    startRaffle,
    selectWinner,
    loading,
    error,
    getRaffleInfo,
  } = useRaffle();

  const [secret, setSecret] = useState('');
  const [ticketPrice, setTicketPrice] = useState('');
  const [endTime, setEndTime] = useState(''); // HTML datetime-local string

  // ---------------- Validation state ----------------
  const [secretError, setSecretError] = useState<string | null>(null);
  const [ticketPriceError, setTicketPriceError] = useState<string | null>(null);
  const [endTimeError, setEndTimeError] = useState<string | null>(null);

  // Validation helpers
  const validateSecret = (val: string): string | null => {
    if (!val.trim()) return 'Secret is required.';
    if (val.trim().length < 4) return 'Secret must be at least 4 characters.';
    return null;
  };

  const validateTicketPrice = (val: string): string | null => {
    if (!val) return 'Ticket price is required.';
    if (!/^[0-9]+$/.test(val)) return 'Ticket price must be a whole number.';
    try {
      const n = BigInt(val);
      if (n <= 0n) return 'Ticket price must be greater than zero.';
    } catch (_) {
      return 'Invalid number.';
    }
    return null;
  };

  const validateEndTime = (val: string): string | null => {
    if (!val) return 'End time is required.';
    const date = new Date(val);
    if (isNaN(date.getTime())) return 'Invalid date.';
    if (date.getTime() <= Date.now()) return 'End time must be in the future.';
    return null;
  };

  // Derived overall validity flag
  const isFormValid = !secretError && !ticketPriceError && !endTimeError && secret && ticketPrice && endTime;

  // Helper to get current blockchain time (approximation)
  const getCurrentTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  // Ensure this hook instance also has raffleInfo populated
  useEffect(() => {
    if (!raffleInfo) {
      getRaffleInfo();
    }
  }, [raffleInfo, getRaffleInfo]);

  // ---------------------------------------------------------------------------
  // Auto-refresh raffle info while the raffle is active / awaiting winner
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!raffleInfo) return;

    // Poll only while tickets are being sold or after they have finished but
    // the winner has not yet been selected. Once a winner is chosen (or the
    // prize claimed) we can stop polling to avoid unnecessary queries.
    const shouldPoll =
      raffleInfo.status === RaffleStatus.IN_PROGRESS ||
      raffleInfo.status === RaffleStatus.ENDED;

    if (!shouldPoll) return;

    const interval = setInterval(() => {
      getRaffleInfo(true); // silent refresh to avoid UI flicker
    }, 10000); // every 10 s (same cadence as HomePage)

    return () => clearInterval(interval);
  }, [raffleInfo, getRaffleInfo]);

  // Set default end time to 1 hour from now
  useEffect(() => {
    if (!endTime) {
      const defaultTime = new Date();
      defaultTime.setHours(defaultTime.getHours() + 1);
      defaultTime.setMinutes(defaultTime.getMinutes() - defaultTime.getTimezoneOffset());
      const defaultVal = defaultTime.toISOString().slice(0, 16);
      setEndTime(defaultVal);
      setEndTimeError(validateEndTime(defaultVal));
    }
  }, [endTime]);

  if (!raffleInfo) return null;

  const status = raffleInfo.status;

  // ---------------- UI render per stage ----------------
  if (!raffleInfo.started && raffleInfo.ticketPrice === '0') {
    // Raffle not yet configured => allow setRaffle
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <h3 className="text-lg font-semibold text-blue-900">Configure Raffle</h3>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="secret" className="block text-sm font-medium text-gray-700 mb-1">
                Secret Phrase
              </label>
              <input
                id="secret"
                type="text"
                className={`input w-full ${secretError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                value={secret}
                onChange={(e) => {
                  const val = e.target.value;
                  setSecret(val);
                  setSecretError(validateSecret(val));
                }}
                placeholder="Enter the secret phrase for winners"
              />
              {secretError && <p className="text-red-600 text-sm mt-1">{secretError}</p>}
            </div>
            
            <div>
              <label htmlFor="ticketPrice" className="block text-sm font-medium text-gray-700 mb-1">
                Ticket Price (uSCRT)
              </label>
              <input
                id="ticketPrice"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className={`input w-full ${ticketPriceError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                value={ticketPrice}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setTicketPrice(val);
                  setTicketPriceError(validateTicketPrice(val));
                }}
                placeholder="100000"
              />
              {ticketPriceError && <p className="text-red-600 text-sm mt-1">{ticketPriceError}</p>}
            </div>
          </div>
          
          <div>
            <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-1">
              End Time
            </label>
            <input
              id="endTime"
              type="datetime-local"
              className={`input w-full md:w-auto ${endTimeError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              value={endTime}
              onChange={(e) => {
                const val = e.target.value;
                setEndTime(val);
                setEndTimeError(validateEndTime(val));
              }}
              min={getCurrentTime()}
            />
            {endTimeError && <p className="text-red-600 text-sm mt-1">{endTimeError}</p>}
            <p className="text-xs text-gray-500 mt-1">
              Set when ticket sales should end
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              className="btn-primary flex items-center justify-center"
              disabled={loading || !isFormValid}
              onClick={() => {
                const unix = Math.floor(new Date(endTime).getTime() / 1000);
                setRaffle(ticketPrice, unix, secret);
              }}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Configuring...
                </>
              ) : (
                'Configure Raffle'
              )}
            </button>
            
            <div className="text-sm text-gray-600 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              This will set up the raffle parameters
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
                <h3 className="text-sm font-medium text-red-800">Configuration Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (status === RaffleStatus.NOT_STARTED) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
            </svg>
            <h3 className="text-lg font-semibold text-yellow-900">Ready to Start</h3>
          </div>
          <span className="badge-warning">Configured</span>
        </div>
        
        <p className="text-yellow-800 mb-4">
          The raffle has been configured and is ready to start. Click the button below to open ticket sales.
        </p>
        
        <button 
          className="btn-primary flex items-center justify-center"
          disabled={loading} 
          onClick={startRaffle}
        >
          {loading ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Starting...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              Start Raffle
            </>
          )}
        </button>
        
        {error && (
          <div className="alert-error mt-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Start Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (status === RaffleStatus.ENDED) {
    return (
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-purple-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <h3 className="text-lg font-semibold text-purple-900">Select Winner</h3>
          </div>
          <span className="badge-warning">Ended</span>
        </div>
        
        <p className="text-purple-800 mb-4">
          The raffle has ended. Click below to randomly select the winner from all ticket holders.
        </p>
        
        <button 
          className="btn-primary flex items-center justify-center"
          disabled={loading || raffleInfo.totalTickets === 0} 
          onClick={selectWinner}
          title={raffleInfo.totalTickets === 0 ? 'Cannot select winner — no tickets sold.' : ''}
        >
          {loading ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Selecting Winner...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Select Winner
            </>
          )}
        </button>
        
        {raffleInfo.totalTickets === 0 && (
          <p className="text-xs text-gray-500 mt-2">No tickets were sold for this raffle.</p>
        )}

        {error && (
          <div className="alert-error mt-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Selection Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default AdminPanel; 