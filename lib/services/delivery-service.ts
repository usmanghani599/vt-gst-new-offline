import prisma from '@/lib/db';
import { DeliveryChannel, DeliveryStatus } from '@prisma/client';

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  documentId?: string;
  pdfBuffer?: Buffer;
  pdfFileName?: string;
}

export interface WhatsAppMessage {
  toPhone: string;
  templateName: string;
  documentId?: string;
  documentNumber?: string;
  documentTotal?: string;
  pdfUrl?: string;
}

export interface EmailProvider {
  sendEmail(msg: EmailMessage): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

export interface WhatsAppProvider {
  sendMessage(msg: WhatsAppMessage): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

export class MockEmailProvider implements EmailProvider {
  async sendEmail(msg: EmailMessage) {
    console.log(`[EmailProvider] Sending to ${msg.to}: ${msg.subject}`);
    return { success: true, messageId: `msg_${Date.now()}` };
  }
}

export class MockWhatsAppProvider implements WhatsAppProvider {
  async sendMessage(msg: WhatsAppMessage) {
    console.log(`[WhatsAppProvider] Sending to ${msg.toPhone}: Template ${msg.templateName}`);
    return { success: true, messageId: `wa_${Date.now()}` };
  }
}

export class DeliveryService {
  private static emailProvider: EmailProvider = new MockEmailProvider();
  private static whatsappProvider: WhatsAppProvider = new MockWhatsAppProvider();

  public static async sendDocumentEmail(msg: EmailMessage) {
    const result = await this.emailProvider.sendEmail(msg);

    if (msg.documentId) {
      await prisma.documentDelivery.create({
        data: {
          documentId: msg.documentId,
          channel: DeliveryChannel.EMAIL,
          recipient: msg.to,
          status: result.success ? DeliveryStatus.SENT : DeliveryStatus.FAILED,
          errorMessage: result.error,
        },
      });
    }

    return result;
  }

  public static async sendDocumentWhatsApp(msg: WhatsAppMessage) {
    const result = await this.whatsappProvider.sendMessage(msg);

    if (msg.documentId) {
      await prisma.documentDelivery.create({
        data: {
          documentId: msg.documentId,
          channel: DeliveryChannel.WHATSAPP,
          recipient: msg.toPhone,
          status: result.success ? DeliveryStatus.SENT : DeliveryStatus.FAILED,
          errorMessage: result.error,
        },
      });
    }

    return result;
  }
}
