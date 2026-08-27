import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath: string): string => fs.readFileSync(path.join(root, relativePath), 'utf8');

type AppStoreProfile = {
  schemaVersion: number;
  targetRelease: string;
  officialContactEmail: string;
  privacyPolicyUrl: string;
  supportUrl: string;
  audience: string;
  expectedAppleCalculatedAgeRating: string;
  ageCategoriesAndOverride: string;
  madeForKids: boolean;
  gameCenterEnabled: boolean;
  parentalControls: string;
  ageAssurance: string;
  unrestrictedWebAccess: boolean;
  advertising: boolean;
  inAppPurchases: boolean;
  messagingOrChat: boolean;
  userGeneratedContent: boolean;
  socialMedia: boolean;
  gambling: boolean;
  simulatedGambling: string;
  lootBoxes: boolean;
  contests: string;
  profanityOrCrudeHumor: string;
  horrorOrFearThemes: string;
  matureOrSuggestiveThemes: string;
  medicalOrTreatmentInformation: string;
  alcoholTobaccoOrDrugReferences: string;
  sexualContentOrNudity: string;
  cartoonOrFantasyViolence: string;
  realisticViolence: string;
  gunsOrOtherWeapons: string;
};

const profile = JSON.parse(read('release/stacktosix-app-store-profile.json')) as AppStoreProfile;

describe('App Store audience profile contract', () => {
  test('locks release 1.0 to a child-safe general-audience 4+ submission', () => {
    expect(profile).toMatchObject({
      schemaVersion: 1,
      targetRelease: '1.0 (3)',
      officialContactEmail: 'stacktosix@gmail.com',
      privacyPolicyUrl: 'https://taptapdesign.com/stacktosix-privacy-policy/',
      supportUrl: 'https://taptapdesign.com/stacktosix-privacy-policy/support.html',
      audience: 'general-audience',
      expectedAppleCalculatedAgeRating: '4+',
      ageCategoriesAndOverride: 'not-applicable',
      madeForKids: false,
      gameCenterEnabled: false,
    });
  });

  test('locks every currently absent interactive or monetized content category off', () => {
    expect(profile).toMatchObject({
      parentalControls: 'none',
      ageAssurance: 'none',
      unrestrictedWebAccess: false,
      advertising: false,
      inAppPurchases: false,
      messagingOrChat: false,
      userGeneratedContent: false,
      socialMedia: false,
      gambling: false,
      simulatedGambling: 'none',
      lootBoxes: false,
      contests: 'none',
      profanityOrCrudeHumor: 'none',
      horrorOrFearThemes: 'none',
      matureOrSuggestiveThemes: 'none',
      medicalOrTreatmentInformation: 'none',
      alcoholTobaccoOrDrugReferences: 'none',
      sexualContentOrNudity: 'none',
      cartoonOrFantasyViolence: 'none',
      realisticViolence: 'none',
      gunsOrOtherWeapons: 'none',
    });
  });

  test('keeps the prepared submission instructions aligned with the locked profile', () => {
    const submission = read('docs/engineering/APP_STORE_CONNECT_SUBMISSION_COPY.md');

    expect(submission).toContain('Expected Apple-calculated rating: **4+**');
    expect(submission).toContain('Age Categories and Override: choose **Not Applicable**');
    expect(submission).toContain('Do **not** select **Made for Kids / Kids Category**');
    expect(submission).toContain('Game Center and in-app purchases are not integrated');
    expect(submission).toContain('| Contact email | `stacktosix@gmail.com` |');
    expect(submission).not.toContain('info@igorivankovic.com');
  });

  test('does not market the store listing primarily to children', () => {
    const submission = read('docs/engineering/APP_STORE_CONNECT_SUBMISSION_COPY.md');
    const description = submission.match(/### Description\n\n```text\n([\s\S]*?)\n```/)?.[1];
    const listingFields = [
      submission.match(/\| Name \| `([^`]+)` \|/)?.[1],
      submission.match(/\| Subtitle \| `([^`]+)` \|/)?.[1],
      submission.match(/### Promotional text\n\n```text\n([\s\S]*?)\n```/)?.[1],
      description,
    ].join('\n');

    expect(description).toBeDefined();
    expect(listingFields).not.toMatch(/\b(?:for kids|for children|made for kids)\b/i);
  });
});
