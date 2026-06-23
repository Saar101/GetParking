export async function callOpenAI(messages, model = process.env.OPENAI_MODEL || 'gpt-4o-mini', options = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set in environment');
  }

  const { responseFormat = null } = options ?? {};

  console.info('[GetParking Server] calling OpenAI', {
    model,
    messageCount: Array.isArray(messages) ? messages.length : 0,
  });

  const body = {
    model,
    messages,
    temperature: 0.2,
    max_tokens: 400,
  };

  if (responseFormat) {
    body.response_format = responseFormat;
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  console.info('[GetParking Server] OpenAI response received', {
    ok: res.ok,
    status: res.status,
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn('[GetParking Server] OpenAI response was not ok', {
      status: res.status,
      body: text,
    });
    throw new Error(`OpenAI request failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  console.info('[GetParking Server] OpenAI JSON parsed', {
    hasChoices: Array.isArray(data?.choices),
    choiceCount: Array.isArray(data?.choices) ? data.choices.length : 0,
  });
  return data;
}
