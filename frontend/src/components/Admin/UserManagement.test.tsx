import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import ToastProvider from '@/components/Toast/ToastProvider'
import UserManagement from './UserManagement'

/**
 * The admin panel is the only place that can destroy an account, and it is the
 * only screen that talks to `GET /api/v1/users` with search/filter/paging. These
 * tests pin the promises that matters: nothing is sent before the admin
 * confirms, the row disappears afterwards, the trash can undo a deletion, and
 * the query string actually carries the search box and the filters (otherwise a
 * "no results" page would silently mean "not on this page").
 */

const { fetchWithAuth, showDeleteConfirm } = vi.hoisted(() => ({
  fetchWithAuth: vi.fn(),
  showDeleteConfirm: vi.fn(),
}))

vi.mock('@/lib/api/fetchWithAuth', () => ({ fetchWithAuth }))
vi.mock('@/utils/sweetalert', () => ({ showDeleteConfirm }))
vi.mock('@/components/Auth/AuthProvider', () => ({
  // The signed-in admin is user #1, so the panel must keep its row undeletable.
  useAuth: () => ({ user: { id: 1, role: 'admin', name: 'Admin' } }),
}))

const ADMIN = {
  id: 1,
  email: 'admin@example.com',
  username: null,
  name: 'Admin',
  role: 'admin',
  is_active: true,
  accessible_pages: null,
  deleted_at: null,
}

const TARGET = {
  id: 2,
  email: 'user@example.com',
  username: null,
  name: 'User',
  role: 'user',
  is_active: true,
  accessible_pages: null,
  deleted_at: null,
}

const TRASHED = {
  id: 3,
  email: 'gone@example.com',
  username: null,
  name: 'Gone',
  role: 'user',
  is_active: false,
  accessible_pages: null,
  deleted_at: '2026-10-15T03:00:00',
  days_remaining: 29,
  purge_at: '2026-11-14T03:00:00',
}

const LIST_URL = '/api/v1/users/?skip=0&limit=10'

/** Every authenticated request the panel made, as "METHOD /path". */
let calls: string[] = []

/** Per-test router: return a Response for a method + path. */
let api: (method: string, path: string, init?: RequestInit) => Response

const json = (
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
) =>
  new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })

const listResponse = (users: unknown[], total = users.length) =>
  json(users, { headers: { 'X-Total-Count': String(total) } })

const deleteResponse = { result: 'success', message: 'ok', data: { retention_days: 30 } }

const renderPanel = () =>
  render(
    <ToastProvider>
      <UserManagement />
    </ToastProvider>,
  )

const deleteButton = (email: string) => screen.getByRole('button', { name: `ลบผู้ใช้ ${email}` })

const findRows = () => screen.findByText(TARGET.email)

const openTrash = async () => {
  fireEvent.change(screen.getByLabelText('กรองตามสถานะ'), { target: { value: 'trash' } })
  await screen.findByText(TRASHED.email)
}

beforeEach(() => {
  calls = []
  api = (method, path) => {
    if (method === 'GET' && path.startsWith('/api/v1/users/?')) return listResponse([ADMIN, TARGET])
    if (method === 'GET' && path === '/api/v1/users/deleted') return json([])
    if (method === 'DELETE') return json(deleteResponse)
    return json({ detail: `unexpected ${method} ${path}` }, { status: 500 })
  }
  fetchWithAuth.mockImplementation((path: string, init: RequestInit = {}) => {
    const method = (init.method ?? 'GET').toUpperCase()
    calls.push(`${method} ${path}`)
    return Promise.resolve(api(method, path, init))
  })
  showDeleteConfirm.mockResolvedValue({ isConfirmed: true })
})

