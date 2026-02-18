import { NextResponse } from 'next/server';

type EntryType = 'word' | 'expression';

interface GenerateRequestBody {
  term?: string;
  entryType?: EntryType;
  category?: string;
}

interface LlamaResult {
  definition: string;
  example: string;
}

const parseLlamaResponse = (content: string): LlamaResult | null => {
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }
  const jsonCandidate = content.slice(firstBrace, lastBrace + 1);
  try {
    const parsed = JSON.parse(jsonCandidate) as Partial<LlamaResult>;
    if (!parsed.definition || !parsed.example) {
      return null;
    }
    return {
      definition: parsed.definition.trim(),
      example: parsed.example.trim(),
    };
  } catch {
    return null;
  }
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateRequestBody;
    const term = body.term?.trim();
    const entryType: EntryType = body.entryType === 'expression' ? 'expression' : 'word';
    const category = body.category?.trim() || 'general';

    if (!term) {
      return NextResponse.json({ error: 'Term is required.' }, { status: 400 });
    }

    const nvidiaBaseUrl = process.env.NVIDIA_API_BASE_URL || 'https://integrate.api.nvidia.com/v1';
    const nvidiaModel = process.env.NVIDIA_MODEL || 'meta/llama-3.1-8b-instruct';
    const nvidiaApiKey = process.env.NVIDIA_API_KEY;

    if (!nvidiaApiKey) {
      return NextResponse.json(
        { error: 'Missing NVIDIA_API_KEY in server environment.' },
        { status: 500 },
      );
    }

    const endpoint = `${nvidiaBaseUrl.replace(/\/$/, '')}/chat/completions`;

    const systemPrompt =
      'You are an English teaching assistant. Return strict JSON only with keys "definition" and "example". Keep definition concise and B1-B2 clear.';
    const userPrompt = `Create a helpful English ${entryType} entry for "${term}" in category "${category}".
Rules:
- definition: one sentence, plain English.
- example: one natural sentence using the exact term "${term}".
Output JSON only.`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${nvidiaApiKey}`,
      },
      body: JSON.stringify({
        model: nvidiaModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 220,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Model request failed (${response.status}). ${errorText.slice(0, 200)}` },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content || '';
    const parsed = parseLlamaResponse(content);

    if (!parsed) {
      return NextResponse.json(
        { error: 'Could not parse model response. Ensure the model returns valid JSON.' },
        { status: 502 },
      );
    }

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(
      { error: 'Unexpected server error while generating definition and example.' },
      { status: 500 },
    );
  }
}
