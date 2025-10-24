/**
 * API Client
 *
 * Axios instance configured for admin portal API requests.
 * Includes credentials for httpOnly cookie support.
 */

import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  withCredentials: true, // Enable httpOnly cookies
  headers: {
    'Content-Type': 'application/json',
    // Admin portal uses 'wellpulse' master tenant for internal staff
    'X-Tenant-Subdomain': 'wellpulse',
  },
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // API returned an error response
      const message =
        error.response.data?.message || error.response.data?.error || 'An error occurred';
      throw new Error(message);
    } else if (error.request) {
      // Request was made but no response received
      throw new Error('No response from server. Please check your connection.');
    } else {
      // Something else happened
      throw new Error(error.message || 'An unexpected error occurred');
    }
  },
);

export default apiClient;
