
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5001/api",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

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


export const getSlaRisks = async (risk = "") => {
  const response = await api.get("/sla", {
    params: risk ? { risk } : {},
  });

  return response.data;
};


export const getSlaCases = async (risk = "ALL") => {
  const params = risk !== "ALL" ? { risk } : {};
  const response = await api.get("/sla", { params });

  return {
    summary: response.data.summary,
    data: response.data.data,
    count: response.data.count,
  };
};


export default api;
