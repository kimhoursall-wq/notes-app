const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/notesdb';

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*' }));
app.use(express.json());

const Note = mongoose.model(
  'Note',
  new mongoose.Schema(
    { title: { type: String, required: true, trim: true }, content: { type: String, default: '' } },
    { timestamps: true }
  )
);

// Backend status page (YOURNAME-backend.duckdns.org)
app.get('/', (req, res) => {
  const db = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Notes Backend</title>
  <style>body{font-family:sans-serif;max-width:560px;margin:60px auto;padding:0 16px}</style></head>
  <body><h1>Notes Backend</h1><p>Status: <b>running</b></p><p>MongoDB: <b>${db}</b></p>
  <p>API: <code>/notes</code></p></body></html>`);
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// REST API (YOURNAME-api.duckdns.org)
app.get('/notes', async (req, res) => {
  res.json(await Note.find().sort({ createdAt: -1 }));
});

app.post('/notes', async (req, res) => {
  if (!req.body.title) return res.status(400).json({ error: 'title is required' });
  const note = await Note.create({ title: req.body.title, content: req.body.content });
  res.status(201).json(note);
});

app.delete('/notes/:id', async (req, res) => {
  await Note.findByIdAndDelete(req.params.id);
  res.json({ deleted: true });
});

async function start() {
  for (let i = 0; i < 10; i++) {
    try {
      await mongoose.connect(MONGO_URL);
      console.log('MongoDB connected');
      break;
    } catch (e) {
      console.log('Waiting for MongoDB...', e.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  app.listen(PORT, () => console.log('Server on port ' + PORT));
}
start();
