"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  ChevronDown,
  MapPin,
  Landmark,
  ArrowLeft,
} from "lucide-react";
import { Toaster, toast } from "sonner";

const COUNTRIES = [
  "United States",
  "Canada",
  "United Kingdom",
  "Ireland",
  "Australia",
  "New Zealand",
  "Netherlands",
  "Germany",
  "France",
  "Spain",
  "Other",
];

const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
  "District of Columbia",
];

interface Campaign {
  id: string;
  name: string;
  industry: string;
  call_type: string;
  payout: string;
  payout_display: string | null;
  payout_type: string;
}

function ApplyPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(
    new Set()
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [statusToken, setStatusToken] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    website: "",
    estimated_volume: "",
    experience: "",
    company_address: "",
    company_country: "United States",
    company_state: "",
    entity_type: "",
    referred_by: "",
    comments: "",
    tcpa_agreed: false,
    terms_agreed: false,
  });

  useEffect(() => {
    fetch("/api/campaigns")
      .then((res) => res.json())
      .then((data) => {
        setCampaigns(data.campaigns || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const campaignIds = searchParams?.get?.("campaigns") ?? "";
    if (campaignIds) {
      const ids = campaignIds.split(",").filter(Boolean);
      setSelectedCampaigns(new Set(ids));
    }
  }, [searchParams]);

  const toggleCampaign = (id: string) => {
    setSelectedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const isUS = form.company_country === "United States";

  const handleCountryChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      company_country: value,
      company_state: "",
      entity_type: "",
    }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (selectedCampaigns.size === 0)
      errs.campaigns = "Select at least one campaign";
    if (!form.company_name?.trim()) errs.company_name = "Company name required";
    if (!form.contact_name?.trim()) errs.contact_name = "Contact name required";
    if (
      !form.email?.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
    )
      errs.email = "Valid email required";
    if (!form.phone?.trim()) errs.phone = "Phone number required";
    if (!form.estimated_volume) errs.estimated_volume = "Volume required";
    if (!form.company_address?.trim())
      errs.company_address = "Company address required";
    if (!form.company_country?.trim()) errs.company_country = "Country required";
    if (!form.company_state?.trim())
      errs.company_state = isUS
        ? "State required"
        : "State/province required";
    if (!form.entity_type?.trim()) errs.entity_type = "Entity type required";
    if (!form.tcpa_agreed) errs.tcpa_agreed = "TCPA agreement required";
    if (!form.terms_agreed) errs.terms_agreed = "Terms agreement required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please fix the errors below");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          campaign_ids: Array.from(selectedCampaigns),
        }),
      });
      const data = await res.json();
      if (data?.success) {
        setSubmitted(true);
        setStatusToken(data.status_token || "");
        toast.success("Application submitted!");
      } else {
        toast.error(data?.error || "Failed to submit");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f3ee]">
        <Loader2 className="h-8 w-8 animate-spin text-[#8b5a2b]" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f6f3ee] py-16 px-4">
        <Toaster position="top-center" />
        <div className="max-w-lg mx-auto text-center">
          <div className="bg-white rounded-2xl border border-[#d4c4a8] p-8 shadow-sm">
            <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h1 className="font-sans text-2xl font-bold text-[#1a1a1a]">
              Application Submitted!
            </h1>
            <p className="mt-3 text-gray-600">
              Your application has been received and is being reviewed.
            </p>
            <div className="mt-6 bg-[#f6f3ee] border border-[#d4c4a8] rounded-lg p-4 inline-block">
              <p className="text-sm text-gray-500">Your Status Token</p>
              <p className="font-mono text-lg font-bold text-[#8b5a2b] mt-1">
                {statusToken}
              </p>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              Save this token to check your status anytime.
            </p>
            <div className="mt-6 flex gap-3 justify-center">
              <Link
                href={`/status?token=${statusToken}`}
                className="rounded-lg bg-[#8b5a2b] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#6d4722] transition-colors"
              >
                Check Status
              </Link>
              <Link
                href="/"
                className="rounded-lg border border-[#d4c4a8] px-6 py-2.5 text-sm font-semibold text-[#1a1a1a] hover:bg-[#f6f3ee] transition-colors"
              >
                Back Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f3ee]">
      <Toaster position="top-center" />
      <div className="max-w-[800px] mx-auto px-4 py-8 sm:py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-[#8b5a2b] mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>

        <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-[#1a1a1a]">
          Vendor Application
        </h1>
        <p className="mt-2 text-gray-600">
          Complete the form below to apply. Fields marked with * are required.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-8">
          {/* Campaign Selection */}
          <div className="bg-white rounded-xl border border-[#d4c4a8] p-6">
            <h3 className="font-semibold text-[#1a1a1a] mb-3">
              Select Campaigns *
            </h3>
            {errors.campaigns && (
              <p className="text-sm text-red-600 mb-2 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {errors.campaigns}
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {campaigns.map((c) => {
                const isSelected = selectedCampaigns.has(c.id);
                return (
                  <div
                    key={c.id}
                    onClick={() => toggleCampaign(c.id)}
                    className={cn(
                      "cursor-pointer rounded-lg border-2 p-3 transition-all text-sm",
                      isSelected
                        ? "border-[#8b5a2b] bg-[#f6f3ee]"
                        : "border-gray-200 hover:border-[#d4c4a8]"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "h-4 w-4 rounded border-2 flex items-center justify-center shrink-0",
                          isSelected
                            ? "border-[#8b5a2b] bg-[#8b5a2b]"
                            : "border-gray-300"
                        )}
                      >
                        {isSelected && (
                          <CheckCircle2 className="h-3 w-3 text-white" />
                        )}
                      </div>
                      <span className="font-medium text-[#1a1a1a]">
                        {c.name}
                      </span>
                      <span className="text-xs text-[#8b5a2b] ml-auto">
                        {c.name.toLowerCase().includes("rtb")
                          ? "Variable"
                          : c.payout_display || `$${c.payout}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Company Information */}
          <div className="bg-white rounded-xl border border-[#d4c4a8] p-6 space-y-4">
            <h3 className="font-semibold text-[#1a1a1a]">
              Company Information
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name *
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={form.company_name}
                    onChange={(e) =>
                      updateField("company_name", e.target.value)
                    }
                    className={cn(
                      "w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5a2b]",
                      errors.company_name ? "border-red-300" : "border-gray-200"
                    )}
                    placeholder="Your company name"
                  />
                </div>
                {errors.company_name && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.company_name}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={form.contact_name}
                    onChange={(e) =>
                      updateField("contact_name", e.target.value)
                    }
                    className={cn(
                      "w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5a2b]",
                      errors.contact_name ? "border-red-300" : "border-gray-200"
                    )}
                    placeholder="Primary contact name"
                  />
                </div>
                {errors.contact_name && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.contact_name}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    className={cn(
                      "w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5a2b]",
                      errors.email ? "border-red-300" : "border-gray-200"
                    )}
                    placeholder="contact@company.com"
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-600 mt-1">{errors.email}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    className={cn(
                      "w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5a2b]",
                      errors.phone ? "border-red-300" : "border-gray-200"
                    )}
                    placeholder="(555) 123-4567"
                  />
                </div>
                {errors.phone && (
                  <p className="text-xs text-red-600 mt-1">{errors.phone}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="url"
                    value={form.website}
                    onChange={(e) => updateField("website", e.target.value)}
                    className="w-full rounded-lg border border-gray-200 pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5a2b]"
                    placeholder="https://yourcompany.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Call Volume/Day *
                </label>
                <div className="relative">
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <select
                    value={form.estimated_volume}
                    onChange={(e) =>
                      updateField("estimated_volume", e.target.value)
                    }
                    className={cn(
                      "w-full rounded-lg border px-3 py-2.5 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#8b5a2b] bg-white",
                      errors.estimated_volume
                        ? "border-red-300"
                        : "border-gray-200"
                    )}
                  >
                    <option value="">Select volume...</option>
                    <option value="5-10">5-10 calls/day</option>
                    <option value="15-50">15-50 calls/day</option>
                    <option value="50-100">50-100 calls/day</option>
                    <option value="100+">100+ calls/day</option>
                  </select>
                </div>
                {errors.estimated_volume && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.estimated_volume}
                  </p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Address *
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={form.company_address}
                  onChange={(e) =>
                    updateField("company_address", e.target.value)
                  }
                  className={cn(
                    "w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5a2b]",
                    errors.company_address ? "border-red-300" : "border-gray-200"
                  )}
                  placeholder="123 Main St, Suite 200, City, ST 12345"
                />
              </div>
              {errors.company_address && (
                <p className="text-xs text-red-600 mt-1">
                  {errors.company_address}
                </p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country *
                </label>
                <div className="relative">
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <select
                    value={form.company_country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2.5 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#8b5a2b] bg-white",
                      errors.company_country
                        ? "border-red-300"
                        : "border-gray-200"
                    )}
                  >
                    <option value="">Select country...</option>
                    {COUNTRIES.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.company_country && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.company_country}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isUS ? "Company State *" : "State / Province *"}
                </label>
                {isUS ? (
                  <div className="relative">
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <select
                      value={form.company_state}
                      onChange={(e) =>
                        updateField("company_state", e.target.value)
                      }
                      className={cn(
                        "w-full rounded-lg border px-3 py-2.5 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#8b5a2b] bg-white",
                        errors.company_state
                          ? "border-red-300"
                          : "border-gray-200"
                      )}
                    >
                      <option value="">Select state...</option>
                      {US_STATES.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={form.company_state}
                    onChange={(e) =>
                      updateField("company_state", e.target.value)
                    }
                    className={cn(
                      "w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5a2b]",
                      errors.company_state ? "border-red-300" : "border-gray-200"
                    )}
                    placeholder="Province / region"
                  />
                )}
                {errors.company_state && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.company_state}
                  </p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Entity Type *
              </label>
              {isUS ? (
                <div className="relative">
                  <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <select
                    value={form.entity_type}
                    onChange={(e) => updateField("entity_type", e.target.value)}
                    className={cn(
                      "w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#8b5a2b] bg-white",
                      errors.entity_type ? "border-red-300" : "border-gray-200"
                    )}
                  >
                    <option value="">Select entity type...</option>
                    <option value="LLC">LLC</option>
                    <option value="Corporation">Corporation</option>
                    <option value="Sole Proprietorship">
                      Sole Proprietorship
                    </option>
                    <option value="Partnership">Partnership</option>
                    <option value="LLP">LLP</option>
                  </select>
                </div>
              ) : (
                <div className="relative">
                  <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={form.entity_type}
                    onChange={(e) => updateField("entity_type", e.target.value)}
                    className={cn(
                      "w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5a2b]",
                      errors.entity_type ? "border-red-300" : "border-gray-200"
                    )}
                    placeholder="e.g. B.V., GmbH, Ltd"
                  />
                </div>
              )}
              {errors.entity_type && (
                <p className="text-xs text-red-600 mt-1">
                  {errors.entity_type}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Experience / Background
              </label>
              <textarea
                value={form.experience}
                onChange={(e) => updateField("experience", e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5a2b]"
                placeholder="Brief description of your experience..."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Referred By
                </label>
                <input
                  type="text"
                  value={form.referred_by}
                  onChange={(e) => updateField("referred_by", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5a2b]"
                  placeholder="Who referred you?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Comments
                </label>
                <input
                  type="text"
                  value={form.comments}
                  onChange={(e) => updateField("comments", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5a2b]"
                  placeholder="Anything else?"
                />
              </div>
            </div>
          </div>

          {/* Compliance */}
          <div className="bg-white rounded-xl border border-[#d4c4a8] p-6 space-y-3">
            <h3 className="font-semibold text-[#1a1a1a]">
              Compliance Agreements
            </h3>
            <div
              className={cn(
                "flex items-start gap-3 rounded-lg border p-4",
                errors.tcpa_agreed
                  ? "border-red-300 bg-red-50"
                  : "border-gray-200"
              )}
            >
              <input
                type="checkbox"
                checked={form.tcpa_agreed}
                onChange={(e) => updateField("tcpa_agreed", e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#8b5a2b] focus:ring-[#8b5a2b]"
              />
              <div>
                <p className="text-sm font-medium text-[#1a1a1a]">
                  TCPA Compliance *
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  I agree to comply with all TCPA regulations, FCC guidelines,
                  and applicable laws.
                </p>
              </div>
            </div>
            {errors.tcpa_agreed && (
              <p className="text-xs text-red-600">{errors.tcpa_agreed}</p>
            )}
            <div
              className={cn(
                "flex items-start gap-3 rounded-lg border p-4",
                errors.terms_agreed
                  ? "border-red-300 bg-red-50"
                  : "border-gray-200"
              )}
            >
              <input
                type="checkbox"
                checked={form.terms_agreed}
                onChange={(e) => updateField("terms_agreed", e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#8b5a2b] focus:ring-[#8b5a2b]"
              />
              <div>
                <p className="text-sm font-medium text-[#1a1a1a]">
                  Terms & Conditions *
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  I acknowledge all information is accurate and agree to
                  GrovLabs Inc&apos;s vendor terms.
                </p>
              </div>
            </div>
            {errors.terms_agreed && (
              <p className="text-xs text-red-600">{errors.terms_agreed}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[#8b5a2b] px-6 py-3 text-sm font-semibold text-white hover:bg-[#6d4722] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
              </>
            ) : (
              "Submit Application"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ApplyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f6f3ee]">
        <Loader2 className="h-8 w-8 animate-spin text-[#8b5a2b]" />
      </div>
    }>
      <ApplyPageContent />
    </Suspense>
  );
}
