import { NextResponse } from 'next/server';

type EntryType = 'word' | 'expression';

interface GenerateRequestBody {
  term?: string;
  entryType?: EntryType;
  category?: string;
}

interface LlamaResult {
  is_valid: boolean;
  corrected_term: string | null;
  reason: string | null;
  definition_en: string | null;
  definition_fr: string | null;
  example_expression: string | null;
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
    if (typeof parsed.is_valid !== 'boolean') {
      return null;
    }
    return {
      is_valid: parsed.is_valid,
      corrected_term: parsed.corrected_term?.trim() || null,
      reason: parsed.reason?.trim() || null,
      definition_en: parsed.definition_en?.trim() || null,
      definition_fr: parsed.definition_fr?.trim() || null,
      example_expression: parsed.example_expression?.trim() || null,
    };
  } catch {
    return null;
  }
};

const BLOCKED_TERMS = new Set([
  // First names
  'john', 'michael', 'sarah', 'emma', 'james', 'david', 'mary', 'robert', 'william', 'richard', 'charles', 'thomas',
  'daniel', 'matthew', 'anthony', 'mark', 'donald', 'steven', 'paul', 'andrew', 'joshua', 'kenneth', 'kevin', 'brian',
  'george', 'timothy', 'ronald', 'edward', 'jason', 'jeffrey', 'ryan', 'jacob', 'gary', 'nicholas', 'eric', 'jonathan',
  'stephen', 'larry', 'justin', 'scott', 'brandon', 'benjamin', 'samuel', 'raymond', 'gregory', 'frank', 'alexander',
  'patrick', 'jack', 'dennis', 'jerry', 'tyler', 'aaron', 'jose', 'adam', 'nathan', 'henry', 'peter', 'zachary',
  'douglas', 'harold', 'gabriel', 'bruce', 'albert', 'eugene', 'logan', 'philip', 'wayne', 'johnny', 'ralph',
  'russell', 'randy', 'louis', 'harry', 'vincent', 'bobby', 'dylan', 'billy', 'joe', 'howard', 'carl', 'roger',
  'dale', 'arthur', 'terry', 'lawrence', 'jesse', 'noah', 'elijah', 'liam', 'oliver', 'mason', 'lucas', 'ethan',
  'aiden', 'caden', 'jackson', 'sebastian', 'owen', 'emily', 'jessica', 'jennifer', 'ashley', 'amanda', 'stephanie',
  'nicole', 'elizabeth', 'heather', 'melissa', 'tiffany', 'michelle', 'amber', 'megan', 'rachel', 'lauren', 'kayla',
  'hannah', 'katherine', 'sophia', 'olivia', 'isabella', 'mia', 'charlotte', 'amelia', 'ava', 'harper', 'abigail',
  'madison', 'chloe', 'lily', 'grace', 'natalie', 'zoe', 'riley', 'victoria', 'ella', 'scarlett', 'aria', 'layla',
  'penelope', 'camila', 'luna', 'nora', 'hazel', 'paisley', 'evelyn', 'savannah', 'brooklyn',
  // Last names
  'smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis', 'rodriguez', 'martinez', 'hernandez',
  'lopez', 'gonzalez', 'wilson', 'anderson', 'thomas', 'taylor', 'moore', 'jackson', 'martin', 'lee', 'perez',
  'thompson', 'white', 'harris', 'sanchez', 'clark', 'ramirez', 'lewis', 'robinson', 'walker', 'young', 'allen',
  'king', 'wright', 'scott', 'torres', 'nguyen', 'hill', 'flores', 'green', 'adams', 'nelson', 'baker', 'hall',
  'rivera', 'campbell', 'mitchell', 'carter', 'roberts', 'turner', 'phillips', 'evans', 'parker', 'edwards',
  'collins', 'stewart', 'morris', 'murphy', 'cook', 'rogers', 'morgan', 'peterson', 'cooper', 'reed', 'bailey',
  'bell', 'gomez', 'kelly', 'howard', 'ward', 'cox', 'diaz', 'richardson', 'wood', 'watson', 'brooks', 'bennett',
  'gray', 'james', 'reyes', 'cruz', 'hughes', 'price', 'myers', 'long', 'foster', 'sanders', 'ross', 'morales',
  'powell', 'sullivan', 'russell', 'ortiz', 'jenkins', 'gutierrez', 'perry', 'butler', 'barnes', 'fisher',
  // Cities/countries
  'paris', 'london', 'tokyo', 'berlin', 'rome', 'madrid', 'moscow', 'beijing', 'sydney', 'toronto', 'chicago',
  'houston', 'miami', 'dallas', 'boston', 'seattle', 'denver', 'atlanta', 'phoenix', 'detroit', 'portland',
  'orlando', 'france', 'germany', 'spain', 'italy', 'japan', 'china', 'russia', 'brazil', 'mexico', 'canada',
  'australia', 'india', 'england', 'egypt', 'greece', 'turkey', 'sweden', 'norway', 'finland', 'denmark', 'ireland',
  'scotland', 'portugal', 'austria', 'switzerland', 'belgium', 'holland', 'poland', 'ukraine', 'korea', 'vietnam',
  'thailand', 'malaysia', 'singapore', 'indonesia', 'philippines', 'colombia', 'argentina', 'chile', 'peru', 'cuba',
  'jamaica', 'hawaii', 'alaska', 'texas', 'california', 'florida', 'nevada', 'ohio', 'michigan', 'virginia',
  'georgia', 'carolina', 'montana', 'colorado', 'arizona', 'oregon', 'washington', 'brooklyn', 'manhattan', 'queens',
  // Brands
  'nike', 'adidas', 'apple', 'google', 'amazon', 'microsoft', 'samsung', 'toyota', 'honda', 'ford', 'tesla',
  'coca', 'pepsi', 'starbucks', 'mcdonalds', 'walmart', 'netflix', 'spotify', 'uber', 'airbnb', 'facebook',
  'instagram', 'twitter', 'snapchat', 'tiktok', 'youtube', 'linkedin', 'pinterest', 'reddit', 'discord',
  'whatsapp', 'telegram', 'paypal', 'visa', 'mastercard', 'gucci', 'prada', 'chanel', 'rolex', 'ferrari',
  'porsche', 'bmw', 'mercedes', 'audi', 'lexus', 'nintendo', 'playstation', 'xbox', 'marvel', 'disney'
]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateRequestBody;
    const term = body.term?.trim();
    const entryType: EntryType = body.entryType === 'expression' ? 'expression' : 'word';
    const category = body.category?.trim() || 'general';

    if (!term) {
      return NextResponse.json({ error: 'Term is required.' }, { status: 400 });
    }
    if (entryType === 'word') {
      if (term.includes(' ')) {
        return NextResponse.json({ error: 'A word must be a single token.' }, { status: 422 });
      }
      if (!/^[A-Za-z][A-Za-z'-]{1,40}$/.test(term)) {
        return NextResponse.json({ error: 'Invalid word format.' }, { status: 422 });
      }
    }

    const termLower = term.toLowerCase();
    if (BLOCKED_TERMS.has(termLower)) {
      return NextResponse.json(
        { error: 'Proper nouns, names, places, and brand names are not accepted as vocabulary entries.' },
        { status: 422 }
      );
    }

    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
    const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.1:8b';
    const nvidiaBaseUrl = process.env.NVIDIA_API_BASE_URL || 'https://integrate.api.nvidia.com/v1';
    const nvidiaModel = process.env.NVIDIA_MODEL || 'meta/llama-3.1-8b-instruct';
    const nvidiaApiKey = process.env.NVIDIA_API_KEY;

    const systemPrompt =
      'You are a STRICT English vocabulary validator and bilingual teaching assistant. You must return strict JSON only with keys: is_valid, corrected_term, reason, definition_en, definition_fr, example_expression.';
    const userPrompt = `Validate and define the English ${entryType} "${term}" in category "${category}".

STRICT VALIDATION RULES — set is_valid=false if ANY of these apply:
1. It is a proper noun: person name, place name, city, country, brand, or company name.
2. It is a common first name or last name (e.g. Michael, Johnson, Sarah, Paris).
3. It is a geographical name (city, country, continent, state, region).
4. It is not a real, standard English dictionary word or well-known expression.
5. It is gibberish, a random string, or clearly not English.
6. It is misspelled — do NOT silently correct it. Set is_valid=false, provide corrected_term as a suggestion, and explain in reason.
7. It is an abbreviation, acronym, or internet slang not found in standard dictionaries.
8. It is a number, single letter, or symbol.

ONLY set is_valid=true if the term is a GENUINE common English word (noun, verb, adjective, adverb, preposition, conjunction) or an established idiomatic expression that appears in standard English dictionaries like Oxford, Cambridge, or Merriam-Webster.

When in doubt, REJECT. Do NOT guess or silently correct the term.

If is_valid=true, provide:
- definition_en: one clear sentence, plain English (B1-B2 level)
- definition_fr: one clear sentence in French
- example_expression: one natural English sentence using the exact term "${term}"

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

    // Post-LLM validation: if the LLM corrected the term, it means the input was wrong
    if (parsed.is_valid && parsed.corrected_term) {
      const correctedLower = parsed.corrected_term.toLowerCase().trim();
      const inputLower = term.toLowerCase().trim();
      if (correctedLower !== inputLower) {
        return NextResponse.json(
          {
            error: `"${term}" does not appear to be a valid English word. Did you mean "${parsed.corrected_term}"?`,
            suggestion: parsed.corrected_term,
          },
          { status: 422 }
        );
      }
    }

    if (!parsed.is_valid) {
      return NextResponse.json(
        {
          error: parsed.reason || 'Invalid term.',
          suggestion: parsed.corrected_term,
        },
        { status: 422 },
      );
    }
    if (!parsed.definition_en || !parsed.definition_fr || !parsed.example_expression) {
      return NextResponse.json(
        { error: 'Model response was incomplete.' },
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
