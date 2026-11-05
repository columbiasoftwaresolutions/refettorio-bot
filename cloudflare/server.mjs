import { httpServerHandler } from 'cloudflare:node';
import checkinHtml from '../checkin.html';

let serverReady;

// Credential-free uploads must start successfully. Initialize the Express app
// only inside a configured request, after Workers provides its secret bindings.
export async function serve(request, env, ctx) {
  if (!env.GOOGLE_SHEETS_ID || !env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return Response.json({ ok: false, error: 'Google Sheets is not configured' }, { status: 503 });
  }
  if (!serverReady) {
    serverReady = import('../index.js').then(({ default: app }) => {
      app.locals.checkinHtml = checkinHtml;
      app.listen(3000);
      return httpServerHandler({ port: 3000 });
    });
  }
  const server = await serverReady;
  return server.fetch(request, env, ctx);
}
