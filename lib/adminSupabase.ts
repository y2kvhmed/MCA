import { createClient } from '@supabase/supabase-js';

// Admin Supabase client with service role key for email sending
const supabaseUrl = 'https://pxirgvkbrykkdutqxxhf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4aXJndmticnlra2R1dHF4eGhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTkwNjU2MSwiZXhwIjoyMDc1NDgyNTYxfQ.W057ZQrEMPXRWfc0Re3BQRmhM0Mg5Mwb3vNt5q-ELg8';

export const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});