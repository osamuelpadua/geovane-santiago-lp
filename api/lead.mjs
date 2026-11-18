const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export async function POST(request) {
  const endpoint = process.env.AGENDAR_SCRIPT_URL;
  if (!endpoint) return json({ ok: false, error: 'unavailable' }, 503);

  let raw;
  try {
    raw = await request.text();
    if (raw.length > 4096) return json({ ok: false, error: 'invalid' }, 413);
  } catch {
    return json({ ok: false, error: 'invalid' }, 400);
  }

  let input;
  try { input = JSON.parse(raw); } catch { return json({ ok: false, error: 'invalid' }, 400); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return json({ ok: false, error: 'invalid' }, 400);

  const lead = {
    envioId: text(input.envioId, 64),
    nome: text(input.nome, 40),
    whatsapp: text(input.whatsapp, 13),
    atendimento: text(input.atendimento, 100),
    queixa: text(input.queixa, 300),
    tratamento: text(input.tratamento, 100),
    particular: text(input.particular, 100),
    pagina: text(input.pagina, 1000)
  };
  if (!/^[a-zA-Z0-9-]{16,64}$/.test(lead.envioId) || lead.nome.length < 2 ||
      !/^55\d{10,11}$/.test(lead.whatsapp) || !lead.atendimento ||
      !lead.queixa || !lead.tratamento || !lead.particular || !/^https?:\/\//.test(lead.pagina)) {
    return json({ ok: false, error: 'invalid' }, 400);
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: JSON.stringify(lead),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error('Apps Script HTTP error');
    const result = await response.json();
    if (result?.ok !== true || result.envioId !== lead.envioId) throw new Error('Apps Script did not confirm write');
    return json({ ok: true, envioId: lead.envioId });
  } catch (error) {
    console.error('Falha ao confirmar gravação do lead:', error?.message || 'erro desconhecido');
    return json({ ok: false, error: 'write_failed' }, 502);
  }
}
