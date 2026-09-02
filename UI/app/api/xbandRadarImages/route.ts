import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getChivoXbandPlotsRoot, XBAND_CHIVO_FILE_PREFIX } from '@/app/lib/xbandChivoPaths';

type RadarMeta = {
  timestamp: string; // YYYYMMDD-HHMM (interpreted as UTC)
  date: string;
  day: string;
  time: string;
};

function parseTimestampUTC(ts: string): RadarMeta | null {
  // Matches the 6-digit timestamp layout securely (HHMMSS)
  // Change BOTH parseTimestampUTC and timestampToUtcMs match strings to look for 6 digits at the end:
  const m = ts.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/);
  if (!m) return null;
  
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  const dayOfMonth = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6]);

  const d = new Date(Date.UTC(year, monthIndex, dayOfMonth, hour, minute, second));
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
  const date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
  
  // Adds seconds to your UI status cards so they accurately track the 2-minute updates
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;

  return { timestamp: ts, date, day: weekday, time };
}

function timestampToUtcMs(ts: string): number | null {
  // Change BOTH parseTimestampUTC and timestampToUtcMs match strings to look for 6 digits at the end:
  const m = ts.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/);
  if (!m) return null;
  
  return Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6]),
    0
  );
}

function utcDaysBetween(start: Date, end: Date): string[] {
  const days: string[] = [];
  const cur = new Date(start);
  cur.setUTCHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setUTCHours(0, 0, 0, 0);
  while (cur.getTime() <= endDay.getTime()) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cur.getUTCDate()).padStart(2, '0');
    days.push(`${y}/${m}/${d}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

type Match = { filename: string; timestamp: string; relPathFromChivoRoot: string };

function collectFromHierarchy(
  radarFolder: string,
  productPrefix: string,
  windowStartMs: number,
  windowEndMs: number
): Match[] {
  const chivoRoot = getChivoXbandPlotsRoot(); // Points directly to /xqpi/PRODUCT_IMAGES/
  const radarUpper = radarFolder.toUpperCase();
  const prefix = `${radarUpper}_${productPrefix}_`;
  const start = new Date(windowStartMs);
  const end = new Date(windowEndMs);
  const dayPaths = utcDaysBetween(start, end);
  const out: Match[] = [];

  for (const relDay of dayPaths) {
    // UPDATED FOLDER ROUTING ENGINE: Maps layout to YYYY/MM/DD/FLOW/
    // NEW LINE (Allows separate product folders):
    const dayDir = path.join(chivoRoot, ...relDay.split('/'), radarUpper, productPrefix);
    let fileNames: string[] = [];
    try {
      fileNames = fs.readdirSync(dayDir);
    } catch {
      continue;
    }
    for (const f of fileNames) {
      if (!f.startsWith(prefix) || !f.endsWith('.png') || f.includes('_colorbar')) continue;
      
      // OLD WAY: f.slice(prefix.length, -'.png'.length); -> Left over "_3.5_20260412-000140" which broke parsing

      // NEW WAY: Uses a Regex pattern to pull exactly the 15-character timestamp wherever it lives
      const matchResult = f.match(/(\d{4}\d{2}\d{2}-\d{2}\d{2}\d{2})/);
      if (!matchResult) continue;
      
      const tsPart = matchResult[1]; // Safely isolates: "20260412-000140"
      const tsMs = timestampToUtcMs(tsPart);
      
      if (tsMs === null) continue;
      if (tsMs < windowStartMs || tsMs > windowEndMs) continue;
      
      // Appends productPrefix to the relative path so the frontend receives the full folder destination route
      const relPathFromChivoRoot = [...relDay.split('/'), radarUpper, productPrefix, f].join('/');
      out.push({ filename: f, timestamp: tsPart, relPathFromChivoRoot });
    }
  }

  out.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return out;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const radarFolder = searchParams.get('radarFolder');
  const productPrefix = searchParams.get('productPrefix');

  if (!radarFolder || !productPrefix) {
    return NextResponse.json({ error: 'Missing radarFolder or productPrefix' }, { status: 400 });
  }

  const testStart = searchParams.get('testStart');
  const testEnd = searchParams.get('testEnd');

  let windowStartMs: number;
  let windowEndMs: number;
  let windowStart: Date;
  let windowEnd: Date;

  if (testStart && testEnd) {
    const s = timestampToUtcMs(testStart);
    const e = timestampToUtcMs(testEnd);
    if (s === null || e === null) {
      return NextResponse.json(
        { error: 'Invalid testStart or testEnd (expected YYYYMMDD-HHMM, UTC)' },
        { status: 400 }
      );
    }
    windowStartMs = s;
    windowEndMs = e;
    windowStart = new Date(windowStartMs);
    windowEnd = new Date(windowEndMs);
  } else {
    // If no window is defined, look back over the last 24 hours to ensure we pick up files
    windowEndMs = Date.now();
    windowStartMs = windowEndMs - 24 * 60 * 60 * 1000;
    windowStart = new Date(windowStartMs);
    windowEnd = new Date(windowEndMs);
  }

  const matching = collectFromHierarchy(radarFolder, productPrefix, windowStartMs, windowEndMs);

  const images = matching.map(
    (x) => `${XBAND_CHIVO_FILE_PREFIX}${x.relPathFromChivoRoot.replace(/\\/g, '/')}`
  );

  const meta: RadarMeta[] = matching
    .map((x) => parseTimestampUTC(x.timestamp))
    .filter((v): v is RadarMeta => v !== null);

  return NextResponse.json({
    images,
    meta,
    timezone: 'UTC',
    plotsRoot: getChivoXbandPlotsRoot(),
    windowStartUtc: windowStart.toISOString(),
    windowEndUtc: windowEnd.toISOString(),
  });
}