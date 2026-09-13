// Tapestry — voice synthesis
//
// Uses Microsoft Edge's free online neural TTS service via @andresaya/edge-tts
// — the same free tool referenced in the chat (the "FFMPEG-ish" Windows CLI
// tool being remembered was almost certainly edge-tts). No API key, no
// signup, no cost: this is the actual free consumer TTS behind Edge's
// "Read aloud" feature, called directly.
//
// Runs server-side (here) rather than in-browser on purpose: this is the
// same engine that powers commercial neural voices, so quality is genuinely
// good, and generating real MP3 bytes server-side is what lets the app play
// through a normal <audio> element — which is what makes background
// playback and the system "now playing" notification (swipe-down controls,
// same as Spotify/YouTube Music) actually work. That's not optional polish;
// it's *why* this has to happen here instead of client-side.
//
// Curated to two voices for now (one male, one female) per the request for
// something simple like YouVersion's voice picker — easy to expand later via
// tts.getVoicesByGender() / getVoicesByLanguage(), which the package already
// supports.

const { EdgeTTS } = require('@andresaya/edge-tts');

const VOICES = {
  female: 'en-US-AriaNeural',
  male: 'en-US-GuyNeural',
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let text, voice;
  try {
    const body = JSON.parse(event.body || '{}');
    text = body.text;
    voice = VOICES[body.voice] || VOICES.female;
  } catch (e) {
    return { statusCode: 400, body: 'Invalid request body' };
  }
  if (!text || typeof text !== 'string' || text.length > 2000) {
    return { statusCode: 400, body: 'Missing or invalid "text"' };
  }

  try {
    const tts = new EdgeTTS();
    await tts.synthesize(text, voice, {
      rate: '-6%', // scripture reads better very slightly slowed down
      outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
    });
    const base64Audio = tts.toBase64();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=31536000, immutable' },
      body: JSON.stringify({ audio: base64Audio, format: 'mp3' }),
    };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Voice synthesis failed', detail: String(e) }) };
  }
};
