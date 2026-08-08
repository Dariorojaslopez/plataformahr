import { JobOfferStatus } from '@prisma/client';
import { canTransitionOffer, isOfferExpired } from './offer-transitions';

describe('offer-transitions', () => {
  const base = {
    status: JobOfferStatus.SENT as JobOfferStatus,
    expiresAt: null as Date | null,
  };

  it('allows DRAFT -> SENT / WITHDRAWN only', () => {
    expect(canTransitionOffer(JobOfferStatus.DRAFT, JobOfferStatus.SENT)).toBe(
      true,
    );
    expect(
      canTransitionOffer(JobOfferStatus.DRAFT, JobOfferStatus.WITHDRAWN),
    ).toBe(true);
    expect(
      canTransitionOffer(JobOfferStatus.DRAFT, JobOfferStatus.ACCEPTED),
    ).toBe(false);
  });

  it('treats ACCEPTED/REJECTED/EXPIRED/WITHDRAWN as terminal', () => {
    for (const status of [
      JobOfferStatus.ACCEPTED,
      JobOfferStatus.REJECTED,
      JobOfferStatus.EXPIRED,
      JobOfferStatus.WITHDRAWN,
    ]) {
      expect(canTransitionOffer(status, JobOfferStatus.SENT)).toBe(false);
      expect(canTransitionOffer(status, JobOfferStatus.DRAFT)).toBe(false);
    }
  });

  it('detects expired SENT offers by expiresAt', () => {
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);
    expect(isOfferExpired({ ...base, expiresAt: past }, new Date())).toBe(true);
    expect(isOfferExpired({ ...base, expiresAt: future }, new Date())).toBe(
      false,
    );
    expect(
      isOfferExpired(
        { status: JobOfferStatus.DRAFT, expiresAt: past },
        new Date(),
      ),
    ).toBe(false);
    expect(
      isOfferExpired({ status: JobOfferStatus.EXPIRED, expiresAt: null }),
    ).toBe(true);
  });
});
