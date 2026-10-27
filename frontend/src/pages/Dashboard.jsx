import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Building2,
  CheckCircle2,
  CircleHelp,
  Clock3,
  FileText,
  Filter,
  History,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  LogOut,
  Plus,
  Radar,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  ClipboardCheck,
  Compass,
  X,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  createCase,
  getCases,
  getDashboardStats,
  getInstitutions,
  updateCaseStatus,
  getOverlapAlerts,
  getCaseHistory,
  reviewOverlap,
  scanOverlaps,
  getSlaCases,
  logout,
  getResolutionIntegrity,
  getResolutionIntegrityCases,
  reviewResolutionIntegrity,
  saveResolutionDetails,
  getNextActions,
  recordNextActionDecision,
  recordNextActionOutcome,
  getRippleClusters,
  scanRippleRadar,
  reviewRippleCluster,
  getRippleCandidates,
} from "../services/api";

const STATUS_OPTIONS = [
  "RECEIVED",
  "UNDER_REVIEW",
  "IN_PROGRESS",
  "AWAITING_RESPONSE",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
];

const STATUS_COLORS = {
  RECEIVED: "bg-blue-50 text-blue-700",
  UNDER_REVIEW: "bg-violet-50 text-violet-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  AWAITING_RESPONSE: "bg-orange-50 text-orange-700",
  RESOLVED: "bg-emerald-50 text-emerald-700",
  CLOSED: "bg-slate-100 text-slate-600",
  REOPENED: "bg-rose-50 text-rose-700",
};

const PRIORITY_COLORS = {
  LOW: "text-slate-500",
  MEDIUM: "text-blue-600",
  HIGH: "text-orange-600",
  URGENT: "text-rose-600",
};

const CHART_COLORS = ["#1f493c", "#b85f43", "#9b8a58", "#718b75", "#76766e"];

