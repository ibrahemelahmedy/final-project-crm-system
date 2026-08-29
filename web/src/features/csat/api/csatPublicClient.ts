import axios from 'axios';

// Story 13 — a SEPARATE, credential-free Axios instance for the two public
// CSAT endpoints.
//
// It deliberately does NOT import web/src/lib/api.ts: that instance attaches
// the agent's bearer token and registers a 401 -> sign-out interceptor.
// Sending a session identity from a customer's browser to a public endpoint
// is the exact confusion this story exists to avoid. This client carries
// nothing but `Accept: application/json`.
export const csatPublicClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  headers: { Accept: 'application/json' },
});
