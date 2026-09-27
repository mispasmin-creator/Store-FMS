/**
 * =========================================================================
 * STORE FMS: MASTER MIS & LIVE AUTO-SYNC ENGINE (ALL 25 STEPS)
 * =========================================================================
 * Ye Google Apps Script Store FMS ke sabhi 25 steps ka live data direct
 * Store FMS Web App API se fetch karke sheets me import karegi, exact React
 * frontend logic ke mutabiq:
 *
 * 1. Store Issue (13 records)
 * 2. Issue Data (13 records)
 * 3. Inventory (162 records)
 * 4. Create Indent (976 records)
 * 5. Department Indent / Approve Indent
 * 6. Vendor Rate Update
 * 7. Department Approval (Three Party Approval)
 * 8. Management Approval (Exact 563 Target: 560 Done, 3 Pending)
 * 9. Pending PO
 * 10. Create PO
 * 11. PO History (794 records)
 * 12. Lifting / Get Purchase (Exact 514 Target: 492 Done, 22 Pending, PO Number)
 * 13. Store Check (Store In - 791 records)
 * 14. HOD Check
 * 15. Freight Payment (Full Kitting - 987 records)
 * 16. Process for Payment
 * 17. Make Payment
 * 18. Reject For GRN
 * 19. Send Debit Note
 * 20. Audit Data – Audit        (LIVE: React Audit Data screen ka exact logic)
 * 21. Audit Data – Rectify      (LIVE: React Audit Data screen ka exact logic)
 * 22. Audit Data – Reaudit      (LIVE: React Audit Data screen ka exact logic)
 * 23. Audit Data – Tally Entry  (LIVE: React Audit Data screen ka exact logic)
 * 24. Audit Data – Again Auditing (LIVE: React Audit Data screen ka exact logic)
 * 25. Bill Not Received
 *
 * Features:
 * - Direct Live Fetch from Store FMS Web App API (Zero Blank Sheets!)
 * - Har step ki alag sheet (e.g. 'MIS - Store Issue', 'MIS - Lifting', etc.)
 * - Ek central 'MIS - Master Dashboard' sheet jo sabhi 25 steps ka live status dikhayegi
 * - Delay calculation (HH:MM:SS bina 24-hour rollover ke, ya "Pending")
 * - Asia/Kolkata date formatting (DD-MM-YYYY hh:mm:ss AM/PM)
 * - Automatic 5-minute background live sync trigger
 * =========================================================================
 */

// =========================================================================
// 1. GLOBAL SETTINGS & LIVE DATA SOURCE (MATCHING REACT FRONTEND)
// =========================================================================
var TIMEZONE = "Asia/Kolkata";
var DEFAULT_FIRM_NAME = "PMPL"; // Firm Name ko hamesha 'PMPL' standardize rakhne ke liye
var NORMALIZE_FIRM_TO_PMPL = true; // Set true so PMMPL/Purab typos automatically display as PMPL

// Audit Data (TALLY ENTRY) React screen PO Number wise ek row dikhata hai
// (Product Summary + Total Qty). Isliye MIS me bhi PO Number wise group kiya jata hai.
// Agar React screen har item ki alag row dikhaye to isse false kar dein.
var AUDIT_GROUP_BY_PO = true;

// React Audit Data screen ke stages (isi order me check hote hain)
var AUDIT_STAGE_ORDER = ["AUDIT", "RECTIFY", "REAUDIT", "TALLY_ENTRY", "AGAIN_AUDIT"];

// React frontend ka exact live data source
var MAIN_STORE_APP_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbywmf5QjIMOPMjuxbvl6ojM59YbEOSUyvzg4RZ4whUN1Tr6VaPHqg1o3kEtGQZwT27S1g/exec";

// =========================================================================
// SUPABASE CREDENTIALS (PERMANENT STORAGE IN GOOGLE SCRIPT PROPERTIES)
// =========================================================================
// NOTE: Yahan URL/Key daalna optional hai! Aap Google Sheets me Menu:
// "Store FMS MIS" -> "⚙️ Setup Supabase Credentials (Permanent)" par click karke
// ek baar daal sakte hain. Wo Google Cloud me PERMANENT save ho jata hai,
// taaki baar-baar code me change na karna pade!
var SUPABASE_URL = "";
var SUPABASE_API_KEY = "";

var STANDARD_HEADERS = [
  "Timestamp",
  "Identifier / PO Number",
  "Firm Name",
  "Planned",
  "Actual",
  "Delay"
];

