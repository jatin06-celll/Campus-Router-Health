import React, { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { format, parseISO } from "date-fns";
import { AlertCircle, Activity, WifiOff, Cpu, ChevronRight, Zap, Server, MapPin, Gauge, Menu, X } from "lucide-react";

// ─── COPILOT COMPONENT ──────────────────────────────────────────────
function Copilot({ routerId }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

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
    replace: { bg: "bg-red-50 border-red-200 text-red-700 shadow-sm", icon: "🔴", label: "Replace Hardware" },
    relocate: { bg: "bg-orange-50 border-orange-200 text-orange-700 shadow-sm", icon: "🟠", label: "Relocate Router" },
    "firmware update": { bg: "bg-amber-50 border-amber-200 text-amber-700 shadow-sm", icon: "🟡", label: "Firmware Update" },
    "user education": { bg: "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm", icon: "🟢", label: "User Education" },
  };

  const fixStyle = result ? FIX_STYLES[result.recommendedFix?.toLowerCase()] || FIX_STYLES["user education"] : null;

  return (
    <div className="relative bg-white border border-gray-200 shadow-sm rounded-2xl p-6 mt-8 overflow-hidden group">
      
      <div className="flex items-center justify-between mb-4 relative z-10">
        <h3 className="text-xl font-bold flex items-center gap-3 text-gray-900">
          <div className="p-2 bg-purple-100 rounded-lg border border-purple-200">
            <Zap className="w-5 h-5 text-purple-600" />
          </div>
          AI Diagnostic Copilot
        </h3>
        <button
          onClick={diagnose}
          disabled={loading}
          className="relative px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl text-sm font-bold text-white shadow-md transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden"
        >
          {loading ? (
            <span className="flex items-center gap-2"><Activity className="w-4 h-4 animate-spin" /> Analyzing...</span>
          ) : "Run AI Diagnosis"}
        </button>
      </div>

      {error && <div className="text-red-700 text-sm p-4 bg-red-50 border border-red-200 rounded-xl mt-4 relative z-10">{error}</div>}

      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 animate-fade-in relative z-10">
          <div className={`col-span-1 md:col-span-2 border rounded-xl p-5 ${fixStyle.bg} transition-all duration-500`}>
            <p className="text-xs uppercase tracking-widest opacity-70 mb-1 font-semibold">Recommended Action</p>
            <p className="text-2xl font-black flex items-center gap-3">
              {fixStyle.icon} {fixStyle.label}
            </p>
            {result._fallback && (
              <p className="text-xs text-amber-600 mt-2 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Fallback mode — API quota exceeded
              </p>
            )}
          </div>
          
          <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
            <p className="text-xs uppercase tracking-widest text-purple-600 mb-2 font-bold">Root Cause</p>
            <p className="text-gray-700 text-sm leading-relaxed">{result.cause}</p>
          </div>

          <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
            <p className="text-xs uppercase tracking-widest text-blue-600 mb-2 font-bold">Evidence</p>
            <ul className="space-y-2">
              {result.evidence.map((item, i) => (
                <li key={i} className="text-gray-700 text-sm flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5 font-bold">•</span> {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {!result && !loading && !error && (
        <div className="mt-4 p-8 border border-dashed border-gray-300 rounded-xl bg-gray-50 text-center relative z-10">
          <p className="text-sm text-gray-500">Click <strong className="text-purple-600">Run AI Diagnosis</strong> to instantly analyze telemetry and complaints using Gemini 2.0 Flash.</p>
        </div>
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
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 h-full bg-slate-50">
        <Activity className="w-24 h-24 mb-6 opacity-20 text-gray-400" />
        <p className="text-lg font-medium text-gray-500">Open the menu to select a router</p>
      </div>
    );
  }

  if (loading || !data) return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
    </div>
  );

  const { router, health, metrics, complaints } = data;
  
  const chartData = metrics.time_series.map(m => ({
    time: format(parseISO(m.hour), "HH:mm"),
    latency: m.latency_ms,
    packetLoss: m.packet_loss_pct
  }));

  const isHealthy = health.score >= 50;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50 text-gray-900 w-full">
      
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 p-6 bg-white border border-gray-200 rounded-2xl shadow-sm">
        <div className="flex items-center gap-6">
          {/* Circular Score */}
          <div className={`relative w-20 h-20 rounded-full flex items-center justify-center border-4 shadow-sm ${
            isHealthy ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 'border-red-500 text-red-600 bg-red-50'
          }`}>
            <span className="text-2xl font-black">{health.score.toFixed(0)}</span>
          </div>

          <div>
            <h2 className="text-4xl font-black text-gray-900 flex items-center gap-3 tracking-tight">
              {router.router_id}
            </h2>
            <div className="flex items-center gap-4 text-sm text-gray-500 mt-2 font-medium">
              <span className="flex items-center gap-1"><Server className="w-4 h-4" /> {router.model} (v{router.firmware_version})</span>
              <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {router.building} — Room {router.room}</span>
            </div>
          </div>
        </div>

        <div className="text-right bg-gray-50 p-4 rounded-xl border border-gray-200">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-1 font-bold">Primary Issue</p>
          <p className={`font-bold text-lg flex items-center gap-2 ${isHealthy ? 'text-emerald-600' : 'text-rose-600'}`}>
            {!isHealthy && <AlertCircle className="w-5 h-5" />}
            {health.top_issue}
          </p>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Activity className="w-6 h-6" /></div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Avg Speed</p>
            <p className="text-xl font-black text-gray-900">{health.averages.speed_mbps} <span className="text-sm font-medium text-gray-500">Mbps</span></p>
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><Gauge className="w-6 h-6" /></div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Avg Latency</p>
            <p className="text-xl font-black text-gray-900">{health.averages.latency_ms} <span className="text-sm font-medium text-gray-500">ms</span></p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl"><WifiOff className="w-6 h-6" /></div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Packet Loss</p>
            <p className="text-xl font-black text-gray-900">{health.averages.packet_loss_pct}<span className="text-sm font-medium text-gray-500">%</span></p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><AlertCircle className="w-6 h-6" /></div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Disconnects</p>
            <p className="text-xl font-black text-gray-900">{health.averages.disconnects_per_hr} <span className="text-sm font-medium text-gray-500">/hr</span></p>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        {/* Latency Chart */}
        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-sm font-bold text-gray-700 mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500" /> Latency Trend (Last 24h)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" vertical={false} />
                <XAxis dataKey="time" stroke="#6b7280" fontSize={12} tickMargin={10} axisLine={false} tickLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickMargin={10} axisLine={false} tickLine={false} unit="ms" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  itemStyle={{ color: '#2563eb', fontWeight: 'bold' }}
                />
                <Area type="natural" dataKey="latency" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorLatency)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Packet Loss Chart */}
        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-sm font-bold text-gray-700 mb-6 flex items-center gap-2">
            <WifiOff className="w-5 h-5 text-rose-500" /> Packet Loss Trend (Last 24h)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorLoss" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e11d48" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#e11d48" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" vertical={false} />
                <XAxis dataKey="time" stroke="#6b7280" fontSize={12} tickMargin={10} axisLine={false} tickLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickMargin={10} axisLine={false} tickLine={false} unit="%" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  itemStyle={{ color: '#e11d48', fontWeight: 'bold' }}
                />
                <Area type="natural" dataKey="packetLoss" stroke="#e11d48" strokeWidth={3} fillOpacity={1} fill="url(#colorLoss)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Complaints */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-orange-500" /> User Complaints ({complaints.count})
        </h3>
        {complaints.count === 0 ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-semibold">
            Zero recent complaints. Users are happy!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {complaints.tickets.map((t) => (
              <div key={t.ticket_id} className="bg-gray-50 p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-mono font-bold text-gray-600 bg-white border border-gray-200 px-2 py-1 rounded shadow-sm">{t.ticket_id}</span>
                  <span className="text-xs font-medium text-gray-500">{format(parseISO(t.date), "MMM d, yyyy")}</span>
                </div>
                <p className="text-sm text-gray-700 italic">"{t.complaint_text}"</p>
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
  const [sortOrder, setSortOrder] = useState("asc");
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    <div className="flex flex-col h-screen bg-slate-50 text-gray-900 font-sans overflow-hidden">
      
      {/* TOP NAVIGATION */}
      <header className="flex items-center justify-between h-16 bg-white border-b border-gray-200 px-4 shadow-sm z-30 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-black bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent flex items-center gap-2">
            <Gauge className="w-7 h-7 text-blue-600" /> DigiPlus
          </h1>
        </div>
        <div className="hidden md:block text-xs font-bold text-gray-400 uppercase tracking-widest">
          Campus Telemetry Engine
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        
        {/* OVERLAY BACKDROP */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* SIDEBAR (Collapsible) */}
        <div className={`fixed inset-y-0 left-0 z-50 w-80 md:w-96 bg-white border-r border-gray-200 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          
          <div className="p-4 flex justify-between items-center bg-gray-50 border-b border-gray-200">
            <span className="text-xs font-black text-gray-600 uppercase tracking-wider">Live Rankings</span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setSortOrder(s => s === "asc" ? "desc" : "asc")}
                className="text-xs px-3 py-1.5 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 text-gray-700 font-semibold shadow-sm transition-all"
              >
                Sort: {sortOrder === "asc" ? "Worst First" : "Best First"}
              </button>
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-md">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar bg-white">
            {sortedRankings.map((r) => {
              const isSelected = selectedRouter === r.router_id;
              const isCritical = r.health_score < 50;
              
              return (
                <div 
                  key={r.router_id}
                  onClick={() => {
                    setSelectedRouter(r.router_id);
                    if (window.innerWidth < 768) setSidebarOpen(false); // Auto-close on mobile
                  }}
                  className={`p-4 rounded-xl cursor-pointer transition-all duration-200 group flex items-center justify-between border ${
                    isSelected 
                      ? "bg-purple-50 border-purple-300 shadow-sm" 
                      : "bg-white border-gray-100 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm"
                  }`}
                >
                  <div>
                    <p className={`font-mono font-bold flex items-center gap-2 text-lg ${isSelected ? 'text-purple-900' : 'text-gray-900'}`}>
                      {r.router_id}
                      {isCritical && <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>}
                    </p>
                    <p className={`text-xs mt-1 truncate max-w-[180px] font-medium ${isSelected ? 'text-purple-600' : 'text-gray-500'}`}>
                      {r.top_issue}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <span className={`text-xl font-black ${
                      isCritical ? 'text-rose-600' : 'text-emerald-600'
                    }`}>
                      {r.health_score.toFixed(0)}
                    </span>
                    <ChevronRight className={`w-5 h-5 transition-transform duration-200 ${isSelected ? "text-purple-600 translate-x-1" : "text-gray-400 group-hover:translate-x-1 group-hover:text-gray-600"}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex w-full">
          <RouterDetails routerId={selectedRouter} />
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
}
