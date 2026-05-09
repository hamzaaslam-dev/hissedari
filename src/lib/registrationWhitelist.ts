/**
 * Wallets allowed to register/tokenize new properties.
 *
 * Override at deploy time by setting NEXT_PUBLIC_REGISTRATION_WHITELIST
 * to a comma-separated list of base58 wallet addresses.
 */
const DEFAULT_REGISTRATION_WHITELIST = [
  "2DyPEBfRtipfap7jzATXxsCLm6oLq3r6kXVLyyVjmxLB",
];

function parseWhitelistEnv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const REGISTRATION_WHITELIST: string[] = (() => {
  const fromEnv = parseWhitelistEnv(process.env.NEXT_PUBLIC_REGISTRATION_WHITELIST);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_REGISTRATION_WHITELIST;
})();

export function isRegistrationWhitelisted(address: string | null | undefined): boolean {
  if (!address) return false;
  return REGISTRATION_WHITELIST.includes(address);
}
