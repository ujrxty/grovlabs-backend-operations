"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type ApplicationStatus = {
  campaign: string;
  industry: string;
  status: "pending" | "approved" | "rejected";
  status_reason?: string;
  reviewed_at?: string;
};

type StatusResponse = {
  success: boolean;
  error?: string;
  company_name?: string;
  contact_name?: string;
  submitted_at?: string;
  applications?: ApplicationStatus[];
  io?: {
    io_number: string;
    status: string;
    sign_token: string;
    vendor_signed_at?: string;
    counter_signed_at?: string;
  };
  agreement?: {
    status: string;
    sign_token: string;
    vendor_signed_at?: string;
    counter_signed_at?: string;
  };
};

export default function StatusPage() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState("");

  const checkStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;

    setLoading(true);
    setError("");
    setData(null);

    try {
      const res = await fetch(`/api/status?token=${encodeURIComponent(token.trim())}`);
      const result = await res.json();

      if (!result.success) {
        setError(result.error || "Failed to check status");
      } else {
        setData(result);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
      approved: "bg-green-100 text-green-800 border-green-300",
      rejected: "bg-red-100 text-red-800 border-red-300",
      pending_vendor: "bg-blue-100 text-blue-800 border-blue-300",
      pending_counter: "bg-purple-100 text-purple-800 border-purple-300",
      active: "bg-green-100 text-green-800 border-green-300",
    };
    return styles[status] || "bg-gray-100 text-gray-800 border-gray-300";
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Application Status
          </h1>
          <p className="text-gray-600">
            Enter your status token to check your application progress
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={checkStatus}
          className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6"
        >
          <div className="flex gap-3">
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter your status token"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8b5a2b] focus:border-[#8b5a2b] outline-none transition-all font-mono"
            />
            <button
              type="submit"
              disabled={loading || !token.trim()}
              className="px-6 py-3 bg-[#8b5a2b] text-white font-semibold rounded-lg hover:bg-[#6d4422] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? "Checking..." : "Check Status"}
            </button>
          </div>
        </motion.form>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700"
            >
              {error}
            </motion.div>
          )}

          {data && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Company Information
                </h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Company</span>
                    <p className="font-medium text-gray-900">{data.company_name}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Contact</span>
                    <p className="font-medium text-gray-900">{data.contact_name}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Submitted</span>
                    <p className="font-medium text-gray-900">
                      {data.submitted_at
                        ? new Date(data.submitted_at).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Campaign Applications
                </h2>
                <div className="space-y-3">
                  {data.applications?.map((app, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{app.campaign}</p>
                        <p className="text-sm text-gray-500">{app.industry}</p>
                        {app.status === "rejected" && app.status_reason && (
                          <p className="text-sm text-red-600 mt-1">
                            Reason: {app.status_reason}
                          </p>
                        )}
                      </div>
                      <span
                        className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusBadge(
                          app.status
                        )}`}
                      >
                        {formatStatus(app.status)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {data.io && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Insertion Order
                  </h2>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">IO Number</span>
                      <span className="font-mono font-medium">{data.io.io_number}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Status</span>
                      <span
                        className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusBadge(
                          data.io.status
                        )}`}
                      >
                        {formatStatus(data.io.status)}
                      </span>
                    </div>
                    {data.io.status === "pending_vendor" && (
                      <a
                        href={`/sign-io/${data.io.sign_token}`}
                        className="block w-full text-center py-3 bg-[#8b5a2b] text-white font-semibold rounded-lg hover:bg-[#6d4422] transition-all mt-4"
                      >
                        Sign Insertion Order
                      </a>
                    )}
                    {data.io.status === "pending_counter" && (
                      <p className="text-sm text-purple-600 bg-purple-50 p-3 rounded-lg">
                        Your signature has been received. Awaiting counter-signature from The Broken Wood Inc.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {data.agreement && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Lead Purchase Agreement
                  </h2>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Status</span>
                      <span
                        className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusBadge(
                          data.agreement.status
                        )}`}
                      >
                        {formatStatus(data.agreement.status)}
                      </span>
                    </div>
                    {data.agreement.status === "pending_vendor" && (
                      <a
                        href={`/sign-agreement/${data.agreement.sign_token}`}
                        className="block w-full text-center py-3 bg-[#8b5a2b] text-white font-semibold rounded-lg hover:bg-[#6d4422] transition-all mt-4"
                      >
                        Sign Lead Purchase Agreement
                      </a>
                    )}
                    {data.agreement.status === "pending_counter" && (
                      <p className="text-sm text-purple-600 bg-purple-50 p-3 rounded-lg">
                        Your signature has been received. Awaiting counter-signature from The Broken Wood Inc.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
