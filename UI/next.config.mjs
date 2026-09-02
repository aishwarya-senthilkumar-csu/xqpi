/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    env: {
        // Double backslashes are required here to escape the path in JavaScript
        XBAND_CHIVO_PLOTS_ROOT: "Z:\\xqpi\\PRODUCT_IMAGES",
    },
    typescript: {
	ignoreBuildErrors: true,
    },
    eslint: {
	ignoreDuringBuilds: true,
    },
};

export default nextConfig;
