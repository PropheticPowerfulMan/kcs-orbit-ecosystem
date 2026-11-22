import test from "node:test";
import assert from "node:assert/strict";
import { academyScheduleBelongsTo as match } from "./academyScheduleIdentity.js";
const people = [
  {
    id: "one",
    firstName: "Jonathan",
    middleName: "Lomboto",
    lastName: "Lokala",
  },
  { id: "two", firstName: "William", middleName: null, lastName: "Offei" },
  { id: "three", firstName: "Other", middleName: null, lastName: "Lokala" },
];
test("honorifics, reordered names and accents identify the right teacher", () => {
  assert.ok(match("Mr. Offei", "two", people));
  assert.ok(match("LOKALA JONATHAN", "one", people));
  assert.ok(match("Öffei William", "two", people));
  assert.ok(!match("Mr. Offei", "one", people));
});
test("ambiguous surname, missing and unrelated names are not attributed to a teacher", () => {
  assert.ok(!match("Lokala", "one", people));
  for (const v of [null, "", "Mr", "Unknown"])
    assert.ok(!match(v, "one", people));
});
