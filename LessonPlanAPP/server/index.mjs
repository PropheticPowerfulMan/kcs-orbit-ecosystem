import "dotenv/config";
import http from "node:http";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { recoveryEmail } from "./emailTemplate.mjs";

const required = [
  "APP_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "NEXUS_API_URL",
  "LWS_SMTP_HOST", "LWS_SMTP_USER", "LWS_SMTP_PASSWORD",
  "MAIL_FROM_ADDRESS", "PUBLIC_LOGO_URL"
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error("Missing environment variables: " + missing.join(", "));
if (process.env.SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_publishable_")) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY must be a secret/service_role key, not a publishable key.");
}

const port = Number(process.env.PORT || 3001);
const appUrl = process.env.APP_URL.replace(/\/$/, "");
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || appUrl).split(",").map((value) => value.trim()));
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const supabasePublic = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const transporter = nodemailer.createTransport({
  host: process.env.LWS_SMTP_HOST,
  port: Number(process.env.LWS_SMTP_PORT || 465),
  secure: String(process.env.LWS_SMTP_SECURE || "true") === "true",
  auth: { user: process.env.LWS_SMTP_USER, pass: process.env.LWS_SMTP_PASSWORD }
});
const attempts = new Map();

const sendJson = (response, status, body, origin) => {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": origin || appUrl,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
};

const readJson = (request) => new Promise((resolve, reject) => {
  let raw = "";
  request.on("data", (chunk) => {
    raw += chunk;
    if (raw.length > 10000) request.destroy();
  });
  request.on("end", () => {
    try { resolve(JSON.parse(raw || "{}")); } catch { reject(new Error("Invalid JSON")); }
  });
  request.on("error", reject);
});

const allowed = (key) => {
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((time) => now - time < 15 * 60 * 1000);
  recent.push(now);
  attempts.set(key, recent);
  return recent.length <= 5;
};

const profileRoleFor = (nexusUser) => {
  const role = String(nexusUser.role || "").toLowerCase();
  const accessRoles = Array.isArray(nexusUser.accessRoles) ? nexusUser.accessRoles.map((value) => String(value).toLowerCase()) : [];
  if (role === "admin") return nexusUser.id === "configured-superadmin" ? "administrator" : "principal";
  if (role === "teacher" || accessRoles.includes("teacher")) return "teacher";
  return null;
};

const profileNameFor = (nexusUser) => [nexusUser.lastName, nexusUser.middleName, nexusUser.firstName]
  .filter(Boolean)
  .join(" ")
  .replace(/\s+/g, " ")
  .trim() || String(nexusUser.name || "KCS Teacher");

const findAuthUserByEmail = async (email) => {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((user) => String(user.email || "").toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
  return null;
};

const ensureSupabaseProfile = async (nexusUser) => {
  const email = String(nexusUser.email || "").trim().toLowerCase();
  if (!email) throw new Error("The institutional account does not have an email address.");
  const role = profileRoleFor(nexusUser);
  if (!role) throw new Error("Only teachers and authorized school leaders may use KCS Lesson Plan.");

  const { data: rows, error: profileError } = await supabase.from("profiles").select("*").ilike("email", email).limit(2);
  if (profileError) throw profileError;
  if ((rows || []).length > 1) throw new Error("Multiple lesson-plan profiles use this email. Ask the Super Administration to reconcile them.");

  let profile = rows?.[0] || null;
  let authUser = profile ? await supabase.auth.admin.getUserById(profile.id).then(({ data, error }) => {
    if (error) throw error;
    return data.user;
  }) : await findAuthUserByEmail(email);

  if (!authUser) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { name: profileNameFor(nexusUser), role, source: "kcs-orbit" }
    });
    if (error || !data.user) throw error || new Error("Unable to provision the lesson-plan identity.");
    authUser = data.user;
  }

  if (!profile) {
    const { data, error } = await supabase.from("profiles").upsert({
      id: authUser.id,
      name: profileNameFor(nexusUser),
      email,
      role,
      department: role === "teacher" ? "Teaching" : "Administration",
      subjects: [],
      grade_classes: [],
      status: "active",
      updated_at: new Date().toISOString()
    }, { onConflict: "id" }).select("*").single();
    if (error) throw error;
    profile = data;
  } else if (profile.status !== "active") {
    const { data, error } = await supabase.from("profiles")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", profile.id)
      .select("*")
      .single();
    if (error) throw error;
    profile = data;
  }
  return { email, profile };
};

