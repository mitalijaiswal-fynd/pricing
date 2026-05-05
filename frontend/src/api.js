import axios from 'axios';

const API_PREFIX = '/api/v1';
const baseURL =
  import.meta.env.VITE_API_URL != null && String(import.meta.env.VITE_API_URL).trim() !== ''
    ? `${String(import.meta.env.VITE_API_URL).replace(/\/$/, '')}${API_PREFIX}`
    : API_PREFIX;

const api = axios.create({ baseURL });

// Attach X-User-Id header from localStorage on every request
api.interceptors.request.use((config) => {
  const userId = localStorage.getItem('userId');
  if (userId) config.headers['X-User-Id'] = userId;
  return config;
});

export const getArticles = () => api.get('/articles').then(r => r.data);
export const getArticle = (id) => api.get(`/articles/${id}`).then(r => r.data);
export const createArticle = (data) => api.post('/articles', data).then(r => r.data);
export const updateArticle = (id, data) => api.put(`/articles/${id}`, data).then(r => r.data);
export const deleteArticle = (id) => api.delete(`/articles/${id}`);

export const getPricing = (id) => api.get(`/articles/${id}/pricing`).then(r => r.data);
export const updatePricingFull = (id, data) => api.put(`/articles/${id}/pricing`, data).then(r => r.data);
export const updateRM = (id, data) => api.patch(`/articles/${id}/pricing/rm`, data).then(r => r.data);
export const updateDM = (id, data) => api.patch(`/articles/${id}/pricing/dm`, data).then(r => r.data);
export const updateAnchor = (id, data) => api.patch(`/articles/${id}/pricing/anchor`, data).then(r => r.data);

export const simulate = (data) => api.post('/pricing/simulate', data).then(r => r.data);

export const getScopedPricing = (id) => api.get(`/articles/${id}/scoped-pricing`).then(r => r.data);
export const saveScopedPricing = (id, rules) => api.put(`/articles/${id}/scoped-pricing`, { rules }).then(r => r.data);
export const createScopedRule = (id, rule) => api.post(`/articles/${id}/scoped-pricing`, rule).then(r => r.data);
export const updateScopedRule = (articleId, ruleId, data) => api.put(`/articles/${articleId}/scoped-pricing/${ruleId}`, data).then(r => r.data);
export const deleteScopedRule = (articleId, ruleId) => api.delete(`/articles/${articleId}/scoped-pricing/${ruleId}`);

export const getSchemeTypes = () => api.get('/schemes/types').then(r => r.data);
export const getSchemes = (filters = {}) => {
  const params = {};
  if (filters.discountType) params.discount_type = filters.discountType;
  if (filters.targetAudience) params.target_audience = filters.targetAudience;
  return api.get('/schemes', { params }).then(r => r.data);
};
export const getScheme = (id) => api.get(`/schemes/${id}`).then(r => r.data);
export const createScheme = (data) => api.post('/schemes', data).then(r => r.data);
export const updateScheme = (id, data) => api.put(`/schemes/${id}`, data).then(r => r.data);
export const deleteScheme = (id) => api.delete(`/schemes/${id}`);
export const toggleScheme = (id) => api.patch(`/schemes/${id}/toggle`).then(r => r.data);

export const getDistributors = (search) => api.get('/distributors', { params: search ? { search } : {} }).then(r => r.data);
export const getDistributorSegments = () => api.get('/distributor-segments').then(r => r.data);

export const downloadTemplate = () => api.get('/bulk/template', { responseType: 'blob' }).then(r => {
  const url = URL.createObjectURL(r.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pricing_bulk_template.xlsx';
  a.click();
  URL.revokeObjectURL(url);
});
export const uploadBulkFile = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/bulk/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
};
export const getBulkUploads = () => api.get('/bulk/uploads').then(r => r.data);
export const getBulkUpload = (id) => api.get(`/bulk/uploads/${id}`).then(r => r.data);

// Auth & Users
export const getUsers = () => api.get('/users').then(r => r.data);
export const loginUser = (userId) => api.post('/auth/login', { user_id: userId }).then(r => r.data);
export const getCurrentUser = () => api.get('/auth/me').then(r => r.data);

// Approvals
export const getApprovals = (params = {}) => api.get('/approvals', { params }).then(r => r.data);
export const getApproval = (id) => api.get(`/approvals/${id}`).then(r => r.data);
export const createApproval = (data) => api.post('/approvals', data).then(r => r.data);
export const performApprovalAction = (id, data) => api.post(`/approvals/${id}/action`, data).then(r => r.data);
export const getApprovalCounts = () => api.get('/approvals/counts').then(r => r.data);
export const addApprovalComment = (id, message) => api.post(`/approvals/${id}/comments`, { message }).then(r => r.data);

export default api;
