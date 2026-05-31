import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        nusPurple: "#5f16ee",
        nusOrange: "#ff6508",
        ink: "#1f2333",
        mist: "#eef1fb",
      },
      boxShadow: {
        soft: "0 18px 60px rgba(82, 57, 157, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
