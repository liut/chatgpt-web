import axios, { type AxiosResponse } from 'axios'
import { useAuthStore } from '@/store'

const authHeader = import.meta.env.VITE_AUTH_HEADER || 'Authorization'

const service = axios.create({
  baseURL: import.meta.env.VITE_GLOB_API_URL,
})

service.interceptors.request.use(
	(config) => {
		const token = useAuthStore().token;
		if (token) {
			if (authHeader === 'Authorization') {
				config.headers.Authorization = `Bearer ${token}`;
			} else config.headers[authHeader] = token;
			console.info(config.headers, token);
		}
		return config;
	},
	(error) => {
		console.info("Request error:", error);
		return Promise.reject(error.response);
	},
);

service.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => {
    if (response.status === 200)
      return response

    throw new Error(response.status.toString())
  },
  (error) => {
    console.info('Response error:', error)
    return Promise.reject(error)
  },
)

export default service