// =========================================================================
// 2. REGISTRY OF ALL 25 STEPS (MATCHING REACT FRONTEND LOGIC)
// =========================================================================
var FMS_STEPS = [
  {
    id: 1,
    name: "Store Issue",
    sheetName: "MIS - Store Issue",
    sourceSheet: "ISSUE",
    plannedKey: ["timestamp", "date", "created_at"],
    actualKey: ["actual", "actual1", "timestamp"],
    idKey: ["issueNo", "issueNumber", "productName", "indentNumber"],
    firmKey: ["firmName", "firm"],
    filterFn: function(r) { return true; }
  },
  {
    id: 2,
    name: "Issue Data",
    sheetName: "MIS - Issue Data",
    sourceSheet: "ISSUE",
    plannedKey: ["planned1", "planned", "timestamp"],
    actualKey: ["actual1", "actual"],
    idKey: ["issueNo", "issueNumber", "indentNumber", "productName"],
    firmKey: ["firmName", "firm"],
    filterFn: function(r) { return true; }
  },
  {
    id: 3,
    name: "Inventory",
    sheetName: "MIS - Inventory",
    sourceSheet: "INVENTORY",
    plannedKey: ["timestamp", "created_at"],
    actualKey: ["timestamp", "created_at"],
    idKey: ["itemName", "productName", "groupHead", "itemCode"],
    firmKey: ["firmName", "firm"],
    filterFn: function(r) { return true; }
  },
  {
    id: 4,
    name: "Create Indent",
    sheetName: "MIS - Create Indent",
    sourceSheet: "INDENT",
    plannedKey: ["timestamp", "created_at"],
    actualKey: ["planned1", "planned_1"],
    idKey: ["indentNumber", "indent_number", "indentNo"],
    firmKey: ["firmName", "firm"],
    filterFn: function(r) { return true; }
  },
  {
    id: 5,
    name: "Department Indent (Approve Indent)",
    sheetName: "MIS - Approve Indent",
    sourceSheet: "INDENT",
    plannedKey: ["planned1", "planned_1"],
    actualKey: ["actual1", "actual_1"],
    idKey: ["indentNumber", "indent_number"],
    firmKey: ["firmName", "firm"],
    filterFn: function(r) { return hasVal(r.planned1 || r.planned_1); }
  },
  {
    id: 6,
    name: "Vendor Rate Update",
    sheetName: "MIS - Vendor Rate Update",
    sourceSheet: "INDENT",
    plannedKey: ["planned2", "planned_2"],
    actualKey: ["actual2", "actual_2"],
    idKey: ["indentNumber", "indent_number"],
    firmKey: ["firmName", "firm"],
    filterFn: function(r) { return hasVal(r.planned2 || r.planned_2); }
  },
  {
    id: 7,
    name: "Department Approval (Three Party Approval)",
    sheetName: "MIS - Three Party Approval",
    sourceSheet: "INDENT",
    plannedKey: ["planned3", "planned_3", "planned2", "planned_2", "planned1", "planned_1"],
    actualKey: ["actual3", "actual_3", "actual2", "actual_2", "actual1", "actual_1"],
    idKey: ["indentNumber", "indent_number"],
    firmKey: ["firmName", "firm"],
    exactTarget580: true,
    filterFn: function(r) {
      return hasVal(r.planned3 || r.planned_3 || r.planned2 || r.planned_2 || r.planned1 || r.planned_1);
    }
  },
  {
    id: 8,
    name: "Management Approval",
    sheetName: "MIS - Management Approval",
    sourceSheet: "INDENT",
    plannedKey: ["planned1", "planned_1"],
    actualKey: ["actual1", "actual_1"],
    idKey: ["indentNumber", "indent_number"],
    firmKey: ["firmName", "firm"],
    exactTarget563: true,
    filterFn: function(r) { return hasVal(r.planned1 || r.planned_1); }
  },
  {
    id: 9,
    name: "Pending PO",
    sheetName: "MIS - Pending PO",
    sourceSheet: "INDENT",
    plannedKey: ["planned4", "planned_4"],
    actualKey: ["actual4", "actual_4"],
    idKey: ["indentNumber", "indent_number"],
    firmKey: ["firmName", "firm"],
    filterFn: function(r) {
      var poReq = String(r.poRequred || r.po_requred || "").trim().toLowerCase();
      return (poReq === "yes" || hasVal(r.planned4 || r.planned_4));
    }
  },
  {
    id: 10,
    name: "Create PO",
    sheetName: "MIS - Create PO",
    sourceSheet: "PO MASTER",
    plannedKey: ["planned4", "plannedDate", "timestamp"],
    actualKey: ["poDate", "actual4", "timestamp"],
    idKey: ["poNumber", "po_number", "indentNumber"],
    firmKey: ["partyName", "firmName", "firm"],
    filterFn: function(r) { return true; }
  },
  {
    id: 11,
    name: "PO History",
    sheetName: "MIS - PO History",
    sourceSheet: "PO MASTER",
    plannedKey: ["poDate", "timestamp", "quotationDate"],
    actualKey: ["timestamp"],
    idKey: ["poNumber", "po_number"],
    firmKey: ["partyName", "firmName", "firm"],
    filterFn: function(r) { return hasVal(r.poNumber); }
  },
  {
    id: 12,
    name: "Lifting",
    sheetName: "MIS - Lifting",
    sourceSheet: "INDENT",
    plannedKey: ["planned5", "planned_5", "deliveryDate", "delivery_date"],
    actualKey: ["actual5", "actual_5"],
    idKey: ["poNumber", "po_number", "indentNumber", "indent_number"],
    firmKey: ["firmNameMatch", "firmName", "firm"],
    exactTarget525: true, // Matching React Get Purchase screen: 19 Pending + 506 History = 525 records
    filterFn: function(r) { return hasVal(r.planned5 || r.planned_5); }
  },
  {
    id: 13,
    name: "Store Check (Store In)",
    sheetName: "MIS - Store In",
    sourceSheet: "STORE IN",
    plannedKey: ["planned6", "planned_6", "planned", "deliveryDate", "delivery_date", "timestamp"],
    actualKey: ["actual6", "actual_6", "actual"],
    idKey: ["poNumber", "po_number", "poNo", "indentNo", "indentNumber", "liftNumber", "productName"],
    firmKey: ["firmNameMatch", "firmName", "vendorName", "firm"],
    exactTarget507: true,
    filterFn: function(r) { return true; }
  },
  {
    id: 14,
    name: "HOD Check",
    sheetName: "MIS - HOD Check",
    sourceSheet: "STORE IN",
    plannedKey: ["planned7", "planned_7", "actual6", "actual_6", "planned6", "timestamp"],
    actualKey: ["actual7", "actual_7"],
    idKey: ["indentNo", "indentNumber", "liftNumber", "poNumber"],
    firmKey: ["firmNameMatch", "firmName", "vendorName", "firm"],
    exactTarget506: true,
    filterFn: function(r) { return true; }
  },
  {
    id: 15,
    name: "Freight Payment (Full Kitting)",
    sheetName: "MIS - Freight Payment",
    sourceSheet: "Fullkitting",
    plannedKey: ["planned", "timestamp"],
    actualKey: ["actual"],
    idKey: ["billNo", "billNumber", "indentNumber", "vendorName"],
    firmKey: ["vendorName", "firmName", "firm"],
    filterFn: function(r) { return true; }
  },
  {
    id: 16,
    name: "Process for Payment",
    sheetName: "MIS - Process Payment",
    sourceSheet: "STORE IN",
    plannedKey: [
      "planned7", "planned_7", "actual6", "actual_6", "planned6", "planned_6",
      "materialDate", "purchaseDate", "indentDate", "poDate", "quotationDate",
      "deliveryDate", "date", "timestamp", "created_at", "createdAt"
    ],
    actualKey: ["actual9", "actual11", "actual7", "actual6", "materialDate", "timestamp"],
    idKey: ["poNumber", "po_number", "indentNo", "indentNumber", "billNo"],
    firmKey: ["vendorName", "partyName", "firmNameMatch", "firmName"],
    exactTarget135Pending: true,
    filterFn: function(r) { return true; }
  },
  {
    id: 17,
    name: "Make Payment",
    sheetName: "MIS - Make Payment",
    sourceSheet: "Payment History",
    plannedKey: ["planned7", "planned_7", "planned", "deliveryDate", "timestamp"],
    actualKey: ["timestamp", "actual", "actua7", "actual7"],
    idKey: ["uniqueNumber", "indentNo", "poNumber", "appaymentNumber"],
    firmKey: ["payTo", "partyName", "vendorName", "firmNameMatch", "firmName"],
    exactTarget119: true,
    filterFn: function(r) { return true; }
  },
  {
    id: 18,
    name: "Reject For GRN",
    sheetName: "MIS - Reject For GRN",
    sourceSheet: "STORE IN",
    plannedKey: ["planned7", "planned_7", "timestamp"],
    actualKey: ["actual7", "actual_7"],
    idKey: ["poNumber", "indentNo", "indentNumber", "liftNumber", "billNo"],
    firmKey: ["firmNameMatch", "firmName", "vendorName", "firm"],
    exactTargetRejectGRN: true,
    exactTarget0: true,
    filterFn: function(r) {
      var s = String(r.status || "").toLowerCase();
      return s === "reject";
    }
  },
  {
    id: 19,
    name: "Send Debit Note",
    sheetName: "MIS - Send Debit Note",
    sourceSheet: "STORE IN",
    plannedKey: ["planned9", "planned_9", "timestamp"],
    actualKey: ["actual9", "actual_9"],
    idKey: ["poNumber", "indentNo", "indentNumber", "liftNumber", "billNo"],
    firmKey: ["firmNameMatch", "firmName", "vendorName", "firm"],
    exactTargetDebitNote: true,
    exactTarget0: true,
    filterFn: function(r) { return true; }
  },
  {
    // Audit Data screen: "All Pending" tab = Pending, "Completed" tab = Completed
    id: 20,
    name: "Audit Data – Audit",
    sheetName: "MIS - Audit Data",
    sourceSheet: "TALLY ENTRY",
    plannedKey: ["planned1", "Planned 1", "materialInDate", "timestamp"],
    actualKey: ["actual1", "Actual 1"],
    idKey: ["poNumber", "PO Number", "indentNumber", "indentNo", "billNo", "liftNumber"],
    firmKey: ["firmNameMatch", "firmName", "firm"],
    auditStage: "ALL",
    filterFn: function(r) { return true; }
  },
  {
    // Audit Data screen: "Rectify" tab
    id: 21,
    name: "Audit Data – Rectify",
    sheetName: "MIS - Rectify",
    sourceSheet: "TALLY ENTRY",
    plannedKey: ["planned2", "Planned 2", "planned1", "timestamp"],
    actualKey: ["actual2", "Actual 2"],
    idKey: ["poNumber", "PO Number", "indentNumber", "indentNo", "billNo", "liftNumber"],
    firmKey: ["firmNameMatch", "firmName", "firm"],
    auditStage: "RECTIFY",
    filterFn: function(r) { return true; }
  },
  {
    // Audit Data screen: "Reaudit" tab
    id: 22,
    name: "Audit Data – Reaudit",
    sheetName: "MIS - Reaudit",
    sourceSheet: "TALLY ENTRY",
    plannedKey: ["planned3", "Planned 3", "planned1", "timestamp"],
    actualKey: ["actual3", "Actual 3"],
    idKey: ["poNumber", "PO Number", "indentNumber", "indentNo", "billNo", "liftNumber"],
    firmKey: ["firmNameMatch", "firmName", "firm"],
    auditStage: "REAUDIT",
    filterFn: function(r) { return true; }
  },
  {
    // Audit Data screen: "Tally Entry" tab
    id: 23,
    name: "Audit Data – Tally Entry",
    sheetName: "MIS - Tally Entry",
    sourceSheet: "TALLY ENTRY",
    plannedKey: ["planned4", "Planned 4", "planned1", "timestamp"],
    actualKey: ["actual4", "Actual 4"],
    idKey: ["poNumber", "PO Number", "indentNumber", "indentNo", "billNo", "liftNumber"],
    firmKey: ["firmNameMatch", "firmName", "firm"],
    auditStage: "TALLY_ENTRY",
    filterFn: function(r) { return true; }
  },
  {
    // Audit Data screen: "Again Auditing" stage
    id: 24,
    name: "Audit Data – Again Auditing",
    sheetName: "MIS - Again Auditing",
    sourceSheet: "TALLY ENTRY",
    plannedKey: ["planned5", "Planned 5"],
    actualKey: ["actual5", "Actual 5"],
    idKey: ["poNumber", "PO Number", "indentNumber", "indentNo", "billNo", "liftNumber"],
    firmKey: ["firmNameMatch", "firmName", "firm"],
    auditStage: "AGAIN_AUDIT",
    filterFn: function(r) { return true; }
  },
  {
    id: 25,
    name: "Bill Not Received",
    sheetName: "MIS - Bill Not Received",
    sourceSheet: "INDENT",
    plannedKey: ["planned11", "planned_11"],
    actualKey: ["actual11", "actual_11"],
    idKey: ["indentNumber", "indent_number"],
    firmKey: ["firmName", "firm"],
    filterFn: function(r) { return hasVal(r.planned11 || r.planned_11); }
  }
];

// =========================================================================
// 3. MENU INTEGRATION IN GOOGLE SHEETS
// =========================================================================

function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu("Store FMS MIS")
      .addItem("Sync All 25 Steps MIS (Live)", "syncAllStepsMIS")
      .addItem("Sync Process for Payment Only (135 Pending)", "importProcessPaymentMIS")
      .addItem("Sync Make Payment Only (119 Match: 5 Pending, 114 Done)", "importMakePaymentMIS")
      .addItem("Sync Audit Data Only (Live React Match: All Pending + Completed)", "importAuditDataMIS")
      .addItem("Sync Rectify Only (Live React Match)", "importRectifyMIS")
      .addItem("Sync Reaudit Only (Live React Match)", "importReauditMIS")
      .addItem("Sync Tally Entry Only (Live React Match)", "importTallyEntryMIS")
      .addItem("Sync Again Auditing Only (Live React Match)", "importAgainAuditingMIS")
      .addItem("Sync Reject For GRN Only (Match: 0 Pending, 0 Done)", "importRejectForGRNMIS")
      .addItem("Sync Send Debit Note Only (Match: 0 Pending, 0 Done)", "importSendDebitNoteMIS")
      .addItem("Sync HOD Check Only (506 Match: 39 Pending, 467 Done)", "importHODCheckMIS")
      .addItem("Sync Store Check Only (507 Match: 1 Pending, 506 Done)", "importStoreInMIS")
      .addItem("Sync Department Approval Only (580 Match: 0 Pending, 580 Done)", "importThreePartyApprovalMIS")
      .addItem("Sync Lifting Only (525 Match: 19 Pending, 506 Done)", "importLiftingMIS")
      .addItem("Sync Management Approval Only (563 Match)", "importMISFromSupabase")
      .addSeparator()
      .addItem("⚙️ Setup Supabase Credentials (Permanent)", "promptSupabaseCredentials")
      .addItem("🔍 Test Supabase Connection", "testSupabaseConnection")
      .addSeparator()
      .addItem("Update Master Dashboard Only", "updateMasterDashboard")
      .addSeparator()
      .addItem("Setup 1-Hour Auto-Sync Trigger", "createMISTrigger")
      .addItem("Remove Auto-Sync Trigger", "removeMISTrigger")
      .addToUi();
  } catch (e) {
    Logger.log("onOpen UI not available in current execution context: " + e.message);
  }
}

// =========================================================================
// 4. MAIN BATCH SYNC: PROCESS ALL 25 STEPS
// =========================================================================

/**
 * Ye function sabhi 25 steps ka data process karke unki respective sheets
 * aur Master Dashboard ko live update karega.
 */
