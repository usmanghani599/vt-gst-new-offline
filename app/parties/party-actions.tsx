'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';

interface PartyActionsProps {
  partyId: string;
  partyName: string;
  partyType?: 'CUSTOMER' | 'SUPPLIER';
}

export function PartyActions({ partyId, partyName, partyType = 'CUSTOMER' }: PartyActionsProps) {
  return (
    <div className="flex items-center gap-1.5 justify-center">
      {/* Ledger Button */}
      <Link
        href={`/parties/ledger?partyId=${partyId}`}
        className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-800 font-semibold bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-lg text-xs transition shadow-2xs"
        title="View Statement of Account & Ledger"
      >
        <BookOpen className="h-3.5 w-3.5" /> Ledger Statement
      </Link>
    </div>
  );
}
