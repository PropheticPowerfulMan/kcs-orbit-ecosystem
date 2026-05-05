import "dotenv/config";
import { createApp } from "./app";

const app = createApp();

const port = Number(process.env.PORT || 4500);

app.listen(port, () => {
  console.log(`KCS Orbit API running on port ${port}`);
});
