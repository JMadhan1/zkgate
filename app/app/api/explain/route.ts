import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `You are a Web3 compliance assistant for ZKGate, a privacy-preserving identity protocol built on HashKey Chain.
Explain things in simple, friendly language. Never mention specific personal data.
Focus on what the user CAN do now, not technical ZK details.
Keep responses concise — under 150 words. Use plain text only.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Groq API key not configured' }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { credentialType, proofStatus, walletAddress, question } = body;

  const truncatedWallet = walletAddress
    ? `${String(walletAddress).slice(0, 6)}...${String(walletAddress).slice(-4)}`
    : 'unknown wallet';

  let userPrompt: string;
  if (question) {
    userPrompt = `The user at ${truncatedWallet} asks: "${question}". Their proof status: ${proofStatus ?? 'unknown'}. Credential type: ${credentialType ?? 'none'}.`;
  } else {
    userPrompt = `Explain the current status for wallet ${truncatedWallet}.
Credential type: ${credentialType ?? 'none selected'}.
Proof status: ${proofStatus ?? 'not verified'}.
Tell them what they can do next and what access they have.`;
  }

  try {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Groq API error:', err);
      return NextResponse.json({ error: 'AI service unavailable' }, { status: 502 });
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? 'Unable to generate explanation.';
    return NextResponse.json({ explanation: text });
  } catch (err) {
    console.error('Groq fetch error:', err);
    return NextResponse.json({ error: 'Failed to connect to AI service' }, { status: 500 });
  }
}
