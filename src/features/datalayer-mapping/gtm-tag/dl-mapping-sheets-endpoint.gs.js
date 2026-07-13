// DataLayer Mapping — Endpoint Google Apps Script (2026-07-13)
//
// Reçoit les envois du tag collecteur (dl-mapping-collector.html / package-templates.ts)
// et ajoute une ligne par occurrence dans un Google Sheet. Alternative légère à Supabase
// pour centraliser une vraie capture de trafic réel, sans héberger de serveur.
//
// DÉPLOIEMENT (à faire manuellement dans Google Sheets — pas automatisable depuis l'outil) :
// 1. Crée un nouveau Google Sheet (ou réutilise-en un dédié à cet usage)
// 2. Extensions > Apps Script
// 3. Colle ce fichier en entier dans l'éditeur (remplace le contenu par défaut)
// 4. Déployer > Nouveau déploiement > type "Application Web"
//    - Exécuter en tant que : Moi
//    - Qui a accès : Tout le monde
//      (nécessaire — le tag s'exécute dans le navigateur de chaque visiteur, sans compte
//      Google, il ne peut donc pas s'authentifier)
// 5. Autoriser les permissions demandées (accès à ce Sheet précis)
// 6. Copier l'URL de déploiement (se termine par /exec) — c'est la valeur à renseigner
//    dans la variable GTM "DL Mapping - Sheets Endpoint" du package
//
// LIMITES CONNUES :
// - Quotas d'exécution Apps Script par jour (variables selon le type de compte Google) —
//   le tag batch déjà les envois (toutes les 5s ou tous les 20 events, jamais un par event),
//   ce qui réduit fortement le nombre d'appels. À surveiller sur les domaines à fort trafic.
// - Un Google Sheet devient lent au-delà de quelques centaines de milliers de lignes —
//   prévoir de purger/archiver l'onglet "Occurrences" périodiquement si le volume grossit.
// - Pas d'authentification sur l'URL /exec (elle est publique par design, cf. étape 4) —
//   n'importe qui connaissant l'URL pourrait y envoyer des données. Le payload attendu est
//   déjà anonymisé côté tag, donc pas de PII en jeu même en cas d'abus, mais garder l'URL
//   hors des dépôts publics reste une bonne pratique.

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Occurrences')
    || SpreadsheetApp.getActiveSpreadsheet().insertSheet('Occurrences');

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Reçu le', 'Client', 'Site', 'Event', 'Page', 'Détecté le', 'Anomalies', 'Variables (JSON)']);
  }

  var payload = JSON.parse(e.postData.contents);
  var clientId = payload.clientId;
  var siteId = payload.siteId;
  var occurrences = payload.occurrences || [];

  var rows = occurrences.map(function (occ) {
    return [
      new Date().toISOString(),
      clientId,
      siteId,
      occ.eventName,
      occ.pageLocation,
      occ.detectedAt,
      (occ.anomalies || []).join(', '),
      JSON.stringify(occ.variablesSnapshot),
    ];
  });

  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: true, inserted: rows.length }))
    .setMimeType(ContentService.MimeType.JSON);
}
