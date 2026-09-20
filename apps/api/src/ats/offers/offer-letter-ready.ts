import {
  JobOfferStatus,
  OfferLetterApprovalStatus,
  OfferLetterSendMode,
} from '@prisma/client';

type OfferLetterHireFields = {
  signedOfferLetterFileName?: string | null;
  offerLetterApprovalStatus?: string | null;
  offerLetterSentAt?: Date | string | null;
  offerLetterSendMode?: string | null;
  offerLetterCandidateSignedAt?: Date | string | null;
};

export function isOfferReadyToHire(
  offer: OfferLetterHireFields & { status: string },
): boolean {
  if (offer.status === JobOfferStatus.ACCEPTED) return true;
  return isOfferLetterCompleteForHire(offer);
}

export function isOfferLetterCompleteForHire(
  offer: OfferLetterHireFields,
): boolean {
  if (!offer.signedOfferLetterFileName) return false;
  const approval = offer.offerLetterApprovalStatus;
  if (
    approval !== OfferLetterApprovalStatus.APPROVED &&
    approval !== OfferLetterApprovalStatus.NOT_REQUIRED
  ) {
    return false;
  }
  if (approval === OfferLetterApprovalStatus.NOT_REQUIRED) {
    return true;
  }
  if (offer.offerLetterSendMode === OfferLetterSendMode.DIGITAL_SIGNATURE) {
    return Boolean(
      offer.offerLetterSentAt && offer.offerLetterCandidateSignedAt,
    );
  }
  return true;
}
