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
        return [
            {
                source: '/products/:path*',
                destination: '/api/xbandRadarImages?file=:path*',
            },
        ];
    },
};

export default nextConfig;