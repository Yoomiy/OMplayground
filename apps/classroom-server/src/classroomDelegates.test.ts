import {
  createClassroomDelegateGameToken,
  ensureActiveClassroomDelegate,
  hasClassroomDelegateCookie,
  verifyClassroomDelegateGameToken,
} from "./classroomDelegates";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Request } from "express";

describe("classroom delegate game capability", () => {
  const secret = "service-role-secret";
  const capability = {
    delegateId: "63c6a0a7-b1e2-4b86-b13e-657c854cf9e4",
    classroomId: "0d6f48a0-3af0-4145-8462-21a8c97f4ef5",
    roomCode: "weekly-teacher",
    identity: "delegate:63c6a0a7-b1e2-4b86-b13e-657c854cf9e4",
  };

  it("accepts a fresh signed capability", () => {
    const token = createClassroomDelegateGameToken(capability, secret);
    expect(verifyClassroomDelegateGameToken(token, secret)).toMatchObject(
      capability,
    );
  });

  it("rejects a modified capability", () => {
    const token = createClassroomDelegateGameToken(capability, secret);
    const [payload, signature] = token.split(".");
    expect(
      verifyClassroomDelegateGameToken(`${payload}x.${signature}`, secret),
    ).toBeNull();
  });
});

describe("active classroom delegate persistence", () => {
  const input = {
    classroomId: "0d6f48a0-3af0-4145-8462-21a8c97f4ef5",
    displayName: "Student",
    participantKey: "guest:weekly-teacher:student-1",
    scopes: ["manage_delegates"] as const,
    createdBy: "11111111-1111-4111-8111-111111111111",
  };

  function readChain(result: { data: { id: string } | null; error: unknown }) {
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue(result),
    };
  }

  it("reuses an existing active delegate instead of inserting a duplicate", async () => {
    const existing = readChain({
      data: { id: "delegate-existing" },
      error: null,
    });
    const from = jest.fn().mockReturnValue(existing);
    const supabase = { from } as unknown as SupabaseClient;

    await expect(
      ensureActiveClassroomDelegate(supabase, input),
    ).resolves.toEqual({
      id: "delegate-existing",
      created: false,
    });
    expect(from).toHaveBeenCalledTimes(1);
    expect(existing.eq).toHaveBeenNthCalledWith(3, "is_active", true);
  });

  it("creates a delegate when no active row exists", async () => {
    const missing = readChain({ data: null, error: null });
    const insertChain = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest
        .fn()
        .mockResolvedValue({ data: { id: "delegate-new" }, error: null }),
    };
    const supabase = {
      from: jest
        .fn()
        .mockReturnValueOnce(missing)
        .mockReturnValueOnce(insertChain),
    } as unknown as SupabaseClient;

    await expect(
      ensureActiveClassroomDelegate(supabase, input),
    ).resolves.toEqual({
      id: "delegate-new",
      created: true,
    });
    expect(insertChain.insert).toHaveBeenCalledWith({
      classroom_id: input.classroomId,
      display_name: input.displayName,
      participant_key: input.participantKey,
      scopes: ["manage_delegates"],
      created_by: input.createdBy,
    });
  });

  it("recovers the concurrent winner after a unique violation", async () => {
    const missing = readChain({ data: null, error: null });
    const concurrent = readChain({
      data: { id: "delegate-winner" },
      error: null,
    });
    const insertChain = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { code: "23505", message: "duplicate key" },
      }),
    };
    const supabase = {
      from: jest
        .fn()
        .mockReturnValueOnce(missing)
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(concurrent),
    } as unknown as SupabaseClient;

    await expect(
      ensureActiveClassroomDelegate(supabase, input),
    ).resolves.toEqual({
      id: "delegate-winner",
      created: false,
    });
  });

  it("detects only the expected delegate cookie without exposing its value", () => {
    const req = {
      headers: {
        cookie: "other=value; classroom_delegate_delegate-1=session.secret",
      },
    } as Request;

    expect(hasClassroomDelegateCookie(req, "delegate-1")).toBe(true);
    expect(hasClassroomDelegateCookie(req, "delegate-2")).toBe(false);
  });
});
