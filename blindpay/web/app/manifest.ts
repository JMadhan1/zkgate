import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BlindPay",
    short_name: "BlindPay",
    description: "Approve your team's spend on WhatsApp, pay by UPI, keep the GST.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f0e7",
    theme_color: "#111111",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
