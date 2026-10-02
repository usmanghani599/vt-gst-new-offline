import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import {
  getS3Config,
  listS3BucketFiles,
  uploadToS3Bucket,
  deleteFromS3Bucket,
} from '@/lib/s3';
import { prisma } from '@/lib/db';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = authContext.company.id;
    const config = getS3Config();
    const type = req.nextUrl.searchParams.get('type') || 'ALL';
    const search = (req.nextUrl.searchParams.get('search') || '').toLowerCase();

    // 1. Gather files recorded in DB (Order Attachments & Payment Attachments)
    const orderAttachments = await prisma.clientOrderAttachment.findMany({
      where: {
        order: { companyId },
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            party: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const paymentAttachments = await prisma.payment.findMany({
      where: {
        companyId,
        attachmentUrl: { not: null },
      },
      select: {
        id: true,
        paymentNumber: true,
        amount: true,
        attachmentUrl: true,
        paymentDate: true,
        party: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Gather files from Amazon S3 Bucket (under tenants/{companyId})
    const s3Files = await listS3BucketFiles(`tenants/${companyId}/`, 100);

    // Merge & normalize into unique media items list
    const mediaMap = new Map<string, any>();

    // Add Order Attachments
    orderAttachments.forEach((oa: any) => {
      const ext = path.extname(oa.fileName || oa.r2Key || '').toLowerCase();
      let mediaType = 'IMAGE';
      if (oa.fileType === 'AUDIO_RECORDING' || ext === '.webm' || ext === '.mp3' || ext === '.ogg') {
        mediaType = 'AUDIO';
      } else if (ext === '.pdf') {
        mediaType = 'DOCUMENT';
      }

      mediaMap.set(oa.r2Key, {
        id: oa.id,
        key: oa.r2Key,
        fileName: oa.fileName,
        fileUrl: oa.fileUrl,
        fileSize: oa.fileSize || 0,
        mediaType,
        source: 'CLIENT_ORDER',
        referenceNumber: oa.order?.orderNumber,
        partyName: oa.order?.party?.name,
        durationSec: oa.durationSec,
        createdAt: oa.createdAt,
      });
    });

    // Add Payment Attachments
    paymentAttachments.forEach((p: any) => {
      if (!p.attachmentUrl) return;
      const key = p.attachmentUrl.split('/api/files/')[1] || p.attachmentUrl;
      const cleanKey = decodeURIComponent(key);

      if (!mediaMap.has(cleanKey)) {
        mediaMap.set(cleanKey, {
          id: p.id,
          key: cleanKey,
          fileName: `Payment_${p.paymentNumber}_Proof.jpg`,
          fileUrl: p.attachmentUrl,
          fileSize: 0,
          mediaType: 'IMAGE',
          source: 'PAYMENT_RECEIPT',
          referenceNumber: p.paymentNumber,
          partyName: p.party?.name,
          createdAt: p.paymentDate,
        });
      }
    });

    // Add remaining S3 bucket files
    s3Files.forEach((sf: any) => {
      if (!mediaMap.has(sf.key)) {
        const ext = path.extname(sf.key).toLowerCase();
        let mediaType = 'IMAGE';
        if (ext === '.webm' || ext === '.mp3' || ext === '.ogg' || ext === '.wav') {
          mediaType = 'AUDIO';
        } else if (ext === '.pdf' || ext === '.doc' || ext === '.docx') {
          mediaType = 'DOCUMENT';
        }

        const fileName = path.basename(sf.key);
        mediaMap.set(sf.key, {
          id: sf.key,
          key: sf.key,
          fileName,
          fileUrl: sf.fileUrl,
          fileSize: sf.size,
          mediaType,
          source: 'DIRECT_S3',
          createdAt: sf.lastModified,
        });
      }
    });

    let mediaList = Array.from(mediaMap.values());

    // Apply filters
    if (type !== 'ALL') {
      mediaList = mediaList.filter((m) => m.mediaType === type);
    }
    if (search) {
      mediaList = mediaList.filter(
        (m) =>
          m.fileName?.toLowerCase().includes(search) ||
          m.referenceNumber?.toLowerCase().includes(search) ||
          m.partyName?.toLowerCase().includes(search) ||
          m.key?.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({
      media: mediaList,
      config: {
        region: config.region,
        bucketName: config.bucketName,
        customDomain: config.customDomain,
        isConfigured: config.isConfigured,
      },
    });
  } catch (error: any) {
    console.error('Error fetching media:', error);
    return NextResponse.json({ error: error.message || 'Failed to list media' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = authContext.company.id;
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const folder = (formData.get('folder') as string) || 'uploads';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const timestamp = Date.now();
    const sanitizedFileName = (file.name || 'file.jpg').replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Key = `tenants/${companyId}/${folder}/${timestamp}-${sanitizedFileName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || 'application/octet-stream';

    const result = await uploadToS3Bucket(buffer, s3Key, contentType);

    return NextResponse.json({
      success: true,
      fileUrl: result.fileUrl,
      s3Key: result.s3Key,
      isS3: result.isS3,
      fileName: file.name,
      fileSize: file.size,
      contentType,
    });
  } catch (error: any) {
    console.error('Media upload error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = authContext.company.id;
    const { key } = await req.json();

    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 });
    }

    // Tenancy protection: only allow deletion of own company's files
    if (!key.startsWith(`tenants/${companyId}/`)) {
      return NextResponse.json({ error: 'Forbidden: Cannot delete files from another tenant' }, { status: 403 });
    }

    await deleteFromS3Bucket(key);

    // Also clean up DB references if any
    await prisma.clientOrderAttachment.deleteMany({
      where: { r2Key: key },
    });

    return NextResponse.json({ success: true, message: 'File deleted successfully from Amazon S3' });
  } catch (error: any) {
    console.error('Media delete error:', error);
    return NextResponse.json({ error: error.message || 'Delete failed' }, { status: 500 });
  }
}
