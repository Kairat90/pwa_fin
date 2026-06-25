import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      users: { Row: Record<string, unknown> }
      accounts: { Row: Record<string, unknown> }
      categories: { Row: Record<string, unknown> }
      transactions: { Row: Record<string, unknown> }
      transfers: { Row: Record<string, unknown> }
      scheduled_transactions: { Row: Record<string, unknown> }
      contacts: { Row: Record<string, unknown> }
      debts: { Row: Record<string, unknown> }
      debt_payments: { Row: Record<string, unknown> }
    }
  }
}
