/**
 * SHU-HAUL — Express Server
 *
 * Serves the static frontend and handles the /api/request-ride endpoint
 * which fires a Twilio SMS to the driver.
 */

require('dotenv').config();

const express = require('express');
const path    = require('path');
const twilio  = require('twilio');

const app  = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Twilio client — lazy-init so the server boots even without credentials
// (useful for local UI dev without a real Twilio account)
// ---------------------------------------------------------------------------
let twilioClient = null;
try {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    console.log('✅ Twilio client initialised');
  } else {
    console.warn('⚠️  Twilio credentials not set — SMS will be skipped (check your .env)');
  }
} catch (err) {
  console.error('❌ Failed to initialise Twilio:', err.message);
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// POST /api/request-ride
// Body: { name, pickup: { lat, lng, address? }, dropoff, tier }
// ---------------------------------------------------------------------------
app.post('/api/request-ride', async (req, res) => {
  const { name, pickup, dropoff, tier } = req.body;

  // Basic validation
  if (!name || !pickup || !dropoff || !tier) {
    return res.status(400).json({ error: 'Missing required fields: name, pickup, dropoff, tier' });
  }

  // Build a human-readable pickup string
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

  console.log('📱 Incoming ride request:', { name, pickup: pickupStr, dropoff, tier });
  console.log('📨 SMS body:\n', smsBody);

  // Fire SMS — but never let a Twilio failure break the frontend gag
  try {
    if (twilioClient) {
      const msg = await twilioClient.messages.create({
        body: smsBody,
        from: process.env.TWILIO_FROM_NUMBER,
        to:   process.env.DRIVER_PHONE_NUMBER,
      });
      console.log('✅ SMS sent — SID:', msg.sid);
    } else {
      console.log('ℹ️  Twilio not configured — SMS skipped. Would have sent:', smsBody);
    }
  } catch (err) {
    // Log the error but return success so the UI gag plays uninterrupted
    console.error('❌ Twilio error:', err.message);
  }

  return res.json({ success: true, message: 'Driver has been notified. He\'s probably already on his way.' });
});

// ---------------------------------------------------------------------------
// Catch-all — SPA fallback
// ---------------------------------------------------------------------------
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚚 Shu-Haul is running → http://localhost:${PORT}`);
});
