import { useEffect, useRef, useState } from 'react'
import type { ReactNode, ElementType, ComponentProps } from 'react'
import {
  LayoutDashboard, Cpu, Activity, BrainCircuit, BarChart3,
  Wrench, Settings, Search, Plus, Pencil, Trash2, Bell,
  Menu, X, Factory, Thermometer, Gauge, AlertTriangle,
  CheckCircle2, Clock, Download, TrendingUp, CalendarDays
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import { supabase } from './lib/supabase'

// ---------------- TYPES ----------------

type Machine = {
  id: string
  machine_code: string
  name: string
  machine_type: string
  status: 'Running' | 'Warning' | 'Maintenance' | 'Stopped'
  temperature: number
  efficiency: number
}

type Sensor = {
  temperature: number
  vibration: number
  health: number
}

type ProductionRecord = {
  id: string
  machine_id: string
  machine: string
  date: string
  target: number
  actual: number
  notes: string
}

type MaintenanceRecord = {
  id: string
  machine_id: string
  machine: string
  type: string
  date: string
  technician: string
  status: 'Scheduled' | 'In Progress' | 'Completed'
  notes: string
}

type SensorInsertRow = {
  user_id: string
  machine_id: string
  temperature: number
  vibration: number
  health_score: number
}

// ---------------- HELPERS ----------------

function makeCode(prefix: string) {
  return `${prefix}-${Date.now().toString().slice(-7)}`
}

function today() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows.map(row =>
    row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')
  ).join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.click()

  URL.revokeObjectURL(url)
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Running: 'bg-emerald-500/15 text-emerald-400',
    Warning: 'bg-amber-500/15 text-amber-400',
    Maintenance: 'bg-blue-500/15 text-blue-400',
    Stopped: 'bg-red-500/15 text-red-400',
    Scheduled: 'bg-blue-500/15 text-blue-400',
    'In Progress': 'bg-amber-500/15 text-amber-400',
    Completed: 'bg-emerald-500/15 text-emerald-400',
    Healthy: 'bg-emerald-500/15 text-emerald-400',
    Critical: 'bg-red-500/15 text-red-400',
    Low: 'bg-emerald-500/15 text-emerald-400',
    Medium: 'bg-amber-500/15 text-amber-400',
    High: 'bg-red-500/15 text-red-400',
  }

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status] || 'bg-slate-700 text-slate-300'}`}>
      {status}
    </span>
  )
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/80 p-5 ${className}`}>
      {children}
    </div>
  )
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
    </div>
  )
}

