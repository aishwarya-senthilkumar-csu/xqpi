import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const runtime = 'nodejs';

const productNames = new Map([
    ['qpe_15min', '15 MIN ACCUMULATION'],
    ['qpe_1hr', '1 HOUR ACCUMULATION'],
    ['radar_precip_rate', 'PRECIPITATION RATE'],
    ['composite_ref', 'COMPOSITE REFLECTIVITY'],
]);

const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const framePattern = /^[A-Za-z0-9_.-]*?(\d{8})_([01]\d|2[0-3])([0-5]\d)([0-5]\d)?\.png$/;

export async function GET(request: Request) {
    const file = new URL(request.url).searchParams.get('file') ?? '';
    const match = file.match(
        /^(qpe_15min|qpe_1hr|radar_precip_rate|composite_ref)\/images\/(?:(in|mm)\/)?(\d{4})\/(\d{2})\/(\d{2})\/([A-Za-z0-9_.-]+)$/,
    );
    if (!match) return new Response(null, { status: 404 });

    const [, product, unit, year, month, day, name] = match;
    if (product === 'composite_ref' ? Boolean(unit) : !unit) {
        return new Response(null, { status: 404 });
    }

    const date = `${year}-${month}-${day}`;
    const utcDay = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(utcDay.getTime()) || utcDay.toISOString().slice(0, 10) !== date) {
        return new Response(null, { status: 404 });
    }

    const stamp = `${year}${month}${day}`;
    const directory = join('/app/public/products', product, 'images', unit ?? '', year, month, day);

    try {
        if (name === 'details.json') {
            const entries = await readdir(directory, { withFileTypes: true });
            const steps = entries.flatMap((entry) => {
                if (!entry.isFile()) return [];
                const frame = entry.name.match(framePattern);
                if (!frame || frame[1] !== stamp) return [];

                return [{
                    imageName: entry.name,
                    day: weekdays[utcDay.getUTCDay()],
                    date,
                    time: `${frame[2]}:${frame[3]}:${frame[4] ?? '00'}`,
                }];
            });
            steps.sort((a, b) => a.time.localeCompare(b.time));
            return Response.json(
                { product: productNames.get(product), steps },
                { headers: { 'Cache-Control': 'no-store' } },
            );
        }

        if (name.match(framePattern)?.[1] !== stamp) {
            return new Response(null, { status: 404 });
        }

        const image = await readFile(join(directory, name));
        return new Response(new Uint8Array(image), {
            headers: { 'Content-Type': 'image/png' },
        });
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT' || code === 'ENOTDIR') {
            return new Response(null, { status: 404 });
        }
        console.error('XQPI archive read failed:', error);
        return Response.json({ error: 'Could not read archive' }, { status: 500 });
    }
}
