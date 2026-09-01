import { notFound } from "next/navigation";

// Production guard: isolated components should only be accessible in development.
// In production, this layout returns a 404 to prevent exposing test routes.
export default function IsolatedComponentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
}
