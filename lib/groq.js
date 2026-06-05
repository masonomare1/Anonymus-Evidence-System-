// lib/groq.js
import Groq, { toFile } from 'groq-sdk';

export function createGroqClient(apiKey = process.env.GROQ_API_KEY) {
  const groq = new Groq({ apiKey });
  return {
    async complete(messages) {
      const res = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 1500,
      });
      return res.choices[0]?.message?.content ?? '';
    },
    async transcribe(bytes) {
      const res = await groq.audio.transcriptions.create({
        file: await toFile(bytes, 'audio.mp3'),
        model: 'whisper-large-v3',
      });
      return res.text ?? '';
    },
  };
}
