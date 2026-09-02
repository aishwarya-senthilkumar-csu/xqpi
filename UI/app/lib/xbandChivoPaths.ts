import path from 'path';

// This is the internal code flag that routes requests to the radar image API loader
export const XBAND_CHIVO_FILE_PREFIX = 'xband_chivo/';

// This is the actual physical location on the Trinity server where your XQPI images live
export function getChivoXbandPlotsRoot(): string {
    return '/net/trinity/projects/xqpi/PRODUCT_IMAGES';
}