describe('UserManagement — delete', () => {
  it('offers a delete action per row but disables it on your own account', async () => {
    renderPanel()
    await findRows()

    expect(deleteButton(TARGET.email)).toBeTruthy()
    expect((deleteButton(ADMIN.email) as HTMLButtonElement).disabled).toBe(true)
  })

  it('asks for confirmation naming the account, then drops the row', async () => {
    renderPanel()
    await findRows()

    fireEvent.click(deleteButton(TARGET.email))

    await waitFor(() =>
      expect(fetchWithAuth).toHaveBeenCalledWith('/api/v1/users/2', { method: 'DELETE' }),
    )
    await waitFor(() => expect(screen.queryByText(TARGET.email)).toBeNull())

    expect(showDeleteConfirm).toHaveBeenCalledTimes(1)
    // The dialog must name the account so the admin cannot delete the wrong one.
    expect(String(showDeleteConfirm.mock.calls[0][1])).toContain(TARGET.email)
    expect(screen.getByText('ย้ายเข้าถังขยะแล้ว')).toBeTruthy()
    // Only the targeted row goes away.
    expect(screen.getByText(ADMIN.email)).toBeTruthy()
  })

  it('sends nothing when the admin backs out of the dialog', async () => {
    showDeleteConfirm.mockResolvedValue({ isConfirmed: false })
    renderPanel()
    await findRows()

    fireEvent.click(deleteButton(TARGET.email))

    await waitFor(() => expect(showDeleteConfirm).toHaveBeenCalledTimes(1))
    expect(calls).toEqual([`GET ${LIST_URL}`])
    expect(screen.getByText(TARGET.email)).toBeTruthy()
  })

  it('surfaces the API refusal and keeps the row', async () => {
    api = (method, path) =>
      method === 'DELETE'
        ? json({ detail: 'คุณไม่สามารถลบบัญชีผู้ใช้ของตัวเองได้' }, { status: 400 })
        : listResponse([ADMIN, TARGET])

    renderPanel()
    await findRows()
    fireEvent.click(deleteButton(TARGET.email))

    await waitFor(() => expect(screen.getByText('ลบไม่ได้')).toBeTruthy())
    expect(screen.getByText('คุณไม่สามารถลบบัญชีผู้ใช้ของตัวเองได้')).toBeTruthy()
    expect(screen.getByText(TARGET.email)).toBeTruthy()
  })

  it('explains that only administrators may delete', async () => {
    api = (method) =>
      method === 'DELETE'
        ? json({ detail: 'Not enough permissions' }, { status: 403 })
        : listResponse([ADMIN, TARGET])

    renderPanel()
    await findRows()
    fireEvent.click(deleteButton(TARGET.email))

    await waitFor(() => expect(screen.getByText('ไม่ได้รับอนุญาต')).toBeTruthy())
    expect(screen.getByText('เฉพาะผู้ดูแลระบบเท่านั้นที่ลบผู้ใช้ได้')).toBeTruthy()
    expect(screen.getByText(TARGET.email)).toBeTruthy()
  })

  it('ignores a second click while the first deletion is in flight', async () => {
    let finishDelete: (response: Response) => void = () => {}

    fetchWithAuth.mockImplementation((path: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toUpperCase()
      calls.push(`${method} ${path}`)
      if (method === 'DELETE') {
        return new Promise<Response>((resolve) => {
          finishDelete = resolve
        })
      }
      return Promise.resolve(api(method, path, init))
    })

    renderPanel()
    await findRows()
    fireEvent.click(deleteButton(TARGET.email))

    await waitFor(() => expect(screen.getByText('กำลังลบ...')).toBeTruthy())
    const busyButton = deleteButton(TARGET.email) as HTMLButtonElement
    expect(busyButton.disabled).toBe(true)

    // A second attempt must not open another dialog or send another DELETE.
    fireEvent.click(busyButton)
    expect(showDeleteConfirm).toHaveBeenCalledTimes(1)
    expect(calls).toEqual([`GET ${LIST_URL}`, 'DELETE /api/v1/users/2'])

    finishDelete(json(deleteResponse))
    await waitFor(() => expect(screen.queryByText(TARGET.email)).toBeNull())
  })
})