const createSupabaseSession = async (email) => {
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = linkData?.properties?.hashed_token;
  if (linkError || !tokenHash) throw linkError || new Error("Unable to create the secure lesson-plan session.");
  const { data, error } = await supabasePublic.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (error || !data.session) throw error || new Error("Unable to verify the secure lesson-plan session.");
  return data.session;
};

const ecosystemLogin = async (body) => {
  const identifier = String(body.identifier || "").trim();
  const password = String(body.password || "");
  if (identifier.length < 2 || identifier.length > 180 || !password || password.length > 200) {
    const error = new Error("Invalid institutional credentials.");
    error.status = 400;
    throw error;
  }
  const nexusResponse = await fetch(new URL("/api/auth/login", process.env.NEXUS_API_URL), {
    method: "POST",
    headers: { "content-type": "application/json", "x-kcs-client": "KCS_LESSON_PLAN" },
    body: JSON.stringify({ identifier, password }),
    signal: AbortSignal.timeout(12000)
  });
  const nexusBody = await nexusResponse.json().catch(() => null);
  if (!nexusResponse.ok || !nexusBody?.data?.user) {
    const error = new Error(nexusBody?.message || "Incorrect institutional identifier or password.");
    error.status = nexusResponse.status === 403 ? 403 : 401;
    throw error;
  }
  const { email } = await ensureSupabaseProfile(nexusBody.data.user);
  return createSupabaseSession(email);
};

const server = http.createServer(async (request, response) => {
  const origin = request.headers.origin || "";
  const corsOrigin = allowedOrigins.has(origin) ? origin : appUrl;
  const pathname = new URL(request.url || "/", "http://lesson-plan.local").pathname;
  if (request.method === "OPTIONS") return sendJson(response, 204, {}, corsOrigin);
  if (request.method === "GET" && pathname === "/api/health") {
    return sendJson(response, 200, { status: "ok" }, corsOrigin);
  }
  if (request.method !== "POST" || !["/api/auth/recovery", "/api/auth/ecosystem-login"].includes(pathname)) {
    return sendJson(response, 404, { error: "Not found" }, corsOrigin);
  }
  if (origin && !allowedOrigins.has(origin)) {
    return sendJson(response, 403, { error: "Origin not allowed" }, appUrl);
  }

  const ip = String(request.headers["x-forwarded-for"] || request.socket.remoteAddress || "").split(",")[0].trim();
  if (!allowed(ip)) return sendJson(response, 429, { error: "Trop de demandes. Réessayez dans 15 minutes." }, corsOrigin);

  try {
    const body = await readJson(request);
    if (pathname === "/api/auth/ecosystem-login") {
      const session = await ecosystemLogin(body);
      return sendJson(response, 200, session, corsOrigin);
    }
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return sendJson(response, 400, { error: "Adresse email invalide." }, corsOrigin);
    }

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: appUrl + "/#/login" }
    });
    if (!error && data?.properties?.action_link) {
      const message = recoveryEmail({
        actionLink: data.properties.action_link,
        logoUrl: process.env.PUBLIC_LOGO_URL
      });
      await transporter.sendMail({
        from: '"' + (process.env.MAIL_FROM_NAME || "KCS EduPlanner") + '" <' + process.env.MAIL_FROM_ADDRESS + '>',
        to: email,
        replyTo: process.env.MAIL_REPLY_TO || process.env.MAIL_FROM_ADDRESS,
        ...message
      });
    } else if (error) {
      console.error("Recovery link generation failed:", error.message);
    }
  } catch (error) {
    if (pathname === "/api/auth/ecosystem-login") {
      console.error("Ecosystem login failed:", error instanceof Error ? error.message : error);
      const status = Number(error?.status || 500);
      const message = status < 500 && error instanceof Error
        ? error.message
        : "The secure lesson-plan session could not be started. Please try again.";
      return sendJson(response, status, { error: message }, corsOrigin);
    }
    console.error("Recovery request failed:", error instanceof Error ? error.message : error);
  }

  return sendJson(response, 202, {
    message: "Si ce compte existe, un email de récupération KCS a été envoyé."
  }, corsOrigin);
});

server.listen(port, process.env.HOST || "0.0.0.0", () => {
  console.log("KCS Lesson Plan service listening on " + (process.env.HOST || "0.0.0.0") + ":" + port);
});
