function readPositiveInteger(name, fallback, maximum) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue.trim() === "") return fallback;

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0 || value > maximum) {
    throw new Error(`${name} must be a positive integer no greater than ${maximum}`);
  }
  return value;
}

function readPercentage(name, fallback) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue.trim() === "") return fallback;

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error(`${name} must be an integer from 1 to 100`);
  }
  return value;
}

export const RIPPLE_RADAR_CONFIG = Object.freeze({
  timeWindowDays: readPositiveInteger("RIPPLE_TIME_WINDOW_DAYS", 30, 365),
  closeTimeDays: readPositiveInteger("RIPPLE_CLOSE_TIME_DAYS", 7, 365),
  minSimilarity: readPercentage("RIPPLE_MIN_SIMILARITY", 42),
  minTextSimilarity: readPercentage("RIPPLE_MIN_TEXT_SIMILARITY", 15),
  minClusterSize: readPositiveInteger("RIPPLE_MIN_CLUSTER_SIZE", 3, 100),
  maxCases: readPositiveInteger("RIPPLE_MAX_CASES", 500, 1000),
});

if (RIPPLE_RADAR_CONFIG.closeTimeDays > RIPPLE_RADAR_CONFIG.timeWindowDays) {
  throw new Error(
    "RIPPLE_CLOSE_TIME_DAYS must not exceed RIPPLE_TIME_WINDOW_DAYS"
  );
}
if (RIPPLE_RADAR_CONFIG.minClusterSize < 3) {
  throw new Error("RIPPLE_MIN_CLUSTER_SIZE must be at least 3");
}
if (RIPPLE_RADAR_CONFIG.maxCases < RIPPLE_RADAR_CONFIG.minClusterSize) {
  throw new Error("RIPPLE_MAX_CASES must be at least RIPPLE_MIN_CLUSTER_SIZE");
}
