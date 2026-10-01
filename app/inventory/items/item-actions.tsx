'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Edit, Trash2, Loader2, ArrowRight } from 'lucide-react';

interface ItemActionsProps {
  itemId: string;
  itemName: string;
  canManage?: boolean;
}

export function ItemActions({ itemId, itemName, canManage = true }: ItemActionsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  if (!canManage) {
    return (
      <span className="text-[11px] text-slate-400 italic">Read-only</span>
    );
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = window.confirm(
      `Are you sure you want to delete or deactivate item "${itemName}"?`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/items/${itemId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete item');

      router.refresh();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5 justify-center">
      <Link
        href={`/inventory/items/${itemId}`}
        className="inline-flex items-center gap-1 text-slate-700 hover:text-sky-700 font-semibold bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg text-xs transition"
      >
        <Edit className="h-3 w-3" /> Edit
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        title="Delete or Deactivate Item"
        className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-1 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
      >
        {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
      </button>
    </div>
  );
}
