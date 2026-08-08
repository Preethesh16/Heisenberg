import "dotenv/config";
import express from "express";
import cors from "cors";
import { router } from "./api/routes.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" })); // handwriting photos arrive as base64
app.use("/api", router);

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`ULTA server on :${port} — fixtures=${process.env.USE_FIXTURES === "true"}`);
});
