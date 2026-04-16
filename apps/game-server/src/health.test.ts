import request from "supertest";
import express from "express";

describe("HTTP health", () => {
  it("returns 200 for /health", async () => {
    const app = express();
    app.get("/health", (_req, res) => {
      res.json({ ok: true });
    });
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
