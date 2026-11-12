import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GET as getArchive } from '../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: { asset: string[] } },
) {
    const { asset } = await params;
    const file = asset.join('/');

    const liveJson = /^(?:(qpe_15min|qpe_1hr|radar_precip_rate)\/details_(in|mm)|composite_ref\/details)\.json$/.test(file);
    const livePng = /^(?:(qpe_15min|qpe_1hr|radar_precip_rate)\/images\/(in|mm)|composite_ref\/images)\/[A-Za-z0-9_.-]+\.png$/.test(file);

    if (liveJson || livePng) {
        try {
            const content = await readFile(join('/app/public/products', file));
            return new Response(new Uint8Array(content), {
                headers: {
                    'Content-Type': liveJson ? 'application/json' : 'image/png',
                    'Cache-Control': 'no-store',
                },
            });
        } catch (error) {
            const code = (error as NodeJS.ErrnoException).code;
            if (code === 'ENOENT' || code === 'ENOTDIR') {
                return new Response(null, { status: 404 });
            }
            console.error('XQPI live product read failed:', error);
            return Response.json({ error: 'Could not read live product' }, { status: 500 });
        }
    }

    const url = new URL(request.url);
    url.searchParams.set('file', file);
    return getArchive(new Request(url));
}
