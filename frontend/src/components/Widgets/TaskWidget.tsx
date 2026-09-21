'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Check, Circle, ListTodo, Plus, Trash2 } from 'lucide-react'
import WidgetSizeToggle from './WidgetSizeToggle'
import { fetchWithAuth } from '@/lib/api/fetchWithAuth'

type Priority = 'low' | 'medium' | 'high'

interface PersonalTask {
  id: number
  title: string
  priority: Priority
  due_date: string | null
  is_completed: boolean
}

const priorityLabel: Record<Priority, string> = { low: 'ต่ำ', medium: 'ปกติ', high: 'สำคัญ' }
const priorityClass: Record<Priority, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-[#0071e3]/10 text-[#0071e3]',
  high: 'bg-[#ff3b30]/10 text-[#d70015]',
}

export default function TaskWidget({ width = 1, onResize }: { width?: number; onResize?: (size: number) => void }) {
  const [tasks, setTasks] = useState<PersonalTask[]>([])
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const remaining = useMemo(() => tasks.filter((task) => !task.is_completed).length, [tasks])

  useEffect(() => {
    let mounted = true
    fetchWithAuth('/api/v1/tasks/')
      .then(async (response) => {
        if (!response.ok) throw new Error('โหลดรายการงานไม่สำเร็จ')
        return response.json() as Promise<PersonalTask[]>
      })
      .then((data) => mounted && setTasks(data))
      .catch(() => mounted && setError('ไม่สามารถโหลดรายการงานได้'))
      .finally(() => mounted && setIsLoading(false))
    return () => { mounted = false }
  }, [])

  const addTask = async (event: FormEvent) => {
    event.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) return
    setError('')
    try {
      const response = await fetchWithAuth('/api/v1/tasks/', {
        method: 'POST',
        body: JSON.stringify({ title: cleanTitle, priority, due_date: dueDate || null }),
      })
      if (!response.ok) throw new Error()
      const task = await response.json() as PersonalTask
      setTasks((current) => [...current, task])
      setTitle('')
      setDueDate('')
      setPriority('medium')
    } catch {
      setError('บันทึกรายการงานไม่สำเร็จ')
    }
  }

  const updateTask = async (task: PersonalTask, changes: Partial<PersonalTask>) => {
    const optimistic = { ...task, ...changes }
    setTasks((current) => current.map((item) => item.id === task.id ? optimistic : item))
    try {
      const response = await fetchWithAuth(`/api/v1/tasks/${task.id}`, {
        method: 'PATCH', body: JSON.stringify(changes),
      })
      if (!response.ok) throw new Error()
      const saved = await response.json() as PersonalTask
      setTasks((current) => current.map((item) => item.id === saved.id ? saved : item))
    } catch {
      setTasks((current) => current.map((item) => item.id === task.id ? task : item))
      setError('อัปเดตรายการงานไม่สำเร็จ')
    }
  }

  const removeTask = async (task: PersonalTask) => {
    setTasks((current) => current.filter((item) => item.id !== task.id))
    try {
      const response = await fetchWithAuth(`/api/v1/tasks/${task.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error()
    } catch {
      setTasks((current) => [...current, task])
      setError('ลบรายการงานไม่สำเร็จ')
    }
  }

  return (
    <section className="flex h-full min-h-[280px] flex-col rounded-[24px] border border-black/[0.06] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]" aria-labelledby="task-widget-title">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#ff9500]/10 text-[#ff9500]"><ListTodo size={20} aria-hidden="true" /></div>
          <div><h2 id="task-widget-title" className="text-[16px] font-bold text-[#1d1d1f]">งานส่วนตัว</h2><p className="text-[12px] text-[#86868b]">เหลือ {remaining} งาน</p></div>
        </div>
        {onResize && <WidgetSizeToggle value={width} onChange={onResize} sizes={[1, 2, 3]} />}
      </div>

      <form onSubmit={addTask} className="mt-4 flex flex-wrap gap-2">
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={250} placeholder="เพิ่มงานใหม่…" aria-label="ชื่องาน" className="min-w-0 flex-1 rounded-xl border border-black/[0.10] px-3 py-2 text-[13px] outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20" />
        <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)} aria-label="ความสำคัญ" className="rounded-xl border border-black/[0.10] bg-white px-2 text-[12px] font-semibold"><option value="low">ต่ำ</option><option value="medium">ปกติ</option><option value="high">สำคัญ</option></select>
        <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} aria-label="กำหนดส่ง" className="rounded-xl border border-black/[0.10] px-2 text-[12px]" />
        <button type="submit" className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#0071e3] text-white hover:bg-[#0077ed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]" aria-label="เพิ่มงาน"><Plus size={18} /></button>
      </form>
      {error && <p role="alert" className="mt-2 text-[12px] text-[#d70015]">{error}</p>}

      <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto">
        {isLoading ? <p className="py-6 text-center text-[13px] text-[#86868b]">กำลังโหลด…</p> : tasks.length === 0 ? <p className="py-6 text-center text-[13px] text-[#86868b]">ยังไม่มีงาน เพิ่มรายการแรกได้เลย</p> : tasks.map((task) => (
          <div key={task.id} className={`group flex items-center gap-2 rounded-xl p-2.5 ${task.is_completed ? 'bg-[#f5f5f7] opacity-65' : 'bg-[#f8fafc] hover:bg-[#f2f2f7]'}`}>
            <button type="button" onClick={() => updateTask(task, { is_completed: !task.is_completed })} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${task.is_completed ? 'border-[#34c759] bg-[#34c759] text-white' : 'border-[#86868b] text-transparent hover:border-[#0071e3]'}`} aria-label={task.is_completed ? `ทำเครื่องหมายว่ายังไม่เสร็จ: ${task.title}` : `ทำเครื่องหมายว่าเสร็จ: ${task.title}`}>{task.is_completed ? <Check size={13} /> : <Circle size={12} />}</button>
            <div className="min-w-0 flex-1"><p className={`truncate text-[13px] font-semibold text-[#1d1d1f] ${task.is_completed ? 'line-through' : ''}`}>{task.title}</p><div className="mt-0.5 flex gap-1.5"><span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${priorityClass[task.priority]}`}>{priorityLabel[task.priority]}</span>{task.due_date && <span className="text-[10px] text-[#86868b]">ครบ {new Date(`${task.due_date}T00:00:00`).toLocaleDateString('th-TH')}</span>}</div></div>
            <button type="button" onClick={() => removeTask(task)} className="rounded-lg p-1.5 text-[#86868b] opacity-0 hover:bg-[#ff3b30]/10 hover:text-[#d70015] group-hover:opacity-100 focus:opacity-100" aria-label={`ลบงาน ${task.title}`}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </section>
  )
}
