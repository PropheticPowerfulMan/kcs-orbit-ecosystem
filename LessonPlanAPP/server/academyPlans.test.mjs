import test from "node:test";
import assert from "node:assert/strict";
import { readAcademyPlans } from "./academyPlans.mjs";
const ticket = "a".repeat(43),
  identity = {
    userId: "nexus-one",
    email: "one@example.invalid",
    role: "TEACHER",
    accessRoles: ["teacher"],
  };
const deps = () => ({
  exchange: async () => identity,
  findProfile: async () => ({ id: "cloud-one", status: "active" }),
  findAuthUser: async () => ({
    app_metadata: { kcs_nexus_identity: { id: "nexus-one" } },
  }),
  listPlans: async () => [
    {
      id: "lesson-one",
      owner_id: "cloud-one",
      status: "draft",
      payload: {
        chapter: "Actual lesson",
        learningObjectives: [
          { id: "objective-one", value: "Actual objective" },
        ],
        reflection: { private: true },
      },
      updated_at: "2026-11-22",
    },
    { id: "foreign", owner_id: "cloud-two", payload: {} },
    {
      id: "deleted",
      owner_id: "cloud-one",
      deleted_at: "2026-11-22",
      payload: {},
    },
  ],
});
test("only the exact linked owner is returned and private lesson fields stay server-side", async () => {
  const result = await readAcademyPlans(ticket, deps());
  assert.equal(result.plans.length, 1);
  assert.equal(result.plans[0].title, "Actual lesson");
  assert.equal(result.plans[0].status, "draft");
  assert.ok(!("reflection" in result.plans[0]));
  assert.deepEqual(result.plans[0].objectives, ["Actual objective"]);
});
test("missing cloud profile is an honest disconnected state, never example plans", async () => {
  const d = deps();
  d.findProfile = async () => null;
  const r = await readAcademyPlans(ticket, d);
  assert.equal(r.state, "not-linked");
  assert.deepEqual(r.plans, []);
});
test("student, unrelated identities, blocked accounts and inactive profiles cannot read plans", async () => {
  for (const variant of ["student", "identity", "blocked", "inactive", "ban"]) {
    const d = deps();
    if (variant === "student")
      d.exchange = async () => ({ ...identity, role: "STUDENT" });
    if (variant === "identity")
      d.findAuthUser = async () => ({
        app_metadata: { kcs_nexus_identity: { id: "someone-else" } },
      });
    if (variant === "blocked")
      d.findAuthUser = async () => ({
        app_metadata: {
          kcs_nexus_identity: { id: "nexus-one" },
          kcs_orbit_access: { blocked: true },
        },
      });
    if (variant === "inactive")
      d.findProfile = async () => ({ id: "cloud-one", status: "inactive" });
    if (variant === "ban")
      d.findAuthUser = async () => ({
        app_metadata: { kcs_nexus_identity: { id: "nexus-one" } },
        banned_until: "2099-01-01",
      });
    await assert.rejects(() => readAcademyPlans(ticket, d), { status: 403 });
  }
});
test("invalid read tickets fail before any cloud read", async () => {
  for (const v of ["", null, {}, "x".repeat(300)])
    await assert.rejects(() => readAcademyPlans(v, {}), { status: 400 });
});
