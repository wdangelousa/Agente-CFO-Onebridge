
import { createClient } from '@supabase/supabase-js';

// Acesso seguro ao ambiente (previne crash se import.meta.env for undefined)
const env = (import.meta as any).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

// Verificação de segurança para console
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase URL ou Anon Key não detectados. A autenticação falhará até que o .env seja configurado.');
}

// Inicializa o cliente com fallback sintaticamente válido para evitar erros de URL no construtor
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);
