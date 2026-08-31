import assert from "node:assert/strict";
import test from "node:test";
import { isAcademyRole } from "./academy-access";
test("Academy admits students, teachers and administrators", () => {
  for (const role of ["STUDENT", "TEACHER", "ADMIN", "SUPER_ADMIN"]) assert.equal(isAcademyRole(role), true);
  for (const role of ["PARENT", "STAFF", "ANONYMOUS", ""]) assert.equal(isAcademyRole(role), false);
});
