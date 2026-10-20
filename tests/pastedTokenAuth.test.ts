import { createPastedTokenAuth } from "../example/pastedTokenAuth";

describe("pasted token authentication", () => {
  let provider: (() => Promise<string>) | undefined;
  let resetCount: number;
  let auth: ReturnType<typeof createPastedTokenAuth>;

  beforeEach(() => {
    provider = undefined;
    resetCount = 0;
    auth = createPastedTokenAuth({
      registerAuthTokenProvider: (next) => {
        provider = next;
      },
      unregisterAuthTokenProvider: () => {
        provider = undefined;
      },
      resetProfile: () => {
        resetCount += 1;
      },
    });
  });

  it("requires a token before enabling and supplies the latest assigned token", async () => {
    expect(auth.enable()).toBe(false);
    expect(provider).toBeUndefined();
    auth.setToken(" token-a ");
    expect(auth.enable()).toBe(true);
    await expect(provider!()).resolves.toBe("token-a");
    const previousProvider = provider!;
    auth.setToken("token-b");
    await expect(provider!()).resolves.toBe("token-b");
    await expect(previousProvider()).rejects.toThrow("Provider replaced");
  });

  it("disables personalization without logging out", () => {
    auth.setToken("token-a");
    auth.enable();
    auth.disable();
    expect(provider).toBeUndefined();
    expect(resetCount).toBe(0);
    expect(auth.enable()).toBe(true);
  });

  it("clears authentication for profile saves without resetting the SDK profile", async () => {
    auth.setToken("token-a");
    auth.enable();
    const previousProvider = provider!;
    auth.clear();
    expect(resetCount).toBe(0);
    expect(provider).toBeUndefined();
    expect(auth.enable()).toBe(false);
    await expect(previousProvider()).rejects.toThrow("Provider replaced");
    auth.setToken("token-b");
    auth.enable();
    await expect(provider!()).resolves.toBe("token-b");
  });

  it("clears tokens on reset and invalidates the old provider before another user", async () => {
    auth.setToken("token-a");
    auth.enable();
    const previousProvider = provider!;
    auth.resetProfile();
    expect(resetCount).toBe(1);
    expect(provider).toBeUndefined();
    expect(auth.enable()).toBe(false);
    auth.setToken("token-b");
    auth.enable();
    await expect(previousProvider()).rejects.toThrow("Provider replaced");
    await expect(provider!()).resolves.toBe("token-b");
  });
});
