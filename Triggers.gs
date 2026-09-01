/**
 * Installs the daily 6am trigger for runDailyDigest(). Run once manually
 * from the Apps Script editor. Checks existing triggers first so re-running
 * this doesn't stack up duplicate daily runs.
 */
function setDailyTrigger() {
  var existing = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === 'runDailyDigest';
  });

  if (existing.length > 0) {
    Logger.log('runDailyDigest trigger already exists (' + existing.length + '). Not adding another.');
    return;
  }

  ScriptApp.newTrigger('runDailyDigest')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  Logger.log('Daily trigger installed for runDailyDigest at ~6am.');
}
