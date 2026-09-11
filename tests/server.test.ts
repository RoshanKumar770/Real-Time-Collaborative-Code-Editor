import { beforeAll, describe, expect, it } from "vitest";import request from "supertest";
import { app } from "../server";
import { loadOrCreateRoom } from "../server";
import { createToken } from "../src/auth/auth";

beforeAll(async () => {
  await loadOrCreateRoom("global-workspace", "Global Workspace");
  await loadOrCreateRoom(
    "algos-lab",
    "Algorithm & Data Structures Lab"
  );
});
const testToken = createToken({
  id: "test-user",
  username: "testuser",
});

describe("REST API Integration", () => {
  it("GET /api/health returns healthy status", async () => {
    const response = await request(app)
      .get("/api/health")
      .expect(200);

    expect(response.body.status).toBe("ok");
    expect(response.body.activeRooms).toBeGreaterThanOrEqual(2);
    expect(response.body).toHaveProperty("serverTime");
    expect(response.body).toHaveProperty("uptimeSeconds");
  });

  it("GET /api/rooms returns available rooms", async () => {
    const response = await request(app)
      .get("/api/rooms")
      .set("Authorization", `Bearer ${testToken}`)
      .expect(200);

    expect(response.body).toHaveProperty("rooms");
    expect(Array.isArray(response.body.rooms)).toBe(true);
    expect(response.body.rooms.length).toBeGreaterThanOrEqual(2);

    const globalRoom = response.body.rooms.find(
      (room: { id: string }) => room.id === "global-workspace"
    );

    expect(globalRoom).toBeDefined();
    expect(globalRoom.fileCount).toBeGreaterThan(0);
  });

  it("GET /api/rooms/:id returns room details", async () => {
    const response = await request(app)
      .get("/api/rooms/global-workspace")
      .set("Authorization", `Bearer ${testToken}`)
      .expect(200);

    expect(response.body.id).toBe("global-workspace");
    expect(response.body.name).toBe("Global Workspace");
    expect(Array.isArray(response.body.files)).toBe(true);
    expect(response.body.files.length).toBeGreaterThan(0);
    expect(Array.isArray(response.body.versionHistory)).toBe(true);
  });

  it("GET /api/rooms/:id returns 404 for unknown room", async () => {
    const response = await request(app)
      .get("/api/rooms/does-not-exist")
      .set("Authorization", `Bearer ${testToken}`)
      .expect(404);

    expect(response.body.error).toBe("Room not found");
  });

  it("POST /api/rooms creates a new room", async () => {
    const roomId = `integration-test-${Date.now()}`;

    const response = await request(app)
      .post("/api/rooms")
      .send({
        id: roomId,
        name: "Integration Test Room",
      })
      .expect(200);

    expect(response.body.id).toBe(roomId);
    expect(response.body.name).toBe("Integration Test Room");
    expect(response.body.fileCount).toBeGreaterThan(0);
  });

  it("POST /api/rooms generates an ID when none is supplied", async () => {
    const response = await request(app)
      .post("/api/rooms")
      .send({
        name: "Generated Room",
      })
      .expect(200);

    expect(response.body.id).toMatch(/^room-/);
    expect(response.body.name).toBe("Generated Room");
  });

  it("POST /api/execute executes JavaScript", async () => {
    const response = await request(app)
      .post("/api/execute")
      .send({
        language: "javascript",
        code: 'console.log("integration-test");',
      })
      .expect(200);

    expect(response.body.stdout).toContain("integration-test");
    expect(response.body.stderr).toBe("");
    expect(response.body.exitCode).toBe(0);
    expect(response.body).toHaveProperty("executionTimeMs");
  });

  it("POST /api/execute rejects missing code", async () => {
    const response = await request(app)
      .post("/api/execute")
      .send({
        language: "javascript",
      })
      .expect(400);

    expect(response.body.error).toBe("Code must be a string");
  });

  it("POST /api/execute handles runtime errors", async () => {
    const response = await request(app)
      .post("/api/execute")
      .send({
        language: "javascript",
        code: 'throw new Error("test failure");',
      })
      .expect(200);

    expect(response.body.exitCode).toBe(1);
    expect(response.body.stderr).toContain("test failure");
  });

  it("POST /api/analyze analyzes source code", async () => {
    const response = await request(app)
      .post("/api/analyze")
      .send({
        code: `function hello(name) {
  console.log(name);
}`,
      })
      .expect(200);

    expect(response.body).toHaveProperty("characterCount");
    expect(response.body).toHaveProperty("lineCount");
    expect(response.body).toHaveProperty("tokenCount");
    expect(response.body).toHaveProperty("functionCount");
    expect(response.body).toHaveProperty("syntaxValid");
    expect(response.body.functionCount).toBeGreaterThan(0);
  });

  it("POST /api/analyze detects unbalanced brackets", async () => {
    const response = await request(app)
      .post("/api/analyze")
      .send({
        code: "function broken() {",
      })
      .expect(200);

    expect(response.body.syntaxValid).toBe(false);
    expect(response.body.diagnostics.length).toBeGreaterThan(0);
  });
  it("registers a new user", async () => {
  const username = `authuser-${Date.now()}`;

  const response = await request(app)
    .post("/api/auth/register")
    .send({
      username,
      password: "password123",
    })
    .expect(201);

  expect(response.body).toHaveProperty("token");
  expect(response.body.user.username).toBe(username);
});

it("logs in an existing user", async () => {
  const username = `loginuser-${Date.now()}`;

  await request(app)
    .post("/api/auth/register")
    .send({
      username,
      password: "password123",
    })
    .expect(201);

  const response = await request(app)
    .post("/api/auth/login")
    .send({
      username,
      password: "password123",
    })
    .expect(200);

  expect(response.body).toHaveProperty("token");
  expect(response.body.user.username).toBe(username);
});

it("rejects protected rooms API without authentication", async () => {
  await request(app)
    .get("/api/rooms")
    .expect(401);
});

it("rejects login with an incorrect password", async () => {
  const username = `wrongpass-${Date.now()}`;

  await request(app)
    .post("/api/auth/register")
    .send({
      username,
      password: "password123",
    })
    .expect(201);

  await request(app)
    .post("/api/auth/login")
    .send({
      username,
      password: "wrong-password",
    })
    .expect(401);
});
});