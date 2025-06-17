import { useState, useContext, useCallback } from 'react';
import { SecretJsContext } from '../context/SecretJsContext';
import type { RaffleInfo } from '../types';
import { RaffleStatus } from '../types';
import { fromUtf8 } from 'secretjs';
import { useToast } from './useToast';

const CONTRACT_ADDR = import.meta.env.VITE_CONTRACT_ADDR;
const CONTRACT_CODE_HASH = import.meta.env.VITE_CONTRACT_CODE_HASH;

// NOTE: When generating a Secret Network query permit with Keplr, the final
// boolean flag (`isKeplr`) **must be set to `true`.**  If this is accidentally
// changed back to `false`, the contract will reject the query with
// "Failed to verify signatures for the given permit".  Keep this here as a
// reminder to avoid regressions.

/**
 * NOTE ON CUSTOM EVENTS
 * ----------------------
 * This hook is the single source of truth for contract interactions.  Whenever
 * a transaction is submitted we emit two browser-wide custom events so that
 * UI components in completely separate trees can stay in sync without
 * prop-drilling or global state libraries:
 *   • `raffle-loading`  – dispatched with `{ detail: boolean }` before/after a
 *     tx to toggle a global "Waiting for blockchain" overlay.
 *   • `raffle-updated` – fired once a tx is confirmed so listeners can
 *     immediately refetch on-chain state instead of waiting for the next poll.
 * If you refactor or rename these make sure to update all listeners (e.g.
 * HomePage.tsx) otherwise the UI will silently break.
 */

