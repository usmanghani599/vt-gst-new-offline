import { NextResponse } from 'next/server';
import { getAuthContext, hashPassword } from '@/lib/auth';
import prisma from '@/lib/db';
import { CompanyRole, UserStatus } from '@prisma/client';
import Decimal from 'decimal.js';

export async function GET(request: Request) {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company) {
      return NextResponse.json({ error: 'Unauthorized or no active company context' }, { status: 401 });
    }

    const companyId = authContext.company.id;

    // Fetch all Company Users along with their user profile
    const companyUsers = await prisma.companyUser.findMany({
      where: { companyId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Also fetch any salesman records to map salesman info
    const salesmen = await prisma.salesman.findMany({
      where: { companyId },
    });
    const salesmanMap = new Map<string, any>();
    salesmen.forEach((sm) => {
      if (sm.userId) {
        salesmanMap.set(sm.userId, sm);
      }
    });

    const usersList = companyUsers.map((cu) => {
      const linkedSalesman = cu.userId ? salesmanMap.get(cu.userId) : null;
      return {
        id: cu.id,
        userId: cu.userId,
        name: cu.user.name,
        email: cu.user.email,
        mobile: cu.user.mobile,
        role: cu.role,
        isActive: cu.isActive,
        userStatus: cu.user.status,
        joinedAt: cu.createdAt,
        salesman: linkedSalesman
          ? {
              id: linkedSalesman.id,
              employeeCode: linkedSalesman.employeeCode,
              commissionRate: Number(linkedSalesman.commissionRate),
              pointsPerAmount: Number(linkedSalesman.pointsPerAmount),
            }
          : null,
      };
    });

    return NextResponse.json({ users: usersList });
  } catch (error: any) {
    console.error('Fetch company users error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch company users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company) {
      return NextResponse.json({ error: 'Unauthorized or no active company context' }, { status: 401 });
    }

    const companyId = authContext.company.id;
    const body = await request.json();

    const {
      name,
      email,
      mobile,
      password,
      role = 'POS_OPERATOR',
      employeeCode,
      commissionRate = 0,
      pointsPerAmount = 1.0,
    } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and Email are required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if role is valid
    const validRoles = Object.values(CompanyRole);
    if (!validRoles.includes(role as CompanyRole)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }, { status: 400 });
    }

    // Check if user already exists
    let existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      // Check if already in this company
      const existingCu = await prisma.companyUser.findUnique({
        where: {
          companyId_userId: {
            companyId,
            userId: existingUser.id,
          },
        },
      });

      if (existingCu) {
        return NextResponse.json({ error: 'User is already assigned to this company' }, { status: 400 });
      }
    } else {
      if (!password || password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 });
      }

      const passwordHash = await hashPassword(password);
      existingUser = await prisma.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          mobile: mobile ? mobile.trim() : null,
          passwordHash,
          status: UserStatus.ACTIVE,
        },
      });
    }

    // Create CompanyUser association
    const companyUser = await prisma.companyUser.create({
      data: {
        companyId,
        userId: existingUser.id,
        role: role as CompanyRole,
        isActive: true,
      },
    });

    // If role is SALESMAN, create or link salesman profile
    let createdSalesman = null;
    if (role === 'SALESMAN') {
      createdSalesman = await prisma.salesman.create({
        data: {
          companyId,
          userId: existingUser.id,
          name: name.trim(),
          employeeCode: employeeCode ? employeeCode.trim() : `SM-${Math.floor(1000 + Math.random() * 9000)}`,
          mobile: mobile ? mobile.trim() : null,
          email: normalizedEmail,
          commissionRate: new Decimal(commissionRate || 0).toNumber(),
          pointsPerAmount: new Decimal(pointsPerAmount || 1.0).toNumber(),
          isActive: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: companyUser.id,
        userId: existingUser.id,
        name: existingUser.name,
        email: existingUser.email,
        mobile: existingUser.mobile,
        role: companyUser.role,
        isActive: companyUser.isActive,
        salesman: createdSalesman,
      },
    });
  } catch (error: any) {
    console.error('Create company user error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create user' }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = authContext.company.id;
    const body = await request.json();
    const { id, role, isActive, name, mobile, password, commissionRate, pointsPerAmount, employeeCode } = body;

    if (!id) {
      return NextResponse.json({ error: 'Company User ID is required' }, { status: 400 });
    }

    const existingCu = await prisma.companyUser.findFirst({
      where: { id, companyId },
      include: { user: true },
    });

    if (!existingCu) {
      return NextResponse.json({ error: 'Company user not found' }, { status: 404 });
    }

    // Update CompanyUser
    const updateData: any = {};
    if (role && Object.values(CompanyRole).includes(role as CompanyRole)) {
      updateData.role = role as CompanyRole;
    }
    if (typeof isActive === 'boolean') {
      updateData.isActive = isActive;
    }

    const updatedCu = await prisma.companyUser.update({
      where: { id },
      data: updateData,
    });

    // Update User profile if name/mobile/password given
    const userUpdate: any = {};
    if (name) userUpdate.name = name.trim();
    if (mobile !== undefined) userUpdate.mobile = mobile ? mobile.trim() : null;
    if (password && password.length >= 6) {
      userUpdate.passwordHash = await hashPassword(password);
    }

    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({
        where: { id: existingCu.userId },
        data: userUpdate,
      });
    }

    // If salesman role, update or create salesman entity
    if (role === 'SALESMAN' || existingCu.role === 'SALESMAN') {
      const existingSm = await prisma.salesman.findFirst({
        where: { companyId, userId: existingCu.userId },
      });

      if (existingSm) {
        await prisma.salesman.update({
          where: { id: existingSm.id },
          data: {
            name: name ? name.trim() : existingSm.name,
            employeeCode: employeeCode ? employeeCode.trim() : existingSm.employeeCode,
            mobile: mobile ? mobile.trim() : existingSm.mobile,
            commissionRate: commissionRate !== undefined ? new Decimal(commissionRate).toNumber() : existingSm.commissionRate,
            pointsPerAmount: pointsPerAmount !== undefined ? new Decimal(pointsPerAmount).toNumber() : existingSm.pointsPerAmount,
            isActive: typeof isActive === 'boolean' ? isActive : existingSm.isActive,
          },
        });
      } else if (role === 'SALESMAN') {
        await prisma.salesman.create({
          data: {
            companyId,
            userId: existingCu.userId,
            name: name ? name.trim() : existingCu.user.name,
            employeeCode: employeeCode ? employeeCode.trim() : `SM-${Math.floor(1000 + Math.random() * 9000)}`,
            mobile: mobile ? mobile.trim() : existingCu.user.mobile,
            email: existingCu.user.email,
            commissionRate: new Decimal(commissionRate || 0).toNumber(),
            pointsPerAmount: new Decimal(pointsPerAmount || 1.0).toNumber(),
            isActive: true,
          },
        });
      }
    }

    return NextResponse.json({ success: true, updated: updatedCu });
  } catch (error: any) {
    console.error('Update company user error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update user' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = authContext.company.id;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const existingCu = await prisma.companyUser.findFirst({
      where: { id, companyId },
    });

    if (!existingCu) {
      return NextResponse.json({ error: 'User assignment not found' }, { status: 404 });
    }

    await prisma.companyUser.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'User access revoked from company' });
  } catch (error: any) {
    console.error('Delete company user error:', error);
    return NextResponse.json({ error: error.message || 'Failed to remove user' }, { status: 400 });
  }
}