function formatLabel(value = "") {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function StatCard({ title, value, description, icon: Icon, tone, trend }) {
  return (
    <article className="brand-stat-card rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="brand-stat-value mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {value ?? 0}
          </p>
        </div>
        <div className={`brand-stat-icon rounded-xl p-3 ${tone}`}>
          <Icon size={21} />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        {trend === "good" ? (
          <ArrowUpRight size={15} className="text-emerald-600" />
        ) : trend === "warning" ? (
          <ArrowDownRight size={15} className="text-orange-600" />
        ) : (
          <Activity size={15} />
        )}
        <span>{description}</span>
      </div>
    </article>
  );
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
        STATUS_COLORS[status] || "bg-slate-100 text-slate-600"
      }`}
    >
      {formatLabel(status)}
    </span>
  );
}

function NewCaseModal({ onClose, onCreated, user }) {
  const [institutions, setInstitutions] = useState([]);
  const [loadingInstitutions, setLoadingInstitutions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    institution_id: "",
    subject: "",
    description: "",
    bureau_name: user.role === "BUREAU_OFFICER" ? user.bureau_name : "PGRC",
    complaint_type: "Student Grievance",
    priority: "MEDIUM",
    due_date: "",
  });

  useEffect(() => {
    getInstitutions()
      .then(setInstitutions)
      .catch(() => setError("Could not load institutions. Check the API."))
      .finally(() => setLoadingInstitutions(false));
  }, []);

  const setField = (event) => {
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await createCase({
        ...form,
        due_date: form.due_date || null,
      });
      await onCreated();
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not create the complaint. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4">
      <div className="my-auto w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Register complaint
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Create a new institution-related case.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Institution *
            <select
              name="institution_id"
              value={form.institution_id}
              onChange={setField}
              required
              disabled={loadingInstitutions}
              className={inputClass}
            >
              <option value="">
                {loadingInstitutions
                  ? "Loading institutions..."
                  : "Select an institution"}
              </option>
              {institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.institution_name} — {institution.permanent_id}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Complaint subject *
            <input
              name="subject"
              value={form.subject}
              onChange={setField}
              required
              maxLength={255}
              className={inputClass}
              placeholder="Briefly describe the issue"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Description *
            <textarea
              name="description"
              value={form.description}
              onChange={setField}
              required
              rows={3}
              className={inputClass}
              placeholder="Enter the complaint details"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Bureau *
              <select
                name="bureau_name"
                value={form.bureau_name}
                onChange={setField}
                className={inputClass}
              >
                <option value="PGRC">PGRC</option>
                <option value="Regulation Bureau">Regulation Bureau</option>
                <option value="Approval Bureau">Approval Bureau</option>
                <option value="Administration">Administration</option>
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Priority
              <select
                name="priority"
                value={form.priority}
                onChange={setField}
                className={inputClass}
              >
                {["LOW", "MEDIUM", "HIGH", "URGENT"].map((priority) => (
                  <option key={priority} value={priority}>
                    {formatLabel(priority)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Complaint type
              <input
                name="complaint_type"
                value={form.complaint_type}
                onChange={setField}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Due date
              <input
                name="due_date"
                type="date"
                value={form.due_date}
                onChange={setField}
                className={inputClass}
              />
            </label>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700"
            >
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loadingInstitutions || institutions.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving && <LoaderCircle size={16} className="animate-spin" />}
              {saving ? "Registering..." : "Register complaint"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResolutionIntegrityPage({ cases, loading, error, canManage, onRefresh, onSave, onReview, savingId, reviewId }) {
  const [expandedId, setExpandedId] = useState(null);
  const [responseDrafts, setResponseDrafts] = useState({});
  const [actionDrafts, setActionDrafts] = useState({});
  const [evidenceDrafts, setEvidenceDrafts] = useState({});
  const [reviewNotes, setReviewNotes] = useState({});
  const [localError, setLocalError] = useState("");

  function initialValue(item, field) {
    const saved = item.resolution || {};
    if (field === "response") return saved.response || "";
    if (field === "actions") return (saved.completed_actions || []).join("\n");
    if (field === "evidence") return saved.evidence || [];
    return "";
  }

  async function toggleDetails(item) {
    setLocalError("");
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(item.id);
    if (responseDrafts[item.id] === undefined) {
      try {
        const details = await getResolutionIntegrity(item.id);
        const saved = details.resolution || {};
        setResponseDrafts((previous) => ({
          ...previous,
          [item.id]: saved.response || "",
        }));
        setActionDrafts((previous) => ({
          ...previous,
          [item.id]: (saved.completed_actions || []).join("\n"),
        }));
        setEvidenceDrafts((previous) => ({
          ...previous,
          [item.id]: saved.evidence || [],
        }));
      } catch (requestError) {
        setLocalError(
          requestError.response?.data?.message ||
            "Could not load resolution details."
        );
      }
    }
  }

  async function saveDetails(item) {
    setLocalError("");
    const actions = (actionDrafts[item.id] || "")
      .split("\n")
      .map((action) => action.trim())
      .filter(Boolean);

    try {
      const saved = await onSave(item.id, {
        response: responseDrafts[item.id] || "",
        completed_actions: actions,
        evidence: (evidenceDrafts[item.id] || []).map((entry) => ({
          label: entry.label,
          reference: entry.reference || "",
          evidence_type: entry.evidence_type || "",
        })),
      });
      setResponseDrafts((previous) => ({
        ...previous,
        [item.id]: saved.resolution.response,
      }));
      setActionDrafts((previous) => ({
        ...previous,
        [item.id]: saved.resolution.completed_actions.join("\n"),
      }));
      setEvidenceDrafts((previous) => ({
        ...previous,
        [item.id]: saved.resolution.evidence,
      }));
    } catch (requestError) {
      setLocalError(
        requestError.response?.data?.message ||
          "Could not save resolution details."
      );
    }
  }

  async function recordReview(item, decision) {
    setLocalError("");
    try {
      await onReview(item.id, decision, reviewNotes[item.id] || "");
    } catch (requestError) {
      setLocalError(
        requestError.response?.data?.message ||
          "Could not record resolution review."
      );
    }
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-blue-700">Closure quality</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">
            Resolution integrity checker
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Review required details, recorded actions, and evidence references for resolved complaints.
            Passing a checklist does not prove that the complaint was genuinely resolved.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh checks
        </button>
      </header>

      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      )}
      {localError && (
        <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          {localError}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-12 text-sm text-slate-500">
          <LoaderCircle size={20} className="animate-spin text-blue-600" />
          Checking resolution records...
        </div>
      ) : cases.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <ClipboardCheck size={28} className="mx-auto text-slate-400" />
          <p className="mt-3 font-semibold text-slate-800">
            No resolved complaints to review
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Resolved and closed complaints will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {cases.map((item) => {
            const assessment = item.resolution_integrity;
            const expanded = expandedId === item.id;
            const color =
              assessment.status === "INCOMPLETE"
                ? "bg-rose-50 text-rose-700"
                : assessment.status === "REQUIRES_REVIEW"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-emerald-50 text-emerald-700";

            return (
              <article
                key={item.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-blue-700">
                        {item.case_number}
                      </span>
                      <StatusBadge status={item.status} />
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>
                        {formatLabel(assessment.status)}
                      </span>
                    </div>
                    <h3 className="mt-2 font-semibold text-slate-900">{item.subject}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.institution_name || "Institution unavailable"}
                      {item.permanent_id ? ` · ${item.permanent_id}` : ""}
                      {" · "}{item.bureau_name}
                      {item.complaint_type ? ` · ${item.complaint_type}` : ""}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      {assessment.mandatory_failures.length
                        ? `${assessment.mandatory_failures.length} mandatory requirement(s) missing`
                        : "No mandatory checklist items are missing"}
                      {" · "}{assessment.checks.filter((entry) => entry.status === "REVIEW").length} item(s) require human review
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleDetails(item)}
                    className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    {expanded ? "Hide checklist" : "Inspect resolution"}
                  </button>
                </div>

                {expanded && (
                  <div className="space-y-5 border-t border-slate-100 bg-slate-50/60 p-5">
                    <div>
                      <h4 className="font-semibold text-slate-800">Integrity checklist</h4>
                      <ul className="mt-3 space-y-3">
                        {assessment.checks.map((entry) => (
                          <li key={entry.id} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
                            <span className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              entry.status === "PASS"
                                ? "bg-emerald-100 text-emerald-700"
                                : entry.status === "FAIL"
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-amber-100 text-amber-700"
                            }`}>
                              {entry.status}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">
                                {entry.label}
                                {entry.mandatory ? " · mandatory" : ""}
                              </p>
                              <p className="mt-1 text-sm leading-5 text-slate-600">{entry.explanation}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-xs leading-5 text-slate-500">{assessment.disclaimer}</p>
                    </div>

                    {canManage && (
                      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
                        <h4 className="font-semibold text-slate-800">Resolution record</h4>
                        <label className="block text-sm font-medium text-slate-700">
                          Response to the complaint
                          <textarea
                            rows={3}
                            maxLength={10000}
                            value={responseDrafts[item.id] ?? initialValue(item, "response")}
                            onChange={(event) => setResponseDrafts((previous) => ({
                              ...previous,
                              [item.id]: event.target.value,
                            }))}
                            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                            placeholder="Record the response provided to the complainant..."
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          Completed corrective or follow-up actions (one per line)
                          <textarea
                            rows={3}
                            maxLength={10000}
                            value={actionDrafts[item.id] ?? initialValue(item, "actions")}
                            onChange={(event) => setActionDrafts((previous) => ({
                              ...previous,
                              [item.id]: event.target.value,
                            }))}
                            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                            placeholder={"Verified the reported result\nProvided correction details"}
                          />
                        </label>
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-slate-700">
                              Evidence references (metadata only)
                            </span>
                            <button
                              type="button"
                              onClick={() => setEvidenceDrafts((previous) => ({
                                ...previous,
                                [item.id]: [
                                  ...(previous[item.id] ?? initialValue(item, "evidence")),
                                  { label: "", reference: "", evidence_type: "" },
                                ],
                              }))}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700"
                            >
                              Add reference
                            </button>
                          </div>
                          {(evidenceDrafts[item.id] ?? initialValue(item, "evidence")).map((evidence, index) => (
                            <div key={`${item.id}-evidence-${index}`} className="mt-2 grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
                              <input
                                aria-label="Evidence label"
                                maxLength={200}
                                value={evidence.label || ""}
                                onChange={(event) => setEvidenceDrafts((previous) => {
                                  const entries = [...(previous[item.id] ?? initialValue(item, "evidence"))];
                                  entries[index] = { ...entries[index], label: event.target.value };
                                  return { ...previous, [item.id]: entries };
                                })}
                                placeholder="Evidence label"
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              />
                              <input
                                aria-label="Evidence reference"
                                maxLength={500}
                                value={evidence.reference || ""}
                                onChange={(event) => setEvidenceDrafts((previous) => {
                                  const entries = [...(previous[item.id] ?? initialValue(item, "evidence"))];
                                  entries[index] = { ...entries[index], reference: event.target.value };
                                  return { ...previous, [item.id]: entries };
                                })}
                                placeholder="Document URL or reference (no file upload)"
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => setEvidenceDrafts((previous) => ({
                                  ...previous,
                                  [item.id]: (previous[item.id] ?? initialValue(item, "evidence"))
                                    .filter((_entry, entryIndex) => entryIndex !== index),
                                }))}
                                aria-label="Remove evidence reference"
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={savingId === item.id}
                          onClick={() => saveDetails(item)}
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {savingId === item.id && <LoaderCircle size={15} className="animate-spin" />}
                          Save resolution record
                        </button>
                      </div>
                    )}

                    {canManage && (
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <label className="block text-sm font-medium text-slate-700">
                          Official review notes
                          <textarea
                            rows={2}
                            maxLength={1000}
                            value={reviewNotes[item.id] || ""}
                            onChange={(event) => setReviewNotes((previous) => ({
                              ...previous,
                              [item.id]: event.target.value,
                            }))}
                            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                            placeholder="Record your review rationale..."
                          />
                        </label>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={reviewId === item.id}
                            onClick={() => recordReview(item, "ACCEPTED")}
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Record review: accepted
                          </button>
                          <button
                            type="button"
                            disabled={reviewId === item.id}
                            onClick={() => recordReview(item, "NEEDS_FOLLOW_UP")}
                            className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                          >
                            Needs follow-up
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function NextActionsPage({
  cases,
  loading,
  error,
  canManage,
  onRefresh,
  onDecision,
  onOutcome,
  savingId,
}) {
  const [modifiedActions, setModifiedActions] = useState({});
  const [decisionNotes, setDecisionNotes] = useState({});
  const [outcomes, setOutcomes] = useState({});
  const [decisionIds, setDecisionIds] = useState({});
  const [localError, setLocalError] = useState("");

  async function recordDecision(item, decision) {
    setLocalError("");
    try {
      const result = await onDecision(item, {
        recommendation_id: item.recommendation_id,
        decision,
        ...(decision === "MODIFIED"
          ? { modified_action: modifiedActions[item.id] || "" }
          : {}),
        notes: decisionNotes[item.id] || "",
      });
      if (decision !== "REJECTED") {
        setDecisionIds((previous) => ({
          ...previous,
          [item.id]: result.decision_id,
        }));
      }
    } catch (requestError) {
      setLocalError(
        requestError.response?.data?.message ||
          "Could not record the recommendation decision."
      );
    }
  }

  async function recordOutcome(item) {
    setLocalError("");
    try {
      await onOutcome(item, decisionIds[item.id], outcomes[item.id] || "");
      setDecisionIds((previous) => ({ ...previous, [item.id]: null }));
      setOutcomes((previous) => ({ ...previous, [item.id]: "" }));
    } catch (requestError) {
      setLocalError(
        requestError.response?.data?.message ||
          "Could not record the action outcome."
      );
    }
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-blue-700">Explainable workflow guidance</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">
            What should we do next?
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Deterministic suggestions use case status, deadlines, ownership, history, and reviewed relationships.
            They are not actions already performed and never trigger transfers, notifications, or escalations.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh recommendations
        </button>
      </header>

      {(error || localError) && (
        <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          {localError || error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-12 text-sm text-slate-500">
          <LoaderCircle size={20} className="animate-spin text-blue-600" />
          Reviewing complaint context...
        </div>
      ) : cases.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <Compass size={28} className="mx-auto text-slate-400" />
          <p className="mt-3 font-semibold text-slate-800">
            No recommendations available
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Recommendations will appear when complaints are available.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {cases.map((item) => {
            const recommendation = item.recommendation;
            const urgencyClass =
              recommendation.urgency === "CRITICAL" || recommendation.urgency === "HIGH"
                ? "bg-rose-50 text-rose-700"
                : recommendation.urgency === "MEDIUM"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-slate-100 text-slate-600";
            const isSaving = savingId === item.id;

            return (
              <article
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-blue-700">{item.case_number}</span>
                      <StatusBadge status={item.status} />
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${urgencyClass}`}>
                        {formatLabel(recommendation.urgency)} urgency
                      </span>
                    </div>
                    <h3 className="mt-2 font-semibold text-slate-900">{item.subject}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.institution_name || "Institution unavailable"}
                      {" · "}{item.bureau_name}
                      {" · Owner: "}{item.assigned_officer || "Unassigned"}
                      {" · Due: "}{formatDate(item.due_date)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">
                    {formatLabel(recommendation.action)}
                  </span>
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-700">{recommendation.explanation}</p>
                <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Supporting case facts
                    </h4>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                      {recommendation.supporting_facts.map((fact, index) => (
                        <li key={`${item.id}-fact-${index}`}>{fact}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Suggested responsible role
                    </h4>
                    <p className="mt-2 text-sm text-slate-700">
                      {formatLabel(recommendation.suggested_responsible_role)}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Generated by explainable rules. This is a suggestion, not a workflow action.
                    </p>
                  </div>
                </div>

                {canManage && recommendation.action !== "NO_ACTION_REQUIRED" && (
                  <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                    <label className="block text-sm font-medium text-slate-700">
                      Decision notes
                      <textarea
                        rows={2}
                        maxLength={1000}
                        value={decisionNotes[item.id] || ""}
                        onChange={(event) => setDecisionNotes((previous) => ({
                          ...previous,
                          [item.id]: event.target.value,
                        }))}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                        placeholder="Optional rationale for accepting or rejecting..."
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => recordDecision(item, "ACCEPTED")}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Accept suggestion
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => recordDecision(item, "REJECTED")}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Reject suggestion
                      </button>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={modifiedActions[item.id] ?? recommendation.action}
                        onChange={(event) => setModifiedActions((previous) => ({
                          ...previous,
                          [item.id]: event.target.value,
                        }))}
                        maxLength={500}
                        aria-label={`Modified recommendation for ${item.case_number}`}
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => recordDecision(item, "MODIFIED")}
                        className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                      >
                        Record modified suggestion
                      </button>
                    </div>
                    {decisionIds[item.id] && (
                      <div className="rounded-xl bg-slate-50 p-3">
                        <label className="block text-sm font-medium text-slate-700">
                          Action outcome
                          <textarea
                            rows={2}
                            maxLength={1000}
                            value={outcomes[item.id] || ""}
                            onChange={(event) => setOutcomes((previous) => ({
                              ...previous,
                              [item.id]: event.target.value,
                            }))}
                            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                            placeholder="Record what happened after the decision..."
                          />
                        </label>
                        <button
                          type="button"
                          disabled={isSaving || !(outcomes[item.id] || "").trim()}
                          onClick={() => recordOutcome(item)}
                          className="mt-2 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
                        >
                          Record outcome
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RippleRadarPage({
  clusters,
  categoryTrends,
  trendWindowDays,
  loading,
  error,
  status,
  onStatusChange,
  canScan,
  canReview,
  onRefresh,
  onScan,
  onReview,
  onFindCandidates,
  scanning,
  reviewingId,
}) {
  const [selectedCases, setSelectedCases] = useState({});
  const [reviewNotes, setReviewNotes] = useState({});
  const [scanMessage, setScanMessage] = useState("");
  const [localError, setLocalError] = useState("");
  const [candidateSearch, setCandidateSearch] = useState({});
  const [candidateResults, setCandidateResults] = useState({});
  const [candidateLoadingId, setCandidateLoadingId] = useState(null);

  function selectedIds(cluster) {
    return selectedCases[cluster.id] || cluster.cases.map(({ case_id }) => case_id);
  }

  async function scan() {
    setLocalError("");
    setScanMessage("");
    try {
      const result = await onScan();
      setScanMessage(
        `Scanned ${result.cases_scanned} complaints. Created ${result.clusters_created} potential pattern(s); skipped ${result.duplicate_clusters_skipped} duplicate(s). Thresholds: ${result.similarity_threshold}% composite / ${result.min_text_similarity}% text similarity, ${result.time_window_days}-day window.`
      );
    } catch (requestError) {
      setLocalError(
        requestError.response?.data?.message || "Could not run Ripple Radar."
      );
    }
  }

  async function recordReview(cluster, decision) {
    setLocalError("");
    const members = selectedIds(cluster);
    try {
      await onReview(cluster, {
        decision,
        notes: reviewNotes[cluster.id] || "",
        expected_updated_at: cluster.updated_at,
        ...(decision === "ADJUSTED" ? { selected_case_ids: members } : {}),
      });
      setSelectedCases((previous) => {
        const next = { ...previous };
        delete next[cluster.id];
        return next;
      });
    } catch (requestError) {
      setLocalError(
        requestError.response?.data?.message ||
          "Could not record the potential-pattern review."
      );
    }
  }

  async function searchCandidates(cluster) {
    setLocalError("");
    setCandidateLoadingId(cluster.id);
    try {
      const results = await onFindCandidates(
        cluster,
        candidateSearch[cluster.id] || ""
      );
      setCandidateResults((previous) => ({
        ...previous,
        [cluster.id]: results,
      }));
    } catch (requestError) {
      setLocalError(
        requestError.response?.data?.message ||
          "Could not search complaints for manual grouping."
      );
    } finally {
      setCandidateLoadingId(null);
    }
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-blue-700">Cross-complaint pattern detection</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">
            Institutional Ripple Radar
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Similarity, available complaint metadata, and a bounded time window suggest cases for investigation.
            These are potential patterns only; similar complaints may have different causes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="ripple-status-filter">
            Filter potential patterns
          </label>
          <select
            id="ripple-status-filter"
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700"
          >
            {["ALL", "SUGGESTED", "CONFIRMED", "ADJUSTED", "DISMISSED"].map((item) => (
              <option key={item} value={item}>{formatLabel(item)}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh patterns
          </button>
          {canScan && (
            <button
              type="button"
              onClick={scan}
              disabled={scanning}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {scanning ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <Radar size={15} />
              )}
              {scanning ? "Scanning..." : "Run pattern scan"}
            </button>
          )}
        </div>
      </header>

      {(error || localError) && (
        <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          {localError || error}
        </p>
      )}
      {scanMessage && (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          {scanMessage}
        </p>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h3 className="font-semibold text-slate-900">Recurring category increases</h3>
          <p className="mt-1 text-sm text-slate-500">
            Compares complaint counts in the latest {trendWindowDays}-day window with the preceding equal-length window.
            Counts are signals for review, not proof of a shared cause.
          </p>
        </div>
        {categoryTrends.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {categoryTrends.map((trend) => (
              <article
                key={trend.category}
                className="rounded-xl border border-amber-100 bg-amber-50/60 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-slate-800">{trend.category}</h4>
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">
                    {formatLabel(trend.trend)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {trend.previous_count} previously → {trend.current_count} recently
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Increase: {trend.increase_count}
                  {trend.change_percent === null ? "" : ` (${trend.change_percent}%)`}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            No categories currently meet the configured recurrence and increase checks.
          </p>
        )}
      </section>

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-12 text-sm text-slate-500">
          <LoaderCircle size={20} className="animate-spin text-blue-600" />
          Loading potential patterns...
        </div>
      ) : clusters.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <Radar size={28} className="mx-auto text-slate-400" />
          <p className="mt-3 font-semibold text-slate-800">No potential patterns to review</p>
          <p className="mt-1 text-sm text-slate-500">
            {canScan
              ? "Run a scan to compare recent complaints using the configured time window and thresholds."
              : "An administrator can run a scan when recent complaints are available."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {clusters.map((cluster) => {
            const ids = selectedIds(cluster);
            const canReviewCluster =
              canReview &&
              cluster.visible_case_count === cluster.case_count &&
              cluster.status !== "DISMISSED";

            return (
              <article
                key={cluster.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <header className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                        Potential pattern · {cluster.case_count} cases
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {formatLabel(cluster.status)}
                      </span>
                    </div>
                    <h3 className="mt-3 font-semibold text-slate-900">{cluster.common_issue}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(cluster.period_start)} – {formatDate(cluster.period_end)}
                    </p>
                  </div>
                  <div className="text-sm text-slate-600 sm:text-right">
                    <p><strong>Affected bureaus:</strong> {cluster.affected_bureaus.join(", ") || "Unavailable"}</p>
                    <p className="mt-1"><strong>Institutions:</strong> {cluster.affected_institutions.join(", ") || "Unavailable"}</p>
                  </div>
                </header>

                <div className="space-y-4 p-5">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Why this grouping was suggested
                    </h4>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {cluster.matching_reasons.map((reason) => (
                        <li
                          key={`${cluster.id}-${reason}`}
                          className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-800"
                        >
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                    {cluster.cases.map((item) => (
                      <div
                        key={item.case_id}
                        className="flex flex-col justify-between gap-2 p-3 sm:flex-row sm:items-start"
                      >
                        <div className="flex min-w-0 gap-3">
                          {canReviewCluster && cluster.status !== "DISMISSED" && (
                            <input
                              type="checkbox"
                              checked={ids.includes(item.case_id)}
                              onChange={(event) => {
                                const next = event.target.checked
                                  ? [...ids, item.case_id]
                                  : ids.filter((id) => id !== item.case_id);
                                setSelectedCases((previous) => ({
                                  ...previous,
                                  [cluster.id]: next,
                                }));
                              }}
                              aria-label={`Include ${item.case_number} in adjusted grouping`}
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
                            />
                          )}
                          <div className="min-w-0">
                            <Link
                              to={`/complaints?case=${encodeURIComponent(item.case_number)}#cases`}
                              className="text-sm font-semibold text-blue-700 hover:underline"
                            >
                              {item.case_number} · {item.subject}
                            </Link>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.institution_name || "Institution unavailable"}
                              {" · "}{item.bureau_name}
                              {" · "}{formatDate(item.received_at)}
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              {item.matching_reasons.join(" · ")}
                              {item.matched_case_numbers?.length
                                ? ` · Best match: ${item.matched_case_numbers.join(", ")}`
                                : ""}
                              {item.matching_terms.length
                                ? ` · Shared terms: ${item.matching_terms.join(", ")}`
                                : ""}
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {item.similarity_score === null
                            ? "Manually retained"
                            : `${item.similarity_score}% similarity`}
                        </span>
                      </div>
                    ))}
                  </div>

                  {cluster.visible_case_count < cluster.case_count && (
                    <p className="text-xs text-slate-500">
                      Case details are scoped to your bureau. An administrator can review the full cross-bureau grouping.
                    </p>
                  )}

                  {canReviewCluster && (
                    <div className="space-y-3 border-t border-slate-100 pt-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700">
                          Add a complaint to the manual grouping
                          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                            <input
                              value={candidateSearch[cluster.id] || ""}
                              onChange={(event) => setCandidateSearch((previous) => ({
                                ...previous,
                                [cluster.id]: event.target.value,
                              }))}
                              maxLength={100}
                              minLength={2}
                              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                              placeholder="Search case number or subject"
                            />
                            <button
                              type="button"
                              disabled={
                                candidateLoadingId === cluster.id ||
                                (candidateSearch[cluster.id] || "").trim().length < 2
                              }
                              onClick={() => searchCandidates(cluster)}
                              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              {candidateLoadingId === cluster.id ? "Searching..." : "Search"}
                            </button>
                          </div>
                        </label>
                        {(candidateResults[cluster.id] || []).map((candidate) => {
                          const alreadySelected = ids.includes(candidate.id);
                          const originallyGrouped = cluster.cases.some(
                            ({ case_id }) => case_id === candidate.id
                          );
                          return (
                            <div
                              key={candidate.id}
                              className="mt-2 flex flex-col justify-between gap-2 rounded-lg bg-slate-50 p-3 sm:flex-row sm:items-center"
                            >
                              <p className="text-xs text-slate-600">
                                <strong>{candidate.case_number}</strong> · {candidate.subject}
                                {" · "}{candidate.bureau_name}
                              </p>
                              <button
                                type="button"
                                disabled={alreadySelected && originallyGrouped}
                                onClick={() => {
                                  const next = alreadySelected
                                    ? ids.filter((id) => id !== candidate.id)
                                    : [...ids, candidate.id];
                                  setSelectedCases((previous) => ({
                                    ...previous,
                                    [cluster.id]: next,
                                  }));
                                }}
                                className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                              >
                                {alreadySelected && originallyGrouped
                                  ? "Already grouped"
                                  : alreadySelected
                                    ? "Remove"
                                    : "Add without similarity score"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <label className="block text-sm font-medium text-slate-700">
                        Review notes
                        <textarea
                          rows={2}
                          maxLength={1000}
                          value={reviewNotes[cluster.id] || ""}
                          onChange={(event) => setReviewNotes((previous) => ({
                            ...previous,
                            [cluster.id]: event.target.value,
                          }))}
                          className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                          placeholder="Record why the pattern was confirmed, dismissed, or adjusted..."
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={reviewingId === cluster.id}
                          onClick={() => recordReview(cluster, "CONFIRMED")}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Confirm potential pattern
                        </button>
                        <button
                          type="button"
                          disabled={
                            reviewingId === cluster.id ||
                            ids.length < 3 ||
                            ids.length === cluster.cases.length
                          }
                          onClick={() => recordReview(cluster, "ADJUSTED")}
                          className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                        >
                          Save adjusted grouping ({ids.length})
                        </button>
                        <button
                          type="button"
                          disabled={reviewingId === cluster.id}
                          onClick={() => recordReview(cluster, "DISMISSED")}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Dismiss suggestion
                        </button>
                      </div>
                    </div>
                  )}

                  {cluster.review_history.length > 0 && (
                    <div className="border-t border-slate-100 pt-3 text-xs text-slate-500">
                      {cluster.review_history.map((review) => (
                        <p key={review._id}>
                          {formatLabel(review.decision)}
                          {review.reviewer_name ? ` by ${review.reviewer_name}` : ""}
                          {" · "}{formatDateTime(review.reviewed_at)}
                          {review.notes ? ` · ${review.notes}` : ""}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}


function formatDateTime(value) {
  if (!value) return "Time not recorded";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time not recorded";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function HistoryModal({ caseItem, history, loading, error, onClose }) {
  const actionTitle = (entry) => {
    switch (entry.action_type) {
      case "CASE_CREATED":
        return "Complaint registered";
      case "STATUS_CHANGED":
        return "Complaint status changed";
      case "OVERLAP_REVIEW":
        return "Overlap review recorded";
      case "RESOLUTION_DETAILS_RECORDED":
        return "Resolution details recorded";
      case "RESOLUTION_INTEGRITY_REVIEW":
        return "Resolution integrity reviewed";
      case "NEXT_ACTION_DECISION":
        return "Next-action recommendation reviewed";
      case "NEXT_ACTION_OUTCOME":
        return "Next-action outcome recorded";
      default:
        return formatLabel(entry.action_type || "Case activity");
    }
  };

  const actionDescription = (entry) => {
    if (entry.action_type === "STATUS_CHANGED") {
      if (entry.previous_status && entry.new_status) {
        return `${formatLabel(entry.previous_status)} → ${formatLabel(entry.new_status)}`;
      }
      return entry.new_status
        ? `Status recorded as ${formatLabel(entry.new_status)}`
        : "Status change recorded";
    }

    if (entry.action_type === "CASE_CREATED" && entry.new_status) {
      return `Initial status recorded as ${formatLabel(entry.new_status)}`;
    }

    if (entry.action_type === "NEXT_ACTION_DECISION") {
      const decision = formatLabel(entry.event_data?.decision || "reviewed");
      const selectedAction = entry.event_data?.selected_action
        ? ` Selected action: ${formatLabel(entry.event_data.selected_action)}.`
        : "";
      return `Suggestion ${decision.toLowerCase()}.${selectedAction}`;
    }

    if (entry.action_type === "NEXT_ACTION_OUTCOME") {
      return entry.notes || "Outcome recorded";
    }

    return "";
  };

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-history-title"
        className="my-auto max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
              <History size={21} />
            </div>
            <div className="min-w-0">
              <h2 id="case-history-title" className="text-lg font-bold text-slate-900">
                Case history
              </h2>
              <p className="mt-1 wrap-break-word text-sm font-semibold text-blue-700">
                {caseItem.case_number}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {caseItem.subject}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close case history"
            className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </header>

        <div className="max-h-[calc(90vh-100px)] overflow-y-auto p-5 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-12 text-sm text-slate-500">
              <LoaderCircle size={20} className="animate-spin text-blue-600" />
              Loading case history...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p role="alert" className="text-sm text-rose-700">{error}</p>
            </div>
          ) : history.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
              <History size={24} className="mx-auto text-slate-400" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                No history entries found
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Recorded actions for this complaint will appear here.
              </p>
            </div>
          ) : (
            <ol className="space-y-0">
              {history.map((entry, index) => (
                <li key={entry.id ?? `${entry.action_type}-${entry.created_at}-${index}`} className="relative flex gap-4 pb-7 last:pb-0">
                  {index < history.length - 1 && (
                    <span className="absolute left-3.75 top-8 h-[calc(100%-16px)] w-px bg-slate-200" />
                  )}
                  <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    entry.action_type === "OVERLAP_REVIEW"
                      ? "bg-violet-100 text-violet-700"
                      : entry.action_type === "STATUS_CHANGED"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-blue-100 text-blue-700"
                  }`}>
                    {entry.action_type === "OVERLAP_REVIEW" ? (
                      <ShieldCheck size={16} />
                    ) : entry.action_type === "STATUS_CHANGED" ? (
                      <RefreshCw size={16} />
                    ) : (
                      <FileText size={16} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {actionTitle(entry)}
                      </h3>
                      <time className="shrink-0 text-xs text-slate-400">
                        {formatDateTime(entry.created_at)}
                      </time>
                    </div>

                    {actionDescription(entry) && (
                      <p className="mt-2 text-sm font-medium text-slate-700">
                        {actionDescription(entry)}
                      </p>
                    )}

                    {entry.notes && (
                      <p className="mt-2 whitespace-pre-wrap wrap-break-word text-sm leading-6 text-slate-600">
                        {entry.notes}
                      </p>
                    )}
                    {entry.event_data?.decision && (
                      <p className="mt-2 text-xs font-medium text-slate-600">
                        Official decision: {formatLabel(entry.event_data.decision)}
                        {entry.event_data.assessment_status
                          ? ` · Checklist: ${formatLabel(entry.event_data.assessment_status)}`
                          : ""}
                      </p>
                    )}
                    {entry.event_data?.explanation && (
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Why suggested: {entry.event_data.explanation}
                      </p>
                    )}
                    {entry.event_data?.supporting_facts?.length > 0 && (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-500">
                        {entry.event_data.supporting_facts.map((fact, factIndex) => (
                          <li key={`${entry.id}-fact-${factIndex}`}>{fact}</li>
                        ))}
                      </ul>
                    )}
                    {entry.event_data?.urgency && (
                      <p className="mt-2 text-xs text-slate-500">
                        Recommended urgency: {formatLabel(entry.event_data.urgency)}
                        {entry.event_data.suggested_responsible_role
                          ? ` · Suggested role: ${formatLabel(entry.event_data.suggested_responsible_role)}`
                          : ""}
                      </p>
                    )}
                    {entry.event_data?.evidence_count !== undefined && (
                      <p className="mt-2 text-xs text-slate-500">
                        Recorded {entry.event_data.completed_action_count} action(s) and{" "}
                        {entry.event_data.evidence_count} evidence reference(s).
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {entry.new_status && (
                        <StatusBadge status={entry.new_status} />
                      )}
                      {entry.performed_by_name && (
                        <span className="text-xs text-slate-500">
                          Recorded by {entry.performed_by_name}
                        </span>
                      )}
                      {!entry.performed_by_name && entry.performed_by && (
                        <span className="text-xs text-slate-500">
                          Officer ID: {entry.performed_by}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}

export default function Dashboard({ user, onLogout }) {
  const canManageCases = ["ADMIN", "BUREAU_OFFICER"].includes(user.role);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedCaseNumber = searchParams.get("case") || "";
  const search = linkedCaseNumber || searchParams.get("search") || "";
  function setSearch(value) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("case");
    if (value) nextParams.set("search", value);
    else nextParams.delete("search");
    setSearchParams(nextParams, { replace: true });
  }
  const currentPage =
    location.pathname === "/complaints"
      ? "complaints"
      : location.pathname === "/overlaps"
        ? "overlaps"
        : location.pathname === "/resolution-integrity"
          ? "resolution-integrity"
        : location.pathname === "/next-actions"
          ? "next-actions"
        : location.pathname === "/ripple-radar"
          ? "ripple-radar"
          : "overview";
  const pageTitle =
    currentPage === "complaints"
      ? "Complaint register"
      : currentPage === "overlaps"
        ? "Overlap review"
        : currentPage === "resolution-integrity"
          ? "Resolution integrity"
        : currentPage === "next-actions"
          ? "Next actions"
        : currentPage === "ripple-radar"
          ? "Ripple Radar"
        : "Overview";
  const [stats, setStats] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seenComplaintIds, setSeenComplaintIds] = useState(new Set());
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [bureauFilter, setBureauFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [showNewCase, setShowNewCase] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [updateError, setUpdateError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [overlapAlerts, setOverlapAlerts] = useState([]);
  const [reviewingAlertId, setReviewingAlertId] = useState(null);
  const [reviewError, setReviewError] = useState("");
  const [reviewNotes, setReviewNotes] = useState({});
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [historyCase, setHistoryCase] = useState(null);
  const [caseHistory, setCaseHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [slaSummary, setSlaSummary] = useState(null);
  const [slaCases, setSlaCases] = useState([]);
  const [slaFilter, setSlaFilter] = useState("ALL");
  const [slaBureauFilter, setSlaBureauFilter] = useState("");
  const [slaPriorityFilter, setSlaPriorityFilter] = useState("");
  const [slaSearch, setSlaSearch] = useState("");
  const [slaLoading, setSlaLoading] = useState(false);
  const [slaError, setSlaError] = useState("");
  const [resolutionCases, setResolutionCases] = useState([]);
  const [resolutionLoading, setResolutionLoading] = useState(false);
  const [resolutionError, setResolutionError] = useState("");
  const [resolutionSavingId, setResolutionSavingId] = useState(null);
  const [resolutionReviewId, setResolutionReviewId] = useState(null);
  const [nextActionCases, setNextActionCases] = useState([]);
  const [nextActionLoading, setNextActionLoading] = useState(false);
  const [nextActionError, setNextActionError] = useState("");
  const [nextActionSavingId, setNextActionSavingId] = useState(null);
  const [rippleClusters, setRippleClusters] = useState([]);
  const [rippleCategoryTrends, setRippleCategoryTrends] = useState([]);
  const [rippleTrendWindowDays, setRippleTrendWindowDays] = useState(30);
  const [rippleLoading, setRippleLoading] = useState(false);
  const [rippleError, setRippleError] = useState("");
  const [rippleStatus, setRippleStatus] = useState("ALL");
  const [rippleScanning, setRippleScanning] = useState(false);
  const [rippleReviewingId, setRippleReviewingId] = useState(null);
  const [updateIntegrity, setUpdateIntegrity] = useState(null);
  const hasLoadedComplaints = useRef(false);
  const notificationsRef = useRef(null);

  const loadSlaData = useCallback(async () => {
    setSlaLoading(true);
    setSlaError("");

    try {
      const nextSla = await getSlaCases();
      setSlaSummary(nextSla.summary);
      setSlaCases(nextSla.data || []);
    } catch (err) {
      setSlaSummary(null);
      setSlaCases([]);
      setSlaError(
        err.response?.data?.message || "Could not load SLA monitoring data."
      );
    } finally {
      setSlaLoading(false);
    }
  }, []);

  const loadResolutionCases = useCallback(async () => {
    setResolutionLoading(true);
    setResolutionError("");

    try {
      const nextCases = await getResolutionIntegrityCases();
      setResolutionCases(nextCases);
    } catch (err) {
      setResolutionError(
        err.response?.data?.message ||
          "Could not load resolution integrity checks."
      );
    } finally {
      setResolutionLoading(false);
    }
  }, []);

  const loadNextActions = useCallback(async () => {
    setNextActionLoading(true);
    setNextActionError("");

    try {
      const result = await getNextActions();
      setNextActionCases(result);
    } catch (err) {
      setNextActionError(
        err.response?.data?.message || "Could not load next-action recommendations."
      );
    } finally {
      setNextActionLoading(false);
    }
  }, []);

  const loadRippleClusters = useCallback(async () => {
    setRippleLoading(true);
    setRippleError("");
    try {
      const result = await getRippleClusters(rippleStatus);
      setRippleClusters(result.clusters);
      setRippleCategoryTrends(result.category_trends);
      setRippleTrendWindowDays(result.trend_window_days || 30);
    } catch (err) {
      setRippleError(
        err.response?.data?.message || "Could not load Ripple Radar patterns."
      );
    } finally {
      setRippleLoading(false);
    }
  }, [rippleStatus]);

  const loadData = useCallback(async () => {
    const slaRequest = loadSlaData();

    try {
      const [nextStats, nextCases, nextAlerts] = await Promise.all([
        getDashboardStats(),
        getCases(linkedCaseNumber ? { search: linkedCaseNumber } : {}),
        getOverlapAlerts("ALL"),
      ]);

      setError("");
      setStats(nextStats);
      setCases(nextCases);
      setOverlapAlerts(nextAlerts);
      if (!hasLoadedComplaints.current) {
        setSeenComplaintIds(new Set(nextCases.map((item) => String(item.id))));
        hasLoadedComplaints.current = true;
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not connect to the API. Check that the backend is running on port 5001."
      );
    } finally {
      setLoading(false);
    }

    await slaRequest;
  }, [linkedCaseNumber, loadSlaData]);

  async function handleDashboardRefresh() {
    if (refreshing) return;

    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleLogout() {
    try {
      await logout();
      onLogout();
    } catch (logoutError) {
      if (logoutError.response?.status !== 401) {
        setError("Could not sign out. Please try again.");
      }
    }
  }

  function handleNotificationToggle() {
    if (!notificationsOpen) {
      setSeenComplaintIds(
        (currentSeen) =>
          new Set([
            ...currentSeen,
            ...cases.map((item) => String(item.id)),
          ])
      );
    }

    setNotificationsOpen((isOpen) => !isOpen);
  }

  function handleComplaintNotificationClick(item) {
    setSearch(item.case_number);
    setNotificationsOpen(false);
  }

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

  useEffect(() => {
    if (currentPage === "resolution-integrity") {
      void Promise.resolve().then(loadResolutionCases);
    }
  }, [currentPage, loadResolutionCases]);

  useEffect(() => {
    if (currentPage === "next-actions") {
      void Promise.resolve().then(loadNextActions);
    }
  }, [currentPage, loadNextActions]);

  useEffect(() => {
    if (currentPage === "ripple-radar") {
      void Promise.resolve().then(loadRippleClusters);
    }
  }, [currentPage, loadRippleClusters]);

  useEffect(() => {
    if (!notificationsOpen) return undefined;

    function handleOutsideClick(event) {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target)
      ) {
        setNotificationsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [notificationsOpen]);

  async function handleOverlapReview(alert, decision) {
    setReviewingAlertId(alert.alert_id);
    setReviewError("");

    try {
      await reviewOverlap(
        alert.alert_id,
        decision,
        reviewNotes[alert.alert_id] || ""
      );
      await loadData();
    } catch (err) {
      setReviewError(
        err.response?.data?.message || "Could not save the review."
      );
    } finally {
      setReviewingAlertId(null);
    }
  }

  async function handleOverlapScan() {
    setScanning(true);
    setScanMessage("");
    setReviewError("");

    try {
      const result = await scanOverlaps();
      setScanMessage(
        `Scan complete: ${result.cases_scanned} cases scanned; ${result.candidates_found} candidate pair(s) found.`
      );
      await loadData();
    } catch (err) {
      setReviewError(
        err.response?.data?.message || "Overlap scan failed."
      );
    } finally {
      setScanning(false);
    }
  }

  async function handleViewHistory(item) {
    setHistoryCase(item);
    setCaseHistory([]);
    setHistoryError("");
    setHistoryLoading(true);

    try {
      const result = await getCaseHistory(item.id);
      // The history API returns { success, data: { case, count, history } }.
      // The fallback also tolerates an API helper that returns the nested data object.
      const payload = result?.data?.history
        ? result.data
        : result?.history
          ? result
          : null;

      if (!payload) {
        throw new Error("The history API returned an unexpected response.");
      }

      setCaseHistory(Array.isArray(payload.history) ? payload.history : []);
    } catch (err) {
      setHistoryError(
        err.response?.data?.message ||
          err.message ||
          "Could not load case history. Please try again."
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  const filteredCases = useMemo(() => {
    const query = search.trim().toLowerCase();

    return cases.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.case_number,
          item.subject,
          item.institution_name,
          item.permanent_id,
          item.bureau_name,
        ].some((value) => value?.toLowerCase().includes(query));

      return (
        matchesSearch &&
        (!statusFilter || item.status === statusFilter) &&
        (!bureauFilter || item.bureau_name === bureauFilter) &&
        (!priorityFilter || item.priority === priorityFilter)
      );
    });
  }, [cases, search, statusFilter, bureauFilter, priorityFilter]);

  const bureauData = stats?.by_bureau || [];
  const statusData = stats?.by_status || [];
  const totals = stats?.totals || {};

  const uniqueBureaus = [...new Set(cases.map((item) => item.bureau_name))];
  const filteredSlaCases = useMemo(() => {
    const query = slaSearch.trim().toLowerCase();

    return slaCases.filter((item) => {
      const matchesRisk =
        slaFilter === "ALL" ||
        (slaFilter === "ESCALATION_REQUIRED"
          ? item.sla?.escalation_required
          : item.sla?.risk_level === slaFilter);
      const matchesBureau =
        !slaBureauFilter || item.bureau_name === slaBureauFilter;
      const matchesPriority =
        !slaPriorityFilter || item.priority === slaPriorityFilter;
      const matchesSearch =
        !query ||
        [
          item.case_number,
          item.subject,
          item.institution_name,
          item.permanent_id,
          item.bureau_name,
          item.sla?.explanation,
          item.sla?.recommended_action,
        ].some((value) => value?.toLowerCase().includes(query));

      return matchesRisk && matchesBureau && matchesPriority && matchesSearch;
    });
  }, [
    slaCases,
    slaFilter,
    slaBureauFilter,
    slaPriorityFilter,
    slaSearch,
  ]);
  const unreadComplaints = cases.filter(
    (item) => !seenComplaintIds.has(String(item.id))
  );


  async function handleStatusChange(item, nextStatus) {
    setUpdatingId(item.id);
    setUpdateError("");
    setUpdateIntegrity(null);

    try {
      const result = await updateCaseStatus(
        item.id,
        nextStatus,
        "Status updated from dashboard"
      );
      setUpdateIntegrity(result.data?.resolution_integrity || null);
      await loadData();
    } catch (err) {
      setUpdateIntegrity(
        err.response?.data?.data?.resolution_integrity || null
      );
      setUpdateError(
        err.response?.data?.message || "Could not update complaint status."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleSaveResolution(caseId, details) {
    setResolutionSavingId(caseId);
    try {
      const saved = await saveResolutionDetails(caseId, details);
      await loadResolutionCases();
      return saved;
    } finally {
      setResolutionSavingId(null);
    }
  }

  async function handleReviewResolution(caseId, decision, notes) {
    setResolutionReviewId(caseId);
    try {
      await reviewResolutionIntegrity(caseId, decision, notes);
      await Promise.all([loadResolutionCases(), loadData()]);
    } finally {
      setResolutionReviewId(null);
    }
  }

  async function handleNextActionDecision(item, payload) {
    setNextActionSavingId(item.id);
    try {
      return await recordNextActionDecision(item.id, payload);
    } finally {
      setNextActionSavingId(null);
    }
  }

  async function handleNextActionOutcome(item, decisionId, outcome) {
    setNextActionSavingId(item.id);
    try {
      await recordNextActionOutcome(item.id, decisionId, outcome);
    } finally {
      setNextActionSavingId(null);
    }
  }

  async function handleRippleScan() {
    setRippleScanning(true);
    try {
      const result = await scanRippleRadar();
      await loadRippleClusters();
      return result;
    } finally {
      setRippleScanning(false);
    }
  }

  async function handleRippleReview(cluster, payload) {
    setRippleReviewingId(cluster.id);
    try {
      const result = await reviewRippleCluster(cluster.id, payload);
      await loadRippleClusters();
      return result;
    } finally {
      setRippleReviewingId(null);
    }
  }

  async function handleRippleCandidateSearch(cluster, searchValue) {
    return getRippleCandidates(cluster.id, searchValue);
  }

  return (
    <div className="brand-shell min-h-screen bg-[#f5f7fb] text-slate-800">
      <div className="flex min-h-screen">
        {mobileNav && (
          <button
            className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
            onClick={() => setMobileNav(false)}
            aria-label="Close navigation"
          />
        )}

        <aside
          className={`brand-sidebar fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${
            mobileNav ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Link
            to="/"
            onClick={() => setMobileNav(false)}
            className="flex h-20 items-center gap-3 border-b border-slate-100 px-6 text-inherit no-underline"
            aria-label="Go to overview"
          >
            <div className="brand-brandmark rounded-xl bg-blue-600 p-2.5 text-white">
              <ShieldCheck size={23} />
            </div>
            <div>
              <p className="brand-wordmark font-bold tracking-tight text-slate-900">AICTE</p>
              <p className="brand-tagline text-xs text-slate-500">Grievance Intelligence</p>
            </div>
          </Link>

          <nav className="flex-1 space-y-2 px-4 py-6">
            <p className="brand-sidebar-label px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Workspace
            </p>
            <Link
              to="/"
              onClick={() => setMobileNav(false)}
              className={`brand-nav-link flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${
                currentPage === "overview" ? "is-active" : ""
              }`}
              aria-current={currentPage === "overview" ? "page" : undefined}
            >
              <LayoutDashboard size={18} /> Overview
            </Link>
            <Link
              to="/complaints"
              onClick={() => setMobileNav(false)}
              className={`brand-nav-link flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
                currentPage === "complaints" ? "is-active" : ""
              }`}
              aria-current={currentPage === "complaints" ? "page" : undefined}
            >
              <FileText size={18} /> Complaint register
              <span className="brand-nav-count ml-auto rounded-lg bg-slate-100 px-2 py-0.5 text-xs">
                {totals.total_cases ?? 0}
              </span>
            </Link>
            <Link
              to="/overlaps"
              onClick={() => setMobileNav(false)}
              className={`brand-nav-link flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
                currentPage === "overlaps" ? "is-active" : ""
              }`}
              aria-current={currentPage === "overlaps" ? "page" : undefined}
            >
              <AlertTriangle size={18} /> Overlap review
              {overlapAlerts.some((alert) => alert.alert_status === "PENDING") && (
                <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                  {overlapAlerts.filter((alert) => alert.alert_status === "PENDING").length}
                </span>
              )}
            </Link>
            <Link
              to="/resolution-integrity"
              onClick={() => setMobileNav(false)}
              className={`brand-nav-link flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
                currentPage === "resolution-integrity" ? "is-active" : ""
              }`}
              aria-current={
                currentPage === "resolution-integrity" ? "page" : undefined
              }
            >
              <ClipboardCheck size={18} /> Resolution integrity
            </Link>
            <Link
              to="/next-actions"
              onClick={() => setMobileNav(false)}
              className={`brand-nav-link flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
                currentPage === "next-actions" ? "is-active" : ""
              }`}
              aria-current={currentPage === "next-actions" ? "page" : undefined}
            >
              <Compass size={18} /> What should we do next?
            </Link>
            <Link
              to="/ripple-radar"
              onClick={() => setMobileNav(false)}
              className={`brand-nav-link flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
                currentPage === "ripple-radar" ? "is-active" : ""
              }`}
              aria-current={currentPage === "ripple-radar" ? "page" : undefined}
            >
              <Radar size={18} /> Institutional Ripple Radar
            </Link>

            <p className="brand-sidebar-label px-3 pb-2 pt-7 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              System
            </p>
            <div className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-500">
              <Building2 size={18} /> Institution directory
            </div>
            <div className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-500">
              <Users size={18} /> Officer assignments
            </div>
          </nav>

          <div className="brand-side-note m-4 rounded-2xl bg-slate-900 p-4 text-white">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CircleHelp size={17} /> Prototype workspace
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              Demonstration data only. Review potential overlaps before taking
              action.
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="brand-topbar sticky top-0 z-20 flex h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setMobileNav(true)}
                className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu size={21} />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  Workspace <span>/</span> {pageTitle}
                </div>
                <h1 className="mt-1 truncate text-lg font-bold text-slate-900 md:text-xl">
                  {pageTitle === "Overview"
                    ? "Complaint intelligence"
                    : pageTitle}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-slate-800">
                  {user.full_name}
                </p>
                <p className="text-xs text-slate-500">
                  {formatLabel(user.role)}
                  {user.bureau_name ? ` · ${user.bureau_name}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="brand-icon-button inline-flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={17} />
                <span className="hidden md:inline">Sign out</span>
              </button>
              <button
                onClick={handleDashboardRefresh}
                disabled={refreshing}
                className="brand-icon-button inline-flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50 disabled:cursor-wait"
                aria-label={refreshing ? "Refreshing dashboard" : "Refresh dashboard"}
                title={refreshing ? "Refreshing data..." : "Refresh data"}
              >
                <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
                {refreshing && <span role="status">Refreshing...</span>}
              </button>
              <div className="brand-notification relative" ref={notificationsRef}>
                <button
                  type="button"
                  onClick={handleNotificationToggle}
                  className="brand-icon-button relative rounded-xl border border-slate-200 p-2.5 text-slate-600"
                  aria-label={`New complaints: ${unreadComplaints.length}`}
                  aria-expanded={notificationsOpen}
                  aria-controls="complaint-notifications"
                  title="New complaints"
                >
                  <Bell size={18} />
                  {unreadComplaints.length > 0 && (
                    <span className="brand-notification-count">
                      {unreadComplaints.length > 9
                        ? "9+"
                        : unreadComplaints.length}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <section
                    id="complaint-notifications"
                    className="brand-notification-panel"
                    aria-label="Recent complaints"
                  >
                    <h2>Recent complaints</h2>
                    {cases.length === 0 ? (
                      <p>No complaints have been raised yet.</p>
                    ) : (
                      <ul>
                        {cases.slice(0, 5).map((item) => (
                          <li key={item.id}>
                            <Link
                              to="/complaints"
                              onClick={() =>
                                handleComplaintNotificationClick(item)
                              }
                            >
                              <strong>{item.case_number}</strong>
                              <span>{item.subject}</span>
                              <small>
                                {item.institution_name} ·{" "}
                                {formatDateTime(item.received_at)}
                              </small>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}
              </div>
            </div>
          </header>

          <div className="brand-content mx-auto max-w-[1600px] space-y-6 p-4 md:p-8">
            <section className="brand-intro flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="brand-kicker text-sm font-medium text-blue-700">
                  {currentPage === "overview"
                    ? "Institution grievance monitoring"
                    : currentPage === "complaints"
                      ? "All submitted cases"
                      : currentPage === "overlaps"
                        ? "Review flagged complaint pairs"
                        : currentPage === "next-actions"
                          ? "Review explainable action suggestions"
                            : currentPage === "ripple-radar"
                              ? "Review suggested cross-complaint patterns"
                            : "Review closure records"}
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                  {currentPage === "overview"
                    ? "Good day, Administrator"
                    : pageTitle}
                </h2>
                <p className="brand-intro-copy mt-2 text-sm text-slate-500">
                  {currentPage === "overview"
                    ? "A consolidated view of complaint activity across bureaus."
                    : currentPage === "complaints"
                      ? "Search, review, and update institution-related complaints."
                      : currentPage === "overlaps"
                        ? "Assess potential duplicates and record review decisions."
                        : currentPage === "next-actions"
                          ? "Consider context-based suggestions and record an official decision separately from the action outcome."
                            : currentPage === "ripple-radar"
                              ? "Investigate potential complaint clusters, inspect why cases were matched, and record a human review decision."
                            : "Inspect closure details, evidence references, and review warnings."}
                </p>
              </div>
              {currentPage !== "overlaps" &&
                currentPage !== "next-actions" &&
                currentPage !== "ripple-radar" && (
                <button
                  onClick={() => setShowNewCase(true)}
                  className="brand-primary-button inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  <Plus size={18} /> Register complaint
                </button>
              )}
            </section>

            {error && (
              <div
                role="alert"
                className="flex flex-col justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center"
              >
                <p>{error}</p>
                <button
                  onClick={loadData}
                  className="font-semibold underline"
                >
                  Retry
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex min-h-60 items-center justify-center gap-3 text-sm text-slate-500">
                <LoaderCircle className="animate-spin" size={22} />
                Loading live dashboard data...
              </div>
            ) : (
              <>
                {currentPage === "overview" && (
                  <>
                <section className="brand-stat-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    title="Total complaints"
                    value={totals.total_cases}
                    description="All registered cases"
                    icon={FileText}
                    tone="bg-blue-50 text-blue-700"
                  />
                  <StatCard
                    title="Open cases"
                    value={totals.open_cases}
                    description="Awaiting closure"
                    icon={Clock3}
                    tone="bg-amber-50 text-amber-700"
                    trend="warning"
                  />
                  <StatCard
                    title="Resolved cases"
                    value={totals.resolved_cases}
                    description="Marked as resolved"
                    icon={CheckCircle2}
                    tone="bg-emerald-50 text-emerald-700"
                    trend="good"
                  />
                  <StatCard
                    title="Urgent complaints"
                    value={totals.urgent_cases}
                    description="Open urgent priority cases"
                    icon={AlertTriangle}
                    tone="bg-rose-50 text-rose-700"
                    trend="warning"
                  />
                </section>

                <section id="sla" className="brand-sla space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      SLA monitoring and smart escalation
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Monitor complaint deadlines and identify cases requiring officer attention.
                    </p>
                  </div>

                  {slaError && (
                    <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
                      {slaError}
                    </p>
                  )}

                  <div className="brand-risk-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    {[
                      {
                        label: "On track",
                        key: "on_track",
                        style: "risk-steady",
                      },
                      {
                        label: "At risk",
                        key: "at_risk",
                        style: "risk-watch",
                      },
                      {
                        label: "Critical",
                        key: "critical",
                        style: "risk-alert",
                      },
                      {
                        label: "Overdue",
                        key: "overdue",
                        style: "risk-alert",
                      },
                      {
                        label: "Escalation required",
                        key: "escalation_required",
                        style: "risk-alert",
                      },
                    ].map((card) => (
                      <button
                        key={card.key}
                        type="button"
                        onClick={() =>
                          setSlaFilter(
                            card.key === "escalation_required"
                              ? "ESCALATION_REQUIRED"
                              : card.key.toUpperCase()
                          )
                        }
                        className="brand-risk-card rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-300"
                      >
                        <p className="text-sm font-medium text-slate-500">
                          {card.label}
                        </p>
                        <p className={`brand-risk-count mt-3 inline-flex rounded-lg px-3 py-1.5 text-2xl font-bold ${card.style}`}>
                          {slaSummary?.[card.key] ?? 0}
                        </p>
                      </button>
                    ))}
                  </div>

                  <article className="brand-panel overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
                      <div>
                        <h4 className="font-bold text-slate-900">SLA risk register</h4>
                        <p className="mt-1 text-sm text-slate-500">
                          Complaints ranked by deadline risk.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <input
                          value={slaSearch}
                          onChange={(event) => setSlaSearch(event.target.value)}
                          placeholder="Search SLA cases..."
                          aria-label="Search SLA cases"
                          className="min-w-40 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                        />
                        <select
                          value={slaFilter}
                          onChange={(event) => setSlaFilter(event.target.value)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                          aria-label="Filter SLA risk"
                        >
                          <option value="ALL">All risks</option>
                          <option value="ON_TRACK">On track</option>
                          <option value="AT_RISK">At risk</option>
                          <option value="CRITICAL">Critical</option>
                          <option value="OVERDUE">Overdue</option>
                          <option value="ESCALATION_REQUIRED">Escalation required</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="NO_DEADLINE">No deadline</option>
                          <option value="INVALID_DEADLINE">Invalid deadline</option>
                        </select>
                        <select
                          value={slaBureauFilter}
                          onChange={(event) => setSlaBureauFilter(event.target.value)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                          aria-label="Filter SLA bureau"
                        >
                          <option value="">All bureaus</option>
                          {uniqueBureaus.map((bureau) => (
                            <option key={bureau} value={bureau}>{bureau}</option>
                          ))}
                        </select>
                        <select
                          value={slaPriorityFilter}
                          onChange={(event) => setSlaPriorityFilter(event.target.value)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                          aria-label="Filter SLA priority"
                        >
                          <option value="">All priorities</option>
                          {["LOW", "MEDIUM", "HIGH", "URGENT"].map((priority) => (
                            <option key={priority} value={priority}>
                              {formatLabel(priority)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={loadSlaData}
                          disabled={slaLoading}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <RefreshCw size={15} className={slaLoading ? "animate-spin" : ""} />
                          Refresh
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1050px] text-left">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                          <tr>
                            <th className="px-5 py-3">Complaint</th>
                            <th className="px-4 py-3">Institution</th>
                            <th className="px-4 py-3">Bureau</th>
                            <th className="px-4 py-3">Due date</th>
                            <th className="px-4 py-3">SLA risk</th>
                            <th className="px-4 py-3">Recommended action</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                          {slaLoading ? (
                            <tr>
                              <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                                Loading SLA risks...
                              </td>
                            </tr>
                          ) : slaError ? (
                            <tr>
                              <td colSpan={6} className="px-5 py-10 text-center">
                                <p className="text-sm text-rose-700">{slaError}</p>
                                <button
                                  type="button"
                                  onClick={loadSlaData}
                                  className="mt-3 rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
                                >
                                  Retry
                                </button>
                              </td>
                            </tr>
                          ) : (
                            <>
                              {filteredSlaCases.map((item) => {
                                  const risk = item.sla?.risk_level || "NO_DEADLINE";
                                  const riskStyle = {
                                    ON_TRACK: "bg-[#e8eee6] text-[#1f493c]",
                                    AT_RISK: "bg-[#f0ead8] text-[#78663b]",
                                    CRITICAL: "bg-[#f2e8d8] text-[#88663d]",
                                    OVERDUE: "bg-[#f2e3da] text-[#984c36]",
                                    COMPLETED: "bg-slate-100 text-slate-700",
                                    NO_DEADLINE: "bg-slate-100 text-slate-600",
                                    INVALID_DEADLINE: "bg-[#eee5df] text-[#785b4c]",
                                  };

                                  return (
                                    <tr key={item.id} className="hover:bg-slate-50">
                                      <td className="px-5 py-4">
                                        <p className="text-xs font-semibold text-blue-700">
                                          {item.case_number}
                                        </p>
                                        <p className="mt-1 text-sm font-medium text-slate-800">
                                          {item.subject}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                          {formatLabel(item.priority)} priority · {formatLabel(item.status)}
                                        </p>
                                      </td>

                                      <td className="px-4 py-4 text-sm text-slate-600">
                                        {item.institution_name}
                                        <p className="mt-1 text-xs text-slate-400">{item.permanent_id}</p>
                                      </td>

                                      <td className="px-4 py-4 text-sm text-slate-600">
                                        {item.bureau_name}
                                      </td>

                                      <td className="px-4 py-4 text-sm text-slate-600">
                                        {formatDate(item.due_date)}
                                        {risk === "OVERDUE" && (
                                          <p className="mt-1 text-xs font-semibold text-rose-600">
                                            {Math.abs(item.sla?.hours_remaining ?? 0)} hours past due
                                          </p>
                                        )}
                                        {["ON_TRACK", "AT_RISK", "CRITICAL"].includes(risk) && (
                                          <p className="mt-1 text-xs text-slate-500">
                                            {item.sla?.hours_remaining ?? "—"} hours remaining
                                          </p>
                                        )}
                                      </td>

                                      <td className="px-4 py-4">
                                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${riskStyle[risk] || "bg-slate-100 text-slate-600"}`}>
                                          {formatLabel(risk)}
                                        </span>
                                        {item.sla?.escalation_required && (
                                          <p className="mt-2 text-xs font-semibold text-rose-600">
                                            Escalation required
                                          </p>
                                        )}
                                      </td>

                                      <td className="max-w-xs px-4 py-4 text-sm text-slate-600">
                                        <p>{item.sla?.explanation || "Review the recorded complaint deadline and status."}</p>
                                        <p className="mt-2 font-medium text-slate-800">
                                          {item.sla?.recommended_action || "Review complaint"}
                                        </p>
                                      </td>
                                    </tr>
                                  );
                              })}

                              {filteredSlaCases.length === 0 && (
                                <tr>
                                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                                    No complaints match these SLA filters.
                                  </td>
                                </tr>
                              )}
                            </>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </article>
                </section>

                <section className="brand-chart-grid grid gap-6 xl:grid-cols-5">
                  <article className="brand-panel rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm xl:col-span-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-slate-900">
                          Complaints by bureau
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Distribution across participating bureaus
                        </p>
                      </div>
                      <span className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                        Live data
                      </span>
                    </div>
                    <div className="mt-5 h-64">
                      {bureauData.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={bureauData}
                            margin={{ top: 8, right: 8, left: -18, bottom: 8 }}
                          >
                            <CartesianGrid
                              stroke="#eef2f7"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="bureau_name"
                              tick={{ fontSize: 11, fill: "#64748b" }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              allowDecimals={false}
                              tick={{ fontSize: 11, fill: "#64748b" }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip />
                            <Bar
                              dataKey="total"
                              name="Complaints"
                              fill="#1f493c"
                              radius={[0, 0, 0, 0]}
                              maxBarSize={54}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="py-20 text-center text-sm text-slate-400">
                          No bureau data available yet.
                        </p>
                      )}
                    </div>
                  </article>

                  <article className="brand-panel rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm xl:col-span-2">
                    <h3 className="font-bold text-slate-900">
                      Case status breakdown
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Current workflow distribution
                    </p>
                    <div className="relative mt-2 h-48">
                      {statusData.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={statusData}
                              dataKey="total"
                              nameKey="status"
                              innerRadius={53}
                              outerRadius={78}
                              paddingAngle={3}
                            >
                              {statusData.map((entry, index) => (
                                <Cell
                                  key={entry.status}
                                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value, name) => [
                                value,
                                formatLabel(name),
                              ]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="py-16 text-center text-sm text-slate-400">
                          No status data available yet.
                        </p>
                      )}
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-slate-900">
                          {totals.total_cases ?? 0}
                        </span>
                        <span className="text-xs text-slate-500">Cases</span>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                      {statusData.map((entry, index) => (
                        <div
                          key={entry.status}
                          className="flex items-center gap-2 text-xs text-slate-500"
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{
                              backgroundColor:
                                CHART_COLORS[index % CHART_COLORS.length],
                            }}
                          />
                          {formatLabel(entry.status)} ({entry.total})
                        </div>
                      ))}
                    </div>
                  </article>
                </section>
                  </>
                )}

                {currentPage === "overlaps" && (
                <section
                  id="overlaps"
                  className="brand-overlap-panel rounded-2xl border border-amber-200 bg-amber-50/70 p-5"
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex items-start gap-3">
                      <div className="brand-overlap-icon rounded-xl bg-amber-100 p-2.5 text-amber-700">
                        <AlertTriangle size={21} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">
                          Cross-bureau overlap review
                        </h3>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                          Review saved candidate pairs, their text-similarity scores,
                          and the evidence behind each flag. Similarity is not proof
                          of duplication; an officer makes the final decision.
                        </p>
                      </div>
                    </div>
                    {canManageCases && <button
                      onClick={handleOverlapScan}
                      disabled={scanning}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      <RefreshCw size={16} className={scanning ? "animate-spin" : ""} />
                      {scanning ? "Scanning..." : "Run overlap scan"}
                    </button>}
                  </div>

                  {scanMessage && (
                    <p className="mt-4 rounded-lg bg-white p-3 text-sm text-emerald-700">
                      {scanMessage}
                    </p>
                  )}

                  {reviewError && (
                    <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                      {reviewError}
                    </p>
                  )}

                  {overlapAlerts.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-white p-5 text-sm text-slate-500">
                      No saved alerts yet. Run an overlap scan to look for candidate pairs.
                    </div>
                  ) : (
                    <div className="mt-5 space-y-4">
                      {overlapAlerts.map((alert) => {
                        const explanation =
                          typeof alert.explanation === "object" && alert.explanation
                            ? alert.explanation
                            : {};
                        const isPending = alert.alert_status === "PENDING";
                        const score = Number(alert.confidence_score || 0);

                        return (
                          <article
                            key={alert.alert_id}
                            className="rounded-xl border border-slate-200 bg-white p-4"
                          >
                            <div className="flex flex-col justify-between gap-3 sm:flex-row">
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {alert.institution_name}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  Permanent ID: {alert.permanent_id}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                                  Text similarity: {score}/100
                                </span>
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  isPending
                                    ? "bg-amber-100 text-amber-800"
                                    : alert.alert_status === "DISMISSED"
                                      ? "bg-slate-100 text-slate-600"
                                      : "bg-emerald-100 text-emerald-800"
                                }`}>
                                  {formatLabel(alert.alert_status)}
                                </span>
                              </div>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              {[
                                {
                                  number: alert.case_number,
                                  subject: alert.subject,
                                  bureau: alert.bureau_name,
                                },
                                {
                                  number: alert.related_case_number,
                                  subject: alert.related_subject,
                                  bureau: alert.related_bureau,
                                },
                              ].map((item) => (
                                <div key={item.number} className="rounded-lg bg-slate-50 p-3">
                                  <p className="text-xs font-semibold text-blue-700">{item.number}</p>
                                  <p className="mt-1 text-sm font-medium text-slate-800">{item.subject}</p>
                                  <p className="mt-2 text-xs text-slate-500">Bureau: {item.bureau}</p>
                                </div>
                              ))}
                            </div>

                            <div className="mt-4">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                Why this was flagged
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {(explanation.explanation || []).map((reason) => (
                                  <span key={reason} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600">
                                    {reason}
                                  </span>
                                ))}
                              </div>
                              {(explanation.matching_terms || []).length > 0 && (
                                <p className="mt-3 text-sm text-slate-600">
                                  Matching terms:{" "}
                                  <span className="font-medium text-slate-800">
                                    {explanation.matching_terms.join(", ")}
                                  </span>
                                </p>
                              )}
                              <p className="mt-2 text-xs text-slate-400">
                                This score measures lexical similarity, not the probability of a duplicate.
                              </p>
                            </div>

                            {isPending && canManageCases ? (
                              <div className="mt-4 border-t border-slate-100 pt-4">
                                <label className="block text-xs font-semibold text-slate-600">
                                  Review notes (optional)
                                  <textarea
                                    value={reviewNotes[alert.alert_id] || ""}
                                    onChange={(event) =>
                                      setReviewNotes((previous) => ({
                                        ...previous,
                                        [alert.alert_id]: event.target.value,
                                      }))
                                    }
                                    rows={2}
                                    maxLength={1000}
                                    placeholder="Explain your decision..."
                                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                                  />
                                </label>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    disabled={reviewingAlertId === alert.alert_id}
                                    onClick={() => handleOverlapReview(alert, "CONFIRMED")}
                                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                  >
                                    <CheckCircle2 size={15} /> Confirm duplicate
                                  </button>
                                  <button
                                    disabled={reviewingAlertId === alert.alert_id}
                                    onClick={() => handleOverlapReview(alert, "RELATED")}
                                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    <FileText size={15} /> Mark related
                                  </button>
                                  <button
                                    disabled={reviewingAlertId === alert.alert_id}
                                    onClick={() => handleOverlapReview(alert, "DISMISSED")}
                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    <XCircle size={15} /> Dismiss
                                  </button>
                                </div>
                              </div>
                            ) : isPending ? (
                              <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                                An authorized officer must review this alert.
                              </p>
                            ) : (
                              <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                                This alert has been reviewed. Saved status:{" "}
                                <strong>{formatLabel(alert.alert_status)}</strong>.
                              </p>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
                )}

                {currentPage === "resolution-integrity" && (
                  <ResolutionIntegrityPage
                    cases={resolutionCases}
                    loading={resolutionLoading}
                    error={resolutionError}
                    canManage={canManageCases}
                    onRefresh={loadResolutionCases}
                    onSave={handleSaveResolution}
                    onReview={handleReviewResolution}
                    savingId={resolutionSavingId}
                    reviewId={resolutionReviewId}
                  />
                )}

                {currentPage === "next-actions" && (
                  <NextActionsPage
                    cases={nextActionCases}
                    loading={nextActionLoading}
                    error={nextActionError}
                    canManage={canManageCases}
                    onRefresh={loadNextActions}
                    onDecision={handleNextActionDecision}
                    onOutcome={handleNextActionOutcome}
                    savingId={nextActionSavingId}
                  />
                )}

                {currentPage === "ripple-radar" && (
                  <RippleRadarPage
                    clusters={rippleClusters}
                    categoryTrends={rippleCategoryTrends}
                    trendWindowDays={rippleTrendWindowDays}
                    loading={rippleLoading}
                    error={rippleError}
                    status={rippleStatus}
                    onStatusChange={setRippleStatus}
                    canScan={user.role === "ADMIN"}
                    canReview={canManageCases}
                    onRefresh={loadRippleClusters}
                    onScan={handleRippleScan}
                    onReview={handleRippleReview}
                    onFindCandidates={handleRippleCandidateSearch}
                    scanning={rippleScanning}
                    reviewingId={rippleReviewingId}
                  />
                )}

                {currentPage === "complaints" && (
                <section
                  id="cases"
                  className="brand-case-panel overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
                >
                  <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center">
                    <div>
                      <h3 className="font-bold text-slate-900">
                        Complaint register
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Search and track institution-related cases
                      </p>
                    </div>
                    {canManageCases && (
                      <button
                        onClick={() => setShowNewCase(true)}
                        className="brand-case-link inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        <Plus size={16} /> New complaint
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row">
                    <div className="relative min-w-0 flex-1">
                      <Search
                        size={17}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search case, institution or Permanent ID..."
                        className="brand-case-search-input w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        className="min-w-36 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                        aria-label="Filter by status"
                      >
                        <option value="">All statuses</option>
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {formatLabel(status)}
                          </option>
                        ))}
                      </select>
                      <select
                        value={bureauFilter}
                        onChange={(event) => setBureauFilter(event.target.value)}
                        className="min-w-36 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                        aria-label="Filter by bureau"
                      >
                        <option value="">All bureaus</option>
                        {uniqueBureaus.map((bureau) => (
                          <option key={bureau} value={bureau}>
                            {bureau}
                          </option>
                        ))}
                      </select>
                      <select
                        value={priorityFilter}
                        onChange={(event) => setPriorityFilter(event.target.value)}
                        className="min-w-32 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                        aria-label="Filter by priority"
                      >
                        <option value="">All priorities</option>
                        {["LOW", "MEDIUM", "HIGH", "URGENT"].map((priority) => (
                          <option key={priority} value={priority}>
                            {formatLabel(priority)}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          setSearch("");
                          setStatusFilter("");
                          setBureauFilter("");
                          setPriorityFilter("");
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                      >
                        <Filter size={15} /> Reset
                      </button>
                    </div>
                  </div>

                  {updateError && (
                    <p
                      role="alert"
                      className="border-b border-rose-100 bg-rose-50 px-5 py-3 text-sm text-rose-700"
                    >
                      {updateError}
                    </p>
                  )}
                  {updateIntegrity && (
                    <div className={`border-b px-5 py-3 text-sm ${
                      updateIntegrity.status === "INCOMPLETE"
                        ? "border-amber-100 bg-amber-50 text-amber-800"
                        : "border-blue-100 bg-blue-50 text-blue-800"
                    }`}>
                      Closure checklist: {formatLabel(updateIntegrity.status)}.
                      {" "}{updateIntegrity.mandatory_failures.length
                        ? `${updateIntegrity.mandatory_failures.length} mandatory item(s) are missing. Review them in Resolution integrity.`
                        : "Human review may still be required."}
                      {" "}{updateIntegrity.blocking_enabled
                        ? "Mandatory closure rules are enabled."
                        : "Checklist is advisory; closure is not blocked."}
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-270 text-left">
                      <thead className="bg-slate-50/80">
                        <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <th className="px-5 py-4">Case details</th>
                          <th className="px-4 py-4">Institution</th>
                          <th className="px-4 py-4">Bureau</th>
                          <th className="px-4 py-4">Priority</th>
                          <th className="px-4 py-4">Due date</th>
                          <th className="px-4 py-4">Status</th>
                          <th className="px-4 py-4">Update status</th>
                          <th className="px-4 py-4">History</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredCases.map((item) => (
                          <tr
                            key={item.id}
                            className="transition hover:bg-slate-50/70"
                          >
                            <td className="px-5 py-4">
                              <p className="text-xs font-semibold text-blue-700">
                                {item.case_number}
                              </p>
                              <p className="mt-1 max-w-64 text-sm font-semibold text-slate-800">
                                {item.subject}
                              </p>
                            </td>
                            <td className="px-4 py-4">
                              <p className="max-w-48 text-sm font-medium text-slate-700">
                                {item.institution_name}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                {item.permanent_id}
                              </p>
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-600">
                              {item.bureau_name}
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={`text-xs font-bold ${PRIORITY_COLORS[item.priority] || ""}`}
                              >
                                {formatLabel(item.priority)}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-500">
                              {formatDate(item.due_date)}
                            </td>
                            <td className="px-4 py-4">
                              <StatusBadge status={item.status} />
                            </td>
                            <td className="px-4 py-4">
                              <div className="relative flex items-center">
                                <select
                                  value={item.status}
                                  disabled={!canManageCases || updatingId === item.id}
                                  onChange={(event) =>
                                    handleStatusChange(item, event.target.value)
                                  }
                                  aria-label={`Update status for ${item.case_number}`}
                                  className="max-w-40 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs outline-none focus:border-blue-500 disabled:opacity-50"
                                >
                                  {STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>
                                      {formatLabel(status)}
                                    </option>
                                  ))}
                                </select>
                                {updatingId === item.id && (
                                  <LoaderCircle
                                    size={14}
                                    className="ml-2 animate-spin text-blue-600"
                                  />
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <button
                                type="button"
                                onClick={() => handleViewHistory(item)}
                                className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                aria-label={`View history for ${item.case_number}`}
                              >
                                <History size={15} /> View history
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredCases.length === 0 && (
                          <tr>
                            <td
                              colSpan={8}
                              className="px-5 py-14 text-center text-sm text-slate-500"
                            >
                              No complaints match these filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col justify-between gap-2 border-t border-slate-100 px-5 py-4 text-xs text-slate-500 sm:flex-row">
                    <span>
                      Showing {filteredCases.length} of {cases.length} cases
                    </span>
                    <span>
                      <span className="font-medium text-slate-700">
                        {overlapAlerts.filter((alert) => alert.alert_status === "PENDING").length}
                      </span>{" "}
                      cross-bureau review candidate group(s)
                    </span>
                  </div>
                </section>
                )}

                <footer className="flex flex-col justify-between gap-2 pb-4 text-xs text-slate-400 sm:flex-row">
                  <span>AICTE Grievance Intelligence · Prototype</span>
                  <span>
                    Data source: MongoDB · API port 5001
                  </span>
                </footer>
              </>
            )}
          </div>
        </main>
      </div>

      {historyCase && (
        <HistoryModal
          caseItem={historyCase}
          history={caseHistory}
          loading={historyLoading}
          error={historyError}
          onClose={() => {
            setHistoryCase(null);
            setCaseHistory([]);
            setHistoryError("");
          }}
        />
      )}

      {showNewCase && canManageCases && (
        <NewCaseModal
          user={user}
          onClose={() => setShowNewCase(false)}
          onCreated={loadData}
        />
      )}
    </div>
  );
}
