import { useEffect, useContext, useState } from 'react';
import { useRaffle } from '../hooks/useRaffle.ts';
import { SecretJsContext } from '../context/SecretJsContext.tsx';
import LoadingSpinner from '../components/shared/LoadingSpinner.tsx';
import RaffleInfo from '../components/RaffleInfo.tsx';
import AdminPanel from '../components/AdminPanel.tsx';
import BuyTicket from '../components/BuyTicket.tsx';
import ClaimPrize from '../components/ClaimPrize.tsx';
import ViewSecret from '../components/ViewSecret.tsx';
import { RaffleStatus } from '../types/index.ts';
// Import other components like AdminPanel, BuyTicket when they are created

const HomePage = () => {
  const { raffleInfo, myTickets, loading, error, getRaffleInfo } = useRaffle();
  const { address, isAdmin } = useContext(SecretJsContext)!;
  // Global loading flag driven by events from useRaffle across the app
  const [globalLoading, setGlobalLoading] = useState(false);
  /** True while the raffle has finished counting down on the client but the on-chain
   *  status has not yet updated from IN_PROGRESS to ENDED. This gives users a
   *  visual cue that we are waiting for the blockchain to acknowledge the raffle
   *  end before the admin can select a winner. */
  const [waitingForEnd, setWaitingForEnd] = useState(false);

  useEffect(() => {
    if (address) {
      getRaffleInfo();
    }
  }, [address, getRaffleInfo]);

  // Auto-refresh raffle info every 10 seconds when active
  useEffect(() => {
    if (!address || !raffleInfo) return;
    
    const shouldPoll = raffleInfo.status === RaffleStatus.IN_PROGRESS || 
                      raffleInfo.status === RaffleStatus.ENDED;
    
    if (shouldPoll) {
      const interval = setInterval(() => {
        getRaffleInfo();
      }, 10000);
      
      return () => clearInterval(interval);
    }
  }, [address, raffleInfo, getRaffleInfo]);

  /**
   * Show a temporary overlay once the local timer reaches 0 seconds but the
   * contract status is still IN_PROGRESS. The overlay disappears as soon as we
   * detect that the status has changed to ENDED (or any other state).
   */
  useEffect(() => {
    if (!raffleInfo) {
      setWaitingForEnd(false);
      return;
    }

    if (raffleInfo.status !== RaffleStatus.IN_PROGRESS) {
      // Raffle already ended or not started – ensure flag is cleared
      setWaitingForEnd(false);
      return;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const diffSec = raffleInfo.endTime - nowSec;

    // If timer already elapsed, immediately show waiting overlay
    if (diffSec <= 0) {
      setWaitingForEnd(true);
    }

    // Otherwise schedule the overlay to show exactly when the timer finishes
    const id = setTimeout(() => setWaitingForEnd(true), Math.max(0, diffSec * 1000));
    return () => clearTimeout(id);
  }, [raffleInfo]);

  // Listen for loading events to show a global "Waiting for blockchain" indicator
  useEffect(() => {
    const handleLoading = (e: Event) => {
      // CustomEvent is expected – but add type guard just in case
      const ce = e as CustomEvent<boolean>;
      if (typeof ce.detail === 'boolean') {
        setGlobalLoading(ce.detail);
      }
    };

    const handleUpdate = () => {
      // Immediately refresh raffle info when another part of the app signals a state change
      getRaffleInfo();
    };

    window.addEventListener('raffle-loading', handleLoading);
    window.addEventListener('raffle-updated', handleUpdate);

    return () => {
      window.removeEventListener('raffle-loading', handleLoading);
      window.removeEventListener('raffle-updated', handleUpdate);
    };
  }, [getRaffleInfo]);

  const getStatusBadge = () => {
    if (!raffleInfo) return null;
    
    const statusConfig = {
      [RaffleStatus.NOT_STARTED]: { text: 'Not Started', color: 'bg-gray-100 text-gray-800' },
      [RaffleStatus.IN_PROGRESS]: { text: 'Live', color: 'bg-green-100 text-green-800' },
      [RaffleStatus.ENDED]: { text: 'Ended', color: 'bg-yellow-100 text-yellow-800' },
      [RaffleStatus.WINNER_SELECTED]: { text: 'Winner Selected', color: 'bg-blue-100 text-blue-800' },
      [RaffleStatus.PRIZE_CLAIMED]: { text: 'Completed', color: 'bg-purple-100 text-purple-800' },
    };
    
    const config = statusConfig[raffleInfo.status];
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
        <span className="w-2 h-2 bg-current rounded-full mr-2 animate-pulse"></span>
        {config.text}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Global overlay shown while waiting for blockchain confirmation OR for on-chain raffle end */}
      {(globalLoading || waitingForEnd) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg px-6 py-4 flex items-center gap-3">
            <LoadingSpinner size="md" />
            <span className="text-gray-800 font-medium">
              {globalLoading
                ? 'Waiting for blockchain confirmation...'
                : 'Waiting for blockchain to register raffle end...'}
            </span>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Secret Raffle</h1>
        <div className="flex justify-center items-center gap-4">
          {getStatusBadge()}
          {(globalLoading || waitingForEnd) && <LoadingSpinner size="sm" />}
        </div>
      </div>

      {/* Main Content */}
      <div className="card max-w-4xl mx-auto">
        {/* Connection Status */}
        {!address && (
          <div className="text-center py-8">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Connect Your Wallet</h3>
            <p className="text-gray-600">Please connect your wallet to view and participate in the raffle.</p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="alert-error" role="alert">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Raffle Content */}
        {address && raffleInfo && (
          <div className="space-y-6">
            <RaffleInfo info={raffleInfo} />
            
            {/* Admin Panel */}
            {isAdmin && <AdminPanel />}
            
            {/* User Actions */}
            {!isAdmin && (
              <div className="space-y-4">
                {raffleInfo.status === RaffleStatus.IN_PROGRESS && <BuyTicket />}
                
                {/* Winner interaction: claim prize */}
                {raffleInfo.status === RaffleStatus.WINNER_SELECTED && 
                 address === raffleInfo.winner && (
                  <div className="alert-success mb-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-green-800">🎉 Congratulations!</h3>
                        <div className="mt-2 text-sm text-green-700">You won the raffle! Claim your prize and reveal the secret.</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Non-winner interaction: had tickets but didn't win */}
                {(raffleInfo.status === RaffleStatus.WINNER_SELECTED || raffleInfo.status === RaffleStatus.PRIZE_CLAIMED) &&
                 raffleInfo.winner && 
                 address !== raffleInfo.winner && 
                 myTickets > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-4">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-amber-400 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <h3 className="text-sm font-medium text-amber-800">Better Luck Next Time</h3>
                        <div className="text-sm text-amber-700">
                          <p>Unfortunately, you didn't win this raffle.</p>
                          <p className="mt-1">You had <span className="font-medium">{myTickets}</span> ticket{myTickets !== 1 ? 's' : ''} - thanks for participating! 🎫</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* No tickets case: raffle ended but user never participated */}
                {(raffleInfo.status === RaffleStatus.WINNER_SELECTED || raffleInfo.status === RaffleStatus.PRIZE_CLAIMED) &&
                 raffleInfo.winner && 
                 address !== raffleInfo.winner && 
                 myTickets === 0 && (
                  <div className="bg-gray-50 border border-gray-200 rounded p-4">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-gray-400 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <h3 className="text-sm font-medium text-gray-800">Raffle Completed</h3>
                        <p className="text-sm text-gray-600">A winner has been selected. Join the next raffle to participate!</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Raffle has ended but winner not yet selected */}
                {raffleInfo.status === RaffleStatus.ENDED && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-4">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-blue-400 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <h3 className="text-sm font-medium text-blue-800">Raffle Ended</h3>
                        <p className="text-sm text-blue-700">Waiting for the raffle admin to select a winner...</p>
                      </div>
                    </div>
                  </div>
                )}

                {(raffleInfo.status === RaffleStatus.WINNER_SELECTED || raffleInfo.status === RaffleStatus.PRIZE_CLAIMED) &&
                 address === raffleInfo.winner && <ClaimPrize />}

                {/* Winner may still want to view secret component; show for both statuses */}
                {(raffleInfo.status === RaffleStatus.WINNER_SELECTED || raffleInfo.status === RaffleStatus.PRIZE_CLAIMED) && address === raffleInfo.winner && <ViewSecret />}
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading && !raffleInfo && address && (
          <div className="text-center py-8">
            <LoadingSpinner />
            <p className="mt-4 text-gray-600">Loading raffle information...</p>
          </div>
        )}
      </div>

      {/* Live Status Indicator */}
      {raffleInfo && raffleInfo.status === RaffleStatus.IN_PROGRESS && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-full shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Raffle Live</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage; 