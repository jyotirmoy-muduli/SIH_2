function readBoolean(name, fallback) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue.trim() === "") return fallback;
  if (rawValue.toLowerCase() === "true") return true;
  if (rawValue.toLowerCase() === "false") return false;
  throw new Error(`${name} must be "true" or "false"`);
}

const requiredEvidenceCategories = (
  process.env.CLOSURE_REQUIRED_EVIDENCE_CATEGORIES || ""
)
  .split(",")
  .map((category) => category.trim().toLowerCase())
  .filter(Boolean);

export const CLOSURE_RULES = Object.freeze({
  responseRequired: readBoolean("CLOSURE_RESPONSE_REQUIRED", true),
  actionsRequired: readBoolean("CLOSURE_ACTIONS_REQUIRED", true),
  blockingEnabled: readBoolean("CLOSURE_BLOCKING_ENABLED", false),
  requiredEvidenceCategories: Object.freeze(requiredEvidenceCategories),
  minimumResponseCharacters: 20,
});
