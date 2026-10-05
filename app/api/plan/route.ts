import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '@/lib/db';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash-lite',
];

async function tryGenerate(prompt: string) {
  const systemPrompt = `You are a family trip planner. The user says: "${prompt}".
Return ONLY valid JSON, no markdown, in exactly this shape:
{
  "destination": "string",
  "travelers": [{ "name": "string", "role": "string" }],
  "days": [{ "day": 1, "date": "Day 1", "activities": [{ "time": "09:00", "title": "string", "description": "string", "kidFriendly": true, "elderlyFriendly": true }] }]
}
Include 3-5 activities per day. Realistic for kids and grandparents.`;

  let lastError: any = null;
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({ model, contents: systemPrompt });
        const text = response.text ?? '';
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
      } catch (err: any) {
        lastError = err;
        const msg = err.message || '';
        const isBusy = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429');
        if (!isBusy) throw err;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  throw lastError;
}

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const plan = await tryGenerate(prompt);

    const { data, error } = await supabase
      .from('trips')
      .insert({ prompt, plan, status: 'draft' })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ id: data.id, plan });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}