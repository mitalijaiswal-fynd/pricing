import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1' });

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

export default api;
