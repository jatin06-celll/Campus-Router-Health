import React, { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { AlertCircle, Activity, WifiOff, Cpu, ChevronRight, Zap } from "lucide-react";

// ─── COPILOT COMPONENT ──────────────────────────────────────────────
function Copilot({ routerId }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Reset when router changes
  useEffect(() => {
    setResult(null);
    setError(null);
  }, [routerId]);

  const diagnose = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:5000/api/copilot/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ router_id: routerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unknown error");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const FIX_STYLES = {
    replace: { bg: "bg-red-500/20 border-red-500/40 text-red-400", icon: "🔴", label: "Replace Hardware" },
    relocate: { bg: "bg-orange-500/20 border-orange-500/40 text-orange-400", icon: "🟠", label: "Relocate Router" },
    "firmware update": { bg: "bg-yellow-500/20 border-yellow-500/40 text-yellow-400", icon: "🟡", label: "Firmware Update" },
    "user education": { bg: "bg-blue-500/20 border-blue-500/40 text-blue-400", icon: "🔵", label: "User Education" },
  };

  const fixStyle = result ? FIX_STYLES[result.recommendedFix] || FIX_STYLES["user education"] : null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Zap className="w-5 h-5 text-purple-400" /> AI Diagnostic Copilot
        </h3>
        <button
          onClick={diagnose}
          disabled={loading}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors"
        >
          {loading ? "Analyzing..." : "Run Diagnosis"}
        </button>
      </div>

      {error && <div className="text-red-400 text-sm p-3 bg-red-900/20 rounded-lg">{error}</div>}

      {result && (
        <div className="space-y-4 mt-4 animate-fade-in">
          <div className={`border rounded-xl p-4 ${fixStyle.bg}`}>
            <p className="text-xs uppercase tracking-widest opacity-80 mb-1">Recommended Action</p>
            <p className="text-xl font-bold flex items-center gap-2">
              {fixStyle.icon} {fixStyle.label}
            </p>
            {result._fallback && (
              <p className="text-xs text-yellow-500 mt-2">⚠️ Fallback mode — API quota exceeded</p>
            )}
          </div>
          
          <div className="bg-gray-950 p-4 rounded-xl border border-gray-800">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Root Cause</p>
            <p className="text-gray-200 text-sm">{result.cause}</p>
          </div>

          <div className="bg-gray-950 p-4 rounded-xl border border-gray-800">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Evidence</p>
            <ul className="space-y-1">
              {result.evidence.map((item, i) => (
                <li key={i} className="text-gray-300 text-sm flex gap-2">
                  <span className="text-purple-400">→</span> {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {!result && !loading && !error && (
        <p className="text-sm text-gray-500 text-center py-6">Click Run Diagnosis to analyze 24h telemetry and tickets.</p>
      )}
    </div>
  );
}

// ─── ROUTER DETAILS COMPONENT ───────────────────────────────────────
function RouterDetails({ routerId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!routerId) return;
    setLoading(true);
    fetch(`http://localhost:5000/api/routers/${routerId}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => console.error(e));
  }, [routerId]);

  if (!routerId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 h-full">
        <Activity className="w-16 h-16 mb-4 opacity-20" />
        <p>Select a router from the rankings to view details</p>
      </div>
    );
  }

  if (loading || !data) return <div className="flex-1 p-8 text-gray-400">Loading router data...</div>;

  const { router, health, metrics, complaints } = data;
  
  // Format chart data
  const chartData = metrics.time_series.map(m => ({
    time: format(parseISO(m.hour), "HH:mm"),
    latency: m.latency_ms,
    packetLoss: m.packet_loss_pct
  }));

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-gray-950">
      {/* Header Info */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            {router.router_id}
            <span className={`text-sm px-3 py-1 rounded-full border ${
              health.score < 50 ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'
            }`}>
              Score: {health.score.toFixed(1)}/100
            </span>
          </h2>
          <p className="text-gray-400 mt-2">
            {router.building} — Room {router.room} • {router.model} • Firmware {router.firmware_version}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Top Issue</p>
          <p className="font-semibold text-orange-400">{health.top_issue}</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Latency Chart */}
        <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Latency (ms) - Last 24h</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="time" stroke="#6b7280" fontSize={12} tickMargin={8} />
                <YAxis stroke="#6b7280" fontSize={12} tickMargin={8} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                  itemStyle={{ color: '#60a5fa' }}
                />
                <Line type="monotone" dataKey="latency" stroke="#60a5fa" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Packet Loss Chart */}
        <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Packet Loss (%) - Last 24h</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="time" stroke="#6b7280" fontSize={12} tickMargin={8} />
                <YAxis stroke="#6b7280" fontSize={12} tickMargin={8} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                  itemStyle={{ color: '#f43f5e' }}
                />
                <Line type="monotone" dataKey="packetLoss" stroke="#f43f5e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Complaints */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> Recent Complaints ({complaints.count})
        </h3>
        {complaints.count === 0 ? (
          <p className="text-gray-500 text-sm">No recent complaints for this router.</p>
        ) : (
          <div className="space-y-3">
            {complaints.tickets.map((t) => (
              <div key={t.ticket_id} className="bg-gray-950 p-3 rounded-xl border border-gray-800/50">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-mono text-gray-500">{t.ticket_id}</span>
                  <span className="text-xs text-gray-500">{format(parseISO(t.date), "MMM d, yyyy")}</span>
                </div>
                <p className="text-sm text-gray-200">{t.complaint_text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Copilot */}
      <Copilot routerId={routerId} />
    </div>
  );
}

// ─── MAIN APP (DASHBOARD) ───────────────────────────────────────────
export default function App() {
  const [rankings, setRankings] = useState([]);
  const [selectedRouter, setSelectedRouter] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc"); // asc = worst first

  useEffect(() => {
    fetch("http://localhost:5000/api/rankings?limit=60")
      .then(r => r.json())
      .then(d => {
        setRankings(d.rankings);
        if (d.rankings.length > 0) setSelectedRouter(d.rankings[0].router_id);
      })
      .catch(e => console.error("Failed to load rankings", e));
  }, []);

  const sortedRankings = [...rankings].sort((a, b) => {
    return sortOrder === "asc" ? a.health_score - b.health_score : b.health_score - a.health_score;
  });

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      
      {/* LEFT PANEL: Rankings */}
      <div className="w-96 flex flex-col bg-gray-900 border-r border-gray-800">
        <div className="p-5 border-b border-gray-800">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent flex items-center gap-2">
            <Cpu className="w-6 h-6 text-blue-400" /> DigiPlus
          </h1>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest">Network Health Monitor</p>
        </div>
        
        <div className="p-4 flex justify-between items-center bg-gray-900/50 sticky top-0 border-b border-gray-800">
          <span className="text-sm font-medium text-gray-300">Router Rankings</span>
          <button 
            onClick={() => setSortOrder(s => s === "asc" ? "desc" : "asc")}
            className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-300 transition-colors"
          >
            Sort: {sortOrder === "asc" ? "Worst First" : "Best First"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sortedRankings.map((r, idx) => (
            <div 
              key={r.router_id}
              onClick={() => setSelectedRouter(r.router_id)}
              className={`p-4 border-b border-gray-800/50 cursor-pointer transition-colors group flex items-center justify-between ${
                selectedRouter === r.router_id ? "bg-purple-900/20 border-l-2 border-l-purple-500" : "hover:bg-gray-800/50 border-l-2 border-l-transparent"
              }`}
            >
              <div>
                <p className="font-mono font-semibold flex items-center gap-2">
                  {r.router_id}
                  {r.health_score < 50 && <WifiOff className="w-3 h-3 text-red-400" />}
                </p>
                <p className="text-xs text-gray-500 mt-1 truncate max-w-[200px]">Issue: {r.top_issue}</p>
              </div>
              <div className="text-right flex items-center gap-3">
                <span className={`text-lg font-bold ${
                  r.health_score < 50 ? 'text-red-400' : 'text-green-400'
                }`}>
                  {r.health_score.toFixed(0)}
                </span>
                <ChevronRight className={`w-4 h-4 transition-transform ${selectedRouter === r.router_id ? "text-purple-400 translate-x-1" : "text-gray-600 group-hover:translate-x-1"}`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL: Router Details */}
      <RouterDetails routerId={selectedRouter} />
      
    </div>
  );
}
