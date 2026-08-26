import axios from 'axios';

// The token is held in a module-scoped variable, NOT localStorage or
// sessionStorage — see docs/decisions/ADR-004-authentication.md.
// Consequence: a page reload logs the user out. That is intended.
let accessToken: string | null = null;

export const setAccessToken = (t: string | null) => {
  accessToken = t;
};

export const getAccessToken = () => accessToken;

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  headers: {
    Accept: 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});