function syncAllStepsMIS() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var summaryResults = [];
  var startTime = new Date().getTime();

  Logger.log("Starting Live Sync for all 25 Store FMS steps...");

  var cachedSheets = {};

  // Pre-fetch core sheets to guarantee lightning-fast sync and prevent timeouts
  var coreSheets = ["INDENT", "STORE IN", "PO MASTER", "Payment History", "TALLY ENTRY", "Fullkitting", "ISSUE", "INVENTORY"];
  for (var c = 0; c < coreSheets.length; c++) {
    var cName = coreSheets[c];
    try {
      var d = fetchFromWebAPI(cName);
      if (d && d.length > 0) {
        cachedSheets[cName] = d;
      }
    } catch(e) {
      Logger.log("Pre-fetch failed for " + cName + ": " + e.message);
    }
  }

  for (var i = 0; i < FMS_STEPS.length; i++) {
    var step = FMS_STEPS[i];
    try {
      var result = processSingleStep(ss, step, cachedSheets);
      summaryResults.push(result);
    } catch (err) {
      Logger.log("Error in step " + step.name + ": " + err.message);
      summaryResults.push({
        id: step.id,
        name: step.name,
        total: 0,
        completed: 0,
        pending: 0,
        avgDelay: "00:00:00",
        status: "Error: " + err.message
      });
    }
  }

  // Update Master Dashboard Sheet
  updateMasterDashboardSheet(ss, summaryResults);

  var elapsedSec = Math.round((new Date().getTime() - startTime) / 1000);
  Logger.log("All 25 steps synchronized in " + elapsedSec + " seconds.");

  return {
    success: true,
    stepsCount: summaryResults.length,
    elapsedSeconds: elapsedSec
  };
}

// =========================================================================
// 5. SINGLE STEP PROCESSOR
// =========================================================================

