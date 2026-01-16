import React, { useState, useEffect, useCallback } from 'react';

const GeothermalGame = () => {
  const REFERENCE_TEMP = 25;
  const HEAT_CAPACITY = 4.18;
  const HOURS_PER_YEAR = 8000;
  const EXERGY_REFERENCE = 100;
  const BASE_PRICE = 80;
  const DRILLING_FAILURE_RATE = 0.05;
  const MAX_DOUBLETS = 10;
  const COMPETITOR_TAKE_CHANCE = 0.12;
  const SECURE_COST = 2;
  const HOLDING_COST = 0.3;
  const CONSTRUCTION_DELAY = 2;
  
  const SEASONAL_MULTIPLIER = { 0: 1.3, 1: 0.7, 2: 0.6, 3: 1.2 };

  const generateSites = () => {
    const names = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    const colors = ["#e74c3c", "#e67e22", "#f1c40f", "#9b59b6", "#3498db", 
                    "#1abc9c", "#e91e63", "#00bcd4", "#8bc34a", "#ff5722"];
    
    return names.map((name, i) => ({
      id: i, name: `Site ${name}`, color: colors[i],
      trueTemp: Math.floor(80 + Math.random() * 80),
      trueCapacity: 0.5 + Math.random() * 1.5,
      trueDrillingCost: Math.floor(5 + Math.random() * 8),
      trueConstructionCost: Math.floor(3 + Math.random() * 5),
      investigated: 0, revealedTemp: null, revealedDrillingCost: null,
      secured: false, developed: false, takenByCompetitor: false,
      underConstruction: false, constructionCompleteYear: null, plannedFlowRate: null,
    }));
  };

  const createInitialDoublet = () => ({
    id: 0, siteId: -1, siteName: "Legacy", color: "#2ecc71",
    initialTemp: 120, currentTemp: 105, flowRate: 50, thermalCapacity: 1.0,
    yearBuilt: 2020, abandoned: false,
    tempHistory: [
      { year: 2020, temp: 120 }, { year: 2021, temp: 116 }, 
      { year: 2022, temp: 112 }, { year: 2023, temp: 108 }, { year: 2024, temp: 105 }
    ],
    cashHistory: [
      { year: 2020, cash: 2.1 }, { year: 2021, cash: 1.9 }, 
      { year: 2022, cash: 1.7 }, { year: 2023, cash: 1.5 }, { year: 2024, cash: 1.3 }
    ],
    heatHistory: [
      { year: 2020, heat: 160 }, { year: 2021, heat: 152 }, 
      { year: 2022, heat: 144 }, { year: 2023, heat: 136 }, { year: 2024, heat: 128 }
    ],
    currentYearCash: 0, currentYearHeat: 0,
  });

  const [gameStarted, setGameStarted] = useState(false);
  const [year, setYear] = useState(2025);
  const [quarter, setQuarter] = useState(0);
  const [cash, setCash] = useState(15);
  const [sites, setSites] = useState(generateSites());
  const [doublets, setDoublets] = useState([createInitialDoublet()]);
  const [totalHeatDelivered, setTotalHeatDelivered] = useState(0);
  const [gameLog, setGameLog] = useState(["2025 Q1: Game started."]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [developmentFlow, setDevelopmentFlow] = useState(50);
  const [gameOver, setGameOver] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [nextDoubletId, setNextDoubletId] = useState(1);
  const [operatingCostMultiplier, setOperatingCostMultiplier] = useState(1.0);
  const [revenueMultiplier, setRevenueMultiplier] = useState(1.0);
  const [pendingEvent, setPendingEvent] = useState(null);
  const [aggregateCashHistory, setAggregateCashHistory] = useState([
    { year: 2020, cash: 2.1 }, { year: 2021, cash: 1.9 }, 
    { year: 2022, cash: 1.7 }, { year: 2023, cash: 1.5 }, { year: 2024, cash: 1.3 }
  ]);
  const [aggregateHeatHistory, setAggregateHeatHistory] = useState([
    { year: 2020, heat: 160 }, { year: 2021, heat: 152 }, 
    { year: 2022, heat: 144 }, { year: 2023, heat: 136 }, { year: 2024, heat: 128 }
  ]);

  const speedLabels = ["⏸", "▶", "▶▶", "▶▶▶"];
  const speedMultipliers = [0, 1, 2, 5];
  const quarterNames = ["Q1", "Q2", "Q3", "Q4"];

  const getSeasonalMultiplier = useCallback(() => SEASONAL_MULTIPLIER[quarter], [quarter]);
  const getExergyFactor = (temp) => Math.max(0, Math.min(1, (temp - REFERENCE_TEMP) / EXERGY_REFERENCE));
  
  const getHeatOutput = (doublet) => {
    if (doublet.abandoned) return 0;
    const deltaT = doublet.currentTemp - REFERENCE_TEMP;
    if (deltaT <= 5) return 0;
    return (doublet.flowRate * HEAT_CAPACITY * deltaT) / 1000;
  };

  const getQuarterlyRevenue = useCallback((doublet) => {
    if (doublet.abandoned) return 0;
    const heatMW = getHeatOutput(doublet);
    const exergyFactor = getExergyFactor(doublet.currentTemp);
    const pricePerMWh = BASE_PRICE * exergyFactor * revenueMultiplier * getSeasonalMultiplier();
    return (heatMW * (HOURS_PER_YEAR / 4) * pricePerMWh) / 1000000;
  }, [revenueMultiplier, getSeasonalMultiplier]);

  const getQuarterlyOperatingCost = useCallback((doublet) => {
    if (doublet.abandoned) return 0;
    return ((0.3 + (doublet.flowRate * 0.005)) * operatingCostMultiplier) / 4;
  }, [operatingCostMultiplier]);

  const getNewTemperature = (doublet) => {
    if (doublet.abandoned) return doublet.currentTemp;
    const extractionIntensity = doublet.flowRate / 50;
    const declineRate = ((3 + Math.random() * 2) * extractionIntensity / doublet.thermalCapacity) / 4;
    return Math.max(REFERENCE_TEMP + 5, doublet.currentTemp - declineRate);
  };

  const getQuarterlyHeat = (doublet) => {
    if (doublet.abandoned) return 0;
    return getHeatOutput(doublet) * (HOURS_PER_YEAR / 4) / 1000;
  };

  const triggerableEvents = [
    { id: 'backlash', name: "⚠️ Public Backlash", description: "Environmental groups organizing against geothermal.",
      choices: [
        { text: "Launch PR Campaign (€2M)", cost: 2, effect: () => {} },
        { text: "Accept -20% revenue for 3 years", cost: 0, effect: () => setRevenueMultiplier(0.8) },
      ], probability: 0.02 },
    { id: 'cost_surge', name: "⚠️ Supply Chain Crisis", description: "Equipment and material prices are spiking.",
      choices: [
        { text: "Stockpile materials (€3M)", cost: 3, effect: () => {} },
        { text: "Accept +30% operating costs", cost: 0, effect: () => setOperatingCostMultiplier(m => m * 1.3) },
      ], probability: 0.025 },
    { id: 'subsidy', name: "💰 Government Grant", description: "Green energy subsidy program announced.",
      choices: [
        { text: "Accept €5M grant", cost: 0, effect: () => setCash(c => c + 5) },
        { text: "Skip (no conditions)", cost: 0, effect: () => {} },
      ], probability: 0.015 },
  ];

  const checkForEvents = useCallback(() => {
    if (pendingEvent) return;
    for (const event of triggerableEvents) {
      if (Math.random() < event.probability) {
        setPendingEvent(event);
        setSpeed(0);
        break;
      }
    }
  }, [pendingEvent]);

  const handleEventChoice = (choiceIndex) => {
    const choice = pendingEvent.choices[choiceIndex];
    if (cash >= choice.cost) {
      setCash(c => c - choice.cost);
      choice.effect();
      addLog(`${pendingEvent.name} → ${choice.text}`);
    }
    setPendingEvent(null);
  };

  const investigationCosts = { 1: 0.5, 2: 1.5, 3: 4.0 };

  const investigateSite = (siteId, level) => {
    const site = sites[siteId];
    if (site.investigated >= level || site.takenByCompetitor || cash < investigationCosts[level]) return;

    const newSites = [...sites];
    newSites[siteId] = { ...site, investigated: level };
    
    const variance = 20 - (level * 5);
    newSites[siteId].revealedTemp = level >= 3 
      ? { min: site.trueTemp, max: site.trueTemp }
      : { min: Math.max(60, site.trueTemp - variance), max: Math.min(180, site.trueTemp + variance) };
    
    if (level >= 2) {
      const cv = 3 - level;
      newSites[siteId].revealedDrillingCost = level >= 3
        ? { min: site.trueDrillingCost, max: site.trueDrillingCost }
        : { min: Math.max(3, site.trueDrillingCost - cv), max: site.trueDrillingCost + cv };
    }

    setSites(newSites);
    setCash(c => c - investigationCosts[level]);
    addLog(`Investigated ${site.name} (Level ${level})`);
  };

  const secureSite = (siteId) => {
    const site = sites[siteId];
    if (site.secured || site.takenByCompetitor || site.developed || cash < SECURE_COST) return;
    const newSites = [...sites];
    newSites[siteId] = { ...site, secured: true };
    setSites(newSites);
    setCash(c => c - SECURE_COST);
    addLog(`Secured ${site.name}`);
  };

  const startDevelopment = (siteId, flowRate) => {
    const site = sites[siteId];
    if (!site.secured || site.developed || site.underConstruction) return;
    const activeCount = doublets.filter(d => !d.abandoned).length + sites.filter(s => s.underConstruction).length;
    if (activeCount >= MAX_DOUBLETS || cash < site.trueDrillingCost) return;

    if (Math.random() < DRILLING_FAILURE_RATE) {
      setCash(c => c - site.trueDrillingCost);
      addLog(`❌ DRILLING FAILED at ${site.name}!`);
      const newSites = [...sites];
      newSites[siteId] = { ...site, developed: true, secured: false };
      setSites(newSites);
      return;
    }

    const newSites = [...sites];
    newSites[siteId] = { ...site, underConstruction: true, constructionCompleteYear: year + CONSTRUCTION_DELAY, plannedFlowRate: flowRate };
    setSites(newSites);
    setCash(c => c - site.trueDrillingCost);
    addLog(`Started drilling ${site.name}`);
  };

  const checkConstructionComplete = useCallback(() => {
    let changed = false;
    const newSites = [...sites];
    let newDoublets = [...doublets];

    sites.forEach((site, i) => {
      if (site.underConstruction && site.constructionCompleteYear <= year && cash >= site.trueConstructionCost) {
        setCash(c => c - site.trueConstructionCost);
        newDoublets.push({
          id: nextDoubletId, siteId: site.id, siteName: site.name, color: site.color,
          initialTemp: site.trueTemp, currentTemp: site.trueTemp,
          flowRate: site.plannedFlowRate, thermalCapacity: site.trueCapacity,
          yearBuilt: year, abandoned: false,
          tempHistory: [{ year, temp: site.trueTemp }],
          cashHistory: [], heatHistory: [],
          currentYearCash: 0, currentYearHeat: 0,
        });
        setNextDoubletId(id => id + 1);
        newSites[i] = { ...site, underConstruction: false, developed: true, secured: false };
        changed = true;
        addLog(`✓ ${site.name} is now operational!`);
      }
    });

    if (changed) { setSites(newSites); setDoublets(newDoublets); }
  }, [sites, doublets, year, cash, nextDoubletId]);

  const competitorAction = useCallback(() => {
    const newSites = [...sites];
    let changed = false;
    sites.forEach((site, i) => {
      if (!site.secured && !site.developed && !site.takenByCompetitor && !site.underConstruction) {
        if (Math.random() < COMPETITOR_TAKE_CHANCE / 4) {
          newSites[i] = { ...site, takenByCompetitor: true };
          changed = true;
          addLog(`Competitor has taken ${site.name}!`);
        }
      }
    });
    if (changed) setSites(newSites);
  }, [sites]);

  const abandonDoublet = (id) => {
    setDoublets(ds => ds.map(d => d.id === id ? { ...d, abandoned: true } : d));
    addLog(`Abandoned ${doublets.find(d => d.id === id)?.siteName}`);
  };

  const advanceQuarter = useCallback(() => {
    if (gameOver || pendingEvent) return;
    checkForEvents();
    if (pendingEvent) return;
    competitorAction();

    let quarterlyNetCash = 0;

    const newDoublets = doublets.map(d => {
      if (d.abandoned) return d;
      
      const heat = getQuarterlyHeat(d);
      const revenue = getQuarterlyRevenue(d);
      const cost = getQuarterlyOperatingCost(d);
      const newTemp = getNewTemperature(d);
      const netCash = revenue - cost;
      
      quarterlyNetCash += netCash;

      return {
        ...d, currentTemp: newTemp,
        currentYearCash: (d.currentYearCash || 0) + netCash,
        currentYearHeat: (d.currentYearHeat || 0) + heat,
      };
    });

    const holdingCosts = sites.filter(s => s.secured && !s.developed && !s.underConstruction).length * (HOLDING_COST / 4);
    quarterlyNetCash -= holdingCosts;

    const newCash = cash + quarterlyNetCash;
    const quarterlyHeat = newDoublets.reduce((sum, d) => sum + (d.abandoned ? 0 : getQuarterlyHeat(d)), 0);
    
    setDoublets(newDoublets);
    setCash(newCash);
    setTotalHeatDelivered(t => t + quarterlyHeat);

    if (quarter === 3) {
      const totalYearCash = newDoublets.reduce((sum, d) => sum + (d.currentYearCash || 0), 0) - (holdingCosts * 4);
      const totalYearHeat = newDoublets.reduce((sum, d) => sum + (d.currentYearHeat || 0), 0);
      
      setAggregateCashHistory(h => [...h, { year, cash: totalYearCash }].slice(-15));
      setAggregateHeatHistory(h => [...h, { year, heat: totalYearHeat }].slice(-15));
      
      const updatedDoublets = newDoublets.map(d => {
        if (d.abandoned) return d;
        return {
          ...d,
          tempHistory: [...d.tempHistory, { year, temp: d.currentTemp }].slice(-15),
          cashHistory: [...d.cashHistory, { year, cash: d.currentYearCash || 0 }].slice(-15),
          heatHistory: [...d.heatHistory, { year, heat: d.currentYearHeat || 0 }].slice(-15),
          currentYearCash: 0, currentYearHeat: 0,
        };
      });
      
      setDoublets(updatedDoublets);
      setYear(y => y + 1);
      setQuarter(0);
      setTimeout(() => checkConstructionComplete(), 0);
    } else {
      setQuarter(q => q + 1);
    }

    if (newCash < -10) { setGameOver(true); setSpeed(0); addLog("GAME OVER: Bankruptcy!"); }
    
    const active = newDoublets.filter(d => !d.abandoned && getHeatOutput(d) > 0);
    const available = sites.filter(s => !s.developed && !s.takenByCompetitor);
    if (active.length === 0 && available.length === 0) { setGameOver(true); setSpeed(0); addLog("GAME OVER: All resources exhausted!"); }
  }, [gameOver, pendingEvent, doublets, cash, quarter, year, sites, checkForEvents, competitorAction, getQuarterlyRevenue, getQuarterlyOperatingCost, checkConstructionComplete]);

  useEffect(() => {
    if (speed === 0 || gameOver || pendingEvent || !gameStarted) return;
    const interval = setInterval(advanceQuarter, 800 / speedMultipliers[speed]);
    return () => clearInterval(interval);
  }, [speed, gameOver, pendingEvent, advanceQuarter, gameStarted]);

  useEffect(() => {
    if (quarter === 0 && year > 2025) checkConstructionComplete();
  }, [year, quarter, checkConstructionComplete]);

  const addLog = (msg) => setGameLog(log => [...log.slice(-9), `${year} ${quarterNames[quarter]}: ${msg}`]);

  const resetGame = () => {
    setGameStarted(false);
    setYear(2025); setQuarter(0); setCash(15);
    setSites(generateSites()); setDoublets([createInitialDoublet()]);
    setTotalHeatDelivered(0); setGameLog(["2025 Q1: Game started."]);
    setSelectedSite(null); setGameOver(false); setSpeed(0);
    setNextDoubletId(1); setOperatingCostMultiplier(1.0); setRevenueMultiplier(1.0);
    setPendingEvent(null);
    setAggregateCashHistory([
      { year: 2020, cash: 2.1 }, { year: 2021, cash: 1.9 }, { year: 2022, cash: 1.7 }, { year: 2023, cash: 1.5 }, { year: 2024, cash: 1.3 }
    ]);
    setAggregateHeatHistory([
      { year: 2020, heat: 160 }, { year: 2021, heat: 152 }, { year: 2022, heat: 144 }, { year: 2023, heat: 136 }, { year: 2024, heat: 128 }
    ]);
  };

  // Mini sparkline
  const Sparkline = ({ data, dataKey, color, height = 30, width = 60, showZero = false }) => {
    if (!data || data.length < 2) return <div className="text-gray-600 text-xs">--</div>;
    
    const values = data.map(d => d[dataKey]);
    const minVal = showZero ? Math.min(0, ...values) : Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;

    return (
      <svg width={width} height={height}>
        {showZero && (
          <line x1="0" y1={height - ((0 - minVal) / range) * height} 
                x2={width} y2={height - ((0 - minVal) / range) * height} 
                stroke="#444" strokeWidth="0.5" />
        )}
        <polyline fill="none" stroke={color} strokeWidth="1.5"
          points={data.map((d, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = height - ((d[dataKey] - minVal) / range) * height;
            return `${x},${y}`;
          }).join(' ')} />
      </svg>
    );
  };

  // Aggregate chart
  const AggregateChart = ({ data, dataKey, color, height = 60, title, unit, showZero = false }) => {
    if (!data || data.length < 2) return (
      <div className="bg-gray-900 p-2 rounded">
        <div className="text-xs text-gray-400">{title}</div>
        <div className="text-gray-600 h-12 flex items-center justify-center">No data</div>
      </div>
    );
    
    const values = data.map(d => d[dataKey]);
    const minVal = showZero ? Math.min(0, ...values) : Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;

    return (
      <div className="bg-gray-900 p-2 rounded">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{title}</span>
          <span>{values[values.length - 1]?.toFixed(1)} {unit}</span>
        </div>
        <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
          {showZero && (
            <line x1="0" y1={height - ((0 - minVal) / range) * height} 
                  x2="100" y2={height - ((0 - minVal) / range) * height} 
                  stroke="#555" strokeDasharray="2,2" strokeWidth="0.5" />
          )}
          <polyline fill="none" stroke={color} strokeWidth="2"
            points={data.map((d, i) => {
              const x = (i / (data.length - 1)) * 100;
              const y = height - ((d[dataKey] - minVal) / range) * height;
              return `${x},${y}`;
            }).join(' ')} />
        </svg>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{data[0]?.year}</span>
          <span>{data[data.length - 1]?.year}</span>
        </div>
      </div>
    );
  };

  const TempBar = ({ temp }) => {
    const pct = Math.max(0, ((temp - REFERENCE_TEMP) / (160 - REFERENCE_TEMP)) * 100);
    return (
      <div className="w-full h-1.5 bg-gray-700 rounded overflow-hidden">
        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: `hsl(${Math.min(60, pct * 0.6)}, 80%, 50%)` }} />
      </div>
    );
  };

  const seasonEmoji = ['❄️', '🌸', '☀️', '🍂'][quarter];

  // START SCREEN
  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4 flex items-center justify-center">
        <div className="max-w-4xl w-full space-y-4">
          <h1 className="text-3xl font-bold text-center mb-6">🌋 Geothermal Portfolio Manager</h1>
          
          {/* Instructions Card */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4 text-blue-400">📖 How to Play</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="font-bold text-yellow-400 mb-2">Objective</h3>
                <p className="text-gray-300 text-sm mb-4">
                  Manage a portfolio of geothermal doublets to deliver heat while maximising profits. 
                  Experience the "double penalty" of exergy pricing where declining temperatures reduce 
                  both heat output AND price per unit.
                </p>
                
                <h3 className="font-bold text-yellow-400 mb-2">Site Development</h3>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• <span className="text-blue-400">Investigate</span> sites to reveal temperature and costs</li>
                  <li>• <span className="text-purple-400">Secure</span> sites to protect from competitors</li>
                  <li>• <span className="text-green-400">Drill</span> to start development (5% failure risk)</li>
                  <li>• Construction takes 2 years to complete</li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-yellow-400 mb-2">Key Mechanics</h3>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• <span className="text-orange-400">Exergy Pricing:</span> Higher temp = higher price/MWh</li>
                  <li>• <span className="text-red-400">Double Penalty:</span> As temp drops, output AND price fall</li>
                  <li>• <span className="text-cyan-400">Seasonal Demand:</span> Winter high, summer low</li>
                  <li>• <span className="text-pink-400">Competitors:</span> Unsecured sites may be taken</li>
                  <li>• <span className="text-yellow-400">Random Events:</span> Respond to market changes</li>
                </ul>
                
                <h3 className="font-bold text-yellow-400 mb-2 mt-4">Flow Rate Trade-off</h3>
                <p className="text-gray-300 text-sm">
                  Higher flow = more heat now but faster temperature decline.
                  Lower flow = less heat but longer project life.
                </p>
              </div>
            </div>
          </div>

          {/* Setup Card */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4 text-green-400">⚙️ Game Setup</h2>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="bg-gray-900 p-3 rounded">
                <div className="text-gray-400 mb-2">Starting Conditions</div>
                <ul className="text-gray-300 space-y-1">
                  <li>• Cash: <span className="text-green-400">€15M</span></li>
                  <li>• Year: <span className="text-blue-400">2025</span></li>
                  <li>• Legacy doublet: <span className="text-yellow-400">1 operating</span></li>
                  <li>• Potential sites: <span className="text-purple-400">10 available</span></li>
                </ul>
              </div>
              <div className="bg-gray-900 p-3 rounded">
                <div className="text-gray-400 mb-2">Costs</div>
                <ul className="text-gray-300 space-y-1">
                  <li>• Survey: €0.5M → €1.5M → €4M</li>
                  <li>• Secure site: €{SECURE_COST}M</li>
                  <li>• Holding cost: €{HOLDING_COST}M/year</li>
                  <li>• Drilling: €5-13M (varies)</li>
                  <li>• Construction: €3-8M (varies)</li>
                </ul>
              </div>
              <div className="bg-gray-900 p-3 rounded">
                <div className="text-gray-400 mb-2">Economic Model</div>
                <ul className="text-gray-300 space-y-1">
                  <li>• Base price: €{BASE_PRICE}/MWh</li>
                  <li>• Reference ΔT: {EXERGY_REFERENCE}°C</li>
                  <li>• Ambient temp: {REFERENCE_TEMP}°C</li>
                  <li>• Drilling failure: {DRILLING_FAILURE_RATE * 100}%</li>
                  <li>• Max doublets: {MAX_DOUBLETS}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Start Button */}
          <div className="text-center">
            <button 
              onClick={() => setGameStarted(true)}
              className="bg-green-600 hover:bg-green-500 text-white text-xl font-bold px-12 py-4 rounded-lg transition-colors"
            >
              🚀 Start Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MAIN GAME
  return (
    <div className="min-h-screen bg-gray-900 text-white p-2" style={{ fontSize: '11px' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-2 p-2 bg-gray-800 rounded">
          <h1 className="text-base font-bold">🌋 Geothermal Portfolio Manager</h1>
          <div className="flex items-center gap-3">
            <div className="flex gap-0.5">
              {speedLabels.map((label, i) => (
                <button key={i} onClick={() => setSpeed(i)} disabled={!!pendingEvent}
                  className={`px-2 py-1 rounded ${speed === i ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="text-right">
              <div className="text-lg font-mono">{seasonEmoji} {year} {quarterNames[quarter]}</div>
              <div className={`text-base ${cash >= 0 ? 'text-green-400' : 'text-red-400'}`}>€{cash.toFixed(1)}M</div>
            </div>
          </div>
        </div>

        {/* Event Modal */}
        {pendingEvent && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-5 rounded-lg max-w-md border-2 border-yellow-600">
              <h2 className="text-lg font-bold mb-2">{pendingEvent.name}</h2>
              <p className="text-gray-300 mb-4">{pendingEvent.description}</p>
              <div className="space-y-2">
                {pendingEvent.choices.map((choice, i) => (
                  <button key={i} onClick={() => handleEventChoice(i)} disabled={cash < choice.cost}
                    className={`w-full p-3 rounded text-left ${cash >= choice.cost ? 'bg-gray-700 hover:bg-gray-600' : 'opacity-50'}`}>
                    {choice.text}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main Layout */}
        <div className="grid grid-cols-12 gap-2">
          
          {/* Sites Column */}
          <div className="col-span-2 bg-gray-800 p-2 rounded">
            <div className="font-bold mb-1 border-b border-gray-700 pb-1">
              Sites ({sites.filter(s => !s.developed && !s.takenByCompetitor).length}/10)
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {sites.map((site, i) => (
                <div key={i}
                  className={`p-1.5 rounded cursor-pointer ${
                    site.takenByCompetitor ? 'bg-red-900/50' :
                    site.developed ? 'bg-gray-700/50 opacity-50' :
                    site.underConstruction ? 'bg-yellow-900/50' :
                    selectedSite === i ? 'bg-blue-800' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  style={{ borderLeft: `3px solid ${site.color}` }}
                  onClick={() => !site.developed && !site.takenByCompetitor && setSelectedSite(selectedSite === i ? null : i)}>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{site.name}</span>
                    {site.secured && !site.developed && !site.underConstruction && <span className="text-blue-400">🔒</span>}
                    {site.underConstruction && <span className="text-yellow-400">🏗️ {site.constructionCompleteYear}</span>}
                    {site.developed && !site.takenByCompetitor && <span className="text-green-400">✓</span>}
                  </div>
                  {site.takenByCompetitor && (
                    <div className="text-red-400 text-xs mt-0.5">Competitor has taken</div>
                  )}
                  {site.investigated > 0 && !site.developed && !site.takenByCompetitor && (
                    <div className="text-gray-400 text-xs mt-0.5">
                      {site.revealedTemp?.min === site.revealedTemp?.max 
                        ? `${site.revealedTemp?.min}°C` 
                        : `${site.revealedTemp?.min}-${site.revealedTemp?.max}°C`}
                      {site.revealedDrillingCost && ` | €${site.revealedDrillingCost.min}-${site.revealedDrillingCost.max}M`}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            {selectedSite !== null && !sites[selectedSite].developed && !sites[selectedSite].takenByCompetitor && !sites[selectedSite].underConstruction && (
              <div className="mt-2 pt-2 border-t border-gray-700 space-y-2">
                <div className="text-xs text-gray-400">Actions for {sites[selectedSite].name}</div>
                <div className="flex flex-wrap gap-1">
                  {sites[selectedSite].investigated < 1 && (
                    <button onClick={() => investigateSite(selectedSite, 1)} disabled={cash < 0.5}
                      className="bg-blue-600 disabled:bg-gray-600 px-2 py-1 rounded text-xs">Survey €0.5M</button>
                  )}
                  {sites[selectedSite].investigated >= 1 && sites[selectedSite].investigated < 2 && (
                    <button onClick={() => investigateSite(selectedSite, 2)} disabled={cash < 1.5}
                      className="bg-blue-600 disabled:bg-gray-600 px-2 py-1 rounded text-xs">Detail €1.5M</button>
                  )}
                  {sites[selectedSite].investigated >= 2 && sites[selectedSite].investigated < 3 && (
                    <button onClick={() => investigateSite(selectedSite, 3)} disabled={cash < 4}
                      className="bg-blue-600 disabled:bg-gray-600 px-2 py-1 rounded text-xs">Test €4M</button>
                  )}
                  {!sites[selectedSite].secured && (
                    <button onClick={() => secureSite(selectedSite)} disabled={cash < SECURE_COST}
                      className="bg-purple-600 disabled:bg-gray-600 px-2 py-1 rounded text-xs">Secure €{SECURE_COST}M</button>
                  )}
                </div>
                {sites[selectedSite].secured && sites[selectedSite].investigated > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs">Flow:</span>
                    <input type="range" min="20" max="100" value={developmentFlow}
                      onChange={(e) => setDevelopmentFlow(parseInt(e.target.value))} className="w-16 h-3" />
                    <span className="text-xs">{developmentFlow} kg/s</span>
                    <button onClick={() => startDevelopment(selectedSite, developmentFlow)}
                      disabled={cash < sites[selectedSite].trueDrillingCost}
                      className="bg-green-600 disabled:bg-gray-600 px-2 py-1 rounded text-xs">
                      Drill €{sites[selectedSite].trueDrillingCost}M
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Doublets Column - Individual Cards with Charts */}
          <div className="col-span-6 bg-gray-800 p-2 rounded">
            <div className="font-bold mb-1 border-b border-gray-700 pb-1">
              Doublets ({doublets.filter(d => !d.abandoned).length}/{MAX_DOUBLETS})
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
              {doublets.map(d => (
                <div key={d.id} 
                  className={`p-2 rounded ${d.abandoned ? 'opacity-40' : ''}`}
                  style={{ borderLeft: `4px solid ${d.color}`, backgroundColor: 'rgba(31,41,55,0.8)' }}>
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <div className="font-bold">{d.siteName}</div>
                      <div className="text-gray-400">{d.currentTemp.toFixed(0)}°C | {d.flowRate}kg/s | {getHeatOutput(d).toFixed(1)}MW</div>
                    </div>
                    {!d.abandoned && (
                      <button onClick={() => abandonDoublet(d.id)} 
                        className="text-red-400 hover:text-red-300 text-xs px-1">Abandon</button>
                    )}
                  </div>
                  <TempBar temp={d.currentTemp} />
                  
                  {/* Three charts per doublet */}
                  <div className="grid grid-cols-3 gap-1 mt-2">
                    <div className="bg-gray-900 p-1 rounded">
                      <div className="text-xs text-gray-500 mb-0.5">Temp °C</div>
                      <Sparkline data={d.tempHistory} dataKey="temp" color="#f59e0b" height={28} width={55} />
                    </div>
                    <div className="bg-gray-900 p-1 rounded">
                      <div className="text-xs text-gray-500 mb-0.5">Cash €M</div>
                      <Sparkline data={d.cashHistory} dataKey="cash" color="#10b981" height={28} width={55} showZero />
                    </div>
                    <div className="bg-gray-900 p-1 rounded">
                      <div className="text-xs text-gray-500 mb-0.5">Heat GWh</div>
                      <Sparkline data={d.heatHistory} dataKey="heat" color="#3b82f6" height={28} width={55} />
                    </div>
                  </div>
                  {d.abandoned && <div className="text-red-400 text-center mt-1">ABANDONED</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Right Column - Aggregates & Log */}
          <div className="col-span-4 space-y-2">
            {/* Aggregate Charts */}
            <div className="bg-gray-800 p-2 rounded">
              <div className="font-bold mb-2 border-b border-gray-700 pb-1">Portfolio Totals</div>
              <div className="space-y-2">
                <AggregateChart data={aggregateCashHistory} dataKey="cash" color="#10b981" 
                  height={50} title="Total Annual Cash Flow" unit="€M" showZero />
                <AggregateChart data={aggregateHeatHistory} dataKey="heat" color="#f59e0b" 
                  height={50} title="Total Annual Heat Delivered" unit="GWh" />
              </div>
            </div>

            {/* Stats */}
            <div className="bg-gray-800 p-2 rounded">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-900 p-2 rounded">
                  <div className="text-gray-400">Total Heat Delivered</div>
                  <div className="text-lg font-bold text-yellow-400">{totalHeatDelivered.toFixed(0)} GWh</div>
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <div className="text-gray-400">Holding Costs</div>
                  <div className="text-lg font-bold text-purple-400">
                    €{(sites.filter(s => s.secured && !s.developed && !s.underConstruction).length * HOLDING_COST).toFixed(1)}M/yr
                  </div>
                </div>
              </div>
            </div>

            {/* Log */}
            <div className="bg-gray-800 p-2 rounded">
              <div className="font-bold mb-1 border-b border-gray-700 pb-1">Event Log</div>
              <div className="text-gray-300 h-24 overflow-y-auto font-mono text-xs space-y-0.5">
                {gameLog.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            </div>

            {/* Reset Button */}
            <button onClick={resetGame} className="w-full bg-gray-700 hover:bg-gray-600 py-2 rounded text-sm">
              🔄 Reset Game
            </button>
          </div>
        </div>

        {/* Game Over */}
        {gameOver && (
          <div className="mt-2 p-4 bg-red-900 rounded text-center">
            <div className="text-2xl font-bold">GAME OVER</div>
            <div className="text-lg">{totalHeatDelivered.toFixed(0)} GWh delivered over {year - 2025} years</div>
            <button onClick={resetGame} className="mt-2 bg-gray-600 hover:bg-gray-500 px-6 py-2 rounded">
              Play Again
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-2 p-1.5 bg-gray-800 rounded text-xs text-gray-500">
          Exergy: €{BASE_PRICE}/MWh @ ΔT{EXERGY_REFERENCE}°C | Secure €{SECURE_COST}M + €{HOLDING_COST}M/yr | {CONSTRUCTION_DELAY}yr build | {DRILLING_FAILURE_RATE*100}% drill fail
        </div>
      </div>
    </div>
  );
};

export default GeothermalGame;
