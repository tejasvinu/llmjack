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
    let apiKey: string | undefined;

    if (provider === 'google') {
      apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        console.error('Google API Key is missing in environment variables.');
        return NextResponse.json({ error: 'Google API Key is missing' }, { status: 500 });
      }
      console.log('Using Google provider with model:', model);
      result = await generateText({
        model: google(model), // apiKey is read from environment variable
        prompt,
      });
    } else if (provider === 'groq') {
      apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        console.error('Groq API Key is missing in environment variables.');
        return NextResponse.json({ error: 'Groq API Key is missing' }, { status: 500 });
      }
      console.log('Using Groq provider with model:', model);
      result = await generateText({
        model: groq(model), // apiKey is read from environment variable
        prompt,
      });
    } else {
      console.error('Invalid provider specified:', provider);
      return NextResponse.json({ error: `Invalid provider: ${provider}` }, { status: 400 });
    }

    console.log(`API Response - Model: ${model}, Text: ${result.text.substring(0, 50)}...`);
    return NextResponse.json({ text: result.text });

  } catch (error: unknown) {
    console.error('Error in AI processing:', error);

    let errorMessage = 'AI processing failed';
    let statusCode = 500;

    // Handle error as unknown, check for Error shape
    if (typeof error === 'object' && error !== null) {
      const err = error as { message?: string; type?: string; code?: string };
      if (err.message) {
        errorMessage = err.message;
      }
      if (err.type === 'authentication_error') {
        statusCode = 401;
      } else if (err.type === 'invalid_request_error') {
        statusCode = 400;
      }
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}
