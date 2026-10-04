import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';

const DEFAULT_MODEL = 'gemini-2.5-flash';

export async function generatePdiSuggestion(input: {
  systemPrompt: string;
  userPrompt: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new ServiceUnavailableException(
      'Falta configurar GEMINI_API_KEY en el servidor.',
    );
  }
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: input.userPrompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new BadGatewayException(
      'No se pudo contactar a Gemini. Inténtalo de nuevo.',
    );
  }
  if (!response.ok) {
    throw new BadGatewayException(
      'Gemini no pudo generar el plan. Inténtalo de nuevo.',
    );
  }
  const body = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text?.trim()) {
    throw new BadGatewayException('Gemini no devolvió un plan.');
  }
  return text;
}
