import { createHash, randomBytes } from "node:crypto";
import { ApiError } from "../utils/api.js";
export type PlannerIdentity = {
  userId: string;
  email: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  role: string;
  accessRoles: string[];
};
export type PlannerPurpose = "login" | "academy-read";
export function createPlannerTickets(now = () => Date.now()) {
  const records = new Map<
    string,
    { identity: PlannerIdentity; purpose: PlannerPurpose; expiresAt: number }
  >();
  const hash = (value: string) =>
    createHash("sha256").update(value).digest("hex");
  const prune = () => {
    for (const [k, v] of records) if (v.expiresAt <= now()) records.delete(k);
  };
  return {
    issue(identity: PlannerIdentity, purpose: PlannerPurpose = "login") {
      prune();
      if (records.size >= 10000)
        throw new ApiError(503, "Eduplanner launch is busy. Please retry.");
      const ticket = randomBytes(32).toString("base64url");
      records.set(hash(ticket), {
        identity,
        purpose,
        expiresAt: now() + 60000,
      });
      return ticket;
    },
    consume(ticket: unknown, purpose: PlannerPurpose = "login") {
      prune();
      if (typeof ticket !== "string" || !/^[A-Za-z0-9_-]{40,128}$/.test(ticket))
        throw new ApiError(400, "Invalid Eduplanner launch ticket");
      const key = hash(ticket),
        record = records.get(key);
      if (!record || record.purpose !== purpose)
        throw new ApiError(
          401,
          "Eduplanner launch ticket expired, already used, or intended for another operation",
        );
      records.delete(key);
      return record.identity;
    },
  };
}
export const plannerTickets = createPlannerTickets();
