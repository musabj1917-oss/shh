export function parseSemver(v: string): { major: number; minor: number; patch: number; prerelease: string } {
  const cleaned = v.trim().replace(/^v/, '');
  const [core, prerelease = ''] = cleaned.split('-');
  const parts = core.split('.').map((p) => Number.parseInt(p, 10) || 0);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
    prerelease,
  };
}

export function compareSemver(v1: string, v2: string): number {
  const p1 = parseSemver(v1);
  const p2 = parseSemver(v2);

  if (p1.major !== p2.major) return p1.major - p2.major;
  if (p1.minor !== p2.minor) return p1.minor - p2.minor;
  if (p1.patch !== p2.patch) return p1.patch - p2.patch;

  if (!p1.prerelease && p2.prerelease) return 1;
  if (p1.prerelease && !p2.prerelease) return -1;
  if (p1.prerelease && p2.prerelease) return p1.prerelease.localeCompare(p2.prerelease);

  return 0;
}
