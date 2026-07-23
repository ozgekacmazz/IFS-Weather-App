import { UserRoles, type UserRole } from '../auth/authTypes'
import type { ApiClient } from './apiClient'
import { isExplicitTimestamp } from './dateValidation'

export const AdminUserStatuses = {
  Passive: 0,
  Active: 1,
} as const

export type AdminUserStatus =
  (typeof AdminUserStatuses)[keyof typeof AdminUserStatuses]

export interface AdminUserSummary {
  userId: number
  firstName: string
  lastName: string
  username: string
  email: string
  defaultCity: string | null
  role: UserRole
  status: AdminUserStatus
  createdAt: string
}

export interface AdminUserDetail extends AdminUserSummary {
  updatedAt: string
}

export interface AdminUsersPage {
  items: AdminUserSummary[]
  pageNumber: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export interface AdminUserQuery {
  pageNumber: number
  pageSize: number
  search?: string
  status?: AdminUserStatus
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isRole(value: unknown): value is UserRole {
  return value === UserRoles.User || value === UserRoles.Admin
}

function isStatus(value: unknown): value is AdminUserStatus {
  return (
    value === AdminUserStatuses.Passive ||
    value === AdminUserStatuses.Active
  )
}

function decodeSummary(value: unknown): AdminUserSummary {
  if (!isRecord(value)) {
    throw new TypeError('Invalid admin user summary')
  }

  const {
    userId,
    firstName,
    lastName,
    username,
    email,
    defaultCity,
    role,
    status,
    createdAt,
  } = value

  if (
    !isPositiveInteger(userId) ||
    !isNonEmptyString(firstName) ||
    !isNonEmptyString(lastName) ||
    !isNonEmptyString(username) ||
    !isNonEmptyString(email) ||
    (defaultCity !== null && !isNonEmptyString(defaultCity)) ||
    !isRole(role) ||
    !isStatus(status) ||
    !isExplicitTimestamp(createdAt)
  ) {
    throw new TypeError('Invalid admin user summary')
  }

  return {
    userId,
    firstName,
    lastName,
    username,
    email,
    defaultCity,
    role,
    status,
    createdAt,
  }
}

function decodeDetail(value: unknown): AdminUserDetail {
  if (!isRecord(value) || !isExplicitTimestamp(value.updatedAt)) {
    throw new TypeError('Invalid admin user detail')
  }

  return {
    ...decodeSummary(value),
    updatedAt: value.updatedAt,
  }
}

function decodePage(value: unknown): AdminUsersPage {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new TypeError('Invalid admin users page')
  }

  const { pageNumber, pageSize, totalCount, totalPages } = value
  if (
    !isPositiveInteger(pageNumber) ||
    !isPositiveInteger(pageSize) ||
    !isNonNegativeInteger(totalCount) ||
    !isNonNegativeInteger(totalPages) ||
    totalPages !== Math.ceil(totalCount / pageSize) ||
    (totalCount === 0 && value.items.length !== 0) ||
    value.items.length > pageSize
  ) {
    throw new TypeError('Invalid admin users page')
  }

  return {
    items: value.items.map(decodeSummary),
    pageNumber,
    pageSize,
    totalCount,
    totalPages,
  }
}

export function getAdminUsers(
  apiClient: ApiClient,
  query: AdminUserQuery,
): Promise<AdminUsersPage> {
  const searchParams = new URLSearchParams({
    pageNumber: String(query.pageNumber),
    pageSize: String(query.pageSize),
  })
  const normalizedSearch = query.search?.trim()

  if (normalizedSearch) {
    searchParams.set('search', normalizedSearch)
  }

  if (query.status !== undefined) {
    searchParams.set('status', String(query.status))
  }

  return apiClient.request(
    `api/admin/users?${searchParams.toString()}`,
    { method: 'GET' },
    decodePage,
    true,
  )
}

export function getAdminUser(
  apiClient: ApiClient,
  userId: number,
): Promise<AdminUserDetail> {
  return apiClient.request(
    `api/admin/users/${userId}`,
    { method: 'GET' },
    decodeDetail,
    true,
  )
}

export function updateAdminUserStatus(
  apiClient: ApiClient,
  userId: number,
  status: AdminUserStatus,
): Promise<AdminUserDetail> {
  return apiClient.request(
    `api/admin/users/${userId}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
    decodeDetail,
    true,
  )
}
