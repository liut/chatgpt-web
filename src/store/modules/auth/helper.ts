import { ss } from '@/utils/storage'

const SECRET_TOKEN = 'SECRET_TOKEN'
const LOCAL_NAME = import.meta.env.VITE_TOKEN_NAME || SECRET_TOKEN

export function getToken(): string | undefined {
  return ss.get(LOCAL_NAME)
}

export function setToken(token: string) {
  return LOCAL_NAME === SECRET_TOKEN ? ss.set(LOCAL_NAME, token) : undefined
}

export function removeToken() {
  return LOCAL_NAME === SECRET_TOKEN ? ss.remove(LOCAL_NAME) : undefined
}