export const useRaffle = () => {
  const context = useContext(SecretJsContext);
  const { showSuccess, showError, showInfo } = useToast();
  const [raffleInfo, setRaffleInfo] = useState<RaffleInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myTickets, setMyTickets] = useState<number>(0);

  // ---------------------------------------------------------------------------
  // Helper: fetch the number of tickets owned by the connected wallet
  // ---------------------------------------------------------------------------
  const getMyTickets = useCallback(async () => {
    if (!context?.secretJs || !context.address) return;
    try {
      const permit = await context.secretJs.utils.accessControl.permit.sign(
        context.address,
        import.meta.env.VITE_SECRET_CHAIN_ID,
        'raffle-permit',
        [CONTRACT_ADDR],
        ['owner'],
        true,
      );

      const resp: any = await context.secretJs.query.compute.queryContract({
        contract_address: CONTRACT_ADDR,
        code_hash: CONTRACT_CODE_HASH,
        query: {
          with_permit: {
            permit,
            query: { get_tickets: {} },
          },
        },
      });

      const ticketsVal = resp.get_tickets?.tickets ?? resp.tickets ?? 0;
      const numTickets = typeof ticketsVal === 'string' ? parseInt(ticketsVal) : Number(ticketsVal);
      setMyTickets(numTickets);
    } catch (_) {
      // Silent fail – keep previous value
    }
  }, [context?.secretJs, context?.address]);

  // ---------------------------------------------------------------------------
  // Public-facing query – returns overall raffle info. When called with
  // `silent=true` it will NOT touch the global `loading` / `error` flags so that
  // background polls don't flicker the UI.
  // ---------------------------------------------------------------------------
  const getRaffleInfo = useCallback(async (silent: boolean = false) => {
    if (!context?.secretJs) return;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const query = { raffle_info: {} };
      const resultRaw: any = await context.secretJs.query.compute.queryContract({
        contract_address: CONTRACT_ADDR,
        code_hash: CONTRACT_CODE_HASH,
        query,
      });

      // Handle enum wrapper vs raw object
      const res = resultRaw.raffle_info ?? resultRaw;

      const currentTime = Math.floor(Date.now() / 1000);

      // Helper to convert optional values
      const ticketPrice = res.ticket_price ? res.ticket_price.toString() : '0';
      const endTime = res.end_time ? Number(res.end_time) : 0;
      const totalTickets = res.total_tickets ? Number(res.total_tickets) : 0;

      const computeStatus = (): RaffleStatus => {
        if (!res.started) return RaffleStatus.NOT_STARTED;
        if (res.started && currentTime < endTime) return RaffleStatus.IN_PROGRESS;
        if (currentTime >= endTime && !res.winner_selected) return RaffleStatus.ENDED;
        if (res.winner_selected && !res.prize_claimed) return RaffleStatus.WINNER_SELECTED;
        if (res.prize_claimed) return RaffleStatus.PRIZE_CLAIMED;
        return RaffleStatus.ENDED; // fallback safety
      };

      const status = computeStatus();

      const mapped: RaffleInfo = {
        admin: res.admin ?? '',
        ticketPrice,
        endTime,
        totalTickets,
        winner: res.winner ?? undefined,
        status,
        totalPot: (BigInt(ticketPrice) * BigInt(totalTickets)).toString(),
        started: res.started ?? false,
        winnerSelected: res.winner_selected ?? false,
        prizeClaimed: res.prize_claimed ?? false,
      };

      setRaffleInfo(mapped);
    } catch (e: any) {
      if (!silent) {
        const errorMsg = e.message || 'Failed to query raffle info.';
        setError(errorMsg);
        showError(errorMsg);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [context?.secretJs, showError]);

  const setRaffle = async (ticketPrice: string, endTime: string | number, secret: string) => {
    if (!context?.secretJs || !context.address) return;
    window.dispatchEvent(new CustomEvent('raffle-loading', { detail: true }));
    setLoading(true);
    setError(null);
    try {
      showInfo('Configuring raffle...');
      const msg = { set_raffle: { ticket_price: ticketPrice, end_time: endTime.toString(), secret } };
      const tx = await context.secretJs.tx.compute.executeContract(
        {
          sender: context.address,
          contract_address: CONTRACT_ADDR,
          code_hash: CONTRACT_CODE_HASH,
          msg,
        },
        { gasLimit: 200_000 }
      );
      
      if (tx.code === 0) {
        showSuccess('Raffle configured successfully!');
        await getRaffleInfo();
        // Notify the rest of the app that the raffle state has just changed
        window.dispatchEvent(new Event('raffle-updated'));
      } else {
        const errMsg = tx.rawLog || `Transaction failed (code ${tx.code})`;
        throw new Error(errMsg);
      }
    } catch (e: any) {
      const errorMsg = (e && e.message) ? e.message : 'Failed to set raffle.';
      setError(errorMsg);
      showError(errorMsg);
    } finally {
      window.dispatchEvent(new CustomEvent('raffle-loading', { detail: false }));
      setLoading(false);
    }
  };
  
  // ------------------ Additional contract interactions ------------------

  const startRaffle = async () => {
    if (!context?.secretJs || !context.address) return;
    window.dispatchEvent(new CustomEvent('raffle-loading', { detail: true }));
    setLoading(true);
    setError(null);
    try {
      showInfo('Starting raffle...');
      const tx = await context.secretJs.tx.compute.executeContract(
        {
          sender: context.address,
          contract_address: CONTRACT_ADDR,
          code_hash: CONTRACT_CODE_HASH,
          msg: { start_raffle: {} },
        },
        { gasLimit: 150_000 },
      );
      
      if (tx.code === 0) {
        showSuccess('Raffle started! Ticket sales are now open.');
        await getRaffleInfo();
        window.dispatchEvent(new Event('raffle-updated'));
      } else {
        throw new Error(tx.rawLog || 'Transaction failed');
      }
    } catch (e: any) {
      const errorMsg = e.message || 'Failed to start raffle.';
      setError(errorMsg);
      showError(errorMsg);
    } finally {
      window.dispatchEvent(new CustomEvent('raffle-loading', { detail: false }));
      setLoading(false);
    }
  };

  const selectWinner = async () => {
    if (!context?.secretJs || !context.address) return;
    if (raffleInfo && raffleInfo.totalTickets === 0) {
      const msg = 'Cannot select a winner because no tickets were sold.';
      setError(msg);
      showError(msg);
      return;
    }
    window.dispatchEvent(new CustomEvent('raffle-loading', { detail: true }));
    setLoading(true);
    setError(null);
    try {
      showInfo('Selecting winner...');
      const tx = await context.secretJs.tx.compute.executeContract(
        {
          sender: context.address,
          contract_address: CONTRACT_ADDR,
          code_hash: CONTRACT_CODE_HASH,
          msg: { select_winner: {} },
        },
        { gasLimit: 200_000 },
      );
      
      if (tx.code === 0) {
        showSuccess('Winner selected successfully!');
        await getRaffleInfo();
        window.dispatchEvent(new Event('raffle-updated'));
      } else {
        throw new Error(tx.rawLog || 'Transaction failed');
      }
    } catch (e: any) {
      const errorMsg = e.message || 'Failed to select winner.';
      setError(errorMsg);
      showError(errorMsg);
    } finally {
      window.dispatchEvent(new CustomEvent('raffle-loading', { detail: false }));
      setLoading(false);
    }
  };

  const buyTicket = async (numTickets: number) => {
    if (!context?.secretJs || !context.address || !raffleInfo) return;
    window.dispatchEvent(new CustomEvent('raffle-loading', { detail: true }));
    setLoading(true);
    setError(null);
    try {
      const amount = (BigInt(numTickets) * BigInt(raffleInfo.ticketPrice)).toString();
      showInfo(`Purchasing ${numTickets} ticket${numTickets !== 1 ? 's' : ''}...`);
      
      const tx = await context.secretJs.tx.compute.executeContract(
        {
          sender: context.address,
          contract_address: CONTRACT_ADDR,
          code_hash: CONTRACT_CODE_HASH,
          msg: { buy_ticket: {} },
          sent_funds: [{ denom: 'uscrt', amount }],
        },
        { gasLimit: 200_000 },
      );
      
      if (tx.code === 0) {
        showSuccess(`Successfully purchased ${numTickets} ticket${numTickets !== 1 ? 's' : ''}!`);
        await getRaffleInfo();
        window.dispatchEvent(new Event('raffle-updated'));
      } else {
        throw new Error(tx.rawLog || 'Transaction failed');
      }
    } catch (e: any) {
      const errorMsg = e.message || 'Failed to buy ticket(s).';
      setError(errorMsg);
      showError(errorMsg);
    } finally {
      window.dispatchEvent(new CustomEvent('raffle-loading', { detail: false }));
      setLoading(false);
    }
  };

  const claimPrize = async () => {
    if (!context?.secretJs || !context.address) return;
    window.dispatchEvent(new CustomEvent('raffle-loading', { detail: true }));
    setLoading(true);
    setError(null);
    try {
      showInfo('Claiming prize...');
      const tx = await context.secretJs.tx.compute.executeContract(
        {
          sender: context.address,
          contract_address: CONTRACT_ADDR,
          code_hash: CONTRACT_CODE_HASH,
          msg: { claim_prize: {} },
        },
        { gasLimit: 200_000 },
      );
      
      if (tx.code === 0) {
        showSuccess(`🎉 Prize claimed successfully! You received ${raffleInfo?.totalPot ?? ''} uSCRT!`);
        await getRaffleInfo();
        window.dispatchEvent(new Event('raffle-updated'));
      } else {
        throw new Error(tx.rawLog || 'Transaction failed');
      }
    } catch (e: any) {
      const errorMsg = e.message || 'Failed to claim prize.';
      setError(errorMsg);
      showError(errorMsg);
    } finally {
      window.dispatchEvent(new CustomEvent('raffle-loading', { detail: false }));
      setLoading(false);
    }
  };

  const getSecret = async (): Promise<string | null> => {
    if (!context?.secretJs || !context.address) return null;
    window.dispatchEvent(new CustomEvent('raffle-loading', { detail: true }));
    setLoading(true);
    setError(null);
    try {
      showInfo('Revealing secret...');
      const permit = await context.secretJs.utils.accessControl.permit.sign(
        context.address,
        import.meta.env.VITE_SECRET_CHAIN_ID,
        'raffle-permit',
        [CONTRACT_ADDR],
        ['owner'],
        true,
      );

      const resp: any = await context.secretJs.query.compute.queryContract({
        contract_address: CONTRACT_ADDR,
        code_hash: CONTRACT_CODE_HASH,
        query: {
          with_permit: {
            permit,
            query: { get_secret: {} },
          },
        },
      });

      const rawSecret = resp.get_secret?.secret ?? resp.secret ?? null;

      let secretString: string | null = null;

      if (rawSecret == null) {
        secretString = null;
      } else if (typeof rawSecret === 'string') {
        // The contract may return either plain-text *or* base64 depending on how
        // the secret was stored.  To avoid leaking unreadable gibberish we do a
        // quick heuristic: if the string *looks* like base64 we attempt to
        // decode, otherwise we treat it as regular UTF-8.  Keep this logic when
        // touching the contract response shape.
        // Only attempt base64 decoding if the string *looks* like base64. Otherwise treat it as plain-text.
        const maybeBase64 = rawSecret.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(rawSecret);
        if (maybeBase64) {
          try {
            const bytes = Uint8Array.from(atob(rawSecret), (c) => c.charCodeAt(0));
            secretString = new TextDecoder().decode(bytes);
          } catch {
            // Fallback to the original string if decoding fails
            secretString = rawSecret;
          }
        } else {
          // Definitely not base64 – return as-is
          secretString = rawSecret;
        }
      } else if (rawSecret instanceof Uint8Array) {
        secretString = fromUtf8(rawSecret);
      } else {
        // Fallback: stringify unknown formats so the user sees _something_ rather than an error.
        secretString = JSON.stringify(rawSecret);
      }
      
      if (secretString) {
        showSuccess('Secret revealed successfully!');
      }
      
      return secretString;
    } catch (e: any) {
      const errorMsg = e.message || 'Failed to fetch secret.';
      setError(errorMsg);
      showError(errorMsg);
      return null;
    } finally {
      window.dispatchEvent(new CustomEvent('raffle-loading', { detail: false }));
      setLoading(false);
    }
  };
  
  return {
    raffleInfo,
    myTickets,
    loading,
    error,
    getRaffleInfo,
    getMyTickets,
    setRaffle,
    startRaffle,
    selectWinner,
    buyTicket,
    claimPrize,
    getSecret,
  };
}; 