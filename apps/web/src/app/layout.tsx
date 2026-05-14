import "./styles.css";

export const metadata = {
  title: "Daily Newsletter",
  description: "Human-in-the-loop AI newsletter production dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
