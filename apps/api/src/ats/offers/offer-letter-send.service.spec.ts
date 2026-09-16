import { OfferLetterSendMode } from '@prisma/client';
import type { SendMailInput, SendMailResult } from '../../mail/mail.types';
import { OfferLetterSendService } from './offer-letter-send.service';

jest.mock('./offer-letter.storage', () => ({
  resolveCompanyUploadsDir: () => '/tmp/uploads',
  readOfferSignedFile: jest
    .fn()
    .mockResolvedValue(Buffer.from('Hola [Nombre], cargo [Cargo]', 'utf8')),
}));

type OfferLetterUpdateArg = {
  data?: {
    offerLetterSendMode?: OfferLetterSendMode;
    offerLetterSignToken?: string | null;
  };
};

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
    signedOfferLetterFileName:
      'offer-signed-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.docx',
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
    const updateOffer: jest.MockedFunction<
      (arg: OfferLetterUpdateArg) => Promise<unknown>
    > = jest.fn().mockResolvedValue({});
    const prisma = {
      jobOffer: {
        findFirst: jest.fn().mockResolvedValue(offer),
        update: updateOffer,
      },
      companyFeature: {
        findFirst: jest
          .fn()
          .mockResolvedValue(
            options?.digitalSignature ? { id: 'feat-1' } : null,
          ),
      },
    };
    const sendText: jest.MockedFunction<
      (input: SendMailInput) => Promise<SendMailResult>
    > = jest.fn().mockResolvedValue({ status: 'SENT' });
    const audit = { create: jest.fn().mockResolvedValue({}) };
    const service = new OfferLetterSendService(
      prisma as never,
      audit as never,
      { sendText } as never,
    );
    return { service, updateOffer, sendText };
  }

  it('sends the customized email with the filled letter attached when digital signature is off', async () => {
    const { service, sendText, updateOffer } = build();
    const result = await service.sendApprovedLetter({
      companyId: 'company-1',
      userId: 'user-1',
      offerId: 'offer-1',
      signerName: 'Clara Pasos',
    });
    expect(result.sendMode).toBe(OfferLetterSendMode.ATTACHMENT);
    const payload = sendText.mock.calls[0]?.[0];
    expect(payload?.to).toBe('pedro@example.com');
    expect(payload?.subject).toBe('Oferta para Pedro Julian');
    expect(payload?.html).toContain('Hola Pedro Julian, cargo Reclutador');
    expect(payload?.attachments?.[0]?.filename).toBe('carta-Pedro Julian.docx');
    const updateArg = updateOffer.mock.calls[0]?.[0];
    expect(updateArg?.data?.offerLetterSendMode).toBe(
      OfferLetterSendMode.ATTACHMENT,
    );
    expect(updateArg?.data?.offerLetterSignToken).toBeNull();
  });

  it('appends a public sign URL and does not attach the file when digital signature is on', async () => {
    const { service, sendText } = build({ digitalSignature: true });
    const result = await service.sendApprovedLetter({
      companyId: 'company-1',
      userId: 'user-1',
      offerId: 'offer-1',
    });
    expect(result.sendMode).toBe(OfferLetterSendMode.DIGITAL_SIGNATURE);
    expect(result.signUrl).toMatch(/\/sign\/offer-letter\/[a-f0-9]+$/);
    const payload = sendText.mock.calls[0]?.[0];
    expect(payload?.html).toContain(result.signUrl);
    expect(payload?.attachments).toBeUndefined();
  });
});
