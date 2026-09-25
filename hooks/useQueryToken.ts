import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { QueryTokenState } from '../types.internal';

/**
 * Reads a one-time token from the `token` query parameter, then removes it from the address bar so it does not
 * linger in browser history or in URLs read later by analytics and error reporting. The token stays in state.
 */
export function useQueryToken(): QueryTokenState {
  const router = useRouter();
  const [state, setState] = useState<QueryTokenState>({ status: 'loading' });

  useEffect(() => {
    if (!router.isReady || state.status !== 'loading') return;

    const { token, ...otherParams } = router.query;
    if (typeof token !== 'string' || !token) {
      setState({ status: 'missing' });
      return;
    }

    setState({ status: 'present', token });
    router.replace({ pathname: router.pathname, query: otherParams }, undefined, { shallow: true });
  }, [router, state.status]);

  return state;
}