describe('UserManagement — search, filters and paging', () => {
  it('sends the typed term to the API and renders only the matches', async () => {
    api = (_method, path) =>
      path.includes('q=user%40') ? listResponse([TARGET], 1) : listResponse([ADMIN, TARGET])

    renderPanel()
    await findRows()

    fireEvent.change(screen.getByLabelText('ค้นหาผู้ใช้'), { target: { value: 'user@' } })

    // Debounced: the request only exists once the typing pause has elapsed.
    await waitFor(
      () => expect(calls).toContain('GET /api/v1/users/?skip=0&limit=10&q=user%40'),
      { timeout: 3000 },
    )
    await waitFor(() => expect(screen.queryByText(ADMIN.email)).toBeNull())
  })

  it('carries the role and status filters into the query', async () => {
    api = (_method, path) => (path.includes('role=admin') ? listResponse([ADMIN], 1) : listResponse([ADMIN, TARGET]))

    renderPanel()
    await findRows()

    fireEvent.change(screen.getByLabelText('กรองตามสิทธิ์'), { target: { value: 'admin' } })
    await waitFor(() =>
      expect(calls).toContain('GET /api/v1/users/?skip=0&limit=10&role=admin'),
    )

    fireEvent.change(screen.getByLabelText('กรองตามสถานะ'), { target: { value: 'suspended' } })
    await waitFor(() =>
      expect(calls).toContain('GET /api/v1/users/?skip=0&limit=10&role=admin&is_active=false'),
    )
  })

  it('clears every filter at once', async () => {
    renderPanel()
    await findRows()

    fireEvent.change(screen.getByLabelText('กรองตามสิทธิ์'), { target: { value: 'admin' } })
    await waitFor(() => expect((screen.getByLabelText('กรองตามสิทธิ์') as HTMLSelectElement).value).toBe('admin'))

    fireEvent.click(screen.getByRole('button', { name: /ล้างตัวกรอง/ }))

    await waitFor(() =>
      expect((screen.getByLabelText('กรองตามสิทธิ์') as HTMLSelectElement).value).toBe(''),
    )
    await waitFor(() => expect(calls).toContain(`GET ${LIST_URL}`))
  })

  it('reports the total from the API and pages with the same filters', async () => {
    api = () => listResponse([ADMIN, TARGET], 12)

    renderPanel()
    await screen.findByText(ADMIN.email)

    expect(screen.getByText('พบ 12 บัญชี · หน้า 1 / 2')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'หน้าก่อนหน้า' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'หน้าถัดไป' }))

    await waitFor(() => expect(calls).toContain('GET /api/v1/users/?skip=10&limit=10'))
    expect(screen.getByText('พบ 12 บัญชี · หน้า 2 / 2')).toBeTruthy()
    // The last page is the last page.
    await waitFor(
      () => expect((screen.getByRole('button', { name: 'หน้าถัดไป' }) as HTMLButtonElement).disabled).toBe(true),
    )
  })

  it('says so when a search matches nothing', async () => {
    api = () => listResponse([], 0)

    renderPanel()
    await screen.findByText('ยังไม่มีผู้ใช้งานในระบบ')

    fireEvent.change(screen.getByLabelText('ค้นหาผู้ใช้'), { target: { value: 'zzz' } })

    await screen.findByText('ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข')
  })
})

