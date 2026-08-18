import "dotenv/config";
import { createApp } from "./app";
import { startAcademicYearRolloverScheduler } from "./services/academic-year-progression.service";

const app = createApp();

const port = Number(process.env.PORT || 4500);

app.listen(port, () => {
  console.log(`KCS Orbit API running on port ${port}`);
  startAcademicYearRolloverScheduler();
});
