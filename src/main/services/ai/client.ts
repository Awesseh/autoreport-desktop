export async function chatJson<T>(apiKey: string, system: string, user: string): Promise<T> {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'mistral-small-latest', temperature: 0.1, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }) })
  if (!response.ok) throw new Error(`Mistral request failed (${response.status}). Check your API key and connection, then try again.`)
  const payload = await response.json() as { choices?: { message?: { content?: string } }[] }, content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('The AI service returned an empty response.')
  try { return JSON.parse(content) as T } catch { throw new Error('The AI service returned invalid JSON. Please retry.') }
}
