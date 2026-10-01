import { NextResponse } from 'next/server';
import { getAuthContext, verifyPassword, hashPassword } from '@/lib/auth';
import prisma from '@/lib/db';

export async function POST(req: Request) {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.user) {
      return NextResponse.json({ error: 'Unauthorized: Please sign in first' }, { status: 401 });
    }

    const { currentPassword, newPassword, confirmPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current password and new password are required' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters long' }, { status: 400 });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'New passwords do not match' }, { status: 400 });
    }

    // Fetch user with password hash
    const user = await prisma.user.findUnique({
      where: { id: authContext.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Incorrect current password' }, { status: 400 });
    }

    // Hash and update new password
    const newPasswordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully! You can now use your new password.',
    });
  } catch (error: any) {
    console.error('Error changing password:', error);
    return NextResponse.json({ error: error.message || 'Failed to change password' }, { status: 500 });
  }
}
