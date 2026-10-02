'use client';

import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Store,
  Award,
  Search,
  CheckCircle2,
  XCircle,
  KeyRound,
  Trash2,
  Edit2,
  Mail,
  Phone,
  Calendar,
  Lock,
  Loader2,
  X,
  Sparkles,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface CompanyUserItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  mobile: string | null;
  role: string;
  isActive: boolean;
  userStatus: string;
  joinedAt: string;
  salesman: {
    id: string;
    employeeCode: string | null;
    commissionRate: number;
    pointsPerAmount: number;
  } | null;
}

interface CompanyUsersClientProps {
  initialUsers: CompanyUserItem[];
  companyName: string;
  currentUserRole: string;
}

const ROLE_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; desc: string; icon: any }
> = {
  OWNER: {
    label: 'Company Owner',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    desc: 'Full company & billing ownership',
    icon: ShieldCheck,
  },
  ADMIN: {
    label: 'Company Admin',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    desc: 'Full administrative access',
    icon: ShieldCheck,
  },
  MANAGER: {
    label: 'Manager',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    desc: 'Inventory, reports & sales oversight',
    icon: Users,
  },
  ACCOUNTANT: {
    label: 'Accountant',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    desc: 'Ledgers, GST tax & financial statements',
    icon: Users,
  },
  POS_OPERATOR: {
    label: 'Cash Counter / POS Operator',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    desc: 'Retail counter billing & cash register checkout',
    icon: Store,
  },
  SALESMAN: {
    label: 'Salesman / Field Staff',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    desc: 'Sales orders, customer visits & reward points',
    icon: Award,
  },
  READ_ONLY: {
    label: 'Read Only',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    desc: 'View only reports & invoices',
    icon: Users,
  },
};

