import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import prisma from './db';
import { CompanyRole, SubscriptionStatus } from '@prisma/client';
import { getRuntime } from './desktop-local/runtime';
import { licenseAllowsUse } from './desktop-local/license';

/*
 * DESKTOP VERSION (desktop-owned; not overwritten by sync-upstream).
 * Differences from online: sessions are signed with a random per-install
 * secret, and features / expiry come from the signed desktop license instead
 * of SaaS subscriptions.
 */
function jwtSecret() {
  return new TextEncoder().encode(getRuntime().sessionSecret);
}

const SESSION_COOKIE_NAME = 'vtgst_session';
const ACTIVE_COMPANY_COOKIE = 'vtgst_active_company';
const ACTIVE_FY_COOKIE = 'vtgst_active_fy';

export interface UserSession {
  userId: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
}

export interface AuthContext {
  user: {
    id: string;
    email: string;
    name: string;
    isSuperAdmin: boolean;
  };
  account: {
    id: string;
    name: string;
    status: SubscriptionStatus;
    trialStartedAt: Date;
    trialEndsAt: Date;
    isExpired: boolean;
    features: string[];
  } | null;
  company: {
    id: string;
    name: string;
    legalName: string | null;
    gstin: string | null;
    stateId: string | null;
    stateName?: string;
    stateCodeGst?: string;
    defaultTaxMode: string;
    posEnableTax?: boolean;
    currencyCode: string;
    currencySymbol: string;
    role: CompanyRole;
  } | null;
  financialYear: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    isClosed: boolean;
  } | null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(session: UserSession): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(jwtSecret());
}

export async function verifySessionToken(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    return payload as unknown as UserSession;
  } catch {
    return null;
  }
}

export const getCurrentUser = cache(async (): Promise<UserSession | null> => {
  const cookieStore = await cookies();
  let token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    try {
      const headerStore = await headers();
      const authHeader = headerStore.get('authorization') || headerStore.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      }
    } catch (_) {}
  }
  if (!token) return null;
  return verifySessionToken(token);
});

