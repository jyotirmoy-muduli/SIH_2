import mongoose, { connectDatabase } from "./config/db.js";
import Institution from "./models/Institution.js";
import { pathToFileURL } from "node:url";

const API_URL =
  "https://facilities.aicte-india.org/dashboard/pages/php/approvedinstituteserver.php";
const DASHBOARD_URL =
  "https://facilities.aicte-india.org/dashboard/pages/angulardashboard.php";
const STATES_AND_UNION_TERRITORIES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli",
  "Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

export function mapAicteRow(row, state, approvedYear) {
  if (!Array.isArray(row)) {
    throw new TypeError("AICTE institution records must be arrays");
  }

  const [
    aicteId,
    institutionName,
    address,
    district,
    institutionType,
    ,
    ,
    pid,
  ] = row.map((value) => String(value ?? "").trim());

  if (!institutionName || (!pid && !aicteId)) return null;

  return {
    permanent_id: pid || aicteId,
    aicte_id: aicteId || undefined,
    pid: pid || null,
    institution_name: institutionName,
    institution_type: institutionType || null,
    aicte_address: address || null,
    state,
    district: district || null,
    aicte_approved_year: approvedYear,
  };
}

async function fetchState(state, approvedYear) {
  const url = new URL(API_URL);
  url.search = new URLSearchParams({
    method: "fetchdata",
    year: approvedYear,
    program: "1",
    level: "1",
    institutiontype: "1",
    Women: "1",
    Minority: "1",
    state,
    course: "1",
  }).toString();

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Referer: DASHBOARD_URL,
          "X-Requested-With": "XMLHttpRequest",
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`AICTE returned HTTP ${response.status}`);
      }

      const body = await response.text();
      if (!body.trim()) return [];

      const records = JSON.parse(body);
      if (!Array.isArray(records)) {
        throw new Error(`AICTE returned an invalid response for ${state}`);
      }

      return records;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      }
    }
  }

  throw new Error(`Could not fetch AICTE data for ${state}: ${lastError.message}`);
}

async function importInstitutions(approvedYear) {
  let processed = 0;
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const state of STATES_AND_UNION_TERRITORIES) {
    const rows = await fetchState(state, approvedYear);
    const operations = [];

    for (const row of rows) {
      const institution = mapAicteRow(row, state, approvedYear);
      if (!institution) {
        skipped += 1;
        continue;
      }

      operations.push({
        updateOne: {
          filter: { permanent_id: institution.permanent_id },
          update: { $set: institution },
          upsert: true,
        },
      });
    }

    if (operations.length) {
      const result = await Institution.bulkWrite(operations, { ordered: false });
      processed += operations.length;
      inserted += result.upsertedCount;
      updated += result.modifiedCount;
    }

    console.log(`${state}: received ${rows.length} records`);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  if (!processed) {
    throw new Error(
      `No AICTE institutions were imported for ${approvedYear}. Confirm that the year is available on the official dashboard.`
    );
  }

  console.log(
    `AICTE import complete for ${approvedYear}: ${processed} records processed, ${inserted} inserted, ${updated} updated, ${skipped} incomplete records skipped.`
  );
}

const approvedYear = process.argv[2] || process.env.AICTE_APPROVED_YEAR;

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (!/^\d{4}-\d{4}$/.test(approvedYear || "")) {
    console.error(
      "Specify an academic year, for example: npm run import:aicte -- 2024-2025"
    );
    process.exitCode = 1;
  } else {
    try {
      await connectDatabase();
      await importInstitutions(approvedYear);
    } catch (error) {
      console.error("AICTE import failed:", error.message);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect();
    }
  }
}
