// Build-time configuration sourced from Vite env vars.
//
// VITE_* values are inlined into the client bundle at build time, so they
// are PUBLIC — never put a secret here. A Google OAuth **Client ID** is
// not a secret: it is visible in the OAuth request itself, and access is
// gated by the "Authorized JavaScript origins" list in Google Cloud
// Console, not by hiding the ID. (A client *secret* would be a different
// story — this app's GIS token flow never uses one.)
//
// Set VITE_GOOGLE_CLIENT_ID in Vercel (Project → Settings → Environment
// Variables) so every device gets cloud sync configured out of the box,
// with no copy-paste after clearing site data or moving to a new machine.

export const ENV_GOOGLE_CLIENT_ID =
  (import.meta.env?.VITE_GOOGLE_CLIENT_ID || "").trim();

// Effective Client ID: a per-device override typed into Settings wins,
// otherwise fall back to the deployment default from the environment.
// Keeping the override lets local dev / self-hosted forks point at their
// own Google project without a rebuild.
export const resolveGoogleClientId = (settings, envId = ENV_GOOGLE_CLIENT_ID) =>
  (settings?.googleClientId || "").trim() || envId;

// True when cloud sync is usable without the user configuring anything.
export const hasEnvGoogleClientId = () => !!ENV_GOOGLE_CLIENT_ID;
