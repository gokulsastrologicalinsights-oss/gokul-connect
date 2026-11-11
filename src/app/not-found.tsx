import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 text-gray-900">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow border border-gray-200 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">404</h1>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Page Not Found</h2>
        <p className="text-sm text-gray-500 mb-6">
          The requested page could not be found or you may not have access to it.
        </p>
        <Link
          href="/select-business"
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
        >
          Return to Business Selection
        </Link>
      </div>
    </div>
  );
}
