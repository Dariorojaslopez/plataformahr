import {
  JobOfferStatus,
  type JobOffer,
  type JobOfferStatus as JobOfferStatusType,
} from '@prisma/client';

export const OFFER_ALLOWED_TRANSITIONS: Record<
  JobOfferStatus,
  JobOfferStatus[]
> = {
  [JobOfferStatus.DRAFT]: [JobOfferStatus.SENT, JobOfferStatus.WITHDRAWN],
  [JobOfferStatus.SENT]: [
    JobOfferStatus.ACCEPTED,
    JobOfferStatus.REJECTED,
    JobOfferStatus.EXPIRED,
    JobOfferStatus.WITHDRAWN,
  ],
  [JobOfferStatus.ACCEPTED]: [],
  [JobOfferStatus.REJECTED]: [],
  [JobOfferStatus.EXPIRED]: [],
  [JobOfferStatus.WITHDRAWN]: [],
};

export const OFFER_TERMINAL_STATUSES = new Set<JobOfferStatus>([
  JobOfferStatus.ACCEPTED,
  JobOfferStatus.REJECTED,
  JobOfferStatus.EXPIRED,
  JobOfferStatus.WITHDRAWN,
]);

/** True when a SENT offer's expiresAt is in the past (exclusive of equality at now). */
export function isOfferExpired(
  offer: Pick<JobOffer, 'status' | 'expiresAt'>,
  now: Date = new Date(),
): boolean {
  if (offer.status === JobOfferStatus.EXPIRED) return true;
  if (offer.status !== JobOfferStatus.SENT) return false;
  if (!offer.expiresAt) return false;
  return offer.expiresAt.getTime() <= now.getTime();
}

export function canTransitionOffer(
  from: JobOfferStatusType,
  to: JobOfferStatusType,
): boolean {
  return OFFER_ALLOWED_TRANSITIONS[from].includes(to);
}
