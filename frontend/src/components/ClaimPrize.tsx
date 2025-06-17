import { useRaffle } from '../hooks/useRaffle';
import LoadingSpinner from './shared/LoadingSpinner';

const ClaimPrize = () => {
  const { claimPrize, loading, error, raffleInfo } = useRaffle();

  const prizeClaimed = raffleInfo?.prizeClaimed;
  const totalPot = raffleInfo?.totalPot ?? '0';

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
      <div className="flex items-center mb-4">
        <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <h3 className="text-lg font-semibold text-yellow-900">Claim Your Prize</h3>
      </div>
      
      {prizeClaimed ? (
        <>
          <p className="text-yellow-800 mb-4">
            Prize claimed! 🎉 You received {totalPot} uSCRT.
          </p>
          <button
            className="btn-primary flex items-center justify-center w-full sm:w-auto opacity-50 cursor-not-allowed"
            disabled
          >
            Claimed
          </button>
        </>
      ) : (
        <>
          <p className="text-yellow-800 mb-4">
            Congratulations! You've won the raffle. Click below to claim your prize and receive all the funds from the prize pool.
          </p>
          <button 
            className="btn-primary flex items-center justify-center w-full sm:w-auto"
            disabled={loading} 
            onClick={claimPrize}
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Claiming Prize...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" />
                </svg>
                Claim Prize
              </>
            )}
          </button>
        </>
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
              <h3 className="text-sm font-medium text-red-800">Claim Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClaimPrize; 