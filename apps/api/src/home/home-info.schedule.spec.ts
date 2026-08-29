import {
  assertValidHomeInfoSchedule,
  hasPublicCompanyHomeInfoContent,
  isCompanyHomeInfoLive,
} from './home-info.schedule';

describe('home info schedule', () => {
  const publishedAt = new Date('2026-08-01T12:00:00.000Z');

  it('is live between publication and unpublication', () => {
    expect(
      isCompanyHomeInfoLive(
        { publishedAt, unpublishedAt: new Date('2026-08-10T12:00:00.000Z') },
        new Date('2026-08-05T12:00:00.000Z'),
      ),
    ).toBe(true);
  });

  it('is not live before publication', () => {
    expect(
      isCompanyHomeInfoLive(
        { publishedAt, unpublishedAt: null },
        new Date('2026-07-31T12:00:00.000Z'),
      ),
    ).toBe(false);
  });

  it('is not live at or after unpublication', () => {
    expect(
      isCompanyHomeInfoLive(
        { publishedAt, unpublishedAt: new Date('2026-08-10T12:00:00.000Z') },
        new Date('2026-08-10T12:00:00.000Z'),
      ),
    ).toBe(false);
  });

  it('requires a title and a media file for public content', () => {
    expect(
      hasPublicCompanyHomeInfoContent({
        title: 'Hola',
        fileName: 'info-x.png',
      }),
    ).toBe(true);
    expect(
      hasPublicCompanyHomeInfoContent({ title: '  ', fileName: 'info-x.png' }),
    ).toBe(false);
    expect(
      hasPublicCompanyHomeInfoContent({ title: 'Hola', fileName: null }),
    ).toBe(false);
  });

  it('rejects unpublication on or before publication', () => {
    expect(() => assertValidHomeInfoSchedule(publishedAt, publishedAt)).toThrow(
      'UNPUBLISH_BEFORE_PUBLISH',
    );
    expect(() =>
      assertValidHomeInfoSchedule(
        publishedAt,
        new Date('2026-07-01T00:00:00.000Z'),
      ),
    ).toThrow('UNPUBLISH_BEFORE_PUBLISH');
  });
});
