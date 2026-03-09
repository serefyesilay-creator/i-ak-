export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled'
export type RecurrenceType = 'daily' | 'weekly' | 'monthly'
export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived'
export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'overdue'
export type Currency = 'TRY' | 'USD' | 'EUR'

export interface Task {
  id: string
  title: string
  description: string | null
  priority: Priority
  status: TaskStatus
  due_date: string | null
  project_id: string | null
  kanban_column_id: string | null
  tags: string[]
  is_recurring: boolean
  recurrence_type: RecurrenceType | null
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  name: string
  description: string | null
  color: string
  status: ProjectStatus
  start_date: string | null
  end_date: string | null
  created_at: string
}

export interface Milestone {
  id: string
  project_id: string
  title: string
  due_date: string | null
  is_completed: boolean
  created_at: string
}

export interface KanbanColumn {
  id: string
  project_id: string
  title: string
  order: number
}

export interface Note {
  id: string
  title: string
  content: string | null
  category_id: string | null
  project_id: string | null
  tags: string[]
  is_pinned: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface NoteCategory {
  id: string
  name: string
  color: string
}

export interface Client {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  notes: string | null
  created_at: string
}

export interface Invoice {
  id: string
  client_id: string
  service_name: string
  amount: number
  currency: Currency
  status: InvoiceStatus
  issue_date: string
  due_date: string | null
  notes: string | null
  created_at: string
}

export interface Payment {
  id: string
  invoice_id: string
  amount: number
  paid_at: string
  note: string | null
}
