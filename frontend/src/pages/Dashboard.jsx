
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileText,
  Filter,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
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

  async function loadData() {
    setError("");
    try {
      const [nextStats, nextCases] = await Promise.all([
        getDashboardStats(),
        getCases(),
      ]);
      setStats(nextStats);
      setCases(nextCases);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not connect to the API. Make sure your backend is running on port 5001."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

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

  const possibleOverlaps = useMemo(() => {
    const groups = new Map();

    cases.forEach((item) => {
      if (!groups.has(item.permanent_id)) groups.set(item.permanent_id, []);
      groups.get(item.permanent_id).push(item);
    });

    return [...groups.values()].filter(
      (group) =>
        new Set(group.map((item) => item.bureau_name)).size > 1 &&
        group.length > 1
    );
  }, [cases]);

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
              {possibleOverlaps.length > 0 && (
                <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                  {possibleOverlaps.length}
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
                {possibleOverlaps.length > 0 && (
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
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700">
                        <AlertTriangle size={21} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">
                          Cross-bureau review candidates
                        </h3>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                          Cases from the same institution that appear across
                          different bureaus. These are review candidates, not
                          confirmed duplicates.
                        </p>
                      </div>
                    </div>
                    <span className="w-fit rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800">
                      {possibleOverlaps.length} institution group(s)
                    </span>
                  </div>

                  {possibleOverlaps.length === 0 ? (
                    <p className="mt-4 rounded-xl bg-white/70 p-4 text-sm text-slate-500">
                      No cross-bureau candidates found in the loaded cases.
                    </p>
                  ) : (
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      {possibleOverlaps.map((group) => (
                        <div
                          key={group[0].permanent_id}
                          className="rounded-xl border border-amber-200/80 bg-white p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">
                                {group[0].institution_name}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Permanent ID: {group[0].permanent_id}
                              </p>
                            </div>
                            <AlertTriangle
                              size={18}
                              className="shrink-0 text-amber-600"
                            />
                          </div>
                          <div className="mt-3 space-y-2">
                            {group.map((item) => (
                              <div
                                key={item.id}
                                className="rounded-lg bg-slate-50 p-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-blue-700">
                                    {item.case_number}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {item.bureau_name}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm font-medium text-slate-800">
                                  {item.subject}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
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
                    <table className="w-full min-w-[950px] text-left">
                      <thead className="bg-slate-50/80">
                        <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <th className="px-5 py-4">Case details</th>
                          <th className="px-4 py-4">Institution</th>
                          <th className="px-4 py-4">Bureau</th>
                          <th className="px-4 py-4">Priority</th>
                          <th className="px-4 py-4">Due date</th>
                          <th className="px-4 py-4">Status</th>
                          <th className="px-4 py-4">Update status</th>
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
                          </tr>
                        ))}
                        {filteredCases.length === 0 && (
                          <tr>
                            <td
                              colSpan={7}
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
                        {possibleOverlaps.length}
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

      {showNewCase && (
        <NewCaseModal
          onClose={() => setShowNewCase(false)}
          onCreated={loadData}
        />
      )}
    </div>
  );
}
