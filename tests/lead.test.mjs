import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../api/lead.mjs';

const lead = {
  envioId: '123e4567-e89b-42d3-a456-426614174000',
  nome: 'Ana', whatsapp: '5514999999999', atendimento: 'Mora em Ourinhos',
  queixa: 'Dor lombar', tratamento: 'Primeira vez buscando tratamento',
  particular: 'Ciente, atendimento particular', pagina: 'https://example.com/'
};
const request = (body) => new Request('https://example.com/api/lead', {
  method: 'POST', body: JSON.stringify(body)
});

test('confirma o lead somente após resposta positiva do Apps Script', async (t) => {
  const original = globalThis.fetch;
  const previous = process.env.AGENDAR_SCRIPT_URL;
  t.after(() => { globalThis.fetch = original; process.env.AGENDAR_SCRIPT_URL = previous; });
  process.env.AGENDAR_SCRIPT_URL = 'https://script.google.com/macros/s/test/exec';
  let enviado;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, process.env.AGENDAR_SCRIPT_URL);
    enviado = JSON.parse(options.body);
    return Response.json({ ok: true, envioId: enviado.envioId });
  };
  const response = await POST(request(lead));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, envioId: lead.envioId });
  assert.equal(enviado.whatsapp, lead.whatsapp);
});

test('não confirma falha ou resposta de outro envio', async (t) => {
  const original = globalThis.fetch;
  const previous = process.env.AGENDAR_SCRIPT_URL;
  t.after(() => { globalThis.fetch = original; process.env.AGENDAR_SCRIPT_URL = previous; });
  process.env.AGENDAR_SCRIPT_URL = 'https://script.google.com/macros/s/test/exec';
  globalThis.fetch = async () => Response.json({ ok: true, envioId: 'outro-envio' });
  const response = await POST(request(lead));
  assert.equal(response.status, 502);
  assert.equal((await response.json()).ok, false);
});

test('rejeita formulário incompleto sem enviar ao Apps Script', async (t) => {
  const original = globalThis.fetch;
  const previous = process.env.AGENDAR_SCRIPT_URL;
  t.after(() => { globalThis.fetch = original; process.env.AGENDAR_SCRIPT_URL = previous; });
  process.env.AGENDAR_SCRIPT_URL = 'https://script.google.com/macros/s/test/exec';
  globalThis.fetch = () => { throw new Error('Não deveria enviar'); };
  const response = await POST(request({ ...lead, whatsapp: '' }));
  assert.equal(response.status, 400);
});
