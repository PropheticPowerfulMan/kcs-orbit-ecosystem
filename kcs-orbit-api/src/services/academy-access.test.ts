import assert from "node:assert/strict";
import test from "node:test";
import { isAcademyRole } from "./academy-access";
test("Academy admits only teaching and administrative roles", () => {
  for (const role of ["TEACHER", "ADMIN", "SUPER_ADMIN"]) assert.equal(isAcademyRole(role), true);
  for (const role of ["PARENT", "STUDENT", "STAFF", "ANONYMOUS", ""]) assert.equal(isAcademyRole(role), false);
});
