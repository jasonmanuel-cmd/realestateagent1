function logError(source, message) {
  console.error(`[ERROR][${source}] ${message}`);
}

// yyyy-MM-dd in the process's local timezone (set TZ in the environment/cron
// entry if you need a specific one, e.g. TZ=America/Los_Angeles).
function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildUrl(base, params) {
  const query = Object.keys(params)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]))}`)
    .join('&');
  return `${base}?${query}`;
}

module.exports = { logError, formatDate, buildUrl };
