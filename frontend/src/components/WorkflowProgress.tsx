import { useEffect, useState } from "react";
import { API_BASE } from "../config";

const STEPS = [
  { id: "planner", label: "Planning Research" },
  { id: "researcher", label: "Gathering Data" },
  { id: "analyzer", label: "Analyzing Context" },
  { id: "quality_check", label: "Quality Check" },
  { id: "report_generator", label: "Generating Report" },
  { id: "done", label: "Completed" }
];

export default function WorkflowProgress({ sessionId, onComplete }: { sessionId: string, onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState<string>("planner");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE}/api/sessions/${sessionId}/stream`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.step) {
        setCurrentStep(data.step);
      }
      if (data.status === "completed" || data.status === "failed") {
        eventSource.close();
        onComplete();
        if (data.status === "failed") {
          setError(data.error || "Workflow failed");
        }
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      onComplete();
    };

    return () => eventSource.close();
  }, [sessionId, onComplete]);

  const activeIndex = STEPS.findIndex(s => s.id === currentStep);

  return (
    <div className="glass-panel p-8 max-w-2xl mx-auto mt-12">
      <h3 className="text-xl font-bold mb-6">Workflow Progress</h3>
      
      {error && (
        <div className="bg-red-500/20 text-red-200 p-4 rounded-lg mb-6">
          Error: {error}
        </div>
      )}

      <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
        {STEPS.map((step, index) => {
          const isActive = index === activeIndex;
          const isPast = index < activeIndex || currentStep === "done";
          
          return (
            <div key={step.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow transition-colors duration-300 ${
                isActive ? "bg-primary border-blue-200" : isPast ? "bg-green-500 border-green-200" : "bg-surface border-slate-700"
              }`}>
                {isPast ? "✓" : isActive ? "..." : ""}
              </div>
              
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] glass-panel p-4 rounded-lg shadow">
                <div className={`font-semibold ${isActive ? "text-primary" : isPast ? "text-green-400" : "text-secondary"}`}>
                  {step.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
