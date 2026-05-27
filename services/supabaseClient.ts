import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!client) {
    client = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return client;
}

export function getSupabaseStatus(): 'configured' | 'not_configured' {
  return isSupabaseConfigured() ? 'configured' : 'not_configured';
}

export async function getCurrentSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client.auth.getSession();
  if (error) {
    console.warn('Failed to read Supabase sync session.', error);
    return null;
  }

  return data.session;
}

export async function getCurrentUserEmail(): Promise<string | null> {
  const session = await getCurrentSession();
  return session?.user?.email || null;
}

export async function signInForSync(email: string, password: string): Promise<string> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable optional sync.');
  }

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(error.message || 'Supabase sync sign-in failed.');
  }

  return data.user?.email || email;
}

export async function signOutFromSync(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  const { error } = await client.auth.signOut();
  if (error) {
    throw new Error(error.message || 'Supabase sync sign-out failed.');
  }
}
