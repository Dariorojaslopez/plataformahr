import {
  JobOfferStatus,
  OfferLetterApprovalStatus,
  OfferLetterSendMode,
} from '@prisma/client';

export function isOfferReadyToHire(offer: {
  status: JobOfferStatus;
  signedOfferLetterFileName?: string | null;
  offerLetterApprovalStatus?: OfferLetterApprovalStatus | string | null;
  offerLetterSentAt?: Date | string | null;
  offerLetterSendMode?: OfferLetterSendMode | string | null;
  offerLetterCandidateSignedAt?: Date | string | null;
}): boolean {
  if (offer.status === JobOfferStatus.ACCEPTED) return true;
  return isOfferLetterCompleteForHire(offer);
}

export function isOfferLetterCompleteForHire(offer: {
  signedOfferLetterFileName?: string | null;
  offerLetterApprovalStatus?: OfferLetterApprovalStatus | string | null;
  offerLetterSentAt?: Date | string | null;
  offerLetterSendMode?: OfferLetterSendMode | string | null;
  offerLetterCandidateSignedAt?: Date | string | null;
}): boolean {
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
  if (!offer.offerLetterSentAt) return false;
  if (offer.offerLetterSendMode === OfferLetterSendMode.DIGITAL_SIGNATURE) {
    return Boolean(offer.offerLetterCandidateSignedAt);
  }
  return true;
}
