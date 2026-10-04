import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: `You are a family trip planner. The user says: "${prompt}".

Return ONLY valid JSON, no markdown, no explanation, in exactly this shape:
{
  "destination": "string",
  "travelers": [{ "name": "string", "role": "string" }],
  "days": [
    {
      "day": 1,
      "date": "Day 1",
      "activities": [
        {
          "time": "09:00",
          "title": "short title",
          "description": "1-2 sentence description",
          "kidFriendly": true,
          "elderlyFriendly": true
        }
      ]
    }
  ]
}

Include 3-5 activities per day. Make it realistic for a family with kids and grandparents.`,
    });

    const text = response.text ?? '';
    // Strip markdown code fences if Gemini adds them
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const plan = JSON.parse(cleaned);

    return NextResponse.json({ plan });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}