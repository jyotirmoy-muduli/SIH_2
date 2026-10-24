import { useEffect, useMemo, useState } from "react";
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
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
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

const CHART_COLORS = ["#2563eb", "#8b5cf6", "#f59e0b", "#10b981", "#f97316"];

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
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {value ?? 0}
          </p>
        </div>
        <div className={`rounded-xl p-3 ${tone}`}>
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

function NewCaseModal({ onClose, onCreated }) {
  const [institutions, setInstitutions] = useState([]);
  const [loadingInstitutions, setLoadingInstitutions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    institution_id: "",
    subject: "",
    description: "",
    bureau_name: "PGRC",
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
        institution_id: Number(form.institution_id),
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

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
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
  const [slaLoading, setSlaLoading] = useState(false);
  const [slaError, setSlaError] = useState("");

  async function loadData() {
    const slaRequest = getSlaCases();
    setSlaLoading(true);
    setSlaError("");

    try {
      const [nextStats, nextCases, nextAlerts] = await Promise.all([
        getDashboardStats(),
        getCases(),
        getOverlapAlerts("ALL"),
      ]);

      setError("");
      setStats(nextStats);
      setCases(nextCases);
      setOverlapAlerts(nextAlerts);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not connect to the API. Check that the backend is running on port 5001."
      );
    } finally {
      setLoading(false);
    }

    try {
      const nextSla = await slaRequest;
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
  }

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, []);

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


  async function handleStatusChange(item, nextStatus) {
    setUpdatingId(item.id);
    setUpdateError("");

    try {
      await updateCaseStatus(
        item.id,
        nextStatus,
        "Status updated from dashboard"
      );
      await loadData();
    } catch (err) {
      setUpdateError(
        err.response?.data?.message || "Could not update complaint status."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-800">
      <div className="flex min-h-screen">
        {mobileNav && (
          <button
            className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
            onClick={() => setMobileNav(false)}
            aria-label="Close navigation"
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${
            mobileNav ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6">
            <div className="rounded-xl bg-blue-600 p-2.5 text-white">
              <ShieldCheck size={23} />
            </div>
            <div>
              <p className="font-bold tracking-tight text-slate-900">AICTE</p>
              <p className="text-xs text-slate-500">Grievance Intelligence</p>
            </div>
          </div>

          <nav className="flex-1 space-y-2 px-4 py-6">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Workspace
            </p>
            <a
              href="#dashboard"
              className="flex items-center gap-3 rounded-xl bg-blue-50 px-3 py-3 text-sm font-semibold text-blue-700"
            >
              <LayoutDashboard size={18} /> Overview
            </a>
            <a
              href="#cases"
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <FileText size={18} /> Complaint register
              <span className="ml-auto rounded-lg bg-slate-100 px-2 py-0.5 text-xs">
                {totals.total_cases ?? 0}
              </span>
            </a>
            <a
              href="#overlaps"
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <AlertTriangle size={18} /> Overlap review
              {overlapAlerts.some((alert) => alert.alert_status === "PENDING") && (
                <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                  {overlapAlerts.filter((alert) => alert.alert_status === "PENDING").length}
                </span>
              )}
            </a>

            <p className="px-3 pb-2 pt-7 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              System
            </p>
            <div className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-500">
              <Building2 size={18} /> Institution directory
            </div>
            <div className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-500">
              <Users size={18} /> Officer assignments
            </div>
          </nav>

          <div className="m-4 rounded-2xl bg-slate-900 p-4 text-white">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CircleHelp size={17} /> Prototype workspace
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              Demonstration data only. Review potential overlaps before taking
              action.
            </p>
          </div>
        </aside>

        <main id="dashboard" className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-8">
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
                  Workspace <span>/</span> Dashboard
                </div>
                <h1 className="mt-1 truncate text-lg font-bold text-slate-900 md:text-xl">
                  Complaint intelligence
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 sm:flex">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                API connected
              </div>
              <button
                onClick={loadData}
                className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"
                aria-label="Refresh dashboard"
                title="Refresh data"
              >
                <RefreshCw size={17} />
              </button>
              <button
                className="relative rounded-xl border border-slate-200 p-2.5 text-slate-600"
                aria-label="Notifications"
                title="Notifications"
              >
                <Bell size={18} />
                {overlapAlerts.some((alert) => alert.alert_status === "PENDING") && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" />
                )}
              </button>
              <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 sm:flex">
                AD
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1600px] space-y-6 p-4 md:p-8">
            <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-medium text-blue-700">
                  Institution grievance monitoring
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                  Good day, Administrator
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  A consolidated view of complaint activity across bureaus.
                </p>
              </div>
              <button
                onClick={() => setShowNewCase(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <Plus size={18} /> Register complaint
              </button>
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
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

                <section id="sla" className="space-y-4">
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

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      {
                        label: "On track",
                        key: "on_track",
                        style: "bg-emerald-50 text-emerald-700",
                      },
                      {
                        label: "At risk",
                        key: "at_risk",
                        style: "bg-amber-50 text-amber-700",
                      },
                      {
                        label: "Overdue",
                        key: "overdue",
                        style: "bg-rose-50 text-rose-700",
                      },
                      {
                        label: "Escalation required",
                        key: "escalation_required",
                        style: "bg-violet-50 text-violet-700",
                      },
                    ].map((card) => (
                      <button
                        key={card.key}
                        type="button"
                        onClick={() =>
                          setSlaFilter(
                            card.key === "escalation_required"
                              ? "OVERDUE"
                              : card.key.toUpperCase()
                          )
                        }
                        className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-300"
                      >
                        <p className="text-sm font-medium text-slate-500">
                          {card.label}
                        </p>
                        <p className={`mt-3 inline-flex rounded-lg px-3 py-1.5 text-2xl font-bold ${card.style}`}>
                          {slaSummary?.[card.key] ?? 0}
                        </p>
                      </button>
                    ))}
                  </div>

                  <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
                      <div>
                        <h4 className="font-bold text-slate-900">SLA risk register</h4>
                        <p className="mt-1 text-sm text-slate-500">
                          Complaints ranked by deadline risk.
                        </p>
                      </div>

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
                        <option value="COMPLETED">Completed</option>
                        <option value="NO_DEADLINE">No deadline</option>
                        <option value="INVALID_DEADLINE">Invalid deadline</option>
                      </select>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[850px] text-left">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                          <tr>
                            <th className="px-5 py-3">Complaint</th>
                            <th className="px-4 py-3">Institution</th>
                            <th className="px-4 py-3">Due date</th>
                            <th className="px-4 py-3">SLA risk</th>
                            <th className="px-4 py-3">Recommended action</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                          {slaLoading ? (
                            <tr>
                              <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                                Loading SLA risks...
                              </td>
                            </tr>
                          ) : (
                            <>
                              {slaCases
                                .filter((item) =>
                                  slaFilter === "ALL" ||
                                  item.sla?.risk_level === slaFilter
                                )
                                .map((item) => {
                                  const risk = item.sla?.risk_level || "NO_DEADLINE";
                                  const riskStyle = {
                                    ON_TRACK: "bg-emerald-50 text-emerald-700",
                                    AT_RISK: "bg-amber-50 text-amber-700",
                                    CRITICAL: "bg-orange-50 text-orange-700",
                                    OVERDUE: "bg-rose-50 text-rose-700",
                                    COMPLETED: "bg-slate-100 text-slate-700",
                                    NO_DEADLINE: "bg-slate-100 text-slate-600",
                                    INVALID_DEADLINE: "bg-violet-50 text-violet-700",
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
                                      </td>

                                      <td className="px-4 py-4 text-sm text-slate-600">
                                        {item.institution_name}
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
                                        {item.sla?.recommended_action || "Review complaint"}
                                      </td>
                                    </tr>
                                  );
                                })}

                              {slaCases.filter((item) =>
                                slaFilter === "ALL" ||
                                item.sla?.risk_level === slaFilter
                              ).length === 0 && (
                                <tr>
                                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                                    No complaints match this SLA risk filter.
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

                <section className="grid gap-6 xl:grid-cols-5">
                  <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm xl:col-span-3">
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
                              fill="#3b82f6"
                              radius={[7, 7, 0, 0]}
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

                  <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm xl:col-span-2">
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

                <section
                  id="overlaps"
                  className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5"
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700">
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
                    <button
                      onClick={handleOverlapScan}
                      disabled={scanning}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      <RefreshCw size={16} className={scanning ? "animate-spin" : ""} />
                      {scanning ? "Scanning..." : "Run overlap scan"}
                    </button>
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

                            {isPending ? (
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

                <section
                  id="cases"
                  className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
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
                    <button
                      onClick={() => setShowNewCase(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      <Plus size={16} /> New complaint
                    </button>
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
                        className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                                  disabled={updatingId === item.id}
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

                <footer className="flex flex-col justify-between gap-2 pb-4 text-xs text-slate-400 sm:flex-row">
                  <span>AICTE Grievance Intelligence · Prototype</span>
                  <span>
                    Data source: local MySQL database · API port 5001
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

      {showNewCase && (
        <NewCaseModal
          onClose={() => setShowNewCase(false)}
          onCreated={loadData}
        />
      )}
    </div>
  );
}
