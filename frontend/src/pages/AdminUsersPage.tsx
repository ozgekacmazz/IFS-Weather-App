import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { ApiError } from '../api/apiError'
import {
  AdminUserStatuses,
  getAdminUser,
  getAdminUsers,
  updateAdminUserStatus,
  type AdminUserDetail,
  type AdminUserStatus,
  type AdminUserSummary,
  type AdminUsersPage,
} from '../api/adminUsersApi'
import { UserRoles } from '../auth/authTypes'
import { useAuth } from '../auth/useAuth'
import { AdminAppHeader } from '../components/AdminAppHeader'

const pageSize = 20
const searchMaximumLength = 100
const listFailureMessage =
  'Users could not be loaded. Please try again.'
const detailFailureMessage =
  'User details could not be loaded. Please try again.'
const updateFailureMessage =
  'The user status could not be updated. Please try again.'

function roleLabel(role: number) {
  return role === UserRoles.Admin ? 'Admin' : 'User'
}

function statusLabel(status: AdminUserStatus) {
  return status === AdminUserStatuses.Active ? 'Active' : 'Inactive'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(new Date(value))
}

function summaryFromDetail(detail: AdminUserDetail): AdminUserSummary {
  return {
    userId: detail.userId,
    firstName: detail.firstName,
    lastName: detail.lastName,
    username: detail.username,
    email: detail.email,
    defaultCity: detail.defaultCity,
    role: detail.role,
    status: detail.status,
    createdAt: detail.createdAt,
  }
}

