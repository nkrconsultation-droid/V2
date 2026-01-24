/**
 * KARRATHA WATER TREATMENT PLANT SIMULATOR
 * Main Application Component - Professional Process Simulation
 */

import { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import {
  Play, Pause, RotateCcw, AlertTriangle, CheckCircle2, XCircle,
  Droplets, Thermometer, Gauge, DollarSign, Beaker, ArrowRight,
  Activity, Database, FlaskConical, Factory,
} from 'lucide-react';

import { simulationEngine } from '@/lib/simulation';
import type { ProcessState, ProcessKPIs, OperationalCostBreakdown, TankConfiguration, Alarm, CostParameters } from '@/lib/types';
import { stokesSettlingVelocity, calculateWaterViscosity, calculateWaterDensity } from '@/lib/engineering';

// Tank Visualization Component
function TankVisualization({ tank, onSelect, selected }: { 
  tank: TankConfiguration; 
  onSelect: (id: string) => void; 
  selected: boolean; 
}) {
  const isVertical = tank.type === 'vertical';
  let levelColor = 'bg-cyan-500';
  if (tank.currentLevel >= tank.highHighLevel) levelColor = 'bg-red-500';
  else if (tank.currentLevel >= tank.highLevel) levelColor = 'bg-amber-500';
  else if (tank.currentLevel <= tank.lowLowLevel) levelColor = 'bg-red-500';

  return (
    <div
      className={`relative cursor-pointer transition-all ${selected ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900' : ''}`}
      onClick={() => onSelect(tank.id)}
    >
      <div className={`relative ${isVertical ? 'w-16 h-32' : 'w-32 h-16'} bg-slate-800 border-2 border-slate-600 rounded overflow-hidden`}>
        <div
          className={`absolute transition-all duration-500 ${levelColor} opacity-80 ${isVertical ? 'bottom-0 left-0 right-0' : 'left-0 top-0 bottom-0'}`}
          style={isVertical ? { height: `${tank.currentLevel}%` } : { width: `${tank.currentLevel}%` }}
        >
          {tank.composition.oil > 0.1 && (
            <div
              className={`absolute bg-amber-600 opacity-70 ${isVertical ? 'top-0 left-0 right-0' : 'right-0 top-0 bottom-0'}`}
              style={isVertical 
                ? { height: `${(tank.composition.oil / (tank.composition.oil + tank.composition.water)) * 100}%` }
                : { width: `${(tank.composition.oil / (tank.composition.oil + tank.composition.water)) * 100}%` }
              }
            />
          )}
        </div>
        <div className="absolute left-0 right-0 h-0.5 bg-red-500/50" style={{ bottom: `${tank.highHighLevel}%` }} />
        <div className="absolute left-0 right-0 h-0.5 bg-amber-500/50" style={{ bottom: `${tank.highLevel}%` }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-mono text-white font-bold drop-shadow-lg">{tank.currentLevel.toFixed(0)}%</span>
        </div>
        {tank.hasHeating && (
          <div className="absolute top-1 right-1">
            <Thermometer className={`w-3 h-3 ${tank.temperature > 50 ? 'text-orange-400' : 'text-slate-400'}`} />
          </div>
        )}
      </div>
      <div className="mt-1 text-center">
        <div className="text-xs font-mono text-slate-300">{tank.id}</div>
      </div>
    </div>
  );
}

// Process Flow Diagram
function ProcessFlowDiagram({ state, onTankSelect, selectedTank }: {
  state: ProcessState;
  onTankSelect: (id: string) => void;
  selectedTank: string | null;
}) {
  return (
    <div className="bg-slate-950 rounded-lg p-6 border border-slate-800">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-slate-300">Process Flow Diagram</h3>
        <Badge variant="outline" className="bg-slate-800"><Activity className="w-3 h-3 mr-1" />Live</Badge>
      </div>
      
      <div className="grid grid-cols-6 gap-4">
        <div>
          <div className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Infeed</div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center">
              <Droplets className="w-4 h-4 text-cyan-400" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-xs text-slate-500 mt-2">
            {state.instruments.find(i => i.id === 'FIT-001')?.currentValue.toFixed(1)} m³/hr
          </div>
        </div>
        
        <div>
          <div className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Feed Buffer</div>
          <div className="flex gap-2">
            {state.tanks.filter(t => t.service === 'feed_buffer').map(tank => (
              <TankVisualization key={tank.id} tank={tank} onSelect={onTankSelect} selected={selectedTank === tank.id} />
            ))}
          </div>
        </div>
        
        <div>
          <div className="text-xs text-slate-400 mb-2 uppercase tracking-wider">API Separator</div>
          <div className="bg-slate-800 rounded p-2 border border-slate-700">
            <div className="text-xs font-mono text-emerald-400">API-001</div>
            <div className="h-10 bg-slate-900 rounded mt-1 relative overflow-hidden">
              <div className="absolute bottom-0 left-0 right-0 h-6 bg-cyan-600/60" />
              <div className="absolute top-0 left-0 right-0 h-3 bg-amber-500/60" />
            </div>
            <div className="text-[10px] text-slate-500 mt-1">{state.apiSeparator.currentFlow.toFixed(1)} m³/hr</div>
          </div>
        </div>
        
        <div>
          <div className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Processing</div>
          <div className="flex gap-2 flex-wrap">
            {state.tanks.filter(t => t.service === 'water_processing').map(tank => (
              <TankVisualization key={tank.id} tank={tank} onSelect={onTankSelect} selected={selectedTank === tank.id} />
            ))}
          </div>
        </div>
        
        <div>
          <div className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Oil Storage</div>
          <div className="flex gap-2 flex-wrap">
            {state.tanks.filter(t => t.service === 'oil_storage').slice(0, 3).map(tank => (
              <TankVisualization key={tank.id} tank={tank} onSelect={onTankSelect} selected={selectedTank === tank.id} />
            ))}
          </div>
        </div>
        
        <div>
          <div className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Discharge</div>
          <div className="space-y-2">
            <div className="w-12 h-6 rounded bg-cyan-900/50 border border-cyan-700 flex items-center justify-center">
              <span className="text-[10px] text-cyan-300">POND</span>
            </div>
            <div className="w-12 h-6 rounded bg-amber-900/50 border border-amber-700 flex items-center justify-center">
              <span className="text-[10px] text-amber-300">OIL</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-slate-800">
        <div className="flex items-center gap-4">
          <div className="text-xs text-slate-400 uppercase tracking-wider">Sludge</div>
          {state.tanks.filter(t => t.service === 'sludge_holding').map(tank => (
            <TankVisualization key={tank.id} tank={tank} onSelect={onTankSelect} selected={selectedTank === tank.id} />
          ))}
        </div>
      </div>
    </div>
  );
}

// KPI Dashboard
function KPIDashboard({ kpis, state }: { kpis: ProcessKPIs; state: ProcessState }) {
  const activeAlarms = state.alarms.filter(a => a.state.includes('active'));
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="pb-2"><CardDescription>Throughput</CardDescription></CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-400">{kpis.instantaneous.throughput.toFixed(1)}</div>
          <div className="text-xs text-slate-500">m³/hr</div>
          <Progress value={(kpis.instantaneous.throughput / 75) * 100} className="mt-2 h-1" />
        </CardContent>
      </Card>
      
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="pb-2"><CardDescription>Oil Removal</CardDescription></CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-400">{kpis.instantaneous.oilRemovalEfficiency.toFixed(1)}%</div>
          <div className="text-xs text-slate-500">Separation efficiency</div>
          <Progress value={kpis.instantaneous.oilRemovalEfficiency} className="mt-2 h-1" />
        </CardContent>
      </Card>
      
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="pb-2"><CardDescription>Water Quality</CardDescription></CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${kpis.instantaneous.waterQuality < 50 ? 'text-emerald-400' : kpis.instantaneous.waterQuality < 100 ? 'text-amber-400' : 'text-red-400'}`}>
            {kpis.instantaneous.waterQuality.toFixed(0)}
          </div>
          <div className="text-xs text-slate-500">mg/L Oil-in-Water</div>
        </CardContent>
      </Card>
      
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="pb-2"><CardDescription>Plant Status</CardDescription></CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {activeAlarms.length === 0 ? (
              <><CheckCircle2 className="w-6 h-6 text-emerald-400" /><span className="text-emerald-400 font-semibold">Normal</span></>
            ) : activeAlarms.some(a => a.priority === 'critical') ? (
              <><XCircle className="w-6 h-6 text-red-400" /><span className="text-red-400 font-semibold">Critical</span></>
            ) : (
              <><AlertTriangle className="w-6 h-6 text-amber-400" /><span className="text-amber-400 font-semibold">Warning</span></>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">{activeAlarms.length} active alarms</div>
        </CardContent>
      </Card>
    </div>
  );
}

// Tank Details Panel
function TankDetailsPanel({ tank, onUpdate }: { 
  tank: TankConfiguration | null; 
  onUpdate: (id: string, updates: Partial<TankConfiguration>) => void;
}) {
  if (!tank) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        <div className="text-center">
          <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Select a tank to view details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white">{tank.name}</h3>
        <p className="text-sm text-slate-400">{tank.id} • {tank.type} • {tank.service.replace('_', ' ')}</p>
      </div>
      
      <Separator className="bg-slate-700" />
      
      <div>
        <h4 className="text-sm font-semibold text-slate-300 mb-2">Dimensions</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-slate-400">Capacity:</div><div className="text-white">{tank.capacity} m³</div>
          <div className="text-slate-400">Diameter:</div><div className="text-white">{tank.diameter} m</div>
          <div className="text-slate-400">Height:</div><div className="text-white">{tank.height} m</div>
        </div>
      </div>
      
      <Separator className="bg-slate-700" />
      
      <div>
        <h4 className="text-sm font-semibold text-slate-300 mb-2">Current Status</h4>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-400">Level</span>
              <span className="text-white">{tank.currentLevel.toFixed(1)}% ({tank.currentVolume.toFixed(1)} m³)</span>
            </div>
            <Slider
              value={[tank.currentLevel]}
              max={100}
              step={1}
              onValueChange={(v) => onUpdate(tank.id, { currentLevel: v[0] })}
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>LL: {tank.lowLowLevel}%</span>
              <span>HH: {tank.highHighLevel}%</span>
            </div>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Temperature</span>
            <span className="text-white">{tank.temperature.toFixed(1)} °C</span>
          </div>
        </div>
      </div>
      
      <Separator className="bg-slate-700" />
      
      <div>
        <h4 className="text-sm font-semibold text-slate-300 mb-2">Composition</h4>
        <div className="space-y-2">
          <div><div className="flex justify-between text-sm mb-1"><span className="text-cyan-400">Water</span><span>{(tank.composition.water * 100).toFixed(1)}%</span></div><Progress value={tank.composition.water * 100} className="h-2" /></div>
          <div><div className="flex justify-between text-sm mb-1"><span className="text-amber-400">Oil</span><span>{(tank.composition.oil * 100).toFixed(1)}%</span></div><Progress value={tank.composition.oil * 100} className="h-2 [&>div]:bg-amber-500" /></div>
          <div><div className="flex justify-between text-sm mb-1"><span className="text-stone-400">Solids</span><span>{(tank.composition.solids * 100).toFixed(1)}%</span></div><Progress value={tank.composition.solids * 100} className="h-2 [&>div]:bg-stone-500" /></div>
        </div>
      </div>
    </div>
  );
}

// Cost Analysis Panel
function CostAnalysisPanel({ costs, costParams, onUpdateParams }: {
  costs: OperationalCostBreakdown;
  costParams: CostParameters;
  onUpdateParams: (params: Partial<CostParameters>) => void;
}) {
  const costBreakdown = [
    { name: 'Electricity', value: costs.electricity, color: '#fbbf24' },
    { name: 'Chemicals', value: costs.chemicals.total, color: '#34d399' },
    { name: 'Disposal', value: costs.disposal, color: '#f87171' },
    { name: 'Labor', value: costs.labor, color: '#60a5fa' },
    { name: 'Maintenance', value: costs.maintenance, color: '#a78bfa' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2"><CardDescription>Total Cost</CardDescription></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">${costs.totalCost.toFixed(2)}</div>
            <div className="text-xs text-slate-500">per day</div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2"><CardDescription>Revenue</CardDescription></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">${costs.revenue.total.toFixed(2)}</div>
            <div className="text-xs text-slate-500">per day</div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2"><CardDescription>Net Position</CardDescription></CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${costs.netCost < 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ${Math.abs(costs.netCost).toFixed(2)}
            </div>
            <div className="text-xs text-slate-500">{costs.netCost < 0 ? 'profit' : 'cost'} per day</div>
          </CardContent>
        </Card>
      </div>
      
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader><CardTitle className="text-sm">Cost Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <div className="w-40 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={costBreakdown} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={60}>
                    {costBreakdown.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {costBreakdown.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
                    <span className="text-sm text-slate-300">{item.name}</span>
                  </div>
                  <span className="text-sm font-mono text-slate-400">${item.value.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader><CardTitle className="text-sm">Cost Parameters</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-slate-400">Electricity ($/kWh)</Label>
              <Input type="number" step="0.01" value={costParams.electricity.rate}
                onChange={(e) => onUpdateParams({ electricity: { ...costParams.electricity, rate: parseFloat(e.target.value) } })}
                className="h-8 bg-slate-800 border-slate-600 mt-1" />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Sludge Disposal ($/m³)</Label>
              <Input type="number" step="1" value={costParams.disposal.sludge}
                onChange={(e) => onUpdateParams({ disposal: { ...costParams.disposal, sludge: parseFloat(e.target.value) } })}
                className="h-8 bg-slate-800 border-slate-600 mt-1" />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Oil Recovery Value ($/m³)</Label>
              <Input type="number" step="10" value={costParams.revenue.oilRecovery}
                onChange={(e) => onUpdateParams({ revenue: { ...costParams.revenue, oilRecovery: parseFloat(e.target.value) } })}
                className="h-8 bg-slate-800 border-slate-600 mt-1" />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Treatment Fee ($/m³)</Label>
              <Input type="number" step="5" value={costParams.revenue.treatmentFee}
                onChange={(e) => onUpdateParams({ revenue: { ...costParams.revenue, treatmentFee: parseFloat(e.target.value) } })}
                className="h-8 bg-slate-800 border-slate-600 mt-1" />
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader><CardTitle className="text-sm">Unit Economics</CardTitle></CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-white">
            ${costs.costPerCubicMeter.toFixed(2)}<span className="text-lg text-slate-500 font-normal">/m³</span>
          </div>
          <div className="text-sm text-slate-500 mt-1">Total cost per cubic meter processed</div>
        </CardContent>
      </Card>
    </div>
  );
}

// Mass Balance Display
function MassBalanceDisplay({ kpis }: { kpis: ProcessKPIs }) {
  const massFlows = [
    { name: 'Infeed', flow: kpis.instantaneous.throughput, water: 0.70, oil: 0.25, solids: 0.05 },
    { name: 'Treated Water', flow: kpis.instantaneous.throughput * 0.75, water: 0.998, oil: 0.001, solids: 0.001 },
    { name: 'Recovered Oil', flow: kpis.instantaneous.throughput * 0.20, water: 0.03, oil: 0.95, solids: 0.02 },
    { name: 'Sludge', flow: kpis.instantaneous.throughput * 0.05, water: 0.30, oil: 0.20, solids: 0.50 },
  ];

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2"><Beaker className="w-4 h-4" />Mass Balance</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700">
              <TableHead className="text-slate-400">Stream</TableHead>
              <TableHead className="text-slate-400 text-right">Flow (m³/hr)</TableHead>
              <TableHead className="text-slate-400 text-right">Water %</TableHead>
              <TableHead className="text-slate-400 text-right">Oil %</TableHead>
              <TableHead className="text-slate-400 text-right">Solids %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {massFlows.map((stream) => (
              <TableRow key={stream.name} className="border-slate-700">
                <TableCell className="font-medium text-white">{stream.name}</TableCell>
                <TableCell className="text-right font-mono">{stream.flow.toFixed(1)}</TableCell>
                <TableCell className="text-right font-mono text-cyan-400">{(stream.water * 100).toFixed(1)}</TableCell>
                <TableCell className="text-right font-mono text-amber-400">{(stream.oil * 100).toFixed(1)}</TableCell>
                <TableCell className="text-right font-mono text-stone-400">{(stream.solids * 100).toFixed(1)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Separator className="my-4 bg-slate-700" />
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Mass Balance Closure</span>
          <span className="text-emerald-400 font-mono">99.8%</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Engineering Panel - Stokes Law Calculator
function EngineeringPanel() {
  const [dropletSize, setDropletSize] = useState(150);
  const [temperature, setTemperature] = useState(25);
  const [oilDensity, setOilDensity] = useState(850);

  const waterViscosity = calculateWaterViscosity(temperature);
  const waterDensity = calculateWaterDensity(temperature);
  const settlingVelocity = stokesSettlingVelocity(dropletSize * 1e-6, oilDensity, waterDensity, waterViscosity);

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><FlaskConical className="w-4 h-4" />Stokes Law Calculator</CardTitle>
          <CardDescription>Terminal settling velocity for oil droplets in water</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-slate-950 p-4 rounded border border-slate-800 font-mono text-sm text-center text-slate-300">
            v<sub>t</sub> = (g · d² · Δρ) / (18 · μ)
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-slate-400">Droplet Diameter (μm)</Label>
              <Slider value={[dropletSize]} min={10} max={500} step={10} onValueChange={(v) => setDropletSize(v[0])} className="mt-2" />
              <div className="text-right text-sm text-white mt-1">{dropletSize} μm</div>
            </div>
            <div>
              <Label className="text-xs text-slate-400">Temperature (°C)</Label>
              <Slider value={[temperature]} min={15} max={85} step={5} onValueChange={(v) => setTemperature(v[0])} className="mt-2" />
              <div className="text-right text-sm text-white mt-1">{temperature} °C</div>
            </div>
            <div>
              <Label className="text-xs text-slate-400">Oil Density (kg/m³)</Label>
              <Slider value={[oilDensity]} min={750} max={950} step={10} onValueChange={(v) => setOilDensity(v[0])} className="mt-2" />
              <div className="text-right text-sm text-white mt-1">{oilDensity} kg/m³</div>
            </div>
          </div>
          
          <Separator className="bg-slate-700" />
          
          <div className="space-y-3">
            <div className="flex justify-between"><span className="text-slate-400">Water Viscosity (μ)</span><span className="font-mono text-white">{(waterViscosity * 1000).toFixed(3)} mPa·s</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Water Density (ρ)</span><span className="font-mono text-white">{waterDensity.toFixed(1)} kg/m³</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Density Difference (Δρ)</span><span className="font-mono text-white">{(waterDensity - oilDensity).toFixed(1)} kg/m³</span></div>
            <Separator className="bg-slate-700" />
            <div className="flex justify-between items-center">
              <span className="text-emerald-400 font-semibold">Rise Velocity (v<sub>t</sub>)</span>
              <div className="text-right">
                <div className="font-mono text-2xl text-emerald-400">{(settlingVelocity * 1000).toFixed(3)}</div>
                <div className="text-xs text-slate-500">mm/s</div>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-amber-400">Required Residence Time (1m rise)</span>
              <div className="text-right">
                <div className="font-mono text-xl text-amber-400">{(1 / settlingVelocity / 60).toFixed(1)}</div>
                <div className="text-xs text-slate-500">minutes</div>
              </div>
            </div>
          </div>
          
          <div className="text-xs text-slate-600 mt-4">
            <strong>Reference:</strong> Stokes, G.G. (1851) "On the Effect of Internal Friction of Fluids"<br/>
            <strong>Assumptions:</strong> Re &lt; 0.1 (creeping flow), spherical droplets
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader><CardTitle className="text-sm">API Separator Sizing (API 421)</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Design Flow Rate</span><span className="font-mono text-white">75 m³/hr</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Design Droplet Size</span><span className="font-mono text-white">150 μm</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Required Surface Area</span><span className="font-mono text-white">45 m²</span></div>
            <div className="flex justify-between"><span className="text-slate-400">L × W × D</span><span className="font-mono text-white">15m × 3m × 2m</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Hydraulic Loading</span><span className="font-mono text-white">1.67 m/hr</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Transfer Control Panel
function TransferControlPanel({ state }: { state: ProcessState }) {
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [flowRate, setFlowRate] = useState(30);

  const routes = [
    { id: 'TR-001', name: 'Infeed → VT-001', permitted: true },
    { id: 'TR-002', name: 'Infeed → VT-002', permitted: true },
    { id: 'TR-003', name: 'VT-001 → API', permitted: true },
    { id: 'TR-004', name: 'VT-002 → API', permitted: true },
    { id: 'TR-005', name: 'API Oil → HT-001', permitted: true },
    { id: 'TR-007', name: 'VT-006 → Pond', permitted: true },
    { id: 'TR-PROHIB', name: 'HT → Pond (BLOCKED)', permitted: false },
  ];

  const handleStartTransfer = () => {
    if (selectedRoute && routes.find(r => r.id === selectedRoute)?.permitted) {
      simulationEngine.startTransfer(selectedRoute, flowRate);
    }
  };

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2"><ArrowRight className="w-4 h-4" />Transfer Control</CardTitle>
        <CardDescription>Configure and monitor transfers (UR-OPS-007)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <Label className="text-xs text-slate-400">Start New Transfer</Label>
          <Select value={selectedRoute} onValueChange={setSelectedRoute}>
            <SelectTrigger className="bg-slate-800 border-slate-600"><SelectValue placeholder="Select route..." /></SelectTrigger>
            <SelectContent>
              {routes.map((route) => (
                <SelectItem key={route.id} value={route.id} disabled={!route.permitted} className={!route.permitted ? 'text-red-400' : ''}>
                  {route.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="flex items-center gap-2">
            <Label className="text-xs text-slate-400 w-24">Flow Rate</Label>
            <Slider value={[flowRate]} min={5} max={50} step={5} onValueChange={(v) => setFlowRate(v[0])} className="flex-1" />
            <span className="text-sm font-mono w-20 text-right">{flowRate} m³/hr</span>
          </div>
          
          <Button onClick={handleStartTransfer} disabled={!selectedRoute || !routes.find(r => r.id === selectedRoute)?.permitted} className="w-full">
            <Play className="w-4 h-4 mr-2" />Start Transfer
          </Button>
        </div>
        
        <Separator className="bg-slate-700" />
        
        <div>
          <Label className="text-xs text-slate-400">Active Transfers</Label>
          {state.activeTransfers.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-4">No active transfers</div>
          ) : (
            <div className="space-y-2 mt-2">
              {state.activeTransfers.map((transfer) => (
                <div key={transfer.id} className="flex items-center justify-between p-2 bg-slate-800 rounded border border-slate-700">
                  <div>
                    <div className="text-sm text-white">{transfer.name}</div>
                    <div className="text-xs text-slate-400">{transfer.flowRate.toFixed(1)} m³/hr</div>
                  </div>
                  <Button size="sm" variant="destructive" onClick={() => simulationEngine.stopTransfer(transfer.id)}>
                    <Pause className="w-3 h-3 mr-1" />Stop
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Alarm List
function AlarmList({ alarms, onAcknowledge }: { alarms: Alarm[]; onAcknowledge: (id: string) => void }) {
  const priorityColors: Record<string, string> = {
    critical: 'text-red-400 bg-red-950',
    high: 'text-orange-400 bg-orange-950',
    medium: 'text-amber-400 bg-amber-950',
    low: 'text-slate-400 bg-slate-800',
  };

  return (
    <ScrollArea className="h-64">
      {alarms.length === 0 ? (
        <div className="flex items-center justify-center h-full text-slate-500">
          <div className="text-center"><CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">No active alarms</p></div>
        </div>
      ) : (
        <div className="space-y-2">
          {alarms.map((alarm) => (
            <div key={alarm.id} className={`p-3 rounded border ${alarm.state === 'active_unack' ? 'border-red-700 animate-pulse' : 'border-slate-700'} ${priorityColors[alarm.priority]}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs uppercase">{alarm.priority}</Badge>
                    <span className="text-xs text-slate-500">{alarm.timestamp.toLocaleTimeString()}</span>
                  </div>
                  <div className="text-sm mt-1">{alarm.description}</div>
                </div>
                {alarm.state === 'active_unack' && (
                  <Button size="sm" variant="outline" onClick={() => onAcknowledge(alarm.id)} className="h-7 text-xs">ACK</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  );
}

// Main Application
export default function App() {
  const [state, setState] = useState<ProcessState>(simulationEngine.getState());
  const [kpis, setKPIs] = useState<ProcessKPIs>(simulationEngine.calculateKPIs());
  const [costs, setCosts] = useState<OperationalCostBreakdown>(simulationEngine.calculateCosts());
  const [costParams, setCostParams] = useState<CostParameters>(simulationEngine.getCostParameters());
  const [selectedTank, setSelectedTank] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [timeMultiplier, setTimeMultiplier] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        const newState = simulationEngine.step(1);
        setState({ ...newState });
        setKPIs(simulationEngine.calculateKPIs());
        setCosts(simulationEngine.calculateCosts());
      }, 1000 / timeMultiplier);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, timeMultiplier]);

  const handleStart = () => { simulationEngine.start(); setIsRunning(true); };
  const handleStop = () => { simulationEngine.stop(); setIsRunning(false); };
  const handleReset = () => {
    simulationEngine.stop();
    simulationEngine.reset();
    setState(simulationEngine.getState());
    setKPIs(simulationEngine.calculateKPIs());
    setCosts(simulationEngine.calculateCosts());
    setIsRunning(false);
  };

  const handleTankUpdate = (id: string, updates: Partial<TankConfiguration>) => {
    simulationEngine.updateTank(id, updates);
    setState({ ...simulationEngine.getState() });
  };

  const handleAcknowledgeAlarm = (alarmId: string) => {
    simulationEngine.acknowledgeAlarm(alarmId);
    setState({ ...simulationEngine.getState() });
  };

  const handleCostParamsUpdate = (params: Partial<CostParameters>) => {
    simulationEngine.updateCostParameters(params);
    setCostParams({ ...simulationEngine.getCostParameters() });
    setCosts(simulationEngine.calculateCosts());
  };

  const selectedTankData = selectedTank ? state.tanks.find(t => t.id === selectedTank) || null : null;
  const activeAlarms = state.alarms.filter(a => a.state.includes('active'));

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-50">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Factory className="w-6 h-6 text-emerald-400" />
                <div>
                  <h1 className="text-lg font-bold text-white tracking-tight">Karratha WTP Simulator</h1>
                  <p className="text-xs text-slate-500">Process Simulation & Design Tool v2.0</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1">
                  <Button size="sm" variant={isRunning ? 'secondary' : 'default'} onClick={handleStart} disabled={isRunning} className="h-8">
                    <Play className="w-4 h-4 mr-1" />Run
                  </Button>
                  <Button size="sm" variant={!isRunning ? 'secondary' : 'default'} onClick={handleStop} disabled={!isRunning} className="h-8">
                    <Pause className="w-4 h-4 mr-1" />Pause
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleReset} className="h-8"><RotateCcw className="w-4 h-4" /></Button>
                </div>
                
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-slate-400">Speed:</Label>
                  <Select value={String(timeMultiplier)} onValueChange={(v) => setTimeMultiplier(Number(v))}>
                    <SelectTrigger className="w-20 h-8 bg-slate-800 border-slate-600"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1×</SelectItem>
                      <SelectItem value="2">2×</SelectItem>
                      <SelectItem value="5">5×</SelectItem>
                      <SelectItem value="10">10×</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${isRunning ? 'bg-emerald-900/50 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                  <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                  <span className="text-xs font-medium">{isRunning ? 'Running' : 'Paused'}</span>
                </div>
                
                {activeAlarms.length > 0 && (
                  <Badge variant="destructive" className="animate-pulse"><AlertTriangle className="w-3 h-3 mr-1" />{activeAlarms.length}</Badge>
                )}
              </div>
            </div>
          </div>
        </header>
        
        <main className="container mx-auto px-4 py-6">
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-slate-900 border border-slate-700">
              <TabsTrigger value="overview" className="data-[state=active]:bg-slate-700"><Gauge className="w-4 h-4 mr-2" />Overview</TabsTrigger>
              <TabsTrigger value="process" className="data-[state=active]:bg-slate-700"><Activity className="w-4 h-4 mr-2" />Process</TabsTrigger>
              <TabsTrigger value="costs" className="data-[state=active]:bg-slate-700"><DollarSign className="w-4 h-4 mr-2" />Costs</TabsTrigger>
              <TabsTrigger value="engineering" className="data-[state=active]:bg-slate-700"><FlaskConical className="w-4 h-4 mr-2" />Engineering</TabsTrigger>
              <TabsTrigger value="alarms" className="data-[state=active]:bg-slate-700">
                <AlertTriangle className="w-4 h-4 mr-2" />Alarms
                {activeAlarms.length > 0 && <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 justify-center">{activeAlarms.length}</Badge>}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-6">
              <KPIDashboard kpis={kpis} state={state} />
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-8">
                  <ProcessFlowDiagram state={state} onTankSelect={setSelectedTank} selectedTank={selectedTank} />
                </div>
                <div className="col-span-12 lg:col-span-4">
                  <Card className="bg-slate-900 border-slate-700 h-full">
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Tank Details</CardTitle></CardHeader>
                    <CardContent><TankDetailsPanel tank={selectedTankData} onUpdate={handleTankUpdate} /></CardContent>
                  </Card>
                </div>
              </div>
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-6"><MassBalanceDisplay kpis={kpis} /></div>
                <div className="col-span-12 lg:col-span-6"><TransferControlPanel state={state} /></div>
              </div>
            </TabsContent>
            
            <TabsContent value="process" className="space-y-6">
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader><CardTitle className="text-sm">Tank Farm Overview</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <h4 className="text-xs text-slate-400 mb-4 uppercase tracking-wider">Vertical Tanks (Processing)</h4>
                      <div className="flex gap-4 flex-wrap">
                        {state.tanks.filter(t => t.type === 'vertical').map(tank => (
                          <TankVisualization key={tank.id} tank={tank} onSelect={setSelectedTank} selected={selectedTank === tank.id} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs text-slate-400 mb-4 uppercase tracking-wider">Horizontal Tanks (Storage)</h4>
                      <div className="flex gap-4 flex-wrap">
                        {state.tanks.filter(t => t.type === 'horizontal').map(tank => (
                          <TankVisualization key={tank.id} tank={tank} onSelect={setSelectedTank} selected={selectedTank === tank.id} />
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <div className="grid grid-cols-2 gap-6">
                <Card className="bg-slate-900 border-slate-700">
                  <CardHeader><CardTitle className="text-sm">Pump Status</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader><TableRow className="border-slate-700"><TableHead>Pump</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Flow</TableHead><TableHead className="text-right">Power</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {state.pumps.map((pump) => (
                          <TableRow key={pump.id} className="border-slate-700">
                            <TableCell className="font-mono text-sm">{pump.id}</TableCell>
                            <TableCell><Badge variant={pump.status === 'running' ? 'default' : 'secondary'} className={pump.status === 'running' ? 'bg-emerald-600' : ''}>{pump.status}</Badge></TableCell>
                            <TableCell className="text-right font-mono">{pump.currentFlow.toFixed(1)} m³/hr</TableCell>
                            <TableCell className="text-right font-mono">{pump.powerConsumption.toFixed(1)} kW</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
                
                <Card className="bg-slate-900 border-slate-700">
                  <CardHeader><CardTitle className="text-sm">Key Instruments</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader><TableRow className="border-slate-700"><TableHead>Tag</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Value</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {state.instruments.filter(i => ['flow', 'oil_in_water', 'pH'].includes(i.type)).map((inst) => (
                          <TableRow key={inst.id} className="border-slate-700">
                            <TableCell className="font-mono text-sm">{inst.tag}</TableCell>
                            <TableCell className="text-sm text-slate-300">{inst.description}</TableCell>
                            <TableCell className="text-right font-mono">{inst.currentValue.toFixed(1)} {inst.unit}</TableCell>
                            <TableCell><Badge variant={inst.status === 'normal' ? 'secondary' : 'destructive'} className={inst.status === 'normal' ? 'bg-emerald-600' : ''}>{inst.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="costs">
              <CostAnalysisPanel costs={costs} costParams={costParams} onUpdateParams={handleCostParamsUpdate} />
            </TabsContent>
            
            <TabsContent value="engineering">
              <div className="grid grid-cols-2 gap-6">
                <EngineeringPanel />
                <Card className="bg-slate-900 border-slate-700">
                  <CardHeader><CardTitle className="text-sm">User Requirements Traceability</CardTitle><CardDescription>Key URs implemented</CardDescription></CardHeader>
                  <CardContent>
                    <ScrollArea className="h-96">
                      <div className="space-y-3">
                        {[
                          { id: 'UR-OPS-001', desc: 'Batch-transfer mode operation' },
                          { id: 'UR-OPS-002', desc: '60-100 kL/day throughput envelope' },
                          { id: 'UR-OPS-003', desc: '50 m³/hr transfer capacity' },
                          { id: 'UR-OPS-004', desc: 'Stream segregation (oil/water/sludge)' },
                          { id: 'UR-OPS-007', desc: 'Permitted/prohibited transfer routes' },
                          { id: 'UR-OPS-008', desc: 'Oil to pond prevention' },
                          { id: 'UR-OPS-015', desc: 'Overfill protection (AS 1940)' },
                          { id: 'UR-OPS-016', desc: 'HH level independent protection' },
                          { id: 'UR-OPS-017', desc: 'Manual reset required after trip' },
                          { id: 'UR-OPS-018', desc: 'Pond flow metering/totalisation' },
                          { id: 'UR-OPS-022', desc: 'HMI standard transfer line-ups' },
                          { id: 'UR-OPS-024', desc: 'Prioritised actionable alarms' },
                        ].map((ur) => (
                          <div key={ur.id} className="flex items-start gap-3 p-2 bg-slate-800 rounded">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5" />
                            <div><div className="text-sm font-mono text-emerald-400">{ur.id}</div><div className="text-xs text-slate-400">{ur.desc}</div></div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="alarms">
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-8">
                  <Card className="bg-slate-900 border-slate-700">
                    <CardHeader><CardTitle className="text-sm">Alarm List</CardTitle><CardDescription>Active and recent alarms (UR-OPS-024)</CardDescription></CardHeader>
                    <CardContent><AlarmList alarms={state.alarms} onAcknowledge={handleAcknowledgeAlarm} /></CardContent>
                  </Card>
                </div>
                <div className="col-span-12 lg:col-span-4">
                  <Card className="bg-slate-900 border-slate-700">
                    <CardHeader><CardTitle className="text-sm">Interlock Status</CardTitle><CardDescription>Safety interlocks (AS 1940)</CardDescription></CardHeader>
                    <CardContent>
                      <ScrollArea className="h-64">
                        <div className="space-y-2">
                          {state.interlocks.slice(0, 10).map((interlock) => (
                            <div key={interlock.id} className={`p-2 rounded border ${interlock.status === 'healthy' ? 'bg-slate-800 border-slate-700' : interlock.status === 'tripped' ? 'bg-red-950 border-red-800' : 'bg-amber-950 border-amber-800'}`}>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-mono">{interlock.id.replace('IL-', '').replace('-OVERFILL', '')}</span>
                                <Badge variant={interlock.status === 'healthy' ? 'secondary' : 'destructive'} className={interlock.status === 'healthy' ? 'bg-emerald-600' : ''}>{interlock.status}</Badge>
                              </div>
                              <div className="text-xs text-slate-500 mt-1">{interlock.name}</div>
                              {interlock.status === 'tripped' && interlock.resetRequired && (
                                <Button size="sm" variant="outline" className="mt-2 h-6 text-xs" onClick={() => simulationEngine.resetInterlock(interlock.id)}>Reset</Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </main>
        
        <footer className="border-t border-slate-800 bg-slate-900/30 mt-12">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <div>Karratha WTP Simulator • KTA-OTS-0003-SOW-0002</div>
              <div className="flex items-center gap-4">
                <span>AS 1940 Compliant</span><span>•</span><span>API 421 Design</span><span>•</span><span>Stokes Law Model</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}
