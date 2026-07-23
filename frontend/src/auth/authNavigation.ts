import { UserRoles, type UserRole } from './authTypes'

export const userHomePath = '/app/weather'
export const adminHomePath = '/app/admin'

export function getRoleHomePath(role: UserRole): string {
  return role === UserRoles.Admin ? adminHomePath : userHomePath
}

export function getSafePostAuthenticationPath(
  role: UserRole,
  requestedPath?: string,
): string {
  const roleHomePath = getRoleHomePath(role)

  if (
    requestedPath === roleHomePath ||
    requestedPath?.startsWith(`${roleHomePath}/`)
  ) {
    return requestedPath
  }

  return roleHomePath
}
