export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled'
export type RecurrenceType = 'daily' | 'weekly' | 'monthly'
export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived'
export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'overdue'
export type Currency = 'TRY' | 'USD' | 'EUR'
export type ContentSharePlatform = 'instagram' | 'youtube'
export type ContentShareStatus = 'planned' | 'ready' | 'published' | 'cancelled'

export interface ContentShare {
  id: string
  user_id: string
  client_id: string
  share_date: string
  title: string | null
  platform: ContentSharePlatform
  status: ContentShareStatus
  is_shared: boolean
  created_at: string
}

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

export interface Expense {
  id: string
  title: string
  amount: number
  currency: Currency
  category: string
  expense_date: string
  notes: string | null
  is_paid: boolean
  created_at: string
}

export interface Payment {
  id: string
  invoice_id: string
  amount: number
  paid_at: string
  note: string | null
}

export type AssetCategory = 'Altın' | 'Döviz' | 'Hisse' | 'Kripto' | 'Gayrimenkul' | 'Tahvil' | 'Duran Varlık' | 'Diğer'

export interface Asset {
  id: string
  name: string
  category: AssetCategory
  quantity: number
  unit_price: number
  currency: Currency
  purchase_date: string | null
  notes: string | null
  created_at: string
}

export interface AssetSnapshot {
  id: string
  user_id: string
  snapshot_date: string
  total_value: number
  breakdown: Record<string, number>
  created_at: string
}
