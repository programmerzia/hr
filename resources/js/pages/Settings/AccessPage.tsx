import { router } from '@inertiajs/react'
import { Lock, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { PageHeader } from '../../components/shared/PageHeader'
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  Field,
  IconButton,
  Input,
  NativeSelect,
  Sheet,
  Table,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../components/ui'
import { useShared } from '../../inertia/props'
import { SettingsTabs } from './SettingsTabs'

interface AccessRole {
  id: number
  name: string
  label: string
  is_system: boolean
  users_count: number
  permissions: string[]
}
interface AccessPermission {
  name: string
  label: string
  module: string
}
interface AccessModule {
  key: string
  label: string
}
interface AccessUser {
  id: number
  /** Employee id, used for PATCH /people/{employee}/role. */
  employee_id: number
  name: string
  email: string
  role: string
  direct_permissions: string[]
}
interface AccessProps {
  roles: AccessRole[]
  permissions: AccessPermission[]
  modules: AccessModule[]
  users: AccessUser[]
}

const LOCKED = (role: AccessRole, perm: string) => role.name === 'management' && perm === 'manage_access'

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x))
}

export default function AccessPage() {
  const props = useShared<Partial<AccessProps>>()
  const roles = props.roles ?? []
  const permissions = props.permissions ?? []
  const modules = props.modules ?? []
  const users = props.users ?? []

  return (
    <div className="mx-auto max-w-content">
      <PageHeader
        title="Access"
        description="Decide which roles can open which parts of the workspace. The server enforces these; menus follow them."
        tabs={<SettingsTabs />}
      />
      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles">Roles &amp; permissions</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
        </TabsList>
        <TabsContent value="roles">
          <RolesMatrix roles={roles} permissions={permissions} modules={modules} />
        </TabsContent>
        <TabsContent value="people">
          <PeopleTable users={users} roles={roles} permissions={permissions} modules={modules} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function groupPermissions(permissions: AccessPermission[], modules: AccessModule[]) {
  const keys = Array.from(new Set([...modules.map((m) => m.key), ...permissions.map((p) => p.module)]))
  return keys
    .map((key) => ({
      key,
      label: modules.find((m) => m.key === key)?.label ?? key,
      items: permissions.filter((p) => p.module === key),
    }))
    .filter((g) => g.items.length > 0)
}

function RolesMatrix({ roles, permissions, modules }: { roles: AccessRole[]; permissions: AccessPermission[]; modules: AccessModule[] }) {
  // Unsaved edits per role id; absent key = no pending change.
  const [drafts, setDrafts] = useState<Record<number, string[]>>({})
  const [saving, setSaving] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<AccessRole | null>(null)
  const groups = useMemo(() => groupPermissions(permissions, modules), [permissions, modules])

  const current = (r: AccessRole) => drafts[r.id] ?? r.permissions
  const dirty = (r: AccessRole) => drafts[r.id] !== undefined && !sameSet(drafts[r.id], r.permissions)

  function toggle(r: AccessRole, perm: string, on: boolean) {
    const base = current(r)
    const next = on ? Array.from(new Set([...base, perm])) : base.filter((p) => p !== perm)
    setDrafts((d) => ({ ...d, [r.id]: next }))
  }

  function save(r: AccessRole) {
    setSaving(r.id)
    router.put(
      `/settings/access/roles/${r.id}`,
      { permissions: current(r) },
      {
        preserveScroll: true,
        onSuccess: () =>
          setDrafts((d) => {
            const { [r.id]: _omit, ...rest } = d
            return rest
          }),
        onFinish: () => setSaving(null),
      },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
          New role
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] border-collapse text-base">
          <thead>
            <tr className="border-b border-border bg-surface-2 align-bottom">
              <th className="sticky left-0 z-10 min-w-[220px] bg-surface-2 px-3 py-2 text-left text-sm font-medium text-fg-muted">Permission</th>
              {roles.map((r) => (
                <th key={r.id} className="min-w-[120px] px-3 py-2 text-center text-sm font-medium">
                  <div className="flex flex-col items-center gap-1">
                    <span>{r.label}</span>
                    <div className="flex items-center gap-1">
                      {r.is_system && <Badge variant="neutral">System</Badge>}
                      <span className="text-xs font-normal text-fg-muted">
                        {r.users_count} {r.users_count === 1 ? 'person' : 'people'}
                      </span>
                    </div>
                    {dirty(r) && <Badge variant="warning">Unsaved</Badge>}
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="primary" disabled={!dirty(r)} loading={saving === r.id} onClick={() => save(r)}>
                        Save
                      </Button>
                      {!r.is_system && r.users_count === 0 && (
                        <IconButton label={`Delete ${r.label}`} size="sm" onClick={() => setDeleting(r)}>
                          <Trash2 size={16} />
                        </IconButton>
                      )}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr>
                <td colSpan={roles.length + 1} className="px-3 py-4 text-fg-muted">
                  No permissions defined.
                </td>
              </tr>
            )}
            {groups.map((g) => (
              <MatrixGroup key={g.key} label={g.label} cols={roles.length + 1}>
                {g.items.map((p) => (
                  <tr key={p.name} className="border-b border-border last:border-0">
                    <td className="sticky left-0 z-10 bg-surface px-3 py-2">
                      <div className="font-medium">{p.label}</div>
                      <div className="font-mono text-xs text-fg-subtle">{p.name}</div>
                    </td>
                    {roles.map((r) => {
                      const locked = LOCKED(r, p.name)
                      return (
                        <td key={r.id} className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Checkbox
                              aria-label={`${r.label}: ${p.label}`}
                              checked={locked || current(r).includes(p.name)}
                              disabled={locked}
                              onCheckedChange={(v) => toggle(r, p.name, v === true)}
                            />
                            {locked && <Lock size={12} className="text-fg-subtle" aria-label="Locked" />}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </MatrixGroup>
            ))}
          </tbody>
        </table>
      </div>
      <CreateRoleDialog open={creating} onOpenChange={setCreating} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete role"
        description={deleting ? `Delete the ${deleting.label} role? This cannot be undone.` : ''}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (deleting) router.delete(`/settings/access/roles/${deleting.id}`, { preserveScroll: true })
          setDeleting(null)
        }}
      />
    </div>
  )
}

function MatrixGroup({ label, cols, children }: { label: string; cols: number; children: React.ReactNode }) {
  return (
    <>
      <tr className="border-b border-border bg-surface-2/60">
        <td colSpan={cols} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">
          {label}
        </td>
      </tr>
      {children}
    </>
  )
}

function slugify(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function CreateRoleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [label, setLabel] = useState('')
  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  function close(o: boolean) {
    if (!o) {
      setLabel('')
      setName('')
      setTouched(false)
      setErrors({})
    }
    onOpenChange(o)
  }

  function submit() {
    setBusy(true)
    router.post(
      '/settings/access/roles',
      { name, label },
      {
        preserveScroll: true,
        onSuccess: () => close(false),
        onError: (e) => setErrors(e),
        onFinish: () => setBusy(false),
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="New role"
      description="A custom role starts with no permissions. Tick what it can do, then save."
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} disabled={!label.trim() || !name.trim()} onClick={submit}>
            Create role
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (label.trim() && name.trim()) submit()
        }}
      >
        <Field label="Label" required error={errors.label}>
          <Input
            value={label}
            onChange={(e) => {
              setLabel(e.target.value)
              if (!touched) setName(slugify(e.target.value))
            }}
          />
        </Field>
        <Field label="Name (slug)" required error={errors.name} hint="Lowercase letters, numbers and underscores.">
          <Input
            value={name}
            onChange={(e) => {
              setTouched(true)
              setName(e.target.value)
            }}
          />
        </Field>
      </form>
    </Dialog>
  )
}

function PeopleTable({
  users,
  roles,
  permissions,
  modules,
}: {
  users: AccessUser[]
  roles: AccessRole[]
  permissions: AccessPermission[]
  modules: AccessModule[]
}) {
  const [editing, setEditing] = useState<AccessUser | null>(null)

  return (
    <>
      <Table>
        <Thead>
          <tr>
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Role</Th>
            <Th className="w-28" />
          </tr>
        </Thead>
        <Tbody>
          {users.length === 0 && (
            <Tr>
              <Td colSpan={4} className="text-fg-muted">
                No users.
              </Td>
            </Tr>
          )}
          {users.map((u) => (
            <Tr key={u.id}>
              <Td className="font-medium">{u.name}</Td>
              <Td className="text-fg-muted">{u.email}</Td>
              <Td>
                <NativeSelect
                  aria-label={`Role for ${u.name}`}
                  value={u.role}
                  onChange={(e) => router.patch(`/people/${u.employee_id}/role`, { role: e.target.value }, { preserveScroll: true })}
                >
                  {!roles.some((r) => r.name === u.role) && <option value={u.role}>{u.role}</option>}
                  {roles.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.label}
                    </option>
                  ))}
                </NativeSelect>
              </Td>
              <Td>
                <div className="flex items-center justify-end gap-2">
                  {(u.direct_permissions ?? []).length > 0 && <Badge variant="info">{u.direct_permissions.length}</Badge>}
                  <Button size="sm" onClick={() => setEditing(u)}>
                    Overrides
                  </Button>
                </div>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
      {editing && (
        <OverridesSheet
          key={editing.id}
          user={editing}
          permissions={permissions}
          modules={modules}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

function OverridesSheet({
  user,
  permissions,
  modules,
  onClose,
}: {
  user: AccessUser
  permissions: AccessPermission[]
  modules: AccessModule[]
  onClose: () => void
}) {
  const [selected, setSelected] = useState<string[]>(user.direct_permissions ?? [])
  const [busy, setBusy] = useState(false)
  const groups = useMemo(() => groupPermissions(permissions, modules), [permissions, modules])

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Overrides: ${user.name}`}
      description="Direct permissions are added on top of what the role already allows."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={() => {
              setBusy(true)
              router.put(
                `/settings/access/users/${user.id}/permissions`,
                { permissions: selected },
                { preserveScroll: true, onSuccess: onClose, onFinish: () => setBusy(false) },
              )
            }}
          >
            Save overrides
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 p-4">
        {groups.map((g) => (
          <div key={g.key} className="flex flex-col gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{g.label}</div>
            {g.items.map((p) => (
              <Checkbox
                key={p.name}
                label={p.label}
                checked={selected.includes(p.name)}
                onCheckedChange={(v) => setSelected((s) => (v === true ? Array.from(new Set([...s, p.name])) : s.filter((x) => x !== p.name)))}
              />
            ))}
          </div>
        ))}
      </div>
    </Sheet>
  )
}
