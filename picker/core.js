"use strict";

const TENANT = "72f988bf-86f1-41af-91ab-2d7cd011db47";
const ORIGIN = "http://localhost:8001";
const REDIRECT = `${ORIGIN}/redirect.html`;
const SCOPE = "Calendars.ReadBasic";
const FIELDS = "id,name,owner,canShare";
const ENDPOINT = "https://graph.microsoft.com/v1.0/me/calendars";
const FIRST_PAGE = `${ENDPOINT}?$select=${FIELDS}&$top=50`;
const LIMITS = Object.freeze({ pages:10, calendars:500, bytes:131072, duration:20000, freshness:300000 });
const uuid = value => typeof value === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value) && !/^0{8}-/.test(value);
const bounded = (value, max) => typeof value === "string" && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value);
class PickerError extends Error {
  constructor(kind) { super(kind); this.kind = kind; }
}
const messages = Object.freeze({
  unconfigured:"Not configured. An approved public client ID and the exact local redirect are required. Sign-in is disabled.",
  idle:"Not signed in. No Microsoft data has been requested.",
  signing:"Waiting for Microsoft sign-in. You can disconnect to cancel this attempt.",
  identity:"Signed in. Check the account below before requesting its calendar list.",
  loading:"Loading calendar names from Microsoft Graph. No events are requested.",
  picker:"Calendar list received. Nothing is selected by default. No events imported.",
  empty:"No eligible own calendars returned. This does not mean your schedule is free.",
  summary:"Selection summary only. No event import, saved connection, or sharing has been enabled.",
  disconnected:"Disconnected locally. Account, calendar list and selection cleared. Microsoft sign-in and provider consent may still exist.",
  denied:"Sign-in or consent was denied or cancelled. Nothing is retained. Sign in again only if you choose.",
  admin:"Microsoft requires consent or administrator approval. No workaround is attempted. Contact your tenant administrator.",
  popup:"The sign-in popup was blocked or did not complete. Allow popups for this local site and try again.",
  unsupported:"This account is not supported by the initial single-tenant picker. Personal, guest and other-tenant accounts are not enabled here.",
  mismatch:"Account identity changed or did not match the selected identity. All local access and choices were removed. Sign in again.",
  revoked:"Microsoft rejected authorization (401). Local data was cleared. Sign in again if access is still permitted.",
  forbidden:"Microsoft denied calendar access (403). Consent, tenant policy or mailbox access may require administrator review.",
  throttled:"Microsoft limited this request (429). No automatic retry. Try signing in again later.",
  unavailable:"Microsoft or the network is unavailable. No calendar context retained. Try again later.",
  partial:"The calendar list was incomplete, exceeded safety limits, or had unsafe/invalid pagination. Nothing retained. No availability can be inferred.",
  stale:"The list or sign-in expired. Choices cleared. Sign in again for a new user-requested list; no background refresh occurs.",
  selection:"Select at least one listed calendar and confirm that these represent your own schedule.",
  cleanup:"Local cleanup could not be verified. Reload or close this tab before signing in again. No calendar access is available."
});