export function AdminUsersPage() {
  const { apiClient, logout, session } = useAuth()
  const [usersPage, setUsersPage] = useState<AdminUsersPage | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [statusInput, setStatusInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [appliedStatus, setAppliedStatus] = useState<AdminUserStatus | undefined>()
  const [pageNumber, setPageNumber] = useState(1)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [pendingStatus, setPendingStatus] = useState<AdminUserStatus | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const mounted = useRef(true)
  const listSequence = useRef(0)
  const detailSequence = useRef(0)
  const mutationSequence = useRef(0)
  const mutationInProgress = useRef(false)
  const pageTransitionInProgress = useRef(false)

  const handleUnauthorized = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        logout()
        return true
      }

      return false
    },
    [logout],
  )

  const loadUsers = useCallback(async () => {
    if (mutationInProgress.current) {
      return
    }

    const requestId = ++listSequence.current
    setIsLoading(true)
    setListError(null)

    try {
      const response = await getAdminUsers(apiClient, {
        pageNumber: Math.max(1, pageNumber),
        pageSize,
        search: appliedSearch || undefined,
        status: appliedStatus,
      })

      if (!mounted.current || listSequence.current !== requestId) {
        return
      }

      const lastValidPage = Math.max(1, response.totalPages)
      if (response.pageNumber > lastValidPage) {
        setPageNumber(lastValidPage)
        return
      }

      setUsersPage(response)
    } catch (error: unknown) {
      if (
        mounted.current &&
        listSequence.current === requestId &&
        !handleUnauthorized(error)
      ) {
        setUsersPage(null)
        setListError(listFailureMessage)
      }
    } finally {
      if (mounted.current && listSequence.current === requestId) {
        setIsLoading(false)
        pageTransitionInProgress.current = false
      }
    }
  }, [apiClient, appliedSearch, appliedStatus, handleUnauthorized, pageNumber])

  useEffect(() => {
    mounted.current = true
    const timeoutId = window.setTimeout(() => {
      void loadUsers()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
      mounted.current = false
      listSequence.current += 1
      detailSequence.current += 1
      mutationSequence.current += 1
    }
  }, [loadUsers, refreshVersion])

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutationInProgress.current || isLoading) {
      return
    }

    const normalizedSearch = searchInput.trim()
    if (normalizedSearch.length > searchMaximumLength) {
      setSearchError('Search must be 100 characters or fewer.')
      return
    }

    setSearchError(null)
    setPageNumber(1)
    setAppliedSearch(normalizedSearch)
    setAppliedStatus(
      statusInput === '' ? undefined : Number(statusInput) as AdminUserStatus,
    )
  }

  function clearFilters() {
    if (mutationInProgress.current || isLoading) {
      return
    }

    setSearchInput('')
    setStatusInput('')
    setSearchError(null)
    setPageNumber(1)
    setAppliedSearch('')
    setAppliedStatus(undefined)
  }

  async function selectUser(userId: number) {
    if (mutationInProgress.current) {
      return
    }

    const requestId = ++detailSequence.current
    setDetail(null)
    setDetailError(null)
    setPendingStatus(null)
    setUpdateError(null)
    setSuccessMessage(null)
    setIsDetailLoading(true)

    try {
      const response = await getAdminUser(apiClient, userId)
      if (!mounted.current || detailSequence.current !== requestId) {
        return
      }

      setDetail(response)
    } catch (error: unknown) {
      if (
        mounted.current &&
        detailSequence.current === requestId &&
        !handleUnauthorized(error)
      ) {
        setDetailError(
          error instanceof ApiError && error.status === 404
            ? 'That user no longer exists.'
            : detailFailureMessage,
        )
      }
    } finally {
      if (mounted.current && detailSequence.current === requestId) {
        setIsDetailLoading(false)
      }
    }
  }

  function closeDetail() {
    if (mutationInProgress.current) {
      return
    }

    detailSequence.current += 1
    setDetail(null)
    setDetailError(null)
    setIsDetailLoading(false)
    setPendingStatus(null)
    setUpdateError(null)
    setSuccessMessage(null)
  }

  async function confirmStatusUpdate() {
    if (
      mutationInProgress.current ||
      !detail ||
      pendingStatus === null ||
      (detail.userId === session?.userId &&
        pendingStatus === AdminUserStatuses.Passive)
    ) {
      return
    }

    mutationInProgress.current = true
    const mutationId = ++mutationSequence.current
    const userId = detail.userId
    const requestedStatus = pendingStatus
    setIsUpdating(true)
    setUpdateError(null)
    setSuccessMessage(null)

    try {
      const response = await updateAdminUserStatus(
        apiClient,
        userId,
        requestedStatus,
      )
      if (!mounted.current || mutationSequence.current !== mutationId) {
        return
      }

      setDetail(response)
      setPendingStatus(null)
      setSuccessMessage(
        `User ${response.username} is now ${statusLabel(response.status).toLowerCase()}.`,
      )

      if (
        appliedStatus !== undefined &&
        response.status !== appliedStatus
      ) {
        setRefreshVersion((current) => current + 1)
      } else {
        setUsersPage((current) =>
          current
            ? {
                ...current,
                items: current.items.map((user) =>
                  user.userId === response.userId
                    ? summaryFromDetail(response)
                    : user,
                ),
              }
            : current,
        )
      }
    } catch (error: unknown) {
      if (
        mounted.current &&
        mutationSequence.current === mutationId &&
        !handleUnauthorized(error)
      ) {
        setPendingStatus(null)
        if (error instanceof ApiError && error.status === 404) {
          setUpdateError('That user no longer exists.')
        } else if (error instanceof ApiError && error.status === 409) {
          setUpdateError('This status change conflicts with account protections.')
        } else if (error instanceof ApiError && error.status === 403) {
          setUpdateError('You are not authorized to change this user.')
        } else {
          setUpdateError(updateFailureMessage)
        }
      }
    } finally {
      mutationInProgress.current = false
      if (mounted.current && mutationSequence.current === mutationId) {
        setIsUpdating(false)
      }
    }
  }

  const totalPages = usersPage?.totalPages ?? 0
  const canGoPrevious = pageNumber > 1 && !isLoading && !isUpdating
  const canGoNext =
    totalPages > 0 && pageNumber < totalPages && !isLoading && !isUpdating

  function changePage(nextPage: number) {
    if (
      pageTransitionInProgress.current ||
      nextPage < 1 ||
      (totalPages > 0 && nextPage > totalPages) ||
      isLoading ||
      isUpdating
    ) {
      return
    }

    pageTransitionInProgress.current = true
    setPageNumber(nextPage)
  }

  return (
    <div className="weather-dashboard admin-users-page">
      <AdminAppHeader onSignOut={logout} />
      <main className="admin-users-content">
        <header className="profile-intro">
          <p className="eyebrow">Administration</p>
          <h1>User management</h1>
          <p>Find users, review account details, and manage account status.</p>
        </header>

        <form className="admin-filter-form" onSubmit={applyFilters} noValidate>
          <div>
            <label htmlFor="admin-user-search">Search users</label>
            <input
              id="admin-user-search"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value)
                setSearchError(null)
              }}
              maxLength={101}
              disabled={isLoading || isUpdating}
              aria-invalid={searchError ? true : undefined}
              aria-describedby={searchError ? 'admin-user-search-error' : undefined}
              placeholder="Name, username, or email"
            />
            {searchError ? (
              <p
                className="field-error admin-filter-error"
                id="admin-user-search-error"
              >
                {searchError}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="admin-user-status">Account status</label>
            <select
              id="admin-user-status"
              value={statusInput}
              onChange={(event) => setStatusInput(event.target.value)}
              disabled={isLoading || isUpdating}
            >
              <option value="">All</option>
              <option value={AdminUserStatuses.Active}>Active</option>
              <option value={AdminUserStatuses.Passive}>Inactive</option>
            </select>
          </div>
          <div className="admin-filter-actions">
            <button type="submit" disabled={isLoading || isUpdating}>
              Apply filters
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={clearFilters}
              disabled={isLoading || isUpdating}
            >
              Clear
            </button>
          </div>
        </form>

        {isLoading ? (
          <section className="dashboard-state" aria-live="polite">
            <h2>Loading users…</h2>
            <p>Retrieving account information.</p>
          </section>
        ) : null}

        {!isLoading && listError ? (
          <section className="dashboard-state">
            <h2>Users unavailable</h2>
            <p role="alert">{listError}</p>
            <button type="button" onClick={() => void loadUsers()}>
              Try again
            </button>
          </section>
        ) : null}

        {!isLoading && usersPage && usersPage.items.length === 0 ? (
          <section className="dashboard-state">
            <h2>No users found</h2>
            <p>Try a different search or status filter.</p>
          </section>
        ) : null}

        {!isLoading && usersPage && usersPage.items.length > 0 ? (
          <section className="admin-table-card" aria-labelledby="users-results-title">
            <div className="section-heading">
              <h2 id="users-results-title">Users</h2>
              <span>{usersPage.totalCount} total</span>
            </div>
            <div className="admin-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Username</th>
                    <th scope="col">Email</th>
                    <th scope="col">Role</th>
                    <th scope="col">Status</th>
                    <th scope="col">Default city</th>
                    <th scope="col">Created</th>
                    <th scope="col"><span className="visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {usersPage.items.map((user) => (
                    <tr key={user.userId}>
                      <td>{user.firstName} {user.lastName}</td>
                      <td>{user.username}</td>
                      <td>{user.email}</td>
                      <td>{roleLabel(user.role)}</td>
                      <td>
                        <span className={`status-badge status-${statusLabel(user.status).toLowerCase()}`}>
                          {statusLabel(user.status)}
                        </span>
                      </td>
                      <td>{user.defaultCity ?? 'Not set'}</td>
                      <td><time dateTime={user.createdAt}>{formatDate(user.createdAt)}</time></td>
                      <td>
                        <button
                          className="table-action"
                          type="button"
                          onClick={() => void selectUser(user.userId)}
                          disabled={isUpdating}
                          aria-label={`View details for ${user.firstName} ${user.lastName}`}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav className="admin-pagination" aria-label="User list pagination">
              <button
                type="button"
                disabled={!canGoPrevious}
                onClick={() => changePage(pageNumber - 1)}
                aria-label="Previous page"
              >
                Previous
              </button>
              <span aria-live="polite">
                Page {usersPage.pageNumber} of {Math.max(1, usersPage.totalPages)}
              </span>
              <button
                type="button"
                disabled={!canGoNext}
                onClick={() => changePage(pageNumber + 1)}
                aria-label="Next page"
              >
                Next
              </button>
            </nav>
          </section>
        ) : null}

        {(isDetailLoading || detailError || detail) ? (
          <section className="admin-detail-card" aria-labelledby="user-detail-title">
            <div className="section-heading">
              <h2 id="user-detail-title">User details</h2>
              <button
                className="secondary-button"
                type="button"
                onClick={closeDetail}
                disabled={isUpdating}
              >
                Close details
              </button>
            </div>
            {isDetailLoading ? (
              <p aria-live="polite">Loading user details…</p>
            ) : null}
            {detailError ? <p role="alert">{detailError}</p> : null}
            {detail ? (
              <>
                <dl className="admin-detail-grid">
                  <div><dt>First name</dt><dd>{detail.firstName}</dd></div>
                  <div><dt>Last name</dt><dd>{detail.lastName}</dd></div>
                  <div><dt>Username</dt><dd>{detail.username}</dd></div>
                  <div><dt>Email</dt><dd>{detail.email}</dd></div>
                  <div><dt>Default city</dt><dd>{detail.defaultCity ?? 'Not set'}</dd></div>
                  <div><dt>Role</dt><dd>{roleLabel(detail.role)}</dd></div>
                  <div><dt>Status</dt><dd>{statusLabel(detail.status)}</dd></div>
                  <div><dt>Created</dt><dd><time dateTime={detail.createdAt}>{formatDate(detail.createdAt)}</time></dd></div>
                  <div><dt>Updated</dt><dd><time dateTime={detail.updatedAt}>{formatDate(detail.updatedAt)}</time></dd></div>
                </dl>

                <div className="admin-status-actions">
                  {detail.userId === session?.userId &&
                  detail.status === AdminUserStatuses.Active ? (
                    <p className="admin-self-note">
                      You cannot deactivate your own administrator account.
                    </p>
                  ) : (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() =>
                        setPendingStatus(
                          detail.status === AdminUserStatuses.Active
                            ? AdminUserStatuses.Passive
                            : AdminUserStatuses.Active,
                        )
                      }
                    >
                      {detail.status === AdminUserStatuses.Active
                        ? 'Deactivate user'
                        : 'Activate user'}
                    </button>
                  )}
                </div>

                {pendingStatus !== null ? (
                  <div className="admin-confirmation" role="group" aria-labelledby="status-confirmation-title">
                    <h3 id="status-confirmation-title">
                      Confirm {pendingStatus === AdminUserStatuses.Active ? 'activation' : 'deactivation'}
                    </h3>
                    <p>
                      {pendingStatus === AdminUserStatuses.Active ? 'Activate' : 'Deactivate'} {detail.username}?
                    </p>
                    <div>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => void confirmStatusUpdate()}
                      >
                        {isUpdating ? 'Updating status…' : `Confirm ${pendingStatus === AdminUserStatuses.Active ? 'activation' : 'deactivation'}`}
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={isUpdating}
                        onClick={() => setPendingStatus(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
                {updateError ? <p className="error-message" role="alert">{updateError}</p> : null}
                <p className="profile-success" aria-live="polite">{successMessage}</p>
              </>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  )
}
