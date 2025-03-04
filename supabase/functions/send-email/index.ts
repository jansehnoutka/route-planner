// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the request body
    const { to, subject, html, from } = await req.json()

    // Validate required fields
    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, or html' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Configure SMTP client
    // Note: In a real environment, these would be environment variables
    const client = new SmtpClient();
    
    // Connect to SMTP server
    // These values should be replaced with actual SMTP configuration
    // and stored as environment variables in production
    await client.connectTLS({
      hostname: Deno.env.get("SMTP_HOSTNAME") || "smtp.example.com",
      port: Number(Deno.env.get("SMTP_PORT")) || 587,
      username: Deno.env.get("SMTP_USERNAME") || "your-username",
      password: Deno.env.get("SMTP_PASSWORD") || "your-password",
    });

    // Send the email
    await client.send({
      from: from || 'Route Planner <noreply@routeplanner.app>',
      to: to,
      subject: subject,
      content: html,
      html: html,
    });

    // Close the connection
    await client.close();

    // Return success response
    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    // Return error response
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

/* To deploy this Edge Function:

1. Install Supabase CLI
2. Run: supabase functions deploy send-email
3. Set environment variables:
   supabase secrets set SMTP_HOSTNAME=smtp.example.com
   supabase secrets set SMTP_PORT=587
   supabase secrets set SMTP_USERNAME=your-username
   supabase secrets set SMTP_PASSWORD=your-password

*/