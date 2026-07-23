import { UserRoles, type UserRole } from './authTypes'

export const userHomePath = '/app/weather'
export const adminHomePath = '/app/admin'
export const adminUsersPath = '/app/admin/users'
export const userProfilePath = '/app/profile'

export function getRoleHomePath(role: UserRole): string {
  return role === UserRoles.Admin ? adminHomePath : userHomePath
}

export function getSafePostAuthenticationPath(
  role: UserRole,
  requestedPath?: string,
): string {
  const roleHomePath = getRoleHomePath(role)

  const isAllowedUserPath =
    role === UserRoles.User &&
    (requestedPath === userHomePath || requestedPath === userProfilePath)
  const isAllowedAdminPath =
    role === UserRoles.Admin &&
    (requestedPath === adminHomePath || requestedPath === adminUsersPath)

  if (isAllowedUserPath || isAllowedAdminPath) {
    return requestedPath
  }

  return roleHomePath
}