describe('UserManagement — create', () => {
  const fillForm = (overrides: Partial<Record<string, string>> = {}) => {
    const values = {
      'ชื่อผู้ใช้ (Username) *': 'newbie',
      'ชื่อที่แสดง (Display name) *': 'New Bie',
      'อีเมล (ไม่บังคับ)': 'newbie@example.com',
      'รหัสผ่าน *': 'SecretPass123',
      ...overrides,
    }
    for (const [label, value] of Object.entries(values)) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    }
  }

  it('creates the account with the role and pages that were chosen', async () => {
    api = (method, path) => {
      if (method === 'POST' && path === '/api/v1/users/admin-create') {
        return json({ result: 'success', message: 'สร้างผู้ใช้สำเร็จ', data: { user_id: 9 } })
      }
      return listResponse([ADMIN])
    }

    renderPanel()
    await screen.findByText(ADMIN.email)

    fireEvent.click(screen.getByRole('button', { name: /เพิ่มผู้ใช้/ }))
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: /ผู้ดูแลระบบ \(Admin\)/ }))
    // Drop one page from the default (all three) selection.
    fireEvent.click(screen.getByRole('button', { name: /กล้อง \(Camera\)/ }))
    fireEvent.click(screen.getByRole('button', { name: 'สร้างผู้ใช้' }))

    await waitFor(() => expect(calls).toContain('POST /api/v1/users/admin-create'))
    const posted = fetchWithAuth.mock.calls.find(([, init]) => init?.method === 'POST')
    const body = JSON.parse(String(posted?.[1]?.body))

    expect(body).toMatchObject({
      username: 'newbie',
      display_name: 'New Bie',
      email: 'newbie@example.com',
      role: 'admin',
    })
    expect(JSON.parse(body.accessible_pages)).toEqual(['dashboard', 'profile'])
    expect(screen.getByText('สร้างผู้ใช้สำเร็จ')).toBeTruthy()
  })

  it('validates the password before spending a request', async () => {
    renderPanel()
    await screen.findByText(ADMIN.email)

    fireEvent.click(screen.getByRole('button', { name: /เพิ่มผู้ใช้/ }))
    fillForm({ 'รหัสผ่าน *': 'short' })
    fireEvent.click(screen.getByRole('button', { name: 'สร้างผู้ใช้' }))

    await screen.findByText('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
    expect(calls.some((call) => call.startsWith('POST'))).toBe(false)
  })

  it('surfaces a rejected username from the API', async () => {
    api = (method) =>
      method === 'POST'
        ? json({ detail: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว (บัญชีอยู่ในถังขยะ)' }, { status: 400 })
        : listResponse([ADMIN])

    renderPanel()
    await screen.findByText(ADMIN.email)

    fireEvent.click(screen.getByRole('button', { name: /เพิ่มผู้ใช้/ }))
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: 'สร้างผู้ใช้' }))

    await screen.findByText('ชื่อผู้ใช้นี้ถูกใช้งานแล้ว (บัญชีอยู่ในถังขยะ)')
  })
})

describe('UserManagement — trash', () => {
  const trashApi = (method: string, path: string): Response => {
    if (path === '/api/v1/users/deleted') return json([TRASHED])
    if (method === 'POST' && path === `/api/v1/users/${TRASHED.id}/restore`) {
      return json({ result: 'success', message: 'กู้คืนผู้ใช้สำเร็จ' })
    }
    if (method === 'DELETE' && path === `/api/v1/users/${TRASHED.id}?purge=true`) {
      return json({ ...deleteResponse, data: { ...deleteResponse.data, purged: true } })
    }
    return listResponse([ADMIN, TARGET])
  }

  it('lists deleted accounts with the time left to restore them', async () => {
    api = trashApi
    renderPanel()
    await findRows()

    await openTrash()

    expect(screen.getByText(TRASHED.email)).toBeTruthy()
    expect(screen.getByText('กู้คืนได้อีก 29 วัน')).toBeTruthy()
    // The trash is a bounded list: it is not paged into the live user list.
    expect(screen.queryByRole('button', { name: 'หน้าถัดไป' })).toBeNull()
  })

  it('restores an account and drops it from the trash', async () => {
    api = trashApi
    renderPanel()
    await findRows()
    await openTrash()

    fireEvent.click(screen.getByRole('button', { name: `กู้คืนผู้ใช้ ${TRASHED.email}` }))

    await waitFor(() =>
      expect(calls).toContain(`POST /api/v1/users/${TRASHED.id}/restore`),
    )
    await waitFor(() => expect(screen.queryByText(TRASHED.email)).toBeNull())
    expect(screen.getByText('กู้คืนผู้ใช้สำเร็จ')).toBeTruthy()
  })

  it('asks before erasing an account for good', async () => {
    api = trashApi
    renderPanel()
    await findRows()
    await openTrash()

    showDeleteConfirm.mockResolvedValue({ isConfirmed: true })
    fireEvent.click(screen.getByRole('button', { name: `ลบถาวร ${TRASHED.email}` }))

    await waitFor(() =>
      expect(calls).toContain(`DELETE /api/v1/users/${TRASHED.id}?purge=true`),
    )
    await waitFor(() => expect(screen.queryByText(TRASHED.email)).toBeNull())
    expect(screen.getByText('ลบถาวรสำเร็จ')).toBeTruthy()
  })

  it('leaves the account alone when the permanent-delete dialog is dismissed', async () => {
    api = trashApi
    showDeleteConfirm.mockResolvedValue({ isConfirmed: false })

    renderPanel()
    await findRows()
    await openTrash()

    fireEvent.click(screen.getByRole('button', { name: `ลบถาวร ${TRASHED.email}` }))

    await waitFor(() => expect(showDeleteConfirm).toHaveBeenCalledTimes(1))
    expect(calls.some((call) => call.includes('purge=true'))).toBe(false)
    expect(screen.getByText(TRASHED.email)).toBeTruthy()
  })
})

