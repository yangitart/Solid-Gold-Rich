import React from 'react';
import { AppState } from 'react-native';

// Refresh date-based views at local midnight and after returning from the background.
export function useCurrentDate(refreshKey?: unknown) {
  const [date, setDate] = React.useState(() => new Date());
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      const now = new Date();
      setDate(now);
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(refresh, midnight.getTime() - now.getTime() + 100);
    };
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [refreshKey]);
  return date;
}
