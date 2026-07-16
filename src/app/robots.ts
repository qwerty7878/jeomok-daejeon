import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jeomok-daejeon.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/hall-of-fame", "/credits", "/privacy", "/about", "/contact"],
        disallow: ["/room/", "/join/", "/admin", "/api/"],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
