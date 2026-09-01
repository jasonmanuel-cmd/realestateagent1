/**
 * Shared configuration for the parcel / permit / digest extension to the
 * Kern County Deal Finder Apps Script project.
 *
 * FIELD NAMES BELOW ARE UNVERIFIED PLACEHOLDERS, NOT CONFIRMED VALUES.
 *
 * Before collectParcelData() is trusted for a real run, someone must:
 *   1. Run inspectParcelSchema() from the Apps Script editor (SchemaInspector.gs)
 *      against the live Planning/SB2VP_VacantParcels_pub layer.
 *   2. Replace PARCEL_FIELDS below with the exact field names it logs.
 *   3. If it finds an editFieldsInfo / EditDate field, set EDIT_DATE and flip
 *      PARCEL_REFRESH_CADENCE_CONFIRMED once the refresh cadence is known.
 *
 * A wrong ArcGIS field name returns `undefined`, not an error -- that is why
 * this is called out so explicitly. See Parcels.gs for how a mismatch is
 * surfaced as 'UNVERIFIED' rows instead of silently blank ones.
 *
 * This sandbox could not reach maps.kerncounty.com / maps.co.kern.ca.us /
 * aca-prod.accela.com directly (network egress policy blocks those hosts),
 * so this file ships with the same placeholder field names the spec itself
 * used as an illustration, not values read off a live response.
 */

var CONFIG = {
  PARCEL_QUERY_URL: 'https://maps.kerncounty.com/arcgis/rest/services/Planning/SB2VP_VacantParcels_pub/MapServer/5/query',
  PARCEL_LAYER_METADATA_URL: 'https://maps.kerncounty.com/arcgis/rest/services/Planning/SB2VP_VacantParcels_pub/MapServer/5?f=json',

  ASSESSOR_ROOT_URL: 'https://maps.co.kern.ca.us/arcgis/rest/services/Assessor/Assessor_Public/MapServer?f=json',
  ASSESSOR_QUERY_BASE_URL: 'https://maps.co.kern.ca.us/arcgis/rest/services/Assessor/Assessor_Public/MapServer',
  // TODO(Step 1): set after running inspectAssessorLayers() -- do not assume layer 0.
  // Not currently used by any collector; the spec only asked for it to be confirmed,
  // not wired into a query yet.
  ASSESSOR_LAYER_INDEX: null,

  PERMITS_SEARCH_URL: 'https://aca-prod.accela.com/KERNCO/Cap/CapHome.aspx?module=Building',

  PAGE_SIZE: 2000,

  // TODO(Step 1): replace with the exact field names returned by inspectParcelSchema().
  // Do not ship this to a real daily run with these guesses still in place.
  PARCEL_FIELDS: {
    APN: 'APN', // UNVERIFIED
    ACREAGE: 'ACREAGE', // UNVERIFIED
    ZONING: 'ZONING', // UNVERIFIED
    STATUS: 'STATUS', // UNVERIFIED
    EDIT_DATE: null // TODO: set to the EditDate field name if inspectParcelSchema() finds one
  },

  // Set to true only once a human has confirmed (via editFieldsInfo, or by asking
  // Kern County GIS directly) how often the vacant-parcels layer actually refreshes.
  // Until then, digest text must not claim "daily new parcels" -- see Digest.gs.
  PARCEL_REFRESH_CADENCE_CONFIRMED: false,

  SHEET_NAMES: {
    PARCELS_SNAPSHOT: 'Parcels_Snapshot',
    PARCELS_SEEN: 'Parcels_Seen',
    PERMITS_SEEN: 'Permits_Seen',
    DIGEST_LOG: 'Digest_Log'
  }
};
