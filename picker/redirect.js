import { broadcastResponseToMainFrame } from "@azure/msal-browser/redirect-bridge";

// The supported SDK owns response validation/transport; never log auth responses.
broadcastResponseToMainFrame().catch(() => {
  document.getElementById("redirect-status").textContent = "Sign-in did not complete. Close this window and return to the picker to try again.";
});