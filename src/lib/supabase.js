 import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tyucpxrvttkuhfapvitg.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5dWNweHJ2dHRrdWhmYXB2aXRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2MTU1MzcsImV4cCI6MjA2NTE5MTUzN30.eHyiWgnYc7GyOZwhix5tPkFXTC5YtRVRyYJOXHxPebI'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
