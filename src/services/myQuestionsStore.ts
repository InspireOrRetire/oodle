// Local-first store for questions the current user has asked.
// Questions are saved immediately on submit so My Questions
// shows them even before the DB round-trip completes.

const KEY = 'oodle_my_questions'

export interface LocalAskedQuestion {
  threadId:        string
  postId:          string | null
  question:        string
  creatorUsername: string
  creatorName:     string
  creatorAvatar:   string | null
  price:           number
  askedAt:         string   // ISO string
  status:          'pending' | 'answered' | 'declined'
}

function load(): LocalAskedQuestion[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

function persist(items: LocalAskedQuestion[]) {
  localStorage.setItem(KEY, JSON.stringify(items))
}

export const myQuestionsStore = {
  getAll(): LocalAskedQuestion[] {
    return load()
  },

  add(q: LocalAskedQuestion): void {
    const existing = load()
    if (!existing.some(e => e.threadId === q.threadId)) {
      persist([q, ...existing])
    }
  },

  updateStatus(threadId: string, status: LocalAskedQuestion['status']): void {
    persist(load().map(q => q.threadId === threadId ? { ...q, status } : q))
  },

  remove(threadId: string): void {
    persist(load().filter(q => q.threadId !== threadId))
  },
}
