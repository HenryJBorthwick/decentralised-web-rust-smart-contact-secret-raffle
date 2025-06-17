import { SecretNetworkClient } from 'secretjs';

export enum RaffleStatus {
  NOT_STARTED,
  IN_PROGRESS,
  ENDED,
  WINNER_SELECTED,
  PRIZE_CLAIMED,
}

export interface RaffleInfo {
  admin: string;
  ticketPrice: string;
  endTime: number;
  totalTickets: number;
  winner?: string;
  secret?: string;
  status: RaffleStatus;
  totalPot: string;
  /** Indicates whether the raffle has been started */
  started: boolean;
  /** True once the contract owner has called select_winner */
  winnerSelected: boolean;
  /** True once the winner has claimed the prize. NOTE: the contract does not expose this directly, so the front-end infers it based on contract balance. */
  prizeClaimed?: boolean;
}

export interface SecretJsContextType {
  secretJs: SecretNetworkClient | null;
  address: string;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  isAdmin: boolean;
} 