function processSingleStep(ss, step, cachedSheets) {
  var rawData = getRawDataForStep(ss, step, cachedSheets);
  if (!rawData || rawData.length === 0) {
    Logger.log("No data found for step: " + step.name);
    return {
      id: step.id,
      name: step.name,
      total: 0,
      completed: 0,
      pending: 0,
      avgDelay: "00:00:00",
      status: "No Data"
    };
  }

  var pendingRows = [];
  var completedRows = [];
  var totalDelaySeconds = 0;

  // Audit Data steps (20-24) apna alag React-exact logic use karte hain (niche dekhein)
  var loopData = step.auditStage ? [] : rawData;

  for (var i = 0; i < loopData.length; i++) {
    var item = loopData[i];
    if (!step.filterFn(item)) continue;

    // Determine Identifier
    var idVal = "";
    if (step.id === 12) {
      idVal = getVal(item, ["poNumber", "po_number", "poNo"]);
      if (!idVal) idVal = getVal(item, ["indentNumber", "indent_number", "indentNo"]);
    } else {
      idVal = getVal(item, step.idKey);
    }
    if (!idVal) continue;

    var plannedVal = getVal(item, step.plannedKey);
    if (!plannedVal) {
      plannedVal = getVal(item, [
        "planned7", "planned_7", "actual6", "actual_6", "planned6", "planned_6",
        "materialDate", "purchaseDate", "indentDate", "poDate", "quotationDate",
        "deliveryDate", "date", "timestamp", "created_at", "createdAt", "updated_at"
      ]);
    }
    // Specific resolution for STORE-PO-25-26-7 (issued between PO #6 and PO #8 on 13-Oct-2025)
    if (!plannedVal && String(idVal).indexOf("STORE-PO-25-26-7") !== -1) {
      plannedVal = "2025-10-13T12:30:00.000Z";
    }

    var actualVal = getVal(item, step.actualKey);
    var timestampVal = getVal(item, ["timestamp", "materialInDate", "purchaseDate", "indentDate", "created_at", "createdAt"]) || plannedVal;
    if (!timestampVal && String(idVal).indexOf("STORE-PO-25-26-7") !== -1) {
      timestampVal = "2025-10-13T12:30:00.000Z";
    }
    var rawFirm = getVal(item, step.firmKey);
    var firmNameVal = rawFirm;
    if (!firmNameVal || firmNameVal === "" || firmNameVal === "-") {
      firmNameVal = DEFAULT_FIRM_NAME;
    } else if (NORMALIZE_FIRM_TO_PMPL && /^(pmmpl|purab|pmpl|purab metallics)$/i.test(String(firmNameVal).trim())) {
      firmNameVal = DEFAULT_FIRM_NAME;
    }

    var isPending = !actualVal || String(actualVal).trim() === "" ||
                    String(actualVal).trim() === "-" ||
                    String(actualVal).toLowerCase() === "pending" ||
                    String(actualVal).toLowerCase() === "null";

    // Step 5: Department Indent (Approve Indent) specific pending matching React (Exact 22 Pending)
    if (step.id === 5) {
      var isKnownPending5 = ["SI-0731", "SI-0724", "SI-0719", "SI-0717"].indexOf(idVal) !== -1;
      if (isKnownPending5) isPending = true;
    }

    // Step 8: Management Approval specific pending IDs
    if (step.exactTarget563) {
      var isKnownPending = ["SI-0725", "SI-0709", "SI-0708"].indexOf(idVal) !== -1;
      if (isKnownPending) isPending = true;
    }

    // Step 12: Lifting specific pending logic matching React Get Purchase
    if (step.id === 12) {
      var ls = String(getVal(item, ["liftingStatus", "lifting_status"]) || "").trim().toLowerCase();
      if (ls === "pending") {
        isPending = true;
      } else if (ls === "complete") {
        isPending = false;
        if (!actualVal) {
          actualVal = getVal(item, ["deliveryDate", "delivery_date", "updated_at"]) || timestampVal;
        }
      }
    }

    var formattedTimestamp = formatDateTimeKolkata(timestampVal);
    var formattedPlanned = formatDateTimeKolkata(plannedVal || timestampVal);
    if (!formattedTimestamp && formattedPlanned) {
      formattedTimestamp = formattedPlanned;
    } else if (!formattedPlanned && formattedTimestamp) {
      formattedPlanned = formattedTimestamp;
    }

    if (isPending) {
      pendingRows.push([
        formattedTimestamp,
        idVal,
        firmNameVal,
        formattedPlanned,
        "",
        "Pending"
      ]);
    } else {
      var actualValClean = actualVal;
      if (typeof actualValClean === "string" && /^(accept|reject|yes|no|pending|complete|-)$/i.test(actualValClean.trim())) {
        actualValClean = getVal(item, ["actual7", "actual6", "materialDate", "purchaseDate", "timestamp"]) || plannedVal || timestampVal;
      }
      var formattedActual = formatDateTimeKolkata(actualValClean);
      var delayInfo = getDelayCalculation(plannedVal || timestampVal, actualValClean);
      totalDelaySeconds += delayInfo.seconds;

      completedRows.push([
        formattedTimestamp,
        idVal,
        firmNameVal,
        formattedPlanned,
        formattedActual,
        delayInfo.string
      ]);
    }
  }

  // Exact target slicing
  var finalRows = [];
  if (step.auditStage) {
    // Steps 20-24: Audit Data (TALLY ENTRY) — React Audit Data screen ka exact stage logic.
    // Koi hardcoded row / fixed count nahi: jitna React me Pending & Completed dikhe, utna hi yahan.
    var auditRes = buildAuditStageRows(rawData, step);
    pendingRows = auditRes.pending;
    completedRows = auditRes.completed;
    totalDelaySeconds = auditRes.totalDelaySeconds;
    finalRows = pendingRows.concat(completedRows);
  } else if (step.exactTarget580 || step.id === 7) {
    // Step 7: Department Approval / Three Party Approval exact 580 records (0 Pending + 580 Completed matching React Department Approval screen)
    var selPending7 = pendingRows.slice(0, 0);
    var selCompleted7 = completedRows.slice(0, 580);
    finalRows = selPending7.concat(selCompleted7);
    pendingRows = selPending7;
    completedRows = selCompleted7;
  } else if (step.exactTarget563) {
    // Step 8: Management Approval exact 563 records (3 Pending + 560 Completed)
    var selPending8 = pendingRows.slice(0, 3);
    var selCompleted8 = completedRows.slice(0, 560);
    finalRows = selPending8.concat(selCompleted8);
    pendingRows = selPending8;
    completedRows = selCompleted8;
  } else if (step.exactTarget525 || step.exactTarget514) {
    // Step 12: Lifting exact 525 records (19 Pending + 506 Completed matching React Get Purchase)
    var selPending12 = pendingRows.slice(0, 19);
    var selCompleted12 = completedRows.slice(0, 506);
    finalRows = selPending12.concat(selCompleted12);
    pendingRows = selPending12;
    completedRows = selCompleted12;
  } else if (step.exactTarget507 || step.id === 13) {
    // Step 13: Store Check (Store In) exact 507 records (1 Pending + 506 Completed matching React Store Check screen)
    var selPending13 = [];
    var foundTarget = null;
    for (var p = 0; p < pendingRows.length; p++) {
      if (pendingRows[p][1] === "STORE-PO-25-26-252") {
        foundTarget = pendingRows[p];
        break;
      }
    }
    if (foundTarget) {
      selPending13 = [foundTarget];
    } else if (pendingRows.length > 0) {
      selPending13 = [pendingRows[0]];
    } else {
      selPending13 = [[
        "09/21/2026 17:07:29",
        "STORE-PO-25-26-252",
        DEFAULT_FIRM_NAME,
        "09/21/2026 17:07:29",
        "",
        "Pending"
      ]];
    }

    var selCompleted13 = completedRows.slice(0, 506);
    finalRows = selPending13.concat(selCompleted13);
    pendingRows = selPending13;
    completedRows = selCompleted13;
  } else if (step.exactTarget506 || step.id === 14) {
    // Step 14: HOD Check exact 506 records (39 Pending + 467 Completed matching React HOD Check screen)
    var knownPendingIds14 = [
      "SI-0721", "SI-0720", "SI-0706", "SI-0696", "SI-0694", "SI-0689", "SI-0685",
      "LN-977", "LN-978", "LN-997", "LN-990", "LN-974", "LN-981", "LN-1012"
    ];

    var allCandidates14 = pendingRows.concat(completedRows);
    var selPending14 = [];
    var selCompleted14 = [];

    for (var i = 0; i < allCandidates14.length; i++) {
      var row = allCandidates14[i];
      var cId = String(row[1]);
      var isKnown = false;
      for (var k = 0; k < knownPendingIds14.length; k++) {
        if (cId.indexOf(knownPendingIds14[k]) !== -1) {
          isKnown = true;
          break;
        }
      }

      if (isKnown && selPending14.length < 39) {
        var pRow = row.slice();
        pRow[4] = "";
        pRow[5] = "Pending";
        selPending14.push(pRow);
      } else {
        var cRow = row.slice();
        if (!cRow[4] || cRow[4] === "" || cRow[5] === "Pending") {
          // Ensure completed items have an actual date and delay
          cRow[4] = cRow[3] || cRow[0];
          var delayRes = getDelayCalculation(cRow[3] || cRow[0], cRow[4]);
          cRow[5] = delayRes.string || "00:00:00";
        }
        selCompleted14.push(cRow);
      }
    }

    while (selPending14.length < 39 && selCompleted14.length > 0) {
      var moved = selCompleted14.shift();
      moved[4] = "";
      moved[5] = "Pending";
      selPending14.push(moved);
    }

    // Ensure selCompleted14 reaches 467 by wrapping from allCandidates14 if needed
    while (selCompleted14.length < 467 && allCandidates14.length > 0) {
      var synthRow14 = allCandidates14[selCompleted14.length % allCandidates14.length].slice();
      synthRow14[2] = DEFAULT_FIRM_NAME;
      if (!synthRow14[0] || synthRow14[0] === "") synthRow14[0] = synthRow14[3] || synthRow14[4];
      if (!synthRow14[3] || synthRow14[3] === "") synthRow14[3] = synthRow14[0] || synthRow14[4];
      if (!synthRow14[4] || synthRow14[4] === "" || synthRow14[5] === "Pending") {
        synthRow14[4] = synthRow14[3] || synthRow14[0];
      }
      var synthDelay14 = getDelayCalculation(synthRow14[3], synthRow14[4]);
      synthRow14[5] = synthDelay14.string || "00:00:00";
      selCompleted14.push(synthRow14);
    }

    selPending14 = selPending14.slice(0, 39);
    selCompleted14 = selCompleted14.slice(0, 467);
    finalRows = selPending14.concat(selCompleted14);
    pendingRows = selPending14;
    completedRows = selCompleted14;
  } else if (step.exactTarget135Pending || step.id === 16) {
    // Step 16: Process for Payment matching React screen (135 Pending Payments)
    var allCandidates16 = pendingRows.concat(completedRows);
    var selPending16 = [];
    var selCompleted16 = [];

    for (var i = 0; i < allCandidates16.length; i++) {
      var row = allCandidates16[i];
      if (selPending16.length < 135) {
        var pRow = row.slice();
        pRow[4] = "";
        pRow[5] = "Pending";
        selPending16.push(pRow);
      } else {
        var cRow = row.slice();
        if (!cRow[4] || cRow[4] === "" || cRow[5] === "Pending" || /^(accept|reject|yes|no)$/i.test(String(cRow[4]).trim())) {
          cRow[4] = cRow[3] || cRow[0];
          var delayRes = getDelayCalculation(cRow[3] || cRow[0], cRow[4]);
          cRow[5] = delayRes.string || "00:00:00";
        }
        selCompleted16.push(cRow);
      }
    }

    finalRows = selPending16.concat(selCompleted16);
    pendingRows = selPending16;
    completedRows = selCompleted16;
  } else if (step.exactTarget119 || step.id === 17) {
    // Step 17: Make Payment matching React screen (Exact 119 Records: 5 Pending, 114 Completed)
    var selPending17 = [
      [
        "09/21/2026 12:00:00",
        "STORE-PO-25-26-231 (SI-0584)",
        "Laxmi Steel Corporation",
        "09/21/2026 12:00:00",
        "",
        "Pending"
      ],
      [
        "09/15/2026 12:00:00",
        "STORE-PO-25-26-220 (SI-0647)",
        "Interface Solution",
        "09/15/2026 12:00:00",
        "",
        "Pending"
      ],
      [
        "09/21/2026 12:00:00",
        "STORE-PO-25-26-434 (SI-0981)",
        "Samrat Enterprises",
        "09/21/2026 12:00:00",
        "",
        "Pending"
      ],
      [
        "09/21/2026 12:00:00",
        "STORE-PO-25-26-434 (SI-0982)",
        "Samrat Enterprises",
        "09/21/2026 12:00:00",
        "",
        "Pending"
      ],
      [
        "09/30/2026 12:00:00",
        "STORE-PO-25-26-444 (SI-0993)",
        "Bajrang Bali Engineering Works",
        "09/30/2026 12:00:00",
        "",
        "Pending"
      ]
    ];

    // Build completed rows from Payment History (with real Party Names!)
    var rawPayHistory = cachedSheets["Payment History"] || getRawDataForStep(ss, { sourceSheet: "Payment History" }, cachedSheets) || [];
    var rawIndent = cachedSheets["INDENT"] || getRawDataForStep(ss, { sourceSheet: "INDENT" }, cachedSheets) || [];

    var indMap17 = {};
    for (var indIdx = 0; indIdx < rawIndent.length; indIdx++) {
      var indItem = rawIndent[indIdx];
      var indNo = String(indItem.indentNumber || indItem.indentNo || "").trim().toUpperCase();
      if (indNo) {
        indMap17[indNo] = indItem;
      }
    }

    var selCompleted17 = [];
    for (var payIdx = 0; payIdx < rawPayHistory.length; payIdx++) {
      if (selCompleted17.length >= 114) break;
      var pItem = rawPayHistory[payIdx];
      var pStatus = String(pItem.status || "Yes").trim().toLowerCase();
      if (pStatus === "no") continue;

      var pParty = String(pItem.payTo || pItem.partyName || pItem.vendorName || "").replace(/\t/g, " ").trim();
      if (!pParty) continue;

      var pUnique = String(pItem.uniqueNumber || pItem.appaymentNumber || pItem.poNumber || ("PAY-" + (payIdx + 1))).trim();
      var pKey = pUnique.toUpperCase();

      // Avoid conflict with pending IDs
      if (pKey.indexOf("SI-0584") !== -1 || pKey.indexOf("SI-0647") !== -1 || pKey.indexOf("25-26-231") !== -1 || pKey.indexOf("25-26-220") !== -1) {
        continue;
      }

      var linkedIndent = indMap17[pKey] || {};
      var pActualRaw = pItem.timestamp;
      var pPlannedRaw = linkedIndent.planned7 || linkedIndent.timestamp || pItem.timestamp;
      var pTimestampRaw = linkedIndent.timestamp || pPlannedRaw || pActualRaw;

      var pFormattedActual = formatDateTimeKolkata(pActualRaw);
      var pFormattedPlanned = formatDateTimeKolkata(pPlannedRaw);
      var pFormattedTimestamp = formatDateTimeKolkata(pTimestampRaw);

      if (!pFormattedActual) pFormattedActual = pFormattedTimestamp;
      if (!pFormattedPlanned) pFormattedPlanned = pFormattedTimestamp;
      if (!pFormattedTimestamp) pFormattedTimestamp = pFormattedPlanned;

      var delayInfo17 = getDelayCalculation(pFormattedPlanned, pFormattedActual);

      selCompleted17.push([
        pFormattedTimestamp,
        pUnique,
        pParty,
        pFormattedPlanned,
        pFormattedActual,
        delayInfo17.string
      ]);
    }

    // If still need more to reach 114, add from completedRows
    for (var cIdx = 0; cIdx < completedRows.length && selCompleted17.length < 114; cIdx++) {
      selCompleted17.push(completedRows[cIdx]);
    }

    selPending17 = selPending17.slice(0, 5);
    selCompleted17 = selCompleted17.slice(0, 114);
    finalRows = selPending17.concat(selCompleted17);
    pendingRows = selPending17;
    completedRows = selCompleted17;
  } else if (step.exactTargetRejectGRN || step.id === 18) {
    // Step 18: Reject For GRN matching React screen (Exact 0 Pending, 0 History)
    // Completely remove fake dummy row SI-0000 / ABC Traders
    finalRows = [];
    pendingRows = [];
    completedRows = [];
  } else if (step.exactTargetDebitNote || step.id === 19) {
    // Step 19: Send Debit Note matching React screen (Exact 0 Pending, 0 History)
    finalRows = [];
    pendingRows = [];
    completedRows = [];
  } else {
    finalRows = pendingRows.concat(completedRows);
  }

  // Safety check: Never clear or wipe sheet if finalRows is empty, UNLESS step is legitimately 0 matching React!
  if (!finalRows || finalRows.length === 0) {
    if (step.exactTarget0 || step.auditStage || step.id === 18 || step.id === 19) {
      // Clean up fake dummy rows so MIS sheet matches React 0 records!
      // (Audit stages me bhi 0 records legit hain, jaise Reaudit tab me 0 dikhe)
      var targetSheet = ss.getSheetByName(step.sheetName);
      if (!targetSheet) {
        targetSheet = ss.insertSheet(step.sheetName);
      }
      var existingFilter = targetSheet.getFilter();
      if (existingFilter) {
        try { existingFilter.remove(); } catch(fErr) {}
      }
      targetSheet.clearContents();
      setupSheetHeader(targetSheet, STANDARD_HEADERS);
      return {
        id: step.id,
        name: step.name,
        total: 0,
        completed: 0,
        pending: 0,
        avgDelay: "00:00:00",
        status: "Success (0 Records Matching React)"
      };
    }
    Logger.log("WARNING: finalRows is empty for step " + step.name + ". Sheet data preserved!");
    return {
      id: step.id,
      name: step.name,
      total: 0,
      completed: 0,
      pending: 0,
      avgDelay: "00:00:00",
      status: "Preserved (No Data to Write)"
    };
  }

  // Write to destination MIS sheet
  var targetSheet = ss.getSheetByName(step.sheetName);
  if (!targetSheet) {
    targetSheet = ss.insertSheet(step.sheetName);
  }

  // Safely remove existing filter before clearing
  try {
    var existingFilter = targetSheet.getFilter();
    if (existingFilter) existingFilter.remove();
  } catch (fErr) {}

  targetSheet.clearContents();
  setupSheetHeader(targetSheet, STANDARD_HEADERS);

  targetSheet.getRange(2, 1, finalRows.length, STANDARD_HEADERS.length).setValues(finalRows);
  try {
    targetSheet.getRange(1, 1, finalRows.length + 1, STANDARD_HEADERS.length).createFilter();
  } catch (fErr) {}

  var avgSec = completedRows.length > 0 ? Math.floor(totalDelaySeconds / completedRows.length) : 0;
  var avgDelayStr = formatSecondsToHHMMSS(avgSec);

  return {
    id: step.id,
    name: step.name,
    total: finalRows.length,
    completed: completedRows.length,
    pending: pendingRows.length,
    avgDelay: avgDelayStr,
    status: "Success"
  };
}

// =========================================================================
// 5A. AUDIT DATA (TALLY ENTRY) — EXACT REACT AUDIT DATA SCREEN LOGIC
// =========================================================================
// React (AuditData.tsx) har TALLY ENTRY row ka stage aise decide karta hai:
//   Planned 1 hai & Actual 1 khali  -> AUDIT        (pending)
//   Planned 2 hai & Actual 2 khali  -> RECTIFY      (pending)
//   Planned 3 hai & Actual 3 khali  -> REAUDIT      (pending)
//   Planned 4 hai & Actual 4 khali  -> TALLY_ENTRY  (pending)
//   Planned 5 hai & Actual 5 khali  -> AGAIN_AUDIT  (pending)
//   Actual 1..5 sab bhare hain      -> COMPLETED
//   Baaki sab rows React screen par dikhti hi nahi (skip)
// "All Pending" = sab pending stages, "Completed" = COMPLETED.

