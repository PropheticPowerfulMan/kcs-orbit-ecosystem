import test from "node:test";
import assert from "node:assert/strict";
import { createPlannerTickets } from "./lessonPlanTickets.js";
const identity = {
  userId: "teacher-one",
  email: "one@example.invalid",
  firstName: "One",
  middleName: null,
  lastName: "Teacher",
  role: "TEACHER",
  accessRoles: ["teacher"],
};
test("launch tickets are random, single-use, and purpose-bound", () => {
  const tickets = createPlannerTickets();
  const a = tickets.issue(identity);
  const b = tickets.issue(identity, "academy-read");
  assert.notEqual(a, b);
  assert.throws(() => tickets.consume(b));
  assert.deepEqual(tickets.consume(b, "academy-read"), identity);
  assert.throws(() => tickets.consume(b, "academy-read"));
  assert.deepEqual(tickets.consume(a), identity);
  assert.throws(() => tickets.consume(a));
});
test("expired tickets and malformed input are denied", () => {
  let now = 100;
  const tickets = createPlannerTickets(() => now);
  const t = tickets.issue(identity);
  now += 60001;
  assert.throws(() => tickets.consume(t));
  for (const t of [null, "", "/evil", {}, "x".repeat(1000)])
    assert.throws(() => tickets.consume(t));
});
test("concurrent sessions cannot exchange another users identity", () => {
  const tickets = createPlannerTickets();
  const first = tickets.issue(identity),
    second = tickets.issue({
      ...identity,
      userId: "teacher-two",
      email: "two@example.invalid",
    });
  assert.equal(tickets.consume(second).userId, "teacher-two");
  assert.equal(tickets.consume(first).userId, "teacher-one");
});
