import {
  ContractApprovalStatus,
  OfferLetterSendMode,
} from '@prisma/client';

export type ContractHireFields = {
  signedContractFileName?: string | null;
  contractApprovalStatus?: string | null;
  contractSentAt?: Date | string | null;
  contractSendMode?: string | null;
  contractCandidateSignedAt?: Date | string | null;
};

export function isContractCompleteForHire(
  offer: ContractHireFields,
  hasCompanyTemplate: boolean,
): boolean {
  if (!hasCompanyTemplate) return true;
  if (!offer.signedContractFileName) return false;
  const approval = offer.contractApprovalStatus;
  if (
    approval !== ContractApprovalStatus.APPROVED &&
    approval !== ContractApprovalStatus.NOT_REQUIRED
  ) {
    return false;
  }
  if (approval === ContractApprovalStatus.NOT_REQUIRED) {
    return true;
  }
  if (!offer.contractSentAt) return false;
  if (offer.contractSendMode === OfferLetterSendMode.DIGITAL_SIGNATURE) {
    return Boolean(offer.contractCandidateSignedAt);
  }
  return true;
}
