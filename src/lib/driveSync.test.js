import { describe, it, expect, vi, beforeEach } from "vitest";
import { findBackupFile, uploadBackupFile, downloadBackupFile, forgetToken } from "./driveSync.js";

const okJson = (data) => Promise.resolve({ ok: true, json: () => Promise.resolve(data), text: () => Promise.resolve(JSON.stringify(data)) });

describe("driveSync REST helpers", () => {
  beforeEach(() => { forgetToken(); vi.stubGlobal("fetch", vi.fn()); });

  it("findBackupFile queries appDataFolder and returns first hit", async () => {
    fetch.mockReturnValueOnce(okJson({ files: [{ id: "abc", modifiedTime: "t" }] }));
    const f = await findBackupFile("tok");
    expect(f.id).toBe("abc");
    const url = fetch.mock.calls[0][0];
    expect(url).toContain("spaces=appDataFolder");
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
  });

  it("findBackupFile returns null when no file exists", async () => {
    fetch.mockReturnValueOnce(okJson({ files: [] }));
    expect(await findBackupFile("tok")).toBeNull();
  });

  it("uploadBackupFile POSTs to create and PATCHes to update", async () => {
    fetch.mockReturnValueOnce(okJson({ id: "new" }));
    await uploadBackupFile("tok", null, "{}");
    expect(fetch.mock.calls[0][1].method).toBe("POST");
    expect(fetch.mock.calls[0][1].body).toContain("appDataFolder");

    fetch.mockReturnValueOnce(okJson({ id: "abc" }));
    await uploadBackupFile("tok", "abc", "{}");
    expect(fetch.mock.calls[1][0]).toContain("/files/abc");
    expect(fetch.mock.calls[1][1].method).toBe("PATCH");
  });

  it("downloadBackupFile requests alt=media and surfaces API errors", async () => {
    fetch.mockReturnValueOnce(okJson({ hello: 1 }));
    const text = await downloadBackupFile("tok", "abc");
    expect(fetch.mock.calls[0][0]).toContain("alt=media");
    expect(JSON.parse(text).hello).toBe(1);

    fetch.mockReturnValueOnce(Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({ error: { message: "rate" } }) }));
    await expect(downloadBackupFile("tok", "abc")).rejects.toThrow("Drive API 403: rate");
  });
});
