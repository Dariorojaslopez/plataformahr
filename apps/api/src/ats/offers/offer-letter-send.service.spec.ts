import { OfferLetterSendMode } from '@prisma/client';
import { OfferLetterSendService } from './offer-letter-send.service';

jest.mock('./offer-letter.storage', () => ({
  resolveCompanyUploadsDir: () => '/tmp/uploads',
  readOfferSignedFile: jest.fn().mockResolvedValue(
    Buffer.from('Hola [Nombre], cargo [Cargo]', 'utf8'),
  ),
}));

describe('OfferLetterSendService', () => {
  const offer = {
    id: 'offer-1',
    positionTitle: 'Reclutador',
    salaryAmount: { toString: () => '3000000' },
    salaryCurrency: 'COP',
    salaryPeriod: 'MONTHLY',
    employmentType: 'FULL_TIME',
    startDate: null,
    notes: null,
    signedOfferLetterFileName: 'offer-signed-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.docx',
    signedOfferLetterMimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    signedOfferLetterOriginalName: 'carta-[Nombre].docx',
    application: {
      candidate: {
        firstName: 'Pedro',
        lastName: 'Julian',
        email: 'pedro@example.com',
        city: 'Bogotá',
      },
    },
    company: {
      name: 'Acme',
      atsOfferLetterEmailSubject: 'Oferta para [Nombre]',
      atsOfferLetterEmailBody: '<p>Hola [Nombre], cargo [Cargo]</p>',
    },
  };

  function build(options?: { digitalSignature?: boolean }) {
    const prisma = {
      jobOffer: {
        findFirst: jest.fn().mockResolvedValue(offer),
        update: jest.fn().mockResolvedValue({}),
      },
      companyFeature: {
        findFirst: jest
          .fn()
          .mockResolvedValue(options?.digitalSignature ? { id: 'feat-1' } : null),
      },
    };
    const mail = {
      sendText: jest.fn().mockResolvedValue({ status: 'SENT' }),
    };
    const audit = { create: jest.fn().mockResolvedValue({}) };
    const service = new OfferLetterSendService(
      prisma as never,
      audit as never,
      mail as never,
    );
    return { service, prisma, mail };
  }

  it('sends the customized email with the filled letter attached when digital signature is off', async () => {
    const { service, mail, prisma } = build();
    const result = await service.sendApprovedLetter({
      companyId: 'company-1',
      userId: 'user-1',
      offerId: 'offer-1',
      signerName: 'Clara Pasos',
    });
    expect(result.sendMode).toBe(OfferLetterSendMode.ATTACHMENT);
    expect(mail.sendText).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'pedro@example.com',
        subject: 'Oferta para Pedro Julian',
        html: expect.stringContaining('Hola Pedro Julian, cargo Reclutador'),
        attachments: [
          expect.objectContaining({
            filename: 'carta-Pedro Julian.docx',
          }),
        ],
      }),
    );
    expect(prisma.jobOffer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          offerLetterSendMode: OfferLetterSendMode.ATTACHMENT,
          offerLetterSignToken: null,
        }),
      }),
    );
  });

  it('appends a public sign URL and does not attach the file when digital signature is on', async () => {
    const { service, mail } = build({ digitalSignature: true });
    const result = await service.sendApprovedLetter({
      companyId: 'company-1',
      userId: 'user-1',
      offerId: 'offer-1',
    });
    expect(result.sendMode).toBe(OfferLetterSendMode.DIGITAL_SIGNATURE);
    expect(result.signUrl).toMatch(/\/sign\/offer-letter\/[a-f0-9]+$/);
    const payload = mail.sendText.mock.calls[0][0] as {
      html: string;
      attachments?: unknown;
    };
    expect(payload.html).toContain(result.signUrl);
    expect(payload.attachments).toBeUndefined();
  });
});
