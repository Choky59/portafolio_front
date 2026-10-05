import { api } from './client'

/* Session */

export function login({ username, password, expiration }) {
  return api('/session', { method: 'POST', body: { username, password, expiration } })
}

export function logout() {
  return api('/session', { method: 'DELETE', auth: true })
}

export async function me(signal) {
  const res = await api('/auth/me', { auth: true, signal })
  return res.user
}

/* Devices */

export async function listDevices(filtros = {}, signal) {
  const qs = new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString()
  const res = await api(`/devices${qs ? `?${qs}` : ''}`, { auth: true, signal })
  return res.devices
}

export async function getDeviceTypes(signal) {
  const res = await api('/devices/types', { auth: true, signal })
  return res.types
}

/** { device, claimCode, expiresAt } */
export function createDevice(body) {
  return api('/devices', { method: 'POST', body, auth: true })
}

export async function updateDevice(deviceId, body) {
  const res = await api(`/devices/${deviceId}`, { method: 'PATCH', body, auth: true })
  return res.device
}

/** { device, claimCode, expiresAt } */
export function newClaimCode(deviceId) {
  return api(`/devices/${deviceId}/claim-code`, { method: 'POST', auth: true })
}

export async function revokeDevice(deviceId) {
  const res = await api(`/devices/${deviceId}/revoke`, { method: 'POST', auth: true })
  return res.device
}

export function deleteDevice(deviceId) {
  return api(`/devices/${deviceId}`, { method: 'DELETE', auth: true })
}
