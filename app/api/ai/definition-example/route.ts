import { NextResponse } from 'next/server';

type EntryType = 'word' | 'expression';

interface GenerateRequestBody {
  term?: string;
  entryType?: EntryType;
  category?: string;
}

interface LlamaResult {
  definition_en: string;
  definition_fr: string;
  example_expression: string;
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
    if (!parsed.definition_en || !parsed.definition_fr || !parsed.example_expression) {
      return null;
    }
    return {
      definition_en: parsed.definition_en.trim(),
      definition_fr: parsed.definition_fr.trim(),
      example_expression: parsed.example_expression.trim(),
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

    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
    const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.1:8b';
    const nvidiaBaseUrl = process.env.NVIDIA_API_BASE_URL || 'https://integrate.api.nvidia.com/v1';
    const nvidiaModel = process.env.NVIDIA_MODEL || 'meta/llama-3.1-8b-instruct';
    const nvidiaApiKey = process.env.NVIDIA_API_KEY;

    const systemPrompt =
      'You are a bilingual English/French teaching assistant. Return strict JSON only with keys "definition_en", "definition_fr", and "example_expression".';
    const userPrompt = `Create a helpful English ${entryType} entry for "${term}" in category "${category}".
Rules:
- definition_en: one sentence, plain English (B1-B2).
- definition_fr: one sentence in French, clear and natural.
- example_expression: one natural English sentence using the exact term "${term}".
Output JSON only.`;

    let content = '';
    const ollamaResponse = await fetch(`${ollamaBaseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        options: { temperature: 0.4 },
      }),
    }).catch(() => null);

    if (ollamaResponse?.ok) {
      const ollamaData = (await ollamaResponse.json()) as { message?: { content?: string } };
      content = ollamaData.message?.content || '';
    } else {
      if (!nvidiaApiKey) {
        return NextResponse.json(
          { error: 'Ollama is unreachable and NVIDIA_API_KEY is not configured for fallback.' },
          { status: 502 },
        );
      }
      const nvidiaResponse = await fetch(`${nvidiaBaseUrl.replace(/\/$/, '')}/chat/completions`, {
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
          max_tokens: 260,
        }),
      });

      if (!nvidiaResponse.ok) {
        const errorText = await nvidiaResponse.text();
        return NextResponse.json(
          { error: `Model request failed (${nvidiaResponse.status}). ${errorText.slice(0, 200)}` },
          { status: 502 },
        );
      }
      const nvidiaData = (await nvidiaResponse.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      content = nvidiaData.choices?.[0]?.message?.content || '';
    }

    const parsed = parseLlamaResponse(content);

    if (!parsed) {
      return NextResponse.json(
        { error: 'Could not parse model response. Ensure the model returns valid JSON.' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      definition: parsed.definition_en,
      definitionFr: parsed.definition_fr,
      example: parsed.example_expression,
    });
  } catch {
    return NextResponse.json(
      { error: 'Unexpected server error while generating bilingual definitions and example.' },
      { status: 500 },
    );
  }
}