export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const userSession = await getCurrentUser();
  if (!userSession) return null;

  const user = await prisma.user.findUnique({
    where: { id: userSession.userId },
    include: {
      ownedAccounts: {
        include: {
          subscriptions: {
            where: { status: 'ACTIVE' },
            include: {
              plan: {
                include: {
                  features: {
                    include: { feature: true },
                  },
                },
              },
            },
            take: 1,
          },
          companies: {
            include: {
              state: true,
              financialYears: {
                orderBy: { startDate: 'desc' },
              },
            },
          },
        },
      },
      companyUsers: {
        where: { isActive: true },
        include: {
          company: {
            include: {
              state: true,
              account: {
                include: {
                  subscriptions: {
                    where: { status: 'ACTIVE' },
                    include: {
                      plan: {
                        include: {
                          features: {
                            include: { feature: true },
                          },
                        },
                      },
                    },
                    take: 1,
                  },
                },
              },
              financialYears: {
                orderBy: { startDate: 'desc' },
              },
            },
          },
        },
      },
    },
  });

  if (!user) return null;

  const cookieStore = await cookies();
  let activeCompanyIdCookie = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value;
  let activeFyIdCookie = cookieStore.get(ACTIVE_FY_COOKIE)?.value;

  try {
    const headerStore = await headers();
    activeCompanyIdCookie = activeCompanyIdCookie || headerStore.get('x-company-id') || undefined;
    activeFyIdCookie = activeFyIdCookie || headerStore.get('x-financial-year-id') || undefined;
  } catch (_) {}

  // Resolve active company & role
  let selectedCompany: any = null;
  let userRole: CompanyRole = CompanyRole.READ_ONLY;
  let accountData: any = null;

  // Check owned accounts first
  if (user.ownedAccounts.length > 0) {
    const ownedAcc = user.ownedAccounts[0];
    accountData = ownedAcc;
    const matchingCompany = activeCompanyIdCookie
      ? ownedAcc.companies.find((c) => c.id === activeCompanyIdCookie)
      : ownedAcc.companies[0];

    if (matchingCompany) {
      selectedCompany = matchingCompany;
      userRole = CompanyRole.OWNER;
    }
  }

  // If not found in owned, check companyUsers
  if (!selectedCompany && user.companyUsers.length > 0) {
    const matchingCu = activeCompanyIdCookie
      ? user.companyUsers.find((cu) => cu.companyId === activeCompanyIdCookie)
      : user.companyUsers[0];

    if (matchingCu) {
      selectedCompany = matchingCu.company;
      userRole = matchingCu.role;
      accountData = matchingCu.company.account;
    }
  }



  // Determine trial & features
  let isExpired = false;
  let activeFeatures: string[] = [
    'ITEMS', 'INVOICING', 'PURCHASES', 'INVENTORY', 'PARTY_BALANCE', 'POS',
    'SALESMAN', 'LOYALTY', 'CREDIT_NOTE', 'DEBIT_NOTE', 'EXPORT',
    'JOB_WORK', 'GST_REPORTS', 'EMAIL', 'WHATSAPP', 'ADVANCED_REPORTS'
  ];

  // Desktop: the signed license decides features and expiry.
  const rt = getRuntime();
  const licensePayload = rt.license.payload;
  if (licensePayload?.features?.length) activeFeatures = licensePayload.features;
  isExpired = !licenseAllowsUse(rt.license.state);
  if (accountData) {
    accountData = {
      ...accountData,
      status: isExpired ? SubscriptionStatus.EXPIRED : SubscriptionStatus.ACTIVE,
      trialEndsAt: licensePayload?.exp ? new Date(licensePayload.exp) : new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000),
    };
  }

  // Resolve active financial year
  let activeFy: any = null;
  if (selectedCompany?.financialYears?.length > 0) {
    activeFy = activeFyIdCookie
      ? selectedCompany.financialYears.find((fy: any) => fy.id === activeFyIdCookie)
      : selectedCompany.financialYears.find((fy: any) => !fy.isClosed) || selectedCompany.financialYears[0];
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isSuperAdmin: user.isSuperAdmin,
    },
    account: accountData
      ? {
        id: accountData.id,
        name: accountData.name,
        status: accountData.status,
        trialStartedAt: accountData.trialStartedAt,
        trialEndsAt: accountData.trialEndsAt,
        isExpired,
        features: activeFeatures,
      }
      : user.isSuperAdmin
        ? {
          id: 'super-admin-account',
          name: 'Super Admin Master Console',
          status: SubscriptionStatus.ACTIVE,
          trialStartedAt: new Date(),
          trialEndsAt: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000),
          isExpired: false,
          features: activeFeatures,
        }
        : null,
    company: selectedCompany
      ? {
        id: selectedCompany.id,
        name: selectedCompany.name,
        legalName: selectedCompany.legalName,
        gstin: selectedCompany.gstin,
        stateId: selectedCompany.stateId,
        stateName: selectedCompany.state?.name,
        stateCodeGst: selectedCompany.state?.stateCodeGst,
        defaultTaxMode: selectedCompany.defaultTaxMode,
        posEnableTax: selectedCompany.posEnableTax ?? true,
        currencyCode: selectedCompany.currencyCode,
        currencySymbol: selectedCompany.currencySymbol,
        role: userRole,
      }
      : null,
    financialYear: activeFy
      ? {
        id: activeFy.id,
        name: activeFy.name,
        startDate: activeFy.startDate,
        endDate: activeFy.endDate,
        isClosed: activeFy.isClosed,
      }
      : null,
  };
});

export function hasFeature(authContext: AuthContext | null, featureCode: string): boolean {
  if (!authContext) return false;
  if (authContext.user.isSuperAdmin) return true;
  if (!authContext.account) return false;
  if (authContext.account.isExpired) return false;
  return authContext.account.features.includes(featureCode);
}
