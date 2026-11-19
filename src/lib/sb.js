/* The Supabase client, cut down to what Synergym uses: signing in (auth-js) and the database (postgrest-js).
   The full supabase-js also bundles realtime, storage and edge functions, which the app never calls; leaving them
   out takes about a fifth off the app's code. The two parts are put together as supabase-js does it (same storage
   key, so a phone that's signed in stays signed in; same headers; the signed-in user's token on every database
   request, or the public key when signed out), and the client offers the same three things the app uses:
   auth, from() and rpc(). */
import { AuthClient } from '@supabase/auth-js';
import { PostgrestClient } from '@supabase/postgrest-js';

export function makeClient(url, key, auth = {}) {
  const base = new URL(url.endsWith('/') ? url : url + '/');
  const headers = { 'X-Client-Info': 'synergym' };
  const client = new AuthClient({
    url: new URL('auth/v1', base).href,
    headers: { Authorization: `Bearer ${key}`, apikey: key, ...headers },
    storageKey: `sb-${base.hostname.split('.')[0]}-auth-token`,
    autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, flowType: 'implicit',
    ...auth
  });
  /* every database request carries the user's token (the public key when signed out), as supabase-js sends it */
  const authed = async (input, init = {}) => {
    const { data } = await client.getSession(), h = new Headers(init.headers);
    if (!h.has('apikey')) h.set('apikey', key);
    if (!h.has('Authorization')) h.set('Authorization', `Bearer ${data?.session?.access_token ?? key}`);
    return fetch(input, { ...init, headers: h });
  };
  const rest = new PostgrestClient(new URL('rest/v1', base).href, { headers, schema: 'public', fetch: authed });
  return { auth: client, from: table => rest.from(table), rpc: (fn, args, opts) => rest.rpc(fn, args, opts) };
}
