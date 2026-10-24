
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

export default api;