export function CompanyUsersClient({
  initialUsers,
  companyName,
  currentUserRole,
}: CompanyUsersClientProps) {
  const [users, setUsers] = useState<CompanyUserItem[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<CompanyUserItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    password: '',
    role: 'POS_OPERATOR',
    employeeCode: '',
    commissionRate: '0',
    pointsPerAmount: '1.0',
  });

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchSearch =
        !searchQuery ||
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.mobile && u.mobile.includes(searchQuery)) ||
        (u.salesman?.employeeCode && u.salesman.employeeCode.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchRole && matchSearch;
    });
  }, [users, roleFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = users.length;
    const posOperators = users.filter((u) => u.role === 'POS_OPERATOR').length;
    const salesmen = users.filter((u) => u.role === 'SALESMAN').length;
    const admins = users.filter((u) => u.role === 'ADMIN' || u.role === 'OWNER').length;
    return { total, posOperators, salesmen, admins };
  }, [users]);

  function handleOpenCreate(rolePreset: string = 'POS_OPERATOR') {
    setEditUser(null);
    setFormData({
      name: '',
      email: '',
      mobile: '',
      password: '',
      role: rolePreset,
      employeeCode: '',
      commissionRate: '0',
      pointsPerAmount: '1.0',
    });
    setActionError('');
    setModalOpen(true);
  }

  function handleOpenEdit(u: CompanyUserItem) {
    setEditUser(u);
    setFormData({
      name: u.name,
      email: u.email,
      mobile: u.mobile || '',
      password: '',
      role: u.role,
      employeeCode: u.salesman?.employeeCode || '',
      commissionRate: String(u.salesman?.commissionRate || '0'),
      pointsPerAmount: String(u.salesman?.pointsPerAmount || '1.0'),
    });
    setActionError('');
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setActionError('');

    try {
      if (editUser) {
        // Update user
        const res = await fetch('/api/company/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editUser.id,
            name: formData.name,
            mobile: formData.mobile,
            password: formData.password || undefined,
            role: formData.role,
            employeeCode: formData.employeeCode,
            commissionRate: Number(formData.commissionRate || 0),
            pointsPerAmount: Number(formData.pointsPerAmount || 1.0),
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update user');

        setUsers((prev) =>
          prev.map((u) =>
            u.id === editUser.id
              ? {
                  ...u,
                  name: formData.name,
                  mobile: formData.mobile || null,
                  role: formData.role,
                  salesman:
                    formData.role === 'SALESMAN'
                      ? {
                          id: u.salesman?.id || 'sm',
                          employeeCode: formData.employeeCode || u.salesman?.employeeCode || null,
                          commissionRate: Number(formData.commissionRate),
                          pointsPerAmount: Number(formData.pointsPerAmount),
                        }
                      : null,
                }
              : u
          )
        );

        setSuccessMsg(`User "${formData.name}" updated successfully!`);
      } else {
        // Create new user
        const res = await fetch('/api/company/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            mobile: formData.mobile,
            password: formData.password,
            role: formData.role,
            employeeCode: formData.employeeCode,
            commissionRate: Number(formData.commissionRate || 0),
            pointsPerAmount: Number(formData.pointsPerAmount || 1.0),
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create user');

        setUsers((prev) => [
          {
            id: data.user.id,
            userId: data.user.userId,
            name: data.user.name,
            email: data.user.email,
            mobile: data.user.mobile,
            role: data.user.role,
            isActive: data.user.isActive,
            userStatus: 'ACTIVE',
            joinedAt: new Date().toISOString(),
            salesman: data.user.salesman
              ? {
                  id: data.user.salesman.id,
                  employeeCode: data.user.salesman.employeeCode,
                  commissionRate: Number(data.user.salesman.commissionRate),
                  pointsPerAmount: Number(data.user.salesman.pointsPerAmount),
                }
              : null,
          },
          ...prev,
        ]);

        setSuccessMsg(`User "${formData.name}" created successfully as ${ROLE_CONFIG[formData.role]?.label || formData.role}!`);
      }

      setModalOpen(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(u: CompanyUserItem) {
    const nextStatus = !u.isActive;
    try {
      const res = await fetch('/api/company/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: u.id,
          isActive: nextStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle user status');

      setUsers((prev) =>
        prev.map((item) => (item.id === u.id ? { ...item, isActive: nextStatus } : item))
      );
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDeleteUser(u: CompanyUserItem) {
    if (!confirm(`Are you sure you want to revoke company access for "${u.name}" (${u.email})?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/company/users?id=${u.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove user');

      setUsers((prev) => prev.filter((item) => item.id !== u.id));
      setSuccessMsg(`User "${u.name}" was removed from the company.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="h-7 w-7 text-sky-600" /> User & Staff Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 text-xs font-bold border border-sky-200">
              {companyName}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Create cash counter operators, field salesmen, accountants, and managers for your company
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleOpenCreate('POS_OPERATOR')}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
          >
            <Store className="h-4 w-4" />
            <span>+ Add Cash Counter User</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenCreate('SALESMAN')}
            className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
          >
            <Award className="h-4 w-4" />
            <span>+ Add Salesman User</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenCreate('ADMIN')}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span>+ Add Team Member</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-800 shadow-xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Total Users</span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">{stats.total}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Assigned to this store</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 bg-amber-50/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700">Cash Counter Users</span>
            <Store className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-900 mt-1">{stats.posOperators}</div>
          <div className="text-[10px] text-amber-600 font-medium mt-0.5">POS billing & checkout</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-sky-200/80 bg-sky-50/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-700">Salesmen / Field Staff</span>
            <Award className="h-4 w-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-sky-900 mt-1">{stats.salesmen}</div>
          <div className="text-[10px] text-sky-600 font-medium mt-0.5">Sales & incentive points</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-indigo-200/80 bg-indigo-50/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-700">Admins & Owners</span>
            <ShieldCheck className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-900 mt-1">{stats.admins}</div>
          <div className="text-[10px] text-indigo-600 font-medium mt-0.5">Master control access</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Role Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar shrink-0">
          {[
            { id: 'ALL', label: `All (${users.length})` },
            { id: 'POS_OPERATOR', label: 'Cash Counter' },
            { id: 'SALESMAN', label: 'Salesman' },
            { id: 'MANAGER', label: 'Manager' },
            { id: 'ACCOUNTANT', label: 'Accountant' },
            { id: 'ADMIN', label: 'Admin' },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setRoleFilter(pill.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                roleFilter === pill.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, mobile..."
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-3.5">User Details</th>
              <th className="p-3.5">Contact</th>
              <th className="p-3.5">Company Role</th>
              <th className="p-3.5">Linked Salesman Profile</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5">Joined Date</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-40 text-slate-400" />
                  <p className="font-bold text-slate-600">No users found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click "+ Add Team Member" or "+ Add Cash Counter User" to create users.
                  </p>
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => {
                const roleMeta = ROLE_CONFIG[u.role] || ROLE_CONFIG.READ_ONLY;
                const RoleIcon = roleMeta.icon;

                return (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition">
                    {/* User Details */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{u.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                            <Mail className="h-3 w-3 text-slate-400" /> {u.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="p-3.5">
                      {u.mobile ? (
                        <div className="font-medium text-slate-700 flex items-center gap-1 font-mono text-[11px]">
                          <Phone className="h-3 w-3 text-slate-400" /> {u.mobile}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Not provided</span>
                      )}
                    </td>

                    {/* Company Role Badge */}
                    <td className="p-3.5">
                      <div
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold text-[11px] ${roleMeta.bg} ${roleMeta.text} ${roleMeta.border}`}
                      >
                        <RoleIcon className="h-3.5 w-3.5" />
                        <span>{roleMeta.label}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{roleMeta.desc}</div>
                    </td>

                    {/* Salesman details if role is salesman */}
                    <td className="p-3.5">
                      {u.salesman ? (
                        <div className="space-y-0.5">
                          <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                            {u.salesman.employeeCode || 'Code: Auto'}
                          </span>
                          <div className="text-[10px] text-slate-500">
                            Commission: <strong>{u.salesman.commissionRate}%</strong> • Points:{' '}
                            <strong>{u.salesman.pointsPerAmount}%</strong>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">-</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="p-3.5">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(u)}
                        title="Click to toggle active status"
                        className="cursor-pointer"
                      >
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                            <XCircle className="h-3 w-3 text-rose-600" /> Inactive
                          </span>
                        )}
                      </button>
                    </td>

                    {/* Joined Date */}
                    <td className="p-3.5 text-slate-500 text-[11px] font-medium">
                      {formatDate(u.joinedAt)}
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(u)}
                          className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition"
                          title="Edit user role or details"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Revoke access"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* User Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                  {editUser ? <Edit2 className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editUser ? 'Edit Team Member' : 'Add New Team Member'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editUser
                      ? 'Update role or credentials for this store user'
                      : 'Create a cash counter, salesman, or admin login'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {actionError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                {actionError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
              {/* Name & Mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                  />
                </div>
              </div>

              {/* Email & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    disabled={!!editUser}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. cashcounter@store.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {editUser ? 'New Password (Optional)' : 'Password *'}
                  </label>
                  <input
                    type="password"
                    required={!editUser}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editUser ? 'Leave blank to keep same' : 'Min 6 characters'}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Assign Company Role *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    {
                      id: 'POS_OPERATOR',
                      label: 'Cash Counter User',
                      desc: 'Retail POS Counter & receipt printing',
                      icon: Store,
                      color: 'border-amber-400 bg-amber-50/50',
                    },
                    {
                      id: 'SALESMAN',
                      label: 'Salesman User',
                      desc: 'Field orders & commission tracking',
                      icon: Award,
                      color: 'border-sky-400 bg-sky-50/50',
                    },
                    {
                      id: 'ACCOUNTANT',
                      label: 'Accountant',
                      desc: 'GST tax filing & double entry ledger',
                      icon: Users,
                      color: 'border-emerald-400 bg-emerald-50/50',
                    },
                    {
                      id: 'MANAGER',
                      label: 'Manager',
                      desc: 'Stock & day-to-day operations',
                      icon: Users,
                      color: 'border-blue-400 bg-blue-50/50',
                    },
                    {
                      id: 'ADMIN',
                      label: 'Admin',
                      desc: 'Full store settings & team access',
                      icon: ShieldCheck,
                      color: 'border-indigo-400 bg-indigo-50/50',
                    },
                  ].map((r) => {
                    const isSelected = formData.role === r.id;
                    const Icon = r.icon;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, role: r.id })}
                        className={`p-3 rounded-2xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                          isSelected
                            ? `${r.color} ring-2 ring-sky-500 font-bold`
                            : 'bg-slate-50/50 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        <Icon className={`h-4 w-4 mt-0.5 ${isSelected ? 'text-sky-600' : 'text-slate-400'}`} />
                        <div>
                          <div className="font-bold text-slate-900">{r.label}</div>
                          <div className="text-[10px] text-slate-500 leading-tight">{r.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Extra fields if Salesman is selected */}
              {formData.role === 'SALESMAN' && (
                <div className="p-3 bg-sky-50/60 rounded-2xl border border-sky-200 space-y-3">
                  <div className="flex items-center gap-1.5 font-bold text-sky-900">
                    <Award className="h-4 w-4 text-sky-600" />
                    <span>Salesman Configuration</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Emp Code
                      </label>
                      <input
                        type="text"
                        value={formData.employeeCode}
                        onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                        placeholder="SM-001"
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Commission %
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.commissionRate}
                        onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Points / Sale %
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.pointsPerAmount}
                        onChange={(e) => setFormData({ ...formData, pointsPerAmount: e.target.value })}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  <span>{editUser ? 'Save Changes' : 'Create User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
