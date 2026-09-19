import {
  JobOfferStatus,
  OfferLetterApprovalStatus,
  OfferLetterSendMode,
} from '@prisma/client';
import { isOfferReadyToHire } from './offer-letter-ready';

describe('isOfferReadyToHire', () => {
  it('allows an accepted job offer', () => {
    expect(
      isOfferReadyToHire({
        status: JobOfferStatus.ACCEPTED,
        signedOfferLetterFileName: null,
      }),
    ).toBe(true);
  });

  it('allows a draft offer after the letter was approved and emailed', () => {
    expect(
      isOfferReadyToHire({
        status: JobOfferStatus.DRAFT,
        signedOfferLetterFileName: 'carta.docx',
        offerLetterApprovalStatus: OfferLetterApprovalStatus.APPROVED,
        offerLetterSentAt: new Date('2026-09-18'),
        offerLetterSendMode: OfferLetterSendMode.ATTACHMENT,
      }),
    ).toBe(true);
  });

  it('requires the candidate signature when digital signature was used', () => {
    expect(
      isOfferReadyToHire({
        status: JobOfferStatus.SENT,
        signedOfferLetterFileName: 'carta.docx',
        offerLetterApprovalStatus: OfferLetterApprovalStatus.APPROVED,
        offerLetterSentAt: new Date('2026-09-18'),
        offerLetterSendMode: OfferLetterSendMode.DIGITAL_SIGNATURE,
        offerLetterCandidateSignedAt: null,
      }),
    ).toBe(false);
    expect(
      isOfferReadyToHire({
        status: JobOfferStatus.SENT,
        signedOfferLetterFileName: 'carta.docx',
        offerLetterApprovalStatus: OfferLetterApprovalStatus.APPROVED,
        offerLetterSentAt: new Date('2026-09-18'),
        offerLetterSendMode: OfferLetterSendMode.DIGITAL_SIGNATURE,
        offerLetterCandidateSignedAt: new Date('2026-09-18'),
      }),
    ).toBe(true);
  });
});
