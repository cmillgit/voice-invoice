import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendInvoiceEmail(
  to: string,
  clientName: string,
  invoiceNumber: string,
  pdfBuffer: Buffer
): Promise<void> {
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'invoices@millerpainting.com',
    to,
    subject: `Invoice ${invoiceNumber} from Miller Painting`,
    html: `
      <p>Hi ${clientName},</p>
      <p>Please find your invoice <strong>${invoiceNumber}</strong> attached.</p>
      <p>Thank you for your business.</p>
      <p>— Miller Painting</p>
    `,
    attachments: [
      {
        filename: `${invoiceNumber}.pdf`,
        content: pdfBuffer,
      },
    ],
  })

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`)
  }
}
