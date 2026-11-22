import test from "node:test";
import assert from "node:assert/strict";
import { academyRateLimit } from "./academy-rate-limit";
const key = "synthetic-academy-service-only";
function invoke(
  handler: any,
  token: string,
  provided = key,
  path = "/validate",
) {
  let result = 0,
    headers: any = {};
  handler(
    {
      ip: "shared-server",
      path,
      body: { token, userId: token },
      header: () => provided,
    },
    {
      setHeader: (k: string, v: string) => {
        headers[k] = v;
      },
      status: (status: number) => ({
        json: () => {
          result = status;
        },
      }),
    },
    () => {
      result = 200;
    },
  );
  return { result, headers };
}
test("hundreds of people behind the same verified Academy server have independent session budgets", () => {
  const handler = academyRateLimit({ serviceKey: () => key });
  for (let i = 0; i < 500; i++)
    assert.equal(invoke(handler, "session-" + i).result, 200);
});
test("a verified session remains rate limited", () => {
  const handler = academyRateLimit({ serviceKey: () => key, identityLimit: 3 });
  for (let i = 0; i < 3; i++) assert.equal(invoke(handler, "one").result, 200);
  assert.deepEqual(invoke(handler, "one"), {
    result: 429,
    headers: { "Retry-After": "60" },
  });
});
test("invalid keys and random tokens cannot bypass the public ceiling", () => {
  const handler = academyRateLimit({ serviceKey: () => key, publicLimit: 3 });
  for (let i = 0; i < 3; i++)
    assert.equal(invoke(handler, "random-" + i, "wrong-" + i).result, 200);
  assert.equal(invoke(handler, "fresh-identifier", "wrong").result, 429);
});
test("the aggregate service ceiling still protects the server", () => {
  const handler = academyRateLimit({ serviceKey: () => key, serviceLimit: 2 });
  assert.equal(invoke(handler, "one").result, 200);
  assert.equal(invoke(handler, "two").result, 200);
  assert.equal(invoke(handler, "three").result, 429);
});
test("public login does not inherit a service budget, even with a service key", () => {
  const handler = academyRateLimit({ serviceKey: () => key, publicLimit: 1 });
  assert.equal(invoke(handler, "one", key, "/tickets").result, 200);
  assert.equal(invoke(handler, "two", key, "/tickets").result, 429);
});
test("expired windows reopen, missing configuration never authenticates an empty key", () => {
  let clock = 10;
  const handler = academyRateLimit({
    serviceKey: () => undefined,
    now: () => clock,
    publicLimit: 1,
  });
  assert.equal(invoke(handler, "one", "").result, 200);
  assert.equal(invoke(handler, "two", "").result, 429);
  clock += 60001;
  assert.equal(invoke(handler, "three", "").result, 200);
});
