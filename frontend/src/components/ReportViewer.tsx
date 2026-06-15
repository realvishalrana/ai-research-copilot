function formatValue(value: unknown): string {
  if (value == null || value === "") return "No data available.";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map((item) => formatValue(item)).join("\n");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => `${key.replace(/_/g, " ")}: ${formatValue(val)}`)
      .join("\n");
  }
  return String(value);
}

function formatListItem(value: unknown): string {
  if (typeof value === "string") return value;
  return formatValue(value);
}

function formatSource(value: unknown): string {
  const text = formatListItem(value);
  if (text.startsWith("http://") || text.startsWith("https://")) {
    return text;
  }
  const match = text.match(/https?:\/\/\S+/);
  return match ? match[0] : text;
}

export default function ReportViewer({ data }: { data: any }) {
  if (!data) return null;

  const sections = [
    { title: "Company Overview", key: "company_overview" },
    { title: "Products & Services", key: "products_and_services" },
    { title: "Target Customers", key: "target_customers" },
    { title: "Business Signals", key: "business_signals" },
    { title: "Risks & Challenges", key: "risks_and_challenges" },
    { title: "Unknowns", key: "unknowns" },
    { title: "Suggested Outreach Strategy", key: "suggested_outreach_strategy" }
  ];

  const questions = Array.isArray(data.suggested_discovery_questions)
    ? data.suggested_discovery_questions
    : [];
  const sources = Array.isArray(data.sources) ? data.sources : [];

  return (
    <div className="glass-panel p-8 max-w-4xl mx-auto mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-3xl font-bold mb-8 text-primary">Research Briefing</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map(sec => (
          <div key={sec.key} className="bg-surface/50 p-6 rounded-xl border border-white/5">
            <h4 className="text-lg font-semibold text-blue-300 mb-3">{sec.title}</h4>
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
              {formatValue(data[sec.key])}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-surface/50 p-6 rounded-xl border border-white/5">
        <h4 className="text-lg font-semibold text-blue-300 mb-3">Suggested Discovery Questions</h4>
        <ul className="list-disc list-inside text-gray-300 space-y-2 text-sm">
          {questions.length > 0 ? (
            questions.map((q: unknown, i: number) => (
              <li key={i}>{formatListItem(q)}</li>
            ))
          ) : (
            <li>No discovery questions available.</li>
          )}
        </ul>
      </div>

      <div className="mt-6 bg-surface/50 p-6 rounded-xl border border-white/5">
        <h4 className="text-lg font-semibold text-blue-300 mb-3">Sources</h4>
        <ul className="list-disc list-inside text-gray-300 space-y-1 text-sm">
          {sources.length > 0 ? (
            sources.map((s: unknown, i: number) => {
              const source = formatSource(s);
              const isLink = source.startsWith("http://") || source.startsWith("https://");
              return (
                <li key={i} className="truncate">
                  {isLink ? (
                    <a href={source} className="text-blue-400 hover:underline" target="_blank" rel="noreferrer">
                      {source}
                    </a>
                  ) : (
                    source
                  )}
                </li>
              );
            })
          ) : (
            <li>No sources provided.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