function validateConfig(config, origin) {
  if (!config || Object.keys(config).some(key => !["clientId", "tenantId", "redirectUri"].includes(key)) ||
      !uuid(config.clientId) || config.tenantId !== TENANT || config.redirectUri !== REDIRECT || origin !== ORIGIN) {
    throw new PickerError("unconfigured");
  }
  return Object.freeze({ clientId:config.clientId, tenantId:TENANT, redirectUri:REDIRECT });
}
function msalConfiguration(config) {
  return { auth:{ clientId:config.clientId, authority:`https://login.microsoftonline.com/${TENANT}`,
    redirectUri:config.redirectUri, verifySSO:false },
  cache:{ cacheLocation:"memoryStorage", cacheRetentionDays:0 },
  system:{ allowPlatformBroker:false, serverTelemetryEnabled:false, navigatePopups:true,
    loggerOptions:{ piiLoggingEnabled:false, loggerCallback:() => {} } } };
}
function identity(account) {
  if (!account || account.tenantId !== TENANT || account.environment !== "login.microsoftonline.com" ||
      !uuid(account.localAccountId) || !bounded(account.homeAccountId, 160) ||
      account.homeAccountId.toLowerCase() !== `${account.localAccountId}.${TENANT}`.toLowerCase() ||
      !bounded(account.username, 254)) throw new PickerError("unsupported");
  return { key:`${TENANT}:${account.localAccountId}:${account.homeAccountId}`.toLowerCase(),
    label:account.username, name:bounded(account.name, 120) ? account.name : "Microsoft account" };
}
function validateResult(result, now, clientId) {
  const who = identity(result?.account);
  const claims = result?.idTokenClaims;
  // Sanity-check the SDK result, not a home-grown JWT/signature validator.
  // MSAL owns PKCE/state/nonce; Graph validates its opaque access token.
  if (result.tenantId !== TENANT || result.uniqueId !== result.account.localAccountId ||
      claims?.tid !== TENANT || claims?.oid !== result.account.localAccountId || claims?.aud !== clientId ||
      claims?.iss !== `https://login.microsoftonline.com/${TENANT}/v2.0` ||
      !Number.isFinite(claims?.exp) || claims.exp * 1000 <= now) throw new PickerError("mismatch");
  const allowed = new Set([SCOPE.toLowerCase(), "openid", "profile", "offline_access"]);
  const scopes = result?.scopes?.map(s => typeof s === "string" ? s.replace(/^https:\/\/graph\.microsoft\.com\//i, "").toLowerCase() : "");
  if (!Array.isArray(scopes) || !scopes.includes(SCOPE.toLowerCase()) || scopes.some(s => !allowed.has(s))) throw new PickerError("forbidden");
  if (!bounded(result.accessToken, 65536) || !Number.isFinite(result.expiresOn?.getTime()) || result.expiresOn.getTime() <= now + 30000) throw new PickerError("stale");
  return who;
}
function errorKind(error) {
  if (error instanceof PickerError && Object.hasOwn(messages, error.kind)) return error.kind;
  if (["consent_required", "admin_consent_required"].includes(error?.errorCode) ||
      [65001, 90094, 90093].includes(Number(error?.errorNo))) return "admin";
  if (["access_denied", "user_cancelled"].includes(error?.errorCode)) return "denied";
  if (["popup_window_error", "empty_window_error", "monitor_popup_timeout", "popup_bridge_timeout"].includes(error?.errorCode)) return "popup";
  return "unavailable"; // Never surface raw provider messages, links, IDs or tokens.
}
function safePage(value) {
  if (typeof value !== "string" || value.length > 8192 || !value.startsWith(`${ENDPOINT}?`) || /[\s\\#]/u.test(value)) throw new PickerError("partial");
  const url = new URL(value);
  if (url.origin !== "https://graph.microsoft.com" || url.pathname !== "/v1.0/me/calendars" || url.username || url.password || url.hash) throw new PickerError("partial");
  const keys = [...url.searchParams.keys()];
  if (new Set(keys).size !== keys.length || keys.some(k => !["$select", "$top", "$skip", "$skiptoken"].includes(k)) ||
      url.searchParams.get("$select") !== FIELDS || url.searchParams.get("$top") !== "50" ||
      (url.searchParams.has("$skip") && !/^\d{1,6}$/.test(url.searchParams.get("$skip"))) ||
      (url.searchParams.has("$skiptoken") && !bounded(url.searchParams.get("$skiptoken"), 6000))) throw new PickerError("partial");
  return value; // Validated opaque continuation: do not rebuild or append fields.
}
async function readBoundedJson(response) {
  if (!/^application\/json\b/i.test(response.headers.get("content-type") || "") ||
      Number(response.headers.get("content-length")) > LIMITS.bytes || !response.body) throw new PickerError("partial");
  const reader = response.body.getReader(), chunks = []; let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > LIMITS.bytes) throw new PickerError("partial");
      chunks.push(value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal:true }).decode(bytes));
  } catch { throw new PickerError("partial"); }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
async function listOwnCalendars({ token, owner, fetcher, signal, guard }) {
  let next = FIRST_PAGE, total = 0, excluded = 0;
  const visited = new Set(), ids = new Set(), calendars = [];
  while (next) {
    guard(); signal.throwIfAborted();
    if (visited.size >= LIMITS.pages || visited.has(next)) throw new PickerError("partial");
    safePage(next); visited.add(next);
    const response = await fetcher(next, { method:"GET", headers:{ Authorization:`Bearer ${token}`, Accept:"application/json" },
      credentials:"omit", cache:"no-store", redirect:"error", referrerPolicy:"no-referrer", signal });
    guard(); signal.throwIfAborted();
    if (response.status !== 200) throw new PickerError(({ 401:"revoked", 403:"forbidden", 429:"throttled" })[response.status] || "unavailable");
    const page = await readBoundedJson(response);
    guard(); signal.throwIfAborted();
    if (!Array.isArray(page?.value) || (total += page.value.length) > LIMITS.calendars) throw new PickerError("partial");
    for (const item of page.value) {
      if (!bounded(item?.id, 2048) || !bounded(item?.name, 256) || ids.has(item.id)) throw new PickerError("partial");
      ids.add(item.id);
      // Conservative own-calendar eligibility, not email-based application authorization.
      // Aliases/unknown ownership are withheld rather than guessed; no foreign labels escape.
      if (item.canShare !== true || !bounded(item.owner?.address, 254) || item.owner.address.toLowerCase() !== owner.toLowerCase()) { excluded++; continue; }
      calendars.push({ id:item.id, name:item.name });
    }
    if (Object.hasOwn(page, "@odata.nextLink") && typeof page["@odata.nextLink"] !== "string") throw new PickerError("partial");
    next = Object.hasOwn(page, "@odata.nextLink") ? safePage(page["@odata.nextLink"]) : null;
  }
  return { calendars, excluded };
}

function createPicker({ config, origin, authFactory, fetcher, now = Date.now, onChange = () => {}, schedule = setTimeout, unschedule = clearTimeout }) {
  let validated;
  try { validated = validateConfig(config, origin); } catch { /* No SDK or network when invalid. */ }
  let generation = 0, session = null, pendingAuth = 0, pendingCleanup = 0;
  let state = { status:validated ? "idle" : "unconfigured", account:null, calendars:[], selected:[], self:false, excluded:0, listedAt:null, note:"" };
  const snapshot = () => ({ ...state, settling:pendingAuth > 0 || pendingCleanup > 0,
    account:state.account && { ...state.account }, calendars:state.calendars.map(c => ({ ...c })), selected:[...state.selected] });
  const emit = () => onChange(snapshot());
  const set = patch => { state = { ...state, ...patch }; emit(); };
  const clearState = status => { state = { status, account:null, calendars:[], selected:[], self:false, excluded:0, listedAt:null, note:"" }; emit(); };
  async function purge(s) {
    if (!s?.auth) return;
    pendingCleanup++;
    emit();
    try { await s.auth.clear(); }
    catch { if (!session || session === s) clearState("cleanup"); }
    finally { pendingCleanup--; emit(); }
  }
  function stop(status = "disconnected") {
    generation++; const old = session; session = null;
    if (old) { old.token = ""; old.abort.abort(); }
    clearState(validated ? status : "unconfigured");
    void purge(old);
  }
  function guard(s, requireFresh = false) {
    if (session !== s || s.generation !== generation) throw new PickerError("mismatch");
    if (identity(s.auth.current()).key !== s.who.key) throw new PickerError("mismatch");
    if (now() >= s.expires || (requireFresh && now() - state.listedAt >= LIMITS.freshness)) throw new PickerError("stale");
  }
  function check(requireFresh = true) {
    try { if (!session) return false; guard(session, requireFresh); return true; }
    catch (error) { stop(error instanceof PickerError && error.kind === "stale" ? "stale" : "mismatch"); return false; }
  }
  async function connect() {
    if (!validated || session || pendingAuth || pendingCleanup || state.status === "cleanup") return;
    pendingAuth++;
    const s = { generation:++generation, abort:new AbortController(), auth:null, token:"", who:null };
    session = s; clearState("signing");
    try {
      s.auth = await authFactory(msalConfiguration(validated));
      if (session !== s) return;
      const result = await s.auth.login({ scopes:[SCOPE], prompt:"select_account", responseMode:"fragment", redirectUri:validated.redirectUri });
      if (session !== s) return;
      s.who = validateResult(result, now(), validated.clientId); s.expires = result.expiresOn.getTime() - 30000;
      s.token = result.accessToken;
      s.auth.activate(result.account); guard(s);
      set({ status:"identity", account:{ name:s.who.name, label:s.who.label } });
    } catch (error) { if (session === s) stop(errorKind(error)); }
    finally { if (session !== s) await purge(s); pendingAuth--; emit(); }
  }
  async function load(confirmed) {
    if (confirmed !== true || state.status !== "identity" || !check(false)) return;
    const s = session;
    set({ status:"loading" });
    const timer = schedule(() => { if (session === s) stop("unavailable"); }, LIMITS.duration);
    try {
      const result = await listOwnCalendars({ token:s.token, owner:s.who.label, fetcher, signal:s.abort.signal, guard:() => guard(s) });
      guard(s); s.token = "";
      set({ ...result, status:result.calendars.length ? "picker" : "empty", listedAt:now() });
    } catch (error) { if (session === s) stop(errorKind(error)); }
    finally { unschedule(timer); }
  }
  function select(index, selected) {
    if (!["picker", "summary"].includes(state.status) || !check() || !Number.isInteger(index) ||
        !state.calendars[index] || typeof selected !== "boolean") return;
    const id = state.calendars[index].id;
    set({ status:"picker", note:"", selected:selected ? [...new Set([...state.selected, id])] : state.selected.filter(x => x !== id), self:false });
  }
  function represent(self) {
    if (state.status === "picker" && check() && typeof self === "boolean") set({ self, note:"" });
  }
  function review() {
    if (state.status !== "picker" || !check()) return;
    if (!state.self || !state.selected.length || state.selected.some(id => !state.calendars.some(c => c.id === id))) { set({ note:messages.selection }); return; }
    set({ status:"summary", note:"" });
  }
  function back() { if (state.status === "summary" && check()) set({ status:"picker" }); }
  return { snapshot, connect, load, select, represent, review, back, disconnect:() => stop(),
    check:() => { if (session?.who) check(state.listedAt !== null); } };
}
module.exports = { TENANT, ORIGIN, REDIRECT, SCOPE, FIELDS, ENDPOINT, FIRST_PAGE, LIMITS, PickerError, messages,
  validateConfig, msalConfiguration, identity, validateResult, errorKind, safePage, readBoundedJson, listOwnCalendars, createPicker };