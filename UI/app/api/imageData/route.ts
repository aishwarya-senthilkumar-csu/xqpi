import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getChivoXbandPlotsRoot, XBAND_CHIVO_FILE_PREFIX } from '@/app/lib/xbandChivoPaths';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const imageFileName = searchParams.get('file');
  if (!imageFileName) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  let filePath: string;
  if (imageFileName.startsWith(XBAND_CHIVO_FILE_PREFIX)) {
    const rel = imageFileName.slice(XBAND_CHIVO_FILE_PREFIX.length);
    if (rel.includes('..') || path.isAbsolute(rel)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }
    filePath = path.join(getChivoXbandPlotsRoot(), ...rel.split('/'));
  } else {
    filePath = path.join(process.cwd(), 'products', imageFileName);
  }

  try {
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    const stat = fs.statSync(filePath);
    const etag = `"${stat.mtimeMs}"`;
    const imageBuffer = fs.readFileSync(filePath);
    const imageExtension = path.extname(filePath).slice(1);
    return new Response(imageBuffer, {
      headers: {
        'Content-Type': `image/${imageExtension}`,
        ETag: etag,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error reading image file:', error);
    return NextResponse.json({ error: 'Failed to load image' }, { status: 500 });
  }
}
