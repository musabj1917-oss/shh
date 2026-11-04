import app from '../../../../api/src/app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handler(req: Request) {
  return app.fetch(req);
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as OPTIONS,
  handler as HEAD,
};
