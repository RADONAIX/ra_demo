/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't 308-redirect trailing slashes — the Airflow proxy must forward paths verbatim
  // (Airflow uses paths like /login/ that must keep their trailing slash).
  skipTrailingSlashRedirect: true,
  // node-ssh is node-only; keep it external to the server bundle.
  experimental: {
    serverComponentsExternalPackages: ["node-ssh"],
  },
};

export default nextConfig;
