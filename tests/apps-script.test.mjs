import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('Apps Script grava uma vez e confirma o mesmo ID em nova tentativa', () => {
  const rows = [['ID do envio', 'Data/Hora', 'Nome']];
  const aba = {
    getLastRow: () => rows.length,
    getRange: (row) => ({
      createTextFinder: (id) => ({
        matchEntireCell: () => ({ findNext: () => rows.slice(1).find((item) => item[0] === id) })
      })
    }),
    appendRow: (row) => rows.push(row)
  };
  const context = {
    Date, JSON, console,
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({ getSheetByName: () => aba }),
      flush() {}
    },
    ContentService: {
      MimeType: { JSON: 'JSON' },
      createTextOutput: (value) => ({ value, setMimeType() { return this; } })
    }
  };
  vm.runInNewContext(readFileSync(new URL('../apps-script/Codigo.gs', import.meta.url), 'utf8'), context);
  const lead = {
    envioId: '123e4567-e89b-42d3-a456-426614174000',
    nome: 'Ana', whatsapp: '5514999999999', atendimento: 'Mora em Ourinhos',
    queixa: '=IMPORTXML("https://example.com")', tratamento: 'Primeira vez',
    particular: 'Ciente', pagina: 'https://example.com/'
  };
  const event = { postData: { contents: JSON.stringify(lead) } };
  assert.equal(JSON.parse(context.doPost(event).value).ok, true);
  assert.equal(JSON.parse(context.doPost(event).value).ok, true);
  assert.equal(rows.length, 2);
  assert.equal(rows[1][0], lead.envioId);
  assert.equal(rows[1][5], "'" + lead.queixa);
});
