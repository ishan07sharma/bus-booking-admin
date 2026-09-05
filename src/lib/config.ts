export function collegeEmailDomain(): string {
  return (process.env.COLLEGE_EMAIL_DOMAIN || "").toLowerCase().trim();
}

export function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return adminEmails().has(email.toLowerCase());
}

export function isCollegeEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const domain = collegeEmailDomain();
  if (!domain) return true; // unset = skip check (local/dev)
  return email.toLowerCase().endsWith("@" + domain);
}

export function routeFrom(): string {
  return process.env.ROUTE_FROM || "College";
}

export function routeTo(): string {
  return process.env.ROUTE_TO || "City";
}
