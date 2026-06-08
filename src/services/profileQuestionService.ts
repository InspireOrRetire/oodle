import { supabase } from '../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProfileQuestion {
  id: string
  creator_id: string
  asker_id: string
  question: string
  status: 'open' | 'answered' | 'dismissed'
  upvote_count: number
  answer_post_id: string | null
  created_at: string
  asker?: {
    username: string | null
    display_name: string | null
    avatar_url: string | null
  }
}

// ── Service functions ─────────────────────────────────────────────────────────

export async function fetchQuestions(
  creatorId: string,
  limit = 50,
): Promise<ProfileQuestion[]> {
  const { data, error } = await supabase
    .from('profile_questions')
    .select(`
      id, creator_id, asker_id, question, status,
      upvote_count, answer_post_id, created_at,
      asker:users!asker_id ( username, display_name, avatar_url )
    `)
    .eq('creator_id', creatorId)
    .eq('status', 'open')
    .order('upvote_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as unknown as ProfileQuestion[]
}

export async function submitQuestion(
  creatorId: string,
  askerId: string,
  question: string,
): Promise<void> {
  const { error } = await supabase
    .from('profile_questions')
    .insert({ creator_id: creatorId, asker_id: askerId, question })

  if (error) throw error
}

export async function upvoteQuestion(
  questionId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase.rpc('upvote_profile_question', {
    p_question_id: questionId,
    p_user_id: userId,
  })
  if (error) throw error
}

export async function unvoteQuestion(
  questionId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase.rpc('unvote_profile_question', {
    p_question_id: questionId,
    p_user_id: userId,
  })
  if (error) throw error
}

export async function fetchMyUpvotes(
  questionIds: string[],
  userId: string,
): Promise<Set<string>> {
  if (!questionIds.length || !userId) return new Set()

  const { data, error } = await supabase
    .from('profile_question_upvotes')
    .select('question_id')
    .eq('user_id', userId)
    .in('question_id', questionIds)

  if (error) throw error
  return new Set((data ?? []).map(r => r.question_id))
}

export async function dismissQuestion(questionId: string): Promise<void> {
  const { error } = await supabase
    .from('profile_questions')
    .update({ status: 'dismissed' })
    .eq('id', questionId)

  if (error) throw error
}

export async function answerQuestion(
  questionId: string,
  postId: string,
): Promise<void> {
  const { error } = await supabase
    .from('profile_questions')
    .update({ status: 'answered', answer_post_id: postId })
    .eq('id', questionId)

  if (error) throw error
}
