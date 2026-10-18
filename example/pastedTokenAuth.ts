interface AuthApi {
  registerAuthTokenProvider(provider: () => Promise<string>): void;
  unregisterAuthTokenProvider(): void;
  resetProfile(): void;
}

export function createPastedTokenAuth(api: AuthApi) {
  let token = "";
  let enabled = false;
  let generation = 0;

  const register = () => {
    const currentGeneration = ++generation;
    api.registerAuthTokenProvider(async () => {
      if (currentGeneration !== generation) {
        throw new Error("Provider replaced");
      }
      if (!token) {
        throw new Error("No token assigned");
      }
      return token;
    });
  };

  const disable = () => {
    enabled = false;
    generation += 1;
    api.unregisterAuthTokenProvider();
  };

  return {
    setToken(value: string) {
      token = value.trim();
      if (enabled) register();
    },
    enable() {
      if (!token) return false;
      enabled = true;
      register();
      return true;
    },
    disable,
    resetProfile() {
      disable();
      token = "";
      api.resetProfile();
    },
  };
}
