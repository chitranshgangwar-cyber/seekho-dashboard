/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // ensure dashboard/index.html is traced into the /dashboard serverless function
    outputFileTracingIncludes: { "/dashboard": ["./dashboard/**"] },
  },
};
export default nextConfig;
