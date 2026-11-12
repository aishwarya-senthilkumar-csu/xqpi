/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    env: {
        XBAND_CHIVO_PLOTS_ROOT: "Z:\\xqpi\\PRODUCT_IMAGES",
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    async rewrites() {
        return {
            beforeFiles: [
                {
                    source: '/products/:product(qpe_15min|qpe_1hr|radar_precip_rate|composite_ref)/:asset*',
                    destination: '/api/productArchive/:product/:asset*',
                },
            ],
            afterFiles: [
                {
                    source: '/products/:path*',
                    destination: '/api/xbandRadarImages?file=:path*',
                },
            ],
            fallback: [],
        };
    },
};

export default nextConfig;