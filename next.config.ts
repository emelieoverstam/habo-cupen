import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Spelarbilder serveras från Supabase Storage
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fppvfjhzyzfjjvognayj.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
