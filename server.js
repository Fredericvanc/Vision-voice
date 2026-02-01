require('dotenv').config();
const express = require('express');
const multer = require('multer');
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(__dirname));

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

function getApiKey(res) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'ELEVENLABS_API_KEY not configured' }); return null; }
  return apiKey;
}

app.get('/api/voices', async (req, res) => {
  const apiKey = getApiKey(res);
  if (!apiKey) return;

  try {
    const response = await fetch(`${ELEVENLABS_BASE}/voices`, {
      headers: { 'xi-api-key': apiKey },
    });
    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Voices list error:', err);
    res.status(500).json({ error: 'Failed to fetch voices' });
  }
});

app.post('/api/clone-voice', upload.single('audio'), async (req, res) => {
  const apiKey = getApiKey(res);
  if (!apiKey) return;

  const name = req.body.name;
  if (!name || !req.file) {
    return res.status(400).json({ error: 'name and audio file are required' });
  }

  try {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('files', new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname);

    const response = await fetch(`${ELEVENLABS_BASE}/voices/add`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    res.json({ voice_id: data.voice_id, name });
  } catch (err) {
    console.error('Voice clone error:', err);
    res.status(500).json({ error: 'Voice cloning failed' });
  }
});

app.post('/api/tts', async (req, res) => {
  const { text, voiceId } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  const apiKey = getApiKey(res);
  if (!apiKey) return;

  const voice = voiceId || 'EXAVITQu4vr4xnSDxMaL'; // default: Sarah

  try {
    const response = await fetch(
      `${ELEVENLABS_BASE}/text-to-speech/${voice}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    res.set('Content-Type', 'audio/mpeg');
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('ElevenLabs error:', err);
    res.status(500).json({ error: 'TTS request failed' });
  }
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;
