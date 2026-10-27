function readPositiveHours(name, fallback) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue.trim() === "") return fallback;

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number of hours`);
  }

  return value;
}

export const SLA_THRESHOLDS = Object.freeze({
  criticalHours: readPositiveHours("SLA_CRITICAL_HOURS", 24),
  atRiskHours: readPositiveHours("SLA_AT_RISK_HOURS", 72),
});

if (SLA_THRESHOLDS.atRiskHours <= SLA_THRESHOLDS.criticalHours) {
  throw new Error("SLA_AT_RISK_HOURS must be greater than SLA_CRITICAL_HOURS");
}
