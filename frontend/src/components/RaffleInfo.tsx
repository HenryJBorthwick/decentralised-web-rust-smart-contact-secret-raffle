import type { FC } from 'react';
import { format } from 'date-fns';
import { useState } from 'react';
import { useRaffle } from '../hooks/useRaffle';
import type { RaffleInfo as RaffleInfoType } from '../types';
import { RaffleStatus } from '../types';
import CountdownTimer from './shared/CountdownTimer';
import LoadingSpinner from './shared/LoadingSpinner';

interface RaffleInfoProps {
  info: RaffleInfoType;
}

const getStatusText = (status: RaffleStatus) => {
    switch (status) {
        case RaffleStatus.NOT_STARTED: return "Not Started";
        case RaffleStatus.IN_PROGRESS: return "In Progress";
        case RaffleStatus.ENDED: return "Ended";
        case RaffleStatus.WINNER_SELECTED: return "Winner Selected";
        case RaffleStatus.PRIZE_CLAIMED: return "Prize Claimed";
        default: return "Unknown";
    }
}

const RaffleInfo: FC<RaffleInfoProps> = ({ info }) => {
  const { myTickets, getMyTickets, loading: hookLoading } = useRaffle();
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsRevealed, setTicketsRevealed] = useState(false);

  const handleCheckTickets = async () => {
    setTicketsLoading(true);
    try {
      await getMyTickets();
      setTicketsRevealed(true);
    } finally {
      setTicketsLoading(false);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 8)}...${addr.substring(addr.length - 6)}`;
  };

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className="text-center pb-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Raffle Information</h2>
        <div className="inline-flex items-center gap-2">
          <span className="text-sm text-gray-600">Status:</span>
          <span className="font-medium text-gray-900">{getStatusText(info.status)}</span>
        </div>
      </div>

      {/* Main Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Ticket Information</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Price per ticket:</span>
                <span className="text-sm font-medium text-gray-900">
                  {info.ticketPrice && info.ticketPrice !== '0' ? `${info.ticketPrice} uSCRT` : 'Not set'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Tickets sold:</span>
                <span className="text-sm font-medium text-gray-900">{info.totalTickets}</span>
              </div>
              {/* My Tickets Section */}
              {!ticketsRevealed ? (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Your tickets:</span>
                  <button
                    onClick={handleCheckTickets}
                    disabled={ticketsLoading || hookLoading}
                    className="text-sm text-primary hover:text-primary/80 disabled:opacity-50 flex items-center gap-1 transition-colors"
                  >
                    {ticketsLoading ? (
                      <>
                        <LoadingSpinner size="sm" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                        Check
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Your tickets:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{myTickets}</span>
                    <button
                      onClick={handleCheckTickets}
                      disabled={ticketsLoading || hookLoading}
                      className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
                      title="Refresh ticket count"
                    >
                      {ticketsLoading ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
            <h3 className="text-sm font-medium text-primary mb-2">Prize Pool</h3>
            <div className="text-2xl font-bold text-primary">
              {info.totalPot} uSCRT
            </div>
            <div className="text-xs text-primary/70 mt-1">
              Total prize amount
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Timing</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-sm text-gray-600">End time:</span>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {info.endTime && !isNaN(info.endTime) 
                      ? format(new Date(info.endTime * 1000), 'PPP p') 
                      : 'Not set'
                    }
                  </div>
                  {info.status === RaffleStatus.IN_PROGRESS && info.endTime && (
                    <div className="text-xs text-gray-500 mt-1">
                      <CountdownTimer endTime={info.endTime} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Winner Information */}
          {info.winner && (
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <h3 className="text-sm font-medium text-green-800 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Winner
              </h3>
              <div className="font-mono text-sm text-green-700 bg-green-100 px-2 py-1 rounded">
                {typeof info.winner === 'string' 
                  ? formatAddress(info.winner)
                  : formatAddress((info.winner as any).address ?? JSON.stringify(info.winner))
                }
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress Indicator */}
      {info.status === RaffleStatus.IN_PROGRESS && (
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-800">Raffle Progress</span>
            <span className="text-xs text-blue-600">Live</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ 
                width: info.totalTickets > 0 ? '100%' : '10%'
              }}
            ></div>
          </div>
          <div className="text-xs text-blue-600 mt-1">
            {info.totalTickets} ticket{info.totalTickets !== 1 ? 's' : ''} sold
          </div>
        </div>
      )}
    </div>
  );
};

export default RaffleInfo; 