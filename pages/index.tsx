import { useAnalytics } from "../hooks/useAnalytics";

export default function Home() {
  // Initialize page-level analytics
  useAnalytics({ pageType: "home" });

  return (
    <div className="flex items-center justify-center bg-gradient-to-br from-purple-300 via-purple-200 to-purple-400 h-[80vh]">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-gray-900">
          Welcome to NextSpace
        </h1>
      </div>
    </div>
  );
}
