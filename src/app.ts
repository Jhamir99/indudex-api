import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { cors } from "hono/cors";

export const app = new OpenAPIHono();

// The frontend calls the API from the browser (it downloads shards directly).
// CORS_ORIGIN is a comma-separated list of allowed frontend origins.
const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim());

app.use("*", cors({ origin: allowedOrigins, allowMethods: ["GET"] }));

const HealthSchema = z
  .object({
    status: z.literal("ok"),
  })
  .openapi("Health");

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  summary: "Check that the API is up",
  responses: {
    200: {
      description: "The API is up",
      content: {
        "application/json": { schema: HealthSchema },
      },
    },
  },
});

app.openapi(healthRoute, (c) => {
  return c.json({ status: "ok" } as const, 200);
});

// The contract the frontend generates its types and client from.
app.doc31("/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "Indudex API",
    version: "0.1.0",
  },
});