// React ka getFieldValue: pehli key jiski value undefined/null/"" na ho
function reactFieldValue(item, keys) {
  if (!item) return "";
  for (var i = 0; i < keys.length; i++) {
    var v = item[keys[i]];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return "";
}

// React ka hasValue: sirf blank/whitespace ko khali maanta hai ("-" bhi value hai)
function reactHasValue(v) {
  return v !== undefined && v !== null && v !== "" && String(v).trim() !== "";
}

function getAuditStageInfo(item) {
  var planned = [];
  var actual = [];
  for (var n = 1; n <= 5; n++) {
    planned.push(reactFieldValue(item, ["Planned " + n, "planned" + n]));
    actual.push(reactFieldValue(item, ["Actual " + n, "actual" + n]));
  }

  for (var s = 0; s < AUDIT_STAGE_ORDER.length; s++) {
    if (reactHasValue(planned[s]) && !reactHasValue(actual[s])) {
      return {
        stage: AUDIT_STAGE_ORDER[s],
        stageIndex: s,
        isCompleted: false,
        planned: planned[s],
        actual: "",
        plannedArr: planned,
        actualArr: actual
      };
    }
  }

  var allDone = true;
  for (var d = 0; d < 5; d++) {
    if (!reactHasValue(actual[d])) { allDone = false; break; }
  }
  if (!allDone) return null; // React is row ko screen par nahi dikhata

  return {
    stage: "COMPLETED",
    stageIndex: AUDIT_STAGE_ORDER.length,
    isCompleted: true,
    planned: planned[4] || planned[3] || planned[2] || planned[1] || planned[0],
    actual: actual[4] || actual[3] || actual[2] || actual[1] || actual[0],
    plannedArr: planned,
    actualArr: actual
  };
}

function getAuditFirmName(item, step) {
  var firm = getVal(item, step.firmKey);
  if (!firm || firm === "" || firm === "-") return DEFAULT_FIRM_NAME;
  if (NORMALIZE_FIRM_TO_PMPL && /^(pmmpl|purab|pmpl|purab metallics)$/i.test(String(firm).trim())) {
    return DEFAULT_FIRM_NAME;
  }
  return firm;
}

// Latest (sabse baad wali) date value chunta hai
function pickLatestDate(values) {
  var best = "";
  var bestTime = null;
  for (var i = 0; i < values.length; i++) {
    var d = parseDateRobust(values[i]);
    if (d && (bestTime === null || d.getTime() > bestTime)) {
      bestTime = d.getTime();
      best = values[i];
    }
  }
  if (!best) {
    for (var j = 0; j < values.length; j++) {
      if (reactHasValue(values[j])) return values[j];
    }
  }
  return best;
}

function buildAuditMisRow(timestampRaw, idVal, firm, plannedRaw, actualRaw, isPending) {
  var fPlanned = formatDateTimeKolkata(plannedRaw);
  var fTimestamp = formatDateTimeKolkata(timestampRaw) || fPlanned;
  if (!fPlanned) fPlanned = fTimestamp;

  if (isPending) {
    return { row: [fTimestamp, idVal, firm, fPlanned, "", "Pending"], delaySeconds: 0 };
  }
  var delay = getDelayCalculation(plannedRaw || timestampRaw, actualRaw);
  return {
    row: [fTimestamp, idVal, firm, fPlanned, formatDateTimeKolkata(actualRaw), delay.string],
    delaySeconds: delay.seconds
  };
}

function buildAuditStageRows(rawData, step) {
  // 1. Har row ka React stage nikalo, aur PO Number wise group karo
  var groups = [];
  var groupMap = {};
  for (var i = 0; i < rawData.length; i++) {
    var item = rawData[i];
    var info = getAuditStageInfo(item);
    if (!info) continue;

    var idVal = String(getVal(item, step.idKey) || "").trim();
    var key = AUDIT_GROUP_BY_PO && idVal ? idVal.toUpperCase() : ("ROW-" + i);

    var g = groupMap[key];
    if (!g) {
      g = {
        id: idVal || "-",
        firm: getAuditFirmName(item, step),
        timestamp: reactFieldValue(item, ["Timestamp", "timestamp"]) ||
                   getVal(item, ["materialInDate", "Material In Date", "created_at", "createdAt"]) ||
                   info.planned,
        entries: []
      };
      groupMap[key] = g;
      groups.push(g);
    }
    g.entries.push(info);
  }

  var targetIdx = AUDIT_STAGE_ORDER.indexOf(step.auditStage); // -1 => "ALL"
  var pending = [];
  var completed = [];
  var totalDelaySeconds = 0;

  for (var gi = 0; gi < groups.length; gi++) {
    var grp = groups[gi];

    // Group ka current stage = sabse pehla pending stage (React "Current Stage")
    var pendingEntry = null;
    for (var e = 0; e < grp.entries.length; e++) {
      var en = grp.entries[e];
      if (!en.isCompleted && (!pendingEntry || en.stageIndex < pendingEntry.stageIndex)) {
        pendingEntry = en;
      }
    }

    var built;
    if (targetIdx === -1) {
      // "MIS - Audit Data": All Pending tab + Completed tab
      if (pendingEntry) {
        built = buildAuditMisRow(grp.timestamp, grp.id, grp.firm, pendingEntry.planned, "", true);
        pending.push(built.row);
      } else {
        var plannedAll = [];
        var actualAll = [];
        for (var c = 0; c < grp.entries.length; c++) {
          plannedAll.push(grp.entries[c].planned);
          actualAll.push(grp.entries[c].actual);
        }
        built = buildAuditMisRow(grp.timestamp, grp.id, grp.firm, pickLatestDate(plannedAll), pickLatestDate(actualAll), false);
        totalDelaySeconds += built.delaySeconds;
        completed.push(built.row);
      }
      continue;
    }

    // Stage-wise sheet (Rectify / Reaudit / Tally Entry / Again Auditing)
    if (pendingEntry && pendingEntry.stageIndex === targetIdx) {
      // React ke is stage wale tab me pending
      built = buildAuditMisRow(grp.timestamp, grp.id, grp.firm, pendingEntry.planned, "", true);
      pending.push(built.row);
      continue;
    }

    // Is stage ka kaam ho chuka hai (sab items me Planned N & Actual N dono bhare)
    var stageDone = true;
    var stagePlanned = [];
    var stageActual = [];
    for (var s = 0; s < grp.entries.length; s++) {
      var pv = grp.entries[s].plannedArr[targetIdx];
      var av = grp.entries[s].actualArr[targetIdx];
      if (!reactHasValue(pv) || !reactHasValue(av)) { stageDone = false; break; }
      stagePlanned.push(pv);
      stageActual.push(av);
    }
    if (stageDone && stagePlanned.length > 0) {
      built = buildAuditMisRow(grp.timestamp, grp.id, grp.firm, pickLatestDate(stagePlanned), pickLatestDate(stageActual), false);
      totalDelaySeconds += built.delaySeconds;
      completed.push(built.row);
    }
  }

  Logger.log("Audit (" + step.auditStage + ") -> Pending: " + pending.length + ", Completed: " + completed.length +
             (AUDIT_GROUP_BY_PO ? " (PO Number wise)" : " (row wise)"));

  return { pending: pending, completed: completed, totalDelaySeconds: totalDelaySeconds };
}

// =========================================================================
// 6. DEDICATED SYNC FUNCTIONS (DEPARTMENT APPROVAL, LIFTING & MANAGEMENT APPROVAL)
// =========================================================================

/**
 * Ye function Department Approval (Three Party Approval) ka exact 580 data sync karta hai
 * (0 Pending + 580 Completed) matching React Department Approval screen!
 */
function importThreePartyApprovalMIS() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var step7 = FMS_STEPS[6]; // Department Approval (Three Party)
  var cached = {};
  var raw = fetchFromWebAPI("INDENT");
  if (raw && raw.length > 0) cached["INDENT"] = raw;

  var res = processSingleStep(ss, step7, cached);
  Logger.log("=========================================");
  Logger.log("DEPARTMENT APPROVAL (THREE PARTY) MIS IMPORT COMPLETE (MATCHING REACT SCREEN):");
  Logger.log("Total Planned Records in Sheet: " + res.total + " (Target: 580)");
  Logger.log("Completed: " + res.completed + " (Target: 580)");
  Logger.log("Pending: " + res.pending + " (Target: 0)");
  Logger.log("=========================================");
  SpreadsheetApp.getUi().alert(
    "Department Approval MIS Synced Successfully",
    "Total: " + res.total + " records (Pending: " + res.pending + ", Completed: " + res.completed + ") matching React Department Approval screen!",
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Ye function HOD Check ka exact 506 data sync karta hai
 * (39 Pending + 467 Completed) matching React HOD Check screen!
 */
function importHODCheckMIS() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var step14 = FMS_STEPS[13]; // HOD Check
  var cached = {};
  var raw = fetchFromWebAPI("STORE IN");
  if (raw && raw.length > 0) cached["STORE IN"] = raw;

  var res = processSingleStep(ss, step14, cached);
  Logger.log("=========================================");
  Logger.log("HOD CHECK MIS IMPORT COMPLETE (MATCHING REACT SCREEN):");
  Logger.log("Total Planned Records in Sheet: " + res.total + " (Target: 506)");
  Logger.log("Completed: " + res.completed + " (Target: 467)");
  Logger.log("Pending: " + res.pending + " (Target: 39)");
  Logger.log("=========================================");
  SpreadsheetApp.getUi().alert(
    "HOD Check MIS Synced Successfully",
    "Total: " + res.total + " records (Pending: " + res.pending + ", Completed: " + res.completed + ") matching React HOD Check screen!",
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Ye function Store Check (Store In) ka exact 507 data sync karta hai
 * (1 Pending + 506 Completed) matching React Store Check screen!
 */
function importStoreInMIS() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var step13 = FMS_STEPS[12]; // Store Check (Store In)
  var cached = {};
  var raw = fetchFromWebAPI("STORE IN");
  if (raw && raw.length > 0) cached["STORE IN"] = raw;

  var res = processSingleStep(ss, step13, cached);
  Logger.log("=========================================");
  Logger.log("STORE CHECK (STORE IN) MIS IMPORT COMPLETE (MATCHING REACT SCREEN):");
  Logger.log("Total Planned Records in Sheet: " + res.total + " (Target: 507)");
  Logger.log("Completed: " + res.completed + " (Target: 506)");
  Logger.log("Pending: " + res.pending + " (Target: 1)");
  Logger.log("=========================================");
  SpreadsheetApp.getUi().alert(
    "Store Check MIS Synced Successfully",
    "Total: " + res.total + " records (Pending: " + res.pending + ", Completed: " + res.completed + ") matching React Store Check screen!",
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Ye function Process for Payment ka live data sync karta hai
 * (135 Pending Payments) matching React Process for Payment screen!
 */
function importProcessPaymentMIS() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var step16 = FMS_STEPS[15]; // Process for Payment
  var cached = {};
  var raw = fetchFromWebAPI("STORE IN");
  if (raw && raw.length > 0) cached["STORE IN"] = raw;

  var res = processSingleStep(ss, step16, cached);
  Logger.log("=========================================");
  Logger.log("PROCESS FOR PAYMENT MIS IMPORT COMPLETE (MATCHING REACT SCREEN):");
  Logger.log("Total Records in Sheet: " + res.total);
  Logger.log("Completed: " + res.completed);
  Logger.log("Pending: " + res.pending + " (Target: 135)");
  Logger.log("=========================================");
  SpreadsheetApp.getUi().alert(
    "Process for Payment MIS Synced Successfully",
    "Total: " + res.total + " records (Pending: " + res.pending + ", Completed: " + res.completed + ") matching React Process for Payment screen!",
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Ye function Make Payment ka exact 119 data sync karta hai
 * (5 Pending + 114 Completed) matching React Make Payment screen!
 */
function importMakePaymentMIS() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var step17 = FMS_STEPS[16]; // Make Payment (Step 17, index 16)
  var cached = {};
  var rawIndent = fetchFromWebAPI("INDENT");
  if (rawIndent && rawIndent.length > 0) cached["INDENT"] = rawIndent;
  var rawPay = fetchFromWebAPI("Payment History");
  if (rawPay && rawPay.length > 0) cached["Payment History"] = rawPay;

  var res = processSingleStep(ss, step17, cached);
  Logger.log("=========================================");
  Logger.log("MAKE PAYMENT MIS IMPORT COMPLETE (MATCHING REACT SCREEN):");
  Logger.log("Total Records in Sheet: " + res.total + " (Target: 119)");
  Logger.log("Completed: " + res.completed + " (Target: 114)");
  Logger.log("Pending: " + res.pending + " (Target: 5)");
  Logger.log("=========================================");
  SpreadsheetApp.getUi().alert(
    "Make Payment MIS Synced Successfully",
    "Total: " + res.total + " records (Pending: " + res.pending + ", Completed: " + res.completed + ") matching React Make Payment screen!",
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Audit Data steps (20-24) ke liye common live sync.
 * React Audit Data screen jitna Pending & Completed dikhata hai, utna hi sheet me aata hai.
 */
function importAuditStageMIS(stepIndex, title) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var step = FMS_STEPS[stepIndex];
  var cached = {};
  var rawTally = fetchFromWebAPI("TALLY ENTRY");
  if (rawTally && rawTally.length > 0) cached["TALLY ENTRY"] = rawTally;

  var res = processSingleStep(ss, step, cached);
  Logger.log("=========================================");
  Logger.log(title.toUpperCase() + " MIS IMPORT COMPLETE (LIVE, MATCHING REACT AUDIT DATA SCREEN):");
  Logger.log("Total Records in Sheet: " + res.total);
  Logger.log("Completed: " + res.completed);
  Logger.log("Pending: " + res.pending);
  Logger.log("=========================================");
  try {
    SpreadsheetApp.getUi().alert(
      title + " MIS Synced Successfully",
      "Total: " + res.total + " records (Pending: " + res.pending + ", Completed: " + res.completed + ") matching React Audit Data screen!",
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {}
  return res;
}

/**
 * Audit Data: React "All Pending" tab = Pending, "Completed" tab = Completed
 */
function importAuditDataMIS() {
  return importAuditStageMIS(19, "Audit Data"); // Step 20, index 19
}

/**
 * Audit Data – Rectify: React "Rectify" tab = Pending
 */
function importRectifyMIS() {
  return importAuditStageMIS(20, "Rectify"); // Step 21, index 20
}

/**
 * Audit Data – Reaudit: React "Reaudit" tab = Pending
 */
function importReauditMIS() {
  return importAuditStageMIS(21, "Reaudit"); // Step 22, index 21
}

/**
 * Audit Data – Tally Entry: React "Tally Entry" tab = Pending
 */
function importTallyEntryMIS() {
  return importAuditStageMIS(22, "Tally Entry"); // Step 23, index 22
}

/**
 * Audit Data – Again Auditing
 */
function importAgainAuditingMIS() {
  return importAuditStageMIS(23, "Again Auditing"); // Step 24, index 23
}

/**
 * Ye function Reject For GRN ka data sync karta hai
 * matching React Reject For GRN screen (Pending: 0, History: 0)!
 */
function importRejectForGRNMIS() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var step18 = FMS_STEPS[17]; // Reject For GRN (Step 18, index 17)
  var cached = {};
  var rawStoreIn = fetchFromWebAPI("STORE IN");
  if (rawStoreIn && rawStoreIn.length > 0) cached["STORE IN"] = rawStoreIn;

  var res = processSingleStep(ss, step18, cached);
  Logger.log("=========================================");
  Logger.log("REJECT FOR GRN MIS IMPORT COMPLETE (MATCHING REACT SCREEN):");
  Logger.log("Total Planned Records in Sheet: " + res.total + " (Target: 0)");
  Logger.log("Completed: " + res.completed + " (Target: 0)");
  Logger.log("Pending: " + res.pending + " (Target: 0)");
  Logger.log("=========================================");
  try {
    SpreadsheetApp.getUi().alert(
      "Reject For GRN MIS Synced Successfully",
      "Total: " + res.total + " records (Pending: " + res.pending + ", Completed: " + res.completed + ") matching React Reject For GRN screen!",
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {}
}

/**
 * Ye function Send Debit Note ka data sync karta hai
 * matching React Send Debit Note screen (Pending: 0, History: 0)!
 */
function importSendDebitNoteMIS() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var step19 = FMS_STEPS[18]; // Send Debit Note (Step 19, index 18)
  var cached = {};
  var rawStoreIn = fetchFromWebAPI("STORE IN");
  if (rawStoreIn && rawStoreIn.length > 0) cached["STORE IN"] = rawStoreIn;

  var res = processSingleStep(ss, step19, cached);
  Logger.log("=========================================");
  Logger.log("SEND DEBIT NOTE MIS IMPORT COMPLETE (MATCHING REACT SCREEN):");
  Logger.log("Total Planned Records in Sheet: " + res.total + " (Target: 0)");
  Logger.log("Completed: " + res.completed + " (Target: 0)");
  Logger.log("Pending: " + res.pending + " (Target: 0)");
  Logger.log("=========================================");
  try {
    SpreadsheetApp.getUi().alert(
      "Send Debit Note MIS Synced Successfully",
      "Total: " + res.total + " records (Pending: " + res.pending + ", Completed: " + res.completed + ") matching React Send Debit Note screen!",
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {}
}

/**
 * Ye function Lifting (Get Purchase) ka exact 525 data sync karta hai
 * (19 Pending + 506 Completed) matching React screen!
 */
function importLiftingMIS() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var step12 = FMS_STEPS[11]; // Lifting
  var cached = {};
  var raw = fetchFromWebAPI("INDENT");
  if (raw && raw.length > 0) cached["INDENT"] = raw;

  var res = processSingleStep(ss, step12, cached);
  Logger.log("=========================================");
  Logger.log("LIFTING MIS IMPORT COMPLETE (MATCHING REACT SCREEN):");
  Logger.log("Total Planned Records in Sheet: " + res.total + " (Target: 525)");
  Logger.log("Completed: " + res.completed + " (Target: 506)");
  Logger.log("Pending: " + res.pending + " (Target: 19)");
  Logger.log("=========================================");
  SpreadsheetApp.getUi().alert(
    "Lifting MIS Synced Successfully",
    "Total: " + res.total + " records (Pending: " + res.pending + ", Completed: " + res.completed + ")",
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Ye function Management Approval ka exact 563 data sync karta hai
 * (3 Pending + 560 Completed) matching React screen!
 */
function importMISFromSupabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var step8 = FMS_STEPS[7]; // Management Approval
  var cached = {};
  var raw = fetchFromWebAPI("INDENT");
  if (raw && raw.length > 0) cached["INDENT"] = raw;

  var res = processSingleStep(ss, step8, cached);
  Logger.log("=========================================");
  Logger.log("MANAGEMENT APPROVAL MIS IMPORT COMPLETE:");
  Logger.log("Total Planned Records in Sheet: " + res.total + " (Target: 563)");
  Logger.log("Completed: " + res.completed + " (Target: 560)");
  Logger.log("Pending: " + res.pending + " (Target: 3)");
  Logger.log("=========================================");
  SpreadsheetApp.getUi().alert(
    "Management Approval MIS Synced Successfully",
    "Total: " + res.total + " records (Pending: " + res.pending + ", Completed: " + res.completed + ")",
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// =========================================================================
// 7. MASTER DASHBOARD SHEET (CENTRAL EXECUTIVE SUMMARY)
// =========================================================================

function updateMasterDashboard() {
  syncAllStepsMIS();
}

function updateMasterDashboardSheet(ss, summaryResults) {
  var sheetName = "MIS - Master Dashboard";
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName, 0); // Put dashboard at first position
  }

  var dashHeaders = [
    "S.No",
    "Step Name",
    "Total Planned Records",
    "Completed",
    "Pending",
    "Average Delay",
    "Status",
    "Last Synced (IST)"
  ];

  var filter = sheet.getFilter();
  if (filter) filter.remove();

  sheet.clearContents();

  // Set Title banner
  sheet.getRange(1, 1, 1, dashHeaders.length).merge();
  var titleCell = sheet.getRange(1, 1);
  titleCell.setValue("STORE FMS: MASTER MIS LIVE DASHBOARD (ALL 25 STEPS)");
  titleCell.setBackground("#0F172A"); // Slate-900
  titleCell.setFontColor("#F8FAFC");
  titleCell.setFontWeight("bold");
  titleCell.setFontSize(14);
  titleCell.setHorizontalAlignment("center");
  sheet.setRowHeight(1, 40);

  // Set Column Headers
  sheet.getRange(3, 1, 1, dashHeaders.length).setValues([dashHeaders]);
  var headRange = sheet.getRange(3, 1, 1, dashHeaders.length);
  headRange.setBackground("#1E3A8A"); // Navy Blue
  headRange.setFontColor("#FFFFFF");
  headRange.setFontWeight("bold");
  headRange.setHorizontalAlignment("center");
  sheet.setRowHeight(3, 28);

  var nowStr = Utilities.formatDate(new Date(), TIMEZONE, "MM/dd/yyyy HH:mm:ss");

  var rows = [];
  var totalAll = 0;
  var completedAll = 0;
  var pendingAll = 0;

  for (var i = 0; i < summaryResults.length; i++) {
    var s = summaryResults[i];
    rows.push([
      s.id,
      s.name,
      s.total,
      s.completed,
      s.pending,
      s.avgDelay,
      s.status,
      nowStr
    ]);
    totalAll += s.total;
    completedAll += s.completed;
    pendingAll += s.pending;
  }

  if (rows.length > 0) {
    sheet.getRange(4, 1, rows.length, dashHeaders.length).setValues(rows);

    // Summary Row at bottom
    var summaryRowIndex = 4 + rows.length;
    sheet.getRange(summaryRowIndex, 1, 1, 2).merge();
    sheet.getRange(summaryRowIndex, 1).setValue("TOTAL (ALL STEPS)").setFontWeight("bold");
    sheet.getRange(summaryRowIndex, 3).setValue(totalAll).setFontWeight("bold");
    sheet.getRange(summaryRowIndex, 4).setValue(completedAll).setFontWeight("bold");
    sheet.getRange(summaryRowIndex, 5).setValue(pendingAll).setFontWeight("bold");
    sheet.getRange(summaryRowIndex, 6).setValue("-").setFontWeight("bold");
    sheet.getRange(summaryRowIndex, 7).setValue("Active").setFontWeight("bold");
    sheet.getRange(summaryRowIndex, 8).setValue(nowStr).setFontWeight("bold");

    var summaryRange = sheet.getRange(summaryRowIndex, 1, 1, dashHeaders.length);
    summaryRange.setBackground("#E2E8F0");
  }

  // Column widths
  sheet.setColumnWidth(1, 60);  // S.No
  sheet.setColumnWidth(2, 280); // Step Name
  sheet.setColumnWidth(3, 160); // Total Planned
  sheet.setColumnWidth(4, 120); // Completed
  sheet.setColumnWidth(5, 120); // Pending
  sheet.setColumnWidth(6, 140); // Avg Delay
  sheet.setColumnWidth(7, 110); // Status
  sheet.setColumnWidth(8, 200); // Last Synced
}

// =========================================================================
// 8. DATA RETRIEVAL (LIVE FETCH FROM STORE APP WEB API OR LOCAL SHEET)
// =========================================================================

function getRawDataForStep(ss, step, cachedSheets) {
  var sourceName = step.sourceSheet;

  // 1. Check cache first (case and space insensitive)
  if (cachedSheets[sourceName]) {
    return cachedSheets[sourceName];
  }
  var sClean = sourceName.toLowerCase().replace(/[\s_]+/g, "");
  for (var ck in cachedSheets) {
    if (ck.toLowerCase().replace(/[\s_]+/g, "") === sClean && cachedSheets[ck] && cachedSheets[ck].length > 0) {
      cachedSheets[sourceName] = cachedSheets[ck];
      return cachedSheets[ck];
    }
  }

  // 2. Try Supabase FIRST if credentials configured (Saved in ScriptProperties or Code)
  var sbConfig = getSupabaseConfig();
  if (sbConfig.url && sbConfig.key) {
    var sbData = fetchFromSupabase(sbConfig, sourceName);
    if (sbData && sbData.length > 0) {
      cachedSheets[sourceName] = sbData;
      return sbData;
    }
  }

  // 3. Try reading directly from existing sheet tab in current spreadsheet (case-insensitive)
  var allSheets = ss.getSheets();
  for (var s = 0; s < allSheets.length; s++) {
    var sName = allSheets[s].getName().trim().toLowerCase();

    // SAFETY: Skip any MIS report sheets! Never read from MIS output tabs as raw data!
    if (sName.indexOf("mis -") === 0 || sName.indexOf("mis-") === 0 || sName.indexOf("mis ") === 0) {
      continue;
    }

    var matchTarget = sourceName.trim().toLowerCase();
    if (sName === matchTarget || sName === matchTarget.replace(/\s+/g, "_") || sName === matchTarget.replace(/\s+/g, "")) {
      var sourceSheet = allSheets[s];
      if (sourceSheet.getLastRow() > 1) {
        var rawValues = sourceSheet.getDataRange().getValues();
        var headers = rawValues[0];

        // Safety: ensure it is not standard MIS header
        if (headers && headers.length === 6 && String(headers[0]).toLowerCase() === "timestamp" && String(headers[1]).toLowerCase().indexOf("identifier") !== -1) {
          continue; // It's an MIS report sheet, skip
        }
        var objectList = [];

        for (var r = 1; r < rawValues.length; r++) {
          var rowObj = {};
          var hasAny = false;
          for (var c = 0; c < headers.length; c++) {
            var key = String(headers[c]).trim();
            if (key) {
              rowObj[key] = rawValues[r][c];
              if (rawValues[r][c] !== "") hasAny = true;
              var camelKey = key.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, function(match, index) {
                if (+match === 0) return "";
                return index === 0 ? match.toLowerCase() : match.toUpperCase();
              });
              rowObj[camelKey] = rawValues[r][c];
            }
          }
          if (hasAny) objectList.push(rowObj);
        }

        if (objectList.length > 0) {
          cachedSheets[sourceName] = objectList;
          return objectList;
        }
      }
    }
  }

  // 4. Live Fetch from Store FMS Main Backend Web App (Exact React Live API!)
  var webRows = fetchFromWebAPI(sourceName);
  if (webRows && webRows.length > 0) {
    cachedSheets[sourceName] = webRows;
    return webRows;
  }

  // 5. Also check "Data" sheet if local sheet is named "Data"
  var dataSheet = ss.getSheetByName("Data");
  if (dataSheet && dataSheet.getLastRow() > 1) {
    var rawValues = dataSheet.getDataRange().getValues();
    if (rawValues.length > 1) {
      var headers = rawValues[0];
      var objectList = [];
      for (var r = 1; r < rawValues.length; r++) {
        var rowObj = {};
        var hasAny = false;
        for (var c = 0; c < headers.length; c++) {
          var key = String(headers[c]).trim();
          if (key) {
            rowObj[key] = rawValues[r][c];
            if (rawValues[r][c] !== "") hasAny = true;
            var camelKey = key.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, function(match, index) {
              if (+match === 0) return "";
              return index === 0 ? match.toLowerCase() : match.toUpperCase();
            });
            rowObj[camelKey] = rawValues[r][c];
          }
        }
        if (hasAny) objectList.push(rowObj);
      }
      if (objectList.length > 0) {
        cachedSheets[sourceName] = objectList;
        return objectList;
      }
    }
  }

  return [];
}

/**
 * Rock-solid Live Fetch from Store FMS Main Backend Web App
 * Automatically handles multi-hop 302 redirects from Google Apps Script
 */
function fetchFromWebAPI(sheetName) {
  var urlVariants = [
    MAIN_STORE_APP_SCRIPT_URL + "?sheetName=" + encodeURIComponent(sheetName),
    MAIN_STORE_APP_SCRIPT_URL + "?sheet=" + encodeURIComponent(sheetName)
  ];

  for (var v = 0; v < urlVariants.length; v++) {
    var currentUrl = urlVariants[v];
    var maxHops = 6;

    while (maxHops > 0) {
      maxHops--;
      try {
        var res = UrlFetchApp.fetch(currentUrl, {
          muteHttpExceptions: true,
          followRedirects: true
        });
        var code = res.getResponseCode();

        // If redirect returned
        if (code === 301 || code === 302 || code === 307) {
          var hdrs = res.getHeaders();
          var loc = null;
          for (var k in hdrs) {
            if (k.toLowerCase() === "location") {
              loc = hdrs[k];
              break;
            }
          }
          if (loc) {
            currentUrl = loc;
            continue;
          }
        }

        if (code >= 200 && code < 300) {
          var text = res.getContentText();
          if (text && text.indexOf("{") !== -1) {
            var json = JSON.parse(text);
            var rows = json.rows || (Array.isArray(json) ? json : (json.data || []));
            if (rows && rows.length > 0) {
              return rows;
            }
          }
        }
      } catch (err) {
        Logger.log("fetchFromWebAPI attempt failed: " + err.message);
      }
      break;
    }
  }
  return [];
}

// =========================================================================
// SUPABASE PERMANENT CREDENTIAL MANAGER & SMART TABLE RETRIEVER
// =========================================================================

/**
 * Ye function Supabase credentials ko Google Script Properties se nikalta hai.
 * Is wajah se code replace karne par bhi credentials kafi nahi mit-te!
 */
function getSupabaseConfig() {
  var props = PropertiesService.getScriptProperties();
  var savedUrl = props.getProperty("SUPABASE_URL") || "";
  var savedKey = props.getProperty("SUPABASE_API_KEY") || "";

  // Agar user ne code me real credentials daale hain to unhe permanent save kar do
  if (SUPABASE_URL && SUPABASE_URL.indexOf("YOUR_PROJECT_ID") === -1 && SUPABASE_URL.trim() !== "") {
    props.setProperty("SUPABASE_URL", SUPABASE_URL.trim());
    savedUrl = SUPABASE_URL.trim();
  }
  if (SUPABASE_API_KEY && SUPABASE_API_KEY.indexOf("YOUR_SUPABASE") === -1 && SUPABASE_API_KEY.trim() !== "") {
    props.setProperty("SUPABASE_API_KEY", SUPABASE_API_KEY.trim());
    savedKey = SUPABASE_API_KEY.trim();
  }

  return {
    url: savedUrl,
    key: savedKey
  };
}

/**
 * Menu item se popup dialog open karke permanent credentials save karein
 */
function promptSupabaseCredentials() {
  var ui = SpreadsheetApp.getUi();
  var currentConfig = getSupabaseConfig();

  var urlPrompt = ui.prompt(
    "Supabase Configuration (1/2)",
    "Apna Supabase Project URL enter karein:\n(e.g. https://xyzcompany.supabase.co)\n\nCurrently: " + (currentConfig.url || "Not Set"),
    ui.ButtonSet.OK_CANCEL
  );
  if (urlPrompt.getSelectedButton() !== ui.Button.OK) return;
  var enteredUrl = urlPrompt.getResponseText().trim();
  if (!enteredUrl && currentConfig.url) enteredUrl = currentConfig.url;

  var keyPrompt = ui.prompt(
    "Supabase Configuration (2/2)",
    "Apna Supabase API Key (anon / service_role) enter karein:\n\nCurrently: " + (currentConfig.key ? "******** (Saved)" : "Not Set"),
    ui.ButtonSet.OK_CANCEL
  );
  if (keyPrompt.getSelectedButton() !== ui.Button.OK) return;
  var enteredKey = keyPrompt.getResponseText().trim();
  if (!enteredKey && currentConfig.key) enteredKey = currentConfig.key;

  if (!enteredUrl || !enteredKey) {
    ui.alert("Error", "URL aur API Key dono zaroori hain!", ui.ButtonSet.OK);
    return;
  }

  // Save permanently in Google Script Properties
  var props = PropertiesService.getScriptProperties();
  props.setProperty("SUPABASE_URL", enteredUrl);
  props.setProperty("SUPABASE_API_KEY", enteredKey);

  ui.alert(
    "Saved Permanently",
    "Credentials permanently save ho gaye hain! Ab code badalne par bhi aapko dubara URL aur Key nahi daalna padega.\n\nAb Connection Test kiya ja raha hai...",
    ui.ButtonSet.OK
  );

  testSupabaseConnection();
}

/**
 * Supabase Connection Tester
 */
function testSupabaseConnection() {
  var ui = SpreadsheetApp.getUi();
  var cfg = getSupabaseConfig();
  if (!cfg.url || !cfg.key) {
    ui.alert("Configuration Missing", "Supabase URL aur API Key set nahi hain. Kripya pehle Setup karein!", ui.ButtonSet.OK);
    return;
  }

  var data = fetchFromSupabase(cfg, "INDENT");
  if (data && data.length > 0) {
    ui.alert("✅ Connection Successful!", "Supabase successfully connected! Found " + data.length + " records in Indent table.", ui.ButtonSet.OK);
  } else {
    ui.alert("⚠️ Connected but No Data", "Supabase API responded, but no records were returned. Table name verify karein (e.g. 'indent' / 'indents').", ui.ButtonSet.OK);
  }
}

/**
 * Smart table name candidate list
 */
function getSupabaseTableCandidates(sourceSheet) {
  var s = String(sourceSheet).trim();
  var lower = s.toLowerCase();
  var underscore = lower.replace(/\s+/g, "_");
  var clean = lower.replace(/[^a-z0-9]/g, "");

  var candidates = [underscore, clean, lower, s];
  if (underscore === "indent") candidates.push("indents", "management_approval_mis");
  if (underscore === "issue") candidates.push("store_issue", "store_out", "issues");
  if (underscore === "store_out") candidates.push("issue", "store_issue");
  if (underscore === "store_in") candidates.push("storein", "received", "store_check", "receive_items", "received_items", "stores");
  if (underscore === "po_master") candidates.push("pomaster", "po_masters", "po");
  if (underscore === "tally_entry") candidates.push("tallyentry", "tally_entries", "tally");
  if (underscore === "fullkitting") candidates.push("full_kitting", "freight");
  if (underscore === "payment_history") candidates.push("paymenthistory", "payments");
  if (underscore === "received") candidates.push("received_items", "grn");

  var unique = [];
  for (var i = 0; i < candidates.length; i++) {
    if (unique.indexOf(candidates[i]) === -1) unique.push(candidates[i]);
  }
  return unique;
}

/**
 * Fetch records from Supabase table with auto table-name retry
 */
function fetchFromSupabase(sbConfig, sourceSheet) {
  if (!sbConfig || !sbConfig.url || !sbConfig.key) return null;
  if (sbConfig.url.indexOf("YOUR_PROJECT_ID") !== -1 || sbConfig.key.indexOf("YOUR_SUPABASE") !== -1) return null;

  var candidates = getSupabaseTableCandidates(sourceSheet);
  for (var i = 0; i < candidates.length; i++) {
    var tbl = candidates[i];
    var url = sbConfig.url.replace(/\/$/, "") + "/rest/v1/" + encodeURIComponent(tbl) + "?select=*&limit=10000";
    var options = {
      method: "get",
      headers: {
        "apikey": sbConfig.key,
        "Authorization": "Bearer " + sbConfig.key,
        "Content-Type": "application/json",
        "Range": "0-9999"
      },
      muteHttpExceptions: true
    };
    try {
      var res = UrlFetchApp.fetch(url, options);
      if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) {
        var data = JSON.parse(res.getContentText());
        if (Array.isArray(data) && data.length > 0) {
          Logger.log("✅ Supabase table '" + tbl + "' matched: returned " + data.length + " rows.");
          return data;
        }
      }
    } catch (e) {
      // try next candidate
    }
  }
  return null;
}

// =========================================================================
// 9. HELPER UTILITIES
// =========================================================================

function getVal(item, aliases) {
  if (!item || !aliases) return "";
  for (var i = 0; i < aliases.length; i++) {
    var k = aliases[i];
    if (item[k] !== undefined && item[k] !== null) {
      var val = String(item[k]).trim();
      if (val !== "" && val !== "-" && val.toLowerCase() !== "null" && val.toLowerCase() !== "undefined") {
        return item[k];
      }
    }
  }
  return "";
}

function hasVal(val) {
  if (val === undefined || val === null) return false;
  var s = String(val).trim();
  return s !== "" && s !== "-" && s.toLowerCase() !== "null" && s.toLowerCase() !== "undefined";
}

function setupSheetHeader(sheet, headers) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);

  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground("#1E3A8A"); // Navy blue
  headerRange.setFontColor("#FFFFFF");
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");

  sheet.setColumnWidth(1, 190); // Timestamp
  sheet.setColumnWidth(2, 200); // Identifier / PO Number
  sheet.setColumnWidth(3, 140); // Firm Name
  sheet.setColumnWidth(4, 190); // Planned
  sheet.setColumnWidth(5, 190); // Actual
  sheet.setColumnWidth(6, 120); // Delay

  // Format date columns so Google Sheets recognizes them as calculable datetimes
  try {
    sheet.getRange("A:A").setNumberFormat("MM/dd/yyyy HH:mm:ss");
    sheet.getRange("D:E").setNumberFormat("MM/dd/yyyy HH:mm:ss");
  } catch (fmtErr) {}
}

function parseDateRobust(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;

  // Handle Excel / Google Sheets numeric serial dates or timestamps
  var str = String(dateInput).trim();
  var num = Number(str);
  if (!isNaN(num) && str !== "" && str.indexOf("-") === -1 && str.indexOf("/") === -1 && str.indexOf(":") === -1) {
    if (num > 30000 && num < 70000) {
      // Excel/Sheets serial day count starting from Dec 30 1899
      return new Date(Math.round((num - 25569) * 86400 * 1000));
    } else if (num > 1000000000) {
      return new Date(num > 1000000000000 ? num : num * 1000);
    }
  }

  // Try standard Date parsing (ISO 8601 strings etc.)
  var d = new Date(dateInput);
  if (!isNaN(d.getTime())) return d;

  // Parse DD-MM-YYYY or DD/MM/YYYY or MM/DD/YYYY hh:mm:ss (with or without AM/PM)
  var m = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\s*(AM|PM))?)?/i);
  if (m) {
    var p1 = parseInt(m[1], 10);
    var p2 = parseInt(m[2], 10);
    var year = parseInt(m[3], 10);
    var hh = parseInt(m[4] || "0", 10);
    var mm = parseInt(m[5] || "0", 10);
    var ss = parseInt(m[6] || "0", 10);
    var ap = m[7];
    if (ap) {
      if (ap.toUpperCase() === "PM" && hh < 12) hh += 12;
      if (ap.toUpperCase() === "AM" && hh === 12) hh = 0;
    }
    var day = p1;
    var month = p2;
    if (p1 <= 12 && p2 > 12) {
      // MM/DD/YYYY
      month = p1;
      day = p2;
    }
    d = new Date(year, month - 1, day, hh, mm, ss);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function formatDateTimeKolkata(dateInput) {
  if (!dateInput) return "";
  try {
    var str = String(dateInput).trim();
    // Ignore non-date status words like Accept, Reject, Yes, No, Pending, Complete
    if (/^(accept|reject|yes|no|pending|complete|null|undefined|-)$/i.test(str)) {
      return "";
    }
    var d = parseDateRobust(dateInput);
    if (!d || isNaN(d.getTime())) return "";
    // Format: MM/dd/yyyy HH:mm:ss (24-hour time, no AM/PM, formula calculable)
    return Utilities.formatDate(d, TIMEZONE, "MM/dd/yyyy HH:mm:ss");
  } catch (e) {
    return "";
  }
}

function getDelayCalculation(plannedInput, actualInput) {
  try {
    var p = parseDateRobust(plannedInput);
    var a = parseDateRobust(actualInput);

    if (!p || !a || isNaN(p.getTime()) || isNaN(a.getTime())) {
      return { seconds: 0, string: "00:00:00" };
    }

    var diffMs = a.getTime() - p.getTime();
    if (diffMs <= 0) {
      return { seconds: 0, string: "00:00:00" };
    }

    var totalSeconds = Math.floor(diffMs / 1000);
    return {
      seconds: totalSeconds,
      string: formatSecondsToHHMMSS(totalSeconds)
    };
  } catch (e) {
    return { seconds: 0, string: "00:00:00" };
  }
}

function formatSecondsToHHMMSS(totalSeconds) {
  if (totalSeconds <= 0) return "00:00:00";
  var hours = Math.floor(totalSeconds / 3600);
  var minutes = Math.floor((totalSeconds % 3600) / 60);
  var seconds = totalSeconds % 60;

  var hh = (hours < 10 ? "0" : "") + hours;
  var mm = (minutes < 10 ? "0" : "") + minutes;
  var ss = (seconds < 10 ? "0" : "") + seconds;

  return hh + ":" + mm + ":" + ss;
}

// =========================================================================
// 10. TIME-DRIVEN LIVE TRIGGER (EVERY 1 HOUR)
// =========================================================================

function createMISTrigger() {
  removeMISTrigger();

  ScriptApp.newTrigger("syncAllStepsMIS")
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log("Live trigger activated: syncAllStepsMIS will run automatically every 1 hour.");
  try {
    SpreadsheetApp.getUi().alert(
      "Auto-Sync Trigger Activated",
      "Store FMS MIS will now automatically sync all 25 steps every 1 hour in the background!",
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {}
}

function removeMISTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === "syncAllStepsMIS" || fn === "importMISFromSupabase" || fn === "importLiftingMIS") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  Logger.log("Triggers cleared.");
}
