import { broadcastResponseToMainFrame } from '@azure/msal-browser/redirect-bridge';

broadcastResponseToMainFrame().catch((error) => {
  console.error('Microsoft authentication redirect bridge failed', error);
});
