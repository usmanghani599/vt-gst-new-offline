import { NextRequest, NextResponse } from 'next/server';
import { uploadToS3Bucket } from '@/lib/s3';
import { getCurrentClientUser } from '@/lib/client-auth';
import { getAuthContext } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const clientSession = await getCurrentClientUser();
    const adminContext = await getAuthContext();

    const companyId =
      clientSession?.companyId ||
      adminContext?.company?.id ||
      req.nextUrl.searchParams.get('companyId') ||
      'general';

    const keyParam = req.nextUrl.searchParams.get('key');

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided in form data' }, { status: 400 });
    }

    const timestamp = Date.now();
    const sanitizedFileName = (file.name || 'attachment.jpg').replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Key = keyParam || `tenants/${companyId}/uploads/${timestamp}-${sanitizedFileName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || 'application/octet-stream';

    const result = await uploadToS3Bucket(buffer, s3Key, contentType);

    return NextResponse.json({
      success: true,
      fileUrl: result.fileUrl,
      s3Key: result.s3Key,
      r2Key: result.s3Key, // Compatibility alias
      isS3: result.isS3,
      fileName: file.name,
      fileSize: file.size,
      contentType,
    });
  } catch (error: any) {
    console.error('Amazon S3 upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload to Amazon S3' },
      { status: 500 }
    );
  }
}
