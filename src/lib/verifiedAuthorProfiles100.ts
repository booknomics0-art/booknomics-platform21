import {
  verifiedAuthorProfiles100Batch20261023,
  type VerifiedAuthorProfile100,
} from "@/data/verifiedAuthorProfiles100Batch20261023";

// Match only a documented name from the book catalogue. Do not guess at pen names,
// pseudonyms or similarly named authors when a precise match is unavailable.
const normalizeName = (name: string): string =>
  name.normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("und");

const profilesByName = new Map<string, VerifiedAuthorProfile100>(
  verifiedAuthorProfiles100Batch20261023.map((profile) => [
    normalizeName(profile.author),
    profile,
  ]),
);

export const findVerifiedAuthorProfile100 = (
  author: string,
): VerifiedAuthorProfile100 | undefined =>
  profilesByName.get(normalizeName(author));

export { verifiedAuthorProfiles100Batch20261023 };
