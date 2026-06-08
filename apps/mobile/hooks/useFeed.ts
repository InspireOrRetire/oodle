/**
 * useFeed — fetches and paginates the proximity feed.
 * Uses TanStack Query for caching + background refetch.
 * Subscribes to Supabase Realtime for live updates.
 */

import { useEffect, useRef, useCallback } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { getFeed } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { useLocationStore } from '@/stores/locationStore'
import type { Post, FeedMode } from '@/constants/types'

const FEED_STALE_TIME = 30_000    // 30 seconds
const FEED_PAGE_SIZE = 30

export function useFeed() {
  const queryClient = useQueryClient()
  const { lat, lng, activeZoneId, feedMode } = useLocationStore()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const queryKey = ['feed', feedMode, activeZoneId ?? 'none', lat, lng]

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      if (!lat || !lng) return { posts: [], hasMore: false, cursor: null }

      return getFeed({
        mode: feedMode,
        lat,
        lng,
        zoneId: feedMode === 'here_only' ? activeZoneId ?? undefined : undefined,
        cursor: pageParam as string | undefined,
        limit: FEED_PAGE_SIZE,
      })
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
    staleTime: FEED_STALE_TIME,
    enabled: !!lat && !!lng,
  })

  // Flatten pages into a single array of posts
  const posts: Post[] = data?.pages.flatMap((p) => p.posts) ?? []

  // ---- Real-time: prepend new posts from this zone to top of feed ----
  const setupRealtime = useCallback(() => {
    if (!activeZoneId || feedMode !== 'here_only') return

    // Tear down existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    channelRef.current = supabase
      .channel(`zone:${activeZoneId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
          filter: `zone_id=eq.${activeZoneId}`,
        },
        (payload) => {
          const newPost = payload.new as Post
          // Prepend to the first page cache
          queryClient.setQueryData(queryKey, (old: typeof data) => {
            if (!old) return old
            const firstPage = old.pages[0]
            return {
              ...old,
              pages: [
                { ...firstPage, posts: [newPost, ...firstPage.posts] },
                ...old.pages.slice(1),
              ],
            }
          })
        }
      )
      .subscribe()
  }, [activeZoneId, feedMode, queryClient])

  useEffect(() => {
    setupRealtime()
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [activeZoneId, feedMode])

  return {
    posts,
    isLoading,
    isError,
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
    feedMode,
  }
}
