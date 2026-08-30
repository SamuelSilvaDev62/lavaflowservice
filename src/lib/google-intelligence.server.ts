const GOOGLE_BUSINESS_SCOPE = "https://www.googleapis.com/auth/business.manage";
const GOOGLE_OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ACCOUNTS_URL = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts";
const GOOGLE_PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

export type GoogleProviderReadiness = {
  businessProfileOAuthReady: boolean;
  placesReady: boolean;
};

export function getGoogleProviderReadiness(): GoogleProviderReadiness {
  return {
    businessProfileOAuthReady: Boolean(
      process.env["GOOGLE_BUSINESS_CLIENT_ID"] &&
        process.env["GOOGLE_BUSINESS_CLIENT_SECRET"] &&
        process.env["GOOGLE_BUSINESS_REDIRECT_URI"],
    ),
    placesReady: Boolean(process.env["GOOGLE_MAPS_API_KEY"]),
  };
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Configuração Google ausente: ${name}.`);
  return value;
}

/**
 * Builds the merchant consent URL. `state` must be a short-lived, server-generated
 * CSRF token tied to the authenticated LavaFlow tenant/session.
 */
export function buildGoogleBusinessAuthorizationUrl(state: string) {
  if (!state) throw new Error("OAuth state é obrigatório.");

  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_BUSINESS_CLIENT_ID"),
    redirect_uri: requireEnv("GOOGLE_BUSINESS_REDIRECT_URI"),
    response_type: "code",
    scope: GOOGLE_BUSINESS_SCOPE,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });

  return `${GOOGLE_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

export type GoogleTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

/**
 * Exchanges an OAuth code on the server. Never log the code, client secret,
 * access token or refresh token. Persist tokens only in tenant-scoped encrypted
 * server storage.
 */
export async function exchangeGoogleBusinessAuthorizationCode(code: string): Promise<GoogleTokenResponse> {
  if (!code) throw new Error("Código OAuth ausente.");

  const body = new URLSearchParams({
    code,
    client_id: requireEnv("GOOGLE_BUSINESS_CLIENT_ID"),
    client_secret: requireEnv("GOOGLE_BUSINESS_CLIENT_SECRET"),
    redirect_uri: requireEnv("GOOGLE_BUSINESS_REDIRECT_URI"),
    grant_type: "authorization_code",
  });

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(`Falha ao concluir OAuth do Google (${response.status}).`);
  }

  return (await response.json()) as GoogleTokenResponse;
}

/**
 * Minimal verification call for an authorized Business Profile token.
 * A successful response proves that Google accepted the token; it does not by
 * itself prove that every account/location desired by the tenant is accessible.
 */
export async function listGoogleBusinessAccounts(accessToken: string) {
  if (!accessToken) throw new Error("Token OAuth ausente.");

  const response = await fetch(GOOGLE_ACCOUNTS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Google Business Profile indisponível (${response.status}).`);
  }

  return (await response.json()) as { accounts?: Array<Record<string, unknown>> };
}

export type LocalBusinessPlace = {
  id?: string;
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  googleMapsUri?: string;
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string; languageCode?: string };
};

/**
 * Server-side Google Places Text Search for local market intelligence.
 * Uses an explicit field mask to control payload and billing. Returned public
 * place data must still be handled according to Google Maps Platform policies.
 */
export async function searchLocalBusinesses(params: {
  textQuery: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  pageSize?: number;
  languageCode?: string;
}) {
  const textQuery = params.textQuery.trim();
  if (!textQuery) throw new Error("Consulta de mercado local vazia.");

  const requestBody: Record<string, unknown> = {
    textQuery,
    pageSize: Math.min(Math.max(params.pageSize ?? 10, 1), 20),
    languageCode: params.languageCode ?? "pt-BR",
  };

  if (Number.isFinite(params.latitude) && Number.isFinite(params.longitude)) {
    requestBody.locationBias = {
      circle: {
        center: { latitude: params.latitude, longitude: params.longitude },
        radius: Math.min(Math.max(params.radiusMeters ?? 10_000, 100), 50_000),
      },
    };
  }

  const response = await fetch(GOOGLE_PLACES_TEXT_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": requireEnv("GOOGLE_MAPS_API_KEY"),
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.rating",
        "places.userRatingCount",
        "places.websiteUri",
        "places.googleMapsUri",
        "places.primaryType",
        "places.primaryTypeDisplayName",
      ].join(","),
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Google Places indisponível (${response.status}).`);
  }

  const data = (await response.json()) as { places?: LocalBusinessPlace[] };
  return data.places ?? [];
}

export const GOOGLE_BUSINESS_PROFILE_SCOPE = GOOGLE_BUSINESS_SCOPE;
