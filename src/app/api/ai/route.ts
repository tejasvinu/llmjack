import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { groq } from '@ai-sdk/groq';
// Removed AIError import as it's not exported by 'ai'

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { model, provider, prompt } = await req.json();

    // Log received data (excluding prompt for brevity in logs if needed)
    console.log(`API Request - Provider: ${provider}, Model: ${model}`);

    // Validate required data
    if (!prompt || !model || !provider) {
      return NextResponse.json({ error: 'Missing required fields: prompt, model, provider' }, { status: 400 });
    }

    let result;
    // API keys are expected to be picked up automatically from environment variables:
    // GOOGLE_GENERATIVE_AI_API_KEY for google
    // GROQ_API_KEY for groq
    console.log('GOOGLE_GENERATIVE_AI_API_KEY:', process.env.GOOGLE_GENERATIVE_AI_API_KEY);
    console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY);

    if (provider === 'google') {
      // Check if the necessary environment variable is set
      if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        console.error('Google Generative AI API Key is missing in environment variables.');
        return NextResponse.json({ error: 'Google Generative AI API Key is missing' }, { status: 500 });
      }
      console.log('Using Google provider with model:', model);
      result = await generateText({
        model: google(model), // Rely on environment variable for API key
        prompt,
      });
    } else if (provider === 'groq') {
      // Check if the necessary environment variable is set
      if (!process.env.GROQ_API_KEY) {
        console.error('Groq API Key is missing in environment variables.');
        return NextResponse.json({ error: 'Groq API Key is missing' }, { status: 500 });
      }
      console.log('Using Groq provider with model:', model);
      result = await generateText({
        model: groq(model), // Rely on environment variable for API key
        prompt,
      });
    } else {
      console.error('Invalid provider specified:', provider);
      return NextResponse.json({ error: `Invalid provider: ${provider}` }, { status: 400 });
    }

    console.log(`API Response - Model: ${model}, Text: ${result.text?.substring(0, 100) || ''}...`);
    return NextResponse.json({ text: result.text });

  } catch (error: unknown) {
    console.error('Error generating text:', error);
    return NextResponse.json({ error: 'An error occurred while generating text' }, { status: 500 });
  }
}