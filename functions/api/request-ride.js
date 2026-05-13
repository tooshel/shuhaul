/**
 * SHU-HAUL — Cloudflare Pages Function
 * Route: POST /api/request-ride
 *
 * Replaces the Express server endpoint. Calls Twilio's REST API
 * directly via fetch (no Node SDK needed — Workers are V8 isolates).
 *
 * Secrets are stored in the Cloudflare dashboard and injected into
 * `context.env` at runtime. For local dev they come from .dev.vars.
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  // ---- Parse body --------------------------------------------------
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { name, pickup, dropoff, tier } = body;

  if (!name || !pickup || !dropoff || !tier) {
    return json({ error: 'Missing required fields: name, pickup, dropoff, tier' }, 400);
  }

  // ---- Build SMS ---------------------------------------------------
  const pickupStr = pickup.address
    ? pickup.address
    : `${Number(pickup.lat).toFixed(5)}, ${Number(pickup.lng).toFixed(5)}`;

  const smsBody =
    `🚨 SHU-HAUL REQUEST 🚨\n` +
    `${name} needs a ride.\n` +
    `Pickup: ${pickupStr}\n` +
    `Dropoff: ${dropoff}\n` +
    `Tier: ${tier}\n` +
    `—\nSent by the Shu-Haul platform. Good luck out there, Sheldon.`;

  console.log('Incoming ride request:', { name, pickup: pickupStr, dropoff, tier });

  // ---- Send SMS via Twilio REST API --------------------------------
  try {
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
      // Basic auth = base64("AccountSid:AuthToken")
      const credentials = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);

      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: env.TWILIO_FROM_NUMBER,
            To:   env.DRIVER_PHONE_NUMBER,
            Body: smsBody,
          }),
        }
      );

      if (twilioRes.ok) {
        const data = await twilioRes.json();
        console.log('SMS sent — SID:', data.sid);
      } else {
        // Log but don't surface the error to the client
        const errText = await twilioRes.text();
        console.error('Twilio error:', twilioRes.status, errText);
      }
    } else {
      // Secrets not configured — useful during local UI dev
      console.log('Twilio not configured. Would have sent:\n', smsBody);
    }
  } catch (err) {
    // Network/runtime error — swallow it so the frontend gag never breaks
    console.error('SMS failed silently:', err.message);
  }

  return json({ success: true, message: "Driver has been notified." });
}

// ---- Helper: build a JSON Response --------------------------------
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
