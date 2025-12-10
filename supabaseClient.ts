
import { createClient } from '@supabase/supabase-js';

// -------------------------------------------------------------------------
// IMPORTANT : REMPLACEZ CES VALEURS PAR CELLES DE VOTRE PROJET SUPABASE
// Allez sur https://supabase.com > Settings > API
// -------------------------------------------------------------------------

const SUPABASE_URL = 'https://cuvscogcrjgjdsdwjcjg.supabase.co'; // Ex: https://xyz.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1dnNjb2djcmpnamRzZHdqY2pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MzU0MzAsImV4cCI6MjA4MDQxMTQzMH0.XSqyPa1t4x-Hi8oOaH2X8yz5WGH6L11sk8Pt0Rtd1vA'; 

// -------------------------------------------------------------------------

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
