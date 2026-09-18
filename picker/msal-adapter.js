import { PublicClientApplication } from "@azure/msal-browser";

export async function authFactory(configuration) {
  const app = new PublicClientApplication(configuration);
  await app.initialize();
  return { login:request => app.loginPopup(request), current:() => app.getActiveAccount(),
    activate:account => app.setActiveAccount(account),
    clear:async () => { app.setActiveAccount(null); await app.clearCache(); } };
}