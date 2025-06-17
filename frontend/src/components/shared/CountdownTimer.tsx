import { useEffect, useState } from 'react';
import { formatDistanceStrict } from 'date-fns';

interface CountdownTimerProps {
  /** UNIX timestamp in seconds */
  endTime: number;
}

/**
 * Displays a live countdown (e.g. "1m 23s") until `endTime`.
 * If time has elapsed it shows "0s".
 */
const CountdownTimer = ({ endTime }: CountdownTimerProps) => {
  const [now, setNow] = useState<number>(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  if (!endTime) return null;

  const diff = Math.max(0, endTime - now);

  const ms = diff * 1000;
  const pretty = diff === 0 ? '0s' : formatDistanceStrict(0, ms, { unit: 'second' });

  return <span>{pretty}</span>;
};

export default CountdownTimer; 