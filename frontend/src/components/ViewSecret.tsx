import { useState } from 'react';
import { useRaffle } from '../hooks/useRaffle';
import LoadingSpinner from './shared/LoadingSpinner';

const ViewSecret = () => {
  const { getSecret, loading, error } = useRaffle();
  const [secret, setSecret] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);

  const handleClick = async () => {
    const sec = await getSecret();
    if (sec) {
      setSecret(sec);
      setIsRevealed(true);
    }
  };

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
      <div className="flex items-center mb-4">
        <svg className="w-5 h-5 text-purple-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
        </svg>
        <h3 className="text-lg font-semibold text-purple-900">Secret Reveal</h3>
      </div>
      
      {!isRevealed ? (
        <div className="space-y-4">
          <p className="text-purple-800">
            As the winner, you have access to the secret phrase. Click below to reveal it.
          </p>
          
          <button 
            className="btn-primary flex items-center justify-center w-full sm:w-auto"
            disabled={loading} 
            onClick={handleClick}
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Revealing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
                Reveal Secret
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white border border-purple-300 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <svg className="w-4 h-4 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-green-800">Secret Revealed</span>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded p-3">
              <div className="font-mono text-lg font-semibold text-gray-900 break-all">
                {secret}
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <div className="flex items-start">
              <svg className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Keep this safe!</p>
                <p className="text-xs">This secret phrase was set by the raffle administrator and is now yours as the winner.</p>
              </div>
            </div>
          </div>
        </div>
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
              <h3 className="text-sm font-medium text-red-800">Reveal Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewSecret; 