function StatCard({
  title, value, subtitle, icon: Icon, color
}: {
  title: string
  value: string
  subtitle: string
  icon: ElementType
  color: string
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <h3 className="mt-2 text-3xl font-bold text-white">{value}</h3>
          <p className="mt-2 text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className={`rounded-xl p-3 ${color}`}>
          <Icon size={24} />
        </div>
      </div>
    </Card>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className="py-10 text-center text-sm text-slate-500">{message}</div>
}

function TargetIcon(props: ComponentProps<typeof TrendingUp>) {
  return <TrendingUp {...props} />
}

// ---------------- MAIN APP ----------------

export default function App() {
  const [activePage, setActivePage] = useState('Dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [machines, setMachines] = useState<Machine[]>([])
  const [production, setProduction] = useState<ProductionRecord[]>([])
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([])
  const [sensors, setSensors] = useState<Record<string, Sensor>>({})
  const [history, setHistory] = useState<
    { time: string; temperature: number; vibration: number }[]
  >([])

  const sensorRef = useRef<Record<string, Sensor>>({})
  const machinesRef = useRef<Machine[]>([])

  useEffect(() => {
    sensorRef.current = sensors
  }, [sensors])

  useEffect(() => {
    machinesRef.current = machines
  }, [machines])

  // ---------------- LOAD SUPABASE DATA ----------------

  async function loadData(uid: string) {
    setError('')

    const [
      machineResult,
      productionResult,
      maintenanceResult,
      sensorResult
    ] = await Promise.all([
      supabase.from('machines')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: true }),

      supabase.from('production_records')
        .select('*')
        .eq('user_id', uid)
        .order('production_date', { ascending: false }),

      supabase.from('maintenance_records')
        .select('*')
        .eq('user_id', uid)
        .order('scheduled_date', { ascending: true }),

      supabase.from('sensor_readings')
        .select('*')
        .eq('user_id', uid)
        .order('recorded_at', { ascending: false })
        .limit(200),
    ])

    const firstError =
      machineResult.error ||
      productionResult.error ||
      maintenanceResult.error ||
      sensorResult.error

    if (firstError) {
      throw firstError
    }

    const machineRows = (machineResult.data || []) as any[]

    const machineData: Machine[] = machineRows.map(row => ({
      id: row.id,
      machine_code: row.machine_code,
      name: row.name,
      machine_type: row.machine_type || 'General',
      status: row.status,
      temperature: Number(row.temperature || 0),
      efficiency: Number(row.efficiency || 0),
    }))

    const machineMap = new Map(
      machineData.map(machine => [machine.id, machine.name])
    )

    const productionData: ProductionRecord[] =
      (productionResult.data || []).map((row: any) => ({
        id: row.id,
        machine_id: row.machine_id,
        machine: machineMap.get(row.machine_id) || 'Unknown Machine',
        date: row.production_date,
        target: Number(row.target_units || 0),
        actual: Number(row.actual_units || 0),
        notes: row.notes || '',
      }))

    const maintenanceData: MaintenanceRecord[] =
      (maintenanceResult.data || []).map((row: any) => ({
        id: row.id,
        machine_id: row.machine_id,
        machine: machineMap.get(row.machine_id) || 'Unknown Machine',
        type: row.task,
        date: row.scheduled_date,
        technician: row.technician,
        status: row.status,
        notes: row.notes || '',
      }))

    const sensorData: Record<string, Sensor> = {}

    // Results are newest first, so keep the first reading per machine.
    for (const row of sensorResult.data || []) {
      if (!sensorData[row.machine_id]) {
        sensorData[row.machine_id] = {
          temperature: Number(row.temperature || 0),
          vibration: Number(row.vibration || 0),
          health: Number(row.health_score || 0),
        }
      }
    }

    for (const machine of machineData) {
      if (!sensorData[machine.id]) {
        sensorData[machine.id] = {
          temperature: machine.temperature,
          vibration: 1.5,
          health: machine.efficiency,
        }
      }
    }

    setMachines(machineData)
    setProduction(productionData)
    setMaintenance(maintenanceData)
    setSensors(sensorData)
  }

  // ---------------- AUTHENTICATION ----------------

  useEffect(() => {
    let mounted = true

    async function start() {
      try {
        setLoading(true)

        const { data, error: authError } = await supabase.auth.getUser()

        if (authError) throw authError

        if (!data.user) {
          throw new Error('User login nahi hai. Pehle login karke dashboard kholo.')
        }

        if (!mounted) return

        setUserId(data.user.id)
        await loadData(data.user.id)
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Data load nahi ho paya.')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    start()

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return

        if (session?.user) {
          setUserId(session.user.id)

          loadData(session.user.id).catch(err => {
            if (mounted) {
              setError(err.message || 'Data refresh nahi ho paya.')
            }
          })
        } else {
          setUserId(null)
          setMachines([])
          setProduction([])
          setMaintenance([])
          setSensors({})
          setHistory([])
        }
      }
    )

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  // ---------------- ERROR HANDLING ----------------

  async function perform(action: () => Promise<void>) {
    try {
      setError('')
      await action()
    } catch (err: any) {
      const message = err?.message || 'Operation failed.'
      setError(message)
      window.alert(message)
    }
  }

  // ---------------- SENSOR SIMULATION ----------------

  useEffect(() => {
    if (!machines.length) return

    const timer = window.setInterval(() => {
      setSensors(previous => {
        const updated = { ...previous }

        machines.forEach(machine => {
          if (machine.status === 'Running' || machine.status === 'Warning') {
            const old = previous[machine.id] || {
              temperature: machine.temperature,
              vibration: 2,
              health: machine.efficiency,
            }

            updated[machine.id] = {
              temperature: Number(
                Math.max(25, Math.min(110, old.temperature + Math.random() * 3 - 1.5)).toFixed(1)
              ),
              vibration: Number(
                Math.max(0.5, Math.min(8, old.vibration + Math.random() * 0.8 - 0.4)).toFixed(1)
              ),
              health: Number(
                Math.max(10, Math.min(100, old.health + Math.random() * 0.6 - 0.3)).toFixed(1)
              ),
            }
          }
        })

        return updated
      })
    }, 2500)

    return () => window.clearInterval(timer)
  }, [machines])

  // ---------------- SAVE SENSOR READINGS ----------------

  useEffect(() => {
    if (!userId || !machines.length) return

    const timer = window.setInterval(async () => {
      const currentMachines = machinesRef.current
      const currentSensors = sensorRef.current

      // Build a properly typed array. No null values are added.
      const rows: SensorInsertRow[] = []

      for (const machine of currentMachines) {
        if (
          machine.status !== 'Running' &&
          machine.status !== 'Warning'
        ) {
          continue
        }

        const sensor = currentSensors[machine.id]

        if (!sensor) continue

        rows.push({
          user_id: userId,
          machine_id: machine.id,
          temperature: Number(sensor.temperature),
          vibration: Number(sensor.vibration),
          health_score: Number(sensor.health),
        })
      }

      if (rows.length > 0) {
        const { error: insertError } = await supabase
          .from('sensor_readings')
          .insert(rows)

        if (insertError) {
          console.error('Sensor insert error:', insertError.message)
          setError(insertError.message)
        }
      }
    }, 15000)

    return () => window.clearInterval(timer)
  }, [userId, machines.length])

  // ---------------- HISTORY ----------------

  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = Object.values(sensors).filter(
        sensor => sensor.temperature > 0
      )

      if (!current.length) return

      const avgTemp =
        current.reduce((sum, sensor) => sum + sensor.temperature, 0) / current.length

      const avgVibration =
        current.reduce((sum, sensor) => sum + sensor.vibration, 0) / current.length

      setHistory(previous => [
        ...previous.slice(-19),
        {
          time: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          temperature: Number(avgTemp.toFixed(1)),
          vibration: Number(avgVibration.toFixed(1)),
        },
      ])
    }, 3000)

    return () => window.clearInterval(timer)
  }, [sensors])

  // ---------------- MACHINE CRUD ----------------

  async function addMachine() {
    if (!userId) return

    const name = window.prompt('Enter machine name:')
    if (!name?.trim()) return

    const type = window.prompt('Enter machine type:', 'CNC Machine')
    if (!type?.trim()) return

    await perform(async () => {
      const machineCode = makeCode('MCH')

      const { error: insertError } = await supabase
        .from('machines')
        .insert({
          user_id: userId,
          machine_code: machineCode,
          name: name.trim(),
          machine_type: type.trim(),
          status: 'Running',
          temperature: 40,
          efficiency: 90,
        })

      if (insertError) throw insertError

      await loadData(userId)
    })
  }

  async function editMachine(machine: Machine) {
    if (!userId) return

    const name = window.prompt('Machine name:', machine.name)
    if (!name?.trim()) return

    const status = window.prompt(
      'Status: Running, Warning, Maintenance, Stopped',
      machine.status
    )

    if (!status) return

    const valid: Machine['status'][] = [
      'Running', 'Warning', 'Maintenance', 'Stopped'
    ]

    if (!valid.includes(status as Machine['status'])) {
      window.alert('Invalid status.')
      return
    }

    await perform(async () => {
      const { error: updateError } = await supabase
        .from('machines')
        .update({
          name: name.trim(),
          status,
        })
        .eq('id', machine.id)
        .eq('user_id', userId)

      if (updateError) throw updateError

      await loadData(userId)
    })
  }

  async function deleteMachine(id: string) {
    if (!userId || !window.confirm('Delete this machine and its linked records?')) return

    await perform(async () => {
      const { error: deleteError } = await supabase
        .from('machines')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (deleteError) throw deleteError

      await loadData(userId)
    })
  }

  // ---------------- PRODUCTION CRUD ----------------

  function findMachine(value: string) {
    return machines.find(machine =>
      machine.machine_code.toLowerCase() === value.trim().toLowerCase() ||
      machine.name.toLowerCase() === value.trim().toLowerCase()
    )
  }

  async function addProduction() {
    if (!userId) return

    const machineText = window.prompt(
      'Enter machine code or exact name:\n' +
      machines.map(m => `${m.machine_code} - ${m.name}`).join('\n')
    )

    if (!machineText) return

    const machine = findMachine(machineText)

    if (!machine) {
      window.alert('Machine not found. Enter its exact code or name.')
      return
    }

    const targetText = window.prompt('Enter production target:')
    const actualText = window.prompt('Enter actual production:')

    if (!targetText || !actualText) return

    const target = Number(targetText)
    const actual = Number(actualText)

    if (
      !Number.isFinite(target) ||
      !Number.isFinite(actual) ||
      target <= 0 ||
      actual < 0
    ) {
      window.alert('Enter valid production numbers.')
      return
    }

    const notes = window.prompt('Notes (optional):', '') || ''

    await perform(async () => {
      const { error: insertError } = await supabase
        .from('production_records')
        .insert({
          user_id: userId,
          machine_id: machine.id,
          production_date: today(),
          target_units: target,
          actual_units: actual,
          notes,
        })

      if (insertError) throw insertError

      await loadData(userId)
    })
  }

  async function editProduction(record: ProductionRecord) {
    if (!userId) return

    const targetText = window.prompt('Production target:', String(record.target))
    const actualText = window.prompt('Actual production:', String(record.actual))

    if (!targetText || !actualText) return

    const target = Number(targetText)
    const actual = Number(actualText)

    if (
      !Number.isFinite(target) ||
      !Number.isFinite(actual) ||
      target <= 0 ||
      actual < 0
    ) {
      window.alert('Enter valid numbers.')
      return
    }

    await perform(async () => {
      const { error: updateError } = await supabase
        .from('production_records')
        .update({
          target_units: target,
          actual_units: actual,
        })
        .eq('id', record.id)
        .eq('user_id', userId)

      if (updateError) throw updateError

      await loadData(userId)
    })
  }

  async function deleteProduction(id: string) {
    if (!userId || !window.confirm('Delete this production record?')) return

    await perform(async () => {
      const { error: deleteError } = await supabase
        .from('production_records')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (deleteError) throw deleteError

      await loadData(userId)
    })
  }

  // ---------------- MAINTENANCE CRUD ----------------

  async function addMaintenance() {
    if (!userId) return

    const machineText = window.prompt(
      'Enter machine code or exact name:\n' +
      machines.map(m => `${m.machine_code} - ${m.name}`).join('\n')
    )

    if (!machineText) return

    const machine = findMachine(machineText)

    if (!machine) {
      window.alert('Machine not found. Enter its exact code or name.')
      return
    }

    const task = window.prompt('Maintenance task:', 'Preventive Maintenance')
    if (!task?.trim()) return

    const technician = window.prompt('Technician name:')
    if (!technician?.trim()) return

    const date = window.prompt('Scheduled date (YYYY-MM-DD):', today())
    if (!date?.trim()) return

    const notes = window.prompt('Maintenance notes:', '') || ''

    await perform(async () => {
      const { error: insertError } = await supabase
        .from('maintenance_records')
        .insert({
          user_id: userId,
          machine_id: machine.id,
          task: task.trim(),
          technician: technician.trim(),
          scheduled_date: date.trim(),
          status: 'Scheduled',
          notes,
        })

      if (insertError) throw insertError

      await loadData(userId)
    })
  }

  async function editMaintenance(record: MaintenanceRecord) {
    if (!userId) return

    const status = window.prompt(
      'Status: Scheduled, In Progress, Completed',
      record.status
    )

    if (!status) return

    const valid: MaintenanceRecord['status'][] = [
      'Scheduled', 'In Progress', 'Completed'
    ]

    if (!valid.includes(status as MaintenanceRecord['status'])) {
      window.alert('Invalid status.')
      return
    }

    const technician = window.prompt('Technician:', record.technician)
    if (!technician?.trim()) return

    await perform(async () => {
      const { error: updateError } = await supabase
        .from('maintenance_records')
        .update({
          status,
          technician: technician.trim(),
        })
        .eq('id', record.id)
        .eq('user_id', userId)

      if (updateError) throw updateError

      await loadData(userId)
    })
  }

  async function deleteMaintenance(id: string) {
    if (!userId || !window.confirm('Delete this maintenance record?')) return

    await perform(async () => {
      const { error: deleteError } = await supabase
        .from('maintenance_records')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (deleteError) throw deleteError

      await loadData(userId)
    })
  }

  // ---------------- DASHBOARD CALCULATIONS ----------------

  const runningCount = machines.filter(m => m.status === 'Running').length
  const warningCount = machines.filter(m => m.status === 'Warning').length
  const maintenanceCount = machines.filter(m => m.status === 'Maintenance').length

  const totalTarget = production.reduce((sum, r) => sum + r.target, 0)
  const totalActual = production.reduce((sum, r) => sum + r.actual, 0)

  const efficiency = totalTarget > 0
    ? totalActual / totalTarget * 100
    : 0

  const healthValues = Object.values(sensors).filter(s => s.health > 0)

  const avgHealth = healthValues.length
    ? healthValues.reduce((sum, s) => sum + s.health, 0) / healthValues.length
    : 0

  const alerts = machines.filter(machine => {
    const sensor = sensors[machine.id]

    return sensor && (
      sensor.temperature >= 80 ||
      sensor.vibration >= 5 ||
      sensor.health < 75
    )
  })

  // ---------------- NAVIGATION ----------------

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'Machines', icon: Cpu },
    { name: 'Live Sensors', icon: Activity },
    { name: 'Predictive AI', icon: BrainCircuit },
    { name: 'Production Analytics', icon: BarChart3 },
    { name: 'Maintenance', icon: Wrench },
    { name: 'Settings', icon: Settings },
  ]

  function renderPage() {
    switch (activePage) {
      case 'Dashboard':
        return (
          <Dashboard
            machines={machines}
            sensors={sensors}
            history={history}
            production={production}
            runningCount={runningCount}
            warningCount={warningCount}
            maintenanceCount={maintenanceCount}
            efficiency={efficiency}
            avgHealth={avgHealth}
            alerts={alerts.length}
          />
        )

      case 'Machines':
        return (
          <MachinesPage
            machines={machines}
            onAdd={addMachine}
            onEdit={editMachine}
            onDelete={deleteMachine}
          />
        )

      case 'Live Sensors':
        return (
          <SensorsPage
            machines={machines}
            sensors={sensors}
            history={history}
          />
        )

      case 'Predictive AI':
        return <PredictivePage machines={machines} sensors={sensors} />

      case 'Production Analytics':
        return (
          <ProductionPage
            production={production}
            onAdd={addProduction}
            onEdit={editProduction}
            onDelete={deleteProduction}
          />
        )

      case 'Maintenance':
        return (
          <MaintenancePage
            records={maintenance}
            onAdd={addMaintenance}
            onEdit={editMaintenance}
            onDelete={deleteMaintenance}
          />
        )

      case 'Settings':
        return (
          <SettingsPage
            machines={machines}
            production={production}
            maintenance={maintenance}
            onRefresh={() => userId ? loadData(userId) : Promise.resolve()}
          />
        )

      default:
        return <EmptyState message="Page not found." />
    }
  }

  // ---------------- LOADING SCREEN ----------------

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080f1d] text-white">
        <div className="text-center">
          <Factory size={45} className="mx-auto mb-4 text-cyan-400" />
          <p className="font-semibold">Connecting to SmartFactory AI...</p>
          <p className="mt-2 text-sm text-slate-500">Loading your Supabase data</p>
        </div>
      </div>
    )
  }

  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080f1d] p-5 text-white">
        <Card className="max-w-lg">
          <AlertTriangle className="mb-3 text-amber-400" size={30} />
          <h2 className="text-xl font-bold">Login Required</h2>
          <p className="mt-2 text-sm text-slate-400">
            {error || 'Please login first to access SmartFactory AI.'}
          </p>
        </Card>
      </div>
    )
  }

  // ---------------- MAIN LAYOUT ----------------

  return (
    <div className="min-h-screen bg-[#080f1d] text-slate-100">

      {error && (
        <div className="fixed right-4 top-4 z-[60] max-w-md rounded-lg border border-red-500/30 bg-red-950 p-4 text-sm text-red-200 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <span>{error}</span>
            <button onClick={() => setError('')}>
              <X size={17} />
            </button>
          </div>
        </div>
      )}

      {sidebarOpen && (
        <button
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800 bg-[#0b1424] transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-20 items-center justify-between border-b border-slate-800 px-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-500/15 p-2 text-cyan-400">
              <Factory size={25} />
            </div>
            <div>
              <h1 className="font-bold text-white">SmartFactory</h1>
              <p className="text-xs text-cyan-400">AI Intelligence System</p>
            </div>
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            className="text-slate-400 lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-4 py-5">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Main Menu
          </p>

          <nav className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon
              const active = activePage === item.name

              return (
                <button
                  key={item.name}
                  onClick={() => {
                    setActivePage(item.name)
                    setSidebarOpen(false)
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition ${
                    active
                      ? 'bg-cyan-500/15 font-semibold text-cyan-400'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon size={18} />
                  {item.name}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="mt-auto border-t border-slate-800 p-5">
          <div className="rounded-xl bg-slate-800/70 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Activity size={16} className="text-emerald-400" />
              System Status
            </div>
            <p className="mt-2 text-xs text-emerald-400">Supabase connected</p>
            <p className="mt-1 text-xs text-slate-500">Sensor readings are simulated</p>
          </div>
        </div>
      </aside>

      <main className="min-h-screen lg:ml-64">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-800 bg-[#080f1d]/95 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-slate-400 lg:hidden"
            >
              <Menu size={23} />
            </button>

            <div>
              <h2 className="font-semibold text-white">{activePage}</h2>
              <p className="hidden text-xs text-slate-500 sm:block">
                Smart Factory Management Platform
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              System Online
            </div>

            <div className="relative">
              <Bell size={20} className="text-slate-400" />
              {alerts.length > 0 && (
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
              )}
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/20 text-sm font-bold text-cyan-400">
              SF
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8">
          {renderPage()}

          <footer className="mt-10 border-t border-slate-800 pt-5 text-center text-xs text-slate-600">
            SmartFactory AI • Academic Demonstration Project • Simulated sensor readings
          </footer>
        </div>
      </main>
    </div>
  )
}

// ---------------- DASHBOARD ----------------

function Dashboard({
  machines, sensors, history, production, runningCount,
  warningCount, maintenanceCount, efficiency, avgHealth, alerts
}: {
  machines: Machine[]
  sensors: Record<string, Sensor>
  history: { time: string; temperature: number; vibration: number }[]
  production: ProductionRecord[]
  runningCount: number
  warningCount: number
  maintenanceCount: number
  efficiency: number
  avgHealth: number
  alerts: number
}) {
  // Production records arrive newest first from Supabase.
  const productionChart = [...production].slice(0, 7).reverse().map(record => ({
    name: record.date.slice(5),
    target: record.target,
    actual: record.actual,
  }))

  return (
    <div>
      <SectionTitle
        title="Factory Dashboard"
        subtitle="Overview of factory operations and machine performance"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Machines"
          value={String(machines.length)}
          subtitle="Registered machines"
          icon={Cpu}
          color="bg-cyan-500/15 text-cyan-400"
        />
        <StatCard
          title="Running Machines"
          value={String(runningCount)}
          subtitle="Currently operational"
          icon={Activity}
          color="bg-emerald-500/15 text-emerald-400"
        />
        <StatCard
          title="Machine Alerts"
          value={String(warningCount + alerts)}
          subtitle="Warning and sensor alerts"
          icon={AlertTriangle}
          color="bg-amber-500/15 text-amber-400"
        />
        <StatCard
          title="Production Efficiency"
          value={`${efficiency.toFixed(1)}%`}
          subtitle="Actual vs target production"
          icon={TrendingUp}
          color="bg-violet-500/15 text-violet-400"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <h3 className="mb-1 font-semibold text-white">Production Overview</h3>
          <p className="mb-5 text-xs text-slate-500">Target vs actual production</p>

          {productionChart.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={productionChart}>
                <CartesianGrid stroke="#263449" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
                <Bar dataKey="target" fill="#64748b" radius={[5, 5, 0, 0]} />
                <Bar dataKey="actual" fill="#06b6d4" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No production records available. Add a production record to begin." />
          )}
        </Card>

        <Card>
          <h3 className="font-semibold text-white">Machine Status</h3>
          <p className="mb-5 text-xs text-slate-500">Current machine distribution</p>

          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Running', value: runningCount },
                  { name: 'Warning', value: warningCount },
                  { name: 'Maintenance', value: maintenanceCount },
                  {
                    name: 'Stopped',
                    value: machines.filter(m => m.status === 'Stopped').length
                  },
                ].filter(item => item.value > 0)}
                dataKey="value"
                nameKey="name"
                innerRadius={48}
                outerRadius={78}
                paddingAngle={4}
              >
                {['#10b981', '#f59e0b', '#3b82f6', '#ef4444'].map((color, index) => (
                  <Cell key={index} fill={color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Running</span>
              <span className="text-emerald-400">{runningCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Warning</span>
              <span className="text-amber-400">{warningCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Maintenance</span>
              <span className="text-blue-400">{maintenanceCount}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <h3 className="font-semibold text-white">Live Temperature Trend</h3>
          <p className="mb-4 text-xs text-slate-500">Average simulated sensor temperature</p>

          {history.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#263449" strokeDasharray="3 3" />
                <XAxis dataKey="time" stroke="#94a3b8" hide />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
                <Area type="monotone" dataKey="temperature" stroke="#06b6d4" fill="url(#tempGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="Collecting sensor readings..." />
          )}
        </Card>

        <Card>
          <h3 className="font-semibold text-white">AI Factory Insights</h3>
          <p className="mb-4 text-xs text-slate-500">Rule-based demonstration insights</p>

          <div className="space-y-3">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
                <AlertTriangle size={17} /> Sensor Alerts
              </div>
              <p className="mt-1 text-sm text-slate-300">
                {alerts} machine(s) need attention.
              </p>
            </div>

            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-cyan-400">
                <Gauge size={17} /> Average Machine Health
              </div>
              <p className="mt-1 text-sm text-slate-300">
                {avgHealth.toFixed(1)}% average health.
              </p>
            </div>

            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                <CheckCircle2 size={17} /> Production Records
              </div>
              <p className="mt-1 text-sm text-slate-300">
                {production.length} record(s) available.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-5">
        <h3 className="mb-4 font-semibold text-white">Machine Monitoring</h3>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="pb-3">Machine</th>
                <th className="pb-3">Temperature</th>
                <th className="pb-3">Efficiency</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>

            <tbody>
              {machines.map(machine => (
                <tr key={machine.id} className="border-t border-slate-800">
                  <td className="py-3">
                    <p className="font-medium text-white">{machine.name}</p>
                    <p className="text-xs text-slate-500">{machine.machine_code}</p>
                  </td>
                  <td className="py-3">
                    {sensors[machine.id]?.temperature.toFixed(1) ?? machine.temperature}°C
                  </td>
                  <td className="py-3">{machine.efficiency}%</td>
                  <td className="py-3">
                    <StatusBadge status={machine.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!machines.length && <EmptyState message="No machines registered yet." />}
        </div>
      </Card>
    </div>
  )
}

// ---------------- MACHINES PAGE ----------------

function MachinesPage({
  machines, onAdd, onEdit, onDelete
}: {
  machines: Machine[]
  onAdd: () => void
  onEdit: (machine: Machine) => void
  onDelete: (id: string) => void
}) {
  const [search, setSearch] = useState('')

  const filtered = machines.filter(machine =>
    `${machine.name} ${machine.machine_code} ${machine.status}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  return (
    <div>
      <SectionTitle
        title="Machine Management"
        subtitle="Register, update and manage factory machines"
      />

      <Card>
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row">
          <div className="relative">
            <Search size={17} className="absolute left-3 top-3 text-slate-500" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search machines..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-cyan-500 sm:w-72"
            />
          </div>

          <button
            onClick={onAdd}
            className="flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
          >
            <Plus size={17} /> Add Machine
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="pb-4">Machine ID</th>
                <th className="pb-4">Machine Name</th>
                <th className="pb-4">Type</th>
                <th className="pb-4">Temperature</th>
                <th className="pb-4">Efficiency</th>
                <th className="pb-4">Status</th>
                <th className="pb-4">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map(machine => (
                <tr key={machine.id} className="border-t border-slate-800">
                  <td className="py-4 text-slate-400">{machine.machine_code}</td>
                  <td className="py-4 font-medium text-white">{machine.name}</td>
                  <td className="py-4">{machine.machine_type}</td>
                  <td className="py-4">{machine.temperature}°C</td>
                  <td className="py-4">{machine.efficiency}%</td>
                  <td className="py-4">
                    <StatusBadge status={machine.status} />
                  </td>
                  <td className="py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => onEdit(machine)}
                        title="Edit"
                        className="rounded-lg bg-blue-500/10 p-2 text-blue-400"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => onDelete(machine.id)}
                        title="Delete"
                        className="rounded-lg bg-red-500/10 p-2 text-red-400"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <EmptyState message="No machines found. Add your first machine." />
          )}
        </div>
      </Card>
    </div>
  )
}

// ---------------- LIVE SENSORS PAGE ----------------

function SensorsPage({
  machines, sensors, history
}: {
  machines: Machine[]
  sensors: Record<string, Sensor>
  history: { time: string; temperature: number; vibration: number }[]
}) {
  const activeSensors = machines.filter(m =>
    m.status === 'Running' || m.status === 'Warning'
  )

  const avgTemp = activeSensors.length
    ? activeSensors.reduce((sum, m) => sum + (sensors[m.id]?.temperature || 0), 0) / activeSensors.length
    : 0

  const avgVibration = activeSensors.length
    ? activeSensors.reduce((sum, m) => sum + (sensors[m.id]?.vibration || 0), 0) / activeSensors.length
    : 0

  return (
    <div>
      <SectionTitle
        title="Live Sensor Monitoring"
        subtitle="Simulated temperature, vibration and machine health readings"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Average Temperature"
          value={`${avgTemp.toFixed(1)}°C`}
          subtitle="Across active machines"
          icon={Thermometer}
          color="bg-orange-500/15 text-orange-400"
        />
        <StatCard
          title="Average Vibration"
          value={`${avgVibration.toFixed(1)} mm/s`}
          subtitle="Simulated vibration"
          icon={Activity}
          color="bg-cyan-500/15 text-cyan-400"
        />
        <StatCard
          title="Active Sensors"
          value={String(activeSensors.length)}
          subtitle="Running and warning machines"
          icon={Gauge}
          color="bg-emerald-500/15 text-emerald-400"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <h3 className="mb-4 font-semibold text-white">Temperature Monitoring</h3>

          {history.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={history}>
                <CartesianGrid stroke="#263449" strokeDasharray="3 3" />
                <XAxis dataKey="time" stroke="#94a3b8" hide />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Area type="monotone" dataKey="temperature" stroke="#f97316" fill="#f97316" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="Collecting sensor readings..." />
          )}
        </Card>

        <Card>
          <h3 className="mb-4 font-semibold text-white">Vibration Monitoring</h3>

          {history.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={history}>
                <CartesianGrid stroke="#263449" strokeDasharray="3 3" />
                <XAxis dataKey="time" stroke="#94a3b8" hide />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Area type="monotone" dataKey="vibration" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="Collecting sensor readings..." />
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <h3 className="mb-4 font-semibold text-white">Sensor Details</h3>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="pb-3">Machine</th>
                <th className="pb-3">Temperature</th>
                <th className="pb-3">Vibration</th>
                <th className="pb-3">Health</th>
                <th className="pb-3">Condition</th>
              </tr>
            </thead>

            <tbody>
              {machines.map(machine => {
                const sensor = sensors[machine.id]

                const critical = sensor && (
                  sensor.temperature >= 80 ||
                  sensor.vibration >= 5 ||
                  sensor.health < 75
                )

                return (
                  <tr key={machine.id} className="border-t border-slate-800">
                    <td className="py-4 font-medium text-white">{machine.name}</td>
                    <td className="py-4">{sensor?.temperature.toFixed(1) ?? '—'}°C</td>
                    <td className="py-4">{sensor?.vibration.toFixed(1) ?? '—'} mm/s</td>
                    <td className="py-4">{sensor?.health.toFixed(1) ?? '—'}%</td>
                    <td className="py-4">
                      <StatusBadge
                        status={
                          critical
                            ? 'Warning'
                            : machine.status === 'Running'
                              ? 'Healthy'
                              : machine.status
                        }
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {!machines.length && <EmptyState message="No machines available." />}
        </div>
      </Card>

      <p className="mt-4 text-xs text-slate-500">
        Note: Sensor values are simulated in software. No physical IoT sensors are connected.
      </p>
    </div>
  )
}

// ---------------- PREDICTIVE AI PAGE ----------------

function PredictivePage({
  machines, sensors
}: {
  machines: Machine[]
  sensors: Record<string, Sensor>
}) {
  const predictions = machines.map(machine => {
    const sensor = sensors[machine.id]

    let risk = 'Low'
    let reason = 'Readings are within demo thresholds.'

    if (sensor && (
      sensor.temperature >= 85 ||
      sensor.vibration >= 6 ||
      sensor.health < 65
    )) {
      risk = 'High'
      reason = 'High temperature, vibration or low health reading detected.'
    } else if (sensor && (
      sensor.temperature >= 75 ||
      sensor.vibration >= 4 ||
      sensor.health < 80
    )) {
      risk = 'Medium'
      reason = 'One or more readings are approaching warning thresholds.'
    }

    return { machine, sensor, risk, reason }
  })

  return (
    <div>
      <SectionTitle
        title="Predictive Maintenance AI"
        subtitle="Rule-based condition monitoring and maintenance risk demonstration"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Machines Analyzed"
          value={String(machines.length)}
          subtitle="Registered machines"
          icon={BrainCircuit}
          color="bg-violet-500/15 text-violet-400"
        />
        <StatCard
          title="High Risk"
          value={String(predictions.filter(p => p.risk === 'High').length)}
          subtitle="Requires attention"
          icon={AlertTriangle}
          color="bg-red-500/15 text-red-400"
        />
        <StatCard
          title="Low Risk"
          value={String(predictions.filter(p => p.risk === 'Low').length)}
          subtitle="Within demo thresholds"
          icon={CheckCircle2}
          color="bg-emerald-500/15 text-emerald-400"
        />
      </div>

      <Card className="mt-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-xl bg-violet-500/15 p-3 text-violet-400">
            <BrainCircuit size={24} />
          </div>
          <div>
            <h3 className="font-semibold text-white">Predictive Analysis Results</h3>
            <p className="text-xs text-slate-500">Risk levels use sample thresholds</p>
          </div>
        </div>

        <div className="space-y-3">
          {predictions.map(item => (
            <div
              key={item.machine.id}
              className="rounded-lg border border-slate-800 bg-slate-950/50 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-white">{item.machine.name}</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.machine.machine_code}
                  </p>
                </div>
                <StatusBadge status={item.risk} />
              </div>

              <p className="mt-3 text-sm text-slate-400">{item.reason}</p>

              <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
                <span>Temperature: {item.sensor?.temperature.toFixed(1) ?? '—'}°C</span>
                <span>Vibration: {item.sensor?.vibration.toFixed(1) ?? '—'} mm/s</span>
                <span>Health: {item.sensor?.health.toFixed(1) ?? '—'}%</span>
              </div>
            </div>
          ))}

          {!predictions.length && (
            <EmptyState message="Add machines to see risk analysis." />
          )}
        </div>
      </Card>

      <Card className="mt-5">
        <h3 className="font-semibold text-white">Recommended Actions</h3>

        <ul className="mt-4 space-y-3 text-sm text-slate-400">
          <li className="flex gap-2">
            <CheckCircle2 size={17} className="shrink-0 text-cyan-400" />
            Review machines with high temperature readings.
          </li>
          <li className="flex gap-2">
            <CheckCircle2 size={17} className="shrink-0 text-cyan-400" />
            Inspect machines with elevated vibration readings.
          </li>
          <li className="flex gap-2">
            <CheckCircle2 size={17} className="shrink-0 text-cyan-400" />
            Schedule maintenance for machines with low health readings.
          </li>
        </ul>

        <p className="mt-4 text-xs text-amber-400">
          This is a rule-based academic demonstration, not a trained machine-learning model or a real failure prediction system.
        </p>
      </Card>
    </div>
  )
}

// ---------------- PRODUCTION ANALYTICS PAGE ----------------

function ProductionPage({
  production, onAdd, onEdit, onDelete
}: {
  production: ProductionRecord[]
  onAdd: () => void
  onEdit: (record: ProductionRecord) => void
  onDelete: (id: string) => void
}) {
  const [period, setPeriod] = useState('All')
  const [machineFilter, setMachineFilter] = useState('All')

  const filtered = production.filter(record => {
    const matchesMachine =
      machineFilter === 'All' || record.machine === machineFilter

    const recordDate = new Date(`${record.date}T00:00:00`)
    const now = new Date()
    const days = (now.getTime() - recordDate.getTime()) / 86400000

    const matchesPeriod =
      period === 'All' ||
      (period === 'Daily' && record.date === today()) ||
      (period === 'Weekly' && days >= 0 && days <= 7) ||
      (period === 'Monthly' && days >= 0 && days <= 30)

    return matchesMachine && matchesPeriod
  })

  const target = filtered.reduce((sum, r) => sum + r.target, 0)
  const actual = filtered.reduce((sum, r) => sum + r.actual, 0)
  const rate = target > 0 ? actual / target * 100 : 0

  const chartData = filtered.map(record => ({
    name: `${record.machine.slice(0, 9)} (${record.date.slice(5)})`,
    target: record.target,
    actual: record.actual,
  }))

  const machineNames = [...new Set(production.map(r => r.machine))]

  return (
    <div>
      <SectionTitle
        title="Production Analytics"
        subtitle="Analyze production targets, actual output and performance"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Target"
          value={target.toLocaleString()}
          subtitle="Units planned"
          icon={TargetIcon}
          color="bg-blue-500/15 text-blue-400"
        />
        <StatCard
          title="Actual Production"
          value={actual.toLocaleString()}
          subtitle="Units produced"
          icon={Factory}
          color="bg-cyan-500/15 text-cyan-400"
        />
        <StatCard
          title="Achievement Rate"
          value={`${rate.toFixed(1)}%`}
          subtitle="Actual divided by target"
          icon={TrendingUp}
          color="bg-emerald-500/15 text-emerald-400"
        />
      </div>

      <Card className="mt-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-white">Production Reports</h3>

          <div className="flex flex-wrap gap-2">
            <select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option>All</option>
              <option>Daily</option>
              <option>Weekly</option>
              <option>Monthly</option>
            </select>

            <select
              value={machineFilter}
              onChange={e => setMachineFilter(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option>All</option>
              {machineNames.map(machine => (
                <option key={machine}>{machine}</option>
              ))}
            </select>

            <button
              onClick={onAdd}
              className="flex items-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950"
            >
              <Plus size={16} /> Add Record
            </button>
          </div>
        </div>

        <div className="mb-6">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid stroke="#263449" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="target" fill="#64748b" radius={[5, 5, 0, 0]} />
                <Bar dataKey="actual" fill="#06b6d4" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No production records match the selected filters." />
          )}
        </div>

        <div className="mb-4 flex justify-end">
          <button
            onClick={() => downloadCSV('production-report.csv', [
              ['ID', 'Machine', 'Date', 'Target', 'Actual', 'Efficiency %'],
              ...filtered.map(r => [
                r.id,
                r.machine,
                r.date,
                r.target,
                r.actual,
                r.target ? (r.actual / r.target * 100).toFixed(1) : 0
              ])
            ])}
            className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
          >
            <Download size={15} /> Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="pb-3">Machine</th>
                <th className="pb-3">Date</th>
                <th className="pb-3">Target</th>
                <th className="pb-3">Actual</th>
                <th className="pb-3">Efficiency</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map(record => (
                <tr key={record.id} className="border-t border-slate-800">
                  <td className="py-3 font-medium text-white">{record.machine}</td>
                  <td className="py-3">{record.date}</td>
                  <td className="py-3">{record.target}</td>
                  <td className="py-3">{record.actual}</td>
                  <td className="py-3">
                    {record.target
                      ? (record.actual / record.target * 100).toFixed(1)
                      : '0.0'}%
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => onEdit(record)}
                        className="rounded-lg bg-blue-500/10 p-2 text-blue-400"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => onDelete(record.id)}
                        className="rounded-lg bg-red-500/10 p-2 text-red-400"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!filtered.length && (
            <EmptyState message="No production records found." />
          )}
        </div>
      </Card>
    </div>
  )
}

// ---------------- MAINTENANCE PAGE ----------------

function MaintenancePage({
  records, onAdd, onEdit, onDelete
}: {
  records: MaintenanceRecord[]
  onAdd: () => void
  onEdit: (record: MaintenanceRecord) => void
  onDelete: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')

  const filtered = records.filter(record => {
    const matchesSearch =
      `${record.machine} ${record.technician} ${record.type}`
        .toLowerCase()
        .includes(search.toLowerCase())

    return matchesSearch && (filter === 'All' || record.status === filter)
  })

  const scheduled = records.filter(r => r.status === 'Scheduled').length
  const inProgress = records.filter(r => r.status === 'In Progress').length
  const completed = records.filter(r => r.status === 'Completed').length

  return (
    <div>
      <SectionTitle
        title="Maintenance Management"
        subtitle="Plan, track and manage factory machine maintenance activities"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Scheduled"
          value={String(scheduled)}
          subtitle="Upcoming maintenance"
          icon={CalendarDays}
          color="bg-blue-500/15 text-blue-400"
        />
        <StatCard
          title="In Progress"
          value={String(inProgress)}
          subtitle="Currently being serviced"
          icon={Clock}
          color="bg-amber-500/15 text-amber-400"
        />
        <StatCard
          title="Completed"
          value={String(completed)}
          subtitle="Finished maintenance jobs"
          icon={CheckCircle2}
          color="bg-emerald-500/15 text-emerald-400"
        />
      </div>

      <Card className="mt-5">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row">
          <div>
            <h3 className="font-semibold text-white">Maintenance Schedule</h3>
            <p className="mt-1 text-xs text-slate-500">
              Create and update maintenance records
            </p>
          </div>

          <button
            onClick={onAdd}
            className="flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950"
          >
            <Plus size={17} /> Schedule Maintenance
          </button>
        </div>

        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={17} className="absolute left-3 top-3 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search machine, technician or type..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-cyan-500"
            />
          </div>

          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          >
            <option>All</option>
            <option>Scheduled</option>
            <option>In Progress</option>
            <option>Completed</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="pb-4">Record ID</th>
                <th className="pb-4">Machine</th>
                <th className="pb-4">Maintenance Task</th>
                <th className="pb-4">Date</th>
                <th className="pb-4">Technician</th>
                <th className="pb-4">Status</th>
                <th className="pb-4">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map(record => (
                <tr key={record.id} className="border-t border-slate-800">
                  <td className="py-4 text-slate-400">{record.id.slice(0, 8)}</td>
                  <td className="py-4 font-medium text-white">{record.machine}</td>
                  <td className="py-4">{record.type}</td>
                  <td className="py-4">{record.date}</td>
                  <td className="py-4">{record.technician}</td>
                  <td className="py-4">
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => onEdit(record)}
                        title="Edit"
                        className="rounded-lg bg-blue-500/10 p-2 text-blue-400"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => onDelete(record.id)}
                        title="Delete"
                        className="rounded-lg bg-red-500/10 p-2 text-red-400"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!filtered.length && (
            <EmptyState message="No maintenance records found." />
          )}
        </div>
      </Card>

      <Card className="mt-5">
        <h3 className="font-semibold text-white">Maintenance Workflow</h3>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
            <CalendarDays className="mb-3 text-blue-400" />
            <h4 className="font-semibold text-white">1. Scheduled</h4>
            <p className="mt-1 text-xs text-slate-400">
              Create a plan and assign a technician.
            </p>
          </div>

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
            <Wrench className="mb-3 text-amber-400" />
            <h4 className="font-semibold text-white">2. In Progress</h4>
            <p className="mt-1 text-xs text-slate-400">
              Update when maintenance begins.
            </p>
          </div>

          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
            <CheckCircle2 className="mb-3 text-emerald-400" />
            <h4 className="font-semibold text-white">3. Completed</h4>
            <p className="mt-1 text-xs text-slate-400">
              Mark the maintenance activity complete.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ---------------- SETTINGS PAGE ----------------

function SettingsPage({
  machines, production, maintenance, onRefresh
}: {
  machines: Machine[]
  production: ProductionRecord[]
  maintenance: MaintenanceRecord[]
  onRefresh: () => Promise<void>
}) {
  const [factoryName, setFactoryName] = useState(
    () => localStorage.getItem('sf-factory-name') || 'SmartFactory AI'
  )

  const [refreshRate, setRefreshRate] = useState(
    () => localStorage.getItem('sf-refresh-rate') || '2500'
  )

  const [refreshing, setRefreshing] = useState(false)

  function saveSettings() {
    localStorage.setItem('sf-factory-name', factoryName)
    localStorage.setItem('sf-refresh-rate', refreshRate)
    window.alert('Preferences saved in this browser.')
  }

  async function refreshData() {
    try {
      setRefreshing(true)
      await onRefresh()
      window.alert('Data refreshed from Supabase.')
    } catch (err: any) {
      window.alert(err.message || 'Refresh failed.')
    } finally {
      setRefreshing(false)
    }
  }

  function exportAllData() {
    const data = {
      exportedAt: new Date().toISOString(),
      machines,
      production,
      maintenance,
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = 'smartfactory-data.json'
    link.click()

    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <SectionTitle
        title="System Settings"
        subtitle="Manage application preferences and export project data"
      />

      <Card>
        <h3 className="font-semibold text-white">Factory Preferences</h3>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-slate-400">
              Factory / Application Name
            </label>
            <input
              value={factoryName}
              onChange={e => setFactoryName(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-400">
              Sensor Simulation Interval
            </label>
            <select
              value={refreshRate}
              onChange={e => setRefreshRate(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
            >
              <option value="1000">1 second (display preference)</option>
              <option value="2500">2.5 seconds (default)</option>
              <option value="5000">5 seconds (display preference)</option>
            </select>

            <p className="mt-2 text-xs text-slate-500">
              The demo simulation currently runs at 2.5 seconds.
            </p>
          </div>
        </div>

        <button
          onClick={saveSettings}
          className="mt-5 rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950"
        >
          Save Preferences
        </button>
      </Card>

      <Card className="mt-5">
        <h3 className="font-semibold text-white">Supabase Data Management</h3>

        <p className="mt-2 text-sm text-slate-400">
          Refresh your records from the connected Supabase database or download a JSON backup.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={refreshData}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh Database Data'}
          </button>

          <button
            onClick={exportAllData}
            className="flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800"
          >
            <Download size={17} /> Export All Project Data
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-950 p-4">
            <p className="text-xs text-slate-500">Machines</p>
            <p className="mt-1 text-2xl font-bold text-white">{machines.length}</p>
          </div>

          <div className="rounded-lg bg-slate-950 p-4">
            <p className="text-xs text-slate-500">Production Records</p>
            <p className="mt-1 text-2xl font-bold text-white">{production.length}</p>
          </div>

          <div className="rounded-lg bg-slate-950 p-4">
            <p className="text-xs text-slate-500">Maintenance Records</p>
            <p className="mt-1 text-2xl font-bold text-white">{maintenance.length}</p>
          </div>
        </div>
      </Card>

      <Card className="mt-5">
        <h3 className="font-semibold text-white">About This Application</h3>

        <p className="mt-2 text-sm text-slate-400">
          SmartFactory AI is an academic demonstration of factory monitoring,
          production analytics and maintenance workflows.
        </p>

        <p className="mt-3 text-xs text-amber-400">
          Records are stored in Supabase. Sensor readings are software-simulated.
          Predictive maintenance uses demonstration rules, not a trained AI model.
          No physical IoT hardware is connected.
        </p>
      </Card>
    </div>
  )
}
