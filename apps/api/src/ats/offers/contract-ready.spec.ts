import {
  ContractApprovalStatus,
  OfferLetterSendMode,
} from '@prisma/client';
import { isContractCompleteForHire } from './contract-ready';

describe('isContractCompleteForHire', () => {
  it('skips the contract when the company has no template', () => {
    expect(
      isContractCompleteForHire(
        { signedContractFileName: null, contractApprovalStatus: null },
        false,
      ),
    ).toBe(true);
  });

  it('requires the filled file when a template exists', () => {
    expect(
      isContractCompleteForHire(
        { signedContractFileName: null, contractApprovalStatus: 'NOT_REQUIRED' },
        true,
      ),
    ).toBe(false);
  });

  it('allows NOT_REQUIRED after the file is uploaded', () => {
    expect(
      isContractCompleteForHire(
        {
          signedContractFileName: 'contrato.docx',
          contractApprovalStatus: ContractApprovalStatus.NOT_REQUIRED,
        },
        true,
      ),
    ).toBe(true);
  });

  it('requires send and candidate signature for digital approval flow', () => {
    expect(
      isContractCompleteForHire(
        {
          signedContractFileName: 'contrato.docx',
          contractApprovalStatus: ContractApprovalStatus.APPROVED,
          contractSentAt: new Date('2026-09-20'),
          contractSendMode: OfferLetterSendMode.DIGITAL_SIGNATURE,
          contractCandidateSignedAt: null,
        },
        true,
      ),
    ).toBe(false);
    expect(
      isContractCompleteForHire(
        {
          signedContractFileName: 'contrato.docx',
          contractApprovalStatus: ContractApprovalStatus.APPROVED,
          contractSentAt: new Date('2026-09-20'),
          contractSendMode: OfferLetterSendMode.ATTACHMENT,
        },
        true,
      ),
    ).toBe(true);
  });
});
