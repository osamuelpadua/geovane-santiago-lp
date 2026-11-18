/**
 * Vincule este projeto à planilha criada por arrivein15@gmail.com.
 * Execute prepararPlanilha uma vez para criar a aba e autorizar o script.
 * Implante como App da Web: executar como "Eu", acesso "Qualquer pessoa".
 * Configure a URL /exec na variável AGENDAR_SCRIPT_URL da Vercel.
 */
var NOME_ABA = 'Leads';
var COLUNAS = [
  'ID do envio', 'Data/Hora', 'Nome', 'WhatsApp', 'Atendimento presencial',
  'Queixa', 'Tratamento anterior', 'Atendimento particular', 'Página'
];

function prepararPlanilha() {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  if (!planilha) throw new Error('Este script precisa estar vinculado à planilha.');
  var aba = planilha.getSheetByName(NOME_ABA) || planilha.insertSheet(NOME_ABA);
  if (aba.getLastRow() === 0) {
    aba.appendRow(COLUNAS);
    aba.getRange(1, 1, 1, COLUNAS.length).setFontWeight('bold');
    aba.getRange('D:D').setNumberFormat('@');
    aba.setFrozenRows(1);
  }
  return aba;
}

function doPost(e) {
  var trava = LockService.getScriptLock();
  var bloqueado = false;
  try {
    var d = JSON.parse(e.postData.contents);
    if (!d || !/^[a-zA-Z0-9-]{16,64}$/.test(d.envioId || '') ||
        typeof d.nome !== 'string' || d.nome.trim().length < 2 ||
        !/^55\d{10,11}$/.test(d.whatsapp || '')) {
      return resposta_({ ok: false, erro: 'invalid' });
    }
    trava.waitLock(20000);
    bloqueado = true;
    var aba = prepararPlanilha();
    var ultima = aba.getLastRow();
    if (ultima > 1 && aba.getRange(2, 1, ultima - 1, 1)
        .createTextFinder(d.envioId).matchEntireCell(true).findNext()) {
      return resposta_({ ok: true, envioId: d.envioId });
    }
    aba.appendRow([
      d.envioId, new Date(), texto_(d.nome, 40), texto_(d.whatsapp, 13),
      texto_(d.atendimento, 100), texto_(d.queixa, 300),
      texto_(d.tratamento, 100), texto_(d.particular, 100),
      texto_(d.pagina, 1000)
    ]);
    SpreadsheetApp.flush();
    return resposta_({ ok: true, envioId: d.envioId });
  } catch (err) {
    console.error(String(err));
    return resposta_({ ok: false, erro: 'write_failed' });
  } finally {
    if (bloqueado) trava.releaseLock();
  }
}

function texto_(valor, maximo) {
  var texto = typeof valor === 'string' ? valor.trim().slice(0, maximo) : '';
  return /^[=+\-@]/.test(texto) ? "'" + texto : texto;
}

function resposta_(valor) {
  return ContentService.createTextOutput(JSON.stringify(valor))
    .setMimeType(ContentService.MimeType.JSON);
}
