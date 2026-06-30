function doPost(e) {
  try {
    var entry = JSON.parse(e.postData.contents);
    var sheet = getSS().getSheetByName('historico');
    sheet.appendRow([
      entry.data || '',
      entry.dia || '',
      entry.exercicio || '',
      entry.carga != null ? entry.carga : '',
      entry.observacao || '',
      entry.timestamp ? new Date(entry.timestamp) : new Date()
    ]);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', app: 'Meu Treino Logger' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSS() {
  var files = DriveApp.getFilesByName('Meu Treino - Dados');
  if (files.hasNext()) return SpreadsheetApp.open(files.next());

  var ss = SpreadsheetApp.create('Meu Treino - Dados');
  var sheet = ss.getSheets()[0];
  sheet.setName('historico');
  var header = sheet.getRange(1, 1, 1, 6);
  header.setValues([['Data', 'Dia', 'Exercício', 'Carga (kg)', 'Observação', 'Registrado em']]);
  header.setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 100);
  sheet.setColumnWidth(3, 220);
  sheet.setColumnWidth(5, 280);
  return ss;
}
