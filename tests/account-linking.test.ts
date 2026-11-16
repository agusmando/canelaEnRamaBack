import { afterEach, describe, expect, it } from "vitest";
import { accountLinkingEnabled, accountRecipes, linkingDecision, NOT_ALLOWED_REASON } from "../src/config/supertokens/account-linking.js";

describe("account linking", () => {
  const prev = process.env.ACCOUNT_LINKING;
  afterEach(() => {
    if (prev === undefined) delete process.env.ACCOUNT_LINKING;
    else process.env.ACCOUNT_LINKING = prev;
  });

  it("apagado por defecto (requiere la función en el core)", () => {
    delete process.env.ACCOUNT_LINKING;
    expect(accountLinkingEnabled()).toBe(false);
    expect(accountRecipes()).toHaveLength(1); // solo verificación de email
    process.env.ACCOUNT_LINKING = "on";
    expect(accountLinkingEnabled()).toBe(true);
    expect(accountRecipes()).toHaveLength(2);
  });

  it("vincula solo con email verificado y nunca con sesión abierta", async () => {
    expect(await linkingDecision({}, undefined, undefined)).toEqual({ shouldAutomaticallyLink: true, shouldRequireVerification: true });
    expect(await linkingDecision({}, undefined, { getUserId: () => "x" })).toEqual({ shouldAutomaticallyLink: false });
  });

  it("mensajes en español para los casos bloqueados", () => {
    for (const reason of Object.values(NOT_ALLOWED_REASON)) {
      expect(reason).not.toMatch(/security reasons|ERR_CODE/i);
    }
    expect(NOT_ALLOWED_REASON.signUp).toMatch(/Google/);
  });
});
