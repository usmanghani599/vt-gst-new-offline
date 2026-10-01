import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [company, states] = await Promise.all([
      prisma.company.findUnique({
        where: { id: authContext.company.id },
        include: {
          state: true,
          bankAccounts: true,
        },
      }),
      prisma.state.findMany({
        orderBy: { name: 'asc' },
      }),
    ]);

    return NextResponse.json({ company, states });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = authContext.company.id;
    const body = await req.json();

    const {
      name,
      legalName,
      gstin,
      pan,
      phone,
      mobile,
      email,
      website,
      address,
      city,
      pincode,
      stateId,
      defaultTaxMode,
      posEnableTax,
      fssaiNo,
      drugLicenseNo,
      bankAccount,
    } = body;

    // Update company details
    const updatedCompany = await prisma.$transaction(async (tx) => {
      const comp = await tx.company.update({
        where: { id: companyId },
        data: {
          name: name ? name.trim() : undefined,
          legalName: legalName ? legalName.trim() : null,
          gstin: gstin ? gstin.trim().toUpperCase() : null,
          pan: pan ? pan.trim().toUpperCase() : null,
          phone: phone ? phone.trim() : null,
          mobile: mobile ? mobile.trim() : null,
          email: email ? email.trim() : null,
          website: website ? website.trim() : null,
          address: address ? address.trim() : null,
          city: city ? city.trim() : null,
          pincode: pincode ? pincode.trim() : null,
          stateId: stateId || null,
          defaultTaxMode: defaultTaxMode === 'TAX_INCLUSIVE' ? 'TAX_INCLUSIVE' : 'TAX_EXCLUSIVE',
          posEnableTax: typeof posEnableTax === 'boolean' ? posEnableTax : true,
          fssaiNo: fssaiNo ? fssaiNo.trim() : null,
          drugLicenseNo: drugLicenseNo ? drugLicenseNo.trim() : null,
        },
        include: {
          state: true,
          bankAccounts: true,
        },
      });

      // If bank account info is supplied
      if (bankAccount && bankAccount.bankName && bankAccount.accountNumber) {
        if (bankAccount.id) {
          // Update existing
          await tx.bankAccount.update({
            where: { id: bankAccount.id },
            data: {
              bankName: bankAccount.bankName.trim(),
              accountNumber: bankAccount.accountNumber.trim(),
              ifsc: bankAccount.ifsc ? bankAccount.ifsc.trim().toUpperCase() : '',
              branch: bankAccount.branch ? bankAccount.branch.trim() : null,
              upiId: bankAccount.upiId ? bankAccount.upiId.trim() : null,
              isDefault: true,
            },
          });
        } else {
          // Create new default
          await tx.bankAccount.updateMany({
            where: { companyId },
            data: { isDefault: false },
          });

          await tx.bankAccount.create({
            data: {
              companyId,
              bankName: bankAccount.bankName.trim(),
              accountNumber: bankAccount.accountNumber.trim(),
              ifsc: bankAccount.ifsc ? bankAccount.ifsc.trim().toUpperCase() : '',
              branch: bankAccount.branch ? bankAccount.branch.trim() : null,
              upiId: bankAccount.upiId ? bankAccount.upiId.trim() : null,
              isDefault: true,
            },
          });
        }
      }

      return comp;
    });

    return NextResponse.json({ success: true, company: updatedCompany });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
