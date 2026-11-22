/**
 * Google service-account auth (OAuth 2.0 JWT bearer flow) and discovery of the
 * GA4 properties / Search Console sites the account can read, so the settings
 * page can offer them instead of asking for IDs by hand.
 */
import { type AdminEnv, HttpError } from "./env";
import { getConfig, getSecret, requireKv, saveConfig } from "./settings";

const SCOPES = [
	"https://www.googleapis.com/auth/analytics.readonly",
	"https://www.googleapis.com/auth/webmasters.readonly",
];

function b64url(input: string | Uint8Array): string {
	const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
	let s = "";
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToDer(pem: string): ArrayBuffer {
	const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
	const bin = atob(body);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out.buffer;
}

export async function signServiceAccountJwt(
	sa: { client_email: string; private_key: string },
	scopes: string[],
	now = Math.floor(Date.now() / 1000),
): Promise<string> {
	const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
	const claims = b64url(
		JSON.stringify({
			aud: "https://oauth2.googleapis.com/token",
			exp: now + 3600,
			iat: now,
			iss: sa.client_email,
			scope: scopes.join(" "),
		}),
	);
	const key = await crypto.subtle.importKey(
		"pkcs8",
		pemToDer(sa.private_key),
		{ hash: "SHA-256", name: "RSASSA-PKCS1-v1_5" },
		false,
		["sign"],
	);
	const sig = new Uint8Array(
		await crypto.subtle.sign(
			"RSASSA-PKCS1-v1_5",
			key,
			new TextEncoder().encode(`${header}.${claims}`),
		),
	);
	return `${header}.${claims}.${b64url(sig)}`;
}

/** access token for the stored service account, cached in KV until shortly before expiry */
export async function googleToken(env: AdminEnv, fetcher: typeof fetch = fetch): Promise<string> {
	const kv = requireKv(env);
	const cached = await kv.get("cms:google:token");
	if (cached) return cached;
	const raw = await getSecret(env, "googleServiceAccount");
	if (!raw) throw new HttpError(412, "google_not_configured", "Chưa nhập Google service account");
	const sa = JSON.parse(raw) as { client_email: string; private_key: string };
	const assertion = await signServiceAccountJwt(sa, SCOPES);
	const res = await fetcher("https://oauth2.googleapis.com/token", {
		body: new URLSearchParams({
			assertion,
			grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
		}),
		method: "POST",
	});
	const body = (await res.json()) as {
		access_token?: string;
		expires_in?: number;
		error_description?: string;
	};
	if (!res.ok || !body.access_token) {
		throw new HttpError(
			502,
			"google_auth_failed",
			`Google từ chối service account: ${body.error_description ?? res.status}`,
		);
	}
	await kv.put("cms:google:token", body.access_token, {
		expirationTtl: Math.max(60, (body.expires_in ?? 3600) - 300),
	});
	return body.access_token;
}

const API_NAMES: Record<string, string> = {
	"analyticsadmin.googleapis.com": "Google Analytics Admin API",
	"analyticsdata.googleapis.com": "Google Analytics Data API",
	"searchconsole.googleapis.com": "Google Search Console API",
	"www.googleapis.com": "Google Search Console API",
};
const API_IDS: Record<string, string> = {
	"www.googleapis.com": "searchconsole.googleapis.com",
};

/**
 * Turns a Google error into something actionable: "API not enabled" and
 * "no permission" are the two setup mistakes, and Google's raw text for them
 * is easy to misread.
 */
export function explainGoogleError(url: string, status: number, message: string): string {
	const host = new URL(url).host;
	const api = API_IDS[host] ?? host;
	if (
		/has not been used in project|is disabled|SERVICE_DISABLED|accessNotConfigured/i.test(message)
	) {
		const project = message.match(/project (\d+)/)?.[1];
		return `Chưa bật ${API_NAMES[host] ?? api} trong Google Cloud. Bật tại https://console.cloud.google.com/apis/library/${api}${project ? `?project=${project}` : ""} rồi đợi 2–5 phút.`;
	}
	if (status === 403 && /permission/i.test(message)) {
		return host.startsWith("analytics")
			? "Service account chưa có quyền với GA4 property này. GA4 → Admin → Property access management → thêm email service account, vai trò Viewer."
			: "Service account chưa có quyền với site Search Console này. Search Console → Settings → Users and permissions → Add user → email service account, quyền Restricted.";
	}
	return `Google ${status}: ${message}`;
}

export async function gget<T>(
	token: string,
	url: string,
	fetcher: typeof fetch,
	body?: unknown,
): Promise<T> {
	const res = await fetcher(url, {
		...(body === undefined ? {} : { body: JSON.stringify(body), method: "POST" }),
		headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
	});
	if (!res.ok) {
		const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
		throw new HttpError(
			res.status === 403 ? 403 : 502,
			res.status === 403 ? "google_forbidden" : "google_api_error",
			explainGoogleError(url, res.status, err.error?.message ?? res.statusText).slice(0, 400),
		);
	}
	return (await res.json()) as T;
}

/** picks the Search Console property that covers the blog: exact URL-prefix or domain first */
export function pickGscSite(sites: string[], host = "blog.datnt.work"): string | undefined {
	const apex = host.split(".").slice(-2).join(".");
	const order = [`https://${host}/`, `sc-domain:${host}`, `sc-domain:${apex}`, `http://${host}/`];
	return order.find((o) => sites.includes(o)) ?? sites.find((s) => s.includes(apex));
}

export interface GoogleCheck {
	name: "ga4" | "gsc";
	ok: boolean;
	target: string;
	detail: string;
}

export interface GoogleDiscovery {
	serviceAccount: string;
	ga4: { property: string; name: string; account: string }[];
	searchConsole: { siteUrl: string; permission: string }[];
	errors: string[];
	/** property and site in use after discovery (fixed up when the saved one is not reachable) */
	selected: { ga4PropertyId: string; gscSiteUrl: string };
	/** one live request per source with the selected ids, so setup problems show up here */
	checks: GoogleCheck[];
}

/** lists what the service account can see, so the user just picks from a list */
export async function discoverGoogle(
	env: AdminEnv,
	fetcher: typeof fetch = fetch,
): Promise<GoogleDiscovery> {
	const raw = await getSecret(env, "googleServiceAccount");
	if (!raw) throw new HttpError(412, "google_not_configured", "Chưa nhập Google service account");
	const { client_email } = JSON.parse(raw) as { client_email: string };
	const token = await googleToken(env, fetcher);
	const out: GoogleDiscovery = {
		checks: [],
		errors: [],
		ga4: [],
		searchConsole: [],
		selected: { ga4PropertyId: "", gscSiteUrl: "" },
		serviceAccount: client_email,
	};

	const [ga, gsc] = await Promise.allSettled([
		gget<{
			accountSummaries?: {
				displayName: string;
				propertySummaries?: { property: string; displayName: string }[];
			}[];
		}>(
			token,
			"https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200",
			fetcher,
		),
		gget<{ siteEntry?: { siteUrl: string; permissionLevel: string }[] }>(
			token,
			"https://www.googleapis.com/webmasters/v3/sites",
			fetcher,
		),
	]);
	if (ga.status === "fulfilled") {
		for (const acc of ga.value.accountSummaries ?? []) {
			for (const p of acc.propertySummaries ?? []) {
				out.ga4.push({
					account: acc.displayName,
					name: p.displayName,
					property: p.property.replace("properties/", ""),
				});
			}
		}
	} else out.errors.push(`GA4: ${(ga.reason as Error).message}`);
	if (gsc.status === "fulfilled") {
		out.searchConsole = (gsc.value.siteEntry ?? []).map((s) => ({
			permission: s.permissionLevel,
			siteUrl: s.siteUrl,
		}));
	} else out.errors.push(`Search Console: ${(gsc.reason as Error).message}`);

	// keep the saved choice only if Google lists it; otherwise switch to one that works
	const { google } = await getConfig(env);
	const gaIds = out.ga4.map((p) => p.property);
	const sites = out.searchConsole.map((s) => s.siteUrl);
	const ga4PropertyId =
		ga.status === "fulfilled" && out.ga4.length && !gaIds.includes(google.ga4PropertyId)
			? (gaIds[0] ?? "")
			: google.ga4PropertyId;
	const gscSiteUrl =
		gsc.status === "fulfilled" && sites.length && !sites.includes(google.gscSiteUrl)
			? (pickGscSite(sites) ?? sites[0] ?? "")
			: google.gscSiteUrl;
	if (ga4PropertyId !== google.ga4PropertyId || gscSiteUrl !== google.gscSiteUrl) {
		await saveConfig(env, { google: { ga4PropertyId, gscSiteUrl } });
		// cached reports belong to the old ids
	}
	out.selected = { ga4PropertyId, gscSiteUrl };

	const [gaCheck, gscCheck] = await Promise.allSettled([
		ga4PropertyId
			? gget<{ rows?: { metricValues?: { value: string }[] }[] }>(
					token,
					`https://analyticsdata.googleapis.com/v1beta/properties/${ga4PropertyId}:runReport`,
					fetcher,
					{
						dateRanges: [{ endDate: "today", startDate: "7daysAgo" }],
						metrics: [{ name: "activeUsers" }],
					},
				)
			: Promise.reject(new Error("Chưa có GA4 property nào để chọn")),
		gscSiteUrl
			? gget<{ rows?: { clicks: number; impressions: number }[] }>(
					token,
					`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscSiteUrl)}/searchAnalytics/query`,
					fetcher,
					{
						endDate: new Date().toISOString().slice(0, 10),
						rowLimit: 1,
						startDate: new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10),
					},
				)
			: Promise.reject(new Error("Chưa có site Search Console nào để chọn")),
	]);
	out.checks.push(
		gaCheck.status === "fulfilled"
			? {
					detail: `${gaCheck.value.rows?.[0]?.metricValues?.[0]?.value ?? 0} người dùng trong 7 ngày`,
					name: "ga4",
					ok: true,
					target: ga4PropertyId,
				}
			: {
					detail: (gaCheck.reason as Error).message,
					name: "ga4",
					ok: false,
					target: ga4PropertyId,
				},
		gscCheck.status === "fulfilled"
			? {
					detail: gscCheck.value.rows?.length
						? `${gscCheck.value.rows[0]?.impressions ?? 0} lượt hiển thị trong 30 ngày`
						: "Kết nối được, chưa có dữ liệu tìm kiếm (site mới cần vài ngày)",
					name: "gsc",
					ok: true,
					target: gscSiteUrl,
				}
			: { detail: (gscCheck.reason as Error).message, name: "gsc", ok: false, target: gscSiteUrl },
	);
	return out;
}
