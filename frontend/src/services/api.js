
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5001/api",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || "";
    if (
      error.response?.status === 401 &&
      !url.endsWith("/auth/login") &&
      !url.endsWith("/auth/me")
    ) {
      window.dispatchEvent(new Event("sih:auth-required"));
    }
    return Promise.reject(error);
  }
);

export const getCurrentUser = async () => {
  const response = await api.get("/auth/me");
  return response.data.data;
};

export const login = async (credentials) => {
  const response = await api.post("/auth/login", credentials);
  return response.data.data;
};

export const logout = async () => {
  await api.post("/auth/logout");
};

export const getDashboardStats = async () => {
  const response = await api.get("/dashboard/stats");
  return response.data.data;
};

export const getCases = async (filters = {}) => {
  const response = await api.get("/cases", { params: filters });
  return response.data.data;
};

export const getInstitutions = async (search = "") => {
  const response = await api.get("/institutions", {
    params: { search },
  });
  return response.data.data;
};

export const createCase = async (payload) => {
  const response = await api.post("/cases", payload);
  return response.data;
};

export const updateCaseStatus = async (id, status, notes = "") => {
  const response = await api.patch(`/cases/${id}/status`, {
    status,
    notes,
  });
  return response.data;
};

export const getOverlapAlerts = async (status = "ALL") => {
  const response = await api.get("/overlaps", {
    params: { status },
  });
  return response.data.data;
};

export const reviewOverlap = async (alertId, decision, notes = "") => {
  const response = await api.patch(`/overlaps/${alertId}/review`, {
    decision,
    notes,
  });
  return response.data;
};

export const scanOverlaps = async () => {
  const response = await api.post("/overlaps/scan");
  return response.data.data;
};

export const getCaseHistory = async (caseId) => {
  const response = await api.get(`/cases/${caseId}/history`);
  return response.data;
};

export const getResolutionIntegrity = async (caseId) => {
  const response = await api.get(`/cases/${caseId}/resolution-integrity`);
  return response.data.data;
};

export const getResolutionIntegrityCases = async () => {
  const response = await api.get("/cases/resolution-integrity");
  return response.data.data;
};

export const saveResolutionDetails = async (caseId, details) => {
  const response = await api.put(`/cases/${caseId}/resolution`, details);
  return response.data.data;
};

export const reviewResolutionIntegrity = async (caseId, decision, notes = "") => {
  const response = await api.post(
    `/cases/${caseId}/resolution-integrity/review`,
    { decision, notes }
  );
  return response.data.data;
};

export const getNextActions = async () => {
  const response = await api.get("/next-actions");
  return response.data.data;
};

export const recordNextActionDecision = async (
  caseId,
  payload
) => {
  const response = await api.post(
    `/next-actions/${caseId}/decision`,
    payload
  );
  return response.data.data;
};

export const recordNextActionOutcome = async (caseId, decisionId, outcome) => {
  const response = await api.post(`/next-actions/${caseId}/outcome`, {
    decision_id: decisionId,
    outcome,
  });
  return response.data.data;
};

export const getRippleClusters = async (status = "SUGGESTED") => {
  const response = await api.get("/ripple-radar", { params: { status } });
  return {
    clusters: response.data.data,
    category_trends: response.data.category_trends || [],
    trend_window_days: response.data.trend_window_days,
  };
};

export const scanRippleRadar = async () => {
  const response = await api.post("/ripple-radar/scan");
  return response.data.data;
};

export const reviewRippleCluster = async (clusterId, payload) => {
  const response = await api.post(
    `/ripple-radar/${clusterId}/review`,
    payload
  );
  return response.data.data;
};

export const getRippleCandidates = async (clusterId, search) => {
  const response = await api.get(
    `/ripple-radar/${clusterId}/candidates`,
    { params: { search } }
  );
  return response.data.data;
};


export const getSlaRisks = async (filters = {}) => {
  const params =
    typeof filters === "string"
      ? filters && filters !== "ALL"
        ? { risk: filters }
        : {}
      : Object.fromEntries(
          Object.entries(filters).filter(([, value]) => value && value !== "ALL")
        );
  const response = await api.get("/sla/risks", { params });
  return response.data;
};

export const getSlaCases = async (filters = "ALL") => {
  const result = await getSlaRisks(filters);
  return {
    summary: result.summary,
    data: result.data,
    count: result.count,
    thresholds: result.thresholds,
  };
};


export default api;