/**
 * The approval queue. A sign-up request is the only thing an admin decides on
 * from scratch, so the panel has to show the queue on its own, approve without
 * friction, and keep a confirmation in front of the refusal.
 */
describe('UserManagement — approval queue', () => {
  const PENDING = {
    id: 9,
    email: 'hopeful@example.com',
    username: null,
    name: 'Hopeful',
    role: 'user',
    is_active: false,
    accessible_pages: null,
    status: 'pending',
    deleted_at: null,
  }

  // The queue lives behind its own endpoint; the list itself still loads first.
  const queueApi = (method: string, path: string) => {
    if (method === 'GET' && path.startsWith('/api/v1/users/?')) return listResponse([ADMIN])
    if (method === 'GET' && path === '/api/v1/users/pending') return json([PENDING])
    if (method === 'POST' && path === `/api/v1/users/${PENDING.id}/approve`) {
      return json({
        result: 'success',
        message: 'อนุมัติบัญชีผู้ใช้สำเร็จ',
        data: { user_id: PENDING.id, status: 'active' },
      })
    }
    if (method === 'POST' && path === `/api/v1/users/${PENDING.id}/reject`) {
      return json({
        result: 'success',
        message: 'ปฏิเสธคำขอสมัครแล้ว',
        data: { user_id: PENDING.id, status: 'rejected' },
      })
    }
    return json({ detail: `unexpected ${method} ${path}` }, { status: 500 })
  }

  const openQueue = async () => {
    // The filter bar only exists once the first page has loaded.
    const statusFilter = await screen.findByLabelText('กรองตามสถานะ')
    fireEvent.change(statusFilter, { target: { value: 'pending' } })
    await screen.findByText(PENDING.email)
  }

  const approveButton = () =>
    screen.getByRole('button', { name: `อนุมัติคำขอของ ${PENDING.email}` })

  it('lists the requests from the pending endpoint', async () => {
    api = queueApi
    renderPanel()
    await openQueue()

    expect(calls).toContain('GET /api/v1/users/pending')
    // The status pill joins the filter label, so look for it among matches.
    expect(screen.getAllByText('รออนุมัติ').length).toBeGreaterThan(0)
    expect(approveButton()).toBeTruthy()
  })

  it('approves a request and drops it from the queue', async () => {
    api = queueApi
    renderPanel()
    await openQueue()

    fireEvent.click(approveButton())

    await waitFor(() =>
      expect(calls).toContain(`POST /api/v1/users/${PENDING.id}/approve`),
    )
    await waitFor(() => expect(screen.queryByText(PENDING.email)).toBeNull())
    expect(screen.getByText('ยังไม่มีคำขอสมัครที่รออนุมัติ')).toBeTruthy()
  })

  it('rejects only after the admin confirms', async () => {
    api = queueApi
    renderPanel()
    await openQueue()

    fireEvent.click(screen.getByRole('button', { name: `ปฏิเสธคำขอของ ${PENDING.email}` }))

    await waitFor(() =>
      expect(calls).toContain(`POST /api/v1/users/${PENDING.id}/reject`),
    )
    await waitFor(() => expect(screen.queryByText(PENDING.email)).toBeNull())
    expect(showDeleteConfirm).toHaveBeenCalledTimes(1)
  })

  it('sends nothing when the refusal dialog is dismissed', async () => {
    api = queueApi
    showDeleteConfirm.mockResolvedValue({ isConfirmed: false })

    renderPanel()
    await openQueue()

    fireEvent.click(screen.getByRole('button', { name: `ปฏิเสธคำขอของ ${PENDING.email}` }))

    await waitFor(() => expect(showDeleteConfirm).toHaveBeenCalledTimes(1))
    expect(calls.some((call) => call.includes('/reject'))).toBe(false)
    expect(screen.getByText(PENDING.email)).toBeTruthy()
  })
})
