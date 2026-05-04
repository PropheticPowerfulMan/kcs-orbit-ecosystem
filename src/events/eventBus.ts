import { EventEmitter } from "events";

export const eventBus = new EventEmitter();

eventBus.on("payment.created", (payload) => {
  console.log("[EVENT] payment.created", payload);
});

eventBus.on("grade.created", (payload) => {
  console.log("[EVENT] grade.created", payload);
});
