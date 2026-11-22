// Server-only bridge. It reads existing cloud plans; it never provisions an account or publishes a draft.
export async function readAcademyPlans(
  ticket,
  { exchange, findProfile, findAuthUser, listPlans },
) {
  if (typeof ticket !== "string" || !/^[A-Za-z0-9_-]{40,128}$/.test(ticket))
    throw Object.assign(new Error("Invalid Academy read ticket"), {
      status: 400,
    });
  const identity = await exchange(ticket);
  if (
    !identity?.userId ||
    !identity.email ||
    !["ADMIN", "TEACHER", "STAFF"].includes(identity.role) ||
    (identity.role === "STAFF" && !identity.accessRoles?.includes("teacher"))
  )
    throw Object.assign(new Error("Teacher access is required"), {
      status: 403,
    });
  const profile = await findProfile(identity.email);
  if (!profile)
    return {
      source: "KCS_EDUPLANNER_CLOUD",
      state: "not-linked",
      plans: [],
      syncedAt: new Date().toISOString(),
    };
  const user = await findAuthUser(profile.id);
  if (
    !user ||
    profile.status !== "active" ||
    user.app_metadata?.kcs_nexus_identity?.id !== identity.userId ||
    user.app_metadata?.kcs_orbit_access?.blocked ||
    (user.banned_until && Date.parse(user.banned_until) > Date.now())
  )
    throw Object.assign(
      new Error(
        "Eduplanner identity is inactive or not linked to this institutional account",
      ),
      { status: 403 },
    );
  const rows = await listPlans(profile.id);
  const text = (v, max = 160) => (typeof v === "string" ? v.slice(0, max) : "");
  const plans = rows
    .filter(
      (r) =>
        r.owner_id === profile.id && !r.deleted_at && !r.payload?.deletedAt,
    )
    .slice(0, 200)
    .map((r) => {
      const v = r.payload || {};
      return {
        id: text(r.id),
        title: text(v.chapter || v.topic || v.lessonNumber),
        subject: text(v.subject),
        grade: text(v.gradeClass),
        schoolYear: text(v.schoolYear),
        semester: text(String(v.semester || "")),
        quarter: text(String(v.quarter || "")),
        date: text(v.date),
        status: text(r.status || v.status),
        updatedAt: text(r.updated_at),
        objectives: Array.isArray(v.learningObjectives)
          ? v.learningObjectives
              .map((o) => (typeof o === "string" ? o : o?.value))
              .filter((o) => typeof o === "string" && o.trim())
              .slice(0, 30)
              .map((o) => text(o, 1200))
          : [],
        lessonNumber: text(v.lessonNumber),
        planType: text(v.planType),
      };
    });
  return {
    source: "KCS_EDUPLANNER_CLOUD",
    state: "connected",
    plans,
    syncedAt: new Date().toISOString(),
    limit: 200,
  };
}
