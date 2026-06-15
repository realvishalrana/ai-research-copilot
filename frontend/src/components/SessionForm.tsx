import { useState } from "react";

export default function SessionForm({ onSubmit, isLoading }: { onSubmit: (data: any) => void, isLoading: boolean }) {
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [objective, setObjective] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ company_name: companyName, website: website || undefined, objective });
  };

  return (
    <div className="glass-panel p-8 max-w-2xl mx-auto mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-bold mb-6">Create Research Session</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-secondary mb-1">Company Name *</label>
          <input
            type="text"
            required
            className="w-full bg-surface border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. OpenAI"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1">Website URL (Optional)</label>
          <input
            type="text"
            className="w-full bg-surface border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="stripe.com or https://..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1">Meeting Objective *</label>
          <textarea
            required
            rows={3}
            className="w-full bg-surface border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="e.g. To pitch our enterprise AI security platform"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary hover:bg-blue-600 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
        >
          {isLoading ? "Starting Session..." : "Start Research"}
        </button>
      </form>
    </div>
  );
}
